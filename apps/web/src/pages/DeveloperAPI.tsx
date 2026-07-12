const DeveloperAPI = () => {
  const API_BASE = import.meta.env.VITE_API_URL ?? "http://localhost:8000";
  
  return (
    <div className="space-y-6 animate-fade-in">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Property Intelligence API</h1>
        <p className="text-gray-500 mt-1">Enable developers to build applications on top of Atlas data.</p>
      </div>
      
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div className="bg-surface-1 rounded-2xl border border-border shadow-sm p-6 flex flex-col gap-4">
          <h2 className="text-xl font-semibold">REST API Access</h2>
          <p className="text-gray-600">
            Homara Atlas provides a robust REST API for querying aggregated real estate metrics, price indices, and neighbourhood intelligence.
          </p>
          <a 
            href={`${API_BASE}/docs`} 
            target="_blank" 
            rel="noreferrer"
            className="mt-auto bg-primary hover:bg-primary-600 text-white px-4 py-2.5 rounded-xl font-medium transition-colors text-center shadow-sm"
          >
            View Swagger Documentation
          </a>
        </div>
        
        <div className="bg-surface-1 rounded-2xl border border-border shadow-sm p-6 flex flex-col gap-4">
          <h2 className="text-xl font-semibold">Authentication</h2>
          <p className="text-gray-600">
            Public endpoints are available without authentication for the beta period. Enterprise datasets require an API key passed via the <code className="bg-gray-100 px-1.5 py-0.5 rounded text-sm font-mono text-gray-800">X-API-Key</code> header.
          </p>
          <button className="mt-auto border border-border hover:bg-gray-50 text-foreground px-4 py-2.5 rounded-xl font-medium transition-colors text-center">
            Request API Key
          </button>
        </div>
      </div>
    </div>
  );
};
export default DeveloperAPI;
