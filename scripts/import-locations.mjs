import pg from 'pg';
import {loadReference,revision} from './lib/location-dataset.mjs';
import {importLocations} from './lib/import-locations.mjs';
if(!['--check','--apply'].includes(process.argv[2]))throw new Error('Usage: node --env-file=.env.local scripts/import-locations.mjs --check|--apply');
const data=await loadReference();
if(process.argv[2]==='--check')console.log(JSON.stringify({status:'validated',revision,counts:data.counts,relationships:data.relations.length,manifest_sha256:data.manifest_sha256}));
else{
 if(!process.env.DATABASE_URL_UNPOOLED)throw new Error('A direct owner connection is required');
 const db=new pg.Client({connectionString:process.env.DATABASE_URL_UNPOOLED.replace('sslmode=require','sslmode=verify-full')});
 try{await db.connect();console.log(JSON.stringify(await importLocations(db)));}finally{await db.end();}
}
