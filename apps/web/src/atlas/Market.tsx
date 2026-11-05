import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Link, useSearchParams } from 'react-router-dom';
import { Building2, ArrowRight, Check, LockKeyhole, Info } from 'lucide-react';
import { api, useCounties, useSources, type MarketCell, exportCsv } from './data';
import { PageHeading, Status, ErrorState, Loading, ExportButton } from './primitives';

export default function Market() {
  const counties = useCounties(),
    sources = useSources(),
    [params, setParams] = useSearchParams(),
    [type, setType] = useState('rent'),
    [page, setPage] = useState(0);
  const county = params.get('county') || '';
  const query = useQuery({
    queryKey: ['atlas', 'market', county, type, page],
    queryFn: ({ signal }) =>
      api<{ results: MarketCell[] }>(
        `/analytics/market?limit=100&offset=${page * 100}&listing_type=${type}${county ? '&county=' + encodeURIComponent(county) : ''}`,
        signal
      ),
  });
  const cells = query.data?.results || [];
  const hasFeed = sources.data?.some((s) => s.data_kind === 'listings');
  return (
    <>
      <PageHeading
        eyebrow="Property market"
        title="Property market"
        description="County-level asking statistics, published only when the evidence is sufficient."
      >
        <Status muted={!sources.data?.some((s) => s.data_kind === 'listings')}>
          {sources.data?.some((s) => s.data_kind === 'listings')
            ? 'Listing source available'
            : sources.data
              ? 'Listing feed pending'
              : 'Checking source coverage'}
        </Status>
      </PageHeading>
      <div className="filter-bar">
        <div className="segmented" role="group" aria-label="Listing type">
          <button
            aria-pressed={type === 'rent'}
            onClick={() => {
              setType('rent');
              setPage(0);
            }}
          >
            For rent
          </button>
          <button
            aria-pressed={type === 'sale'}
            onClick={() => {
              setType('sale');
              setPage(0);
            }}
          >
            For sale
          </button>
        </div>
        <label className="select-label">
          County
          <select
            value={county}
            onChange={(e) => {
              setParams(e.target.value ? { county: e.target.value } : {});
              setPage(0);
            }}
          >
            <option value="">All counties</option>
            {counties.data?.map((c) => (
              <option key={c.id} value={c.name}>
                {c.name}
              </option>
            ))}
          </select>
        </label>
        {cells.length > 0 && (
          <ExportButton
            onClick={() =>
              exportCsv(
                'atlas-market.csv',
                ['County', 'Type', 'Property type', 'Sample', 'Median KES'],
                cells.map((c) => [
                  c.county,
                  c.listing_type,
                  c.property_type,
                  c.listing_count,
                  c.median_price,
                ])
              )
            }
          />
        )}
      </div>
      {query.isPending ? (
        <Loading label="Checking market coverage" />
      ) : query.isError ? (
        <ErrorState message={query.error.message} retry={() => void query.refetch()} />
      ) : !cells.length ? (
        <section className="market-empty">
          <div className="empty-illustration" aria-hidden="true">
            <div className="building-lines">
              <Building2 size={64} strokeWidth={1} />
            </div>
            <span>
              <LockKeyhole size={19} />
            </span>
          </div>
          <span className="small-label">
            {county || 'Kenya'} · {type === 'rent' ? 'Rental' : 'Sale'} market
          </span>
          <h2>
            Property data is
            <br />
            not available yet.
          </h2>
          <p>
            {hasFeed || page > 0
              ? 'No published observations match this selection. Try another county or listing type. Estimates require sufficient fresh observations.'
              : `No approved property feed is available${county ? ` for ${county}` : ''} yet. Asking statistics will appear when licensed observations meet the quality and sample checks.`}
          </p>
          <Link to="/sources" className="button primary">
            Explore available data <ArrowRight size={16} />
          </Link>
          <Link to="/context" className="text-link">
            View national context <ArrowRight size={14} />
          </Link>
        </section>
      ) : (
        <div className="table-scroll market-table">
          <table>
            <caption className="sr-only">County asking-price statistics</caption>
            <thead>
              <tr>
                <th>County</th>
                <th>Property type</th>
                <th>Bedrooms</th>
                <th>Sample</th>
                <th>Median asking price</th>
              </tr>
            </thead>
            <tbody>
              {cells.map((cell, i) => (
                <tr key={i}>
                  <td>{cell.county}</td>
                  <td>{cell.property_type}</td>
                  <td>{cell.bedrooms < 0 ? 'Unknown' : cell.bedrooms}</td>
                  <td>{cell.listing_count}</td>
                  <td className="numeric">
                    {cell.median_price === null
                      ? 'Insufficient sample'
                      : `KSh ${Number(cell.median_price).toLocaleString('en-KE')}${type === 'rent' ? '/mo' : ''}`}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      {(cells.length > 0 || page > 0) && (
        <div className="market-pagination">
          <span>Page {page + 1} · Export includes the displayed page</span>
          <button
            className="button secondary"
            disabled={!page || query.isPending}
            onClick={() => setPage((n) => n - 1)}
          >
            Previous
          </button>
          <button
            className="button secondary"
            disabled={cells.length < 100 || query.isPending}
            onClick={() => setPage((n) => n + 1)}
          >
            Next
          </button>
        </div>
      )}
      <section className="publication-rules">
        <div>
          <Info size={19} />
          <h3>What makes a published estimate?</h3>
        </div>
        <ul>
          <li>
            <Check size={16} />
            Approved source with reuse rights
          </li>
          <li>
            <Check size={16} />
            At least 30 observations per segment
          </li>
          <li>
            <Check size={16} />
            Active observations within 14 days
          </li>
          <li>
            <Check size={16} />
            Sales and monthly rent kept separate
          </li>
        </ul>
        <p>
          Asking prices are not completed transaction prices. Missing data is never represented as
          zero.
        </p>
      </section>
    </>
  );
}
