import { useQuery } from '@tanstack/react-query';
import { useState } from 'react';

type Feature = {
  properties: { shapeName: string };
  geometry: { type: string; coordinates: number[][][] | number[][][][] };
};
const clean = (value: string) => value.toLowerCase().replace(/county|city|[^a-z]/g, '');
export default function KenyaMap({
  selected = '',
  onSelect,
  small = false,
}: {
  selected?: string;
  onSelect?: (name: string) => void;
  small?: boolean;
}) {
  const [hover, setHover] = useState('');
  const query = useQuery({
    queryKey: ['atlas', 'geometry'],
    queryFn: async ({ signal }) => {
      const r = await fetch('/kenya-counties.geojson', { signal });
      if (!r.ok) throw new Error('Map unavailable');
      return r.json() as Promise<{ features: Feature[] }>;
    },
    staleTime: Infinity,
  });
  const point = (p: number[]) =>
    `${((p[0] - 33.8) * 51 + 35).toFixed(2)},${((5.6 - p[1]) * 51 + 15).toFixed(2)}`;
  const ring = (points: number[][]) => 'M' + points.map(point).join('L') + 'Z';
  return (
    <div className={`kenya-map ${small ? 'map-small' : ''}`}>
      <div className="map-grid" aria-hidden="true" />
      <svg viewBox="0 0 465 570" role="group" aria-label="Kenya county boundaries, 2020 vintage">
        {query.data?.features.map((feature) => {
          const name = feature.properties.shapeName,
            polygons =
              feature.geometry.type === 'Polygon'
                ? [feature.geometry.coordinates as number[][][]]
                : (feature.geometry.coordinates as number[][][][]);
          return (
            <path
              key={name}
              d={polygons.map((p) => p.map(ring).join('')).join('')}
              className={`${clean(selected) === clean(name) ? 'selected' : ''} ${hover === name ? 'hovered' : ''}`}
              fillRule="evenodd"
              tabIndex={onSelect ? 0 : undefined}
              role={onSelect ? 'button' : undefined}
              aria-label={name}
              aria-pressed={onSelect ? clean(selected) === clean(name) : undefined}
              onMouseEnter={() => setHover(name)}
              onMouseLeave={() => setHover('')}
              onFocus={() => setHover(name)}
              onBlur={() => setHover('')}
              onClick={() => onSelect?.(name)}
              onKeyDown={(e) => {
                if (onSelect && (e.key === 'Enter' || e.key === ' ')) {
                  e.preventDefault();
                  onSelect(name);
                }
              }}
            >
              <title>{name}</title>
            </path>
          );
        })}
        <g className="map-city">
          <circle cx="189" cy="366" r="5" />
          <circle cx="189" cy="366" r="12" fill="none" opacity=".25" />
          <text x="207" y="370">
            Nairobi
          </text>
        </g>
        <g className="north-arrow" transform="translate(414 42)">
          <text y="-12" textAnchor="middle">
            N
          </text>
          <path d="M0 0L-5 20L0 16L5 20Z" />
        </g>
        <g className="map-svg-scale" transform="translate(350 520)">
          <path d="M0 0V5H46V0M23 0V5" fill="none" stroke="#64726b" strokeWidth="1" />
          <text x="0" y="20">
            0
          </text>
          <text x="46" y="20" textAnchor="end">
            100 km
          </text>
          <text x="46" y="35" textAnchor="end">
            Approximate
          </text>
        </g>
      </svg>
      <div className="map-hover" aria-live="polite">
        {query.isError
          ? 'Map unavailable. Use the county list.'
          : hover || selected || 'Explore a county'}
      </div>
    </div>
  );
}
