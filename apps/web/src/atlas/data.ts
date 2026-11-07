import { useQuery } from '@tanstack/react-query';

export type County = {
  id: string;
  name: string;
  reference_year: number;
  code?: string;
  reference_name?: string;
  metadata?: {
    region?: string;
    capital?: string;
    population_2019?: number;
    area_km2?: number;
    capital_postal_code?: string;
    aliases?: string[];
  };
};
export type Indicator = {
  indicator_code: string;
  indicator_name: string;
  reference_year: number;
  value: string;
  unit: string;
  attribution: string;
  retrieved_at: string;
};
export type Source = {
  slug: string;
  name: string;
  data_kind: string;
  license: string;
  permission_url: string;
  attribution: string;
  last_success_at: string | null;
  dataset_revision?: string | null;
  dataset_version?: string | null;
};
export type Health = {
  status: string;
  sources: { slug: string; stale: boolean; last_success_at: string | null }[];
};
export type MarketCell = {
  county: string;
  listing_type: string;
  property_type: string;
  bedrooms: number;
  listing_count: number;
  median_price: string | null;
  sparse: boolean;
};
export const API_BASE = (import.meta.env.VITE_API_URL || '').replace(/\/$/, '');
export async function api<T>(path: string, signal?: AbortSignal): Promise<T> {
  const response = await fetch(`${API_BASE}/api/v1${path}`, {
    signal: signal
      ? AbortSignal.any([signal, AbortSignal.timeout(20000)])
      : AbortSignal.timeout(20000),
    credentials: 'omit',
    headers: { Accept: 'application/json' },
  });
  if (!response.ok)
    throw new Error(
      response.status === 429
        ? 'You have reached the request limit. Please try again in a minute.'
        : 'We could not load this data. Please try again.'
    );
  return response.json();
}
export function useCounties() {
  return useQuery({
    queryKey: ['atlas', 'counties'],
    queryFn: ({ signal }) =>
      api<{ results: County[] }>('/geography/counties', signal).then((r) => r.results),
  });
}
export function useMarketOverview() {
  return useQuery({
    queryKey: ['atlas', 'market-overview'],
    queryFn: ({ signal }) =>
      api<{ status: string; total_listings: number }>('/analytics/overview', signal),
  });
}
export function useSources() {
  return useQuery({
    queryKey: ['atlas', 'sources'],
    queryFn: ({ signal }) => api<{ results: Source[] }>('/sources', signal).then((r) => r.results),
  });
}
export function useHealth() {
  return useQuery({
    queryKey: ['atlas', 'health'],
    queryFn: ({ signal }) => api<Health>('/system/data-health', signal),
  });
}
export function useIndicators() {
  return useQuery({
    queryKey: ['atlas', 'indicators'],
    queryFn: async ({ signal }) => {
      const first = await api<{ results: Indicator[] }>('/context/indicators?limit=100', signal);
      if (first.results.length < 100) return first.results;
      const second = await api<{ results: Indicator[] }>(
        '/context/indicators?limit=100&offset=100',
        signal
      );
      return [...first.results, ...second.results];
    },
  });
}
export const indicatorDefinitions = [
  {
    code: 'SP.POP.TOTL',
    title: 'Population',
    short: 'Population',
    unit: 'people',
    description: 'Total population of Kenya.',
    format: (n: number) => `${(n / 1e6).toFixed(2)}m`,
  },
  {
    code: 'SP.URB.TOTL.IN.ZS',
    title: 'Urban population',
    short: 'Urban share',
    unit: '% of population',
    description: 'Share of people living in urban areas.',
    format: (n: number) => `${n.toFixed(1)}%`,
  },
  {
    code: 'FP.CPI.TOTL.ZG',
    title: 'Consumer price inflation',
    short: 'Inflation',
    unit: 'annual %',
    description: 'Annual change in consumer prices.',
    format: (n: number) => `${n.toFixed(2)}%`,
  },
  {
    code: 'NY.GDP.PCAP.CD',
    title: 'GDP per capita',
    short: 'GDP per capita',
    unit: 'current US$',
    description: 'National economic output per person. This is not household income.',
    format: (n: number) => `$${Math.round(n).toLocaleString('en-KE')}`,
  },
];
export function series(rows: Indicator[] = [], code: string) {
  return rows
    .filter((r) => r.indicator_code === code)
    .sort((a, b) => a.reference_year - b.reference_year);
}
export function date(value?: string | null) {
  return value
    ? new Intl.DateTimeFormat('en-KE', {
        day: 'numeric',
        month: 'short',
        year: 'numeric',
        timeZone: 'Africa/Nairobi',
      }).format(new Date(value))
    : 'Not yet collected';
}
export function exportCsv(name: string, columns: string[], rows: (string | number | null)[][]) {
  const cell = (value: string | number | null) =>
    `"${String(value ?? '')
      .replace(/^[=+@-]/, "'$&")
      .replace(/"/g, '""')}"`;
  const blob = new Blob(
    ['\uFEFF' + [columns, ...rows].map((row) => row.map(cell).join(',')).join('\r\n')],
    { type: 'text/csv;charset=utf-8' }
  );
  const url = URL.createObjectURL(blob),
    anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = name;
  anchor.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
