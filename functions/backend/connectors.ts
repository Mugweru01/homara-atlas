import { InputError, object } from './validation.js';

export const indicators = {
  'SP.POP.TOTL': { name: 'Population, total', unit: 'people' },
  'SP.URB.TOTL.IN.ZS': { name: 'Urban population share', unit: 'percent of population' },
  'FP.CPI.TOTL.ZG': { name: 'Consumer price inflation', unit: 'annual percent' },
  'NY.GDP.PCAP.CD': { name: 'GDP per capita', unit: 'current USD per person; not household income' },
} as const;
export type IndicatorCode = keyof typeof indicators;
export type Download = { url: string; value: unknown; bytes: Uint8Array };
// No operator-provided URLs are fetched. Redirects are checked at every hop.
export function allowedDownload(raw: string) {
  const u = new URL(raw);
  if (u.protocol !== 'https:' || u.port || u.username || u.password) throw new InputError('unsafe_source_url');
  const allowed =
    (u.hostname === 'api.worldbank.org' && u.pathname.startsWith('/v2/country/KEN/indicator/')) ||
    (u.hostname === 'www.geoboundaries.org' && u.pathname === '/api/current/gbOpen/KEN/ADM1/') ||
    (u.hostname === 'github.com' && /^\/wmgeolab\/geoBoundaries\/raw\/(?:refs\/heads\/)?[a-zA-Z0-9.-]+\/releaseData\/gbOpen\/KEN\/ADM1\/geoBoundaries-KEN-ADM1_simplified.geojson$/.test(u.pathname)) ||
    (u.hostname === 'raw.githubusercontent.com' && /^\/wmgeolab\/geoBoundaries\/[a-zA-Z0-9.-]+\/releaseData\/gbOpen\/KEN\/ADM1\/geoBoundaries-KEN-ADM1_simplified.geojson$/.test(u.pathname)) ||
    (u.hostname === 'media.githubusercontent.com' && /^\/media\/wmgeolab\/geoBoundaries\/[a-zA-Z0-9.-]+\/releaseData\/gbOpen\/KEN\/ADM1\/geoBoundaries-KEN-ADM1_simplified.geojson$/.test(u.pathname));
  if (!allowed) throw new InputError('unsafe_source_url');
  return u.toString();
}
export async function download(raw: string, fetcher: typeof fetch = fetch): Promise<Download> {
  let url = allowedDownload(raw);
  for (let redirect=0;redirect<4;redirect++) {
    const response = await fetcher(url, { redirect:'manual', headers:{ Accept:'application/json', 'User-Agent':'HomaraAtlas/1.0 (property context research; https://atlas.homara.co.ke)' }, signal:AbortSignal.timeout(20000) });
    if ([301,302,303,307,308].includes(response.status)) { url=allowedDownload(new URL(response.headers.get('location') || '',url).toString()); continue; }
    if (!response.ok) throw new Error(`upstream_http_${response.status}`);
    if (Number(response.headers.get('content-length')) > 4*1024*1024) throw new Error('upstream_too_large');
    if (!response.body) throw new Error('upstream_empty');
    const reader=response.body.getReader(); const chunks:Uint8Array[]=[]; let length=0;
    try { for (;;) { const part=await reader.read(); if(part.done)break; length+=part.value.length; if(length>4*1024*1024)throw new Error('upstream_too_large'); chunks.push(part.value); } }
    finally { await reader.cancel().catch(()=>{}); }
    const bytes=Buffer.concat(chunks);
    let value:unknown;try{value=JSON.parse(bytes.toString('utf8'));}catch{throw new Error('upstream_invalid_json');}
    return {url,value,bytes};
  }
  throw new Error('upstream_redirect_limit');
}
export function parseWorldBank(value: unknown) {
  if (!Array.isArray(value) || value.length !== 2 || !Array.isArray(value[1])) throw new Error('upstream_schema_changed');
  const meta=object(value[0]);
  if (Number(meta.pages)!==1 || Number(meta.total)!==value[1].length) throw new Error('incomplete_source_response');
  return value[1].filter((raw:unknown)=>object(raw).value!=null).map((raw:unknown)=>{
    const r=object(raw), id=String(object(r.indicator).id) as IndicatorCode;
    if (!(id in indicators) || r.countryiso3code!=='KEN' || typeof r.value!=='number' || !Number.isFinite(r.value) || !/^\d{4}$/.test(String(r.date))) throw new Error('upstream_schema_changed');
    return {code:id,...indicators[id], year:Number(r.date),value:r.value};
  });
}
export function parseBoundaryMetadata(value: unknown) {
  const m=object(value);
  if(m.boundaryISO!=='KEN'||m.boundaryType!=='ADM1'||m.boundaryLicense!=='Public Domain'||Number(m.admUnitCount)!==47)throw new Error('source_license_or_schema_changed');
  return { url:allowedDownload(String(m.simplifiedGeometryGeoJSON)),revision:String(m.boundaryID),year:Number(m.boundaryYearRepresented) };
}
export function parseBoundaries(value:unknown) {
  const data=object(value);
  if(data.type!=='FeatureCollection'||!Array.isArray(data.features)||data.features.length!==47)throw new Error('incomplete_boundary_dataset');
  const rows=data.features.map((raw:unknown)=>{
    const feature=object(raw),p=object(feature.properties),geometry=object(feature.geometry);
    if(!['Polygon','MultiPolygon'].includes(String(geometry.type))||!Array.isArray(geometry.coordinates)||typeof p.shapeID!=='string'||typeof p.shapeName!=='string'||p.shapeGroup!=='KEN')throw new Error('upstream_schema_changed');
    return {key:p.shapeID,name:p.shapeName,geometry};
  });
  if(new Set(rows.map(r=>r.key)).size!==47)throw new Error('duplicate_boundary_identity');
  return rows;
}
export const worldBankUrl=()=>`https://api.worldbank.org/v2/country/KEN/indicator/${Object.keys(indicators).join(';')}?source=2&format=json&per_page=2000&date=2000:${new Date().getUTCFullYear()}`;
export const boundaryMetadataUrl='https://www.geoboundaries.org/api/current/gbOpen/KEN/ADM1/';
