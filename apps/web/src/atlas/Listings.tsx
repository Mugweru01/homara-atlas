import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { ArrowUpRight, ArrowRight } from 'lucide-react';
import { api, useCounties, date } from './data';
import { PageHeading, ErrorState, Loading } from './primitives';
type Listing = {
  id: string;
  source_url: string;
  observed_at: string;
  listing_type: string;
  property_type: string;
  bedrooms: number | null;
  bathrooms: number | null;
  price_amount: string;
  rent_period: string | null;
  county: string;
  source: string;
  attribution: string;
};
type Collection = {
  reviews: { slug: string; name: string; terms_url: string; decision: string; reason: string }[];
  collectors: {
    slug: string;
    name: string;
    data_kind: string;
    last_success_at: string | null;
    last_job_status: string | null;
    error_code: string | null;
    pending_pages: number;
    accepted_count: number | null;
    rejected_count: number | null;
    duplicate_count: number | null;
  }[];
};
export default function Listings() {
  const counties = useCounties(),
    [county, setCounty] = useState(''),
    [type, setType] = useState('rent'),
    [offset, setOffset] = useState(0);
  const query = useQuery({
    queryKey: ['atlas', 'public-listings', county, type, offset],
    queryFn: ({ signal }) =>
      api<{ results: Listing[]; has_more: boolean; notice: string }>(
        '/listings?limit=25&offset=' +
          offset +
          '&listing_type=' +
          type +
          (county ? '&county_id=' + encodeURIComponent(county) : ''),
        signal
      ),
  });
  const collection = useQuery({
    queryKey: ['atlas', 'collection-sources'],
    queryFn: ({ signal }) => api<Collection>('/collection/sources', signal),
  });
  return (
    <>
      <PageHeading
        eyebrow="Public advertisements"
        title="Property listings"
        description="Fresh adverts from sources approved for public display. Confidential property feeds are never included."
      />
      <div className="filter-bar">
        <label className="select-label">
          Market
          <select
            value={type}
            onChange={(e) => {
              setType(e.target.value);
              setOffset(0);
            }}
          >
            <option value="rent">For rent · monthly</option>
            <option value="sale">For sale</option>
          </select>
        </label>
        <label className="select-label">
          County
          <select
            value={county}
            onChange={(e) => {
              setCounty(e.target.value);
              setOffset(0);
            }}
          >
            <option value="">All counties</option>
            {counties.data?.map((c) => (
              <option key={c.id} value={c.id}>
                {c.reference_name || c.name}
              </option>
            ))}
          </select>
        </label>
      </div>
      {query.isPending ? (
        <Loading label="Loading approved public listings" />
      ) : query.isError ? (
        <ErrorState message={query.error.message} retry={() => void query.refetch()} />
      ) : query.data.results.length ? (
        <>
          <div className="public-listing-grid">
            {query.data.results.map((r) => (
              <article className="public-listing" key={r.id}>
                <span className="eyebrow">
                  {r.county} · {r.listing_type === 'rent' ? 'Monthly rental' : 'For sale'}
                </span>
                <h2>
                  {r.bedrooms !== null ? `${r.bedrooms} bedroom ` : ''}
                  {r.property_type}
                </h2>
                <strong className="listing-price">
                  KSh {Number(r.price_amount).toLocaleString('en-KE')}
                  {r.listing_type === 'rent' ? '/month' : ''}
                </strong>
                <p>
                  {r.bathrooms !== null ? `${r.bathrooms} bathrooms · ` : ''}Observed{' '}
                  {date(r.observed_at)}
                </p>
                <a className="text-link" href={r.source_url} target="_blank" rel="noreferrer">
                  View original advertisement <ArrowUpRight size={15} />
                </a>
                <p className="provenance">{r.attribution}</p>
              </article>
            ))}
          </div>
          <div className="market-pagination">
            <span>
              {offset + 1}–{offset + query.data.results.length} · Asking prices, not completed
              transactions
            </span>
            <button
              className="button secondary"
              disabled={!offset}
              onClick={() => setOffset((x) => Math.max(0, x - 25))}
            >
              Previous
            </button>
            <button
              className="button secondary"
              disabled={!query.data.has_more}
              onClick={() => setOffset((x) => x + 25)}
            >
              Next
            </button>
          </div>
        </>
      ) : (
        <section className="listing-empty">
          <p className="eyebrow">Public inventory</p>
          <h2>No approved public advertisements in this view.</h2>
          <p>
            Collection and public display require a permitted source. Confidential feeds stay
            hidden. Published market statistics are available separately and do not represent
            imported individual listings.
          </p>
          <Link className="button primary" to="/market">
            View published market benchmarks <ArrowRight size={16} />
          </Link>
        </section>
      )}
      <section className="collection-sources">
        <div className="section-heading">
          <div>
            <h2>Collection and source permissions</h2>
            <p>
              Daily cycles resume from durable checkpoints. Exact source IDs and URL conflicts
              prevent duplicate advertisements; uncertain cross-site property matches require
              review.
            </p>
          </div>
        </div>
        {collection.isPending ? (
          <Loading label="Checking public source permissions" />
        ) : collection.isError ? (
          <ErrorState message={collection.error.message} retry={() => void collection.refetch()} />
        ) : (
          <>
            {collection.data.collectors.map((c) => (
              <div className="collector-status" key={c.slug}>
                <strong>{c.name}</strong>
                <span>
                  {c.data_kind === 'context' ? 'Published statistics' : 'Public listing collection'}{' '}
                  · Last successful collection: {date(c.last_success_at)} ·{' '}
                  {c.last_job_status || 'Awaiting first run'}
                  {c.pending_pages ? ` · ${c.pending_pages} pages queued` : ''}
                  {c.accepted_count !== null
                    ? ` · ${c.accepted_count} new records · ${c.duplicate_count || 0} repeated · ${c.rejected_count || 0} quarantined`
                    : ''}
                  {c.error_code ? ` · ${c.error_code}` : ''}
                </span>
              </div>
            ))}
            <div className="table-scroll">
              <table>
                <caption className="sr-only">Reviewed public collection sources</caption>
                <thead>
                  <tr>
                    <th>Source</th>
                    <th>Collection scope</th>
                    <th>Review</th>
                  </tr>
                </thead>
                <tbody>
                  {collection.data.reviews.map((s) => (
                    <tr key={s.slug}>
                      <td>
                        <a href={s.terms_url} target="_blank" rel="noreferrer">
                          {s.name} <ArrowUpRight size={12} />
                        </a>
                      </td>
                      <td>
                        {s.decision === 'allowed_market_statistics'
                          ? 'Published statistics only; listing inventory excluded'
                          : 'Permission required; collection disabled'}
                      </td>
                      <td>{s.reason}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </>
        )}
      </section>
    </>
  );
}
