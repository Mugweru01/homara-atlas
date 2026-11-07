import { InputError, object, exact, uuid, listing } from './validation.js';
import type { Download } from './connectors.js';
export const homaraExportUrl='https://vhgzjrfabiboeyguzxak.supabase.co/rest/v1/rpc/atlas_private_listing_export';
export async function downloadHomara(key:string|undefined,fetcher:typeof fetch=fetch,token=process.env.ATLAS_HOMARA_FEED_TOKEN):Promise<Download> {
 if(!key)throw new Error('homara_public_key_not_configured');
 if(!token||!/^[a-f0-9]{64}$/.test(token))throw new Error('homara_feed_token_not_configured');
 const records:unknown[]=[];let after:string|null=null;
 for(let page=0;page<10;page++){
  const response=await fetcher(homaraExportUrl,{method:'POST',redirect:'error',headers:{apikey:key,'Content-Type':'application/json'},body:JSON.stringify({p_token:token,p_after:after}),signal:AbortSignal.timeout(15000)});
  if(!response.ok)throw new Error('homara_export_unavailable');
  if(!response.body)throw new Error('upstream_empty');
  const reader=response.body.getReader(),chunks:Uint8Array[]=[];let length=0;
  try{for(;;){const part=await reader.read();if(part.done)break;length+=part.value.length;if(length>1024*1024)throw new Error('upstream_too_large');chunks.push(part.value);}}finally{await reader.cancel().catch(()=>{});}
  const data=object(JSON.parse(Buffer.concat(chunks).toString('utf8')));exact(data,['schema_version','records','has_more']);
  if(data.schema_version!==1||!Array.isArray(data.records)||data.records.length>500||typeof data.has_more!=='boolean')throw new Error('homara_schema_changed');
  for(const raw of data.records){const row=object(raw);exact(row,['id','county','listing_type','property_type','bedrooms','bathrooms','price_amount','updated_at']);const id=uuid(String(row.id));if(after&&id<=after)throw new Error('homara_pagination_invalid');after=id;records.push(row);}
  if(!data.has_more){const value={records};return {url:homaraExportUrl,value,bytes:Buffer.from(JSON.stringify(value))};}
  if(data.records.length!==500)throw new Error('homara_pagination_invalid');
 }
 throw new Error('homara_export_capacity_exceeded');
}
export function homaraListing(raw:unknown,counties:{id:string;name:string}[],observedAt:string) {
 const r=object(raw),name=String(r.county||'').toLowerCase().replace(/ city$| county$/g,'').trim();
 const county=counties.find(x=>x.name.toLowerCase().replace(/ city$| county$/g,'').trim()===name);
 if(!county)throw new InputError('unmapped_county');
 const type=String(r.property_type||'').toLowerCase();
 const property_type=/^(apartment|studio|bedsitter)(\b|$)/.test(type)?'apartment':/^(house|maisonette|bungalow|villa|townhouse)(\b|$)/.test(type)?'house':/^land\b/.test(type)?'land':/^office\b/.test(type)?'office':/^(retail|shop)\b/.test(type)?'retail':/^warehouse\b/.test(type)?'warehouse':null;
 if(!property_type)throw new InputError('unmapped_property_type');
 return listing({source_listing_id:uuid(String(r.id)),source_url:`https://homara.co.ke/property/${uuid(String(r.id))}`,observed_at:observedAt,source_updated_at:r.updated_at,listing_type:r.listing_type,property_type,county_id:county.id,bedrooms:r.bedrooms,bathrooms:r.bathrooms,price_amount:r.price_amount,currency:'KES',rent_period:r.listing_type==='rent'?'month':null,availability:'active',status_evidence:'advertisement'});
}
