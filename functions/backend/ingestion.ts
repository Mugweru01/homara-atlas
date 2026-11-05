import { gzipSync } from 'node:zlib';
import { createHash } from 'node:crypto';
import type { Pool, PoolClient } from 'pg';
import { transaction } from './db.js';
import type { Storage } from './storage.js';
import { download, worldBankUrl, boundaryMetadataUrl, parseWorldBank, parseBoundaryMetadata, parseBoundaries, type Download } from './connectors.js';
import { listing, object, exact, listingKeys, hash, InputError, httpsUrl } from './validation.js';
import { publishInTransaction } from './publication.js';

export type Source={id:string;slug:string;driver:string;data_kind:string;status:string;publication_allowed:boolean;rights_expire_at:Date|null};
export type Job={id:string;source_id:string;payload:unknown;attempts:number;max_attempts:number;lease_token:string};
export function isApproved(s:Source,now=Date.now()) {
 return s.status==='active' && (!s.rights_expire_at||new Date(s.rights_expire_at).getTime()>now);
}
export function validateManualEnvelope(payload:unknown) {
 const v=object(payload);exact(v,['records']);
 if(!Array.isArray(v.records)||!v.records.length||v.records.length>1000)throw new InputError('batch_requires_1_to_1000_records');
 // Reject unknown fields before storing any payload: no contacts or arbitrary text blobs.
 for(const raw of v.records){
  const row=object(raw);exact(row,listingKeys);
  if(Object.values(row).some(x=>x!==null&&!['string','number'].includes(typeof x)))throw new InputError('nested_or_non_scalar_fields_forbidden');
  if(Object.values(row).some(x=>typeof x==='string'&&x.length>2000))throw new InputError('field_too_long');
  if(typeof row.source_listing_id!=='string'||!/^[A-Za-z0-9._:-]{1,160}$/.test(row.source_listing_id))throw new InputError('invalid_source_listing_id');
  httpsUrl(row.source_url);
 }
 return v;
}
export async function enqueue(db:PoolClient,source:Source,key:string,payload:unknown,actor:string) {
 if(!isApproved(source))throw new InputError('source_not_approved');
 if(source.driver==='manual_listings')validateManualEnvelope(payload);
 else if(payload!=null)throw new InputError('connector_payload_not_allowed');
 const digest=hash(payload??null);
 const {rows:[created]}=await db.query(`INSERT INTO atlas_control.jobs(source_id,idempotency_key,payload,requested_by,request_hash)
 VALUES($1,$2,$3,$4,$5) ON CONFLICT(source_id,idempotency_key) DO NOTHING RETURNING id,status`,[source.id,key,payload==null?null:JSON.stringify(payload),actor,digest]);
 if(created)return created;
 const {rows:[existing]}=await db.query(`SELECT id,status FROM atlas_control.jobs WHERE source_id=$1 AND idempotency_key=$2 AND request_hash=$3`,[source.id,key,digest]);
 if(!existing)throw new InputError('idempotency_payload_conflict');return existing;
}
export async function scheduleDue(pool:Pool) {
 return transaction(pool,async db=>{
   await db.query(`UPDATE atlas_control.jobs j SET status='blocked',error_code='source_not_approved',finished_at=now()
    FROM atlas_control.sources s WHERE s.id=j.source_id AND j.status IN ('queued','retry')
    AND (s.status<>'active' OR (s.rights_expire_at IS NOT NULL AND s.rights_expire_at<=now()))`);
   const {rows}=await db.query(`SELECT * FROM atlas_control.sources WHERE driver<>'manual_listings' AND status='active'
    AND (rights_expire_at IS NULL OR rights_expire_at>now()) AND next_run_at<=now() ORDER BY next_run_at FOR UPDATE SKIP LOCKED LIMIT 5`);
   for(const source of rows){
    await enqueue(db,source,`schedule:${new Date(source.next_run_at).toISOString()}`,null,'system:scheduler');
    await db.query("UPDATE atlas_control.sources SET next_run_at=now()+make_interval(secs=>refresh_seconds) WHERE id=$1",[source.id]);
   }
   await db.query("DELETE FROM atlas_security.rate_windows WHERE window_start<now()-interval '1 hour'");
   return rows.length;
 });
}
export async function claim(pool:Pool):Promise<Job|null> {
 return transaction(pool,async db=>{
  await db.query("SELECT pg_advisory_xact_lock(hashtext('atlas-job-claim'))");
  await db.query(`UPDATE atlas_control.jobs SET status=CASE WHEN attempts>=max_attempts THEN 'failed' ELSE 'retry' END,
   error_code='lease_expired',lease_token=NULL,lease_expires_at=NULL,next_attempt_at=now(),
   finished_at=CASE WHEN attempts>=max_attempts THEN now() END
   WHERE status='running' AND lease_expires_at<now()`);
  const {rows:[job]}=await db.query(`WITH candidate AS (
   SELECT j.id FROM atlas_control.jobs j JOIN atlas_control.sources s ON s.id=j.source_id
   WHERE j.status IN ('queued','retry') AND j.next_attempt_at<=now() AND j.attempts<j.max_attempts
   AND s.status='active' AND (s.rights_expire_at IS NULL OR s.rights_expire_at>now())
   AND NOT EXISTS(SELECT 1 FROM atlas_control.jobs other WHERE other.source_id=j.source_id AND other.status='running')
   ORDER BY j.created_at FOR UPDATE OF j SKIP LOCKED LIMIT 1
  ) UPDATE atlas_control.jobs j SET status='running',attempts=attempts+1,lease_token=gen_random_uuid(),
   lease_expires_at=now()+interval '3 minutes',started_at=coalesce(started_at,now()),error_code=NULL
   FROM candidate WHERE j.id=candidate.id RETURNING j.*`);
  return job||null;
 });
}
export async function heartbeat(pool:Pool,job:Job) {
 const r=await pool.query("UPDATE atlas_control.jobs SET lease_expires_at=now()+interval '3 minutes' WHERE id=$1 AND lease_token=$2 AND status='running' AND lease_expires_at>now()",[job.id,job.lease_token]);
 if(!r.rowCount)throw new Error('lease_lost');
}
async function artifact(db:PoolClient,storage:Storage,source:Source,job:Job,data:Download) {
 const digest=createHash('sha256').update(data.bytes).digest('hex');
 const existing=await db.query('SELECT id,object_key FROM atlas_control.artifacts WHERE source_id=$1 AND sha256=$2',[source.id,digest]);
 let id:string=existing.rows[0]?.id;
 if(!id){
  await db.query("SELECT pg_advisory_xact_lock(hashtext('atlas-artifact-budget'))");
  const {rows:[usage]}=await db.query('SELECT coalesce(sum(byte_length),0)::bigint bytes FROM atlas_control.artifacts');
  const compressed=gzipSync(data.bytes);
  if(Number(usage.bytes)+compressed.length>200*1024*1024)throw new Error('artifact_budget_exhausted');
  const key=`sources/${source.id}/${digest}.json.gz`;
  // Content-addressing makes a crash after upload safe to retry without extra objects.
  await storage.put('atlasraw',key,compressed,'application/gzip');
  const result=await db.query(`INSERT INTO atlas_control.artifacts(source_id,sha256,object_key,byte_length,source_url)
   VALUES($1,$2,$3,$4,$5) ON CONFLICT(source_id,sha256) DO NOTHING RETURNING id`,[source.id,digest,key,compressed.length,data.url]);
  id=result.rows[0]?.id || (await db.query('SELECT id FROM atlas_control.artifacts WHERE source_id=$1 AND sha256=$2',[source.id,digest])).rows[0].id;
 }
 await db.query('INSERT INTO atlas_control.job_artifacts(job_id,artifact_id) VALUES($1,$2) ON CONFLICT DO NOTHING',[job.id,id]);
 return id;
}
function localDownload(value:unknown):Download {const bytes=Buffer.from(JSON.stringify(value));return {value,bytes,url:'manual:approved-operator-upload'};}

