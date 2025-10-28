# 🚀 Production Deployment Guide

**Complete guide to deploying Homara Gatekeeper Admin Panel to production**

---

## 📋 Pre-Deployment Checklist

### Environment Setup
- [ ] Production Supabase project created
- [ ] Production environment variables configured
- [ ] Database migrations applied
- [ ] Backups configured (3-day interval)
- [ ] PITR enabled
- [ ] Domain name purchased (if needed)
- [ ] SSL certificate configured (automatic with Vercel/Netlify)

### Code Quality
- [ ] All tests passing
- [ ] No linter errors
- [ ] No console.logs in production
- [ ] Environment variables not hardcoded
- [ ] Secrets in `.env` files
- [ ] `.env` in `.gitignore`

### Security
- [ ] RLS policies enabled
- [ ] 2FA configured for admins
- [ ] IP whitelist configured
- [ ] Password policies enforced
- [ ] Security scan run
- [ ] No known vulnerabilities

---

## 🛠️ Deployment Options

### Option 1: Vercel (Recommended) ⭐

**Pros:**
- ✅ Automatic HTTPS
- ✅ Global CDN
- ✅ Automatic deployments from Git
- ✅ Preview deployments for PRs
- ✅ Zero config for Vite
- ✅ Free tier available

**Steps:**

1. **Install Vercel CLI:**
```bash
npm i -g vercel
```

2. **Login:**
```bash
vercel login
```

3. **Deploy:**
```bash
# First deployment (interactive)
vercel

# Production deployment
vercel --prod
```

4. **Configure Environment Variables:**
```bash
# Via CLI
vercel env add VITE_SUPABASE_URL production
vercel env add VITE_SUPABASE_ANON_KEY production

# Or via dashboard
https://vercel.com/[your-project]/settings/environment-variables
```

5. **Configure Domain:**
```bash
vercel domains add yourdomain.com
```

---

### Option 2: Netlify

**Pros:**
- ✅ Simple deployment
- ✅ Automatic HTTPS
- ✅ Form handling
- ✅ Serverless functions
- ✅ Free tier available

**Steps:**

1. **Install Netlify CLI:**
```bash
npm i -g netlify-cli
```

2. **Login:**
```bash
netlify login
```

3. **Initialize:**
```bash
netlify init
```

4. **Deploy:**
```bash
# Build first
npm run build

# Deploy
netlify deploy --prod --dir=dist
```

5. **Environment Variables:**
```bash
# Create netlify.toml
[build]
  command = "npm run build"
  publish = "dist"

[[redirects]]
  from = "/*"
  to = "/index.html"
  status = 200
```

---

### Option 3: Self-Hosted (VPS)

**For full control:**

1. **Setup VPS** (DigitalOcean, Linode, etc.)

2. **Install Node.js:**
```bash
curl -fsSL https://deb.nodesource.com/setup_18.x | sudo -E bash -
sudo apt-get install -y nodejs
```

3. **Install Nginx:**
```bash
sudo apt update
sudo apt install nginx
```

4. **Clone Repo:**
```bash
git clone https://github.com/your-repo.git
cd your-repo
npm install
npm run build
```

5. **Configure Nginx:**
```nginx
server {
    listen 80;
    server_name yourdomain.com;

    root /var/www/homara-gatekeeper/dist;
    index index.html;

    location / {
        try_files $uri $uri/ /index.html;
    }

    # Gzip compression
    gzip on;
    gzip_types text/plain text/css application/json application/javascript text/xml application/xml application/xml+rss text/javascript;
}
```

