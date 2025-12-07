# Edge Function Deployment Guide

## create-admin Function

The `create-admin` Edge Function must be deployed to Supabase before it can be used.

### Deployment Steps

1. **Install Supabase CLI** (if not already installed):
   ```bash
   npm install -g supabase
   ```

2. **Login to Supabase**:
   ```bash
   supabase login
   ```

3. **Link your project**:
   ```bash
   supabase link --project-ref your-project-ref
   ```

4. **Deploy the function**:
   ```bash
   supabase functions deploy create-admin
   ```

5. **Set environment variables** (if needed):
   ```bash
   supabase secrets set ADMIN_ORIGIN=http://192.168.100.9:8080
   ```

### Verify Deployment

1. Go to your Supabase Dashboard
2. Navigate to **Edge Functions**
3. Verify `create-admin` function is listed
4. Check function logs for any errors

### Troubleshooting

**Error: "Failed to send a request to the Edge Function"**

1. **Check if function is deployed:**
   - Go to Supabase Dashboard → Edge Functions
   - Verify `create-admin` exists

2. **Check function logs:**
   - Click on `create-admin` function
   - View logs for errors

3. **Verify authentication:**
   - Ensure you're logged in as super admin
   - Check browser console for auth errors

4. **Check CORS settings:**
   - Verify `ADMIN_ORIGIN` environment variable is set
   - Should match your current URL (e.g., `http://192.168.100.9:8080`)

5. **Test function directly:**
   ```bash
   supabase functions serve create-admin
   ```

### Local Development

To test locally:

```bash
# Start local Supabase
supabase start

# Serve the function locally
supabase functions serve create-admin --env-file .env.local
```

### Required Environment Variables

The function uses these automatically provided variables:
- `SUPABASE_URL` - Automatically provided by Supabase
- `SUPABASE_SERVICE_ROLE_KEY` - Automatically provided by Supabase
- `ADMIN_ORIGIN` - Optional, defaults to `https://admin.homara.com`

Set `ADMIN_ORIGIN` for local development:
```bash
supabase secrets set ADMIN_ORIGIN=http://192.168.100.9:8080
```

---

**Last Updated:** February 2, 2025

