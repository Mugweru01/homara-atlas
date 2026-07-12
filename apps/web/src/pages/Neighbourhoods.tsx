import { useState } from "react";
import { Search, Filter, ArrowUpDown, MoreHorizontal, ExternalLink } from "lucide-react";

const mockData = [
  { id: 1, name: "Kilimani", county: "Nairobi", avgPrice: "KES 15.2M", yield: "7.2%", safety: "High", growth: "+4.1%" },
  { id: 2, name: "Kileleshwa", county: "Nairobi", avgPrice: "KES 14.8M", yield: "6.8%", safety: "High", growth: "+3.5%" },
  { id: 3, name: "Nyali", county: "Mombasa", avgPrice: "KES 12.1M", yield: "8.1%", safety: "Medium", growth: "+5.2%" },
  { id: 4, name: "Ruiru", county: "Kiambu", avgPrice: "KES 8.5M", yield: "6.5%", safety: "Medium", growth: "+8.4%" },
  { id: 5, name: "Westlands", county: "Nairobi", avgPrice: "KES 18.5M", yield: "6.1%", safety: "High", growth: "+2.1%" },
  { id: 6, name: "Syokimau", county: "Machakos", avgPrice: "KES 9.2M", yield: "7.5%", safety: "Medium", growth: "+9.1%" },
  { id: 7, name: "Lavington", county: "Nairobi", avgPrice: "KES 22.1M", yield: "5.8%", safety: "High", growth: "+1.5%" },
];

const Neighbourhoods = () => {
  const [searchTerm, setSearchTerm] = useState("");

  const filteredData = mockData.filter(item => 
    item.name.toLowerCase().includes(searchTerm.toLowerCase()) || 
    item.county.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <div className="space-y-6 animate-fade-in pb-12">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-gray-900">Neighbourhood Intelligence</h1>
          <p className="text-gray-500 mt-1">Deep dives into local supply, demand, and infrastructure metrics.</p>
        </div>
      </div>

      <div className="bg-surface-1 rounded-2xl border border-border shadow-sm overflow-hidden flex flex-col">
        {/* Table Toolbar */}
        <div className="p-4 border-b border-border flex flex-col sm:flex-row gap-4 justify-between items-center bg-gray-50/50">
          <div className="relative w-full sm:w-96">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
            <input 
              type="text" 
              placeholder="Search neighbourhoods or counties..." 
              className="w-full pl-9 pr-4 py-2 rounded-xl border border-border bg-white text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>
          <button className="flex items-center gap-2 bg-white border border-border px-4 py-2 rounded-xl text-sm font-medium text-gray-700 hover:bg-gray-50 transition-colors shadow-sm whitespace-nowrap">
            <Filter className="w-4 h-4" />
            More Filters
          </button>
        </div>

        {/* Data Table */}
        <div className="overflow-x-auto">
          <table className="w-full text-sm text-left">
            <thead className="bg-gray-50/80 text-gray-500 font-medium border-b border-border">
              <tr>
                <th className="px-6 py-4 cursor-pointer hover:text-gray-800 transition-colors group">
                  <div className="flex items-center gap-2">Neighbourhood <ArrowUpDown className="w-3 h-3 opacity-0 group-hover:opacity-100 transition-opacity" /></div>
                </th>
                <th className="px-6 py-4 cursor-pointer hover:text-gray-800 transition-colors group">
                  <div className="flex items-center gap-2">County <ArrowUpDown className="w-3 h-3 opacity-0 group-hover:opacity-100 transition-opacity" /></div>
                </th>
                <th className="px-6 py-4 cursor-pointer hover:text-gray-800 transition-colors group">
                  <div className="flex items-center gap-2">Avg. Listing Price <ArrowUpDown className="w-3 h-3 opacity-0 group-hover:opacity-100 transition-opacity" /></div>
                </th>
                <th className="px-6 py-4 cursor-pointer hover:text-gray-800 transition-colors group">
                  <div className="flex items-center gap-2">Rental Yield <ArrowUpDown className="w-3 h-3 opacity-0 group-hover:opacity-100 transition-opacity" /></div>
                </th>
                <th className="px-6 py-4">Safety Score</th>
                <th className="px-6 py-4">YoY Growth</th>
                <th className="px-6 py-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {filteredData.map((row) => (
                <tr key={row.id} className="hover:bg-gray-50/50 transition-colors group">
                  <td className="px-6 py-4 font-semibold text-gray-900">{row.name}</td>
                  <td className="px-6 py-4 text-gray-600">{row.county}</td>
                  <td className="px-6 py-4 font-medium">{row.avgPrice}</td>
                  <td className="px-6 py-4 text-success font-medium">{row.yield}</td>
                  <td className="px-6 py-4">
                    <span className={`px-2.5 py-1 rounded-full text-xs font-medium ${
                      row.safety === 'High' ? 'bg-success/10 text-success-foreground' : 
                      row.safety === 'Medium' ? 'bg-warning/10 text-warning-foreground' : 
                      'bg-destructive/10 text-destructive-foreground'
                    }`}>
                      {row.safety}
                    </span>
                  </td>
                  <td className="px-6 py-4 font-medium text-emerald-600">{row.growth}</td>
                  <td className="px-6 py-4 text-right">
                    <button className="p-2 hover:bg-gray-200 rounded-lg transition-colors text-gray-500 hover:text-primary">
                      <ExternalLink className="w-4 h-4" />
                    </button>
                  </td>
                </tr>
              ))}
              {filteredData.length === 0 && (
                <tr>
                  <td colSpan={7} className="px-6 py-12 text-center text-gray-500">
                    No neighbourhoods found matching "{searchTerm}"
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
        
        {/* Pagination Footer */}
        <div className="p-4 border-t border-border flex items-center justify-between bg-gray-50/50 text-sm text-gray-500">
          <span>Showing 1 to {filteredData.length} of {mockData.length} entries</span>
          <div className="flex gap-1">
            <button className="px-3 py-1 border border-border rounded-md bg-white hover:bg-gray-50 disabled:opacity-50">Prev</button>
            <button className="px-3 py-1 border border-primary bg-primary text-white rounded-md">1</button>
            <button className="px-3 py-1 border border-border rounded-md bg-white hover:bg-gray-50 disabled:opacity-50">Next</button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Neighbourhoods;
