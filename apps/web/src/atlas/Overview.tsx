import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import {
  ArrowRight,
  ArrowUpRight,
  Globe2,
  MapPin,
  Database,
  CalendarDays,
  ShieldCheck,
  ChevronRight,
} from 'lucide-react';
import {
  useCounties,
  useIndicators,
  useSources,
  useHealth,
  useMarketOverview,
  indicatorDefinitions,
  series,
  date,
  exportCsv,
} from './data';
import {
  PageHeading,
  Status,
  SectionTitle,
  Provenance,
  ExportButton,
  ErrorState,
  Loading,
} from './primitives';
import KenyaMap from './KenyaMap';
import Trend from './Trend';

export default function Overview() {
  const counties = useCounties(),
    indicators = useIndicators(),
    sources = useSources(),
    health = useHealth(),
    market = useMarketOverview(),
    navigate = useNavigate();
  const [metric, setMetric] = useState(0),
    definition = indicatorDefinitions[metric],
    observations = series(indicators.data, definition.code),
    latest = observations[observations.length - 1];
  const exportData = () =>
    exportCsv(
      'atlas-kenya-context.csv',
      ['Indicator', 'Year', 'Value', 'Unit', 'Attribution'],
      (indicators.data || []).map((r) => [
        r.indicator_name,
        r.reference_year,
        r.value,
        r.unit,
        r.attribution,
      ])
    );
  return (
    <>
      <PageHeading
        eyebrow="Research overview"
        title="Kenya, in context."
        description="Explore the geography, people and economic signals behind the market."
      >
        <ExportButton onClick={exportData} disabled={!indicators.data?.length} />
      </PageHeading>
      <div className="overview-summary">
        <div className="scope-tag">
          <Globe2 size={15} />
          <span>Kenya</span>
          <span className="scope-separator" />
          National coverage
        </div>
        <Status muted={health.data?.status !== 'current'}>
          {health.data?.status === 'current' ? 'Collection active' : 'Checking source freshness'}
        </Status>
      </div>
      <section className="metric-strip" aria-label="Dataset coverage">
        {[
          {
            label: 'Counties mapped',
            value: counties.data?.length.toString(),
            note: 'Administrative boundaries',
            icon: MapPin,
          },
          {
            label: 'Annual observations',
            value: indicators.data?.length.toString(),
            note: 'Four national indicators',
            icon: CalendarDays,
          },
          {
            label: 'Public data sources',
            value: sources.data?.length.toString(),
            note: 'With recorded attribution',
            icon: Database,
          },
          {
            label: 'Property market',
            value: market.data
              ? market.data.total_listings > 0
                ? market.data.total_listings.toLocaleString('en-KE')
                : 'Awaiting data'
              : undefined,
            note:
              market.data?.total_listings > 0
                ? 'Published asking observations'
                : sources.data?.some((s) => s.data_kind === 'listings')
                  ? 'Awaiting sufficient observations'
                  : sources.data
                    ? 'No approved listing feed yet'
                    : 'Checking listing coverage',
            icon: ShieldCheck,
          },
        ].map((item, i) => (
          <div className={`metric ${i === 3 ? 'metric-text' : ''}`} key={item.label}>
            <div className="metric-label">
              {item.label}
              <item.icon size={16} />
            </div>
            <strong>{item.value ?? '—'}</strong>
            <span>{item.note}</span>
          </div>
        ))}
      </section>
      {(counties.isError || indicators.isError) && (
        <ErrorState
          message="Some datasets could not be loaded. The figures below only show available observations."
          retry={() => {
            void counties.refetch();
            void indicators.refetch();
          }}
        />
      )}
      <div className="overview-workbench">
        <section className="map-panel">
          <SectionTitle
            title="A view across Kenya"
            detail="47 counties. One place to start."
            to="/counties"
          />
          <div className="map-context">
            <span className="small-label">County boundaries</span>
            <span>2020 vintage</span>
          </div>
          <KenyaMap onSelect={(name) => navigate(`/counties?county=${encodeURIComponent(name)}`)} />
          <div className="map-panel-bottom">
            <span>
              <span className="legend-swatch" />
              Administrative coverage
            </span>
            <Link to="/counties">
              Explore counties <ArrowRight size={15} />
            </Link>
          </div>
        </section>
        <section className="context-panel">
          <SectionTitle
            title="National signals"
            detail="Annual context, directly from the source."
            to="/context"
          />
          <div className="metric-tabs" role="group" aria-label="Choose national indicator">
            {indicatorDefinitions.map((item, i) => (
              <button key={item.code} aria-pressed={metric === i} onClick={() => setMetric(i)}>
                {item.short}
              </button>
            ))}
          </div>
          <div className="signal-reading">
            <div>
              <p>{definition.title}</p>
              <strong>{latest ? definition.format(Number(latest.value)) : '—'}</strong>
            </div>
            <span className="year-label">
              {latest ? `${latest.reference_year} observation` : 'Annual series'}
            </span>
          </div>
          {indicators.isPending ? (
            <Loading />
          ) : indicators.isError ? (
            <p className="muted">National signals are temporarily unavailable.</p>
          ) : (
            <Trend rows={observations} format={definition.format} compact />
          )}
          <Provenance>
            World Bank · World Development Indicators
            <br />
            National data. Not a property price or household income measure.
          </Provenance>
          <div className="coverage-note">
            <span className="coverage-icon">
              <ShieldCheck size={22} />
            </span>
            <div>
              <h3>Evidence before estimates.</h3>
              <p>
                Housing statistics are published only when licensed observations meet our
                publication checks.
              </p>
              <Link to="/market" className="text-link">
                View market coverage <ArrowUpRight size={14} />
              </Link>
            </div>
          </div>
        </section>
      </div>
      <section className="dataset-section">
        <SectionTitle
          title="Inside the Atlas"
          detail="Start with a dataset. Follow it back to its source."
          to="/sources"
        />
        <div className="dataset-list">
          <Link to="/context" className="dataset-row">
            <span className="dataset-icon">
              <Globe2 size={21} />
            </span>
            <div>
              <h3>Kenya national indicators</h3>
              <p>Population, urbanisation, inflation and GDP per capita</p>
            </div>
            <span className="dataset-meta">{indicators.data?.length ?? '—'} observations</span>
            <span className="dataset-updated">World Bank</span>
            <ChevronRight size={18} />
          </Link>
          <Link to="/counties" className="dataset-row">
            <span className="dataset-icon">
              <MapPin size={21} />
            </span>
            <div>
              <h3>County geography</h3>
              <p>Administrative boundaries and geographic reference</p>
            </div>
            <span className="dataset-meta">{counties.data?.length ?? '—'} counties</span>
            <span className="dataset-updated">geoBoundaries</span>
            <ChevronRight size={18} />
          </Link>
        </div>
        <p className="dataset-footnote">
          Latest successful collection:{' '}
          {date(
            sources.data
              ?.map((s) => s.last_success_at)
              .filter(Boolean)
              .sort()
              .reverse()[0]
          )}
          . Source freshness and reference year are shown separately.
        </p>
      </section>
    </>
  );
}
