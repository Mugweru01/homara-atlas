import { randomUUID } from 'node:crypto';
import { gunzipSync } from 'node:zlib';
import type { Pool } from 'pg';
import { Hono } from 'hono';
import { cors } from 'hono/cors';
import { bodyLimit } from 'hono/body-limit';
import { secureHeaders } from 'hono/secure-headers';
import { HTTPException } from 'hono/http-exception';
import { transaction } from './db.js';
import { InputError, object, exact, text, httpsUrl, uuid, oneOf, pagination } from './validation.js';
import { rateLimit, type Principal } from './security.js';
import { enqueue, type Source } from './ingestion.js';
import type { Storage } from './storage.js';

export type Dependencies={
 pool:Pool; storage:Storage; verify:(token:string)=>Promise<Principal>; rateSecret:string;
 origins:string[]; seal:(userId:string)=>Promise<unknown>; kick?:()=>void;
};
type Variables={requestId:string;principal:Principal;operatorRole:string};
export function createApp(d:Dependencies) {
 if(d.rateSecret.length<32)throw new Error('A strong rate-limit secret is required');
 const app=new Hono<{Variables:Variables}>();
 app.use('*',secureHeaders());
 app.use('*',async(c,next)=>{
  c.set('requestId',randomUUID());c.header('X-Request-ID',c.get('requestId'));
  c.header('Cache-Control','no-store');await next();
 });
 app.use('*',cors({origin:d.origins,allowHeaders:['Authorization','Content-Type','Idempotency-Key'],allowMethods:['GET','POST','PATCH','DELETE','OPTIONS'],maxAge:600}));
 app.use('*',bodyLimit({maxSize:1024*1024,onError:c=>c.json({error:'body_too_large',request_id:c.get('requestId')},413)}));
 app.onError((error,c)=>{
  const id=c.get('requestId');
  if(error instanceof InputError){const conflict=/conflict/.test(error.code);return c.json({error:error.code,request_id:id},conflict?409:400);}
  if(error instanceof SyntaxError)return c.json({error:'invalid_json',request_id:id},400);
  if(error instanceof HTTPException){if(error.status===429)c.header('Retry-After','60');return c.json({error:error.message,request_id:id},error.status);}
  console.error(JSON.stringify({event:'api_error',request_id:id,error_code:(error as {code?:string}).code||error.name}));
  return c.json({error:'service_unavailable',request_id:id},503);
 });
 app.notFound(c=>c.json({error:'not_found',request_id:c.get('requestId')},404));
 app.use('/api/*',async(c,next)=>{
  if(c.req.method==='OPTIONS'||c.req.path==='/api/v1/system/health')return next();
  // Global public budgets cannot be bypassed by spoofing client-IP headers.
  await rateLimit(d.pool,d.rateSecret,'api-global',600);await next();
 });
 app.get('/api/v1/system/health',c=>c.json({status:'healthy',service:'atlas-backend',version:'2'}));
 app.get('/api/v1/system/ready',async c=>{
  const {rows:[r]}=await d.pool.query("SELECT current_user AS role,(SELECT count(*) FROM atlas_control.sources) AS sources");
  if(r.role!=='atlas_api_login')throw new Error('dedicated_api_role_required');
  return c.json({status:'ready',schema_version:'atlas-backend/1'});
 });
 app.get('/api/v1/system/data-health',async c=>{
  const {rows}=await d.pool.query(`SELECT slug,data_kind,status,last_success_at,
   (last_success_at IS NULL OR last_success_at<now()-make_interval(secs=>refresh_seconds*2)) AS stale
   FROM atlas_control.sources WHERE driver<>'manual_listings' ORDER BY slug`);
  return c.json({status:rows.some(r=>r.stale)?'degraded':'current',sources:rows});
 });
 app.get('/api/v1/sources',async c=>{
  const {rows}=await d.pool.query(`SELECT slug,name,data_kind,license,permission_url,attribution,last_success_at
   FROM atlas_control.sources WHERE status='active' AND publication_allowed AND (rights_expire_at IS NULL OR rights_expire_at>now()) ORDER BY slug`);
  return c.json({results:rows});
 });
 app.get('/api/v1/geography/counties',async c=>{
  const {rows}=await d.pool.query(`SELECT l.id,l.name,v.reference_year FROM atlas_core.locations l
   JOIN atlas_control.sources s ON s.id=l.source_id
   JOIN LATERAL(SELECT reference_year FROM atlas_core.location_versions WHERE location_id=l.id ORDER BY observed_at DESC LIMIT 1)v ON true
   WHERE l.kind='county' AND s.status='active' AND s.publication_allowed AND (s.rights_expire_at IS NULL OR s.rights_expire_at>now()) ORDER BY l.name`);
  return c.json({results:rows,precision:'county',notice:'Administrative context; not cadastral or property-level coordinates.'});
 });
 app.get('/api/v1/context/indicators',async c=>{
  const {limit,offset}=pagination(c.req.query());
  const code=c.req.query('code')||null;if(code&&!/^[A-Z0-9_.]{3,40}$/.test(code))throw new InputError('invalid_indicator_code');
  const {rows}=await d.pool.query(`SELECT DISTINCT ON(i.source_id,i.indicator_code,i.reference_year)
   i.indicator_code,i.indicator_name,i.reference_year,i.value,i.unit,i.country_code,i.retrieved_at,s.attribution
   FROM atlas_core.indicator_observations i JOIN atlas_control.sources s ON s.id=i.source_id
   WHERE s.status='active' AND s.publication_allowed AND (s.rights_expire_at IS NULL OR s.rights_expire_at>now()) AND ($1::text IS NULL OR i.indicator_code=$1)
   ORDER BY i.source_id,i.indicator_code,i.reference_year DESC,i.retrieved_at DESC LIMIT $2 OFFSET $3`,[code,limit,offset]);
  return c.json({results:rows,limit,offset,notice:'Annual national context. These are not property prices, current rents, or household incomes.'});
 });
 app.get('/api/v1/analytics/overview',async c=>{
  const {rows:[release]}=await d.pool.query('SELECT * FROM atlas_mart.valid_release');
  const {rows:[row]}=await d.pool.query(`SELECT coalesce(sum(m.listing_count),0)::int total_listings,count(distinct m.county_id)::int counties_covered,
   sum(m.mean_price*m.listing_count) FILTER(WHERE m.listing_type='sale') /nullif(sum(m.listing_count) FILTER(WHERE m.listing_type='sale' AND NOT m.sparse),0) AS avg_listing_price_ksh,
   sum(m.mean_price*m.listing_count) FILTER(WHERE m.listing_type='rent') /nullif(sum(m.listing_count) FILTER(WHERE m.listing_type='rent' AND NOT m.sparse),0) AS avg_rent_ksh
   FROM atlas_mart.market_snapshots m JOIN atlas_mart.valid_release r ON r.id=m.release_id`);
  return c.json({status:row.total_listings?'ok':'awaiting_verified_listings',...row,avg_listing_price_ksh:row.avg_listing_price_ksh?Number(row.avg_listing_price_ksh):null,avg_rent_ksh:row.avg_rent_ksh?Number(row.avg_rent_ksh):null,
   avg_price_per_sqft_ksh:null,currency:'KES',source:'neon_postgresql',release:release||null,methodology:'asking-market/1',minimum_sample:30,active_within_days:14,
   notice:'Sale and monthly rent are separate populations. Sparse segments do not contribute price estimates; unavailable means null, never zero.'});
 });
 app.get('/api/v1/analytics/:kind',async c=>{
  if(!['price-index','neighbourhoods','market'].includes(c.req.param('kind')))throw new HTTPException(404,{message:'not_found'});
  const q=c.req.query(),{limit,offset}=pagination(q),county=q.county||null;
  if(county&&county.length>120)throw new InputError('invalid_county');
  const type=q.listing_type?oneOf(q.listing_type,['sale','rent']):null;
  const {rows}=await d.pool.query(`SELECT m.*,l.name county,m.mean_price AS avg_price_ksh,m.median_price AS median_price_ksh,
   CASE WHEN m.listing_type='rent' THEN m.mean_price END avg_rent_ksh
   FROM atlas_mart.market_snapshots m JOIN atlas_mart.valid_release r ON r.id=m.release_id
   JOIN atlas_core.locations l ON l.id=m.county_id
   WHERE ($1::text IS NULL OR lower(l.name)=lower($1)) AND ($2::text IS NULL OR m.listing_type=$2)
   ORDER BY l.name,m.listing_type,m.property_type,m.bedrooms LIMIT $3 OFFSET $4`,[county,type,limit,offset]);
  return c.json({status:'ok',results:rows,limit,offset,methodology:'asking-market/1',minimum_sample:30,
   notice:'County-level asking statistics only. No historical index, neighbourhood precision, or achieved transaction prices are implied.'});
 });
 // Authenticate at router boundaries. No caller-supplied owner or operator claim is trusted.
 app.use('/api/v1/workspace/*',authenticate);
 app.use('/api/v1/admin/*',authenticate);
 async function authenticate(c:import('hono').Context<{Variables:Variables}>,next:()=>Promise<void>){
  const auth=c.req.header('Authorization');if(!auth?.startsWith('Bearer ')||auth.length>8192)throw new HTTPException(401,{message:'sign_in_required'});
  let principal:Principal;try{principal=await d.verify(auth.slice(7));}catch{throw new HTTPException(401,{message:'invalid_or_expired_session'});}
  c.set('principal',principal);await rateLimit(d.pool,d.rateSecret,'user:'+principal.id,60);await next();
 }
 app.use('/api/v1/admin/*',async(c,next)=>{
  const {rows:[role]}=await d.pool.query('SELECT role FROM atlas_security.operator_roles WHERE user_id=$1',[c.get('principal').id]);
  if(!role)throw new HTTPException(403,{message:'operator_access_required'});c.set('operatorRole',role.role);await next();
 });
 function admin(role:string){if(role!=='admin')throw new HTTPException(403,{message:'administrator_access_required'});}
 app.get('/api/v1/workspace/reports',async c=>{
  const user=c.get('principal').id;
  const rows=await transaction(d.pool,async db=>(await db.query("SELECT id,title,created_at FROM public.atlas_reports WHERE owner_id=$1 AND storage_state='ready' ORDER BY created_at DESC LIMIT 100",[user])).rows,user);
  return c.json(rows);
 });
 app.post('/api/v1/workspace/reports/live',async c=>c.json(await d.seal(c.get('principal').id)));
 app.post('/api/v1/workspace/reports',async c=>{
  const v=object(await c.req.json());exact(v,['title','content']);const title=text(v.title,120)!;
  if(typeof v.content!=='string'||Buffer.byteLength(v.content)>10000||!v.content.trim())throw new InputError('invalid_report_content');
  const user=c.get('principal').id,id=randomUUID(),key=`reports/${user}/${id}.txt`,bytes=Buffer.from(v.content);
  try{await transaction(d.pool,async db=>{
   await db.query('SELECT pg_advisory_xact_lock(hashtext($1))',['report-quota:'+user]);
   const {rows:[count]}=await db.query('SELECT count(*)::int n FROM public.atlas_reports WHERE owner_id=$1',[user]);
   if(count.n>=100)throw new HTTPException(409,{message:'report_quota_exceeded'});
   await db.query("INSERT INTO public.atlas_reports(id,owner_id,title,object_key,content_bytes,storage_state) VALUES($1,$2,$3,$4,$5,'pending')",[id,user,title,key,bytes.length]);
  },user);
   await d.storage.put('assets',key,bytes,'text/plain; charset=utf-8');
   await transaction(d.pool,db=>db.query("UPDATE public.atlas_reports SET storage_state='ready' WHERE id=$1 AND owner_id=$2",[id,user]),user);
  }catch(error){
   // If cleanup itself fails the durable pending row is swept by the worker.
   await transaction(d.pool,async db=>{await db.query('DELETE FROM public.atlas_reports WHERE id=$1 AND owner_id=$2',[id,user]);await db.query("INSERT INTO atlas_control.object_deletions(bucket,object_key) VALUES('assets',$1) ON CONFLICT DO NOTHING",[key]);},user).catch(()=>{});
   throw error;
  }
  return c.json({id,title},201);
 });
 app.get('/api/v1/workspace/reports/:id',async c=>{
  const id=uuid(c.req.param('id')),user=c.get('principal').id;
  const row=await transaction(d.pool,async db=>(await db.query("SELECT object_key FROM public.atlas_reports WHERE id=$1 AND owner_id=$2 AND storage_state='ready'",[id,user])).rows[0],user);
  if(!row)throw new HTTPException(404,{message:'not_found'});return c.json({url:await d.storage.url('assets',row.object_key)});
 });
 app.delete('/api/v1/workspace/reports/:id',async c=>{
  const id=uuid(c.req.param('id')),user=c.get('principal').id;
  await transaction(d.pool,async db=>{const {rows:[row]}=await db.query('SELECT object_key FROM public.atlas_reports WHERE id=$1 AND owner_id=$2 FOR UPDATE',[id,user]);if(!row)throw new HTTPException(404,{message:'not_found'});
   await db.query("INSERT INTO atlas_control.object_deletions(bucket,object_key) VALUES('assets',$1) ON CONFLICT DO NOTHING",[row.object_key]);
   await db.query('DELETE FROM public.atlas_reports WHERE id=$1 AND owner_id=$2',[id,user]);},user);
  return c.body(null,204);
 });
 app.get('/api/v1/admin/sources',async c=>c.json({results:(await d.pool.query('SELECT * FROM atlas_control.sources ORDER BY created_at DESC')).rows}));
 app.post('/api/v1/admin/sources',async c=>{
  admin(c.get('operatorRole'));const v=object(await c.req.json());exact(v,['slug','name','license','permission_url','attribution']);
  const slug=text(v.slug,60)!;if(!/^[a-z0-9][a-z0-9-]{2,59}$/.test(slug))throw new InputError('invalid_slug');
  const result=await transaction(d.pool,async db=>{
   const {rows:[s]}=await db.query(`INSERT INTO atlas_control.sources(slug,name,driver,data_kind,license,permission_url,attribution)
   VALUES($1,$2,'manual_listings','listings',$3,$4,$5) RETURNING id,status`,[slug,text(v.name,160),text(v.license,200),httpsUrl(v.permission_url),text(v.attribution,1000)]);
   await db.query('INSERT INTO atlas_control.audit_events(actor_id,action,resource_id) VALUES($1,$2,$3)',[c.get('principal').id,'source.register',s.id]);return s;
  });return c.json(result,201);
 });
 app.patch('/api/v1/admin/sources/:id',async c=>{
  admin(c.get('operatorRole'));const id=uuid(c.req.param('id')),v=object(await c.req.json());exact(v,['status','publication_allowed','rights_expire_at']);
  const status=oneOf(v.status,['active','disabled','revoked']);if(typeof v.publication_allowed!=='boolean')throw new InputError('publication_flag_required');
  let expiry:string|null=null;if(v.rights_expire_at!=null){if(typeof v.rights_expire_at!=='string'||!Number.isFinite(Date.parse(v.rights_expire_at))||Date.parse(v.rights_expire_at)<=Date.now())throw new InputError('invalid_rights_expiry');expiry=v.rights_expire_at;}
  const s=await transaction(d.pool,async db=>{
   const {rows:[row]}=await db.query(`UPDATE atlas_control.sources SET status=$2,publication_allowed=$3,rights_expire_at=$4,
    approved_at=CASE WHEN $2='active' THEN now() ELSE approved_at END,approved_by=CASE WHEN $2='active' THEN $5 ELSE approved_by END WHERE id=$1 RETURNING id,status`,[id,status,v.publication_allowed,expiry,c.get('principal').id]);
   if(!row)throw new HTTPException(404,{message:'not_found'});await db.query('INSERT INTO atlas_control.audit_events(actor_id,action,resource_id,details) VALUES($1,$2,$3,$4)',[c.get('principal').id,'source.status',id,JSON.stringify({status,publication_allowed:v.publication_allowed})]);return row;
  });return c.json(s);
 });
 app.post('/api/v1/admin/sources/:id/jobs',async c=>{
  const id=uuid(c.req.param('id')),key=text(c.req.header('Idempotency-Key'),160)!;
  const raw=await c.req.text(),payload=raw.trim()?JSON.parse(raw):null;
  const job=await transaction(d.pool,async db=>{
   const {rows:[source]}=await db.query('SELECT * FROM atlas_control.sources WHERE id=$1 FOR SHARE',[id]);if(!source)throw new HTTPException(404,{message:'not_found'});
   const queued=await db.query("SELECT count(*)::int n FROM atlas_control.jobs WHERE status IN ('queued','retry','running')");if(queued.rows[0].n>=100)throw new HTTPException(409,{message:'queue_capacity_exceeded'});
   const result=await enqueue(db,source,key,payload,c.get('principal').id);await db.query('INSERT INTO atlas_control.audit_events(actor_id,action,resource_id) VALUES($1,$2,$3)',[c.get('principal').id,'job.enqueue',result.id]);return result;
  });d.kick?.();return c.json(job,202);
 });
 app.get('/api/v1/admin/jobs',async c=>{
  const {limit,offset}=pagination(c.req.query());const {rows}=await d.pool.query(`SELECT id,source_id,status,attempts,received_count,accepted_count,rejected_count,duplicate_count,error_code,created_at,finished_at FROM atlas_control.jobs ORDER BY created_at DESC LIMIT $1 OFFSET $2`,[limit,offset]);return c.json({results:rows,limit,offset});
 });
 app.get('/api/v1/admin/jobs/:id',async c=>{
  const id=uuid(c.req.param('id'));const {rows:[row]}=await d.pool.query('SELECT id,source_id,status,attempts,received_count,accepted_count,rejected_count,duplicate_count,error_code,created_at,started_at,finished_at FROM atlas_control.jobs WHERE id=$1',[id]);if(!row)throw new HTTPException(404,{message:'not_found'});
  return c.json({...row,issues:(await d.pool.query('SELECT item_key,codes FROM atlas_control.quality_issues WHERE job_id=$1 ORDER BY item_key LIMIT 100',[id])).rows});
 });
 app.post('/api/v1/admin/jobs/:id/replay',async c=>{
  admin(c.get('operatorRole'));const id=uuid(c.req.param('id')),key=text(c.req.header('Idempotency-Key'),160)!;
  const {rows:[job]}=await d.pool.query(`SELECT j.source_id,s.driver,a.object_key FROM atlas_control.jobs j JOIN atlas_control.sources s ON s.id=j.source_id
   JOIN atlas_control.job_artifacts ja ON ja.job_id=j.id JOIN atlas_control.artifacts a ON a.id=ja.artifact_id WHERE j.id=$1 ORDER BY a.retrieved_at LIMIT 1`,[id]);
  if(!job)throw new HTTPException(404,{message:'artifact_not_found'});
  // Manual feeds are replayed from the exact private raw object; automatic feeds refetch the current release.
  let payload=null;if(job.driver==='manual_listings'){const compressed=await d.storage.get('atlasraw',job.object_key);payload=JSON.parse(gunzipSync(compressed,{maxOutputLength:1024*1024}).toString('utf8'));}
  const result=await transaction(d.pool,async db=>{
   const {rows:[s]}=await db.query('SELECT * FROM atlas_control.sources WHERE id=$1 FOR SHARE',[job.source_id]);const queued=await enqueue(db,s,key,payload,c.get('principal').id);
   await db.query('INSERT INTO atlas_control.audit_events(actor_id,action,resource_id,details) VALUES($1,$2,$3,$4)',[c.get('principal').id,'job.replay',queued.id,JSON.stringify({original_job_id:id})]);return queued;
  });d.kick?.();return c.json(result,202);
 });
 app.post('/api/v1/admin/entity-matches',async c=>{
  admin(c.get('operatorRole'));const v=object(await c.req.json());exact(v,['listing_ids','reason']);
  if(!Array.isArray(v.listing_ids)||v.listing_ids.length<2||v.listing_ids.length>20)throw new InputError('require_2_to_20_listings');
  const ids=v.listing_ids.map(x=>uuid(String(x))),reason=text(v.reason,500)!;if(reason.length<10)throw new InputError('review_reason_required');
  const result=await transaction(d.pool,async db=>{
   const {rows}=await db.query('SELECT id,property_id FROM atlas_core.source_listings WHERE id=ANY($1::uuid[]) ORDER BY id FOR UPDATE',[ids]);
   if(rows.length!==new Set(ids).size)throw new HTTPException(404,{message:'listing_not_found'});
   if(rows.some(r=>r.property_id))throw new HTTPException(409,{message:'existing_match_requires_migration_review'});
   const {rows:[property]}=await db.query('INSERT INTO atlas_core.properties DEFAULT VALUES RETURNING id');
   for(const row of rows){await db.query('INSERT INTO atlas_core.entity_matches(listing_id,property_id,reviewed_by,reason) VALUES($1,$2,$3,$4)',[row.id,property.id,c.get('principal').id,reason]);await db.query('UPDATE atlas_core.source_listings SET property_id=$2 WHERE id=$1',[row.id,property.id]);}
   await db.query('INSERT INTO atlas_control.audit_events(actor_id,action,resource_id,details) VALUES($1,$2,$3,$4)',[c.get('principal').id,'entity.match',property.id,JSON.stringify({listing_ids:ids})]);
   await db.query('INSERT INTO atlas_control.publication_requests(singleton) VALUES(true) ON CONFLICT(singleton) DO UPDATE SET requested_at=now()');
   return property;
  });d.kick?.();return c.json({...result,publication:'next_worker_tick'},201);
 });
 app.post('/api/v1/admin/entity-matches/revoke',async c=>{
  admin(c.get('operatorRole'));const v=object(await c.req.json());exact(v,['listing_id','reason']);const id=uuid(String(v.listing_id)),reason=text(v.reason,500)!;if(reason.length<10)throw new InputError('review_reason_required');
  await transaction(d.pool,async db=>{
   const {rows:[previous]}=await db.query('DELETE FROM atlas_core.entity_matches WHERE listing_id=$1 RETURNING property_id',[id]);if(!previous)throw new HTTPException(404,{message:'match_not_found'});
   await db.query('UPDATE atlas_core.source_listings SET property_id=NULL WHERE id=$1',[id]);
   await db.query('INSERT INTO atlas_control.audit_events(actor_id,action,resource_id,details) VALUES($1,$2,$3,$4)',[c.get('principal').id,'entity.unmatch',id,JSON.stringify({previous_property_id:previous.property_id,reason})]);
   await db.query('INSERT INTO atlas_control.publication_requests(singleton) VALUES(true) ON CONFLICT(singleton) DO UPDATE SET requested_at=now()');
  });d.kick?.();return c.json({status:'unmatched',publication:'next_worker_tick'});
 });
 app.get('/api/v1/admin/quality-issues',async c=>{
  const {limit,offset}=pagination(c.req.query());return c.json({results:(await d.pool.query('SELECT id,job_id,item_key,codes,review_state,reviewed_at FROM atlas_control.quality_issues ORDER BY created_at DESC LIMIT $1 OFFSET $2',[limit,offset])).rows,limit,offset});
 });
 app.patch('/api/v1/admin/quality-issues/:id',async c=>{
  const id=uuid(c.req.param('id')),v=object(await c.req.json());exact(v,['note']);const note=text(v.note,500)!;if(note.length<10)throw new InputError('review_note_required');
  await transaction(d.pool,async db=>{
   const r=await db.query("UPDATE atlas_control.quality_issues SET review_state='acknowledged',reviewed_at=now(),reviewed_by=$2,review_note=$3 WHERE id=$1",[id,c.get('principal').id,note]);if(!r.rowCount)throw new HTTPException(404,{message:'not_found'});
   await db.query('INSERT INTO atlas_control.audit_events(actor_id,action,resource_id) VALUES($1,$2,$3)',[c.get('principal').id,'quality.acknowledge',id]);
  });return c.json({status:'acknowledged',notice:'Acknowledgment does not make the underlying record valid. Submit a corrected batch to ingest data.'});
 });
 app.get('/api/v1/admin/audit',async c=>{
  admin(c.get('operatorRole'));const {limit,offset}=pagination(c.req.query());return c.json({results:(await d.pool.query('SELECT id,actor_id,action,resource_id,details,created_at FROM atlas_control.audit_events ORDER BY created_at DESC LIMIT $1 OFFSET $2',[limit,offset])).rows,limit,offset});
 });
 return app;
}
