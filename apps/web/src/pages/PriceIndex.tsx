import { useAnalytics } from '@/hooks/use-analytics';
type Row = {
  county: string;
  property_type: string;
  listing_count: number;
  avg_price_ksh: number;
  avg_rent_ksh: number;
};
const currency = (n: number) =>
  new Intl.NumberFormat('en-KE', {
    style: 'currency',
    currency: 'KES',
    maximumFractionDigits: 0,
  }).format(n || 0);
export default function PriceIndex() {
  const { data, isPending, error } = useAnalytics<{ results: Row[] }>('price-index');
  return (
    <div className="space-y-6">
      <h1 className="text-3xl font-bold">Property prices</h1>
      <p>
        Average asking prices by county and property type from imported listings. These are listing
        averages, not a historical price index.
      </p>
      {isPending && <p>Loading prices…</p>}
      {error && <p role="alert">{error.message}</p>}
      {data && !data.results.length && <p>No verified listings have been imported yet.</p>}
      {!!data?.results.length && (
        <table className="w-full text-left bg-white">
          <thead>
            <tr>
              <th className="p-3">County</th>
              <th>Property type</th>
              <th>Listings</th>
              <th>Average price</th>
              <th>Average rent</th>
            </tr>
          </thead>
          <tbody>
            {data.results.map((row) => (
              <tr key={`${row.county}-${row.property_type}`} className="border-t">
                <td className="p-3">{row.county}</td>
                <td>{row.property_type}</td>
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
