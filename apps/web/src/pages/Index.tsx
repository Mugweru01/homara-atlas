import { useAnalytics } from '@/hooks/use-analytics';
import { Link } from 'react-router-dom';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer } from 'recharts';
type Overview = {
  total_listings: number;
  avg_listing_price_ksh: number;
  avg_rent_ksh: number;
  counties_covered: number;
  source: string;
};
type CountyPrice = { county: string; property_type: string; avg_price_ksh: number };
const currency = (value: number) =>
  new Intl.NumberFormat('en-KE', {
    style: 'currency',
    currency: 'KES',
    maximumFractionDigits: 0,
  }).format(value);
export default function Index() {
  const overview = useAnalytics<Overview>('overview');
  const prices = useAnalytics<{ results: CountyPrice[] }>('price-index');
  const data = overview.data;
  const stats = data
    ? [
        ['Imported listings', data.total_listings.toLocaleString()],
        ['Average asking price', data.total_listings ? currency(data.avg_listing_price_ksh) : '—'],
        ['Average monthly rent', data.total_listings ? currency(data.avg_rent_ksh) : '—'],
        ['Counties covered', data.counties_covered.toString()],
      ]
    : [];
  return (
    <div className="space-y-8">
      <div className="flex justify-between items-center">
        <h1 className="text-3xl font-bold">Market overview</h1>
        <button
          className="border rounded-lg px-4 py-2"
          disabled={overview.isFetching}
          onClick={() => {
            overview.refetch();
            prices.refetch();
          }}
        >
          Refresh data
        </button>
      </div>
      <p>
        Asking prices from imported property listings. Coverage and sample size affect these
        figures.
      </p>
      {overview.isPending && <p>Loading market data…</p>}
      {overview.error && (
        <p role="alert" className="text-red-700">
          Market data is unavailable. Please retry shortly.
        </p>
      )}
      {data?.source === 'local_parquet' && (
        <p role="status" className="border border-amber-300 bg-amber-50 p-4 rounded-xl">
          Local demonstration dataset. These figures are not verified market intelligence.
        </p>
      )}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-5">
        {stats.map(([title, value]) => (
          <div key={title} className="bg-white border border-border rounded-2xl p-6">
            <p className="text-muted-foreground">{title}</p>
            <p className="text-3xl font-semibold mt-3">{value}</p>
          </div>
        ))}
      </div>
      {data?.total_listings === 0 && (
        <div className="border rounded-xl p-6 bg-white">
          <h2 className="text-xl font-semibold">No verified listings imported yet</h2>
          <p className="mt-2">
            The warehouse is connected. Market analytics will populate after a verified property
            dataset is imported.
          </p>
        </div>
      )}
      {!!prices.data?.results.length && (
        <section className="rounded-2xl bg-white border p-6">
          <h2 className="text-xl font-semibold mb-4">
            Average asking price by county and property type
          </h2>
          <ResponsiveContainer width="100%" height={320}>
            <BarChart data={prices.data.results.slice(0, 12)}>
              <XAxis dataKey="county" />
              <YAxis tickFormatter={(value) => `${(Number(value) / 1000000).toFixed(1)}M`} />
              <Tooltip formatter={(value) => currency(Number(value))} />
              <Bar dataKey="avg_price_ksh" fill="#16a34a" name="Average price" />
            </BarChart>
          </ResponsiveContainer>
        </section>
      )}
      {prices.error && <p role="alert">County prices could not be loaded.</p>}
      <Link to="/workspace" className="inline-block text-primary underline">
        Open your private reports workspace
      </Link>
    </div>
  );
}