export async function processJob(pool:Pool,storage:Storage,job:Job,fetcher:typeof fetch=fetch) {
 const {rows:[source]}=await pool.query('SELECT * FROM atlas_control.sources WHERE id=$1',[job.source_id]);
 if(!source||!isApproved(source))throw new Error('source_not_approved');
 const observedAt=new Date().toISOString();
 // Fetch outside a database transaction: network outages never hold SQL locks.
 const downloads:Download[]=[];
 if(source.driver==='worldbank_wdi')downloads.push(await download(worldBankUrl(),fetcher));
 else if(source.driver==='geoboundaries_ken'){
  const metadata=await download(boundaryMetadataUrl,fetcher);downloads.push(metadata);
  const parsed=parseBoundaryMetadata(metadata.value);await heartbeat(pool,job);
  downloads.push(await download(parsed.url,fetcher));
 }else if(source.driver==='manual_listings')downloads.push(localDownload(validateManualEnvelope(job.payload)));
 else throw new Error('unknown_connector');
 await heartbeat(pool,job);
 return transaction(pool,async db=>{
  const {rows:[fenced]}=await db.query("SELECT id FROM atlas_control.jobs WHERE id=$1 AND lease_token=$2 AND status='running' AND lease_expires_at>now() FOR UPDATE",[job.id,job.lease_token]);
  if(!fenced)throw new Error('lease_lost');
  const {rows:[currentSource]}=await db.query('SELECT * FROM atlas_control.sources WHERE id=$1 FOR SHARE',[source.id]);
  if(!isApproved(currentSource))throw new Error('source_not_approved');
  const artifactIds:string[]=[];
  for(const data of downloads)artifactIds.push(await artifact(db,storage,source,job,data));
  let received=0,accepted=0,rejected=0,duplicates=0;
  if(source.driver==='worldbank_wdi'){
   const rows=parseWorldBank(downloads[0].value);if(!rows.length)throw new Error('incomplete_source_response');received=rows.length;
   const r=await db.query(`INSERT INTO atlas_core.indicator_observations(source_id,job_id,artifact_id,indicator_code,indicator_name,unit,country_code,reference_year,value,content_hash)
    SELECT $1,$2,$3,r.code,r.name,r.unit,'KEN',r.year,r.value,r.digest FROM jsonb_to_recordset($4::jsonb) r(code text,name text,unit text,year int,value numeric,digest text) ON CONFLICT DO NOTHING`,[source.id,job.id,artifactIds[0],JSON.stringify(rows.map(r=>({...r,digest:hash(r)})))]);
   accepted=r.rowCount||0;duplicates=received-accepted;
  } else if(source.driver==='geoboundaries_ken'){
   const metadata=parseBoundaryMetadata(downloads[0].value),rows=parseBoundaries(downloads[1].value);received=rows.length;
   await db.query(`INSERT INTO atlas_core.locations(source_id,source_key,name,kind)
    SELECT $1,r.key,r.name,'county' FROM jsonb_to_recordset($2::jsonb) r(key text,name text)
    ON CONFLICT(source_id,source_key) DO UPDATE SET name=EXCLUDED.name`,[source.id,JSON.stringify(rows)]);
   const r=await db.query(`INSERT INTO atlas_core.location_versions(location_id,artifact_id,revision_key,reference_year,geometry,observed_at)
    SELECT l.id,$2,$3,$4,r.geometry,$5 FROM jsonb_to_recordset($6::jsonb) r(key text,geometry jsonb)
    JOIN atlas_core.locations l ON l.source_id=$1 AND l.source_key=r.key ON CONFLICT DO NOTHING`,[source.id,artifactIds[1],metadata.revision,metadata.year,observedAt,JSON.stringify(rows)]);
   accepted=r.rowCount||0;duplicates=received-accepted;
  } else {
   const rows=object(downloads[0].value).records as unknown[];received=rows.length;
   const valid:ReturnType<typeof listing>[]=[];
   const counties=new Set((await db.query("SELECT id FROM atlas_core.locations WHERE kind='county'")).rows.map(r=>r.id));
   const seen=new Map<string,string>();
   for(let i=0;i<rows.length;i++){
    let v:ReturnType<typeof listing>;
    try{v=listing(rows[i]);}catch(error){rejected++;await db.query('INSERT INTO atlas_control.quality_issues(job_id,item_key,codes) VALUES($1,$2,$3) ON CONFLICT DO NOTHING',[job.id,String(i),[error instanceof InputError?error.code:'invalid_record']]);continue;}
    if(!counties.has(v.county_id)){rejected++;await db.query('INSERT INTO atlas_control.quality_issues(job_id,item_key,codes) VALUES($1,$2,$3)',[job.id,String(i),['unknown_county']]);continue;}
    const key=v.source_listing_id+'|'+v.observed_at,digest=hash(v),previous=seen.get(key);
    if(previous){if(previous===digest)duplicates++;else{rejected++;await db.query('INSERT INTO atlas_control.quality_issues(job_id,item_key,codes) VALUES($1,$2,$3)',[job.id,String(i),['conflicting_observation']]);}continue;}
    seen.set(key,digest);valid.push(v);
   }
   const payload=JSON.stringify(valid.map(v=>({...v,digest:hash(v)})));
   await db.query(`INSERT INTO atlas_core.source_listings(source_id,source_listing_id,first_seen_at,last_seen_at)
    SELECT $1,r.source_listing_id,min(r.observed_at),max(r.observed_at) FROM jsonb_to_recordset($2::jsonb) r(source_listing_id text,observed_at timestamptz)
    GROUP BY r.source_listing_id ON CONFLICT(source_id,source_listing_id) DO UPDATE SET first_seen_at=least(atlas_core.source_listings.first_seen_at,EXCLUDED.first_seen_at),last_seen_at=greatest(atlas_core.source_listings.last_seen_at,EXCLUDED.last_seen_at)`,[source.id,payload]);
   const r=await db.query(`INSERT INTO atlas_core.listing_observations(listing_id,job_id,artifact_id,content_hash,observed_at,source_updated_at,source_url,listing_type,property_type,county_id,neighbourhood,bedrooms,price_amount,currency,rent_period,floor_area_sqm,plot_area_sqm,availability,status_evidence)
    SELECT l.id,$2,$3,r.digest,r.observed_at,r.source_updated_at,r.source_url,r.listing_type,r.property_type,r.county_id,r.neighbourhood,r.bedrooms,r.price_amount,r.currency,r.rent_period,r.floor_area_sqm,r.plot_area_sqm,r.availability,r.status_evidence
    FROM jsonb_to_recordset($4::jsonb) r(source_listing_id text,digest text,observed_at timestamptz,source_updated_at timestamptz,source_url text,listing_type text,property_type text,county_id uuid,neighbourhood text,bedrooms smallint,price_amount numeric,currency text,rent_period text,floor_area_sqm numeric,plot_area_sqm numeric,availability text,status_evidence text)
    JOIN atlas_core.source_listings l ON l.source_id=$1 AND l.source_listing_id=r.source_listing_id ON CONFLICT DO NOTHING`,[source.id,job.id,artifactIds[0],payload]);
   accepted=r.rowCount||0;
   const conflicts=await db.query(`SELECT r.source_listing_id,r.observed_at FROM jsonb_to_recordset($2::jsonb) r(source_listing_id text,observed_at timestamptz,digest text)
    JOIN atlas_core.source_listings l ON l.source_id=$1 AND l.source_listing_id=r.source_listing_id
    JOIN atlas_core.listing_observations o ON o.listing_id=l.id AND o.observed_at=r.observed_at WHERE o.content_hash<>r.digest`,[source.id,payload]);
   for(const conflict of conflicts.rows){rejected++;await db.query('INSERT INTO atlas_control.quality_issues(job_id,item_key,codes) VALUES($1,$2,$3) ON CONFLICT DO NOTHING',[job.id,'conflict:'+conflict.source_listing_id,['conflicting_observation']]);}
   duplicates+=valid.length-accepted-conflicts.rowCount!;
  }
  const code=rejected===received?'all_records_quarantined':null;
  const status=code?'blocked':'succeeded';
  if(!code)await db.query('UPDATE atlas_control.sources SET last_success_at=now(),watermark=$2 WHERE id=$1',[source.id,JSON.stringify({observed_at:observedAt,job_id:job.id})]);
  await db.query(`UPDATE atlas_control.jobs SET status=$3,finished_at=now(),lease_token=NULL,lease_expires_at=NULL,
   received_count=$4,accepted_count=$5,rejected_count=$6,duplicate_count=$7,error_code=$8,payload=NULL WHERE id=$1 AND lease_token=$2`,[job.id,job.lease_token,status,received,accepted,rejected,duplicates,code]);
  const publicationTime=(await db.query('SELECT clock_timestamp() AS time')).rows[0].time.toISOString();
  const release=source.data_kind==='listings'&&!code?await publishInTransaction(db,publicationTime):null;
  await db.query('INSERT INTO atlas_control.audit_events(actor_id,action,resource_id,details) VALUES($1,$2,$3,$4)', ['system:worker','ingestion.'+status,job.id,JSON.stringify({received,accepted,rejected,duplicates,release})]);
  return {job_id:job.id,status,received,accepted,rejected,duplicates,release};
 });
}
export async function runOne(pool:Pool,storage:Storage,fetcher:typeof fetch=fetch) {
 const job=await claim(pool);if(!job)return null;
 try{return await processJob(pool,storage,job,fetcher);}catch(error){
  const message=error instanceof Error?error.message:'worker_error';
  const safe=/^(?:upstream_[a-z0-9_]+|incomplete_[a-z_]+|source_[a-z_]+|lease_lost|artifact_budget_exhausted)$/.test(message)?message:'processing_error';
  const permanent=/license|schema_changed|not_approved|budget|too_large/.test(safe);
  await pool.query(`UPDATE atlas_control.jobs SET status=CASE WHEN $3 THEN 'blocked' WHEN attempts>=max_attempts THEN 'failed' ELSE 'retry' END,
   error_code=$4,lease_token=NULL,lease_expires_at=NULL,next_attempt_at=now()+make_interval(secs=>least(3600,30*power(2,attempts)::int)),
   finished_at=CASE WHEN $3 OR attempts>=max_attempts THEN now() END WHERE id=$1 AND lease_token=$2 AND status='running'`,[job.id,job.lease_token,permanent,safe]);
  console.error(JSON.stringify({event:'ingestion_failure',job_id:job.id,code:safe}));
  return {job_id:job.id,status:'error',code:safe};
 }
}
