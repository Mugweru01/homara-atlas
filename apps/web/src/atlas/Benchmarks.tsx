import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { ArrowUpRight } from 'lucide-react';
import { api, useCounties } from './data';
import { Loading, ErrorState, SectionTitle } from './primitives';
type Benchmark = {
  geography: string;
  market_type: string;
  period_end: string;
  median_price: string;
  sample_count: number | null;
  methodology: string;
  source_url: string;
  attribution: string;
  license: string;
  retrieved_at: string;
};
export default function Benchmarks() {
  const [type, setType] = useState('rent'),
    [county, setCounty] = useState('');
  const counties = useCounties();
  const query = useQuery({
    queryKey: ['atlas', 'benchmarks', type, county],
    queryFn: ({ signal }) =>
      api<{ results: Benchmark[]; notice: string }>(
        '/research/benchmarks?limit=100&market_type=' +
          type +
          (county ? '&county=' + encodeURIComponent(county) : ''),
        signal
      ),
  });
  const rows = query.data?.results || [];
  return (
    <section className="publisher-benchmarks">
      <SectionTitle
        title="Published market benchmarks"
        detail="Monthly figures from Kenya Property Centre. See Research studio → Data confidence for collection status. These publisher statistics are separate from Atlas estimates."
      />
      <div className="filter-bar">
        <label className="select-label">
          Market
          <select value={type} onChange={(e) => setType(e.target.value)}>
            <option value="rent">Monthly rent</option>
            <option value="sale">Sale asking prices</option>
            <option value="short_let">Short-let nightly rates</option>
          </select>
        </label>
        <label className="select-label">
          County
          <select value={county} onChange={(e) => setCounty(e.target.value)}>
            <option value="">National and all reported counties</option>
            {counties.data?.map((c) => (
              <option key={c.id} value={c.reference_name || c.name}>
                {c.reference_name || c.name}
              </option>
            ))}
          </select>
        </label>
      </div>
      {query.isPending ? (
        <Loading label="Loading licensed market benchmarks" />
      ) : query.isError ? (
        <ErrorState message={query.error.message} retry={() => void query.refetch()} />
      ) : rows.length ? (
        <>
          <div className="table-scroll">
            <table>
              <caption className="sr-only">
                Kenya Property Centre published asking-market benchmarks
              </caption>
              <thead>
                <tr>
                  <th>Geography</th>
                  <th>Reference month</th>
                  <th>Median asking figure</th>
                  <th>Publisher sample</th>
                  <th>Source</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((r) => (
                  <tr key={r.geography + ':' + r.market_type}>
                    <td>
                      <strong>{r.geography}</strong>
                    </td>
                    <td>
                      {new Intl.DateTimeFormat('en-KE', {
                        month: 'short',
                        year: 'numeric',
                        timeZone: 'Africa/Nairobi',
                      }).format(new Date(r.period_end))}
                    </td>
                    <td className="numeric">
                      KSh{' '}
                      {Number(r.median_price).toLocaleString('en-KE', { maximumFractionDigits: 0 })}
                      {r.market_type === 'rent'
                        ? '/month'
                        : r.market_type === 'short_let'
                          ? '/night'
                          : ''}
                    </td>
                    <td>
                      {r.sample_count === null
                        ? 'Not supplied in structured series'
                        : `${r.sample_count.toLocaleString()}${r.sample_count < 100 ? ' · small sample' : ''}`}
                    </td>
                    <td>
                      <a className="text-link" href={r.source_url} target="_blank" rel="noreferrer">
                        Read report <ArrowUpRight size={14} />
                      </a>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <details className="benchmark-methodology">
            <summary>Methodology, attribution and licence</summary>
            <p>{rows[0].attribution}</p>
            <p>
              {rows[0].license} · Figures reproduced from publisher structured data/table
              attributes. Source periods and population definitions are retained; publisher sample
              rules differ from Atlas.
            </p>
            {[...new Set(rows.map((r) => r.methodology))].map((m) => (
              <p key={m}>{m}</p>
            ))}
            <p>{query.data?.notice}</p>
          </details>
        </>
      ) : (
        <p className="directory-empty">
          No published benchmark matches this selection. Missing data is not zero; individual
          property inventory is a separate dataset.
        </p>
      )}
    </section>
  );
}
