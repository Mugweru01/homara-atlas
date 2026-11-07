// The owner runs this only after approving the allowlisted public export.
import pg from 'pg';
if(process.argv[2]!=='--activate')throw new Error('Pass --activate to record owner approval and enable the public Homara feed');
const db=new pg.Client({connectionString:process.env.DATABASE_URL_UNPOOLED?.replace('sslmode=require','sslmode=verify-full')});
try{await db.connect();await db.query('BEGIN');
 const {rows:[source]}=await db.query(`INSERT INTO atlas_control.sources(slug,name,driver,data_kind,status,license,permission_url,attribution,approved_at,approved_by,publication_allowed,refresh_seconds)
 VALUES('homara-public-listings','Confidential Homara advertisement research feed','homara_public','listings','active','Confidential first-party ingestion only; no public redistribution','https://homara.co.ke/p/terms','Homara advertisement observations. Confidential ingestion; excluded from public outputs. No contacts or customer identities.',now(),'cli:database-owner',false,86400)
 ON CONFLICT(slug) DO NOTHING RETURNING id`);
 if(!source)throw new Error('Homara source already exists; use the audited source controls to change its approval');
 await db.query('INSERT INTO atlas_control.audit_events(actor_id,action,resource_id,details) VALUES($1,$2,$3,$4)',['cli:database-owner','source.approved',source.id,JSON.stringify({authorization:'Owner explicitly approved connecting the Homara public-listing export',scope:'public advertisements only; excludes identities, contacts, messages, applications and coordinates',delivery:'daily',listing_level_display:false})]);
 await db.query('COMMIT');console.log(JSON.stringify({source_id:source.id,status:'active',refresh:'daily',listing_level_display:false}));
}catch(error){await db.query('ROLLBACK');throw error;}finally{await db.end();}
