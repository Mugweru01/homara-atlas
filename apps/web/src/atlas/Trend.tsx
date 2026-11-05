import { useId, useState } from 'react';
import type { Indicator } from './data';

export default function Trend({
  rows,
  format,
  compact = false,
}: {
  rows: Indicator[];
  format: (n: number) => string;
  compact?: boolean;
}) {
  const id = useId().replace(/:/g, ''),
    [active, setActive] = useState<number | null>(null);
  if (!rows.length) return <p className="muted">No observations available.</p>;
  const width = 620,
    height = compact ? 150 : 240,
    left = 52,
    right = 18,
    top = 18,
    bottom = 30;
  const values = rows.map((r) => Number(r.value)),
    min = Math.min(...values),
    max = Math.max(...values),
    pad = (max - min) * 0.15 || 1,
    lo = min - pad,
    hi = max + pad;
  const x = (i: number) => left + (i / Math.max(rows.length - 1, 1)) * (width - left - right);
  const y = (n: number) => top + ((hi - n) / (hi - lo)) * (height - top - bottom);
  const path = rows.map((r, i) => `${i ? 'L' : 'M'}${x(i)},${y(Number(r.value))}`).join(' ');
  const selected = active === null ? rows.length - 1 : active;
  return (
    <div className="trend">
      <svg
        viewBox={`0 0 ${width} ${height}`}
        role="img"
        aria-label={`Annual observations from ${rows[0].reference_year} to ${rows.at(-1)!.reference_year}. Latest value ${format(Number(rows.at(-1)!.value))}.`}
      >
        <defs>
          <linearGradient id={id} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0" stopColor="#0E4A34" stopOpacity=".13" />
            <stop offset="1" stopColor="#0E4A34" stopOpacity="0" />
          </linearGradient>
        </defs>
        {[0, 1, 2].map((i) => {
          const value = lo + ((hi - lo) * i) / 2;
          return (
            <g key={i}>
              <line
                x1={left}
                x2={width - right}
                y1={y(value)}
                y2={y(value)}
                className="chart-grid"
              />
              <text x={left - 10} y={y(value) + 4} textAnchor="end">
                {format(value)}
              </text>
            </g>
          );
        })}
        <path
          d={`${path} L${x(rows.length - 1)},${height - bottom} L${left},${height - bottom} Z`}
          fill={`url(#${id})`}
        />
        <path d={path} fill="none" stroke="#0E4A34" strokeWidth="2.5" strokeLinejoin="round" />
        {rows
          .filter((_, i) => i === 0 || i === rows.length - 1 || i === Math.floor(rows.length / 2))
          .map((r) => (
            <text key={r.reference_year} x={x(rows.indexOf(r))} y={height - 6} textAnchor="middle">
              {r.reference_year}
            </text>
          ))}
        {active !== null && (
          <line
            x1={x(selected)}
            x2={x(selected)}
            y1={top}
            y2={height - bottom}
            stroke="#8B978F"
            strokeDasharray="3 4"
          />
        )}
        <circle
          cx={x(selected)}
          cy={y(Number(rows[selected].value))}
          r="4"
          fill="#0E4A34"
          stroke="#FAF8F2"
          strokeWidth="2"
        />
        {rows.map((r, i) => (
          <rect
            key={r.reference_year}
            x={x(i) - 9}
            width="18"
            y={top}
            height={height - top - bottom}
            fill="transparent"
            tabIndex={0}
            role="button"
            aria-label={`${r.reference_year}: ${format(Number(r.value))}`}
            onFocus={() => setActive(i)}
            onBlur={() => setActive(null)}
            onMouseEnter={() => setActive(i)}
            onMouseLeave={() => setActive(null)}
          />
        ))}
      </svg>
      <div className="chart-reading" aria-live="polite">
        <span>{rows[selected].reference_year}</span>
        <strong>{format(Number(rows[selected].value))}</strong>
        <span>Annual observation</span>
      </div>
    </div>
  );
}
