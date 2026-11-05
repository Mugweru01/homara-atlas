import type { Pool, PoolClient } from 'pg';
import { transaction } from './db.js';

// One canonical current-inventory definition. Absence is not a transaction outcome.
export const inventorySql = `
 WITH latest AS (
 SELECT DISTINCT ON (o.listing_id) o.*,l.source_id,l.property_id
 FROM atlas_core.listing_observations o
 JOIN atlas_core.source_listings l ON l.id=o.listing_id
 JOIN atlas_control.sources s ON s.id=l.source_id
 WHERE o.observed_at<=$1 AND s.status='active' AND s.publication_allowed
 AND (s.rights_expire_at IS NULL OR s.rights_expire_at>$1)
 ORDER BY o.listing_id,o.observed_at DESC,o.ingested_at DESC
 ), deduplicated AS (
 SELECT DISTINCT ON (coalesce(property_id,listing_id),listing_type) * FROM latest
 ORDER BY coalesce(property_id,listing_id),listing_type,observed_at DESC,listing_id
 ) SELECT * FROM deduplicated
 WHERE availability='active' AND observed_at >= $1::timestamptz-interval '14 days'
 AND (listing_type='sale' OR rent_period='month')`;

export async function publishInTransaction(db: PoolClient, cutoff: string) {
  await db.query("SELECT pg_advisory_xact_lock(hashtext('atlas-market-publication'))");
  const inventory=await db.query(`WITH inventory AS (${inventorySql}) SELECT count(*)::int n,count(distinct source_id)::int sources FROM inventory`,[cutoff]);
  const {rows:[release]}=await db.query(`INSERT INTO atlas_mart.releases(input_cutoff,listing_count,active_count,source_count)
    VALUES($1,$2,$2,$3) RETURNING id`,[cutoff,inventory.rows[0].n,inventory.rows[0].sources]);
  await db.query(`WITH inventory AS (${inventorySql}) INSERT INTO atlas_mart.release_sources
    SELECT $2,source_id FROM inventory GROUP BY source_id`,[cutoff,release.id]);
  await db.query(`WITH inventory AS (${inventorySql})
    INSERT INTO atlas_mart.market_snapshots(release_id,county_id,listing_type,property_type,bedrooms,listing_count,source_count,median_price,p25,p75,mean_price,area_sample_count,median_price_per_sqm,sparse)
    SELECT $2,county_id,listing_type,property_type,coalesce(bedrooms,-1),count(*)::int,count(distinct source_id)::int,
      CASE WHEN count(*)>=30 THEN percentile_cont(0.5) WITHIN GROUP(ORDER BY price_amount) END,
      CASE WHEN count(*)>=30 THEN percentile_cont(0.25) WITHIN GROUP(ORDER BY price_amount) END,
      CASE WHEN count(*)>=30 THEN percentile_cont(0.75) WITHIN GROUP(ORDER BY price_amount) END,
      CASE WHEN count(*)>=30 THEN avg(price_amount) END,
      count(floor_area_sqm)::int,
      CASE WHEN count(floor_area_sqm)>=30 THEN percentile_cont(0.5) WITHIN GROUP(ORDER BY price_amount/nullif(floor_area_sqm,0)) END,
      count(*)<30
    FROM inventory GROUP BY county_id,listing_type,property_type,coalesce(bedrooms,-1)`,[cutoff,release.id]);
  await db.query(`INSERT INTO atlas_mart.current_release(singleton,release_id) VALUES(true,$1)
    ON CONFLICT(singleton) DO UPDATE SET release_id=EXCLUDED.release_id`,[release.id]);
  return release.id as string;
}
export async function publish(pool:Pool,cutoff?:string) {
  return transaction(pool,async db=>{
    const time=cutoff||(await db.query('SELECT clock_timestamp() AS time')).rows[0].time.toISOString();
    return publishInTransaction(db,time);
  });
}
