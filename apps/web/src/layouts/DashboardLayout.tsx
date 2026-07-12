import { Outlet, Link } from "react-router-dom";
import { LayoutDashboard, Map, BarChart3, Settings, Database } from "lucide-react";

export const DashboardLayout = () => {
  return (
    <div className="flex h-screen bg-background text-foreground">
      {/* Sidebar */}
      <aside className="w-64 bg-surface-1 border-r border-border flex flex-col shadow-sm">
        <div className="p-6 border-b border-border flex items-center gap-3">
          <div className="w-8 h-8 bg-primary rounded-md flex items-center justify-center">
            <Map className="w-5 h-5 text-primary-foreground" />
          </div>
          <span className="font-bold text-xl tracking-tight text-primary">Homara Atlas</span>
        </div>
        
        <nav className="flex-1 p-4 space-y-2">
          <Link to="/" className="flex items-center gap-3 px-3 py-2 rounded-md bg-primary/10 text-primary font-medium">
            <LayoutDashboard className="w-5 h-5" />
            Overview
          </Link>
          <Link to="#" className="flex items-center gap-3 px-3 py-2 rounded-md hover:bg-gray-100 text-gray-700 transition-colors">
            <Map className="w-5 h-5" />
            Neighbourhoods
          </Link>
          <Link to="#" className="flex items-center gap-3 px-3 py-2 rounded-md hover:bg-gray-100 text-gray-700 transition-colors">
            <BarChart3 className="w-5 h-5" />
            Market Trends
          </Link>
          <Link to="#" className="flex items-center gap-3 px-3 py-2 rounded-md hover:bg-gray-100 text-gray-700 transition-colors">
            <Database className="w-5 h-5" />
            Data Sources
          </Link>
        </nav>

        <div className="p-4 border-t border-border">
          <Link to="#" className="flex items-center gap-3 px-3 py-2 rounded-md hover:bg-gray-100 text-gray-700 transition-colors">
            <Settings className="w-5 h-5" />
            Settings
          </Link>
        </div>
      </aside>

      {/* Main Content */}
      <main className="flex-1 flex flex-col overflow-hidden">
        {/* Header */}
        <header className="h-16 border-b border-border bg-surface-1 flex items-center justify-between px-8 shadow-sm">
          <h2 className="text-xl font-semibold text-gray-800">Intelligence Dashboard</h2>
          <div className="flex items-center gap-4">
            <div className="text-sm text-gray-500 font-medium bg-accent/20 text-accent-foreground px-3 py-1 rounded-full border border-accent/30">
              API Status: Healthy
            </div>
            <div className="w-9 h-9 rounded-full bg-gray-200 border-2 border-primary"></div>
          </div>
        </header>

        {/* Scrollable Content */}
        <div className="flex-1 overflow-auto p-8 bg-gray-50/50">
          <Outlet />
        </div>
      </main>
    </div>
  );
};
