import { useState, useEffect } from "react";
import { ArrowUpRight, ArrowDownRight, Building2, MapPin, Activity, TrendingUp, RefreshCw } from "lucide-react";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell } from "recharts";

const API_BASE = import.meta.env.VITE_API_URL ?? "http://localhost:8000";
const API_V1   = `${API_BASE}/api/v1`;

// ─── Stat Card ────────────────────────────────────────────────────────────────
const StatCard = ({
  title, value, subtitle, change, isPositive, icon: Icon, loading,
}: {
  title: string; value: string; subtitle?: string;
  change?: string; isPositive?: boolean; icon: any; loading: boolean;
}) => (
  <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6 flex flex-col gap-4 hover:shadow-md transition-shadow duration-200">
    <div className="flex items-center justify-between">
      <span className="text-sm font-medium text-gray-500">{title}</span>
      <div className="p-2 rounded-xl bg-primary/10">
        <Icon className="w-5 h-5 text-primary" />
      </div>
    </div>
    {loading ? (
      <div className="h-8 w-32 bg-gray-100 rounded-lg animate-pulse" />
    ) : (
      <div className="flex items-end gap-3">
        <span className="text-3xl font-bold text-gray-900 tracking-tight">{value}</span>
        {change && (
          <span className={`flex items-center text-sm font-semibold mb-1 ${isPositive ? "text-emerald-600" : "text-red-500"}`}>
            {isPositive ? <ArrowUpRight className="w-4 h-4" /> : <ArrowDownRight className="w-4 h-4" />}
            {change}
          </span>
        )}
      </div>
    )}
    {subtitle && <p className="text-xs text-gray-400">{subtitle}</p>}
  </div>
);

// ─── Format helpers ────────────────────────────────────────────────────────────
const formatKsh = (n: number) =>
  n >= 1_000_000
    ? `KES ${(n / 1_000_000).toFixed(1)}M`
    : `KES ${(n / 1_000).toFixed(0)}K`;

// ─── Custom Tooltip for chart ──────────────────────────────────────────────────
const CustomTooltip = ({ active, payload, label }: any) => {
  if (!active || !payload?.length) return null;
  return (
    <div className="bg-white border border-gray-100 rounded-xl shadow-lg p-4 text-sm">
      <p className="font-semibold text-gray-800 mb-2">{label}</p>
      {payload.map((p: any) => (
        <p key={p.name} className="text-gray-600">
          {p.name}: <span className="font-bold text-primary">{formatKsh(p.value)}</span>
        </p>
      ))}
    </div>
  );
};

// ─── Color palette (green → gold spectrum) ────────────────────────────────────
const BAR_COLORS = ["#16a34a", "#22c55e", "#4ade80", "#b45309", "#d97706", "#f59e0b"];

