import {loadReference,revision,repository,attribution} from './location-dataset.mjs';
const expectedLicense='CC BY 4.0 (data); MIT (upstream library code)';
const permissionUrl=repository+'/blob/'+revision+'/data/LICENSE.md';
function validateSource(s){
 if(s.driver!=='kenya_locations'||s.status!=='active'||!s.publication_allowed||(s.rights_expire_at&&new Date(s.rights_expire_at)<=new Date()))throw new Error('geography_source_not_approved');
 if(s.license!==expectedLicense||s.permission_url!==permissionUrl||s.attribution!==attribution)throw new Error('geography_source_metadata_mismatch');
}
export async function importLocations(db){
 const data=await loadReference();
 await db.query('BEGIN');
 try{
  await db.query("SELECT pg_advisory_xact_lock(hashtext('atlas-geography-import'))");
  const previousSource=(await db.query("SELECT * FROM atlas_control.sources WHERE slug='kenya-locations' FOR SHARE")).rows[0];if(previousSource)validateSource(previousSource);
  const existing=(await db.query('SELECT id,manifest_sha256 FROM atlas_geo.releases WHERE revision=$1',[revision])).rows[0];
  if(existing){if(existing.manifest_sha256!==data.manifest_sha256)throw new Error('location_release_checksum_conflict');if(!(await db.query('SELECT 1 FROM atlas_geo.current_release WHERE release_id=$1',[existing.id])).rowCount)throw new Error('historical_release_requires_explicit_rollback');await db.query('COMMIT');return {status:'already_imported',release_id:existing.id,counts:data.counts};}
  const boundaryRows=(await db.query(`SELECT l.id,l.name FROM atlas_core.locations l JOIN atlas_control.sources s ON s.id=l.source_id WHERE l.kind='county' AND s.driver='geoboundaries_ken' AND s.status='active' AND s.publication_allowed AND(s.rights_expire_at IS NULL OR s.rights_expire_at>now())`)).rows;
  const norm=s=>s.toLowerCase().replace(/ city$| county$/g,'').replace(/[^\p{L}\p{N}]/gu,'');
  // Reviewed crosswalk: the retained geoBoundaries KEN ADM1 2020 county label
  // "Tharaka" corresponds to IEBC county 013, Tharaka-Nithi. No fuzzy mapping.
  const reviewedBoundaryAliases={'013':['Tharaka']};
  const mapping=data.rows.filter(r=>r.kind==='county').map(r=>{const names=[r.name,...r.metadata.aliases,...(reviewedBoundaryAliases[r.code]??[])].map(norm),matches=boundaryRows.filter(b=>names.includes(norm(b.name)));if(matches.length!==1)throw new Error('county_mapping_requires_review');return {county_code:r.code,location_id:matches[0].id};});
  if(new Set(mapping.map(r=>r.location_id)).size!==47)throw new Error('county_mapping_not_bijective');
  await db.query(`INSERT INTO atlas_control.sources(slug,name,driver,data_kind,status,license,permission_url,attribution,approved_at,approved_by,publication_allowed,refresh_seconds,next_run_at)
   VALUES('kenya-locations','kenya-locations — David Amunga and contributors','kenya_locations','geography','active','CC BY 4.0 (data); MIT (upstream library code)',$1,$2,now(),'cli:published-open-license',true,2592000,'2099-01-01') ON CONFLICT(slug) DO NOTHING`,[repository+'/blob/'+revision+'/data/LICENSE.md',attribution]);
  const source=(await db.query("SELECT * FROM atlas_control.sources WHERE slug='kenya-locations' FOR UPDATE")).rows[0];validateSource(source);
  const provenance={repository,revision,license:'CC-BY-4.0',license_url:'https://creativecommons.org/licenses/by/4.0/',attribution,counts:data.counts,boundary_set:'IEBC 2012',sub_county_vintage:'HDX/DHIS2 source data, 2016–2020; project-assigned codes',limitations:['Reference place names and relationships, not property coordinates or map polygons.','Locality and area provenance is undocumented upstream; coverage is incomplete.','104 ward-to-sub-county links use guided/fuzzy matching or inference.','2019 county populations are historical census context; postal codes refer to county capitals.'],changes:'Atlas assigns internal UUIDs and maps county codes to existing boundary UUIDs; upstream records are retained unchanged in the vendored snapshot.'};
  provenance.county_crosswalk={'013':{reference_name:'Tharaka-Nithi',boundary_name:'Tharaka',basis:'Reviewed label in the existing geoBoundaries KEN ADM1 2020 county layer; existing county UUID preserved.'}};
  const release=(await db.query('INSERT INTO atlas_geo.releases(source_id,revision,package_version,manifest_sha256,provenance) VALUES($1,$2,$3,$4,$5) RETURNING id',[source.id,revision,data.manifest.package_version,data.manifest_sha256,JSON.stringify(provenance)])).rows[0].id;
  await db.query(`INSERT INTO atlas_geo.places(kind,source_key) SELECT r.kind,r.key FROM jsonb_to_recordset($1::jsonb) r(kind text,key text) ON CONFLICT(kind,source_key) DO NOTHING`,[JSON.stringify(data.rows)]);
  const ids=new Map((await db.query('SELECT id,kind,source_key FROM atlas_geo.places')).rows.map(r=>[r.kind+':'+r.source_key,r.id]));
  await db.query(`INSERT INTO atlas_geo.versions(release_id,place_id,name,county_code,code,metadata,provenance_class)
   SELECT $1,r.id,r.name,r.county_code,r.code,r.metadata,r.provenance FROM jsonb_to_recordset($2::jsonb) r(id uuid,name text,county_code text,code text,metadata jsonb,provenance text)`,[release,JSON.stringify(data.rows.map(r=>({...r,id:ids.get(r.kind+':'+r.key)})))]);
  await db.query(`INSERT INTO atlas_geo.relations(release_id,child_id,parent_id,kind,method) SELECT $1,r.child_id,r.parent_id,r.kind,r.method FROM jsonb_to_recordset($2::jsonb) r(child_id uuid,parent_id uuid,kind text,method text)`,[release,JSON.stringify(data.relations.map(r=>({...r,child_id:ids.get(r.child),parent_id:ids.get(r.parent)})))]);
  await db.query(`INSERT INTO atlas_geo.county_mapping(release_id,county_code,location_id) SELECT $1,r.county_code,r.location_id FROM jsonb_to_recordset($2::jsonb) r(county_code text,location_id uuid)`,[release,JSON.stringify(mapping)]);
  await db.query('INSERT INTO atlas_geo.current_release(singleton,release_id) VALUES(true,$1) ON CONFLICT(singleton) DO UPDATE SET release_id=EXCLUDED.release_id',[release]);
  await db.query('UPDATE atlas_control.sources SET last_success_at=now(),watermark=$2 WHERE id=$1',[source.id,JSON.stringify({revision,release_id:release,counts:data.counts})]);
  await db.query('INSERT INTO atlas_control.audit_events(actor_id,action,resource_id,details) VALUES($1,$2,$3,$4)',['cli:database-owner','geography.import',release,JSON.stringify({revision,manifest_sha256:data.manifest_sha256,counts:data.counts})]);
  await db.query('COMMIT');return {status:'imported',release_id:release,counts:data.counts,mapped_counties:mapping.length};
 }catch(error){await db.query('ROLLBACK');throw error;}
}
