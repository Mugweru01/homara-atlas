import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { api, useCounties } from './data';
import { SectionTitle, Loading, ErrorState } from './primitives';
export default function Activity({ ids, market }: { ids: string[]; market: string }) {
  const [days, setDays] = useState('30'),
    q = useQuery({
      queryKey: ['atlas', 'activity', ids.join(','), market, days],
      enabled: market !== 'short_let',
      queryFn: ({ signal }) =>
        api<{
          results: {
            county_id: string;
            sample_count: number;
            source_count: number;
            sparse: boolean;
            newly_observed: number | null;
            explicitly_withdrawn: number | null;
            latest_price_reductions: number | null;
            median_observed_days: number | null;
          }[];
          notice: string;
        }>(
          '/research/intelligence/liquidity?county_ids=' +
            ids.join(',') +
            '&market_type=' +
            market +
            '&days=' +
            days,
          signal
        ),
    }),
    counties = useCounties();
  return (
    <section className="research-section">
      <SectionTitle
        title="Observed market activity"
        detail="Supply and advert activity can inform research. They cannot establish buyer demand, completed sales or how quickly a property will sell."
      />
      <label className="select-label">
        Observation window
        <select value={days} onChange={(e) => setDays(e.target.value)}>
          <option value="30">30 days</option>
          <option value="90">90 days</option>
        </select>
      </label>
      {market === 'short_let' ? (
        <p className="research-empty">Activity measurements support sale and monthly rent only.</p>
      ) : q.isPending ? (
        <Loading />
      ) : q.isError ? (
        <ErrorState message={q.error.message} />
      ) : (
        <>
          <div className="table-scroll">
            <table>
              <caption>
                Activity metrics require at least 30 distinct reviewed entities per county
              </caption>
              <thead>
                <tr>
                  <th>County</th>
                  <th>Fresh observed adverts</th>
                  <th>Sources</th>
                  <th>Newly observed</th>
                  <th>Explicit withdrawals</th>
                  <th>Latest price reductions</th>
                  <th>Median observed duration</th>
                </tr>
              </thead>
              <tbody>
                {ids.map((id) => {
                  const r = q.data?.results.find((r) => r.county_id === id);
                  return (
                    <tr key={id}>
                      <th>{counties.data?.find((c) => c.id === id)?.name}</th>
                      <td>{r?.sample_count ?? 0}</td>
                      <td>{r?.source_count ?? 0}</td>
                      <td>{r?.newly_observed ?? 'Insufficient evidence'}</td>
                      <td>{r?.explicitly_withdrawn ?? 'Insufficient evidence'}</td>
                      <td>{r?.latest_price_reductions ?? 'Insufficient evidence'}</td>
                      <td>
                        {r?.median_observed_days == null
                          ? 'Insufficient evidence'
                          : Number(r.median_observed_days).toFixed(1) + ' days'}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          <p className="research-note">
            {q.data?.notice} Zero describes Atlas coverage, not the size of the housing market.
          </p>
        </>
      )}
    </section>
  );
}
