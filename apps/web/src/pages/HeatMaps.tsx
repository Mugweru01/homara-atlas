import { MapPin, Filter, Target, Maximize2 } from "lucide-react";

const HeatMaps = () => {
  return (
    <div className="space-y-6 animate-fade-in h-[calc(100vh-8rem)] flex flex-col">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 shrink-0">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-gray-900">Interactive Heat Maps</h1>
          <p className="text-gray-500 mt-1">Geospatial visualization of property values and growth areas.</p>
        </div>
        <div className="flex items-center gap-3">
          <button className="flex items-center gap-2 bg-white border border-border px-4 py-2 rounded-xl text-sm font-medium text-gray-700 hover:bg-gray-50 transition-colors shadow-sm">
            <Filter className="w-4 h-4" />
            Filter Data
          </button>
        </div>
      </div>

      {/* Map Container */}
      <div className="flex-1 bg-surface-1 rounded-2xl border border-border shadow-sm overflow-hidden relative group">
        
        {/* Mock Map Background (Using a CSS pattern to simulate a grid/map surface) */}
        <div 
          className="absolute inset-0 z-0 bg-[hsl(240_10%_98%)]"
          style={{
            backgroundImage: `radial-gradient(hsl(240 10% 80%) 1px, transparent 1px)`,
            backgroundSize: '24px 24px',
            opacity: 0.5
          }}
        />

        {/* Floating Map Controls */}
        <div className="absolute top-4 left-4 z-10 flex flex-col gap-2">
          <div className="bg-white/90 backdrop-blur-md border border-border shadow-md rounded-xl p-2 flex flex-col gap-2">
            <button className="p-2 bg-gray-100 hover:bg-gray-200 rounded-lg transition-colors" title="Zoom In">+</button>
            <button className="p-2 bg-gray-100 hover:bg-gray-200 rounded-lg transition-colors" title="Zoom Out">-</button>
            <div className="w-full h-px bg-border my-1"></div>
            <button className="p-2 bg-gray-100 hover:bg-gray-200 rounded-lg transition-colors" title="Center Map">
              <Target className="w-4 h-4 text-gray-700" />
            </button>
          </div>
        </div>

        {/* Legend */}
        <div className="absolute bottom-6 left-6 z-10 bg-white/95 backdrop-blur-md border border-border shadow-lg rounded-xl p-4 w-64">
          <h4 className="font-semibold text-sm mb-3">Investment Potential</h4>
          <div className="space-y-3">
            <div className="flex items-center gap-3 text-xs">
              <div className="w-4 h-4 rounded-full bg-success/80 border border-success shadow-glow"></div>
              <span className="text-gray-600">High Growth (8%+ YoY)</span>
            </div>
            <div className="flex items-center gap-3 text-xs">
              <div className="w-4 h-4 rounded-full bg-warning/80 border border-warning shadow-glow"></div>
              <span className="text-gray-600">Stable (4-7% YoY)</span>
            </div>
            <div className="flex items-center gap-3 text-xs">
              <div className="w-4 h-4 rounded-full bg-destructive/80 border border-destructive shadow-glow"></div>
              <span className="text-gray-600">Stagnant (<3% YoY)</span>
            </div>
          </div>
        </div>

        <button className="absolute top-4 right-4 z-10 p-2 bg-white/90 backdrop-blur-md border border-border shadow-sm hover:bg-gray-50 rounded-xl transition-colors">
          <Maximize2 className="w-4 h-4 text-gray-700" />
        </button>

        {/* Mock Map Markers */}
        <div className="absolute inset-0 z-0 flex items-center justify-center pointer-events-none">
          <div className="relative w-full h-full max-w-3xl max-h-[500px]">
             {/* Nairobi Marker */}
             <div className="absolute top-[40%] left-[45%] flex flex-col items-center">
               <div className="w-12 h-12 rounded-full bg-success/20 animate-pulse-glow flex items-center justify-center">
                 <div className="w-4 h-4 rounded-full bg-success shadow-sm" />
               </div>
               <span className="bg-white/80 backdrop-blur-sm px-2 py-1 rounded text-[10px] font-bold mt-1 shadow-sm">Nairobi Metro</span>
             </div>

             {/* Kiambu Marker */}
             <div className="absolute top-[32%] left-[42%] flex flex-col items-center">
               <div className="w-16 h-16 rounded-full bg-success/20 animate-pulse-glow flex items-center justify-center" style={{ animationDelay: '0.5s' }}>
                 <div className="w-5 h-5 rounded-full bg-success shadow-sm" />
               </div>
               <span className="bg-white/80 backdrop-blur-sm px-2 py-1 rounded text-[10px] font-bold mt-1 shadow-sm">Kiambu Hub</span>
             </div>

             {/* Mombasa Marker */}
             <div className="absolute bottom-[20%] right-[30%] flex flex-col items-center">
               <div className="w-10 h-10 rounded-full bg-warning/20 animate-pulse-glow flex items-center justify-center" style={{ animationDelay: '1s' }}>
                 <div className="w-3 h-3 rounded-full bg-warning shadow-sm" />
               </div>
               <span className="bg-white/80 backdrop-blur-sm px-2 py-1 rounded text-[10px] font-bold mt-1 shadow-sm">Mombasa Island</span>
             </div>
          </div>
        </div>

        {/* Placeholder Overlay Text */}
        <div className="absolute inset-0 z-20 flex flex-col items-center justify-center pointer-events-none bg-white/10 backdrop-blur-[1px]">
          <div className="bg-white/95 backdrop-blur-md border border-border shadow-xl rounded-2xl p-6 text-center max-w-sm mx-auto pointer-events-auto">
            <div className="w-12 h-12 bg-primary/10 text-primary rounded-full flex items-center justify-center mx-auto mb-4">
              <MapPin className="w-6 h-6" />
            </div>
            <h3 className="text-lg font-bold text-gray-900">Mapbox Integration Pending</h3>
            <p className="text-sm text-gray-500 mt-2">
              The geospatial visualization engine requires production map tiles. This interactive view will render block-level pricing data.
            </p>
          </div>
        </div>

      </div>
    </div>
  );
};

export default HeatMaps;
