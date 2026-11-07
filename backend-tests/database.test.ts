import test,{before,after} from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { Pool } from 'pg';
import { createApp } from '../functions/backend/app.js';
import { transaction } from '../functions/backend/db.js';
import { enqueue,claim,processJob,runOne,scheduleDue,type Source } from '../functions/backend/ingestion.js';
import { publish } from '../functions/backend/publication.js';
import type { Storage } from '../functions/backend/storage.js';
import { createWorker } from '../functions/backend/worker-app.js';
import { rateLimit } from '../functions/backend/security.js';
import {CrawlHttpError} from '../functions/backend/crawl-http.js';

if(process.env.NEON_BRANCH!=='codex-backend-validation')throw new Error('Database tests require the isolated codex-backend-validation branch');
const makePool=(url:string|undefined)=>new Pool({connectionString:url?.replace('sslmode=require','sslmode=verify-full'),max:3});
const owner=makePool(process.env.DATABASE_URL),api=makePool(process.env.ATLAS_API_DATABASE_URL),worker=makePool(process.env.ATLAS_WORKER_DATABASE_URL);
const objects=new Map<string,Uint8Array>();
const storage:Storage={async put(b,k,v){objects.set(b+'/'+k,v);},async get(b,k){const v=objects.get(b+'/'+k);if(!v)throw new Error('missing');return v;},async remove(b,k){objects.delete(b+'/'+k);},async exists(b,k){return objects.has(b+'/'+k);},async url(b,k){return 'https://download.example/'+b+'/'+k;}};
let county:string,source:Source;
const actor='test-admin-'+randomUUID(),other='test-user-'+randomUUID(),salt=randomUUID().replaceAll('-','');
const app=createApp({pool:api,storage,rateSecret:'r'.repeat(64),origins:['https://atlas.example'],verify:async token=>{if(token==='admin')return {id:actor};if(token==='other')return {id:other};throw new Error('invalid');},seal:async user=>({sealed_for:user})});
const req=(path:string,token?:string,body?:unknown,method=body?'POST':'GET',key?:string)=>app.request('https://atlas.example'+path,{method,headers:{...(token?{Authorization:'Bearer '+token}:{}),...(body?{'Content-Type':'application/json'}:{}),...(key?{'Idempotency-Key':key}:{})},body:body?JSON.stringify(body):undefined});
before(async()=>{
 await owner.query("UPDATE atlas_control.sources SET next_run_at=now()+interval '1 day' WHERE driver<>'manual_listings'");
 const {rows:[s]}=await owner.query(`INSERT INTO atlas_control.sources(slug,name,driver,data_kind,status,license,permission_url,attribution,approved_at,approved_by,publication_allowed)
 VALUES($1,'Controlled test feed','manual_listings','listings','active','Test only','https://partner.example/terms','Test fixture',now(),'test-owner',true) RETURNING *`,['test-'+salt]);source=s;
 const {rows:[l]}=await owner.query("INSERT INTO atlas_core.locations(source_id,source_key,name,kind) VALUES($1,'county','Test County','county') RETURNING id",[source.id]);county=l.id;
 await owner.query("INSERT INTO atlas_security.operator_roles(user_id,role) VALUES($1,'admin')",[actor]);
});
after(async()=>{await Promise.all([owner.end(),api.end(),worker.end()]);});
test('research views enforce ownership and operator extensions cannot be used anonymously',async()=>{
 assert.equal((await req('/api/v1/admin/me')).status,401);
 assert.equal((await req('/api/v1/admin/validate-listings','other',{records:[]})).status,403);
 assert.equal((await req('/api/v1/admin/me','admin')).status,200);
 const saved=await req('/api/v1/workspace/research/views','admin',{name:'Nairobi research',filters:{county_ids:[county],listing_type:'rent'}});assert.equal(saved.status,201);const view=await saved.json();
 assert.equal((await req('/api/v1/workspace/research/views','other')).status,200);
 assert.equal((await (await req('/api/v1/workspace/research/views','other')).json()).results.length,0);
 assert.equal((await req('/api/v1/workspace/research/views/'+view.id,'other',undefined,'DELETE')).status,404);
 assert.equal((await transaction(api,db=>db.query('select id from public.atlas_saved_views where id=$1',[view.id]),other)).rowCount,0);
 assert.equal((await req('/api/v1/workspace/research/views/'+view.id,'admin',undefined,'DELETE')).status,204);
 assert.equal((await req('/api/v1/research/compare',undefined,{county_ids:[county],listing_type:'airbnb'})).status,400);
});
const record=(id:string,price=50000,when=new Date().toISOString())=>({source_listing_id:id,source_url:'https://partner.example/listing/'+id,observed_at:when,listing_type:'rent',property_type:'apartment',county_id:county,bedrooms:2,price_amount:price,currency:'KES',rent_period:'month',availability:'active',status_evidence:'advertisement'});
test('Homara connector writes source-scoped observations and bathrooms; an empty export is a successful snapshot',async()=>{
 const {rows:[s]}=await owner.query(`INSERT INTO atlas_control.sources(slug,name,driver,data_kind,status,license,permission_url,attribution,approved_at,approved_by,publication_allowed,next_run_at)
 VALUES($1,'Homara test','homara_public','listings','active','Test','https://homara.co.ke/p/terms','Test',now(),'owner',false,now()+interval '1 day') RETURNING *`,['homara-'+salt]);
 const previous=process.env.ATLAS_HOMARA_PUBLIC_KEY;process.env.ATLAS_HOMARA_PUBLIC_KEY='public-test';process.env.ATLAS_HOMARA_FEED_TOKEN='a'.repeat(64);
 try{
  const payload={schema_version:1,records:[{id:randomUUID(),county:'Test County',property_type:'Apartment',listing_type:'rent',bedrooms:2,bathrooms:1,price_amount:20000,updated_at:new Date().toISOString()}],has_more:false};
  await transaction(api,db=>enqueue(db,s,randomUUID(),null,actor));const job=await claim(worker);assert.ok(job);assert.equal(job.source_id,s.id);
  const result=await processJob(worker,storage,job,async()=>new Response(JSON.stringify(payload)));assert.equal(result.accepted,1);
  const {rows:[observation]}=await owner.query('SELECT o.bathrooms,o.price_amount,o.neighbourhood FROM atlas_core.listing_observations o JOIN atlas_core.source_listings l ON l.id=o.listing_id WHERE l.source_id=$1',[s.id]);assert.equal(observation.bathrooms,1);assert.equal(observation.neighbourhood,null);
  assert.equal((await api.query('SELECT o.id FROM atlas_core.listing_observations o JOIN atlas_core.source_listings l ON l.id=o.listing_id WHERE l.source_id=$1',[s.id])).rowCount,0);
  await assert.rejects(owner.query('UPDATE atlas_control.sources SET publication_allowed=true WHERE id=$1',[s.id]),{code:'23514'});
  const publicHealth=JSON.stringify(await (await req('/api/v1/system/data-health')).json());assert.ok(!publicHealth.includes(s.slug));
  assert.equal((await api.query('SELECT id FROM atlas_control.artifacts WHERE source_id=$1',[s.id])).rowCount,0);
  assert.equal((await(await req('/api/v1/listings?county_id='+county)).json()).results.length,0);
  assert.ok(!JSON.stringify(await(await req('/api/v1/collection/sources')).json()).includes(s.slug));
  await transaction(api,db=>enqueue(db,s,randomUUID(),null,actor));const empty=await claim(worker);assert.ok(empty);
  const emptyResult=await processJob(worker,storage,empty,async()=>new Response(JSON.stringify({...payload,records:[]})));assert.equal(emptyResult.status,'succeeded');assert.equal(emptyResult.received,0);
  await assert.rejects(transaction(api,db=>enqueue(db,s,randomUUID(),{records:[]},actor)),/connector_payload_not_allowed/);
 }finally{if(previous===undefined)delete process.env.ATLAS_HOMARA_PUBLIC_KEY;else process.env.ATLAS_HOMARA_PUBLIC_KEY=previous;}
});
async function queue(payload:unknown,key=randomUUID()) {return transaction(api,db=>enqueue(db,source,key,payload,actor));}
test('canonical URL reuse with a changed advert ID is quarantined instead of duplicating a listing',async()=>{
 const first=record('canonical-'+salt),url=first.source_url;
 await queue({records:[first]});assert.equal((await runOne(worker,storage))?.accepted,1);
 await queue({records:[{...record('relisted-'+salt),source_url:url}]});const conflict=await runOne(worker,storage);assert.equal(conflict?.status,'blocked');assert.equal(conflict?.rejected,1);
 assert.equal((await owner.query('SELECT count(*)::int n FROM atlas_core.source_listings WHERE source_id=$1 AND source_listing_id=$2',[source.id,'relisted-'+salt])).rows[0].n,0);
 await assert.rejects(worker.query('UPDATE atlas_core.source_listings SET source_listing_id=$2 WHERE source_id=$1',[source.id,'changed']),{code:'42501'});
});
test('database roles cannot mutate evidence, grant privileges or bypass report ownership',async()=>{
 await assert.rejects(api.query("UPDATE atlas_core.listing_observations SET availability='sold'"),{code:'42501'});
 await assert.rejects(worker.query("DELETE FROM atlas_core.listing_observations"),{code:'42501'});
 await assert.rejects(api.query("INSERT INTO atlas_security.operator_roles(user_id,role) VALUES('attacker','admin')"),{code:'42501'});
 await assert.rejects(api.query('SELECT * FROM public.atlas_report_live'),{code:'42501'});
 await assert.rejects(worker.query('SELECT * FROM public.atlas_report_live'),{code:'42501'});
 await assert.rejects(worker.query("UPDATE atlas_control.sources SET status='active' WHERE id=$1",[source.id]),{code:'42501'});
 await assert.rejects(worker.query("INSERT INTO atlas_control.sources(slug,name,driver,data_kind,license,permission_url,attribution) VALUES('forbidden','Forbidden','manual_listings','listings','Test','https://example.test/terms','Test')"),{code:'42501'});
 const id=randomUUID();
 await transaction(api,db=>db.query("INSERT INTO public.atlas_reports(id,owner_id,title,object_key) VALUES($1,$2,'Owned',$3)",[id,actor,id]),actor);
 const rows=await transaction(api,db=>db.query('SELECT id FROM public.atlas_reports WHERE id=$1',[id]),other);assert.equal(rows.rowCount,0);
 await assert.rejects(transaction(api,db=>db.query("INSERT INTO public.atlas_reports(id,owner_id,title,object_key) VALUES($1,$2,'Wrong',$3)",[randomUUID(),actor,randomUUID()]),other),{code:'42501'});
});
test('job idempotency survives payload scrubbing; append-only history and quarantine survive retries',async()=>{
 const id='same-id-'+salt,payload={records:[record(id),{...record('bad-'+salt),price_amount:-1}]},key=randomUUID();
 const queued=await queue(payload,key),duplicate=await queue(payload,key);assert.equal(queued.id,duplicate.id);
 const result=await runOne(worker,storage);assert.equal(result?.status,'succeeded');
 const details=(await owner.query('SELECT * FROM atlas_control.jobs WHERE id=$1',[queued.id])).rows[0];assert.equal(details.accepted_count,1);assert.equal(details.rejected_count,1);assert.equal(details.payload,null);
 assert.equal((await queue(payload,key)).id,queued.id);
 await assert.rejects(queue({records:[record(id,40000)]},key),/conflict/);
 await queue({records:[record(id,45000,new Date(Date.now()+1000).toISOString())]});await runOne(worker,storage);
 const {rows:[count]}=await owner.query('SELECT count(*)::int n FROM atlas_core.listing_observations o JOIN atlas_core.source_listings l ON l.id=o.listing_id WHERE l.source_id=$1 AND l.source_listing_id=$2',[source.id,id]);assert.equal(count.n,2);
 await assert.rejects(owner.query('UPDATE atlas_core.listing_observations SET price_amount=1 WHERE listing_id IN(SELECT id FROM atlas_core.source_listings WHERE source_id=$1)',[source.id]),/append-only/);
});
test('concurrent claims cannot run two jobs for one source; expired leases are fenced and recovered',async()=>{
 await queue({records:[record('lease-'+salt)]});await queue({records:[record('lease2-'+salt)]});
 const [a,b]=await Promise.all([claim(worker),claim(worker)]);assert.ok(a||b);assert.ok(!a||!b);const job=(a||b)!;
 await owner.query("UPDATE atlas_control.jobs SET lease_expires_at=now()-interval '1 second' WHERE id=$1",[job.id]);
 const recovered=await claim(worker);assert.ok(recovered);assert.notEqual(recovered.lease_token,job.lease_token);
 await assert.rejects(processJob(worker,storage,job),/lease_lost/);
 await processJob(worker,storage,recovered);await runOne(worker,storage);
});
test('source-scoped IDs do not collide, unapproved feeds are blocked and sparse metrics stay unpublished',async()=>{
 const {rows:[second]}=await owner.query(`INSERT INTO atlas_control.sources(slug,name,driver,data_kind,status,license,permission_url,attribution,approved_at,approved_by,publication_allowed)
 VALUES($1,'Second feed','manual_listings','listings','active','Test','https://partner.example/terms','Test',now(),'owner',true) RETURNING *`,['second-'+salt]);
 await transaction(api,db=>enqueue(db,second,randomUUID(),{records:[record('same-id-'+salt)]},actor));await runOne(worker,storage);
 assert.equal((await owner.query('SELECT count(*)::int n FROM atlas_core.source_listings WHERE source_listing_id=$1',['same-id-'+salt])).rows[0].n,2);
 await publish(worker);const snapshots=(await owner.query('SELECT * FROM atlas_mart.market_snapshots WHERE county_id=$1 AND release_id=(SELECT release_id FROM atlas_mart.current_release)',[county])).rows;
 assert.ok(snapshots.length>0);
 assert.ok(snapshots.every(r=>r.sparse&&r.median_price===null));
 await owner.query("UPDATE atlas_control.sources SET status='revoked' WHERE id=$1",[second.id]);
 assert.equal((await owner.query('SELECT * FROM atlas_mart.valid_release')).rowCount,0);
 await assert.rejects(transaction(api,async db=>{const s=(await db.query('SELECT * FROM atlas_control.sources WHERE id=$1',[second.id])).rows[0];return enqueue(db,s,randomUUID(),{records:[record('no')]},actor);}),/source_not_approved/);
});
test('HTTP authorization, input limits and private ownership fail closed',async()=>{
 assert.equal((await req('/api/v1/admin/jobs')).status,401);assert.equal((await req('/api/v1/admin/jobs','other')).status,403);
 assert.equal((await req('/api/v1/workspace/reports','bad')).status,401);
 assert.equal((await req('/api/v1/admin/jobs?limit=100000','admin')).status,400);
 assert.equal((await req('/api/v1/workspace/reports','admin',{title:'Test',content:'safe',owner_id:other})).status,400);
 const saved=await req('/api/v1/workspace/reports','admin',{title:'Test report',content:'safe report'});assert.equal(saved.status,201);const report=await saved.json();
 assert.equal((await owner.query('SELECT owner_id FROM public.atlas_report_live WHERE id=$1',[report.id])).rows[0].owner_id,actor);
 assert.equal((await req('/api/v1/workspace/reports/'+report.id,'other')).status,404);
 assert.equal((await req('/api/v1/workspace/reports/'+report.id,'admin')).status,200);
 assert.equal((await req('/api/v1/workspace/reports/'+report.id,'admin',undefined,'DELETE')).status,204);
 assert.equal((await owner.query('SELECT id FROM public.atlas_report_live WHERE id=$1',[report.id])).rowCount,0);
 assert.equal((await req('/api/v1/workspace/reports','admin',{title:'Too large',content:'x'.repeat(1100000)})).status,413);
 const evil=await app.request('https://atlas.example/api/v1/system/health',{headers:{Origin:'https://attacker.example'}});assert.equal(evil.headers.get('access-control-allow-origin'),null);assert.equal(evil.headers.get('x-content-type-options'),'nosniff');
});
test('worker execution needs an internal secret; arbitrary schedule requests are rejected',async()=>{
 const workerApp=createWorker({pool:worker,storage,internalToken:'w'.repeat(64)});
 assert.equal((await workerApp.request('http://worker/run',{method:'POST'})).status,401);
 assert.equal((await workerApp.request('http://worker/cron',{method:'POST',headers:{'Content-Type':'application/json'},body:'{}'})).status,401);
});
test('the actual worker role can schedule and perform bounded housekeeping',async()=>{
 assert.equal(await scheduleDue(worker),0);
 await worker.query('SELECT atlas_control.expire_pending_reports()');
 const workerApp=createWorker({pool:worker,storage,internalToken:'w'.repeat(64)});
 const response=await workerApp.request('http://worker/run',{method:'POST',headers:{Authorization:'Bearer '+'w'.repeat(64)}});
 assert.equal(response.status,200,await response.clone().text());
});
test('golden-data publication separates sale and monthly rent, suppresses sparse cells and removes reviewed duplicates',async()=>{
 const {rows:[place]}=await owner.query("INSERT INTO atlas_core.locations(source_id,source_key,name,kind) VALUES($1,$2,'Golden County','county') RETURNING id",[source.id,'golden-'+salt]);
 const {rows:[job]}=await owner.query("INSERT INTO atlas_control.jobs(source_id,idempotency_key,status,requested_by) VALUES($1,$2,'succeeded','test') RETURNING id",[source.id,'golden-'+salt]);
 const {rows:[artifact]}=await owner.query("INSERT INTO atlas_control.artifacts(source_id,sha256,object_key,byte_length) VALUES($1,$2,$3,10) RETURNING id",[source.id,'a'.repeat(64),'golden-'+salt]);
 const data=Array.from({length:30},(_,i)=>({external:'golden-'+salt+'-'+i,type:'rent',price:(i+1)*1000,period:'month'}));
 data.push({external:'golden-sale-'+salt,type:'sale',price:5000000,period:null as unknown as string});
 data.push({external:'golden-week-'+salt,type:'rent',price:5,period:'week'});
 await owner.query(`INSERT INTO atlas_core.source_listings(source_id,source_listing_id,first_seen_at,last_seen_at)
 SELECT $1,r.external,now(),now() FROM jsonb_to_recordset($2::jsonb) r(external text)`,[source.id,JSON.stringify(data)]);
 await owner.query(`INSERT INTO atlas_core.listing_observations(listing_id,job_id,artifact_id,content_hash,observed_at,source_url,listing_type,property_type,county_id,bedrooms,price_amount,currency,rent_period,availability,status_evidence)
 SELECT l.id,$2,$3,repeat('b',64),now(),'https://partner.example/listing',r.type,'apartment',$4,2,r.price,'KES',r.period,'active','advertisement'
 FROM jsonb_to_recordset($5::jsonb) r(external text,type text,price numeric,period text)
 JOIN atlas_core.source_listings l ON l.source_listing_id=r.external AND l.source_id=$1`,[source.id,job.id,artifact.id,place.id,JSON.stringify(data)]);
 await publish(worker);
 let cells=(await owner.query('SELECT * FROM atlas_mart.market_snapshots WHERE county_id=$1 AND release_id=(SELECT release_id FROM atlas_mart.current_release)',[place.id])).rows;
 const rent=cells.find(r=>r.listing_type==='rent'),sale=cells.find(r=>r.listing_type==='sale');
 assert.equal(rent.listing_count,30);assert.equal(Number(rent.median_price),15500);assert.equal(rent.sparse,false);assert.equal(sale.median_price,null);
 // Link two advertisements to one reviewed physical unit; effective sample drops below the gate.
 const property=(await owner.query('INSERT INTO atlas_core.properties DEFAULT VALUES RETURNING id')).rows[0];
 await owner.query('UPDATE atlas_core.source_listings SET property_id=$1 WHERE source_id=$2 AND source_listing_id=ANY($3::text[])',[property.id,source.id,[data[0].external,data[1].external]]);
 await publish(worker);
 cells=(await owner.query("SELECT * FROM atlas_mart.market_snapshots WHERE county_id=$1 AND listing_type='rent' AND release_id=(SELECT release_id FROM atlas_mart.current_release)",[place.id])).rows;
 assert.equal(cells[0].listing_count,29);assert.equal(cells[0].median_price,null);
});
test('operator review routes preserve role boundaries, reject malformed JSON and audit source approval',async()=>{
 await owner.query("INSERT INTO atlas_security.operator_roles(user_id,role) VALUES($1,'operator')",[other]);
 const body={slug:'pending-'+salt,name:'Pending test',license:'Test only',permission_url:'https://partner.example/terms',attribution:'Test'};
 assert.equal((await req('/api/v1/admin/sources','other',body)).status,403);
 const response=await req('/api/v1/admin/sources','admin',body);assert.equal(response.status,201);const pending=await response.json();
 assert.equal(pending.status,'pending');
 assert.equal((await req(`/api/v1/admin/sources/${pending.id}/jobs`,'admin',{records:[record('pending')]},'POST',randomUUID())).status,400);
 assert.equal((await req(`/api/v1/admin/sources/${pending.id}`,'admin',{status:'active',publication_allowed:false},'PATCH')).status,200);
 const malformed=await app.request(`https://atlas.example/api/v1/admin/sources/${pending.id}/jobs`,{method:'POST',headers:{Authorization:'Bearer admin','Idempotency-Key':randomUUID(),'Content-Type':'application/json'},body:'{'});
 assert.equal(malformed.status,400);
 assert.equal((await req('/api/v1/admin/audit','other')).status,403);assert.equal((await req('/api/v1/admin/audit','admin')).status,200);
});
test('rate budgets fail closed and failed report uploads retain durable cleanup intent',async()=>{
 const bucket='test-'+randomUUID();await rateLimit(api,'r'.repeat(64),bucket,1);await assert.rejects(rateLimit(api,'r'.repeat(64),bucket,1),error=>(error as {status:number}).status===429);
 const broken=createApp({pool:api,storage:{...storage,async put(){throw new Error('simulated_storage_outage');}},rateSecret:'r'.repeat(64),origins:[],verify:async()=>({id:actor}),seal:async()=>({})});
 const response=await broken.request('https://atlas.example/api/v1/workspace/reports',{method:'POST',headers:{Authorization:'Bearer admin','Content-Type':'application/json'},body:JSON.stringify({title:'Failed upload',content:'test'})});
 assert.equal(response.status,503);
 const remaining=await owner.query("SELECT id FROM public.atlas_reports WHERE owner_id=$1 AND title='Failed upload'",[actor]);assert.equal(remaining.rowCount,0);
 assert.ok((await owner.query("SELECT id FROM atlas_control.object_deletions WHERE object_key LIKE $1",['reports/'+actor+'/%'])).rowCount!>0);
});