6. **Setup SSL (Let's Encrypt):**
```bash
sudo apt install certbot python3-certbot-nginx
sudo certbot --nginx -d yourdomain.com
```

7. **Setup PM2 (if using server-side rendering):**
```bash
npm install -g pm2
pm2 start npm --name "homara" -- start
pm2 save
pm2 startup
```

---

## 🗄️ Database Setup

### 1. **Production Supabase Project**

Create at: https://app.supabase.com

**Settings to configure:**
- Project name
- Database password (STRONG!)
- Region (closest to users)
- Pricing plan

### 2. **Apply Migrations**

Using Supabase CLI:
```bash
# Install CLI
npm install -g supabase

# Link to project
supabase link --project-ref your-project-ref

# Push migrations
supabase db push

# Or manually via MCP
# Run each migration file in order
```

**Migration Order:**
1. `20251028_admin_notifications_system.sql`
2. `20251029_backup_system.sql`
3. `20251030_monitoring_system.sql`
4. `20251031_security_enhancements.sql`
5. `20251101_bulk_operations.sql`
6. `20251102_advanced_filtering.sql`
7. `20251103_export_system.sql`
8. `20251104_scheduled_reports.sql`
9. `20251105_activity_timeline.sql`
10. `20251106_email_notifications.sql`
11. `20251107_advanced_analytics.sql`
12. `20251108_custom_report_builder.sql`
13. `20251109_performance_metrics.sql`
14. `20251110_dashboard_customization.sql`
15. `20251111_automated_workflows.sql`
16. `20251112_password_policies_security.sql`

### 3. **Configure Backups**

In Supabase Dashboard:
- Settings → Database → Backups
- Enable daily backups
- Enable PITR
- Set retention period (7-30 days)

### 4. **Create Super Admin**

```sql
-- Insert into auth.users first (via Supabase dashboard)
-- Then create admin record
INSERT INTO admins (user_id, email, admin_role, status)
VALUES (
  'auth-user-id-here',
  'admin@yourdomain.com',
  'super_admin',
  'active'
);
```

---

## ⚙️ Environment Variables

### Production `.env`:
```bash
# Supabase
VITE_SUPABASE_URL=https://your-project.supabase.co
VITE_SUPABASE_ANON_KEY=your-anon-key-here

# App Config
VITE_APP_NAME=Homara Gatekeeper
VITE_APP_URL=https://yourdomain.com
VITE_ENVIRONMENT=production

# Optional
VITE_ANALYTICS_ID=GA-XXXXXXXXX
VITE_SENTRY_DSN=https://xxx@sentry.io/xxx
```

### Security Notes:
- ✅ Use **ANON** key (not service_role!)
- ✅ **Never** commit `.env` files
- ✅ Rotate keys if compromised
- ✅ Use different keys for prod/dev

---

## 🔒 Security Hardening

### 1. **Enable IP Whitelist** (Optional)

In Supabase Dashboard:
- Settings → API → Restrictions
- Add trusted IP addresses

### 2. **Configure RLS**

Already done! All tables have RLS enabled.

### 3. **Setup Email Auth**

- Configure SMTP (SendGrid, AWS SES, etc.)
- Setup email templates
- Test verification emails

### 4. **Enable 2FA**

Supabase Auth handles this. Just enable in dashboard:
- Authentication → Settings
- Enable "Phone" provider for SMS 2FA

---

## 📊 Monitoring Setup

### 1. **Supabase Dashboard**

Monitor:
- Database size
- API requests
- Connection count
- Error rate

### 2. **Application Monitoring**

Add Sentry (optional):
```bash
npm install @sentry/react @sentry/vite-plugin
```

```typescript
// src/main.tsx
import * as Sentry from "@sentry/react";

Sentry.init({
  dsn: import.meta.env.VITE_SENTRY_DSN,
  environment: import.meta.env.VITE_ENVIRONMENT,
  integrations: [
    new Sentry.BrowserTracing(),
    new Sentry.Replay(),
  ],
  tracesSampleRate: 1.0,
  replaysSessionSampleRate: 0.1,
  replaysOnErrorSampleRate: 1.0,
});
```

### 3. **Performance Monitoring**

Already built in! Check:
- `/admin/performance` page
- `/admin/monitoring` page
- `/admin/analytics` page

---

## 🚀 Deployment Steps

### Step-by-Step:

**1. Prepare Code:**
```bash
# Pull latest
git pull origin main

# Install dependencies
npm install

# Run tests
npm test

# Build for production
npm run build

# Check build
ls -la dist/
```

**2. Setup Production Database:**
```bash
# Create Supabase project (via dashboard)
# Apply migrations
# Create super admin
# Enable RLS
# Configure backups
```

**3. Deploy Frontend:**
```bash
# Vercel
vercel --prod

# Or Netlify
netlify deploy --prod --dir=dist

# Or upload dist/ to your server
```

**4. Configure Domain:**
```bash
# Point domain to deployment
# Wait for DNS propagation (up to 48 hours)
# Enable SSL (automatic on Vercel/Netlify)
```

**5. Test Deployment:**
```bash
# Visit your domain
curl https://yourdomain.com

# Test admin login
# Test all features
# Check console for errors
# Run security scan
```

**6. Monitor:**
```bash
# Check logs
# Monitor performance
# Watch error rate
# Review user activity
```

---

## ✅ Post-Deployment Checklist

### Functionality:
- [ ] Admin login works
- [ ] Dashboard loads
- [ ] All pages accessible
- [ ] Database queries work
- [ ] Real-time updates work
- [ ] File uploads work (if applicable)
- [ ] Email notifications work (if configured)

### Performance:
- [ ] Page load < 3 seconds
- [ ] API responses < 500ms
- [ ] No console errors
- [ ] Images load quickly
- [ ] Lighthouse score > 80

### Security:
- [ ] HTTPS enabled
- [ ] RLS working
- [ ] 2FA available
- [ ] IP whitelist configured (if needed)
- [ ] Password policy enforced
- [ ] Security scan run
- [ ] No secrets exposed

### Monitoring:
- [ ] Error tracking setup
- [ ] Performance monitoring active
- [ ] Backup schedule confirmed
- [ ] Alerts configured
- [ ] Logs accessible

---

## 🔄 Continuous Deployment

### GitHub Actions (Automatic):

```yaml
# .github/workflows/deploy.yml
name: Deploy to Production

on:
  push:
    branches: [main]

jobs:
  deploy:
    runs-on: ubuntu-latest
    
    steps:
      - uses: actions/checkout@v3
      
      - name: Setup Node
        uses: actions/setup-node@v3
        with:
          node-version: '18'
      
      - name: Install dependencies
        run: npm ci
      
      - name: Run tests
        run: npm test
      
      - name: Build
        run: npm run build
        env:
          VITE_SUPABASE_URL: ${{ secrets.VITE_SUPABASE_URL }}
          VITE_SUPABASE_ANON_KEY: ${{ secrets.VITE_SUPABASE_ANON_KEY }}
      
      - name: Deploy to Vercel
        uses: amondnet/vercel-action@v25
        with:
          vercel-token: ${{ secrets.VERCEL_TOKEN }}
          vercel-org-id: ${{ secrets.VERCEL_ORG_ID }}
          vercel-project-id: ${{ secrets.VERCEL_PROJECT_ID }}
          vercel-args: '--prod'
```

---

## 🆘 Rollback Procedure

### If deployment fails:

**Vercel:**
```bash
# List deployments
vercel list

# Rollback to previous
vercel rollback [deployment-url]
```

**Netlify:**
```bash
# Via dashboard
# Deployments → Previous deployment → Publish
```

**Database Rollback:**
```sql
-- Use PITR (Point-in-Time Recovery)
-- Supabase Dashboard → Database → Backups
-- Restore to specific timestamp
```

---

## 📚 Additional Resources

- **Supabase Docs:** https://supabase.com/docs
- **Vercel Docs:** https://vercel.com/docs
- **Netlify Docs:** https://docs.netlify.com
- **React Docs:** https://react.dev
- **Vite Docs:** https://vitejs.dev

---

## 🎯 Success Criteria

**Deployment is successful when:**
1. ✅ Site accessible via custom domain
2. ✅ HTTPS enabled (green padlock)
3. ✅ Admin login works
4. ✅ All features functional
5. ✅ No console errors
6. ✅ Lighthouse score > 80
7. ✅ Backups configured
8. ✅ Monitoring active
9. ✅ Security scan clean
10. ✅ Team can access

---

**You're ready for production! Deploy with confidence!** 🚀

