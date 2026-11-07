import test,{before,after} from 'node:test';import assert from 'node:assert/strict';import {randomUUID} from 'node:crypto';import {Pool} from 'pg';
import {createApp} from '../functions/backend/app.js';import {transaction} from '../functions/backend/db.js';import{enqueue,runOne,claim,scheduleDue}from'../functions/backend/ingestion.js';import{CrawlHttpError}from'../functions/backend/crawl-http.js';
import {hash} from '../functions/backend/validation.js';
if(process.env.NEON_BRANCH!=='codex-backend-validation')throw Error('Collection tests require the isolated validation database');
const owner=new Pool({connectionString:process.env.DATABASE_URL_UNPOOLED}),api=new Pool({connectionString:process.env.ATLAS_API_DATABASE_URL}),worker=new Pool({connectionString:process.env.ATLAS_WORKER_DATABASE_URL});
const storage={async put(){},async get(){return new Uint8Array();},async remove(){},async exists(){return true;},async url(){return 'https://example.test';}};
const app=createApp({pool:api,storage,origins:[],rateSecret:randomUUID().repeat(2),verify:async()=>{throw Error('invalid');},seal:async()=>({})});
const req=(path:string)=>app.request('https://atlas.example/api/v1'+path);
let source:any,county:string;
async function makeSource(driver:string){return(await owner.query(`INSERT INTO atlas_control.sources(slug,name,driver,data_kind,status,license,permission_url,attribution,approved_at,approved_by,publication_allowed,next_run_at)
 VALUES($1,'Controlled public collection test',$2,$3,'active','Test','https://example.test/permission','Synthetic fixture',now(),'test-owner',true,now()+interval '1 day') RETURNING *`,['collection-'+randomUUID(),driver,driver==='manual_listings'?'listings':'context'])).rows[0];}
