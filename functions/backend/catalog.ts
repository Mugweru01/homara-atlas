import type {Hono} from 'hono';
import type {Dependencies,Variables} from './app.js';
import {inventorySql} from './publication.js';
import {locationQuery} from './geography.js';
import {pagination,oneOf,uuid,text} from './validation.js';
export function registerCatalog(app:Hono<{Variables:Variables}>,d:Dependencies){
 app.get('/api/v1/collection/sources',async c=>{
  locationQuery(c.req.url,[]);
  const reviews=(await d.pool.query('SELECT slug,name,website,terms_url,decision,reason,reviewed_at FROM atlas_control.source_reviews ORDER BY name')).rows;
  const collectors=(await d.pool.query(`SELECT s.slug,s.name,s.data_kind,s.last_success_at,s.next_run_at,s.not_before_at,
   (s.watermark->'crawl_frontier'->>'completed_at') completed_at,
   coalesce(jsonb_array_length(s.watermark->'crawl_frontier'->'queue'),0) pending_pages,
   j.status last_job_status,j.error_code,j.accepted_count,j.rejected_count,j.duplicate_count FROM atlas_control.sources s
   LEFT JOIN LATERAL(SELECT status,error_code,accepted_count,rejected_count,duplicate_count FROM atlas_control.jobs WHERE source_id=s.id ORDER BY created_at DESC LIMIT 1)j ON true
   WHERE s.driver IN ('kpc_market','approved_listing_web') AND s.status='active' AND s.publication_allowed AND(s.rights_expire_at IS NULL OR s.rights_expire_at>now()) ORDER BY s.name`)).rows;
  return c.json({reviews,collectors,notice:'Only public approved sources are listed here. Restricted feeds and confidential property records are excluded. Daily schedules have bounded retries and catch-up, not a guarantee of upstream availability.'});
 });
 app.get('/api/v1/research/benchmarks',async c=>{
  const q=locationQuery(c.req.url,['market_type','county','limit','offset']),{limit,offset}=pagination(q),type=q.market_type?oneOf(q.market_type,['rent','sale','short_let']):null,county=q.county!==undefined?text(q.county,160):null;
  const {rows}=await d.pool.query(`WITH latest AS(SELECT DISTINCT ON(b.source_id,b.series_key) b.*,s.attribution,s.license FROM atlas_core.market_benchmarks b JOIN atlas_control.sources s ON s.id=b.source_id
   WHERE s.driver='kpc_market' AND s.status='active' AND s.publication_allowed AND(s.rights_expire_at IS NULL OR s.rights_expire_at>now())
   ORDER BY b.source_id,b.series_key,b.period_end DESC,b.retrieved_at DESC,b.id)
   SELECT geography,market_type,period_start,period_end,median_price,sample_count,currency,methodology,source_url,attribution,license,retrieved_at FROM latest
   WHERE($1::text IS NULL OR market_type=$1) AND($2::text IS NULL OR regexp_replace(lower(geography),'[^a-z]','','g')=regexp_replace(lower($2),'[^a-z]','','g'))
   ORDER BY geography,market_type LIMIT $3 OFFSET $4`,[type,county,limit,offset]);
  return c.json({results:rows,limit,offset,notice:'Publisher-reported market benchmarks, not individual property listings, Atlas-derived estimates, achieved transactions or a daily price series. Collection is daily; the publisher releases monthly figures. Samples and methodologies differ.'});
 });
 app.get('/api/v1/listings',async c=>{
  const q=locationQuery(c.req.url,['county_id','listing_type','property_type','limit','offset']),{limit,offset}=pagination(q),county=q.county_id!==undefined?uuid(q.county_id):null,type=q.listing_type!==undefined?oneOf(q.listing_type,['rent','sale']):null,property=q.property_type!==undefined?oneOf(q.property_type,['apartment','house','land','office','retail','warehouse']):null;
  const cutoff=(await d.pool.query('SELECT clock_timestamp() time')).rows[0].time.toISOString();
  const {rows}=await d.pool.query(`WITH inventory AS(${inventorySql}) SELECT i.id,i.source_url,i.observed_at,i.listing_type,i.property_type,i.bedrooms,i.bathrooms,i.price_amount,i.currency,i.rent_period,i.floor_area_sqm,l.name county,s.name source,s.attribution
   FROM inventory i JOIN atlas_control.sources s ON s.id=i.source_id AND s.listing_details_allowed
   JOIN atlas_core.locations l ON l.id=i.county_id JOIN atlas_control.sources gs ON gs.id=l.source_id AND gs.status='active' AND gs.publication_allowed AND(gs.rights_expire_at IS NULL OR gs.rights_expire_at>now())
   WHERE($2::uuid IS NULL OR i.county_id=$2) AND($3::text IS NULL OR i.listing_type=$3) AND($4::text IS NULL OR i.property_type=$4)
   ORDER BY i.observed_at DESC,i.id LIMIT $5 OFFSET $6`,[cutoff,county,type,property,limit+1,offset]);
  return c.json({results:rows.slice(0,limit),limit,offset,has_more:rows.length>limit,notice:'Only fresh advertisements from sources approved for public listing display. No contacts, customer identities, exact coordinates or confidential feeds.'});
 });
}
