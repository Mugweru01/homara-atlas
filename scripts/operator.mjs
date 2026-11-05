import pg from 'pg';
const [action,email,role='operator']=process.argv.slice(2);
if(!['grant','revoke'].includes(action)||!email||!['operator','admin'].includes(role))throw new Error('Usage: node --env-file=.env.local scripts/operator.mjs grant|revoke <existing-auth-email> [operator|admin]');
const db=new pg.Client({connectionString:process.env.DATABASE_URL_UNPOOLED?.replace('sslmode=require','sslmode=verify-full')});
try{await db.connect();await db.query('BEGIN');
 const {rows}=await db.query('SELECT id FROM neon_auth."user" WHERE lower(email)=lower($1)',[email]);
 if(rows.length!==1)throw new Error('Exactly one existing Atlas Auth account must match; this command never creates accounts');
 const id=rows[0].id;
 if(action==='grant')await db.query('INSERT INTO atlas_security.operator_roles(user_id,role) VALUES($1,$2) ON CONFLICT(user_id) DO UPDATE SET role=EXCLUDED.role,granted_at=now()',[id,role]);
 else await db.query('DELETE FROM atlas_security.operator_roles WHERE user_id=$1',[id]);
 await db.query('INSERT INTO atlas_control.audit_events(actor_id,action,resource_id,details) VALUES($1,$2,$3,$4)',['cli:database-owner','operator.'+action,id,JSON.stringify({role})]);
 await db.query('COMMIT');console.log('Operator access updated and audited. Authorization changes take effect on the next protected request.');
}catch(error){await db.query('ROLLBACK');throw error;}finally{await db.end();}
