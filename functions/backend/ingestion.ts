import { gzipSync } from 'node:zlib';
import { createHash } from 'node:crypto';
import type { Pool, PoolClient } from 'pg';
import { transaction } from './db.js';
import type { Storage } from './storage.js';
import { download, worldBankUrl, boundaryMetadataUrl, parseWorldBank, parseBoundaryMetadata, parseBoundaries, type Download } from './connectors.js';
import { listing, object, exact, listingKeys, hash, InputError, httpsUrl } from './validation.js';
import { publishInTransaction } from './publication.js';
import { downloadHomara,homaraListing } from './homara.js';
import {downloadKpc,validateKpcEnvelope,kpcOrigin,kpcPath} from './kpc.js';
import {downloadListingWeb} from './listing-crawler.js';

export type Source={id:string;slug:string;driver:string;data_kind:string;status:string;publication_allowed:boolean;rights_expire_at:Date|null;collection_transport?:string};
export type Job={id:string;source_id:string;payload:unknown;attempts:number;max_attempts:number;lease_token:string;requested_by?:string};
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
 return {records:v.records as unknown[]};
}
export async function enqueue(db:PoolClient,source:Source,key:string,payload:unknown,actor:string) {
 if(!isApproved(source))throw new InputError('source_not_approved');
 if(source.collection_transport==='source_push')throw new InputError('source_external_collector_managed');
 if(source.driver==='kenya_locations')throw new InputError('source_requires_reviewed_import');
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
   const {rows}=await db.query(`SELECT * FROM atlas_control.sources WHERE driver IN ('worldbank_wdi','geoboundaries_ken','homara_public','kpc_market','approved_listing_web') AND status='active'
    AND collection_transport='worker' AND (rights_expire_at IS NULL OR rights_expire_at>now()) AND (not_before_at IS NULL OR not_before_at<=now()) AND next_run_at<=now() ORDER BY next_run_at FOR UPDATE SKIP LOCKED LIMIT 5`);
   for(const source of rows){
    await enqueue(db,source,`schedule:${new Date(source.next_run_at).toISOString()}`,null,'system:scheduler');
    // Advance scheduled slots, not wall-clock execution time: hourly trigger
    // jitter must not drift a daily source by an extra hour every day.
    await db.query("UPDATE atlas_control.sources SET next_run_at=next_run_at+make_interval(secs=>refresh_seconds*(floor(extract(epoch FROM(now()-next_run_at))/refresh_seconds)::int+1)) WHERE id=$1",[source.id]);
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
   AND(s.not_before_at IS NULL OR s.not_before_at<=now())
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
 // Fetch outside a database transaction: network outages never hold SQL locks.
 const downloads:Download[]=[];
 if(source.driver==='homara_public')downloads.push(await downloadHomara(process.env.ATLAS_HOMARA_PUBLIC_KEY,fetcher));
 else if(source.driver==='kpc_market'){
  if(source.collection_transport==='source_push'){
   if(job.requested_by!=='system:kpc-source-push'||source.slug!=='kpc-market-statistics')throw Error('source_external_collector_managed');
   const value=validateKpcEnvelope(job.payload);
   const counties=new Set((await pool.query("SELECT name FROM atlas_core.locations WHERE kind='county'")).rows.map(r=>String(r.name).toLowerCase()));counties.add('kenya');counties.add('tharaka-nithi');
   if(value.records.some(r=>!counties.has(String(r.geography).toLowerCase())))throw Error('source_unknown_geography');
   downloads.push({value,bytes:Buffer.from(JSON.stringify(value)),url:kpcOrigin+kpcPath});
  }else downloads.push(await downloadKpc());
 }
 else if(source.driver==='approved_listing_web')downloads.push(await downloadListingWeb(pool,source,()=>heartbeat(pool,job)));
 else if(source.driver==='worldbank_wdi')downloads.push(await download(worldBankUrl(),fetcher));
 else if(source.driver==='geoboundaries_ken'){
  const metadata=await download(boundaryMetadataUrl,fetcher);downloads.push(metadata);
  const parsed=parseBoundaryMetadata(metadata.value);await heartbeat(pool,job);
  downloads.push(await download(parsed.url,fetcher));
 }else if(source.driver==='manual_listings')downloads.push(localDownload(validateManualEnvelope(job.payload)));
 else throw new Error('unknown_connector');
 await heartbeat(pool,job);
 const observedAt=(await pool.query('SELECT clock_timestamp() AS time')).rows[0].time.toISOString();
 return transaction(pool,async db=>{
  const {rows:[fenced]}=await db.query("SELECT id FROM atlas_control.jobs WHERE id=$1 AND lease_token=$2 AND status='running' AND lease_expires_at>now() FOR UPDATE",[job.id,job.lease_token]);
  if(!fenced)throw new Error('lease_lost');
  const {rows:[currentSource]}=await db.query('SELECT * FROM atlas_control.sources WHERE id=$1 FOR SHARE',[source.id]);
  if(!isApproved(currentSource))throw new Error('source_not_approved');
  const artifactIds:string[]=[];
  for(const data of downloads)artifactIds.push(await artifact(db,storage,source,job,data));
  let received=0,accepted=0,rejected=0,duplicates=0;
  if(source.driver==='kpc_market'){
   const records=object(downloads[0].value).records as unknown[];received=records.length;
   const result=await db.query(`INSERT INTO atlas_core.market_benchmarks(source_id,job_id,artifact_id,series_key,geography,market_type,period_start,period_end,median_price,sample_count,currency,methodology,source_url,content_hash)
    SELECT $1,$2,$3,r.series_key,r.geography,r.market_type,r.period_start,r.period_end,r.median_price,r.sample_count,r.currency,r.methodology,r.source_url,r.digest
    FROM jsonb_to_recordset($4::jsonb) r(series_key text,geography text,market_type text,period_start date,period_end date,median_price numeric,sample_count int,currency text,methodology text,source_url text,digest text) ON CONFLICT DO NOTHING`,[source.id,job.id,artifactIds[0],JSON.stringify(records)]);
   accepted=result.rowCount||0;duplicates=received-accepted;
  }else if(source.driver==='worldbank_wdi'){
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
   const envelope=object(downloads[0].value),rows=envelope.records as unknown[];received=rows.length;
   if(source.driver==='approved_listing_web'&&Array.isArray(envelope.issues))for(let i=0;i<envelope.issues.length;i++){received++;rejected++;await db.query('INSERT INTO atlas_control.quality_issues(job_id,item_key,codes) VALUES($1,$2,$3) ON CONFLICT DO NOTHING',[job.id,'parser:'+i,[String(envelope.issues[i])]]);}
   const valid:ReturnType<typeof listing>[]=[];
   const countyRows=(await db.query("SELECT id,name FROM atlas_core.locations WHERE kind='county'")).rows;
   const counties=new Set(countyRows.map(r=>r.id));
   const candidateUrls=[...new Set(rows.flatMap(raw=>{try{const r=object(raw);return [httpsUrl(source.driver==='homara_public'?`https://homara.co.ke/property/${r.id}`:r.source_url)];}catch{return [];}}))];
   const urlDigest=(url:string)=>createHash('sha256').update(url).digest('hex');
   const owners=(await db.query(`SELECT u.url_sha256,l.source_listing_id FROM atlas_core.canonical_listing_urls u JOIN atlas_core.source_listings l ON l.id=u.listing_id WHERE u.source_id=$1 AND u.url_sha256=ANY($2::text[])
    UNION SELECT DISTINCT encode(sha256(convert_to(o.source_url,'UTF8')),'hex'),l.source_listing_id FROM atlas_core.listing_observations o JOIN atlas_core.source_listings l ON l.id=o.listing_id WHERE l.source_id=$1 AND o.source_url=ANY($3::text[])`,[source.id,candidateUrls.map(urlDigest),candidateUrls])).rows;
   const knownOwners=new Map<string,Set<string>>();for(const row of owners){const set=knownOwners.get(row.url_sha256)||new Set<string>();set.add(row.source_listing_id);knownOwners.set(row.url_sha256,set);}
   const batchOwners=new Map<string,string>();
   const seen=new Map<string,string>();
   for(let i=0;i<rows.length;i++){
    let v:ReturnType<typeof listing>;
    try{v=source.driver==='homara_public'?homaraListing(rows[i],countyRows,observedAt):listing(source.driver==='approved_listing_web'?{...object(rows[i]),observed_at:observedAt}:rows[i]);}catch(error){rejected++;await db.query('INSERT INTO atlas_control.quality_issues(job_id,item_key,codes) VALUES($1,$2,$3) ON CONFLICT DO NOTHING',[job.id,String(i),[error instanceof InputError?error.code:'invalid_record']]);continue;}
    if(!counties.has(v.county_id)){rejected++;await db.query('INSERT INTO atlas_control.quality_issues(job_id,item_key,codes) VALUES($1,$2,$3)',[job.id,String(i),['unknown_county']]);continue;}
    const urlHash=urlDigest(v.source_url),known=knownOwners.get(urlHash),batchOwner=batchOwners.get(v.source_url);
    if((known&&[...known].some(id=>id!==v.source_listing_id))||(batchOwner&&batchOwner!==v.source_listing_id)){rejected++;await db.query('INSERT INTO atlas_control.quality_issues(job_id,item_key,codes) VALUES($1,$2,$3) ON CONFLICT DO NOTHING',[job.id,String(i),['canonical_url_identity_conflict']]);continue;}
    const key=v.source_listing_id+'|'+v.observed_at,digest=hash(v),previous=seen.get(key);
    if(previous){if(previous===digest)duplicates++;else{rejected++;await db.query('INSERT INTO atlas_control.quality_issues(job_id,item_key,codes) VALUES($1,$2,$3)',[job.id,String(i),['conflicting_observation']]);}continue;}
    seen.set(key,digest);batchOwners.set(v.source_url,v.source_listing_id);valid.push(v);
   }
   const payload=JSON.stringify(valid.map(v=>({...v,digest:hash(v)})));
   await db.query(`INSERT INTO atlas_core.source_listings(source_id,source_listing_id,first_seen_at,last_seen_at)
    SELECT $1,r.source_listing_id,min(r.observed_at),max(r.observed_at) FROM jsonb_to_recordset($2::jsonb) r(source_listing_id text,observed_at timestamptz)
    GROUP BY r.source_listing_id ON CONFLICT(source_id,source_listing_id) DO UPDATE SET first_seen_at=least(atlas_core.source_listings.first_seen_at,EXCLUDED.first_seen_at),last_seen_at=greatest(atlas_core.source_listings.last_seen_at,EXCLUDED.last_seen_at)`,[source.id,payload]);
   await db.query(`INSERT INTO atlas_core.canonical_listing_urls(source_id,url_sha256,listing_id)
    SELECT $1,encode(sha256(convert_to(r.source_url,'UTF8')),'hex'),l.id FROM jsonb_to_recordset($2::jsonb) r(source_listing_id text,source_url text)
    JOIN atlas_core.source_listings l ON l.source_id=$1 AND l.source_listing_id=r.source_listing_id ON CONFLICT DO NOTHING`,[source.id,payload]);
   const r=await db.query(`INSERT INTO atlas_core.listing_observations(listing_id,job_id,artifact_id,content_hash,observed_at,source_updated_at,source_url,listing_type,property_type,county_id,neighbourhood,bedrooms,bathrooms,price_amount,currency,rent_period,floor_area_sqm,plot_area_sqm,availability,status_evidence)
    SELECT l.id,$2,$3,r.digest,r.observed_at,r.source_updated_at,r.source_url,r.listing_type,r.property_type,r.county_id,r.neighbourhood,r.bedrooms,r.bathrooms,r.price_amount,r.currency,r.rent_period,r.floor_area_sqm,r.plot_area_sqm,r.availability,r.status_evidence
    FROM jsonb_to_recordset($4::jsonb) r(source_listing_id text,digest text,observed_at timestamptz,source_updated_at timestamptz,source_url text,listing_type text,property_type text,county_id uuid,neighbourhood text,bedrooms smallint,bathrooms smallint,price_amount numeric,currency text,rent_period text,floor_area_sqm numeric,plot_area_sqm numeric,availability text,status_evidence text)
    JOIN atlas_core.source_listings l ON l.source_id=$1 AND l.source_listing_id=r.source_listing_id ON CONFLICT DO NOTHING`,[source.id,job.id,artifactIds[0],payload]);
   accepted=r.rowCount||0;
   const conflicts=await db.query(`SELECT r.source_listing_id,r.observed_at FROM jsonb_to_recordset($2::jsonb) r(source_listing_id text,observed_at timestamptz,digest text)
    JOIN atlas_core.source_listings l ON l.source_id=$1 AND l.source_listing_id=r.source_listing_id
    JOIN atlas_core.listing_observations o ON o.listing_id=l.id AND o.observed_at=r.observed_at WHERE o.content_hash<>r.digest`,[source.id,payload]);
   for(const conflict of conflicts.rows){rejected++;await db.query('INSERT INTO atlas_control.quality_issues(job_id,item_key,codes) VALUES($1,$2,$3) ON CONFLICT DO NOTHING',[job.id,'conflict:'+conflict.source_listing_id,['conflicting_observation']]);}
   duplicates+=valid.length-accepted-conflicts.rowCount!;
  }
  const code=received>0&&rejected===received?'all_records_quarantined':null;
  const status=code?'blocked':'succeeded';
  if(!code){const frontier=source.driver==='approved_listing_web'?object(downloads[0].value).crawl_frontier:undefined;await db.query('UPDATE atlas_control.sources SET last_success_at=now(),watermark=$2 WHERE id=$1',[source.id,JSON.stringify({observed_at:observedAt,job_id:job.id,...(frontier?{crawl_frontier:frontier}:{})})]);if(frontier){const f=frontier as {queue:unknown[];started_at:string};await db.query("UPDATE atlas_control.sources SET next_run_at=CASE WHEN $2 THEN now()+interval '1 hour' ELSE greatest(now(),$3::timestamptz+interval '24 hours') END WHERE id=$1",[source.id,f.queue.length>0,f.started_at]);}}
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
  const safe=/^(?:upstream_[a-z0-9_]+|homara_schema_changed|homara_pagination_invalid|incomplete_[a-z_]+|source_[a-z_]+|lease_lost|artifact_budget_exhausted)$/.test(message)?message:'processing_error';
  const permanent=/license|schema_changed|not_approved|budget|too_large|unsafe|robots_disallowed|not_configured|capacity|allowlisted|pagination_invalid/.test(safe);
  const requested=Number((error as {retryAfterSeconds?:number})?.retryAfterSeconds),delay=Number.isFinite(requested)?Math.min(604800,Math.max(0,Math.ceil(requested))):0;
  await transaction(pool,async db=>{const updated=await db.query(`UPDATE atlas_control.jobs SET status=CASE WHEN $3 THEN 'blocked' WHEN attempts>=max_attempts THEN 'failed' ELSE 'retry' END,
   error_code=$4,lease_token=NULL,lease_expires_at=NULL,next_attempt_at=now()+make_interval(secs=>greatest(least(3600,30*power(2,attempts)::int),$5::int)),
   finished_at=CASE WHEN $3 OR attempts>=max_attempts THEN now() END WHERE id=$1 AND lease_token=$2 AND status='running' RETURNING source_id`,[job.id,job.lease_token,permanent,safe,delay]);if(updated.rowCount&&delay)await db.query("UPDATE atlas_control.sources SET not_before_at=greatest(coalesce(not_before_at,now()),now()+make_interval(secs=>$2)) WHERE id=$1",[job.source_id,delay]);});
  console.error(JSON.stringify({event:'ingestion_failure',job_id:job.id,code:safe}));
  return {job_id:job.id,status:'error',code:safe};
 }
}
