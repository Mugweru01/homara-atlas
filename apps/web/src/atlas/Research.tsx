import { useEffect, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Link, useSearchParams } from 'react-router-dom';
import { ArrowUpRight, Download } from 'lucide-react';
import { api, API_BASE, useCounties } from './data';
import { PageHeading, Loading, ErrorState, SectionTitle } from './primitives';
import { authClient } from '@/lib/neon';
import {
  initial,
  fields,
  clean,
  money,
  percent,
  month,
  download,
  type Evidence,
  type Filters,
  type Inputs,
  type Scenario,
} from './research-model';
import { Trend, SeriesTable } from './ResearchCharts';
import { Amenities, Projects, CollectionStatus } from './ResearchContext';
import Activity from './ResearchActivity';
import PrivateResearch from './ResearchSaved';
const tabs = [
  ['compare', 'Compare areas'],
  ['scenario', 'Investment scenarios'],
  ['history', 'Market history'],
  ['liquidity', 'Market activity'],
  ['amenities', 'Amenities'],
  ['projects', 'Infrastructure'],
  ['confidence', 'Data confidence'],
  ['saved', 'Saved research'],
] as const;
export default function Research() {
  const [params, setParams] = useSearchParams(),
    counties = useCounties(),
    tab = tabs.some((t) => t[0] === params.get('tab')) ? params.get('tab')! : 'compare';
  const defaultIds = (counties.data || [])
      .filter((c) => ['Nairobi', 'Kiambu', 'Mombasa'].includes(c.name))
      .map((c) => c.id),
    ids = params.has('counties')
      ? (params.get('counties') || '').split(',').filter(Boolean).slice(0, 4)
      : defaultIds;
  const market = ['rent', 'sale', 'short_let'].includes(params.get('market') || '')
      ? params.get('market')!
      : 'rent',
    asOf = params.get('month') || null;
  const focus = ids.includes(params.get('focus') || '')
    ? params.get('focus')!
    : ids.find((id) => counties.data?.find((c) => c.id === id)?.name === 'Nairobi') || ids[0];
  const [inputs, setInputs] = useState<Inputs>(initial),
    [scenario, setScenario] = useState<Scenario | null>(null),
    [calculating, setCalculating] = useState(false),
    [error, setError] = useState(''),
    [user, setUser] = useState<string | null>(null);
  useEffect(() => {
    let active = true;
    const sync = () => {
      authClient
        ?.getSession({ query: {} })
        .then(({ data }) => {
          if (active) setUser(data?.user.id || null);
        })
        .catch(() => {
          if (active) setUser(null);
        });
    };
    sync();
    window.addEventListener('focus', sync);
    return () => {
      active = false;
      window.removeEventListener('focus', sync);
    };
  }, []);
  const update = (values: Record<string, string | null>) => {
    const next = new URLSearchParams(params);
    for (const [key, value] of Object.entries(values)) {
      if (value === null) next.delete(key);
      else next.set(key, value);
    }
    setParams(next);
  };
  const evidence = useQuery({
    queryKey: ['atlas', 'research-evidence', ids.join(','), market],
    enabled: ids.length > 0,
    queryFn: ({ signal }) =>
      api<Evidence>(
        '/research/intelligence/evidence?county_ids=' + ids.join(',') + '&market_type=' + market,
        signal
      ),
  });
  const periods = [
      ...new Set((evidence.data?.series || []).map((s) => month(s.period_end))),
    ].sort(),
    selectedMonth = asOf || periods.at(-1) || '',
    available = (evidence.data?.series || []).filter(
      (s) => !selectedMonth || month(s.period_end) <= selectedMonth
    );
  const latest = available.filter(
    (s, i, a) => a.findIndex((r) => r.geography === s.geography && r.slug === s.slug) === i
  );
  async function calculate(event: React.FormEvent) {
    event.preventDefault();
    setCalculating(true);
    setError('');
    try {
      const r = await fetch(API_BASE + '/api/v1/research/intelligence/scenario', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'omit',
        body: JSON.stringify(inputs),
        signal: AbortSignal.timeout(20000),
      });
      if (!r.ok)
        throw Error(
          r.status === 429
            ? 'Please wait a minute before calculating again.'
            : 'Check the scenario inputs and try again.'
        );
      setScenario(await r.json());
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Calculation unavailable');
    } finally {
      setCalculating(false);
    }
  }
  const filters: Filters = {
    county_ids: focus ? [focus, ...ids.filter((id) => id !== focus)] : ids,
    market_type: market,
    as_of: asOf,
  };
  return (
    <>
      <PageHeading
        eyebrow="Research studio"
        title="Understand a place. Test an idea."
        description="Compare the evidence, explore the context and keep your assumptions visible. Aggregated research, never a property-advert directory."
      >
        <button
          className="button secondary"
          disabled={!evidence.data}
          onClick={() =>
            download('atlas-research-evidence.json', {
              ...evidence.data,
              selected_reference_month: selectedMonth,
            })
          }
        >
          <Download size={16} /> Export evidence
        </button>
      </PageHeading>
      <nav className="research-tabs" aria-label="Research tools">
        {tabs.map(([id, label]) => (
          <button
            key={id}
            aria-current={tab === id ? 'page' : undefined}
            onClick={() => update({ tab: id })}
          >
            {label}
          </button>
        ))}
      </nav>
      {counties.isError ? (
        <ErrorState message={counties.error.message} />
      ) : counties.isPending ? (
        <Loading />
      ) : (
        <div className="research-controls">
          <fieldset>
            <legend>Compare up to four counties</legend>
            <details className="research-county-picker">
              <summary>
                {(counties.data || [])
                  .filter((c) => ids.includes(c.id))
                  .map((c) => c.reference_name || c.name)
                  .join(' · ')}{' '}
                · Change counties
              </summary>
              <div className="research-counties">
                {(counties.data || []).map((c) => (
                  <label key={c.id}>
                    <input
                      type="checkbox"
                      checked={ids.includes(c.id)}
                      disabled={
                        (!ids.includes(c.id) && ids.length >= 4) ||
                        (ids.length === 1 && ids.includes(c.id))
                      }
                      onChange={() =>
                        update({
                          counties: (ids.includes(c.id)
                            ? ids.filter((id) => id !== c.id)
                            : [...ids, c.id]
                          ).join(','),
                          month: null,
                        })
                      }
                    />
                    {c.reference_name || c.name}
                  </label>
                ))}
              </div>
            </details>
          </fieldset>
          <label className="select-label">
            Focus county
            <select
              aria-label="Focus county"
              value={focus || ''}
              onChange={(e) => update({ focus: e.target.value })}
            >
              {(counties.data || [])
                .filter((c) => ids.includes(c.id))
                .map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.reference_name || c.name}
                  </option>
                ))}
            </select>
          </label>
          <label className="select-label">
            Market
            <select
              value={market}
              onChange={(e) => update({ market: e.target.value, month: null })}
            >
              <option value="rent">Monthly rent</option>
              <option value="sale">Sale asking prices</option>
              <option value="short_let">Short-let nightly rates</option>
            </select>
          </label>
        </div>
      )}
      {error && <ErrorState message={error} />}{' '}
      {evidence.isError && (
        <ErrorState message={evidence.error.message} retry={() => void evidence.refetch()} />
      )}
      {evidence.isPending && ids.length > 0 && tab !== 'scenario' && (
        <Loading label="Loading research evidence" />
      )}
      {tab === 'compare' && evidence.data && (
        <section className="research-section">
          <SectionTitle
            title="The same questions, side by side"
            detail="Broad publisher populations are not matched property segments. Compare reference months, samples and the publisher methodology before drawing conclusions."
          />
          <div className="table-scroll">
            <table className="research-table">
              <caption>Selected county research comparison</caption>
              <thead>
                <tr>
                  <th>Evidence</th>
                  {evidence.data.counties.map((c) => (
                    <th key={c.id}>{c.reference_name || c.name}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                <tr>
                  <th>Publisher median asking figure</th>
                  {evidence.data.counties.map((c) => {
                    const r = latest.find(
                      (r) => clean(r.geography) === clean(c.reference_name || c.name)
                    );
                    return (
                      <td key={c.id}>
                        <strong className="research-number">{money(r?.median_price)}</strong>
                        {r && (
                          <>
                            <small>
                              {market === 'rent'
                                ? 'per month'
                                : market === 'short_let'
                                  ? 'per night'
                                  : 'sale'}{' '}
                              · {month(r.period_end)}
                            </small>
                            <a href={r.source_url} target="_blank" rel="noreferrer">
                              Publisher report <ArrowUpRight size={12} />
                            </a>
                          </>
                        )}
                      </td>
                    );
                  })}
                </tr>
                <tr>
                  <th>Publisher sample</th>
                  {evidence.data.counties.map((c) => {
                    const r = latest.find(
                      (r) => clean(r.geography) === clean(c.reference_name || c.name)
                    );
                    return <td key={c.id}>{r?.sample_count ?? 'Not supplied / no series'}</td>;
                  })}
                </tr>
                <tr>
                  <th>Former province</th>
                  {evidence.data.counties.map((c) => (
                    <td key={c.id}>{c.metadata?.region || 'Not recorded'}</td>
                  ))}
                </tr>
                <tr>
                  <th>Population · 2019 census</th>
                  {evidence.data.counties.map((c) => (
                    <td key={c.id}>
                      {c.metadata?.population_2019?.toLocaleString() || 'Not recorded'}
                    </td>
                  ))}
                </tr>
                <tr>
                  <th>Mapped amenity coverage</th>
                  {evidence.data.counties.map((c) => {
                    const a = evidence.data!.amenities.filter((a) => a.county_id === c.id);
                    return (
                      <td key={c.id}>
                        {a.length
                          ? a.reduce((s, a) => s + a.count, 0) + ' mapped reference points'
                          : 'Not captured'}
                        <small>Not a service-quality score</small>
                      </td>
                    );
                  })}
                </tr>
              </tbody>
            </table>
          </div>
          <p className="research-note">
            A county-wide asking figure is not a valuation of a particular property. No investment
            league table is inferred from incomplete evidence. County reference: kenya-locations by
            David Amunga and contributors, CC BY 4.0.
          </p>
        </section>
      )}
      {tab === 'scenario' && (
        <section className="research-section">
          <SectionTitle
            title="Your assumptions. The arithmetic."
            detail="Illustrative starting inputs are editable assumptions, not observed market averages. Enter all applicable costs; this calculator does not supply tax or lending advice."
          />
          <form onSubmit={calculate}>
            <div className="scenario-fields">
              {(Object.keys(fields) as (keyof Inputs)[]).map((key) => (
                <label key={key}>
                  {fields[key]}
                  <input
                    type="number"
                    required
                    step={key === 'loan_years' ? 1 : 'any'}
                    value={Number.isNaN(inputs[key]) ? '' : inputs[key]}
                    onChange={(e) => {
                      setInputs({
                        ...inputs,
                        [key]: e.target.value === '' ? NaN : Number(e.target.value),
                      });
                      setScenario(null);
                    }}
                  />
                </label>
              ))}
            </div>
            <button className="button primary" disabled={calculating}>
              {calculating ? 'Calculating…' : 'Calculate scenario'}
            </button>
          </form>
          {scenario && (
            <>
              <div className="scenario-results">
                {[
                  ['Gross yield', percent(scenario.gross_yield_percent)],
                  ['Net operating yield', percent(scenario.net_yield_percent)],
                  ['Cash-on-cash · year one', percent(scenario.cash_on_cash_percent)],
                  ['Monthly loan payment', money(scenario.monthly_payment)],
                  ['Cash required', money(scenario.cash_required)],
                  ['Break-even occupancy', percent(scenario.break_even_occupancy_percent)],
                ].map(([label, value]) => (
                  <div key={label}>
                    <span>{label}</span>
                    <strong>{value}</strong>
                  </div>
                ))}
              </div>
              <Trend
                label="Ten-year nominal cash flow under your assumptions"
                points={scenario.projection.map((p) => ({
                  label: 'Y' + p.year,
                  value: p.cash_flow,
                }))}
              />
              <div className="table-scroll">
                <table>
                  <caption>Scenario cash flow, nominal KES</caption>
                  <thead>
                    <tr>
                      <th>Year</th>
                      <th>Gross rent</th>
                      <th>Operating expenses</th>
                      <th>Debt service</th>
                      <th>Cash flow</th>
                    </tr>
                  </thead>
                  <tbody>
                    {scenario.projection.map((p) => (
                      <tr key={p.year}>
                        <td>{p.year}</td>
                        <td>{money(p.gross_rent)}</td>
                        <td>{money(p.expenses)}</td>
                        <td>{money(p.debt_service)}</td>
                        <td>{money(p.cash_flow)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <p className="research-note">{scenario.notice}</p>
              <button
                className="button secondary"
                onClick={() =>
                  download('atlas-scenario.json', {
                    calculated_at: new Date().toISOString(),
                    ...scenario,
                    inputs,
                  })
                }
              >
                <Download size={16} /> Export scenario
              </button>
            </>
          )}
        </section>
      )}
      {tab === 'history' && evidence.data && (
        <section className="research-section">
          <SectionTitle
            title="History we can substantiate"
            detail="Move through captured reference months. A single month is a snapshot, not a trend; collection dates and publisher reference months remain distinct."
          />
          {periods.length > 0 ? (
            <>
              <label className="research-slider">
                Reference month: <strong>{selectedMonth}</strong>
                <input
                  aria-label="Market history reference month"
                  type="range"
                  min="0"
                  max={Math.max(0, periods.length - 1)}
                  value={Math.max(0, periods.indexOf(selectedMonth))}
                  disabled={periods.length < 2}
                  onChange={(e) => update({ month: periods[Number(e.target.value)] })}
                />
              </label>
              {evidence.data.counties.map((c) => {
                const points = available
                  .filter((r) => clean(r.geography) === clean(c.reference_name || c.name))
                  .reverse();
                return (
                  <div className="research-history" key={c.id}>
                    <h3>{c.reference_name || c.name}</h3>
                    <Trend
                      label={`${c.name} captured ${market} asking figures`}
                      points={points.map((s) => ({
                        label: month(s.period_end),
                        value: Number(s.median_price),
                      }))}
                    />
                  </div>
                );
              })}
              <SeriesTable rows={available} />
            </>
          ) : (
            <p className="research-empty">No captured reference months match this selection.</p>
          )}
        </section>
      )}
      {tab === 'liquidity' && ids.length > 0 && <Activity ids={ids} market={market} />}
      {tab === 'amenities' && focus && (
        <Amenities
          county={focus}
          name={counties.data?.find((c) => c.id === focus)?.name || 'Selected county'}
        />
      )}
      {tab === 'projects' && focus && (
        <Projects
          county={focus}
          name={counties.data?.find((c) => c.id === focus)?.name || 'Selected county'}
        />
      )}
      {tab === 'confidence' && evidence.data && (
        <section className="research-section">
          <SectionTitle
            title="Know how much weight a figure can carry"
            detail="Coverage indicators describe the evidence. They are not a probability of investment success or an assurance of statistical representativeness."
          />
          <div className="research-quality">
            {evidence.data.counties.map((c) => {
              const rows = latest.filter(
                  (r) => clean(r.geography) === clean(c.reference_name || c.name)
                ),
                sources = new Set(rows.map((r) => r.slug)),
                months = new Set(
                  available
                    .filter((r) => clean(r.geography) === clean(c.reference_name || c.name))
                    .map((r) => month(r.period_end))
                );
              return (
                <article key={c.id}>
                  <h3>{c.reference_name || c.name}</h3>
                  <dl>
                    <dt>Publisher coverage</dt>
                    <dd>
                      {sources.size
                        ? `${sources.size} captured source feed${sources.size === 1 ? '' : 's'}`
                        : 'No permitted series captured'}
                    </dd>
                    <dt>Source concentration</dt>
                    <dd>
                      {sources.size === 1
                        ? '100% from one publisher'
                        : 'Inspect source records; no weighted concentration estimate'}
                    </dd>
                    <dt>Captured reference months</dt>
                    <dd>{months.size}</dd>
                    <dt>Sample visibility</dt>
                    <dd>
                      {rows.length
                        ? rows
                            .map((r) =>
                              r.sample_count === null
                                ? 'Not supplied'
                                : `${r.sample_count} advertisements${r.sample_count < 100 ? ' · small publisher sample' : ''}`
                            )
                            .join('; ')
                        : 'Unavailable'}
                    </dd>
                    <dt>Refresh status</dt>
                    <dd>
                      {rows.some((r) => r.collection_paused)
                        ? 'Paused: approved automated access needed'
                        : rows.some((r) => r.collection_old)
                          ? 'Old collection; inspect source'
                          : 'See dated source evidence'}
                    </dd>
                  </dl>
                </article>
              );
            })}
          </div>
          <SeriesTable rows={latest} />
          <CollectionStatus />
          <p className="research-note">{evidence.data.notice}</p>
        </section>
      )}
      {(tab === 'saved' || tab === 'scenario' || tab === 'compare') && (
        <section className="research-section research-private">
          <SectionTitle
            title="Keep the reasoning with the result"
            detail="Save a dated comparison and your scenario assumptions to a private account. Export a research brief or print it to PDF. External alert delivery remains disabled."
          />
          {user ? (
            <PrivateResearch
              key={user}
              userId={user}
              filters={filters}
              inputs={inputs}
              ready={!!evidence.data}
            />
          ) : (
            <p>
              <Link className="button primary" to="/workspace">
                Sign in to save research and watchlists
              </Link>
            </p>
          )}
        </section>
      )}
      <p className="research-note">
        Atlas presents asking-market research and documented context. No Homara observations,
        advertiser identities, contacts, photos or individual advertisements appear here.{' '}
        <Link to="/sources">Sources and limitations</Link>
      </p>
    </>
  );
}
