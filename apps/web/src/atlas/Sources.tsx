import * as Dialog from '@radix-ui/react-dialog';
import { Link, useSearchParams } from 'react-router-dom';
import {
  Database,
  ArrowUpRight,
  ChevronRight,
  X,
  ShieldCheck,
  ExternalLink,
  RefreshCw,
} from 'lucide-react';
import { useSources, useHealth, date, type Source } from './data';
import { PageHeading, Status, SectionTitle, Loading, ErrorState } from './primitives';

export default function Sources() {
  const query = useSources(),
    health = useHealth(),
    [params, setParams] = useSearchParams(),
    source = query.data?.find((s) => s.slug === params.get('source'));
  const short = (s: Source) =>
    s.slug === 'geoboundaries-ken-counties'
      ? 'geoBoundaries'
      : s.slug === 'worldbank-wdi-ken'
        ? 'World Bank'
        : s.name;
  return (
    <>
      <PageHeading
        eyebrow="Data sources"
        title="Sources and provenance"
        description="See where the data comes from, what it covers and how you can use it."
      >
        <button
          className="button secondary"
          disabled={query.isFetching || health.isFetching}
          onClick={() => {
            void query.refetch();
            void health.refetch();
          }}
        >
          <RefreshCw size={16} className={query.isFetching ? 'spinning' : ''} />
          Refresh status
        </button>
      </PageHeading>
      <div className="source-summary">
        <ShieldCheck size={23} />
        <div>
          <strong>Public data. Recorded provenance.</strong>
          <p>Every published dataset has an identified source, licence and collection history.</p>
        </div>
        <Status muted={health.data?.status !== 'current'}>
          {health.data?.status === 'current' ? 'Sources up to date' : 'Check freshness below'}
        </Status>
      </div>
      {query.isPending ? (
        <Loading />
      ) : query.isError ? (
        <ErrorState message={query.error.message} retry={() => void query.refetch()} />
      ) : (
        <div className="source-table table-scroll">
          <table>
            <caption className="sr-only">Published source registry</caption>
            <thead>
              <tr>
                <th>Source</th>
                <th>Dataset</th>
                <th>Last collection</th>
                <th>Status</th>
                <th>
                  <span className="sr-only">Details</span>
                </th>
              </tr>
            </thead>
            <tbody>
              {query.data.map((s) => (
                <tr key={s.slug}>
                  <td>
                    <button className="source-name" onClick={() => setParams({ source: s.slug })}>
                      <span className="dataset-icon">
                        <Database size={20} />
                      </span>
                      <span>
                        {short(s)}
                        <small>
                          {s.data_kind === 'geography'
                            ? 'Administrative boundaries'
                            : s.data_kind === 'context'
                              ? 'World Development Indicators'
                              : 'Approved listing feed'}
                        </small>
                      </span>
                    </button>
                  </td>
                  <td>
                    {s.data_kind === 'geography'
                      ? 'Kenya counties'
                      : s.data_kind === 'context'
                        ? 'Kenya national context'
                        : 'Property listings'}
                  </td>
                  <td>{date(s.last_success_at)}</td>
                  <td>
                    <Status
                      muted={health.data?.sources.find((h) => h.slug === s.slug)?.stale !== false}
                    >
                      {health.data?.sources.find((h) => h.slug === s.slug)?.stale === false
                        ? 'Current'
                        : 'Check freshness'}
                    </Status>
                  </td>
                  <td>
                    <button
                      className="icon-button"
                      aria-label={`View ${short(s)} source details`}
                      onClick={() => setParams({ source: s.slug })}
                    >
                      <ChevronRight size={19} />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      <div className="source-principles">
        <SectionTitle title="How the Atlas stays accountable" />
        <div className="principle-columns">
          <article>
            <span>01</span>
            <h3>Permission comes first</h3>
            <p>
              Public visibility does not automatically grant reuse rights. New feeds need explicit
              approval before collection.
            </p>
          </article>
          <article>
            <span>02</span>
            <h3>History stays intact</h3>
            <p>
              New observations preserve earlier evidence. Corrections and publication decisions
              retain their provenance.
            </p>
          </article>
          <article>
            <span>03</span>
            <h3>Limits stay visible</h3>
            <p>
              Reference years, collection dates and unavailable datasets are explained alongside the
              figures.
            </p>
          </article>
        </div>
      </div>
      <div className="source-partner-note">
        <div>
          <h3>
            {query.data?.some((s) => s.data_kind === 'listings')
              ? 'Property estimates need sufficient evidence.'
              : 'Property feeds are not approved yet.'}
          </h3>
          <p>
            {query.data?.some((s) => s.data_kind === 'listings')
              ? 'Approved feeds must meet freshness and sample checks before asking statistics can be published.'
              : 'Current datasets provide national and geographic context. No partner inventory is published.'}
          </p>
        </div>
        <Link to="/market" className="text-link">
          View market coverage <ArrowRightIcon />
        </Link>
      </div>
      <Dialog.Root
        open={Boolean(source)}
        onOpenChange={(open) => {
          if (!open) setParams({});
        }}
      >
        {source && (
          <Dialog.Portal>
            <Dialog.Overlay className="inspector-overlay" />
            <Dialog.Content className="source-drawer">
              <button
                className="icon-button drawer-close"
                aria-label="Close source details"
                autoFocus
                onClick={() => setParams({})}
              >
                <X size={21} />
              </button>
              <span className="inspector-icon">
                <Database size={25} />
              </span>
              <p className="eyebrow">Source record</p>
              <Dialog.Title asChild>
                <h2>{short(source)}</h2>
              </Dialog.Title>
              <Dialog.Description asChild>
                <p>{source.name}</p>
              </Dialog.Description>
              <dl className="detail-list">
                <div>
                  <dt>Data type</dt>
                  <dd>{source.data_kind}</dd>
                </div>
                <div>
                  <dt>Last collection</dt>
                  <dd>{date(source.last_success_at)}</dd>
                </div>
                <div>
                  <dt>Refresh schedule</dt>
                  <dd>
                    {source.data_kind === 'geography'
                      ? 'Weekly'
                      : source.data_kind === 'context'
                        ? 'Daily'
                        : 'Operator submitted'}
                  </dd>
                </div>
                <div>
                  <dt>Licence</dt>
                  <dd>{source.license}</dd>
                </div>
              </dl>
              <h3>Attribution</h3>
              <p>{source.attribution}</p>
              <a
                className="button primary"
                href={source.permission_url}
                target="_blank"
                rel="noreferrer"
              >
                Read source documentation <ExternalLink size={16} />
              </a>
              <p className="provenance">
                Collection date describes when Atlas retrieved the data. It does not change the
                publisher’s reference year.
              </p>
            </Dialog.Content>
          </Dialog.Portal>
        )}
      </Dialog.Root>
    </>
  );
}
function ArrowRightIcon() {
  return <ArrowUpRight size={15} />;
}