// ─── Main Page ─────────────────────────────────────────────────────────────────
const Index = () => {
  const [overview, setOverview] = useState<any>(null);
  const [priceIndex, setPriceIndex] = useState<any[]>([]);
  const [neighbourhoods, setNeighbourhoods] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [lastRefreshed, setLastRefreshed] = useState<Date>(new Date());

  const fetchData = async () => {
    setLoading(true);
    setError(null);
    try {
      const [ovRes, piRes, nbRes] = await Promise.all([
        fetch(`${API_V1}/analytics/overview`),
        fetch(`${API_V1}/analytics/price-index`),
        fetch(`${API_V1}/analytics/neighbourhoods`),
      ]);

      if (!ovRes.ok) throw new Error(`Overview API error: ${ovRes.status}`);
      const [ovData, piData, nbData] = await Promise.all([
        ovRes.json(), piRes.json(), nbRes.json(),
      ]);

      setOverview(ovData);
      setPriceIndex(piData.results ?? []);
      setNeighbourhoods(nbData.results ?? []);
      setLastRefreshed(new Date());
    } catch (err: any) {
      setError(err.message ?? "Failed to load data. Ensure the API is running.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchData(); }, []);

  return (
    <div className="space-y-8 animate-fade-in">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold text-gray-900 tracking-tight">Market Overview</h1>
          <p className="text-gray-500 mt-1 text-sm">
            Kenya Property Intelligence · Last updated{" "}
            <span className="font-medium text-gray-700">{lastRefreshed.toLocaleTimeString()}</span>
          </p>
        </div>
        <button
          onClick={fetchData}
          className="flex items-center gap-2 bg-primary hover:bg-green-700 text-white px-4 py-2.5 rounded-xl font-medium transition-all duration-200 shadow-sm hover:shadow-md text-sm"
        >
          <RefreshCw className={`w-4 h-4 ${loading ? "animate-spin" : ""}`} />
          Refresh Data
        </button>
      </div>

      {/* Error Banner */}
      {error && (
        <div className="bg-amber-50 border border-amber-200 text-amber-800 rounded-xl px-5 py-4 text-sm flex items-start gap-3">
          <span className="text-amber-500 mt-0.5">⚠</span>
          <div>
            <p className="font-semibold">API Unavailable</p>
            <p className="text-amber-700 mt-1">{error}</p>
            <p className="text-amber-600 mt-1">
              Start the API: <code className="bg-amber-100 px-1.5 py-0.5 rounded text-xs">py -m uvicorn app.main:app --reload</code> in the <code className="bg-amber-100 px-1.5 py-0.5 rounded text-xs">/api</code> directory.
            </p>
          </div>
        </div>
      )}

      {/* KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-5">
        <StatCard
          title="Avg. Listing Price"
          value={overview ? formatKsh(overview.avg_listing_price_ksh) : "—"}
          subtitle="Across all property types"
          icon={Activity}
          loading={loading}
        />
        <StatCard
          title="Active Listings"
          value={overview ? overview.total_listings.toLocaleString() : "—"}
          subtitle="From public data sources"
          icon={Building2}
          loading={loading}
        />
        <StatCard
          title="Avg. Monthly Rent"
          value={overview ? formatKsh(overview.avg_rent_ksh) : "—"}
          subtitle="All neighbourhoods"
          icon={TrendingUp}
          loading={loading}
        />
        <StatCard
          title="Counties Covered"
          value={overview ? overview.counties_covered.toString() : "—"}
          subtitle="Expanding to 47 counties"
          icon={MapPin}
          loading={loading}
        />
      </div>

      {/* Charts Row */}
      <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
        {/* Price by Property Type */}
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6">
          <h3 className="text-base font-semibold text-gray-900 mb-1">Avg. Price by Property Type</h3>
          <p className="text-xs text-gray-400 mb-6">All counties · KES</p>
          {loading ? (
            <div className="h-64 bg-gray-50 rounded-xl animate-pulse" />
          ) : (
            <ResponsiveContainer width="100%" height={240}>
              <BarChart data={priceIndex} barSize={32}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f3f4f6" />
                <XAxis dataKey="property_type" tick={{ fontSize: 12, fill: "#6b7280" }} />
                <YAxis tickFormatter={(v) => `${(v / 1_000_000).toFixed(1)}M`} tick={{ fontSize: 11, fill: "#6b7280" }} />
                <Tooltip content={<CustomTooltip />} />
                <Bar dataKey="avg_price_ksh" name="Avg Price" radius={[6, 6, 0, 0]}>
                  {priceIndex.map((_, i) => (
                    <Cell key={i} fill={BAR_COLORS[i % BAR_COLORS.length]} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          )}
        </div>

        {/* Top Neighbourhoods */}
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6">
          <h3 className="text-base font-semibold text-gray-900 mb-1">Top Neighbourhoods by Price</h3>
          <p className="text-xs text-gray-400 mb-5">Avg. listing price · KES</p>
          {loading ? (
            <div className="space-y-3">
              {[...Array(5)].map((_, i) => (
                <div key={i} className="h-10 bg-gray-50 rounded-lg animate-pulse" />
              ))}
            </div>
          ) : (
            <div className="space-y-3">
              {neighbourhoods.slice(0, 6).map((nb: any, i: number) => (
                <div key={i} className="flex items-center justify-between p-3 rounded-xl bg-gray-50 hover:bg-primary/5 transition-colors duration-150">
                  <div className="flex items-center gap-3">
                    <span className="w-6 h-6 rounded-full bg-primary/10 text-primary text-xs font-bold flex items-center justify-center">
                      {i + 1}
                    </span>
                    <div>
                      <p className="text-sm font-semibold text-gray-800">{nb.neighbourhood}</p>
                      <p className="text-xs text-gray-400">{nb.county}</p>
                    </div>
                  </div>
                  <div className="text-right">
                    <p className="text-sm font-bold text-gray-900">{formatKsh(nb.avg_price_ksh)}</p>
                    <p className="text-xs text-gray-400">{nb.listing_count} listings</p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default Index;
