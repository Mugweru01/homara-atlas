import {crawlText,robotsAllowed,htmlReferences} from './crawl-http.js';
import {object,hash,exact,InputError} from './validation.js';
import type {Download} from './connectors.js';
export const kpcOrigin='https://kenyapropertycentre.com',kpcPath='/market-trends/average-prices';
export function validateKpcEnvelope(raw:unknown){
 const v=object(raw);exact(v,['records','evidence']);const evidence=object(v.evidence);exact(evidence,['parser','document_sha256','robots_sha256','terms_sha256','scope']);
 if(evidence.parser!=='kpc-market/1'||evidence.scope!=='Published CC BY 4.0 market statistics only; no listing or customer data.'||!['document_sha256','robots_sha256','terms_sha256'].every(k=>typeof evidence[k]==='string'&&/^[a-f0-9]{64}$/.test(evidence[k] as string))||!Array.isArray(v.records)||v.records.length<3||v.records.length>200)throw new InputError('invalid_collector_envelope');
 const records=v.records.map(raw=>{const r=object(raw);exact(r,['series_key','geography','market_type','period_start','period_end','median_price','sample_count','currency','methodology','source_url','digest']);
  const {digest,...content}=r;
  if(typeof r.geography!=='string'||!/^[A-Za-z][A-Za-z .'-]{1,100}$/.test(r.geography)||!['rent','sale','short_let'].includes(String(r.market_type))||r.series_key!==r.market_type+':'+r.geography||r.currency!=='KES'||typeof r.median_price!=='number'||!Number.isFinite(r.median_price)||r.median_price<=0||r.median_price>1e12||!(r.sample_count===null||(Number.isSafeInteger(r.sample_count)&&Number(r.sample_count)>=0&&Number(r.sample_count)<=10000000))||typeof r.methodology!=='string'||r.methodology.length<1||r.methodology.length>2000||/[<>\u0000-\u001f]/.test(r.methodology)||typeof r.source_url!=='string'||!/^https:\/\/kenyapropertycentre\.com\/market-trends\/average-prices\/(?:for-rent\/short-let|for-rent|for-sale)(?:\/[a-z0-9-]+)?$/.test(r.source_url)||typeof r.period_start!=='string'||!/^\d{4}-\d{2}-01$/.test(r.period_start)||typeof r.period_end!=='string'||!/^\d{4}-\d{2}-\d{2}$/.test(r.period_end)||!Number.isFinite(Date.parse(r.period_end))||r.period_start.slice(0,7)!==r.period_end.slice(0,7)||Date.parse(r.period_end)>Date.now()+86400000||digest!==hash(content))throw new InputError('invalid_collector_record');return r;});
 if(new Set(records.map(r=>r.series_key)).size!==records.length||!['rent','sale','short_let'].every(type=>records.some(r=>r.series_key===type+':Kenya')))throw new InputError('incomplete_collector_records');return {records,evidence};
}
export function parseKpc(html:string){
 const parsed=htmlReferences(html),datasets=parsed.values.filter(v=>v&&typeof v==='object'&&!Array.isArray(v)&&(v as Record<string,unknown>)['@type']==='Dataset').map(object);
 const urls=new Map([[kpcOrigin+kpcPath+'/for-rent','rent'],[kpcOrigin+kpcPath+'/for-sale','sale'],[kpcOrigin+kpcPath+'/for-rent/short-let','short_let']]);
 const records:{series_key:string;geography:string;market_type:string;period_start:string;period_end:string;median_price:number;sample_count:number|null;currency:string;methodology:string;source_url:string;digest?:string}[]=[];
 let latestEnd='';
 for(const d of datasets){const type=urls.get(String(d.url));if(!type)continue;
  if(d.license!=='https://creativecommons.org/licenses/by/4.0/'||object(d.creator).name!=='Kenya Property Centre'||typeof d.temporalCoverage!=='string'||!/^\d{4}-\d{2}-\d{2}\/\d{4}-\d{2}-\d{2}$/.test(d.temporalCoverage)||!Array.isArray(d.variableMeasured)||d.variableMeasured.length!==1||typeof d.measurementTechnique!=='string'||d.measurementTechnique.length>2000)throw Error('source_license_or_schema_changed');
  const end=d.temporalCoverage.split('/')[1],value=object(d.variableMeasured[0]);if(!Number.isFinite(Date.parse(end))||Date.parse(end)>Date.now()+86400000||value.unitText!=='KES'||typeof value.value!=='number'||!Number.isFinite(value.value)||value.value<=0||value.value>1e12)throw Error('upstream_schema_changed');
  if(latestEnd&&latestEnd!==end)throw Error('incomplete_source_response');latestEnd=end;
  records.push({series_key:type+':Kenya',geography:'Kenya',market_type:type,period_start:end.slice(0,7)+'-01',period_end:end,median_price:value.value,sample_count:null,currency:'KES',methodology:d.measurementTechnique,source_url:String(d.url)});
 }
 if(records.length!==3||new Set(records.map(r=>r.market_type)).size!==3)throw Error('incomplete_source_response');
 // Read only explicit publisher data attributes, never round displayed K/M prices.
 for(const row of parsed.tableRows){
  const attr=(name:string)=>row.attributes['data-sort-'+name]??'';
  const geography=attr('name'),price=attr('figure'),sample=attr('listings');if(!price)continue;
  const link=row.url;if(!link||!/^https:\/\/kenyapropertycentre\.com\/market-trends\/average-prices\/(?:for-rent\/short-let|for-rent|for-sale)\/[a-z0-9-]+$/.test(link)||!geography||geography.length>160||/[<>&\u0000-\u001f]/.test(geography)||!/^\d+(?:\.\d+)?$/.test(price)||!/^\d+$/.test(sample))throw Error('upstream_schema_changed');
  const type=link.includes('/short-let/')?'short_let':link.includes('/for-rent/')?'rent':'sale',median=Number(price),count=Number(sample);if(median<=0||median>1e12||!Number.isSafeInteger(count)||count>10000000)throw Error('upstream_schema_changed');
  records.push({series_key:type+':'+geography,geography,market_type:type,period_start:latestEnd.slice(0,7)+'-01',period_end:latestEnd,median_price:median,sample_count:count,currency:'KES',methodology:'Publisher county table, all types and sizes as labelled; consult the linked report. Source sample rules differ from Atlas. Not individual listings or achieved transaction prices.',source_url:link});
 }
 if(records.length<6||new Set(records.map(r=>r.series_key)).size!==records.length)throw Error('incomplete_source_response');
 return records.map(r=>({...r,digest:hash(r)}));
}
export async function downloadKpc():Promise<Download>{
 const signal=AbortSignal.timeout(90000),hosts=['kenyapropertycentre.com'],paths=[kpcPath,'/robots.txt','/terms-of-use'];
 const robots=await crawlText(kpcOrigin+'/robots.txt',kpcOrigin,paths,hosts,signal);if(!robotsAllowed(robots.text,kpcPath)||!robotsAllowed(robots.text,'/terms-of-use'))throw Error('source_robots_disallowed');
 const terms=await crawlText(kpcOrigin+'/terms-of-use',kpcOrigin,paths,hosts,signal);if(!terms.text.includes('creativecommons.org/licenses/by/4.0')||!terms.text.includes('Market Data')||!terms.text.includes('automated software at a reasonable rate'))throw Error('source_license_or_schema_changed');
 const page=await crawlText(kpcOrigin+kpcPath,kpcOrigin,paths,hosts,signal),records=parseKpc(page.text);
 const value={records,evidence:{parser:'kpc-market/1',document_sha256:page.sha256,robots_sha256:robots.sha256,terms_sha256:terms.sha256,scope:'Published CC BY 4.0 market statistics only; no listing or customer data.'}};
 return {url:page.url,value,bytes:Buffer.from(JSON.stringify(value))};
}
