import { useState, useEffect } from "react";
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from "recharts";
import { ArrowUpRight, ArrowDownRight, TrendingUp, Calendar, Filter } from "lucide-react";

// Mock historical data to demonstrate the UI capabilities 
// (In production, this would come from /api/v1/analytics/historical)
const historicalData = [
  { month: "Jan", nairobi: 12.5, mombasa: 8.2, kiambu: 6.1 },
  { month: "Feb", nairobi: 12.8, mombasa: 8.1, kiambu: 6.3 },
  { month: "Mar", nairobi: 13.1, mombasa: 8.4, kiambu: 6.5 },
  { month: "Apr", nairobi: 12.9, mombasa: 8.6, kiambu: 6.8 },
  { month: "May", nairobi: 13.4, mombasa: 8.5, kiambu: 7.1 },
  { month: "Jun", nairobi: 13.8, mombasa: 8.8, kiambu: 7.4 },
  { month: "Jul", nairobi: 14.2, mombasa: 9.1, kiambu: 7.6 },
];

const StatCard = ({ title, value, change, isPositive }: { title: string; value: string; change: string; isPositive: boolean }) => (
  <div className="bg-surface-1 rounded-2xl border border-border shadow-sm p-6 flex flex-col gap-2 relative overflow-hidden group">
    <div className="absolute top-0 right-0 w-32 h-32 bg-primary/5 rounded-bl-[100px] -z-10 transition-transform group-hover:scale-110" />
    <span className="text-sm font-medium text-gray-500">{title}</span>
    <span className="text-3xl font-bold text-gray-900 tracking-tight">{value}</span>
    <span className={`flex items-center text-sm font-semibold mt-1 ${isPositive ? "text-success" : "text-destructive"}`}>
      {isPositive ? <ArrowUpRight className="w-4 h-4 mr-1" /> : <ArrowDownRight className="w-4 h-4 mr-1" />}
      {change} vs last year
    </span>
  </div>
);

const PriceIndex = () => {
  return (
    <div className="space-y-8 animate-fade-in pb-12">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-gray-900">Property Price Index</h1>
          <p className="text-gray-500 mt-1">Standardized metrics tracking market health across major counties.</p>
        </div>
        <div className="flex items-center gap-3">
          <button className="flex items-center gap-2 bg-white border border-border px-4 py-2 rounded-xl text-sm font-medium text-gray-700 hover:bg-gray-50 transition-colors shadow-sm">
            <Calendar className="w-4 h-4" />
            YTD 2026
          </button>
          <button className="flex items-center gap-2 bg-primary text-white px-4 py-2 rounded-xl text-sm font-medium hover:bg-primary/90 transition-colors shadow-glow">
            <Filter className="w-4 h-4" />
            Filter Data
          </button>
        </div>
      </div>

      {/* KPI Row */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <StatCard title="National Price Index" value="142.5" change="+5.2%" isPositive={true} />
        <StatCard title="Nairobi Metro Area" value="KES 14.2M" change="+8.1%" isPositive={true} />
        <StatCard title="Coastal Region" value="KES 9.1M" change="-1.2%" isPositive={false} />
      </div>

      {/* Main Chart */}
      <div className="bg-surface-1 rounded-2xl border border-border shadow-sm p-6">
        <div className="flex items-center justify-between mb-8">
          <div>
            <h3 className="text-lg font-semibold text-gray-900">Historical Price Trends (Millions KES)</h3>
            <p className="text-sm text-gray-500 mt-1">Average listing price trajectory across top 3 counties</p>
          </div>
          <div className="flex items-center gap-4 text-sm font-medium">
            <div className="flex items-center gap-2"><div className="w-3 h-3 rounded-full bg-primary"></div>Nairobi</div>
            <div className="flex items-center gap-2"><div className="w-3 h-3 rounded-full bg-accent"></div>Mombasa</div>
            <div className="flex items-center gap-2"><div className="w-3 h-3 rounded-full bg-info"></div>Kiambu</div>
          </div>
        </div>
        
        <div className="h-[400px] w-full">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={historicalData} margin={{ top: 10, right: 30, left: 0, bottom: 0 }}>
              <defs>
                <linearGradient id="colorNairobi" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="hsl(142 76% 42%)" stopOpacity={0.3}/>
                  <stop offset="95%" stopColor="hsl(142 76% 42%)" stopOpacity={0}/>
                </linearGradient>
                <linearGradient id="colorMombasa" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="hsl(48 96% 53%)" stopOpacity={0.3}/>
                  <stop offset="95%" stopColor="hsl(48 96% 53%)" stopOpacity={0}/>
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="hsl(var(--border))" />
              <XAxis dataKey="month" axisLine={false} tickLine={false} tick={{ fill: 'hsl(var(--muted-foreground))' }} dy={10} />
              <YAxis axisLine={false} tickLine={false} tick={{ fill: 'hsl(var(--muted-foreground))' }} dx={-10} tickFormatter={(val) => `KES ${val}M`} />
              <Tooltip 
                contentStyle={{ borderRadius: '12px', border: '1px solid hsl(var(--border))', boxShadow: 'var(--shadow-lg)' }}
                itemStyle={{ fontWeight: 600 }}
              />
              <Area type="monotone" dataKey="nairobi" stroke="hsl(142 76% 42%)" strokeWidth={3} fillOpacity={1} fill="url(#colorNairobi)" />
              <Area type="monotone" dataKey="mombasa" stroke="hsl(48 96% 53%)" strokeWidth={3} fillOpacity={1} fill="url(#colorMombasa)" />
              <Area type="monotone" dataKey="kiambu" stroke="hsl(217 91% 60%)" strokeWidth={3} fillOpacity={0.1} fill="hsl(217 91% 60%)" />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      </div>
    </div>
  );
};

export default PriceIndex;
