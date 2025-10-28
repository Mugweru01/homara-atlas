# Environment Variables Setup

This document describes all environment variables required for the Homara Gatekeeper application.

## Required Environment Variables

Create a `.env.local` file in the project root with the following variables:

### Supabase Configuration

Get these values from your Supabase project dashboard at:
https://app.supabase.com/project/YOUR_PROJECT_ID/settings/api

```bash
# Your Supabase project URL
VITE_SUPABASE_URL=https://your-project-id.supabase.co

# Your Supabase anon/public API key (safe to use in client-side code)
VITE_SUPABASE_ANON_KEY=your-anon-key-here
```

### Upstash Redis Configuration

Get these from your Upstash Redis dashboard at:
https://console.upstash.com/

```bash
# Upstash Redis REST URL
VITE_UPSTASH_REDIS_REST_URL=https://your-redis-url.upstash.io

# Upstash Redis REST token
VITE_UPSTASH_REDIS_REST_TOKEN=your-redis-token-here
```

### Admin Configuration

```bash
# Admin panel origin for CORS (used in edge functions)
# For local development: http://localhost:8080
# For production: https://admin.homara.com
ADMIN_ORIGIN=http://localhost:8080

# Environment mode
NODE_ENV=development
```

## Edge Function Environment Variables

The following environment variables should be configured in your Supabase Edge Functions settings:

### admin-auth Edge Function

Navigate to: https://app.supabase.com/project/YOUR_PROJECT_ID/functions

Set these secrets for the `admin-auth` function:

- `SUPABASE_URL`: Your Supabase project URL (automatically provided)
- `SUPABASE_SERVICE_ROLE_KEY`: Your service role key (automatically provided)
- `ADMIN_ORIGIN`: Your admin panel origin (e.g., https://admin.homara.com)

## GitHub Actions Secrets

Configure these secrets in your GitHub repository settings:

Navigate to: https://github.com/YOUR_USERNAME/YOUR_REPO/settings/secrets/actions

- `VITE_SUPABASE_URL`: Your Supabase project URL
- `VITE_SUPABASE_ANON_KEY`: Your Supabase anon key
- `VERCEL_TOKEN`: Your Vercel deployment token
- `VERCEL_ORG_ID`: Your Vercel organization ID
- `VERCEL_PROJECT_ID`: Your Vercel project ID

## Security Notes

⚠️ **IMPORTANT SECURITY GUIDELINES:**

1. **Never commit** `.env` or `.env.local` files to version control
2. **Never hardcode** API keys or secrets in your source code
3. **Use different credentials** for development and production
4. **Rotate credentials regularly**, especially if exposed
5. **Use GitHub Secrets** for CI/CD pipelines
6. **Use Supabase Edge Function Secrets** for serverless functions
7. **Restrict API key permissions** to the minimum required

## Verification

After setting up your environment variables, verify the configuration:

```bash
# Install dependencies
npm install

# Run the development server
npm run dev

# Check for any environment variable errors in the console
```

If you see an error like "Missing Supabase environment variables", ensure your `.env.local` file exists and contains all required variables.

## Troubleshooting

### Application fails to start

**Error:** "Missing Supabase environment variables"

**Solution:** Create a `.env.local` file with all required variables listed above.

### Redis operations fail

**Error:** "Redis configuration missing"

**Solution:** Add `VITE_UPSTASH_REDIS_REST_URL` and `VITE_UPSTASH_REDIS_REST_TOKEN` to your `.env.local` file.

### Admin authentication fails

**Error:** CORS error or authentication failure

**Solution:** 
1. Verify `ADMIN_ORIGIN` is set correctly in Supabase Edge Function secrets
2. Ensure the origin matches your application URL exactly (including protocol and port)
3. Check that the `admin-auth` edge function is deployed and active

## Production Deployment

When deploying to production:

1. Update all environment variables with production values
2. Set `NODE_ENV=production`
3. Use production Supabase project credentials
4. Configure proper CORS origins for your production domain
5. Enable proper security headers and CSP policies

## Additional Resources

- [Supabase Documentation](https://supabase.com/docs)
- [Upstash Redis Documentation](https://docs.upstash.com/redis)
- [Vite Environment Variables](https://vitejs.dev/guide/env-and-mode.html)



