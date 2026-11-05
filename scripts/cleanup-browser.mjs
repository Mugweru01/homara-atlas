import pg from 'pg';
import { S3Client, DeleteObjectCommand } from '@aws-sdk/client-s3';
const email = process.argv[2];
if (!/^atlas-browser-[0-9]+@example\.test$/.test(email || '')) throw new Error('Only generated Atlas browser verification accounts can be cleaned');
const db=new pg.Client({connectionString:process.env.DATABASE_URL});const s3=new S3Client({forcePathStyle:true});
try {await db.connect();const {rows:users}=await db.query('SELECT id FROM neon_auth."user" WHERE email=$1',[email]);
for(const user of users){const {rows}=await db.query('SELECT object_key FROM atlas_reports WHERE owner_id=$1',[user.id]);for(const row of rows)await s3.send(new DeleteObjectCommand({Bucket:'assets',Key:row.object_key}));await db.query('DELETE FROM atlas_reports WHERE owner_id=$1',[user.id]);await db.query('DELETE FROM neon_auth."user" WHERE id=$1',[user.id]);}
console.log(`Cleaned ${users.length} browser verification account(s) and their private reports`);
}finally{await db.end();}
