import { useEffect, useState } from 'react';
import { Download, Printer, Save, Trash2 } from 'lucide-react';
import { workspaceRequest } from '@/lib/neon';
import { date } from './data';
import { ErrorState } from './primitives';
import { fields, month, download, type Saved, type Filters, type Inputs } from './research-model';
import { SeriesTable } from './ResearchCharts';
type SavedSummary = Omit<Saved, 'evidence'> & {
  evidence: Pick<Saved['evidence'], 'counties' | 'captured_at'>;
};
export default function PrivateResearch({
  userId,
  filters,
  inputs,
  ready,
}: {
  userId: string;
  filters: Filters;
  inputs: Inputs;
  ready: boolean;
}) {
  const [items, setItems] = useState<SavedSummary[]>([]),
    [watches, setWatches] = useState<
      {
        id: string;
        name: string;
        geography: string;
        market_type: string;
        threshold_percent: string;
        direction: string;
      }[]
    >([]),
    [alerts, setAlerts] = useState<
      {
        id: string;
        geography: string;
        market_type: string;
        period_end: string;
        change_percent: string;
      }[]
    >([]),
    [name, setName] = useState(''),
    [threshold, setThreshold] = useState(5),
    [direction, setDirection] = useState('either'),
    [includeScenario, setIncludeScenario] = useState(false),
    [error, setError] = useState(''),
    [notice, setNotice] = useState(''),
    [busy, setBusy] = useState(false),
    [brief, setBrief] = useState<Saved | null>(null),
    [confirm, setConfirm] = useState('');
  const request = (path: string, init?: RequestInit) =>
    workspaceRequest('/research' + path, init, userId);
  async function loadItem(id: string, exportFile = false) {
    setBusy(true);
    setError('');
    try {
      const item = await request('/items/' + id);
      if (exportFile) download('atlas-private-research.json', item);
      else setBrief(item);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'The research brief could not be loaded.');
    } finally {
      setBusy(false);
    }
  }
  async function reload() {
    const [saved, watch] = await Promise.all([request('/items'), request('/watchlists')]);
    setItems(saved.results);
    setWatches(watch.results);
    setAlerts(watch.alerts);
  }
  useEffect(() => {
    let active = true;
    Promise.all([
      workspaceRequest('/research/items', undefined, userId),
      workspaceRequest('/research/watchlists', undefined, userId),
    ])
      .then(([saved, watch]) => {
        if (active) {
          setItems(saved.results);
          setWatches(watch.results);
          setAlerts(watch.alerts);
        }
      })
      .catch((e) => {
        if (active) setError(e.message);
      });
    return () => {
      active = false;
    };
  }, [userId]);
  async function action(fn: () => Promise<unknown>, message: string) {
    setBusy(true);
    setError('');
    setNotice('');
    try {
      await fn();
      await reload();
      setNotice(message);
      setConfirm('');
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Research could not be saved.');
    } finally {
      setBusy(false);
    }
  }
  return (
    <>
      <div className="research-save-controls">
        <label>
          Research name
          <input
            maxLength={120}
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="My area comparison"
          />
        </label>
        <label className="research-checkbox">
          <input
            type="checkbox"
            checked={includeScenario}
            onChange={(e) => setIncludeScenario(e.target.checked)}
          />{' '}
          Include my scenario assumptions
        </label>
        <button
          className="button primary"
          disabled={busy || !ready || !name.trim()}
          onClick={() =>
            void action(
              () =>
                request('/items', {
                  method: 'POST',
                  body: JSON.stringify({
                    name,
                    filters,
                    scenario: includeScenario ? inputs : null,
                  }),
                }),
              'Dated research snapshot saved privately.'
            )
          }
        >
          <Save size={16} /> Save dated research
        </button>
      </div>
      {error && <ErrorState message={error} />} {notice && <p role="status">{notice}</p>}
      <div className="research-saved-list">
        {items.map((item) => (
          <article key={item.id}>
            <div>
              <h3>{item.name}</h3>
              <small>
                Saved {date(item.created_at)} ·{' '}
                {item.evidence.counties.map((c) => c.reference_name || c.name).join(', ')}
              </small>
            </div>
            <div className="research-actions">
              <button
                className="button secondary"
                disabled={busy}
                onClick={() => void loadItem(item.id)}
              >
                Open brief
              </button>
              <button
                className="icon-button"
                aria-label={'Export ' + item.name}
                disabled={busy}
                onClick={() => void loadItem(item.id, true)}
              >
                <Download size={17} />
              </button>
              {confirm === item.id ? (
                <>
                  <button
                    className="button secondary"
                    disabled={busy}
                    onClick={() =>
                      void action(
                        () => request('/items/' + item.id, { method: 'DELETE' }),
                        'Saved research deleted.'
                      )
                    }
                  >
                    Confirm delete
                  </button>
                  <button className="button secondary" onClick={() => setConfirm('')}>
                    Cancel
                  </button>
                </>
              ) : (
                <button
                  className="icon-button"
                  aria-label={'Delete ' + item.name}
                  onClick={() => setConfirm(item.id)}
                >
                  <Trash2 size={17} />
                </button>
              )}
            </div>
          </article>
        ))}
        {!items.length && (
          <p>
            No saved research yet. A saved brief freezes its source evidence and assumptions; it is
            not a live forecast.
          </p>
        )}
      </div>
      <h3>Watch a location</h3>
      <p>
        Watch the focus county and market for future captured month-on-month publisher changes.
        In-app notifications only; no email, SMS or webhook delivery. A paused source cannot produce
        fresh alerts.
      </p>
      <div className="filter-bar">
        <label>
          Change threshold · %
          <input
            type="number"
            min="0.1"
            max="100"
            step="0.1"
            value={threshold}
            onChange={(e) => setThreshold(Number(e.target.value))}
          />
        </label>
        <label className="select-label">
          Direction
          <select value={direction} onChange={(e) => setDirection(e.target.value)}>
            <option value="either">Either</option>
            <option value="up">Increase</option>
            <option value="down">Decrease</option>
          </select>
        </label>
        <button
          className="button secondary"
          disabled={busy || !filters.county_ids.length || !name.trim()}
          onClick={() =>
            void action(
              () =>
                request('/watchlists', {
                  method: 'POST',
                  body: JSON.stringify({
                    name,
                    county_id: filters.county_ids[0],
                    market_type: filters.market_type,
                    threshold_percent: threshold,
                    direction,
                  }),
                }),
              'Private watchlist saved. External delivery stays disabled.'
            )
          }
        >
          Create watchlist
        </button>
      </div>
      {watches.map((w) => (
        <div className="research-watch" key={w.id}>
          <span>
            <strong>{w.name}</strong> · {w.geography} · {w.market_type} · {w.direction} ≥{' '}
            {w.threshold_percent}%
          </span>
          {confirm === w.id ? (
            <>
              <button
                className="button secondary"
                disabled={busy}
                onClick={() =>
                  void action(
                    () => request('/watchlists/' + w.id, { method: 'DELETE' }),
                    'Watchlist and its notifications deleted.'
                  )
                }
              >
                Confirm delete
              </button>
              <button className="button secondary" onClick={() => setConfirm('')}>
                Cancel
              </button>
            </>
          ) : (
            <button
              className="icon-button"
              aria-label={'Delete watchlist ' + w.name}
              onClick={() => setConfirm(w.id)}
            >
              <Trash2 size={16} />
            </button>
          )}
        </div>
      ))}
      <h3>Change notifications</h3>
      {alerts.length ? (
        <ul>
          {alerts.map((a) => (
            <li key={a.id}>
              {a.geography} · {a.market_type} · {month(a.period_end)}:{' '}
              {Number(a.change_percent).toFixed(2)}% publisher asking-figure change. This is not a
              recommended trade.
            </li>
          ))}
        </ul>
      ) : (
        <p>
          No qualifying new captured changes. Notifications are retained for 90 days, up to 200 per
          account.
        </p>
      )}
      {brief && (
        <section className="research-brief">
          <div className="research-actions">
            <button className="button primary" onClick={() => window.print()}>
              <Printer size={16} /> Print / save PDF
            </button>
            <button className="button secondary" onClick={() => setBrief(null)}>
              Close brief
            </button>
          </div>
          <div className="research-print">
            <p className="eyebrow">Homara Atlas · private research brief</p>
            <h2>{brief.name}</h2>
            <p>
              Saved {new Date(brief.created_at).toISOString()} · Evidence captured{' '}
              {brief.evidence.captured_at} · Market: {brief.payload.filters.market_type}
            </p>
            <p>
              Counties: {brief.evidence.counties.map((c) => c.reference_name || c.name).join(', ')}.
              Reference cutoff: {brief.payload.filters.as_of || 'latest captured at save time'}.
            </p>
            <SeriesTable rows={brief.evidence.series} />
            {brief.payload.scenario && (
              <>
                <h3>User-entered scenario assumptions</h3>
                <dl className="brief-assumptions">
                  {(Object.keys(fields) as (keyof Inputs)[]).map((key) => (
                    <div key={key}>
                      <dt>{fields[key]}</dt>
                      <dd>{brief.payload.scenario![key].toLocaleString()}</dd>
                    </div>
                  ))}
                </dl>
                <p>
                  No appreciation, sale proceeds or automatic tax calculation. This saved brief
                  records assumptions; run the scenario calculator to inspect cash flow.
                </p>
              </>
            )}
            <p>{brief.evidence.notice}</p>
            <p>
              Source attribution:{' '}
              {[...new Set(brief.evidence.series.map((s) => s.attribution))].join(' · ')}.
              Collection and source rights may have changed since this private snapshot. Verify
              current evidence before acting. Asking figures are not achieved transactions or
              investment advice.
            </p>
          </div>
        </section>
      )}
    </>
  );
}
