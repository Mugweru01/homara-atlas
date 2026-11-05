import { useState } from 'react';
import { useAnalytics } from '@/hooks/use-analytics';
type Row = {
  county: string;
  neighbourhood: string;
  listing_count: number;
  avg_price_ksh: number;
  avg_rent_ksh: number;
};
export default function Neighbourhoods() {
  const [search, setSearch] = useState('');
  const { data, isPending, error } = useAnalytics<{ results: Row[] }>('neighbourhoods');
  const rows =
    data?.results.filter((row) =>
      `${row.county} ${row.neighbourhood}`.toLowerCase().includes(search.toLowerCase())
    ) || [];
  const currency = (n: number) =>
    new Intl.NumberFormat('en-KE', {
      style: 'currency',
      currency: 'KES',
      maximumFractionDigits: 0,
    }).format(n || 0);
  return (
    <div className="space-y-6">
      <h1 className="text-3xl font-bold">Neighbourhood intelligence</h1>
      <p>
        Compare asking prices and rents from imported listings. Safety ratings and growth forecasts
        are not available.
      </p>
      <label className="block">
        Search neighbourhoods or counties
        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="block border rounded-lg p-3 mt-2"
        />
      </label>
      {isPending && <p>Loading neighbourhoods…</p>}
      {error && <p role="alert">{error.message}</p>}
      {data && !rows.length && (
        <p>
          {data.results.length
            ? 'No matching neighbourhoods.'
            : 'No verified listings have been imported yet.'}
        </p>
      )}
      {!!rows.length && (
        <table className="w-full text-left bg-white">
          <thead>
            <tr>
              <th className="p-3">Neighbourhood</th>
              <th>County</th>
              <th>Listings</th>
              <th>Average price</th>
              <th>Average rent</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr key={`${row.county}-${row.neighbourhood}`} className="border-t">
                <td className="p-3">{row.neighbourhood}</td>
                <td>{row.county}</td>
                <td>{row.listing_count}</td>
                <td>{currency(row.avg_price_ksh)}</td>
                <td>{currency(row.avg_rent_ksh)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}
