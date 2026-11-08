import type { Hono } from 'hono';
import { HTTPException } from 'hono/http-exception';
import type { PoolClient } from 'pg';
import type { Dependencies, Variables } from './app.js';
import { object, exact, text, uuid, oneOf, InputError, pagination } from './validation.js';
import { locationQuery } from './geography.js';
import { transaction } from './db.js';
import { calculateScenario, scenarioInputs } from './scenarios.js';
import { rateLimit } from './security.js';

export function intelligenceFilters(raw: unknown) {
  const v = object(raw);
  exact(v, ['county_ids', 'market_type', 'as_of']);
  if (!Array.isArray(v.county_ids) || v.county_ids.length < 1 || v.county_ids.length > 4)
    throw new InputError('choose_one_to_four_counties');
  const county_ids = [...new Set(v.county_ids.map((id) => uuid(String(id))))],
    market_type = oneOf(v.market_type ?? 'rent', ['rent', 'sale', 'short_let']);
  const as_of = v.as_of == null ? null : String(v.as_of);
  if (
    as_of !== null &&
    (!/^20\d{2}-(0[1-9]|1[0-2])$/.test(as_of) || as_of > new Date().toISOString().slice(0, 7))
  )
    throw new InputError('invalid_reference_month');
  return { county_ids, market_type, as_of };
}
async function evidence(db: PoolClient, f: ReturnType<typeof intelligenceFilters>) {
  const counties = (
    await db.query(
      `SELECT l.id,l.name,p.name reference_name,p.metadata FROM atlas_core.locations l
  JOIN atlas_control.sources s ON s.id=l.source_id AND s.driver='geoboundaries_ken' AND s.status='active' AND s.publication_allowed AND(s.rights_expire_at IS NULL OR s.rights_expire_at>now())
  LEFT JOIN atlas_geo.published_county_mapping m ON m.location_id=l.id LEFT JOIN atlas_geo.published_places p ON p.kind='county' AND p.code=m.county_code
  WHERE l.id=ANY($1::uuid[]) ORDER BY l.name`,
      [f.county_ids],
    )
  ).rows;
  if (counties.length !== f.county_ids.length)
    throw new InputError('unknown_or_unpublished_county');
  const names = counties.map((r) => r.reference_name || r.name);
  const series = (
    await db.query(
      `WITH versions AS(SELECT DISTINCT ON(b.source_id,b.series_key,b.period_end) b.geography,b.market_type,b.period_start,b.period_end,b.median_price,b.sample_count,b.methodology,b.source_url,b.retrieved_at,s.attribution,s.license,s.name source,s.slug,
  (s.not_before_at IS NOT NULL AND s.not_before_at>now()) collection_paused,
  b.retrieved_at<now()-interval '62 days' collection_old
  FROM atlas_core.market_benchmarks b JOIN atlas_control.sources s ON s.id=b.source_id
  WHERE s.driver='kpc_market' AND s.status='active' AND s.publication_allowed AND(s.rights_expire_at IS NULL OR s.rights_expire_at>now()) AND b.market_type=$2
  AND regexp_replace(lower(b.geography),'[^a-z]','','g')=ANY(SELECT regexp_replace(lower(n),'[^a-z]','','g') FROM unnest($1::text[]) n)
  AND($3::text IS NULL OR to_char(b.period_end,'YYYY-MM')<=$3)
  ORDER BY b.source_id,b.series_key,b.period_end,b.retrieved_at DESC,b.id DESC)
  SELECT * FROM versions ORDER BY period_end DESC,geography,source LIMIT 240`,
      [names, f.market_type, f.as_of],
    )
  ).rows;
  const amenities = (
    await db.query(
      'SELECT county_id,category,count(*)::int count,min(retrieved_at) retrieved_at,min(coverage) coverage FROM atlas_research.public_amenities WHERE county_id=ANY($1::uuid[]) GROUP BY county_id,category',
      [f.county_ids],
    )
  ).rows;
  return {
    counties,
    series,
    amenities,
    filters: f,
    captured_at: new Date().toISOString(),
    methodology: 'research-evidence/1',
    notice:
      'Broad county publisher populations are not matched property segments; consult each source methodology. Do not infer transaction prices, causal investment returns or representative coverage. County metadata: kenya-locations by David Amunga and contributors, CC BY 4.0; population refers to 2019. The latest 240 captured county-period figures are returned; only actual reference months appear, with no invented historical backfill.',
  };
}
export function registerIntelligence(app: Hono<{ Variables: Variables }>, d: Dependencies) {
  app.use('/api/v1/research/intelligence/*', async (c, next) => {
    await rateLimit(d.pool, d.rateSecret, 'research-intelligence', 120);
    await next();
  });
  app.get('/api/v1/research/intelligence/evidence', async (c) => {
    const q = locationQuery(c.req.url, ['county_ids', 'market_type', 'as_of']),
      f = intelligenceFilters({
        county_ids: (q.county_ids || '').split(','),
        market_type: q.market_type,
        as_of: q.as_of,
      });
    return c.json(
      await transaction(d.pool, async (db) => {
        await db.query("SET LOCAL statement_timeout='3000ms'");
        return evidence(db, f);
      }),
    );
  });
  app.post('/api/v1/research/intelligence/scenario', async (c) =>
    c.json(calculateScenario(await c.req.json())),
  );
  app.get('/api/v1/research/intelligence/liquidity', async (c) => {
    const q = locationQuery(c.req.url, ['county_ids', 'market_type', 'days']),
      f = intelligenceFilters({
        county_ids: (q.county_ids || '').split(','),
        market_type: q.market_type,
      });
    if (f.market_type === 'short_let')
      throw new InputError('liquidity_requires_sale_or_monthly_rent');
    const days = q.days ?? '30';
    if (!['30', '90'].includes(days)) throw new InputError('invalid_window');
    return c.json(
      await transaction(d.pool, async (db) => {
        await db.query("SET LOCAL statement_timeout='3000ms'");
        await evidence(db, f);
        const rows = (
          await db.query(
            `WITH eligible AS(SELECT o.*,l.source_id,l.first_seen_at,coalesce(l.property_id,l.id) entity,
     row_number() OVER(PARTITION BY o.listing_id ORDER BY o.observed_at DESC,o.ingested_at DESC) n,
     lag(o.price_amount) OVER(PARTITION BY o.listing_id ORDER BY o.observed_at,o.ingested_at) previous_price
    FROM atlas_core.listing_observations o JOIN atlas_core.source_listings l ON l.id=o.listing_id JOIN atlas_control.sources s ON s.id=l.source_id
    WHERE s.driver<>'homara_public' AND s.status='active' AND s.publication_allowed AND(s.rights_expire_at IS NULL OR s.rights_expire_at>now())
    AND o.county_id=ANY($1::uuid[]) AND o.listing_type=$2 AND($2='sale' OR o.rent_period='month') AND o.observed_at<=now()
   ), latest AS(SELECT DISTINCT ON(entity) * FROM eligible WHERE n=1 AND observed_at>=now()-interval '14 days' ORDER BY entity,observed_at DESC,id),
   grouped AS(SELECT county_id,count(*)::int sample_count,count(DISTINCT source_id)::int source_count,
    count(*) FILTER(WHERE first_seen_at>=now()-make_interval(days=>$3::int))::int newly_observed,
    count(*) FILTER(WHERE availability='withdrawn' AND observed_at>=now()-make_interval(days=>$3::int))::int explicitly_withdrawn,
    count(*) FILTER(WHERE previous_price>price_amount AND observed_at>=now()-make_interval(days=>$3::int))::int latest_price_reductions,
    percentile_cont(0.5) WITHIN GROUP(ORDER BY greatest(0,extract(epoch FROM(observed_at-first_seen_at))/86400)) median_observed_days FROM latest GROUP BY county_id)
   SELECT county_id,sample_count,source_count,sample_count<30 sparse,
    CASE WHEN sample_count>=30 THEN newly_observed END newly_observed,
    CASE WHEN sample_count>=30 THEN explicitly_withdrawn END explicitly_withdrawn,
    CASE WHEN sample_count>=30 THEN latest_price_reductions END latest_price_reductions,
    CASE WHEN sample_count>=30 THEN median_observed_days END median_observed_days FROM grouped`,
            [f.county_ids, f.market_type, Number(days)],
          )
        ).rows;
        return {
          results: rows,
          days: Number(days),
          minimum_sample: 30,
          methodology: 'observed-advert-activity/1',
          notice:
            'Fresh latest observations only. Newly observed means first seen by Atlas, not newly listed in the market. Price reductions compare the latest observation with its preceding observation for the same advert. Withdrawn means explicit advertiser availability, not disappearance, sale or letting. Observed duration is left-censored by collection start. These are supply/activity signals, not measured buyer demand or a sell-through rate.',
        };
      }),
    );
  });
  app.get('/api/v1/research/intelligence/amenities', async (c) => {
    const q = locationQuery(c.req.url, ['county_id', 'category', 'limit', 'offset']),
      county = uuid(q.county_id || ''),
      p = pagination(q),
      category = q.category
        ? oneOf(q.category, [
            'school',
            'college',
            'university',
            'hospital',
            'clinic',
            'bus_station',
            'marketplace',
            'supermarket',
          ])
        : null;
    const rows = (
      await d.pool.query(
        'SELECT id,name,category,latitude,longitude,source_url,retrieved_at,coverage,attribution,license FROM atlas_research.public_amenities WHERE county_id=$1 AND($2::text IS NULL OR category=$2) ORDER BY name,id LIMIT $3 OFFSET $4',
        [county, category, p.limit + 1, p.offset],
      )
    ).rows;
    return c.json({
      results: rows.slice(0, p.limit),
      has_more: rows.length > p.limit,
      ...p,
      notice:
        'Public amenity points, not property coordinates. GeoNames facility data: CC BY 4.0; any OpenStreetMap extracts: ODbL 1.0. Attribution and coverage accompany each record. Gazetteer/community mapping is incomplete and may be historical; absence means not captured, not that a service does not exist. Straight-line proximity is not travel time, service quality or current opening status.',
    });
  });
  app.get('/api/v1/research/intelligence/amenities/export', async (c) => {
    const q = locationQuery(c.req.url, ['county_id']),
      county = uuid(q.county_id || '');
    const rows = (
      await d.pool.query(
        'SELECT name,category,latitude,longitude,source_url,retrieved_at,coverage,attribution,license FROM atlas_research.public_amenities WHERE county_id=$1 ORDER BY name,id LIMIT 2001',
        [county],
      )
    ).rows;
    if (rows.length > 2000)
      throw new HTTPException(409, { message: 'export_requires_smaller_reviewed_release' });
    return c.json({
      results: rows,
      licenses: [...new Set(rows.map((r) => r.license))],
      attributions: [...new Set(rows.map((r) => r.attribution))],
      license_urls: {
        'CC BY 4.0': 'https://creativecommons.org/licenses/by/4.0/',
        'ODbL-1.0': 'https://www.openstreetmap.org/copyright',
      },
      notice:
        'Retain each source attribution and licence. GeoNames facility subset: CC BY 4.0; OpenStreetMap extract, if present: ODbL 1.0. No property or private research data is included.',
    });
  });
  app.get('/api/v1/research/intelligence/projects', async (c) => {
    const q = locationQuery(c.req.url, ['county_id']),
      county = uuid(q.county_id || '');
    return c.json({
      results: (
        await d.pool.query(
          'SELECT project_key,name,category,status,evidence_date,summary,source_url,reviewed_at,attribution FROM atlas_research.public_projects WHERE county_id=$1 ORDER BY evidence_date DESC,id LIMIT 100',
          [county],
        )
      ).rows,
      notice:
        'Dated documentary milestones, not a live construction audit or evidence of a price uplift. Proposed, funded, underway and completed are distinct. Old milestones do not establish current status; consult the linked authority.',
    });
  });
  app.get('/api/v1/workspace/research/items', async (c) => {
    locationQuery(c.req.url, []);
    const user = c.get('principal').id;
    return c.json({
      results: await transaction(
        d.pool,
        async (db) =>
          (
            await db.query(
              "SELECT id,name,payload,jsonb_build_object('counties',evidence->'counties','captured_at',evidence->'captured_at') evidence,created_at FROM public.atlas_research_items WHERE owner_id=$1 ORDER BY created_at DESC LIMIT 100",
              [user],
            )
          ).rows,
        user,
      ),
    });
  });
  app.get('/api/v1/workspace/research/items/:id', async (c) => {
    locationQuery(c.req.url, []);
    const user = c.get('principal').id,
      id = uuid(c.req.param('id') || '');
    const result = await transaction(
      d.pool,
      async (db) =>
        (
          await db.query(
            'SELECT id,name,payload,evidence,created_at FROM public.atlas_research_items WHERE id=$1 AND owner_id=$2',
            [id, user],
          )
        ).rows[0],
      user,
    );
    if (!result) throw new HTTPException(404, { message: 'not_found' });
    return c.json(result);
  });
  app.post('/api/v1/workspace/research/items', async (c) => {
    const v = object(await c.req.json());
    exact(v, ['name', 'filters', 'scenario']);
    const name = text(v.name, 120)!,
      filters = intelligenceFilters(v.filters),
      scenario = v.scenario == null ? null : scenarioInputs(v.scenario),
      user = c.get('principal').id;
    const result = await transaction(
      d.pool,
      async (db) => {
        await db.query('SELECT pg_advisory_xact_lock(hashtext($1))', ['research-item:' + user]);
        if (
          Number(
            (
              await db.query(
                'SELECT count(*) n FROM public.atlas_research_items WHERE owner_id=$1',
                [user],
              )
            ).rows[0].n,
          ) >= 100
        )
          throw new HTTPException(409, { message: 'research_item_quota_exceeded' });
        const captured = await evidence(db, filters);
        if (Buffer.byteLength(JSON.stringify(captured)) > 190000)
          throw new HTTPException(413, { message: 'research_snapshot_too_large' });
        return (
          await db.query(
            'INSERT INTO public.atlas_research_items(owner_id,name,payload,evidence) VALUES($1,$2,$3,$4) RETURNING id,name,payload,evidence,created_at',
            [
              user,
              name,
              JSON.stringify({ version: 1, filters, scenario }),
              JSON.stringify(captured),
            ],
          )
        ).rows[0];
      },
      user,
    );
    return c.json(result, 201);
  });
  app.delete('/api/v1/workspace/research/items/:id', async (c) => {
    const user = c.get('principal').id,
      id = uuid(c.req.param('id') || '');
    await transaction(
      d.pool,
      async (db) => {
        if (
          !(
            await db.query('DELETE FROM public.atlas_research_items WHERE id=$1 AND owner_id=$2', [
              id,
              user,
            ])
          ).rowCount
        )
          throw new HTTPException(404, { message: 'not_found' });
      },
      user,
    );
    return c.body(null, 204);
  });
  app.get('/api/v1/workspace/research/watchlists', async (c) => {
    const user = c.get('principal').id;
    return c.json(
      await transaction(
        d.pool,
        async (db) => ({
          results: (
            await db.query(
              'SELECT id,name,geography,market_type,threshold_percent,direction,created_at FROM public.atlas_watchlists WHERE owner_id=$1 ORDER BY created_at DESC LIMIT 100',
              [user],
            )
          ).rows,
          alerts: (
            await db.query(
              'SELECT id,watch_id,geography,market_type,period_end,previous_period,change_percent,created_at FROM public.atlas_research_alerts WHERE owner_id=$1 ORDER BY created_at DESC LIMIT 200',
              [user],
            )
          ).rows,
          delivery: 'in_app_only',
          external_delivery_enabled: false,
        }),
        user,
      ),
    );
  });
  app.post('/api/v1/workspace/research/watchlists', async (c) => {
    const v = object(await c.req.json());
    exact(v, ['name', 'county_id', 'market_type', 'threshold_percent', 'direction']);
    const name = text(v.name, 120)!,
      f = intelligenceFilters({ county_ids: [v.county_id], market_type: v.market_type }),
      direction = oneOf(v.direction, ['up', 'down', 'either']),
      threshold = v.threshold_percent,
      user = c.get('principal').id;
    if (
      typeof threshold !== 'number' ||
      !Number.isFinite(threshold) ||
      threshold < 0.1 ||
      threshold > 100
    )
      throw new InputError('invalid_change_threshold');
    const result = await transaction(
      d.pool,
      async (db) => {
        await db.query('SELECT pg_advisory_xact_lock(hashtext($1))', ['watchlist:' + user]);
        if (
          Number(
            (
              await db.query('SELECT count(*) n FROM public.atlas_watchlists WHERE owner_id=$1', [
                user,
              ])
            ).rows[0].n,
          ) >= 100
        )
          throw new HTTPException(409, { message: 'watchlist_quota_exceeded' });
        const capture = await evidence(db, f),
          county = capture.counties[0];
        return (
          await db.query(
            'INSERT INTO public.atlas_watchlists(owner_id,name,geography,market_type,threshold_percent,direction) VALUES($1,$2,$3,$4,$5,$6) RETURNING id,name,geography,market_type,threshold_percent,direction',
            [user, name, county.reference_name || county.name, f.market_type, threshold, direction],
          )
        ).rows[0];
      },
      user,
    );
    return c.json(result, 201);
  });
  app.delete('/api/v1/workspace/research/watchlists/:id', async (c) => {
    const user = c.get('principal').id,
      id = uuid(c.req.param('id') || '');
    await transaction(
      d.pool,
      async (db) => {
        if (
          !(
            await db.query('DELETE FROM public.atlas_watchlists WHERE id=$1 AND owner_id=$2', [
              id,
              user,
            ])
          ).rowCount
        )
          throw new HTTPException(404, { message: 'not_found' });
      },
      user,
    );
    return c.body(null, 204);
  });
}
