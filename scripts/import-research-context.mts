// Owner-only reviewed context imports. Never reads a property feed or customer data.
import { Pool } from 'pg';
import { readFile } from 'node:fs/promises';
import { crawlText, robotsAllowed } from '../functions/backend/crawl-http.js';
import { object, hash } from '../functions/backend/validation.js';
const mode = process.argv[2];
if (!['--amenities', '--projects'].includes(mode)) throw Error('Choose --amenities or --projects');
if (!process.env.DATABASE_URL_UNPOOLED)
  throw Error('A direct owner DATABASE_URL_UNPOOLED is required');
const db = new Pool({
  connectionString: process.env.DATABASE_URL_UNPOOLED?.replace(
    'sslmode=require',
    'sslmode=verify-full',
  ),
  max: 1,
});
const now = new Date().toISOString();
try {
  const county = (
    await db.query(
      "SELECT l.id FROM atlas_core.locations l JOIN atlas_control.sources s ON s.id=l.source_id WHERE l.name='Nairobi' AND s.driver='geoboundaries_ken' AND s.status='active' AND s.publication_allowed",
    )
  ).rows[0];
  if (!county) throw Error('Published Nairobi county is required');
  let rows: Record<string, unknown>[] = [],
    proof = '';
  const coverage =
    'Pilot bounding box only: 36.75–36.90 E, 1.33–1.25 S, clipped to the bundled 2020 Nairobi county boundary. Community-mapped amenities, not a complete county register.';
  if (mode === '--amenities') {
    const origin = 'https://overpass-api.de',
      hosts = ['overpass-api.de'],
      paths = ['/robots.txt', '/api/interpreter'];
    const robots = await crawlText(
      origin + '/robots.txt',
      origin,
      paths,
      hosts,
      AbortSignal.timeout(30000),
    );
    if (!robotsAllowed(robots.text, '/api/interpreter')) throw Error('source_robots_disallowed');
    const query =
      '[out:json][timeout:25][maxsize:16777216];(nwr["amenity"~"^(school|college|university|hospital|clinic|bus_station|marketplace)$"](-1.33,36.75,-1.25,36.90);nwr["shop"="supermarket"](-1.33,36.75,-1.25,36.90););out center 2001;';
    const result = await crawlText(
      origin + '/api/interpreter?data=' + encodeURIComponent(query),
      origin,
      paths,
      hosts,
      AbortSignal.timeout(45000),
      (u) => robotsAllowed(robots.text, u.pathname),
    );
    const data = object(JSON.parse(result.text));
    if (
      data.remark ||
      !Array.isArray(data.elements) ||
      !data.elements.length ||
      data.elements.length > 2000
    )
      throw Error('Incomplete or oversized amenity response');
    proof = result.sha256;
    const map = JSON.parse(await readFile('apps/web/public/kenya-counties.geojson', 'utf8')),
      feature = map.features.find((f: any) => f.properties.shapeName === 'Nairobi');
    if (!feature) throw Error('Reference boundary missing');
    function inRing(x: number, y: number, ring: number[][]) {
      let inside = false;
      for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
        const [a, b] = ring[i],
          [c, d] = ring[j];
        if (b > y !== d > y && x < ((c - a) * (y - b)) / (d - b) + a) inside = !inside;
      }
      return inside;
    }
    const polygons =
      feature.geometry.type === 'Polygon'
        ? [feature.geometry.coordinates]
        : feature.geometry.coordinates;
    for (const raw of data.elements) {
      const e = object(raw),
        tags = object(e.tags),
        center = e.center ? object(e.center) : e,
        lat = Number(center.lat),
        lon = Number(center.lon),
        category = tags.shop === 'supermarket' ? 'supermarket' : String(tags.amenity);
      if (
        !['node', 'way', 'relation'].includes(String(e.type)) ||
        !Number.isSafeInteger(e.id) ||
        !Number.isFinite(lat) ||
        !Number.isFinite(lon)
      )
        throw Error('Invalid amenity schema');
      if (
        !polygons.some(
          (p: number[][][]) =>
            inRing(lon, lat, p[0]) && !p.slice(1).some((h) => inRing(lon, lat, h)),
        )
      )
        continue;
      if (
        ![
          'school',
          'college',
          'university',
          'hospital',
          'clinic',
          'bus_station',
          'marketplace',
          'supermarket',
        ].includes(category)
      )
        throw Error('Unexpected amenity category');
      const name =
        typeof tags.name === 'string' && tags.name.trim()
          ? tags.name.trim().slice(0, 160)
          : 'Unnamed ' + category.replace('_', ' ');
      if (/[\u0000-\u001f<>]/.test(name)) throw Error('Invalid public amenity name');
      rows.push({
        source_key: e.type + ':' + e.id,
        name,
        category,
        latitude: lat,
        longitude: lon,
        source_url: 'https://www.openstreetmap.org/' + e.type + '/' + e.id,
      });
    }
    if (!rows.length) throw Error('No points within reviewed boundary');
  } else {
    rows = [
      {
        project_key: 'nairobi-commuter-rail-revitalisation',
        name: 'Nairobi commuter rail revitalisation',
        category: 'transport',
        status: 'completed',
        evidence_date: '2020-11-10',
        summary:
          'Kenya Railways records commissioning of the revitalised commuter service on this date. This milestone does not imply that every proposed network upgrade was completed.',
        source_url: 'https://krc.co.ke/the-nairobi-commuter-rail/',
      },
      {
        project_key: 'nairobi-railway-city-central-station',
        name: 'Nairobi Railway City: central station and public realm',
        category: 'transport',
        status: 'proposed',
        evidence_date: '2025-07-03',
        summary:
          'The State Department for Roads reported Cabinet approval to implement the station and public-realm project. Approval is recorded separately from construction or completion; this entry makes no current delivery claim.',
        source_url:
          'https://www.roads.go.ke/nairobi-railway-city-central-station-and-public-realm-project',
      },
    ];
    proof = hash(rows);
  }
  await db.query('BEGIN');
  const slug = mode === '--amenities' ? 'osm-nairobi-amenities' : 'official-project-milestones',
    license =
      mode === '--amenities'
        ? 'ODbL-1.0'
        : 'Original factual summaries; official evidence linked, no document republication',
    permission =
      mode === '--amenities'
        ? 'https://www.openstreetmap.org/copyright'
        : 'https://krc.co.ke/the-nairobi-commuter-rail/';
  const attribution =
    mode === '--amenities'
      ? '© OpenStreetMap contributors. ODbL 1.0. Atlas pilot extract; community mapping is incomplete.'
      : 'Atlas factual summaries from Kenya Railways and the State Department for Roads; official evidence linked on each dated milestone. No endorsement or projected property-price impact.';
  await db.query("SELECT pg_advisory_xact_lock(hashtext('atlas-reviewed-context'))");
  let s = (await db.query('SELECT * FROM atlas_control.sources WHERE slug=$1 FOR UPDATE', [slug]))
    .rows[0];
  if (
    s &&
    (s.driver !== 'reviewed_research' ||
      s.status !== 'active' ||
      !s.publication_allowed ||
      s.license !== license ||
      s.permission_url !== permission ||
      s.attribution !== attribution ||
      (s.rights_expire_at && new Date(s.rights_expire_at).getTime() <= Date.now()))
  )
    throw Error('Existing source needs owner review');
  if (!s)
    s = (
      await db.query(
        "INSERT INTO atlas_control.sources(slug,name,driver,data_kind,status,license,permission_url,attribution,approved_at,approved_by,publication_allowed,refresh_seconds) VALUES($1,$2,'reviewed_research','context','active',$3,$4,$5,now(),'cli:reviewed-public-context',true,2592000) RETURNING *",
        [
          slug,
          mode === '--amenities'
            ? 'OpenStreetMap Nairobi amenity pilot'
            : 'Official infrastructure milestones',
          license,
          permission,
          attribution,
        ],
      )
    ).rows[0];
  if (mode === '--amenities') {
    // Replace a reviewed public extract atomically; no contact tags or raw payload persist.
    await db.query('DELETE FROM atlas_research.amenities WHERE source_id=$1', [s.id]);
    await db.query(
      `INSERT INTO atlas_research.amenities(source_id,county_id,source_key,name,category,latitude,longitude,source_url,retrieved_at,coverage)
   SELECT $1,$2,r.source_key,r.name,r.category,r.latitude,r.longitude,r.source_url,$3,$4 FROM jsonb_to_recordset($5) r(source_key text,name text,category text,latitude float8,longitude float8,source_url text)`,
      [s.id, county.id, now, coverage, JSON.stringify(rows)],
    );
  } else
    await db.query(
      `INSERT INTO atlas_research.project_events(source_id,county_id,project_key,name,category,status,evidence_date,summary,source_url,reviewed_by)
   SELECT $1,$2,r.project_key,r.name,r.category,r.status,r.evidence_date,r.summary,r.source_url,'cli:reviewed-official-evidence' FROM jsonb_to_recordset($3) r(project_key text,name text,category text,status text,evidence_date date,summary text,source_url text) ON CONFLICT DO NOTHING`,
      [s.id, county.id, JSON.stringify(rows)],
    );
  await db.query(
    'UPDATE atlas_control.sources SET last_success_at=now(),watermark=$2 WHERE id=$1',
    [
      s.id,
      JSON.stringify({
        count: rows.length,
        document_sha256: proof,
        coverage:
          mode === '--amenities'
            ? coverage
            : 'Two reviewed historical Nairobi transport milestones; not national or live coverage.',
        reviewed_at: now,
      }),
    ],
  );
  await db.query(
    "INSERT INTO atlas_control.audit_events(actor_id,action,resource_id,details) VALUES('cli:database-owner','research.context_imported',$1,$2)",
    [s.id, JSON.stringify({ count: rows.length, document_sha256: proof, mode })],
  );
  await db.query('COMMIT');
  console.log(
    JSON.stringify({
      source: slug,
      imported: rows.length,
      contains_property_or_customer_data: false,
    }),
  );
} catch (error) {
  await db.query('ROLLBACK').catch(() => {});
  throw error;
} finally {
  await db.end();
}
