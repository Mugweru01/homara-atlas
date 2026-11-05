import { readFile, readdir } from "node:fs/promises";
import { createHash } from 'node:crypto';
import pg from "pg";
const url = process.env.DATABASE_URL_UNPOOLED;
if (!url || new URL(url).hostname.includes("-pooler")) throw new Error("Migration requires a direct DATABASE_URL_UNPOOLED");
const client = new pg.Client({ connectionString: url.replace('sslmode=require','sslmode=verify-full') });
try {
  await client.connect();
  await client.query("SELECT pg_advisory_lock(hashtext('atlas-schema-migrations'))");
  await client.query('CREATE SCHEMA IF NOT EXISTS atlas_meta');
  await client.query('CREATE TABLE IF NOT EXISTS atlas_meta.schema_migrations(name text PRIMARY KEY, checksum text NOT NULL, applied_at timestamptz NOT NULL DEFAULT now())');
  const directory = new URL('../database/neon/', import.meta.url);
  for (const name of (await readdir(directory)).filter(name => /^\d+.*\.sql$/.test(name)).sort()) {
    const sql = await readFile(new URL(name, directory), 'utf8');
    const checksum = createHash('sha256').update(sql).digest('hex');
    const { rows: [applied] } = await client.query('SELECT checksum FROM atlas_meta.schema_migrations WHERE name=$1', [name]);
    if (applied) { if (applied.checksum !== checksum) throw new Error(`Previously applied migration changed: ${name}`); continue; }
    await client.query('BEGIN');
    try {
      await client.query(sql.replace(/^\s*BEGIN;/i, '').replace(/COMMIT;\s*$/i, ''));
      await client.query('INSERT INTO atlas_meta.schema_migrations(name,checksum) VALUES($1,$2)', [name,checksum]);
      await client.query('COMMIT');
      console.log(`Applied ${name}`);
    } catch (error) { await client.query('ROLLBACK'); throw error; }
  }
} finally { await client.end(); }
