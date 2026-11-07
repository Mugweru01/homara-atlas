import { useState } from 'react';
import { useSearchParams, Link } from 'react-router-dom';
import { Search, MapPin, ArrowUpRight, ArrowRight } from 'lucide-react';
import { useCounties, exportCsv } from './data';
import { PageHeading, ExportButton, ErrorState, Loading, Status } from './primitives';
import KenyaMap from './KenyaMap';

const normalise = (name: string) => name.toLowerCase().replace(/county|city|[^a-z]/g, '');
export default function Counties() {
  const query = useCounties(),
    [search, setSearch] = useState(''),
    [params, setParams] = useSearchParams();
  const county = query.data?.find(
      (item) => normalise(item.name) === normalise(params.get('county') || '')
    ),
    counties = (query.data || []).filter((item) =>
      item.name.toLowerCase().includes(search.toLowerCase())
    );
  const select = (name: string) => {
    setParams({ county: name }, { replace: true });
  };
  return (
    <>
      <PageHeading
        eyebrow="County explorer"
        title="Explore Kenya’s counties"
        description="Explore Kenya’s administrative geography and understand the coverage."
      >
        <ExportButton
          disabled={!query.data?.length}
          onClick={() =>
            exportCsv(
              'atlas-counties.csv',
              ['County', 'County ID', 'Boundary reference year', 'Source'],
              (query.data || []).map((c) => [
                c.name,
                c.id,
                c.reference_year,
                'geoBoundaries / RCMRD',
              ])
            )
          }
        />
      </PageHeading>
      {query.isError && (
        <ErrorState message={query.error.message} retry={() => void query.refetch()} />
      )}
      <div className="county-workbench">
        <section className="county-directory">
          <div className="directory-heading">
            <h2>
              Counties <span>{query.data?.length ?? '—'}</span>
            </h2>
            <div className="search-field">
              <Search size={16} />
              <input
                aria-label="Search counties"
                placeholder="Find a county"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
            </div>
          </div>
          {query.isPending ? (
            <Loading />
          ) : (
            <div className="county-list" aria-label="County selection">
              {counties.map((c, i) => (
                <button
                  key={c.id}
                  className={county?.id === c.id ? 'selected' : ''}
                  aria-pressed={county?.id === c.id}
                  onClick={() => select(c.name)}
                >
                  <span className="county-number">{String(i + 1).padStart(2, '0')}</span>
                  <span>{c.name}</span>
                  <ArrowUpRight size={15} />
                </button>
              ))}
              {!counties.length && <p className="directory-empty">No counties match “{search}”.</p>}
            </div>
          )}
        </section>
        <section className="county-map-panel">
          <div className="county-map-title">
            <span className="small-label">Republic of Kenya</span>
            <Status muted>Administrative reference</Status>
          </div>
          <KenyaMap selected={county?.name} onSelect={select} />
          <p className="provenance">geoBoundaries · 2020 boundaries · Not a cadastral survey</p>
        </section>
        <aside className="county-inspector">
          <span className="inspector-icon">
            <MapPin size={24} />
          </span>
          <p className="eyebrow">{county ? 'County profile' : 'Explore the map'}</p>
          <h2>{county?.name || 'Choose a county'}</h2>
          <p>
            {county
              ? 'Administrative geography is available. Open market coverage to check published asking statistics for this county.'
              : 'Select a county on the map or from the directory to see its data coverage.'}
          </p>
          {county && (
            <>
              <dl className="detail-list">
                {county.code && (
                  <div>
                    <dt>County code</dt>
                    <dd>{county.code}</dd>
                  </div>
                )}
                {county.metadata?.region && (
                  <div>
                    <dt>Region (former province)</dt>
                    <dd>{county.metadata.region}</dd>
                  </div>
                )}
                {county.metadata?.capital && (
                  <div>
                    <dt>County capital</dt>
                    <dd>{county.metadata.capital}</dd>
                  </div>
                )}
                {county.metadata?.population_2019 && (
                  <div>
                    <dt>Population · 2019 census</dt>
                    <dd>{county.metadata.population_2019.toLocaleString()}</dd>
                  </div>
                )}
                <div>
                  <dt>Geographic level</dt>
                  <dd>County · ADM1</dd>
                </div>
                <div>
                  <dt>Boundary vintage</dt>
                  <dd>{county.reference_year}</dd>
                </div>
                <div>
                  <dt>Market statistics</dt>
                  <dd>Check market coverage</dd>
                </div>
                <div>
                  <dt>Source</dt>
                  <dd>geoBoundaries</dd>
                </div>
              </dl>
              {county.code && (
                <Link className="button secondary" to={`/locations?county_code=${county.code}`}>
                  Explore constituencies, wards and places <ArrowRight size={16} />
                </Link>
              )}
              <Link
                className="button primary"
                to={`/market?county=${encodeURIComponent(county.name)}`}
              >
                View market coverage <ArrowRight size={16} />
              </Link>
            </>
          )}
          <Link to="/sources?source=geoboundaries-ken-counties" className="text-link">
            Source and methodology <ArrowUpRight size={14} />
          </Link>
        </aside>
      </div>
    </>
  );
}
