import { useEffect, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { ArrowUpRight, Download } from 'lucide-react';
import { api, date } from './data';
import { Loading, ErrorState, SectionTitle } from './primitives';
import { download, type Amenity } from './research-model';
export function Amenities({ county, name }: { county: string; name: string }) {
  const [category, setCategory] = useState(''),
    [offset, setOffset] = useState(0),
    [selected, setSelected] = useState(''),
    [lat, setLat] = useState('-1.2864'),
    [lon, setLon] = useState('36.8172'),
    [error, setError] = useState('');
  useEffect(() => {
    setOffset(0);
    setSelected('');
  }, [county, category]);
  const q = useQuery({
      queryKey: ['atlas', 'amenities', county, category, offset],
      queryFn: ({ signal }) =>
        api<{ results: Amenity[]; has_more: boolean; notice: string }>(
          '/research/intelligence/amenities?county_id=' +
            county +
            '&limit=100&offset=' +
            offset +
            (category ? '&category=' + category : ''),
          signal
        ),
    }),
    rows = q.data?.results || [];
  const bounds = rows.length
    ? [
        Math.min(...rows.map((r) => r.longitude)) - 0.005,
        Math.min(...rows.map((r) => r.latitude)) - 0.005,
        Math.max(...rows.map((r) => r.longitude)) + 0.005,
        Math.max(...rows.map((r) => r.latitude)) + 0.005,
      ]
    : [36.75, -1.33, 36.9, -1.25];
  const valid =
    lat.trim() !== '' &&
    lon.trim() !== '' &&
    Number.isFinite(Number(lat)) &&
    Number.isFinite(Number(lon)) &&
    Number(lat) >= -4.8 &&
    Number(lat) <= 5.6 &&
    Number(lon) >= 33.8 &&
    Number(lon) <= 42;
  const distance = (r: Amenity) => {
    const rad = Math.PI / 180,
      a =
        Math.sin(((r.latitude - Number(lat)) * rad) / 2) ** 2 +
        Math.cos(Number(lat) * rad) *
          Math.cos(r.latitude * rad) *
          Math.sin(((r.longitude - Number(lon)) * rad) / 2) ** 2;
    return 6371 * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(Math.max(0, 1 - a)));
  };
  return (
    <section className="research-section">
      <SectionTitle
        title={'Amenities around ' + name}
        detail="A tile-free coordinate map of captured public amenities for the focus county. Dataset coverage and classifications are explicitly limited."
      />
      <div className="filter-bar">
        <label className="select-label">
          Category
          <select value={category} onChange={(e) => setCategory(e.target.value)}>
            <option value="">All captured amenities</option>
            {[
              'school',
              'college',
              'university',
              'hospital',
              'clinic',
              'bus_station',
              'marketplace',
              'supermarket',
            ].map((c) => (
              <option key={c} value={c}>
                {c.replace('_', ' ')}
              </option>
            ))}
          </select>
        </label>
        <button
          className="button secondary"
          onClick={async () => {
            setError('');
            try {
              download(
                'atlas-amenities-open-data.json',
                await api('/research/intelligence/amenities/export?county_id=' + county)
              );
            } catch {
              setError('The public amenity extract could not be exported.');
            }
          }}
        >
          <Download size={16} /> Download open-data extract
        </button>
      </div>
      {error && <ErrorState message={error} />}{' '}
      {q.isPending ? (
        <Loading />
      ) : q.isError ? (
        <ErrorState message={q.error.message} />
      ) : rows.length ? (
        <>
          <div className="amenity-map">
            <svg
              viewBox="0 0 800 400"
              role="group"
              aria-label={'Captured amenity points in ' + name}
            >
              {[80, 160, 240, 320].map((y) => (
                <path key={y} d={`M20 ${y}H780`} stroke="#d5dfd9" />
              ))}
              {rows.map((r) => (
                <circle
                  key={r.id}
                  cx={30 + ((r.longitude - bounds[0]) / (bounds[2] - bounds[0])) * 740}
                  cy={370 - ((r.latitude - bounds[1]) / (bounds[3] - bounds[1])) * 340}
                  r={selected === r.id ? 8 : 5}
                  fill={selected === r.id ? '#b48a3c' : '#0e4a34'}
                  role="button"
                  tabIndex={0}
                  aria-label={r.name + ' · ' + r.category}
                  aria-pressed={selected === r.id}
                  onClick={() => setSelected(r.id)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' || e.key === ' ') {
                      e.preventDefault();
                      setSelected(r.id);
                    }
                  }}
                >
                  <title>{r.name}</title>
                </circle>
              ))}
              <text x="25" y="395">
                {bounds[0].toFixed(3)}° E
              </text>
              <text x="700" y="395">
                {bounds[2].toFixed(3)}° E
              </text>
              <text x="25" y="20">
                North ↑ · Latitude/longitude sketch, not a street or routing map
              </text>
            </svg>
          </div>
          <p className="research-note">
            {rows[0]?.coverage} Map shows the {rows.length} points on this page.{' '}
            {[...new Set(rows.map((r) => r.attribution))].join(' · ')}{' '}
            {rows.some((r) => r.license === 'CC BY 4.0') && (
              <a
                href="https://creativecommons.org/licenses/by/4.0/"
                target="_blank"
                rel="noreferrer"
              >
                GeoNames · CC BY 4.0
              </a>
            )}
            {rows.some((r) => r.license === 'ODbL-1.0') && (
              <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noreferrer">
                OpenStreetMap contributors · ODbL 1.0
              </a>
            )}
          </p>
          <div className="filter-bar">
            <label>
              Reference latitude
              <input
                aria-label="Reference latitude"
                type="number"
                step="any"
                value={lat}
                onChange={(e) => setLat(e.target.value)}
              />
            </label>
            <label>
              Reference longitude
              <input
                aria-label="Reference longitude"
                type="number"
                step="any"
                value={lon}
                onChange={(e) => setLon(e.target.value)}
              />
            </label>
            <p>
              Reference inputs stay in your browser. Distances are straight-line, not travel times.
            </p>
          </div>
          {!valid && (
            <p role="alert">Enter valid coordinates within Kenya to calculate proximity.</p>
          )}
          <div className="table-scroll">
            <table>
              <caption>Captured amenities on this page</caption>
              <thead>
                <tr>
                  <th>Amenity</th>
                  <th>Category</th>
                  <th>Distance from reference</th>
                  <th>Source</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((r) => (
                  <tr key={r.id} className={selected === r.id ? 'research-selected' : ''}>
                    <td>
                      <button className="text-link" onClick={() => setSelected(r.id)}>
                        {r.name}
                      </button>
                    </td>
                    <td>{r.category.replace('_', ' ')}</td>
                    <td>{valid ? distance(r).toFixed(2) + ' km' : 'Invalid reference'}</td>
                    <td>
                      <a href={r.source_url} target="_blank" rel="noreferrer">
                        Source feature
                      </a>
                      <small>Captured {date(r.retrieved_at)}</small>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="research-pagination">
            <button
              className="button secondary"
              disabled={offset === 0}
              onClick={() => setOffset(Math.max(0, offset - 100))}
            >
              Previous
            </button>
            <button
              className="button secondary"
              disabled={!q.data?.has_more}
              onClick={() => setOffset(offset + 100)}
            >
              Next
            </button>
          </div>
        </>
      ) : (
        <p className="research-empty">
          No reviewed amenity extract has been captured for this county/category. This does not mean
          amenities are absent. Only reviewed, licensed facility references are included; no
          substitute points are invented to fill a coverage gap.
        </p>
      )}
      <p className="research-note">{q.data?.notice}</p>
    </section>
  );
}
export function Projects({ county, name }: { county: string; name: string }) {
  const q = useQuery({
    queryKey: ['atlas', 'projects', county],
    queryFn: ({ signal }) =>
      api<{
        results: {
          project_key: string;
          name: string;
          category: string;
          status: string;
          evidence_date: string;
          summary: string;
          source_url: string;
          reviewed_at: string;
          attribution: string;
        }[];
        notice: string;
      }>('/research/intelligence/projects?county_id=' + county, signal),
  });
  return (
    <section className="research-section">
      <SectionTitle
        title={'Infrastructure evidence · ' + name}
        detail="Documented milestones for the focus county, in date order. An approval or funding announcement is not a completion certificate."
      />
      {q.isPending ? (
        <Loading />
      ) : q.isError ? (
        <ErrorState message={q.error.message} />
      ) : q.data?.results.length ? (
        <ol className="project-timeline">
          {q.data.results.map((p, i) => (
            <li key={p.project_key + p.evidence_date + i}>
              <time>{date(p.evidence_date)}</time>
              <div>
                <span className="research-label">
                  {p.status.replace('_', ' ')} · {p.category}
                </span>
                <h3>{p.name}</h3>
                <p>{p.summary}</p>
                <a href={p.source_url} target="_blank" rel="noreferrer">
                  Official evidence <ArrowUpRight size={13} />
                </a>
                <small>
                  Reviewed {date(p.reviewed_at)} · {p.attribution}
                </small>
              </div>
            </li>
          ))}
        </ol>
      ) : (
        <p className="research-empty">
          No reviewed project milestones for this county yet. No conclusion about infrastructure
          coverage or future price appreciation is implied.
        </p>
      )}
      <p className="research-note">{q.data?.notice}</p>
    </section>
  );
}
export function CollectionStatus() {
  const q = useQuery({
    queryKey: ['atlas', 'collection-status'],
    queryFn: ({ signal }) =>
      api<{
        collectors: {
          slug: string;
          name: string;
          last_job_status: string;
          error_code: string | null;
          last_success_at: string | null;
        }[];
        reviews: { slug: string; name: string; reason: string }[];
      }>('/collection/sources', signal),
  });
  return (
    <div className="research-section">
      <h3>Collection and access status</h3>
      {q.isPending ? (
        <Loading />
      ) : q.isError ? (
        <ErrorState message={q.error.message} />
      ) : (
        <>
          {q.data?.collectors.map((c) => (
            <p key={c.slug}>
              <strong>{c.name}</strong> ·{' '}
              {c.last_job_status === 'blocked' ? 'Collection paused' : c.last_job_status} · Last
              successful capture: {date(c.last_success_at)}
              {c.error_code === 'upstream_http_403' ? ' · Provider denied automated access' : ''}
            </p>
          ))}
          <details>
            <summary>Reviewed source restrictions</summary>
            {q.data?.reviews.map((r) => (
              <p key={r.slug}>
                <strong>{r.name}</strong> — {r.reason}
              </p>
            ))}
          </details>
        </>
      )}
    </div>
  );
}
