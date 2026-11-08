import { money, month, type Series } from './research-model';
import { date } from './data';
export function Trend({
  points,
  label,
}: {
  points: { label: string; value: number }[];
  label: string;
}) {
  if (!points.length)
    return <p className="research-empty">No captured observations for this view.</p>;
  const low = Math.min(0, ...points.map((p) => p.value)),
    high = Math.max(1, ...points.map((p) => p.value)),
    height = 220,
    width = 760;
  const xy = (p: (typeof points)[number], i: number) => [
    50 + (points.length === 1 ? 330 : (i / (points.length - 1)) * 660),
    25 + ((high - p.value) / (high - low)) * 150,
  ];
  return (
    <figure className="research-chart">
      <svg viewBox={`0 0 ${width} ${height}`} role="img" aria-label={label}>
        <title>{label}</title>
        <path d="M50 25V175H710" fill="none" stroke="currentColor" opacity=".25" />
        {points.length > 1 && (
          <polyline
            points={points.map((p, i) => xy(p, i).join(',')).join(' ')}
            fill="none"
            stroke="#0e4a34"
            strokeWidth="3"
          />
        )}
        {points.map((p, i) => {
          const [x, y] = xy(p, i);
          return (
            <g key={p.label}>
              <circle cx={x} cy={y} r="5" fill="#0e4a34">
                <title>{p.label + ': ' + money(p.value)}</title>
              </circle>
              <text x={x} y="200" textAnchor="middle">
                {p.label}
              </text>
            </g>
          );
        })}
      </svg>
      <figcaption>
        {points.length === 1 ? 'One captured period: a trend cannot yet be established.' : label}{' '}
        Exact values are in the table below.
      </figcaption>
    </figure>
  );
}
export function SeriesTable({ rows }: { rows: Series[] }) {
  return (
    <div className="table-scroll">
      <table>
        <caption>Publisher evidence and provenance</caption>
        <thead>
          <tr>
            <th>Place</th>
            <th>Reference month</th>
            <th>Asking figure</th>
            <th>Publisher sample</th>
            <th>Collected</th>
            <th>Source</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <tr key={r.slug + r.geography + r.period_end}>
              <td>{r.geography}</td>
              <td>{month(r.period_end)}</td>
              <td>{money(r.median_price)}</td>
              <td>{r.sample_count ?? 'Not supplied'}</td>
              <td>{date(r.retrieved_at)}</td>
              <td>
                <a href={r.source_url} target="_blank" rel="noreferrer">
                  {r.source}
                </a>
                <small>
                  {r.license} · {r.methodology}
                </small>
              </td>
            </tr>
          ))}
          {!rows.length && (
            <tr>
              <td colSpan={6}>No permitted publisher series in this view.</td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  );
}
