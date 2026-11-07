import {readFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
export const revision='6c837b48a29ea2424ecda2abaea2ae6d3670db68';
export const repository='https://github.com/davidamunga/kenya-locations';
export const attribution='kenya-locations by David Amunga and contributors (https://github.com/davidamunga/kenya-locations), with data from IEBC and KNBS; HDX/American Red Cross for historical DHIS2 sub-counties and ward links.';
const specs={counties:['counties.json',47],constituencies:['constituencies.json',290],wards:['wards.json',1450],sub_counties:['sub-counties.json',302],localities:['locality.json',917],areas:['area.json',1829]};
export const digest=bytes=>createHash('sha256').update(bytes).digest('hex');
const fail=code=>{throw new Error(code);};
const str=v=>{if(typeof v!=='string'||!v.trim()||v!==v.trim()||v.length>160||/[\u0000-\u001f]/.test(v))fail('invalid_location_name');return v.normalize('NFC');};
const code=(v,n)=>{if(typeof v!=='string'||!new RegExp('^[0-9]{'+n+'}$').test(v))fail('invalid_location_code');return v;};
function keys(row,allowed){if(!row||typeof row!=='object'||Array.isArray(row)||Object.keys(row).some(k=>!allowed.includes(k)))fail('unexpected_location_fields');}
const informalKey=(...v)=>JSON.stringify(v.map(str));
export function buildReference(data){
 const rows=[],relations=[],index=new Map();
 const add=(kind,key,r,metadata={},provenance='electoral_reference')=>{const k=kind+':'+key;if(index.has(k))fail('duplicate_location_identity');const row={kind,key,name:str(r.name),county_code:code(r.county_code??r.code,3),code:r.code??null,metadata,provenance};index.set(k,row);rows.push(row);return row;};
 const parent=(kind,key)=>{const row=index.get(kind+':'+key);if(!row)fail('missing_location_parent');return row;};
 const link=(child,p,kind,method='exact')=>{if(child.county_code!==p.county_code)fail('cross_county_relationship');relations.push({child:child.kind+':'+child.key,parent:p.kind+':'+p.key,kind,method});};
 for(const [k,[,n]]of Object.entries(specs))if(!Array.isArray(data[k])||data[k].length!==n)fail('incomplete_location_dataset');
 for(const r of data.counties){keys(r,['code','iso_code','name','capital','area_km2','population_2019','region','postal_code','aliases']);code(r.code,3);if(!/^KE-[0-9]{2}$/.test(r.iso_code)||!/^\d{5}$/.test(r.postal_code)||!Number.isFinite(r.area_km2)||r.area_km2<=0||!Number.isInteger(r.population_2019)||r.population_2019<=0||!Array.isArray(r.aliases)||r.aliases.length>10)fail('invalid_county_metadata');add('county',r.code,r,{iso_code:r.iso_code,capital:str(r.capital),area_km2:r.area_km2,population_2019:r.population_2019,reference_year:2019,region:str(r.region),capital_postal_code:r.postal_code,aliases:r.aliases.map(str)});}
 for(const [group,kind,digits]of[['constituencies','constituency',3],['sub_counties','sub_county',5]])for(const r of data[group]){keys(r,['code','name','county','county_code']);code(r.code,digits);const county=parent('county',r.county_code);if(county.name!==r.county)fail('parent_name_mismatch');if(kind==='sub_county'&&!r.code.startsWith(r.county_code))fail('invalid_sub_county_code');const row=add(kind,r.code,r,{},kind==='sub_county'?'third_party_historical':'electoral_reference');link(row,county,'county');}
 if(!data.matches||!Array.isArray(data.matches.matched)||data.matches.matched.length!==104)fail('missing_match_provenance');
 const matchMap=new Map();for(const r of data.matches.matched){code(r.ward_code,4);if(matchMap.has(r.ward_code)||!['guided','fuzzy','inferred'].includes(r.method))fail('invalid_match_provenance');matchMap.set(r.ward_code,r);}
 for(const r of data.wards){keys(r,['code','name','constituency','constituency_code','county_code','sub_county_code']);code(r.code,4);const county=parent('county',r.county_code),constituency=parent('constituency',r.constituency_code),sub=parent('sub_county',r.sub_county_code);if(constituency.name!==r.constituency)fail('parent_name_mismatch');const m=matchMap.get(r.code);if(m&&(m.sub_county_code!==r.sub_county_code||m.ward!==r.name))fail('match_provenance_mismatch');const row=add('ward',r.code,r);link(row,county,'county');link(row,constituency,'constituency');link(row,sub,'sub_county',m?.method??'exact');}
 for(const r of data.localities){keys(r,['name','county','county_code']);const county=parent('county',r.county_code);if(county.name!==r.county)fail('parent_name_mismatch');const row=add('locality',informalKey(r.county_code,r.name),r,{},'informal_unverified');link(row,county,'county','unverified');}
 for(const r of data.areas){keys(r,['name','locality','county','county_code']);const county=parent('county',r.county_code);if(county.name!==r.county)fail('parent_name_mismatch');const row=add('area',informalKey(r.county_code,r.locality,r.name),r,{},'informal_unverified');link(row,county,'county','unverified');link(row,parent('locality',informalKey(r.county_code,r.locality)),'locality','unverified');}
 for(const[kind,n]of[['county',47],['constituency',290],['ward',1450]]){const codes=rows.filter(r=>r.kind===kind).map(r=>Number(r.code)).sort((a,b)=>a-b);if(codes.length!==n||codes.some((x,i)=>x!==i+1))fail('incomplete_code_sequence');}
 return {rows,relations,counts:Object.fromEntries(Object.entries(specs).map(([k,[,n]])=>[k,n]))};
}
export async function loadReference(){
 const root=new URL('../../data-platform/reference/kenya-locations/',import.meta.url),manifestBytes=await readFile(new URL('manifest.json',root)),manifest=JSON.parse(manifestBytes);
 if(manifest.revision!==revision||manifest.repository!==repository||manifest.license!=='CC-BY-4.0'||manifest.package_version!=='0.12.0')fail('unreviewed_dataset_revision');
 const required=[...Object.values(specs).map(x=>x[0]),'meta.json','history.json','LICENSE.md','matches.json'];
 if(Object.keys(manifest.files).length!==required.length)fail('invalid_manifest');
 const files={};let total=0;for(const name of required){const bytes=await readFile(new URL(name,root));total+=bytes.length;if(total>5*1024*1024||bytes.length!==manifest.files[name]?.bytes||digest(bytes)!==manifest.files[name]?.sha256)fail('location_checksum_mismatch');files[name]=name.endsWith('.json')?JSON.parse(bytes):bytes.toString('utf8');}
 if(files['meta.json'].license!=='CC-BY-4.0'||files['meta.json'].boundary_set!=='IEBC 2012')fail('location_license_or_vintage_changed');
 const data=Object.fromEntries(Object.entries(specs).map(([k,[file]])=>[k,files[file]]));data.matches=files['matches.json'];
 return {...buildReference(data),raw:data,manifest,manifest_sha256:digest(manifestBytes),source_meta:files['meta.json']};
}
