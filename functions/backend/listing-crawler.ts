import type {Pool} from 'pg';
import {crawlText,crawlUrl,robotsAllowed,jsonLd,htmlReferences} from './crawl-http.js';
import {object,listing,uuid} from './validation.js';
import type {Download} from './connectors.js';
type Config={origin:string;path_prefix:string;seed_paths:string[];listing_type:'rent'|'sale';max_pages:number};
const number=(value:unknown)=>typeof value==='number'?value:typeof value==='string'&&/^\d+(?:\.\d+)?$/.test(value)?Number(value):null;
const norm=(s:string)=>s.toLowerCase().replace(/ city$| county$/g,'').replace(/[^\p{L}\p{N}]/gu,'');
export function parseWebListings(html:string,url:string,config:Config,counties:{id:string;name:string}[],observed:string){
 const records:ReturnType<typeof listing>[]=[],issues:string[]=[];
 const roots=jsonLd(html),nodes:unknown[]=[];
 for(const root of roots){if(root&&typeof root==='object'&&!Array.isArray(root)&&Array.isArray((root as Record<string,unknown>)['@graph']))nodes.push(...(root as {'@graph':unknown[]})['@graph']);else nodes.push(root);}
 if(nodes.length>200)throw Error('upstream_schema_changed');
 for(const raw of nodes){if(!raw||typeof raw!=='object'||Array.isArray(raw))continue;const n=object(raw),types=Array.isArray(n['@type'])?n['@type']:[n['@type']];if(!types.some(t=>['Product','Apartment','House','SingleFamilyResidence','Residence','RealEstateListing','Office','LandParcel'].includes(String(t)))||!n.offers)continue;
  try{
   const item=n.mainEntity&&typeof n.mainEntity==='object'?object(n.mainEntity):n,offer=object(Array.isArray(n.offers)?n.offers[0]:n.offers),address=object(item.address),id=item.sku??item.productID??item.identifier;
   if(typeof id!=='string'||!/^[A-Za-z0-9._:-]{1,160}$/.test(id))throw Error('missing_stable_advertisement_id');
   const canonical=new URL(String(n.url||offer.url||url),url);canonical.hash='';canonical.pathname=canonical.pathname.replace(/\/+$/,'')||'/';if(canonical.search)throw Error('noncanonical_listing_url');
   const countyRaw=typeof address.addressRegion==='string'?norm(address.addressRegion):'',county=counties.find(c=>norm(c.name)===countyRaw||(norm(c.name)==='tharaka'&&countyRaw==='tharakanithi'));if(!county)throw Error('unmapped_county');
   const category=String(item.category||types[0]).toLowerCase(),property_type=/apartment|flat/.test(category)?'apartment':/house|residence/.test(category)?'house':/landparcel|land/.test(category)?'land':/office/.test(category)?'office':/retail/.test(category)?'retail':/warehouse/.test(category)?'warehouse':null;if(!property_type)throw Error('unmapped_property_type');
   const specification=offer.priceSpecification&&typeof offer.priceSpecification==='object'?object(offer.priceSpecification):{};
   if(config.listing_type==='rent'&&!['MON','month','monthly','MONTH'].includes(String(specification.unitCode||specification.unitText)))throw Error('unconfirmed_rent_period');
   const state=String(offer.availability||'').replace(/^https?:\/\/schema\.org\//,''),availability=state==='InStock'?'active':['OutOfStock','SoldOut','Discontinued'].includes(state)?'withdrawn':'unknown';
   const floor=item.floorSize&&typeof item.floorSize==='object'?object(item.floorSize):{},area=number(floor.value),unit=String(floor.unitCode||floor.unitText||'').toLowerCase();
   const bedrooms=number(item.numberOfBedrooms),bathrooms=number(item.numberOfBathroomsTotal);
   records.push(listing({source_listing_id:id,source_url:canonical.href,observed_at:observed,listing_type:config.listing_type,property_type,county_id:uuid(county.id),bedrooms,bathrooms,price_amount:number(offer.price??specification.price),currency:offer.priceCurrency??specification.priceCurrency,rent_period:config.listing_type==='rent'?'month':null,floor_area_sqm:property_type!=='land'&&area&&['mtk','sqm','m2'].includes(unit)?area:null,availability,status_evidence:'advertisement'}));
  }catch(error){const code=error instanceof Error?error.message:'invalid_listing';issues.push(/^[a-z_]{1,60}$/.test(code)?code:'invalid_listing');}
 }
 return {records,issues};
}
export async function downloadListingWeb(pool:Pool,source:{id:string;watermark:Record<string,unknown>},heartbeat:()=>Promise<void>):Promise<Download>{
 const config=(await pool.query('SELECT origin,path_prefix,seed_paths,listing_type,max_pages FROM atlas_control.crawl_configs WHERE source_id=$1',[source.id])).rows[0] as Config|undefined;
 if(!config||config.path_prefix==='/'||!config.path_prefix.startsWith('/')||config.max_pages<1||config.max_pages>10)throw Error('source_crawler_not_configured');
 const hosts=(process.env.ATLAS_CRAWLER_ALLOWED_HOSTS||'').split(',').map(s=>s.trim()).filter(Boolean),prefixes=[config.path_prefix,'/robots.txt'],signal=AbortSignal.timeout(120000),robotUrl=new URL('/robots.txt',config.origin).href;
 const robots=await crawlText(robotUrl,config.origin,prefixes,hosts,signal);await heartbeat();
 const saved=source.watermark?.crawl_frontier as {queue?:string[];seen?:string[];started_at?:string;record_count?:number}|undefined;
 const queue=saved?.queue?.length?[...saved.queue]:config.seed_paths.map(p=>new URL(p,config.origin).href),seen=new Set(saved?.queue?.length?saved.seen||[]:[]),records:ReturnType<typeof listing>[]=[],issues:string[]=[],evidence:{url:string;sha256:string}[]=[];
 const startedAt=(saved?.queue?.length?saved.started_at:null)||new Date().toISOString();
 if(queue.length>1000||seen.size>1000)throw Error('source_crawler_capacity_exceeded');
 let confirmedEmpty=false;
 const counties=(await pool.query("SELECT l.id,l.name FROM atlas_core.locations l JOIN atlas_control.sources s ON s.id=l.source_id WHERE l.kind='county' AND s.driver='geoboundaries_ken' AND s.status='active'")).rows;
 for(let page=0;queue.length&&page<config.max_pages;page++){
  const raw=queue.shift()!,url=crawlUrl(raw,config.origin,[config.path_prefix],hosts);if(seen.has(url.href)){page--;continue;}
  if(!robotsAllowed(robots.text,url.pathname+url.search))throw Error('source_robots_disallowed');
  const document=await crawlText(url.href,config.origin,[config.path_prefix],hosts,signal,u=>robotsAllowed(robots.text,u.pathname+u.search));await heartbeat();seen.add(url.href);evidence.push({url:url.href,sha256:document.sha256});
  const parsed=parseWebListings(document.text,document.url,config,counties,new Date().toISOString());
  confirmedEmpty ||= jsonLd(document.text).some(v=>v&&typeof v==='object'&&!Array.isArray(v)&&(v as Record<string,unknown>)['@type']==='ItemList'&&(v as Record<string,unknown>).numberOfItems===0);
  for(const record of parsed.records){crawlUrl(record.source_url,config.origin,[config.path_prefix],hosts);records.push(record);}issues.push(...parsed.issues);
  for(const href of htmlReferences(document.text).links){
   try{const link=new URL(href,document.url);link.hash='';for(const key of [...link.searchParams.keys()])if(/^utm_|^(gclid|fbclid)$/.test(key))link.searchParams.delete(key);crawlUrl(link.href,config.origin,[config.path_prefix],hosts);if(/\.(?:jpg|png|webp|pdf|css|js|svg|zip)$/i.test(link.pathname)||[...link.searchParams.keys()].some(k=>/token|auth|session|email|password/i.test(k)))continue;if(!seen.has(link.href)&&!queue.includes(link.href))queue.push(link.href);}catch{continue;}
  }
  if(queue.length+seen.size>1000||records.length>1000)throw Error('source_crawler_capacity_exceeded');
  if(queue.length&&page+1<config.max_pages)await new Promise(r=>setTimeout(r,1000));
 }
 const recordCount=(saved?.queue?.length?saved.record_count||0:0)+records.length;
 if(!queue.length&&!recordCount&&!issues.length&&!confirmedEmpty)throw Error('upstream_schema_changed');
 const value={records:records.map(({observed_at,...r})=>r),issues,crawl_frontier:{queue,seen:[...seen],record_count:recordCount,started_at:startedAt,completed_at:queue.length?null:new Date().toISOString()},evidence:{parser:'approved-jsonld/1',robots_sha256:robots.sha256,documents:evidence,notice:'Only validated property fields retained; HTML, contacts, descriptions and images discarded.'}};
 return {url:config.origin+config.path_prefix,value,bytes:Buffer.from(JSON.stringify(value))};
}
