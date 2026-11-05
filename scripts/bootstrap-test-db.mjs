import pg from 'pg';
const url=new URL(process.env.DATABASE_URL_UNPOOLED||'');
if(process.env.ATLAS_LOCAL_TEST_DB!=='true'||!['localhost','127.0.0.1'].includes(url.hostname))throw new Error('This bootstrap is restricted to an explicitly enabled local CI database');
const db=new pg.Client({connectionString:url.toString()});
try{await db.connect();
 await db.query("CREATE ROLE atlas_api_login LOGIN PASSWORD 'test-api'");
 await db.query("CREATE ROLE atlas_worker_login LOGIN PASSWORD 'test-worker'");
 await db.query('GRANT atlas_api TO atlas_api_login');await db.query('GRANT atlas_worker TO atlas_worker_login');
}finally{await db.end();}