before(async()=>{await owner.query("UPDATE atlas_control.sources SET next_run_at=now()+interval '1 day' WHERE driver<>'manual_listings'");source=await makeSource('manual_listings');county=(await owner.query("INSERT INTO atlas_core.locations(source_id,source_key,name,kind) VALUES($1,'collection-county','Collection County','county') RETURNING id",[source.id])).rows[0].id;});
after(async()=>{await owner.end();await api.end();await worker.end();});
test('public listings require distinct publication/display permission and expose only the approved projection',async()=>{
 const record={source_listing_id:'fixture-ad',source_url:'https://example.test/properties/fixture',observed_at:new Date().toISOString(),listing_type:'rent',property_type:'apartment',county_id:county,bedrooms:1,price_amount:10000,currency:'KES',rent_period:'month',availability:'active',status_evidence:'advertisement'};
 await transaction(api,db=>enqueue(db,source,randomUUID(),{records:[record]},'test-owner'));assert.equal((await runOne(worker,storage))?.accepted,1);
 assert.equal((await(await req('/listings?county_id='+county)).json()).results.length,0);
 await owner.query('UPDATE atlas_control.sources SET listing_details_allowed=true WHERE id=$1',[source.id]);const displayed=await(await req('/listings?county_id='+county)).json();assert.equal(displayed.results.length,1);assert.equal(displayed.results[0].price_amount,'10000.00');assert.ok(!Object.hasOwn(displayed.results[0],'source_listing_id'));assert.ok(!Object.hasOwn(displayed.results[0],'owner_id'));
 assert.equal((await req('/listings?source_id='+source.id)).status,400);
 await owner.query("UPDATE atlas_control.sources SET status='revoked' WHERE id=$1",[source.id]);assert.equal((await(await req('/listings?county_id='+county)).json()).results.length,0);
});
test('publisher benchmarks are independently deduplicated, immutable and never counted as individual listings',async()=>{
 const s=await makeSource('kpc_market'),job=await transaction(api,db=>enqueue(db,s,randomUUID(),null,'test-owner'));
 await owner.query("UPDATE atlas_control.jobs SET status='succeeded',finished_at=now() WHERE id=$1",[job.id]);const artifact=(await owner.query('INSERT INTO atlas_control.artifacts(source_id,sha256,object_key,byte_length) VALUES($1,$2,$3,1) RETURNING id',[s.id,'a'.repeat(64),'fixture/'+s.id])).rows[0].id;
 const sql=`INSERT INTO atlas_core.market_benchmarks(source_id,job_id,artifact_id,series_key,geography,market_type,period_start,period_end,median_price,sample_count,currency,methodology,source_url,content_hash) VALUES($1,$2,$3,'rent:Kenya','Kenya','rent','2026-10-01','2026-10-31',10000,30,'KES','Synthetic methodology','https://kenyapropertycentre.com/market-trends/average-prices/for-rent',$4) ON CONFLICT DO NOTHING`;
 assert.equal((await worker.query(sql,[s.id,job.id,artifact,'b'.repeat(64)])).rowCount,1);assert.equal((await worker.query(sql,[s.id,job.id,artifact,'b'.repeat(64)])).rowCount,0);
 await assert.rejects(owner.query('UPDATE atlas_core.market_benchmarks SET median_price=1 WHERE source_id=$1',[s.id]),/append-only/);
 const response=await(await req('/research/benchmarks?market_type=rent')).json();assert.ok(response.results.some((r:any)=>r.methodology==='Synthetic methodology'));assert.equal((await(await req('/listings?county_id='+county)).json()).results.length,0);
 await owner.query('UPDATE atlas_control.sources SET publication_allowed=false WHERE id=$1',[s.id]);assert.ok(!(await(await req('/research/benchmarks?market_type=rent')).json()).results.some((r:any)=>r.methodology==='Synthetic methodology'));
 const review=await(await req('/collection/sources')).json();assert.equal(review.reviews.find((r:any)=>r.slug==='jiji').decision,'requires_permission');
 await assert.rejects(api.query('SELECT * FROM atlas_control.crawl_configs'),{code:'42501'});await assert.rejects(api.query('SELECT * FROM atlas_core.canonical_listing_urls'),{code:'42501'});
});
test('upstream Retry-After pauses the whole source, including newly scheduled jobs',async()=>{
 const s=await makeSource('worldbank_wdi'),job=await transaction(api,db=>enqueue(db,s,randomUUID(),null,'test-owner'));
 const result=await runOne(worker,storage,async()=>{throw new CrawlHttpError('upstream_http_429',7200);});assert.equal(result?.code,'upstream_http_429');
 const state=(await owner.query('SELECT not_before_at>now()+interval \'119 minutes\' paused FROM atlas_control.sources WHERE id=$1',[s.id])).rows[0];assert.equal(state.paused,true);
 await owner.query('UPDATE atlas_control.sources SET next_run_at=now() WHERE id=$1',[s.id]);await scheduleDue(worker);assert.equal((await owner.query('SELECT count(*)::int n FROM atlas_control.jobs WHERE source_id=$1',[s.id])).rows[0].n,1);
 assert.equal(await claim(worker),null);assert.equal((await owner.query('SELECT status FROM atlas_control.jobs WHERE id=$1',[job.id])).rows[0].status,'retry');
});
test('source-scoped collector authenticates before queries and cannot inspect unrelated jobs',async()=>{
 const token=randomUUID().repeat(2),collector=createApp({pool:api,storage,origins:[],rateSecret:randomUUID().repeat(2),collectorToken:token,verify:async()=>{throw Error('invalid');},seal:async()=>({})});
 const call=(path:string,body?:unknown,authorized=true)=>collector.request('https://atlas.example/api/v1/collector/kpc'+path,{method:body===undefined?'GET':'POST',headers:{'Content-Type':'application/json',...(authorized?{Authorization:'Bearer '+token}:{})},body:body===undefined?undefined:JSON.stringify(body)});
 assert.equal((await call('',{},false)).status,401);assert.equal((await call('/jobs/'+randomUUID(),undefined,false)).status,401);
 await owner.query("UPDATE atlas_control.sources SET slug='retired-test-'||id::text WHERE slug='kpc-market-statistics' AND name='Controlled public collection test'");
 const s=await makeSource('kpc_market');await owner.query("UPDATE atlas_control.sources SET slug='kpc-market-statistics',collection_transport='source_push' WHERE id=$1",[s.id]);
 await assert.rejects(transaction(api,db=>enqueue(db,{...s,collection_transport:'source_push'},randomUUID(),null,'test-owner')),/source_external_collector_managed/);
 const records=['rent','sale','short_let'].map(type=>{const row={series_key:type+':Kenya',geography:'Kenya',market_type:type,period_start:'2026-10-01',period_end:'2026-10-31',median_price:10000,sample_count:null,currency:'KES',methodology:'Synthetic test methodology',source_url:'https://kenyapropertycentre.com/market-trends/average-prices/'+(type==='short_let'?'for-rent/short-let':type==='rent'?'for-rent':'for-sale')};return {...row,digest:hash(row)};});
 const evidence={parser:'kpc-market/1',document_sha256:'a'.repeat(64),robots_sha256:'b'.repeat(64),terms_sha256:'c'.repeat(64),scope:'Published CC BY 4.0 market statistics only; no listing or customer data.'};
 assert.equal((await call('',{records,evidence,contacts:[]})).status,400);
 const accepted=await call('',{records,evidence});assert.equal(accepted.status,202);const job=await accepted.json();assert.equal((await(await call('',{records,evidence})).json()).id,job.id);
 const unrelated=(await owner.query('SELECT id FROM atlas_control.jobs WHERE source_id<>$1 LIMIT 1',[s.id])).rows[0];assert.equal((await call('/jobs/'+unrelated.id)).status,404);
 assert.equal((await runOne(worker,storage))?.accepted,3);assert.equal((await(await call('/jobs/'+job.id)).json()).status,'succeeded');
 await owner.query("UPDATE atlas_control.sources SET status='revoked' WHERE id=$1",[s.id]);assert.equal((await call('',{records,evidence})).status,409);
});
