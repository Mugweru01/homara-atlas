import test from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
const validate = (extra = {}) => spawnSync(process.execPath, ['--import', 'tsx', 'vite-env-validate.ts'], {
  cwd: process.cwd(), encoding: 'utf8', env: { ...process.env, VITE_API_URL: '', VITE_NEON_AUTH_URL: '', ...extra },
});
test('same-origin analytics builds without legacy Supabase credentials', () => {
  const result = validate({ VITE_SUPABASE_URL: '', VITE_SUPABASE_ANON_KEY: '' });
  assert.equal(result.status, 0, result.stderr);
});
test('invalid public endpoint is rejected', () => {
  const result = validate({ VITE_API_URL: 'javascript:alert(1)' });
  assert.equal(result.status, 1);
  assert.match(result.stderr, /VITE_API_URL must be/);
});
test('public Auth URL is validated independently', () => {
  assert.equal(validate({ VITE_NEON_AUTH_URL: 'not-a-url' }).status, 1);
  assert.equal(validate({ VITE_NEON_AUTH_URL: 'https://auth.example.test/auth' }).status, 0);
});
