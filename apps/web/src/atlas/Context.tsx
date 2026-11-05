import { useState } from 'react';
import { Link } from 'react-router-dom';
import { ArrowUpRight, Info } from 'lucide-react';
import { useIndicators, indicatorDefinitions, series, date, exportCsv } from './data';
import { PageHeading, ExportButton, Loading, ErrorState, Provenance } from './primitives';
import Trend from './Trend';

export default function Context() {
  const query = useIndicators(),
    [code, setCode] = useState('SP.POP.TOTL'),
    [range, setRange] = useState('all'),
    [table, setTable] = useState(false);
  const definition = indicatorDefinitions.find((item) => item.code === code)!,
    all = series(query.data, code),
    rows = range === 'all' ? all : all.slice(-Number(range)),
    latest = all[all.length - 1];
  const download = () =>
    exportCsv(
      `atlas-${code.toLowerCase()}.csv`,
      ['Year', 'Value', 'Unit', 'Attribution'],
      rows.map((r) => [r.reference_year, r.value, r.unit, r.attribution])
    );
  return (
    <>
      <PageHeading
        eyebrow="National context"
        title="National indicators"
        description="Track Kenya’s population and economic indicators over time."
      >
        <ExportButton onClick={download} disabled={!rows.length} />
      </PageHeading>
      <div className="context-selector">
        {indicatorDefinitions.map((item) => {
          const last = series(query.data, item.code).slice(-1)[0];
          return (
            <button
              key={item.code}
              aria-pressed={code === item.code}
              onClick={() => setCode(item.code)}
            >
              <span>{item.title}</span>
              <strong>{last ? item.format(Number(last.value)) : '—'}</strong>
              <small>{last ? last.reference_year : 'Annual data'}</small>
            </button>
          );
        })}
      </div>
      {query.isPending ? (
        <Loading />
      ) : query.isError ? (
        <ErrorState message={query.error.message} retry={() => void query.refetch()} />
      ) : (
        <section className="series-panel">
          <div className="series-heading">
            <div>
              <p className="eyebrow">World Bank · Kenya</p>
              <h2>{definition.title}</h2>
              <p>{definition.description}</p>
            </div>
            <div className="range-control" role="group" aria-label="Observation range">
              {[
                ['5', '5 years'],
                ['10', '10 years'],
                ['all', 'All years'],
              ].map(([value, label]) => (
                <button key={value} aria-pressed={range === value} onClick={() => setRange(value)}>
                  {label}
                </button>
              ))}
            </div>
          </div>
          <Trend rows={rows} format={definition.format} />
          <div className="series-footer">
            <span>
              {rows.length
                ? `${rows[0].reference_year}–${rows[rows.length - 1].reference_year}`
                : 'No observations'}{' '}
              <span className="footer-dot">/</span> {definition.unit}
            </span>
            <button className="text-link" onClick={() => setTable(!table)} aria-expanded={table}>
              {table ? 'Hide observations' : 'View observations'}
            </button>
          </div>
          {table && (
            <div className="table-scroll">
              <table>
                <caption className="sr-only">
                  Annual {definition.title.toLowerCase()} observations
                </caption>
                <thead>
                  <tr>
                    <th>Reference year</th>
                    <th>Value</th>
                    <th>Unit</th>
                  </tr>
                </thead>
                <tbody>
                  {[...rows].reverse().map((r) => (
                    <tr key={r.reference_year}>
                      <td>{r.reference_year}</td>
                      <td className="numeric">
                        {Number(r.value).toLocaleString('en-KE', { maximumFractionDigits: 4 })}
                      </td>
                      <td>{r.unit}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
          <Provenance>
            Source: World Bank, World Development Indicators. CC BY 4.0. Collected{' '}
            {date(latest?.retrieved_at)}. Values can be revised by the publisher.
          </Provenance>
        </section>
      )}
      <div className="editorial-note">
        <Info size={20} />
        <div>
          <h3>Use these figures as national context</h3>
          <p>
            Annual national observations cannot describe an individual county, household or
            property. GDP per capita is economic output per person, not disposable household income.
          </p>
          <Link to="/sources" className="text-link">
            Review the source and licence <ArrowUpRight size={14} />
          </Link>
        </div>
      </div>
    </>
  );
}
