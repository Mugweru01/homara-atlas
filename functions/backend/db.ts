import { Pool, type PoolClient } from 'pg';
import { attachDatabasePool } from '@neon/functions';

export function createPool(url: string | undefined): Pool {
  if (!url) throw new Error('A dedicated Atlas database credential is required');
  const parsed = new URL(url);
  if (!['postgres:', 'postgresql:'].includes(parsed.protocol)) throw new Error('Invalid database protocol');
  parsed.searchParams.set('sslmode', 'verify-full');
  const pool = new Pool({ connectionString: parsed.toString(), max: 4, connectionTimeoutMillis: 15000, idleTimeoutMillis: 20000, statement_timeout: 15000, query_timeout: 20000 });
  attachDatabasePool(pool);
  return pool;
}

export async function transaction<T>(pool: Pool, fn: (db: PoolClient) => Promise<T>, userId?: string): Promise<T> {
  const db = await pool.connect();
  try {
    await db.query('BEGIN');
    await db.query("SELECT set_config('statement_timeout','15000',true),set_config('idle_in_transaction_session_timeout','20000',true)");
    if (userId) await db.query("SELECT set_config('atlas.user_id',$1,true)", [userId]);
    const result = await fn(db);
    await db.query('COMMIT');
    return result;
  } catch (error) { await db.query('ROLLBACK'); throw error; }
  finally { db.release(); }
}
