import test, { before, after } from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { Pool } from 'pg';
import { createApp } from '../functions/backend/app.js';
import { transaction } from '../functions/backend/db.js';
import { calculateScenario, scenarioDefaults } from '../functions/backend/scenarios.js';
if (process.env.NEON_BRANCH !== 'codex-backend-validation')
  throw Error('Research tests require the isolated validation database');
const owner = new Pool({ connectionString: process.env.DATABASE_URL_UNPOOLED }),
  api = new Pool({ connectionString: process.env.ATLAS_API_DATABASE_URL }),
  worker = new Pool({ connectionString: process.env.ATLAS_WORKER_DATABASE_URL }),
  alice = 'research-' + randomUUID(),
  bob = 'research-' + randomUUID();
const storage = {
  async put() {},
  async get() {
    return new Uint8Array();
  },
  async remove() {},
  async exists() {
    return true;
  },
  async url() {
    return 'https://example.test';
  },
};
const app = createApp({
  pool: api,
  storage,
  origins: [],
  rateSecret: randomUUID().repeat(2),
  verify: async (token) => {
    if (token === 'alice') return { id: alice };
    if (token === 'bob') return { id: bob };
    throw Error('invalid');
  },
  seal: async () => ({}),
});
const req = (path: string, token?: string, body?: unknown, method = body ? 'POST' : 'GET') =>
  app.request('https://atlas.example/api/v1' + path, {
    method,
    headers: {
      ...(token ? { Authorization: 'Bearer ' + token } : {}),
      'Content-Type': 'application/json',
    },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
let county: string,
  countyName: string,
  marketSource: string,
  contextSource: string,
  artifact: string,
  job: string;
async function source(driver: string, kind: string) {
  return (
    await owner.query(
      "INSERT INTO atlas_control.sources(slug,name,driver,data_kind,status,license,permission_url,attribution,approved_at,approved_by,publication_allowed,next_run_at) VALUES($1,'Synthetic research evidence',$2,$3,'active','Test only','https://example.test/permission','Synthetic isolated fixture',now(),'test-owner',true,now()+interval '1 day') RETURNING id",
      ['intelligence-' + randomUUID(), driver, kind],
    )
  ).rows[0].id;
}
async function benchmark(period: string, value: number) {
  return (
    await owner.query(
      "INSERT INTO atlas_core.market_benchmarks(source_id,job_id,artifact_id,series_key,geography,market_type,period_start,period_end,median_price,sample_count,currency,methodology,source_url,content_hash) VALUES($1,$2,$3,$4,$5,'rent',$6,$7,$8,80,'KES','Synthetic fixture','https://kenyapropertycentre.com/market-trends/average-prices/for-rent/nairobi',$9) RETURNING id",
      [
        marketSource,
        job,
        artifact,
        'rent:' + countyName,
        countyName,
        period.slice(0, 7) + '-01',
        period,
        value,
        randomUUID().replaceAll('-', '').repeat(2),
      ],
    )
  ).rows[0].id;
}
before(async () => {
  const geo = await source('geoboundaries_ken', 'geography');
  countyName = 'Research' + randomUUID().replaceAll('-', '');
  county = (
    await owner.query(
      "INSERT INTO atlas_core.locations(source_id,source_key,name,kind) VALUES($1,'research-county',$2,'county') RETURNING id",
      [geo, countyName],
    )
  ).rows[0].id;
  marketSource = await source('kpc_market', 'context');
  contextSource = await source('reviewed_research', 'context');
  job = (
    await owner.query(
      "INSERT INTO atlas_control.jobs(source_id,idempotency_key,requested_by,request_hash,status,finished_at) VALUES($1,$2,'fixture',$3,'succeeded',now()) RETURNING id",
      [marketSource, randomUUID(), 'a'.repeat(64)],
    )
  ).rows[0].id;
  artifact = (
    await owner.query(
      'INSERT INTO atlas_control.artifacts(source_id,sha256,object_key,byte_length) VALUES($1,$2,$3,1) RETURNING id',
      [marketSource, randomUUID().replaceAll('-', '').repeat(2), 'fixtures/' + randomUUID()],
    )
  ).rows[0].id;
});
after(async () => {
  await Promise.all([owner.end(), api.end(), worker.end()]);
});
test('scenario arithmetic handles cash purchases, zero interest, vacancy, growth and invalid inputs', () => {
  const result = calculateScenario({
    ...scenarioDefaults,
    purchase_price: 1200000,
    monthly_rent: 10000,
    acquisition_costs: 0,
    annual_expenses: 12000,
    deposit_percent: 100,
    vacancy_percent: 10,
  });
  assert.equal(result.loan_amount, 0);
  assert.equal(result.monthly_payment, 0);
  assert.equal(result.projection[0].cash_flow, 96000);
  assert.equal(result.gross_yield_percent, 10);
  assert.equal(result.net_yield_percent, 8);
  const zero = calculateScenario({
    ...scenarioDefaults,
    purchase_price: 1200000,
    deposit_percent: 0,
    acquisition_costs: 0,
    interest_percent: 0,
    loan_years: 10,
  });
  assert.equal(zero.monthly_payment, 10000);
  assert.equal(zero.cash_on_cash_percent, null);
  const tiny = calculateScenario({
    ...scenarioDefaults,
    purchase_price: 1200000,
    deposit_percent: 0,
    interest_percent: 1e-20,
    loan_years: 10,
  });
  assert.ok(Number.isFinite(tiny.monthly_payment));
  assert.ok(Math.abs(tiny.monthly_payment - 10000) < 0.000001);
  assert.equal(
    calculateScenario({ ...scenarioDefaults, monthly_rent: 0 }).break_even_occupancy_percent,
    null,
  );
  const growth = calculateScenario({
    ...scenarioDefaults,
    rent_growth_percent: 10,
    expense_growth_percent: 5,
  });
  assert.ok(
    Math.abs(growth.projection[1].gross_rent - growth.projection[0].gross_rent * 1.1) < 0.001,
  );
  for (const patch of [
    { vacancy_percent: 101 },
    { purchase_price: 0 },
    { interest_percent: -1 },
    { loan_years: 1.5 },
    { monthly_rent: NaN },
    { owner_id: 'attacker' },
  ])
    assert.throws(() => calculateScenario({ ...scenarioDefaults, ...patch }));
});
test('evidence history contains captured months only, honours source rights and rejects ambiguous filters', async () => {
  await benchmark('2026-08-31', 10000);
  const path = '/research/intelligence/evidence?county_ids=' + county;
  let response = await req(path);
  assert.equal(response.status, 200);
  let data = await response.json();
  assert.equal(data.series.length, 1);
  assert.ok(!JSON.stringify(data).includes('source_listing_id'));
  assert.equal((await req(path + '&as_of=2026-07')).status, 200);
  assert.equal((await (await req(path + '&as_of=2026-07')).json()).series.length, 0);
  assert.equal((await req(path + '&county_ids=' + county)).status, 400);
  assert.equal((await req(path + '&source_id=' + marketSource)).status, 400);
  assert.equal(
    (await req('/research/intelligence/evidence?county_ids=' + randomUUID())).status,
    400,
  );
  await owner.query('UPDATE atlas_control.sources SET publication_allowed=false WHERE id=$1', [
    marketSource,
  ]);
  assert.equal((await (await req(path)).json()).series.length, 0);
  await owner.query('UPDATE atlas_control.sources SET publication_allowed=true WHERE id=$1', [
    marketSource,
  ]);
});
test('private research freezes server-selected evidence and enforces owner isolation and payload limits', async () => {
  const path = '/workspace/research/items',
    body = {
      name: 'Private dated comparison',
      filters: { county_ids: [county], market_type: 'rent' },
      scenario: scenarioDefaults,
    };
  assert.equal((await req(path, undefined, body)).status, 401);
  assert.equal((await req(path, 'alice', { ...body, owner_id: bob })).status, 400);
  const response = await req(path, 'alice', body);
  assert.equal(response.status, 201);
  const saved = await response.json();
  assert.equal(saved.evidence.series.length, 1);
  assert.equal(saved.payload.version, 1);
  assert.equal((await req(path + '/' + saved.id, 'bob')).status, 404);
  assert.equal(
    (await (await req(path + '/' + saved.id, 'alice')).json()).evidence.series.length,
    1,
  );
  assert.ok(
    !Object.hasOwn((await (await req(path, 'alice')).json()).results[0].evidence, 'series'),
  );
  assert.equal((await (await req(path, 'bob')).json()).results.length, 0);
  assert.equal(
    (
      await transaction(
        api,
        (db) => db.query('SELECT id FROM public.atlas_research_items WHERE id=$1', [saved.id]),
        bob,
      )
    ).rowCount,
    0,
  );
  assert.equal((await req(path + '/' + saved.id, 'bob', undefined, 'DELETE')).status, 404);
  assert.equal((await req(path + '/' + saved.id, 'alice', undefined, 'DELETE')).status, 204);
});
test('watchlists produce idempotent owner-only in-app changes and never expose delivery capabilities', async () => {
  const path = '/workspace/research/watchlists',
    response = await req(path, 'alice', {
      name: 'Watch my county',
      county_id: county,
      market_type: 'rent',
      threshold_percent: 10,
      direction: 'up',
    });
  assert.equal(response.status, 201);
  const watch = await response.json();
  await assert.rejects(api.query('SELECT atlas_research.evaluate_watchlists()'), { code: '42501' });
  await assert.rejects(worker.query('SELECT * FROM public.atlas_watchlists'), { code: '42501' });
  await benchmark('2026-09-30', 12000);
  assert.ok((await worker.query('SELECT atlas_research.evaluate_watchlists() n')).rows[0].n >= 1);
  assert.equal((await worker.query('SELECT atlas_research.evaluate_watchlists() n')).rows[0].n, 0);
  const own = await (await req(path, 'alice')).json();
  assert.equal(own.external_delivery_enabled, false);
  assert.equal(own.delivery, 'in_app_only');
  assert.equal(own.alerts.length, 1);
  assert.equal(Number(own.alerts[0].change_percent), 20);
  assert.equal((await (await req(path, 'bob')).json()).alerts.length, 0);
  await owner.query("UPDATE atlas_control.sources SET status='revoked' WHERE id=$1", [
    marketSource,
  ]);
  assert.equal((await (await req(path, 'alice')).json()).alerts.length, 0);
  await owner.query("UPDATE atlas_control.sources SET status='active' WHERE id=$1", [marketSource]);
  assert.equal((await req(path + '/' + watch.id, 'bob', undefined, 'DELETE')).status, 404);
  assert.equal((await req(path + '/' + watch.id, 'alice', undefined, 'DELETE')).status, 204);
  assert.equal((await (await req(path, 'alice')).json()).alerts.length, 0);
});
test('public context is projected through rights-gated views; event history is immutable', async () => {
  await owner.query(
    "INSERT INTO atlas_research.amenities(source_id,source_key,county_id,name,category,latitude,longitude,source_url,retrieved_at,coverage) VALUES($1,'node:1',$2,'Synthetic hospital','hospital',-1.28,36.82,'https://www.openstreetmap.org/node/1',now(),'Synthetic point; no real-world coverage')",
    [contextSource, county],
  );
  await owner.query(
    "INSERT INTO atlas_research.project_events(source_id,project_key,county_id,name,category,status,evidence_date,summary,source_url,reviewed_by) VALUES($1,'fixture-project',$2,'Synthetic transport project','transport','proposed','2026-01-01','Isolated fixture, not actual construction.','https://example.test/official','test-owner')",
    [contextSource, county],
  );
  const amenity = await (await req('/research/intelligence/amenities?county_id=' + county)).json();
  assert.equal(amenity.results.length, 1);
  assert.equal(
    (await (await req('/research/intelligence/projects?county_id=' + county)).json()).results[0]
      .status,
    'proposed',
  );
  await assert.rejects(api.query('SELECT * FROM atlas_research.amenities'), { code: '42501' });
  await assert.rejects(worker.query('SELECT * FROM atlas_research.project_events'), {
    code: '42501',
  });
  await assert.rejects(
    owner.query("UPDATE atlas_research.project_events SET status='completed' WHERE source_id=$1", [
      contextSource,
    ]),
    /append-only/,
  );
  await owner.query("UPDATE atlas_control.sources SET status='revoked' WHERE id=$1", [
    contextSource,
  ]);
  assert.equal(
    (await (await req('/research/intelligence/amenities?county_id=' + county)).json()).results
      .length,
    0,
  );
  assert.equal(
    (await (await req('/research/intelligence/projects?county_id=' + county)).json()).results
      .length,
    0,
  );
});
test('liquidity suppresses sparse measurements and never publishes listing-level details', async () => {
  const path = '/research/intelligence/liquidity?county_ids=' + county;
  const response = await req(path);
  assert.equal(response.status, 200);
  const data = await response.json();
  assert.equal(data.minimum_sample, 30);
  assert.equal(data.results.length, 0);
  assert.ok(!JSON.stringify(data).includes('source_url'));
  assert.equal((await req(path + '&days=365')).status, 400);
  assert.equal((await req(path + '&market_type=short_let')).status, 400);
  assert.equal((await req('/listings')).status, 410);
  assert.equal((await req('/research/comparables?county_id=' + county)).status, 410);
  const feed = await source('manual_listings', 'listings');
  const j = (
    await owner.query(
      "INSERT INTO atlas_control.jobs(source_id,idempotency_key,requested_by,request_hash,status,finished_at) VALUES($1,$2,'fixture',$3,'succeeded',now()) RETURNING id",
      [feed, randomUUID(), 'b'.repeat(64)],
    )
  ).rows[0].id;
  const a = (
    await owner.query(
      'INSERT INTO atlas_control.artifacts(source_id,sha256,object_key,byte_length) VALUES($1,$2,$3,1) RETURNING id',
      [feed, 'c'.repeat(64), 'fixture/' + randomUUID()],
    )
  ).rows[0].id;
  async function add(index: number) {
    const id = (
      await owner.query(
        "INSERT INTO atlas_core.source_listings(source_id,source_listing_id,first_seen_at,last_seen_at) VALUES($1,$2,now()-interval '2 days',now()) RETURNING id",
        [feed, String(index)],
      )
    ).rows[0].id;
    for (const age of [2, 0])
      await owner.query(
        "INSERT INTO atlas_core.listing_observations(listing_id,job_id,artifact_id,content_hash,observed_at,source_url,listing_type,property_type,county_id,bedrooms,price_amount,currency,rent_period,availability,status_evidence) VALUES($1,$2,$3,$4,now()-make_interval(days=>$5),'https://example.test/fixture','rent','apartment',$6,2,$7,'KES','month',$8,'advertisement')",
        [
          id,
          j,
          a,
          randomUUID().replaceAll('-', '').repeat(2),
          age,
          county,
          age ? 20000 : 18000,
          index < 5 && age === 0 ? 'withdrawn' : 'active',
        ],
      );
  }
  for (let i = 0; i < 29; i++) await add(i);
  let metrics = (await (await req(path)).json()).results[0];
  assert.equal(metrics.sample_count, 29);
  assert.equal(metrics.newly_observed, null);
  assert.equal(metrics.latest_price_reductions, null);
  await add(29);
  metrics = (await (await req(path)).json()).results[0];
  assert.equal(metrics.sample_count, 30);
  assert.equal(metrics.newly_observed, 30);
  assert.equal(metrics.explicitly_withdrawn, 5);
  assert.equal(metrics.latest_price_reductions, 30);
  assert.ok(Math.abs(metrics.median_observed_days - 2) < 0.01);
});
