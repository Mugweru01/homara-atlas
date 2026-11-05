import { loadEnv } from 'vite';

// The analytics dashboard uses /api on the same origin by default.
// Supabase is legacy and has no consumers in the current application.
const env = {
  ...loadEnv(process.env.NODE_ENV || 'production', process.cwd(), 'VITE_'),
  ...process.env,
};
for (const key of ['VITE_API_URL', 'VITE_NEON_AUTH_URL']) {
  const value = env[key];
  if (!value) continue;
  try {
    const url = new URL(value);
    if (!['http:', 'https:'].includes(url.protocol)) throw new Error();
  } catch {
    console.error(`${key} must be an absolute HTTP(S) URL when configured.`);
    process.exit(1);
  }
}
console.log('Frontend environment validation passed.');
