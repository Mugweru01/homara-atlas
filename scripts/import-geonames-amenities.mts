// A documented CC BY 4.0 bulk-download source, not the blocked Overpass service.
import { Pool } from 'pg';
import { readFile } from 'node:fs/promises';
import { unzipSync } from 'fflate';
import { crawlBytes, crawlText } from '../functions/backend/crawl-http.js';
if (process.argv[2] !== '--apply' || !process.env.DATABASE_URL_UNPOOLED)
  throw Error('Use --apply with a direct owner DATABASE_URL_UNPOOLED');
const origin = 'https://download.geonames.org',
  paths = ['/export/dump/readme.txt', '/export/dump/KE.zip'],
  hosts = ['download.geonames.org'];
const licence = await crawlText(
  origin + paths[0],
  origin,
  paths,
  hosts,
  AbortSignal.timeout(30000),
);
if (
  !licence.text.includes('Creative Commons Attribution 4.0') ||
  !licence.text.includes('https://creativecommons.org/licenses/by/4.0/')
)
  throw Error('source_license_changed');
const zip = await crawlBytes(origin + paths[1], origin, paths, hosts, AbortSignal.timeout(60000)),
  files = unzipSync(zip.bytes, {
    filter: (f) => f.name === 'KE.txt' && f.originalSize > 0 && f.originalSize <= 16 * 1024 * 1024,
  });
const bytes = files['KE.txt'];
if (!bytes || bytes.length > 16 * 1024 * 1024) throw Error('Country extract missing or oversized');
const contents = new TextDecoder('utf-8', { fatal: true }).decode(bytes),
  lines = contents.trimEnd().split('\n');
