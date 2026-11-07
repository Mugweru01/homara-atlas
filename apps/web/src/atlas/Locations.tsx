import { useEffect, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Link, useSearchParams } from 'react-router-dom';
import { ArrowRight, ArrowUpRight, Download, Search, X } from 'lucide-react';
import { api, useCounties, exportCsv } from './data';
import { PageHeading, Loading, ErrorState } from './primitives';
type Place = {
  id: string;
  name: string;
  kind: string;
  code: string | null;
  county_code: string;
  provenance_class: string;
  metadata: Record<string, string | number | string[]>;
};
type Dataset = {
  version: string;
  revision: string;
  attribution: string;
  repository: string;
  license: string;
  counts: Record<string, number>;
};
const levels = [
  ['county', 'Counties', 'counties'],
  ['constituency', 'Constituencies', 'constituencies'],
  ['ward', 'Wards', 'wards'],
  ['sub_county', 'Sub-counties', 'sub_counties'],
  ['locality', 'Localities', 'localities'],
  ['area', 'Areas', 'areas'],
] as const;
export default function Locations() {
  const [params, setParams] = useSearchParams(),
    kind = levels.some((x) => x[0] === params.get('kind')) ? params.get('kind')! : 'county',
    county = params.get('county_code') || '',
    region = params.get('region') || '',
    q = params.get('q') || '',
    parent = params.get('parent_id') || '',
    offset = Math.max(0, Math.min(10000, Math.floor(Number(params.get('offset')) || 0))),
    selected = params.get('place') || '';
  const [draft, setDraft] = useState(q);
  useEffect(() => setDraft(q), [q]);
  const counties = useCounties();
  const regions = useQuery({
    queryKey: ['atlas', 'regions'],
    queryFn: ({ signal }) =>
      api<{ results: { name: string; counties: number }[] }>('/geography/regions', signal),
  });
  const filters = new URLSearchParams({ kind, limit: '25', offset: String(offset) });
  if (county) filters.set('county_code', county);
  if (region) filters.set('region', region);
  if (q) filters.set('q', q);
  if (parent) filters.set('parent_id', parent);
  const query = useQuery({
    queryKey: ['atlas', 'locations', filters.toString()],
    queryFn: ({ signal }) =>
      api<{ results: Place[]; has_more: boolean; dataset: Dataset }>(
        `/geography/${q ? 'search' : 'places'}?${filters}`,
        signal
      ),
  });
  const detail = useQuery({
    queryKey: ['atlas', 'location-detail', selected],
    enabled: Boolean(selected),
    queryFn: ({ signal }) =>
      api<{
        result: Place;
        parents: { id: string; kind: string; name: string; method: string }[];
        dataset: Dataset;
      }>('/geography/places/' + encodeURIComponent(selected), signal),
  });
  const update = (values: Record<string, string>) => {
    const next = new URLSearchParams(params);
    next.delete('offset');
    next.delete('place');
    for (const [k, v] of Object.entries(values))
      if (v) next.set(k, v);
      else next.delete(k);
    setParams(next);
  };
  const data = query.data,
    active = detail.data?.result,
    countyName = (code: string) =>
      counties.data?.find((c) => c.code === code)?.reference_name ||
      counties.data?.find((c) => c.code === code)?.name ||
      code;
  return (
    <>
      <PageHeading
        eyebrow="Geographic reference"
        title="Every place, in context."
        description="Browse all imported counties, constituencies, wards, sub-counties, localities and areas. Regions are historical province groupings."
      >
        <button
          className="button secondary"
          disabled={!data?.results.length}
          onClick={() =>
            data &&
            exportCsv(
              'atlas-locations.csv',
              ['Name', 'Level', 'Code', 'County', 'Provenance', 'Source', 'Licence', 'Revision'],
              data.results.map((p) => [
                p.name,
                p.kind,
                p.code,
                countyName(p.county_code),
                p.provenance_class,
                data.dataset.attribution,
                data.dataset.license,
                data.dataset.revision,
              ])
            )
          }
        >
          <Download size={16} /> Export this page
        </button>
      </PageHeading>
      <p className="provenance">
        The totals below describe the full imported snapshot. Region, county and search filters
        apply to the results.
      </p>
      <div className="location-levels" role="group" aria-label="Location level">
        {levels.map(([value, label, countKey]) => (
          <button
            key={value}
            aria-pressed={kind === value}
            onClick={() => update({ kind: value, parent_id: '' })}
          >
            <strong>{data?.dataset.counts[countKey]?.toLocaleString() ?? '—'}</strong>
            <span>{label}</span>
          </button>
        ))}
      </div>
      <div className="filter-bar location-filters">
        <label className="select-label">
          Region (former province)
          <select
            value={region}
            onChange={(e) => update({ region: e.target.value, county_code: '', parent_id: '' })}
          >
            <option value="">All regions</option>
            {regions.data?.results.map((r) => (
              <option key={r.name} value={r.name}>
                {r.name} · {r.counties} {r.counties === 1 ? 'county' : 'counties'}
              </option>
            ))}
          </select>
        </label>
        <label className="select-label">
          County
          <select
            value={county}
            onChange={(e) => update({ county_code: e.target.value, parent_id: '' })}
          >
            <option value="">All counties</option>
            {counties.data
              ?.filter((c) => !region || c.metadata?.region === region)
              .map((c) => (
                <option key={c.id} value={c.code}>
                  {c.reference_name || c.name}
                </option>
              ))}
          </select>
        </label>
        <form
          className="search-field"
          onSubmit={(e) => {
            e.preventDefault();
            update({ q: draft.trim(), parent_id: '' });
          }}
        >
          <Search size={16} />
          <input
            aria-label="Search location names"
            placeholder="Find a place or county alias"
            value={draft}
            minLength={2}
            maxLength={80}
            onChange={(e) => setDraft(e.target.value)}
          />
          <button type="submit" className="text-link">
            Search
          </button>
        </form>
        {(q || county || region || parent) && (
          <button
            className="button secondary"
            onClick={() => {
              setDraft('');
              setParams({ kind });
            }}
          >
            <X size={15} />
            Clear filters
          </button>
        )}
      </div>
      {regions.isError && (
        <ErrorState
          title="Region filters are unavailable"
          message={regions.error.message}
          retry={() => void regions.refetch()}
        />
      )}
      {query.isPending ? (
        <Loading label="Loading location reference" />
      ) : query.isError ? (
        <ErrorState message={query.error.message} retry={() => void query.refetch()} />
      ) : (
        <>
          <section className="location-results">
            <div className="section-heading">
              <div>
                <h2>{levels.find((l) => l[0] === kind)?.[1]}</h2>
                <p>
                  {parent
                    ? 'Showing direct children of the selected place.'
                    : 'Public reference names and relationships; all records are accessible through pagination.'}
                </p>
              </div>
              <Link className="text-link" to="/counties">
                County map <ArrowUpRight size={15} />
              </Link>
            </div>
            <div className="table-scroll">
              <table>
                <caption className="sr-only">Location reference results</caption>
                <thead>
                  <tr>
                    <th>Place</th>
                    <th>Code</th>
                    <th>County</th>
                    <th>Reference quality</th>
                    <th>Details</th>
                  </tr>
                </thead>
                <tbody>
                  {data?.results.map((p) => (
                    <tr key={p.id}>
                      <td>
                        <strong>{p.name}</strong>
                      </td>
                      <td>{p.code || '—'}</td>
                      <td>{countyName(p.county_code)}</td>
                      <td>
                        {p.provenance_class === 'informal_unverified'
                          ? 'Informal · provenance incomplete'
                          : p.provenance_class === 'third_party_historical'
                            ? 'Historical DHIS2 reference'
                            : 'Electoral reference'}
                      </td>
                      <td>
                        <button
                          className="text-link"
                          onClick={() => {
                            const next = new URLSearchParams(params);
                            next.set('place', p.id);
                            setParams(next);
                          }}
                        >
                          View {p.name}
                          <ArrowRight size={14} />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            {!data?.results.length && (
              <p className="directory-empty">
                No imported places match these filters. Missing reference coverage does not mean a
                place does not exist.
              </p>
            )}
            <div className="market-pagination">
              <span>
                {data?.results.length ? `${offset + 1}–${offset + data.results.length}` : '0'}{' '}
                results in this view
              </span>
              <button
                className="button secondary"
                disabled={!offset}
                onClick={() => {
                  const next = new URLSearchParams(params);
                  next.set('offset', String(Math.max(0, offset - 25)));
                  next.delete('place');
                  setParams(next);
                }}
              >
                Previous
              </button>
              <button
                className="button secondary"
                disabled={!data?.has_more}
                onClick={() => {
                  const next = new URLSearchParams(params);
                  next.set('offset', String(offset + 25));
                  next.delete('place');
                  setParams(next);
                }}
              >
                Next
              </button>
            </div>
          </section>
          {selected && (
            <section className="location-detail" aria-label="Selected location detail">
              <div className="section-heading">
                <h2>{active?.name || 'Location detail'}</h2>
                <button
                  className="icon-button"
                  aria-label="Close location detail"
                  onClick={() => {
                    const next = new URLSearchParams(params);
                    next.delete('place');
                    setParams(next);
                  }}
                >
                  <X size={20} />
                </button>
              </div>
              {detail.isPending ? (
                <Loading />
              ) : detail.isError ? (
                <ErrorState message={detail.error.message} />
              ) : (
                active && (
                  <>
                    <dl className="detail-list">
                      <div>
                        <dt>Level</dt>
                        <dd>{levels.find((l) => l[0] === active.kind)?.[1]}</dd>
                      </div>
                      <div>
                        <dt>County</dt>
                        <dd>{countyName(active.county_code)}</dd>
                      </div>
                      {Object.entries(active.metadata).map(([key, value]) => (
                        <div key={key}>
                          <dt>{key.replace(/_/g, ' ')}</dt>
                          <dd>
                            {Array.isArray(value)
                              ? value.join(', ') || 'None recorded'
                              : typeof value === 'number'
                                ? value.toLocaleString()
                                : value}
                          </dd>
                        </div>
                      ))}
                    </dl>
                    <h3>Recorded parents</h3>
                    <div className="location-parents">
                      {detail.data?.parents.map((p) => (
                        <button
                          className="button secondary"
                          key={p.id}
                          onClick={() => {
                            const next = new URLSearchParams(params);
                            next.set('place', p.id);
                            setParams(next);
                          }}
                        >
                          {p.name} · {p.kind.replace(/_/g, ' ')} · {p.method}
                        </button>
                      ))}
                      {!detail.data?.parents.length && <p>Top-level county reference.</p>}
                    </div>
                    {!['ward', 'area'].includes(active.kind) && (
                      <button
                        className="button primary"
                        onClick={() =>
                          update({
                            kind:
                              active.kind === 'county'
                                ? 'constituency'
                                : active.kind === 'locality'
                                  ? 'area'
                                  : 'ward',
                            county_code: active.county_code,
                            parent_id: active.id,
                            q: '',
                          })
                        }
                      >
                        Explore related places <ArrowRight size={16} />
                      </button>
                    )}
                  </>
                )
              )}
            </section>
          )}
          <p className="provenance">
            {data?.dataset.attribution} · {data?.dataset.license} · Version {data?.dataset.version}.
            County populations refer to 2019. Informal places have incomplete coverage; some
            ward-to-sub-county links are inferred.{' '}
            <Link to="/sources?source=kenya-locations">Source and limitations</Link>
          </p>
        </>
      )}
    </>
  );
}
