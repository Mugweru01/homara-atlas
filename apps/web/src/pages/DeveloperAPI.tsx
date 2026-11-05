export default function DeveloperAPI() {
  const base = import.meta.env.VITE_API_URL || window.location.origin;
  return (
    <div className="space-y-6 max-w-3xl">
      <h1 className="text-3xl font-bold">Property intelligence API</h1>
      <p>
        Public analytics are derived from the imported listings warehouse. An empty warehouse
        returns zero coverage and empty result lists.
      </p>
      <ul className="space-y-3">
        {[
          '/api/v1/system/health',
          '/api/v1/analytics/overview',
          '/api/v1/analytics/price-index',
          '/api/v1/analytics/neighbourhoods',
        ].map((path) => (
          <li key={path}>
            <a
              className="text-primary underline"
              href={`${base}${path}`}
              target="_blank"
              rel="noreferrer"
            >
              GET {path}
            </a>
          </li>
        ))}
      </ul>
      <h2 className="text-xl font-semibold">Private reports</h2>
      <p>
        Workspace routes require a signed-in user's bearer JWT from Neon Auth. Each report is scoped
        to that user. Download links expire after 60 seconds.
      </p>
      <pre className="p-4 border rounded-xl overflow-auto">{`GET  /api/v1/workspace/reports\nPOST /api/v1/workspace/reports\nGET  /api/v1/workspace/reports/:id\nPOST /api/v1/workspace/reports/live`}</pre>
      <p>
        POST a report with a title (up to 120 characters) and plain text content (up to 10,000
        characters). The live endpoint returns a short-lived sealed query; renew it through the same
        authenticated route.
      </p>
    </div>
  );
}
