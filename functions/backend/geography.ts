import type {Hono} from 'hono';
import type {Pool,PoolClient} from 'pg';
import {HTTPException} from 'hono/http-exception';
import type {Dependencies,Variables} from './app.js';
import {InputError,oneOf,pagination,uuid} from './validation.js';
import {rateLimit} from './security.js';
import {geographyOpenApi} from './geography-openapi.js';
const kinds=['county','constituency','ward','sub_county','locality','area'] as const;
export function locationQuery(url:string,allowed:string[]){
 const params=new URL(url).searchParams,query:Record<string,string>={};
 for(const [key,value]of params){if(!allowed.includes(key)||Object.hasOwn(query,key))throw new InputError('unexpected_or_duplicate_query_parameter');query[key]=value;}
 return query;
}
function numericCode(value:string|undefined){if(value!==undefined&&!/^\d{3}$/.test(value))throw new InputError('invalid_location_code');return value??null;}
async function read<T>(pool:Pool,fn:(db:PoolClient)=>Promise<T>){
 const db=await pool.connect();try{
  await db.query('BEGIN ISOLATION LEVEL REPEATABLE READ READ ONLY');
  await db.query("SET LOCAL statement_timeout='2000ms'");
  const result=await fn(db);await db.query('COMMIT');return result;
 }catch(error){await db.query('ROLLBACK');throw error;}finally{db.release();}
}
async function dataset(db:PoolClient,required=true){
 const {rows:[r]}=await db.query('SELECT revision,package_version,manifest_sha256,provenance,imported_at FROM atlas_geo.published_release');
 if(!r){if(required)throw new HTTPException(503,{message:'geography_dataset_unavailable'});return null;}
 return {...r.provenance,version:r.package_version,revision:r.revision,manifest_sha256:r.manifest_sha256,imported_at:r.imported_at};
}
export function registerGeography(app:Hono<{Variables:Variables}>,d:Dependencies){
 app.use('/api/v1/geography/*',async(c,next)=>{
  if(!['GET','HEAD','OPTIONS'].includes(c.req.method)){c.header('Allow','GET, HEAD, OPTIONS');return c.json({error:'read_only_endpoint',request_id:c.get('requestId')},405);}
  if(c.req.method!=='OPTIONS')await rateLimit(d.pool,d.rateSecret,'geography-global',180);
  await next();
 });
 app.get('/api/v1/geography/openapi.json',c=>{locationQuery(c.req.url,[]);return c.json(geographyOpenApi);});
 app.get('/api/v1/geography/dataset',async c=>{locationQuery(c.req.url,[]);return c.json(await read(d.pool,db=>dataset(db)));});
 app.get('/api/v1/geography/counties',async c=>{
  locationQuery(c.req.url,[]);
  return c.json(await read(d.pool,async db=>{
   const reference=await dataset(db,false);
   const {rows}=await db.query(`SELECT l.id,l.name,v.reference_year,m.county_code code,p.name reference_name,p.metadata
    FROM atlas_core.locations l JOIN atlas_control.sources s ON s.id=l.source_id
    JOIN LATERAL(SELECT reference_year FROM atlas_core.location_versions WHERE location_id=l.id ORDER BY observed_at DESC LIMIT 1)v ON true
    LEFT JOIN atlas_geo.published_county_mapping m ON m.location_id=l.id
    LEFT JOIN atlas_geo.published_places p ON p.kind='county' AND p.code=m.county_code
    WHERE l.kind='county' AND s.driver='geoboundaries_ken' AND s.status='active' AND s.publication_allowed
    AND(s.rights_expire_at IS NULL OR s.rights_expire_at>now()) ORDER BY l.name`);
   return {results:rows,precision:'county',dataset:reference,notice:'County IDs and boundary reference years are preserved. Additional names and metadata are attributed to kenya-locations. No property coordinates or listing information.'};
  }));
 });
 async function list(url:string,kind?:typeof kinds[number],search=false){
  const q=locationQuery(url,['limit','offset','county_code','parent_id','constituency_code',...(kind?[]:['kind']),...(search?['q']:[])]),page=pagination(q);
  const selected=kind??(q.kind!==undefined?oneOf(q.kind,kinds):null),county=numericCode(q.county_code),constituency=numericCode(q.constituency_code),parent=q.parent_id!==undefined?uuid(q.parent_id):null;
  const term=search?q.q?.normalize('NFC').trim():null;
  if(search&&(!term||term.length<2||term.length>80||/[\u0000-\u001f]/.test(term)))throw new InputError('search_requires_2_to_80_characters');
  if(search&&page.limit>25)page.limit=25;
  return read(d.pool,async db=>{
   const reference=await dataset(db);
   const {rows}=await db.query(`SELECT p.id,p.kind,p.name,p.code,p.county_code,p.metadata,p.provenance_class,m.location_id atlas_county_id
    FROM atlas_geo.published_places p LEFT JOIN atlas_geo.published_county_mapping m ON m.county_code=p.county_code
    WHERE ($1::text IS NULL OR p.kind=$1) AND($2::text IS NULL OR p.county_code=$2)
    AND($3::uuid IS NULL OR EXISTS(SELECT 1 FROM atlas_geo.published_relations x WHERE x.child_id=p.id AND x.parent_id=$3))
    AND($4::text IS NULL OR EXISTS(SELECT 1 FROM atlas_geo.published_relations x JOIN atlas_geo.published_places parent ON parent.id=x.parent_id WHERE x.child_id=p.id AND x.kind='constituency' AND parent.code=$4))
    AND($5::text IS NULL OR strpos(lower(p.name),lower($5))>0 OR EXISTS(SELECT 1 FROM jsonb_array_elements_text(coalesce(p.metadata->'aliases','[]'::jsonb)) alias WHERE strpos(lower(alias),lower($5))>0))
    ORDER BY lower(p.name),p.kind,p.id LIMIT $6 OFFSET $7`,[selected,county,parent,constituency,term,page.limit+1,page.offset]);
   return {results:rows.slice(0,page.limit),...page,has_more:rows.length>page.limit,dataset:reference,notice:'Public location reference only. Informal places are not guaranteed ward assignments; no property records or listing counts are included.'};
  });
 }
 app.get('/api/v1/geography/places',async c=>c.json(await list(c.req.url)));
 app.get('/api/v1/geography/search',async c=>c.json(await list(c.req.url,undefined,true)));
 for(const [path,kind]of [['constituencies','constituency'],['wards','ward'],['sub-counties','sub_county'],['localities','locality'],['areas','area']] as const){app.get('/api/v1/geography/'+path,async c=>c.json(await list(c.req.url,kind)));}
 app.get('/api/v1/geography/places/:id',async c=>{
  locationQuery(c.req.url,[]);const id=uuid(c.req.param('id'));
  return c.json(await read(d.pool,async db=>{
   const reference=await dataset(db);
   const {rows:[place]}=await db.query('SELECT id,kind,name,code,county_code,metadata,provenance_class FROM atlas_geo.published_places WHERE id=$1',[id]);
   if(!place)throw new HTTPException(404,{message:'location_not_found'});
   const parents=(await db.query(`SELECT p.id,p.kind,p.name,p.code,x.method FROM atlas_geo.published_relations x JOIN atlas_geo.published_places p ON p.id=x.parent_id WHERE x.child_id=$1 ORDER BY p.kind,p.id`,[id])).rows;
   return {result:place,parents,dataset:reference};
  }));
 });
}
