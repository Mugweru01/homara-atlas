import type { Hono } from 'hono';
import { HTTPException } from 'hono/http-exception';
import type { Dependencies, Variables } from './app.js';
import { transaction } from './db.js';
import { object,exact,text,uuid,oneOf,InputError,pagination } from './validation.js';
import { inventorySql } from './publication.js';
import { listing } from './validation.js';
import { validateManualEnvelope } from './ingestion.js';

export function researchFilters(raw:unknown) {
 const v=object(raw);exact(v,['county_ids','listing_type','property_type','bedrooms']);
 if(!Array.isArray(v.county_ids)||v.county_ids.length>4)throw new InputError('choose_up_to_four_counties');
 const county_ids=[...new Set(v.county_ids.map(x=>uuid(String(x))))];
 const listing_type=oneOf(v.listing_type,['rent','sale']);
 const property_type=v.property_type==null?null:oneOf(v.property_type,['apartment','house','land','office','retail','warehouse']);
 const bedrooms=v.bedrooms==null?null:v.bedrooms;
 if(bedrooms!==null&&(typeof bedrooms!=='number'||!Number.isInteger(bedrooms)||bedrooms<0||bedrooms>30))throw new InputError('invalid_bedrooms');
 return {county_ids,listing_type,property_type,bedrooms};
}
export function registerResearch(app:Hono<{Variables:Variables}>,d:Dependencies) {
 app.get('/api/v1/research/coverage',async c=>{
  const {rows}=await d.pool.query(`SELECT l.id,l.name,coalesce(sum(m.listing_count),0)::int observations,
   count(DISTINCT m.listing_type)::int populations,count(*) FILTER(WHERE m.sparse=false)::int publishable_segments,
   max(r.created_at) release_at FROM atlas_core.locations l LEFT JOIN atlas_mart.valid_release r ON true
   LEFT JOIN atlas_mart.market_snapshots m ON m.county_id=l.id AND m.release_id=r.id
   JOIN atlas_control.sources s ON s.id=l.source_id AND s.status='active' AND s.publication_allowed
   AND(s.rights_expire_at IS NULL OR s.rights_expire_at>now()) WHERE l.kind='county' GROUP BY l.id,l.name ORDER BY l.name`);
  return c.json({results:rows,minimum_sample:30,notice:'A publication threshold is not a claim of statistical representativeness. Zero observations describes Atlas coverage, not the size of the housing market.'});
 });
 app.post('/api/v1/research/compare',async c=>{
  const f=researchFilters(await c.req.json());
  const {rows}=await d.pool.query(`SELECT l.id county_id,l.name county,m.listing_type,m.property_type,m.bedrooms,m.listing_count,m.source_count,m.median_price,m.p25,m.p75,m.sparse,r.created_at release_at
   FROM atlas_mart.market_snapshots m JOIN atlas_mart.valid_release r ON r.id=m.release_id JOIN atlas_core.locations l ON l.id=m.county_id
   JOIN atlas_control.sources s ON s.id=l.source_id AND s.status='active' AND s.publication_allowed AND(s.rights_expire_at IS NULL OR s.rights_expire_at>now())
   WHERE l.id=ANY($1::uuid[]) AND m.listing_type=$2 AND($3::text IS NULL OR m.property_type=$3) AND($4::int IS NULL OR m.bedrooms=$4)
   ORDER BY l.name,m.property_type,m.bedrooms LIMIT 200`,[f.county_ids,f.listing_type,f.property_type,f.bedrooms]);
  return c.json({results:rows,filters:f,methodology:'asking-market/1',notice:'Segments remain separate. Missing estimates are null; asking prices are not achieved transaction prices.'});
 });
 app.get('/api/v1/research/comparables',async c=>{
  const {limit,offset}=pagination(c.req.query()),county=uuid(c.req.query('county_id')||''),type=oneOf(c.req.query('listing_type')||'rent',['rent','sale']);
  const cutoff=(await d.pool.query('SELECT clock_timestamp() AS time')).rows[0].time.toISOString();
  const {rows}=await d.pool.query(`WITH inventory AS (${inventorySql}) SELECT i.id,i.source_url,i.observed_at,i.property_type,i.bedrooms,i.neighbourhood,i.price_amount,i.rent_period,i.floor_area_sqm,s.name source,s.attribution
   FROM inventory i JOIN atlas_control.sources s ON s.id=i.source_id WHERE i.county_id=$2 AND i.listing_type=$3 AND s.listing_details_allowed
   ORDER BY i.observed_at DESC,i.id LIMIT $4 OFFSET $5`,[cutoff,county,type,limit,offset]);
  return c.json({results:rows,limit,offset,notice:'Only sources explicitly approved for listing-level display appear. No contacts or exact property coordinates are exposed.'});
 });
 app.get('/api/v1/workspace/research/views',async c=>{
  const user=c.get('principal').id;return c.json({results:await transaction(d.pool,async db=>(await db.query('SELECT id,name,filters,created_at FROM public.atlas_saved_views WHERE owner_id=$1 ORDER BY created_at DESC LIMIT 100',[user])).rows,user)});
 });
 app.post('/api/v1/workspace/research/views',async c=>{
  const v=object(await c.req.json());exact(v,['name','filters']);const name=text(v.name,120)!,filters=researchFilters(v.filters),user=c.get('principal').id;
  const saved=await transaction(d.pool,async db=>{
   await db.query('SELECT pg_advisory_xact_lock(hashtext($1))',['saved-views:'+user]);
   if(Number((await db.query('SELECT count(*) n FROM public.atlas_saved_views WHERE owner_id=$1',[user])).rows[0].n)>=100)throw new HTTPException(409,{message:'saved_view_quota_exceeded'});
   return (await db.query('INSERT INTO public.atlas_saved_views(owner_id,name,filters) VALUES($1,$2,$3) RETURNING id,name,filters,created_at',[user,name,JSON.stringify(filters)])).rows[0];
  },user);return c.json(saved,201);
 });
 app.delete('/api/v1/workspace/research/views/:id',async c=>{
  const user=c.get('principal').id,id=uuid(c.req.param('id'));await transaction(d.pool,async db=>{if(!(await db.query('DELETE FROM public.atlas_saved_views WHERE id=$1 AND owner_id=$2',[id,user])).rowCount)throw new HTTPException(404,{message:'not_found'});},user);return c.body(null,204);
 });
 app.get('/api/v1/admin/me',c=>c.json({role:c.get('operatorRole')}));
 app.post('/api/v1/admin/validate-listings',async c=>{
  const envelope=validateManualEnvelope(await c.req.json()),issues:{index:number;code:string}[]=[];
  const counties=new Set((await d.pool.query("SELECT id FROM atlas_core.locations WHERE kind='county'")).rows.map(r=>r.id));
  for(let i=0;i<envelope.records.length;i++){try{const v=listing(envelope.records[i]);if(!counties.has(v.county_id))throw new InputError('unknown_county');}catch(error){issues.push({index:i+1,code:error instanceof InputError?error.code:'invalid_record'});}}
  return c.json({received:envelope.records.length,valid:envelope.records.length-issues.length,issues,notice:'Preview only. Nothing has been queued or stored.'});
 });
 app.patch('/api/v1/admin/sources/:id/display-permission',async c=>{
  if(c.get('operatorRole')!=='admin')throw new HTTPException(403,{message:'administrator_access_required'});
  const id=uuid(c.req.param('id')),v=object(await c.req.json());exact(v,['allowed','reason']);if(typeof v.allowed!=='boolean')throw new InputError('boolean_required');const reason=text(v.reason,500)!;if(reason.length<10)throw new InputError('review_reason_required');
  await transaction(d.pool,async db=>{const r=await db.query('UPDATE atlas_control.sources SET listing_details_allowed=$2 WHERE id=$1',[id,v.allowed]);if(!r.rowCount)throw new HTTPException(404,{message:'not_found'});await db.query('INSERT INTO atlas_control.audit_events(actor_id,action,resource_id,details) VALUES($1,$2,$3,$4)',[c.get('principal').id,'source.display_permission',id,JSON.stringify({allowed:v.allowed,reason})]);});return c.json({allowed:v.allowed});
 });
}