if (lines.length < 1000 || lines.length > 100000) throw Error('Unexpected country extract size');
const map = JSON.parse(await readFile('apps/web/public/kenya-counties.geojson', 'utf8'));
const codes: Record<string, string> = {
  HSP: 'hospital',
  HSPC: 'clinic',
  HSPD: 'clinic',
  SCH: 'school',
  SCHC: 'college',
  SCHT: 'college',
  UNIV: 'university',
  MKT: 'marketplace',
  BSTN: 'bus_station',
};
function inRing(x: number, y: number, ring: number[][]) {
  let inside = false;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const [a, b] = ring[i],
      [c, d] = ring[j];
    if (b > y !== d > y && x < ((c - a) * (y - b)) / (d - b) + a) inside = !inside;
  }
  return inside;
}
const db = new Pool({
  connectionString: process.env.DATABASE_URL_UNPOOLED.replace(
    'sslmode=require',
    'sslmode=verify-full',
  ),
  max: 1,
});
try {
  const counties = (
    await db.query(
      "SELECT l.id,l.name FROM atlas_core.locations l JOIN atlas_control.sources s ON s.id=l.source_id WHERE l.kind='county' AND s.driver='geoboundaries_ken' AND s.status='active' AND s.publication_allowed AND(s.rights_expire_at IS NULL OR s.rights_expire_at>now())",
    )
  ).rows;
  if (counties.length !== 47 || map.features.length !== 47)
    throw Error('Complete reviewed county geography required');
  const shapes = map.features.map((f: any) => {
    const county = counties.find((c) => c.name === f.properties.shapeName);
    if (!county) throw Error('County identity crosswalk missing');
    return {
      county,
      polygons: f.geometry.type === 'Polygon' ? [f.geometry.coordinates] : f.geometry.coordinates,
    };
  });
  const rows: Record<string, unknown>[] = [],
    keys = new Set<string>();
  let unmapped = 0;
  for (const line of lines) {
    const c = line.replace(/\r$/, '').split('\t');
    if (c.length !== 19 || c[8] !== 'KE') throw Error('GeoNames schema/country changed');
    if (c[6] !== 'S' || !codes[c[7]]) continue;
    const lat = Number(c[4]),
      lon = Number(c[5]);
    if (
      !/^\d+$/.test(c[0]) ||
      !c[1] ||
      c[1].length > 160 ||
      /[<>\u0000-\u001f]/.test(c[1]) ||
      !Number.isFinite(lat) ||
      !Number.isFinite(lon) ||
      lat < -4.8 ||
      lat > 5.6 ||
      lon < 33.8 ||
      lon > 42
    )
      throw Error('Invalid public amenity row');
    if (keys.has(c[0])) throw Error('Duplicate GeoNames ID');
    keys.add(c[0]);
    const matches = shapes.filter((f: any) =>
      f.polygons.some(
        (p: number[][][]) => inRing(lon, lat, p[0]) && !p.slice(1).some((h) => inRing(lon, lat, h)),
      ),
    );
    if (matches.length !== 1) {
      unmapped++;
      continue;
    }
    rows.push({
      source_key: 'geonames:' + c[0],
      county_id: matches[0].county.id,
      name: c[1],
      category: codes[c[7]],
      latitude: lat,
      longitude: lon,
      source_url: 'https://www.geonames.org/' + c[0] + '/',
    });
  }
  if (!rows.length || rows.length > 20000) throw Error('Unexpected amenity coverage');
  const coverage =
    'GeoNames Kenya gazetteer facility subset (schools, colleges, universities, medical facilities, markets and bus stations). County assigned by point-in-polygon against bundled 2020 geoBoundaries. Gazetteer coverage, coordinates and classifications may be incomplete, approximate or historical; not a current service register.';
  const attribution =
    'GeoNames (geonames.org), CC BY 4.0. Atlas selected facility feature codes from the Kenya country dump and assigned county by 2020 geoBoundaries point-in-polygon; unmatched/ambiguous points withheld.';
  await db.query('BEGIN');
  await db.query("SELECT pg_advisory_xact_lock(hashtext('atlas-reviewed-context'))");
  let source = (
    await db.query(
      "SELECT * FROM atlas_control.sources WHERE slug='geonames-kenya-amenities' FOR UPDATE",
    )
  ).rows[0];
  if (
    source &&
    (source.status !== 'active' ||
      !source.publication_allowed ||
      source.driver !== 'reviewed_research' ||
      source.license !== 'CC BY 4.0' ||
      source.attribution !== attribution ||
      (source.rights_expire_at && new Date(source.rights_expire_at).getTime() <= Date.now()))
  )
    throw Error('Existing source needs owner review');
  if (!source)
    source = (
      await db.query(
        "INSERT INTO atlas_control.sources(slug,name,driver,data_kind,status,license,permission_url,attribution,approved_at,approved_by,publication_allowed,refresh_seconds) VALUES('geonames-kenya-amenities','GeoNames Kenya facility gazetteer','reviewed_research','context','active','CC BY 4.0','https://download.geonames.org/export/dump/readme.txt',$1,now(),'cli:reviewed-open-dataset',true,2592000) RETURNING *",
        [attribution],
      )
    ).rows[0];
  await db.query('DELETE FROM atlas_research.amenities WHERE source_id=$1', [source.id]);
  await db.query(
    `INSERT INTO atlas_research.amenities(source_id,county_id,source_key,name,category,latitude,longitude,source_url,retrieved_at,coverage)
 SELECT $1,r.county_id,r.source_key,r.name,r.category,r.latitude,r.longitude,r.source_url,now(),$2 FROM jsonb_to_recordset($3) r(county_id uuid,source_key text,name text,category text,latitude float8,longitude float8,source_url text)`,
    [source.id, coverage, JSON.stringify(rows)],
  );
  await db.query(
    'UPDATE atlas_control.sources SET last_success_at=now(),watermark=$2 WHERE id=$1',
    [
      source.id,
      JSON.stringify({
        count: rows.length,
        unmapped,
        zip_sha256: zip.sha256,
        licence_sha256: licence.sha256,
        coverage,
      }),
    ],
  );
  await db.query(
    "INSERT INTO atlas_control.audit_events(actor_id,action,resource_id,details) VALUES('cli:database-owner','research.context_imported',$1,$2)",
    [
      source.id,
      JSON.stringify({
        count: rows.length,
        unmapped,
        zip_sha256: zip.sha256,
        licence_sha256: licence.sha256,
      }),
    ],
  );
  await db.query('COMMIT');
  console.log(
    JSON.stringify({
      source: 'GeoNames',
      amenities: rows.length,
      counties: new Set(rows.map((r) => r.county_id)).size,
      unmapped,
      private_or_property_data: false,
    }),
  );
} catch (e) {
  await db.query('ROLLBACK').catch(() => {});
  throw e;
} finally {
  await db.end();
}
