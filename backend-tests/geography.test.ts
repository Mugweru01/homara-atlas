import test,{before,after} from 'node:test';
import assert from 'node:assert/strict';
import {createHmac,randomUUID} from 'node:crypto';
import {Pool} from 'pg';
import {loadReference,buildReference} from '../scripts/lib/location-dataset.mjs';
import {importLocations} from '../scripts/lib/import-locations.mjs';
import {createApp} from '../functions/backend/app.js';
if(process.env.NEON_BRANCH!=='codex-backend-validation')throw new Error('Geography tests require the isolated validation database');
const owner=new Pool({connectionString:process.env.DATABASE_URL_UNPOOLED}),api=new Pool({connectionString:process.env.ATLAS_API_DATABASE_URL});
const secret=randomUUID().repeat(2);
const app=createApp({pool:api,rateSecret:secret,origins:['https://atlas.example'],verify:async()=>{throw Error('invalid');},seal:async()=>({}),storage:{} as never});
const req=(path:string,init?:RequestInit)=>app.request('https://atlas.example/api/v1/geography'+path,init);
let sourceId:string,releaseId:string,nairobiId:string;
before(async()=>{
 const data=await loadReference();sourceId=(await owner.query("SELECT id FROM atlas_control.sources WHERE driver='geoboundaries_ken'")).rows[0].id;
 for(const c of data.raw.counties)await owner.query("INSERT INTO atlas_core.locations(source_id,source_key,name,kind) VALUES($1,$2,$3,'county') ON CONFLICT(source_id,source_key) DO NOTHING",[sourceId,'reference-test-'+c.code,c.name]);
 const artifact=(await owner.query("INSERT INTO atlas_control.artifacts(source_id,sha256,object_key,byte_length) VALUES($1,$2,'test/reference-boundaries',1) ON CONFLICT(source_id,sha256) DO UPDATE SET sha256=EXCLUDED.sha256 RETURNING id",[sourceId,'f'.repeat(64)])).rows[0].id;
 await owner.query("INSERT INTO atlas_core.location_versions(location_id,artifact_id,revision_key,reference_year,observed_at) SELECT id,$1,'reference-test-2020',2020,now() FROM atlas_core.locations WHERE source_id=$2 ON CONFLICT DO NOTHING",[artifact,sourceId]);
 const db=await owner.connect();try{releaseId=(await importLocations(db)).release_id;}finally{db.release();}
 nairobiId=(await owner.query("SELECT id FROM atlas_core.locations WHERE source_id=$1 AND name='Nairobi'",[sourceId])).rows[0].id;
});
after(async()=>{await owner.end();await api.end();});
test('pinned reference validation rejects incomplete data, duplicate IDs and broken parents',async()=>{
 const d=await loadReference();assert.equal(d.rows.length,4835);assert.equal(d.relations.length,9517);
 const missing=structuredClone(d.raw);missing.wards.pop();assert.throws(()=>buildReference(missing),/incomplete_location_dataset/);
 const duplicate=structuredClone(d.raw);duplicate.counties[1].code=duplicate.counties[0].code;assert.throws(()=>buildReference(duplicate),/duplicate_location_identity/);
 const mismatch=structuredClone(d.raw);mismatch.wards[0].county_code='001';assert.throws(()=>buildReference(mismatch),/cross_county_relationship/);
 const privateField=structuredClone(d.raw);privateField.areas[0].owner_id='forbidden';assert.throws(()=>buildReference(privateField),/unexpected_location_fields/);
});
test('import is atomic and idempotent; the API only has published-view privileges',async()=>{
 const db=await owner.connect();try{assert.equal((await importLocations(db)).status,'already_imported');}finally{db.release();}
 assert.equal((await owner.query('SELECT count(*)::int n FROM atlas_geo.versions WHERE release_id=$1',[releaseId])).rows[0].n,4835);
 await assert.rejects(api.query('SELECT * FROM atlas_geo.versions'),{code:'42501'});
 await assert.rejects(api.query('UPDATE atlas_geo.current_release SET release_id=$1',[releaseId]),{code:'42501'});
 await assert.rejects(owner.query("UPDATE atlas_geo.versions SET name='changed' WHERE release_id=$1",[releaseId]),/append-only/);
});
test('location API preserves county IDs, returns attribution, paginates and distinguishes relationship evidence',async()=>{
 const counties=await (await req('/counties')).json();assert.equal(counties.results.length,47);assert.equal(counties.results.find((r:any)=>r.code==='047').id,nairobiId);assert.match(counties.dataset.attribution,/David Amunga/);assert.equal(counties.dataset.license,'CC-BY-4.0');
 const first=await (await req('/wards?county_code=047&limit=2')).json();const second=await (await req('/wards?county_code=047&limit=2&offset=2')).json();assert.equal(first.results.length,2);assert.equal(first.has_more,true);assert.ok(first.results.every((r:any)=>r.county_code==='047'));assert.ok(!second.results.some((r:any)=>first.results.some((x:any)=>x.id===r.id)));
 const detail=await (await req('/places/'+first.results[0].id)).json();assert.ok(detail.parents.some((p:any)=>p.kind==='constituency'));assert.ok(detail.parents.some((p:any)=>p.kind==='sub_county'));
 const alias=await (await req('/search?q=Nairobi%20City&kind=county')).json();assert.equal(alias.results[0].code,'047');
 const literal=await (await req('/search?q=%25_')).json();assert.equal(literal.results.length,0);
 const informal=await (await req('/areas?county_code=047&limit=1')).json();assert.equal(informal.results[0].provenance_class,'informal_unverified');
 assert.ok(!JSON.stringify(counties).includes('source_listing_id'));assert.ok(!JSON.stringify(detail).includes('price_amount'));
});
test('malformed, duplicated and oversized queries are rejected; geography is read-only',async()=>{
 for(const path of ['/wards?county_code=47','/wards?county_code=047&county_code=001','/wards?owner_id=anything','/places?kind=property','/wards?limit=101','/search?q=x','/search?q='+('a'.repeat(81)),'/places/not-an-id'])assert.equal((await req(path)).status,400,path);
 assert.equal((await req('/places/'+randomUUID())).status,404);
 const write=await req('/wards',{method:'POST',body:'{}',headers:{'Content-Type':'application/json'}});assert.equal(write.status,405);assert.match(write.headers.get('allow')||'',/GET/);
 const cors=await req('/dataset',{headers:{Origin:'https://attacker.example'}});assert.equal(cors.headers.get('access-control-allow-origin'),null);assert.equal(cors.headers.get('x-content-type-options'),'nosniff');assert.ok(cors.headers.get('x-request-id'));
});
test('source revocation fails closed and the geography budget cannot be bypassed with IP headers',async()=>{
 const s=(await owner.query("SELECT id FROM atlas_control.sources WHERE driver='kenya_locations'")).rows[0].id;
 try{await owner.query("UPDATE atlas_control.sources SET status='revoked' WHERE id=$1",[s]);assert.equal((await req('/wards?county_code=047')).status,503);}finally{await owner.query("UPDATE atlas_control.sources SET status='active' WHERE id=$1",[s]);}
 const key=createHmac('sha256',secret).update('geography-global').digest('hex');
 await owner.query("INSERT INTO atlas_security.rate_windows(key_hash,window_start,hits) VALUES($1,date_trunc('minute',clock_timestamp()),180) ON CONFLICT(key_hash,window_start) DO UPDATE SET hits=180",[key]);
 const response=await req('/dataset',{headers:{'X-Forwarded-For':'1.2.3.4'}});assert.equal(response.status,429);assert.equal(response.headers.get('retry-after'),'60');
});
