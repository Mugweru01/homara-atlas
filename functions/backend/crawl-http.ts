import https from 'node:https';
import {lookup} from 'node:dns';
import {isIP,type LookupFunction} from 'node:net';
import {gunzipSync} from 'node:zlib';
import {createHash} from 'node:crypto';
import {Parser} from 'htmlparser2';
export const crawlerAgent='HomaraAtlasResearchBot';
export class CrawlHttpError extends Error{constructor(code:string,public retryAfterSeconds=0){super(code);}}
const publicLookup:LookupFunction=(host,options,done)=>lookup(host,{all:true},(error,addresses)=>{
 if(error)return done(error,'',0);if(!addresses.length||addresses.some(a=>!publicAddress(a.address)))return done(Error('source_unsafe_address'),'',0);
 if(options.all)done(null,addresses);else done(null,addresses[0].address,addresses[0].family);
});
export function publicAddress(ip:string){
 if(isIP(ip)===4){const p=ip.split('.').map(Number);return !(p[0]===0||p[0]===10||p[0]===127||p[0]>=224||ip==='168.63.129.16'||ip.startsWith('192.88.99.')||(p[0]===100&&p[1]>=64&&p[1]<=127)||(p[0]===169&&p[1]===254)||(p[0]===172&&p[1]>=16&&p[1]<=31)||(p[0]===192&&(p[1]===168||p[1]===0||p[1]===2))||(p[0]===198&&(p[1]===18||p[1]===19||p[1]===51))||(p[0]===203&&p[1]===0&&p[2]===113));}
 // Admit only global IPv6 unicast, excluding documentation/tunnel ranges.
 if(isIP(ip)!==6||!/^[23][0-9a-f]{3}:/i.test(ip))return false;
 const [a,b]=ip.split(':'),first=parseInt(a,16),second=parseInt(b||'0',16);
 return first!==0x2002&&first!==0x3fff&&!(first===0x2001&&(second<0x200||second===0xdb8));
}
export function crawlUrl(raw:string,origin:string,prefixes:string[],hosts:string[]){
 let u:URL,base:URL;try{u=new URL(raw);base=new URL(origin);}catch{throw Error('source_unsafe_url');}
 if(u.protocol!=='https:'||u.origin!==base.origin||u.username||u.password||u.port||isIP(u.hostname.replace(/[\[\]]/g,''))||!hosts.includes(u.hostname)||u.hostname.endsWith('.')||/%(?:2f|5c)/i.test(u.pathname)||u.href.length>2000||[...u.searchParams.keys()].some(k=>/token|auth|session|email|password|api.?key/i.test(k))||!prefixes.some(p=>u.pathname===p||u.pathname.startsWith(p.endsWith('/')?p:p+'/')))throw Error('source_unsafe_url');
 u.hash='';return u;
}
export async function crawlText(raw:string,origin:string,prefixes:string[],hosts:string[],signal?:AbortSignal):Promise<{text:string;url:string;sha256:string}>{
 let u=crawlUrl(raw,origin,prefixes,hosts);
 for(let hops=0;hops<3;hops++){
  const result=await new Promise<{status:number;location?:string;bytes:Buffer;encoding?:string;retryAfter?:string}>((resolve,reject)=>{
   const request=https.get(u,{signal,headers:{'User-Agent':`${crawlerAgent}/1.0 (+https://homara-atlas.vercel.app/sources)`,'Accept':'text/html,text/plain,application/json','Accept-Encoding':'identity'},lookup:publicLookup},response=>{
    const chunks:Buffer[]=[];let size=0;response.on('data',(part:Buffer)=>{size+=part.length;if(size>2*1024*1024){request.destroy(Error('upstream_too_large'));return;}chunks.push(part);});
    response.on('error',reject);response.on('end',()=>resolve({status:response.statusCode||0,location:response.headers.location,bytes:Buffer.concat(chunks),encoding:response.headers['content-encoding'],retryAfter:response.headers['retry-after']}));
   });request.setTimeout(10000,()=>request.destroy(Error('upstream_timeout')));request.on('error',error=>reject(signal?.aborted?Error('upstream_timeout'):error));
  });
  if([301,302,303,307,308].includes(result.status)){u=crawlUrl(new URL(result.location||'',u).href,origin,prefixes,hosts);continue;}
  if(result.status!==200){const raw=result.retryAfter||'',delay=/^\d+$/.test(raw)?Number(raw):Math.ceil((Date.parse(raw)-Date.now())/1000);throw new CrawlHttpError('upstream_http_'+result.status,[429,503].includes(result.status)&&Number.isFinite(delay)?Math.min(604800,Math.max(0,delay)):0);}
  let bytes=result.bytes;if(result.encoding==='gzip')bytes=gunzipSync(bytes,{maxOutputLength:2*1024*1024});else if(result.encoding&&result.encoding!=='identity')throw Error('upstream_unsupported_encoding');
  return {text:new TextDecoder('utf-8',{fatal:true}).decode(bytes),url:u.href,sha256:createHash('sha256').update(bytes).digest('hex')};
 }
 throw Error('upstream_redirect_limit');
}
export function robotsAllowed(text:string,path:string,agent=crawlerAgent){
 if(text.length>256000)throw Error('source_robots_too_large');
 const groups:{agents:string[];rules:{allow:boolean;pattern:string}[]}[]=[];let current={agents:[] as string[],rules:[] as {allow:boolean;pattern:string}[]};
 for(const raw of text.split(/\r?\n/)){const line=raw.split('#')[0].trim(),colon=line.indexOf(':');if(colon<0)continue;const key=line.slice(0,colon).trim().toLowerCase(),value=line.slice(colon+1).trim();if(key==='user-agent'){if(current.rules.length){groups.push(current);current={agents:[],rules:[]};}current.agents.push(value.toLowerCase());}else if(['allow','disallow'].includes(key)&&current.agents.length&&value)current.rules.push({allow:key==='allow',pattern:value});}groups.push(current);
 const score=(a:string)=>a==='*'?0:agent.toLowerCase().includes(a)?a.length:-1;const best=Math.max(-1,...groups.flatMap(g=>g.agents.map(score)));if(best<0)return true;
 let match:{allow:boolean;size:number}|undefined;
 for(const g of groups.filter(g=>g.agents.some(a=>score(a)===best)))for(const r of g.rules){const end=r.pattern.endsWith('$'),literal=end?r.pattern.slice(0,-1):r.pattern;const pattern=literal.split('*').map(s=>s.replace(/[.*+?^${}()|[\]\\]/g,'\\$&')).join('.*');if(new RegExp('^'+pattern+(end?'$':'')).test(path)){const size=literal.replace(/\*/g,'').length;if(!match||size>match.size||(size===match.size&&r.allow))match={allow:r.allow,size};}}
 return match?.allow??true;
}
export function htmlReferences(html:string){
 if(html.length>2*1024*1024)throw Error('upstream_too_large');
 const values:unknown[]=[],links:string[]=[],tableRows:{attributes:Record<string,string>;url:string|null}[]=[];let scripts=0,capturing=false,buffer='',row:{attributes:Record<string,string>;url:string|null}|null=null;
 const parser=new Parser({onopentag(name,attributes){
  if(name==='script'&&attributes.type?.toLowerCase()==='application/ld+json'){if(++scripts>100)throw Error('upstream_schema_changed');capturing=true;buffer='';}
  if(name==='tr'&&attributes['data-sort-name'])row={attributes,url:null};
  if(name==='a'&&attributes.href&&attributes.href.length<=2000){if(links.length>=5000)throw Error('upstream_schema_changed');links.push(attributes.href);if(row&&!row.url)row.url=attributes.href;}
 },ontext(value){if(capturing)buffer+=value;},onclosetag(name){
  if(name==='script'&&capturing){capturing=false;try{const data=JSON.parse(buffer);if(Array.isArray(data))values.push(...data);else values.push(data);}catch{throw Error('upstream_invalid_jsonld');}if(values.length>200)throw Error('upstream_schema_changed');}
  if(name==='tr'&&row){if(tableRows.length>=500)throw Error('upstream_schema_changed');tableRows.push(row);row=null;}
 }},{decodeEntities:true});parser.end(html);return {values,links,tableRows};
}
export const jsonLd=(html:string)=>htmlReferences(html).values;
