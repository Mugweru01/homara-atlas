import { useState } from 'react';
import { Copy, Check, ArrowUpRight, Code2, LockKeyhole } from 'lucide-react';
import { Link } from 'react-router-dom';
import { API_BASE } from './data';
import { PageHeading } from './primitives';

export default function Developer() {
  const [copied, setCopied] = useState(false),
    base = API_BASE || window.location.origin;
  const code = `const response = await fetch(\n  "${base}/api/v1/context/indicators?limit=10"\n);\n\nif (!response.ok) throw new Error("Request failed");\nconst { results } = await response.json();`;
  return (
    <>
      <PageHeading
        eyebrow="Developer API"
        title="Atlas developer API"
        description="Access the public datasets that power the Atlas. No API key is required for public reads."
      />
      <section className="api-example">
        <div>
          <span className="inspector-icon">
            <Code2 size={24} />
          </span>
          <h2>Your first request</h2>
          <p>
            Fetch annual Kenya indicators, with reference years, units and attribution included.
          </p>
          <span className="method-tag">GET</span>
          <code>/api/v1/context/indicators</code>
        </div>
        <div className="code-panel">
          <div>
            <span>JavaScript</span>
            <button
              className="icon-button"
              aria-label="Copy example code"
              onClick={async () => {
                try {
                  await navigator.clipboard.writeText(code);
                  setCopied(true);
                  setTimeout(() => setCopied(false), 2000);
                } catch {
                  setCopied(false);
                }
              }}
            >
              {copied ? <Check size={16} /> : <Copy size={16} />}
            </button>
          </div>
          <pre>
            <code>{code}</code>
          </pre>
          <span role="status">
            {copied ? 'Copied to clipboard' : 'Public endpoint · JSON response'}
          </span>
        </div>
      </section>
      <section className="api-routes">
        <h2>Public endpoints</h2>
        <div className="table-scroll">
          <table>
            <thead>
              <tr>
                <th>Method</th>
                <th>Endpoint</th>
                <th>Purpose</th>
              </tr>
            </thead>
            <tbody>
              {[
                ['/system/data-health', 'Dataset freshness and source status'],
                ['/sources', 'Published sources, licences and attribution'],
                ['/geography/counties', 'County identifiers and boundary vintage'],
                [
                  '/geography/openapi.json',
                  'Machine-readable geographic API contract (OpenAPI 3.1)',
                ],
                [
                  '/geography/dataset',
                  'Location dataset version, licence, attribution and limitations',
                ],
                [
                  '/geography/constituencies?county_code=047',
                  'Constituencies filtered by county code',
                ],
                [
                  '/geography/wards?county_code=047',
                  'Wards; county_code, constituency_code, parent_id, limit, offset',
                ],
                ['/geography/sub-counties?county_code=047', 'Historical HDX/DHIS2 sub-counties'],
                [
                  '/geography/localities?county_code=047',
                  'Informal localities with provenance labels',
                ],
                [
                  '/geography/areas?county_code=047',
                  'Informal areas; filter by county_code or locality parent_id',
                ],
                [
                  '/geography/search?q=Westlands',
                  'Literal place-name and alias search; 2–80 characters, maximum 25 results',
                ],
                ['/context/indicators', 'Annual national observations; code, limit, offset'],
                ['/analytics/overview', 'Current asking-market coverage'],
                [
                  '/analytics/market',
                  'County asking-price segments; county, listing_type, limit, offset',
                ],
              ].map(([path, purpose]) => (
                <tr key={path}>
                  <td>
                    <span className="method-tag">GET</span>
                  </td>
                  <td>
                    <a href={`${base}/api/v1${path}`} target="_blank" rel="noreferrer">
                      <code>{path}</code>
                      <ArrowUpRight size={13} />
                    </a>
                  </td>
                  <td>{purpose}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
      <div className="api-notes">
        <article>
          <h3>Predictable boundaries</h3>
          <p>
            Pagination defaults to 50 and is capped at 100. Request budgets apply; respect HTTP 429
            and the Retry-After header. Unavailable estimates are null, never invented zeroes.
            Geography reads share an additional budget of 180 requests per minute. Codes retain
            leading zeroes. Unknown or repeated query parameters are rejected.
          </p>
        </article>
        <article>
          <h3>
            <LockKeyhole size={16} />
            Private endpoints
          </h3>
          <p>
            Reports require a signed-in account. Source administration requires a server-assigned
            operator role. Public access does not include private reports or ingestion controls.
          </p>
        </article>
        <article>
          <h3>Attribution travels with the data</h3>
          <p>Respect each publisher’s licence when displaying or distributing observations.</p>
          <Link className="text-link" to="/sources">
            Review source terms <ArrowUpRight size={14} />
          </Link>
        </article>
      </div>
    </>
  );
}
