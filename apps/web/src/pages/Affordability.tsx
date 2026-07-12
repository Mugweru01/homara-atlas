import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, ReferenceLine } from "recharts";
import { AlertTriangle, Info, CheckCircle2 } from "lucide-react";

// Mock data to demonstrate Housing Affordability Index
const affordabilityData = [
  { county: "Nairobi", income: 150000, rent: 45000, ratio: 30.0 },
  { county: "Mombasa", income: 85000, rent: 22000, ratio: 25.8 },
  { county: "Kiambu", income: 110000, rent: 25000, ratio: 22.7 },
  { county: "Machakos", income: 90000, rent: 18000, ratio: 20.0 },
  { county: "Nakuru", income: 75000, rent: 15000, ratio: 20.0 },
  { county: "Kajiado", income: 95000, rent: 24000, ratio: 25.2 },
];

const Affordability = () => {
  return (
    <div className="space-y-8 animate-fade-in pb-12">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-bold tracking-tight text-gray-900">Housing Affordability Index</h1>
        <p className="text-gray-500 mt-1">Correlating median income data with housing costs to assess market sustainability.</p>
      </div>

      {/* Info Banner */}
      <div className="bg-info-light/50 border border-info/20 rounded-xl p-4 flex gap-3">
        <Info className="w-5 h-5 text-info shrink-0 mt-0.5" />
        <div>
          <h4 className="font-semibold text-gray-900 text-sm">Understanding the 30% Rule</h4>
          <p className="text-sm text-gray-600 mt-1">
            Financial experts recommend spending no more than 30% of gross income on housing. Ratios above this line indicate a housing market experiencing affordability stress, which can lead to increased default rates and depressed economic activity in other sectors.
          </p>
        </div>
      </div>

      {/* Main Chart */}
      <div className="bg-surface-1 rounded-2xl border border-border shadow-sm p-6">
        <div className="flex items-center justify-between mb-8">
          <div>
            <h3 className="text-lg font-semibold text-gray-900">Rent-to-Income Ratio by County</h3>
            <p className="text-sm text-gray-500 mt-1">Percentage of median income spent on median rent</p>
          </div>
        </div>
        
        <div className="h-[400px] w-full">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={affordabilityData} margin={{ top: 20, right: 30, left: 0, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="hsl(var(--border))" />
              <XAxis dataKey="county" axisLine={false} tickLine={false} tick={{ fill: 'hsl(var(--muted-foreground))' }} dy={10} />
              <YAxis axisLine={false} tickLine={false} tick={{ fill: 'hsl(var(--muted-foreground))' }} dx={-10} tickFormatter={(val) => `${val}%`} />
              <Tooltip 
                cursor={{ fill: 'hsl(var(--muted))', opacity: 0.2 }}
                contentStyle={{ borderRadius: '12px', border: '1px solid hsl(var(--border))', boxShadow: 'var(--shadow-lg)' }}
                formatter={(value: number) => [`${value}%`, 'Rent/Income Ratio']}
              />
              {/* Reference line for the 30% rule */}
              <ReferenceLine y={30} stroke="hsl(var(--destructive))" strokeDasharray="3 3" label={{ position: 'top', value: 'Affordability Threshold (30%)', fill: 'hsl(var(--destructive))', fontSize: 12 }} />
              
              <Bar 
                dataKey="ratio" 
                radius={[6, 6, 0, 0]}
              >
                {affordabilityData.map((entry, index) => (
                  <cell key={`cell-${index}`} fill={entry.ratio >= 30 ? "hsl(var(--destructive))" : entry.ratio > 25 ? "hsl(var(--warning))" : "hsl(var(--primary))"} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Market Assessment Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div className="bg-surface-1 rounded-2xl border border-border shadow-sm p-6 flex items-start gap-4">
          <div className="p-3 bg-destructive/10 rounded-xl shrink-0">
            <AlertTriangle className="w-6 h-6 text-destructive" />
          </div>
          <div>
            <h3 className="font-semibold text-gray-900">Highly Stressed Markets</h3>
            <p className="text-sm text-gray-500 mt-1 mb-3">Nairobi is currently operating at exactly the 30% threshold, indicating severe affordability constraints for median earners.</p>
            <div className="text-xs font-semibold text-destructive uppercase tracking-wider">High Risk of Default</div>
          </div>
        </div>
        
        <div className="bg-surface-1 rounded-2xl border border-border shadow-sm p-6 flex items-start gap-4">
          <div className="p-3 bg-success/10 rounded-xl shrink-0">
            <CheckCircle2 className="w-6 h-6 text-success" />
          </div>
          <div>
            <h3 className="font-semibold text-gray-900">Sustainable Markets</h3>
            <p className="text-sm text-gray-500 mt-1 mb-3">Machakos and Nakuru offer the most affordable housing relative to local incomes, maintaining ratios around 20%.</p>
            <div className="text-xs font-semibold text-success uppercase tracking-wider">Strong Investment Potential</div>
          </div>
        </div>
      </div>

    </div>
  );
};

export default Affordability;
