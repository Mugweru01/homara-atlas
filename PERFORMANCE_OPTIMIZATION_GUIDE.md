# Performance Optimization Guide

**Week 7: Performance Optimization**  
**Focus:** Database & Frontend Optimization

---

## 📋 Overview

Comprehensive performance optimization guide for the Homara Gatekeeper Admin Panel, covering database queries, frontend performance, caching strategies, and monitoring.

---

## 🎯 Optimization Goals

### Performance Targets:
- **Page Load:** < 2 seconds
- **Time to Interactive:** < 3 seconds
- **API Response:** < 500ms (p95)
- **Database Queries:** < 100ms (p95)
- **Lighthouse Score:** > 90

---

## 🗄️ Database Optimization

### 1. Query Optimization

#### ✅ **Already Optimized:**
All your tables already have indexes! Here's what you have:

```sql
-- Task Assignments
idx_task_assign_admin (assigned_to)
idx_task_assign_entity (entity_type, entity_id)
idx_task_assign_status (status)
idx_task_assign_priority (priority)
idx_task_assign_due (due_date) WHERE status IN ('pending', 'in_progress')

-- Security
idx_login_attempts_user (user_id)
idx_login_attempts_email (email)
idx_login_attempts_ip (ip_address)
idx_account_lockouts_user (user_id)
idx_account_lockouts_until (locked_until)

-- Analytics
idx_analytics_metrics_recorded (recorded_at)
idx_analytics_metrics_category (metric_category)

-- Performance
idx_performance_metrics_recorded (recorded_at)
idx_error_logs_occurred (occurred_at)
idx_page_load_metrics_recorded (recorded_at)

...and 50+ more!
```

#### 🔍 **Check Unused Indexes:**
```sql
-- Find unused indexes
SELECT schemaname, tablename, indexname, idx_scan
FROM pg_stat_user_indexes
WHERE idx_scan = 0
  AND indexrelname NOT LIKE 'pg_toast%'
ORDER BY schemaname, tablename;

-- Drop if truly unused (BE CAREFUL!)
-- DROP INDEX IF EXISTS unused_index_name;
```

#### 🎯 **Query Analysis:**
```sql
-- Enable query timing
SET track_functions = 'all';
SET track_activities = ON;

-- Find slow queries
SELECT
  query,
  calls,
  total_time,
  mean_time,
  max_time
FROM pg_stat_statements
WHERE mean_time > 100  -- Queries slower than 100ms
ORDER BY mean_time DESC
LIMIT 20;

-- Analyze specific query
EXPLAIN ANALYZE
SELECT * FROM get_my_assignments();
```

---

### 2. Function Optimization

#### ✅ **Current Status:**
All functions already have `SECURITY DEFINER` and most have `STABLE` attribute.

#### 🚀 **Add STABLE Where Missing:**
```sql
-- Functions that don't modify data should be STABLE
ALTER FUNCTION get_dashboard_stats() STABLE;
ALTER FUNCTION get_system_metrics() STABLE;
ALTER FUNCTION get_backup_status() STABLE;

-- Check function attributes
SELECT 
  proname as function_name,
  provolatile as volatility,
  CASE provolatile
    WHEN 'i' THEN 'IMMUTABLE'
    WHEN 's' THEN 'STABLE'
    WHEN 'v' THEN 'VOLATILE'
  END as volatility_label
FROM pg_proc
WHERE pronamespace = 'public'::regnamespace
  AND prokind = 'f'
ORDER BY proname;
```

#### ⚡ **Materialized Views (Advanced):**
```sql
-- For expensive analytics queries
CREATE MATERIALIZED VIEW mv_daily_stats AS
SELECT 
  DATE(created_at) as date,
  COUNT(*) as total_users,
  COUNT(*) FILTER (WHERE role = 'renter') as renters,
  COUNT(*) FILTER (WHERE role = 'customer') as customers
FROM profiles
GROUP BY DATE(created_at);

-- Create index
CREATE INDEX idx_mv_daily_stats_date ON mv_daily_stats(date);

-- Refresh periodically (via cron or trigger)
REFRESH MATERIALIZED VIEW CONCURRENTLY mv_daily_stats;
```

---

### 3. Connection Pooling

#### Already Configured (Supabase):
- ✅ Connection pooling enabled
- ✅ PgBouncer configured
- ✅ Max connections: 15-25 (per project)

#### 🔧 **Optimize Frontend Connection:**
```typescript
// src/integrations/supabase/client.ts
import { createClient } from '@supabase/supabase-js';

export const supabase = createClient(
  process.env.VITE_SUPABASE_URL!,
  process.env.VITE_SUPABASE_ANON_KEY!,
  {
    auth: {
      persistSession: true,
      autoRefreshToken: true,
    },
    db: {
      schema: 'public',
    },
    global: {
      headers: {
        'x-my-custom-header': 'homara-gatekeeper',
      },
    },
    // Add pooler for better performance
    realtime: {
      params: {
        eventsPerSecond: 2, // Limit realtime updates
      },
    },
  }
);
```

---

## 🎨 Frontend Optimization

### 1. Code Splitting

#### ✅ **Already Implemented:**
You're already using lazy loading for admin pages!

```typescript
// src/App.tsx
const AdminDashboard = lazy(() => import("./pages/admin/Dashboard"));
const AdminUsers = lazy(() => import("./pages/admin/Users"));
// ...etc
```

#### 🚀 **Add More Granular Splitting:**
```typescript
// Split large components
const NotificationCenter = lazy(() => import("./components/admin/NotificationCenter"));
const BulkActionsBar = lazy(() => import("./components/admin/BulkActionsBar"));
const AdvancedFilter = lazy(() => import("./components/admin/AdvancedFilter"));

// Use with Suspense
<Suspense fallback={<Spinner />}>
  <NotificationCenter />
</Suspense>
```

---

### 2. Memoization

#### React.memo for Components:
```typescript
// Before
export function StatCard({ stat }: { stat: Stat }) {
  return <Card>{stat.value}</Card>;
}

// After (prevents unnecessary re-renders)
export const StatCard = React.memo(({ stat }: { stat: Stat }) => {
  return <Card>{stat.value}</Card>;
});
```

#### useMemo for Expensive Calculations:
```typescript
// src/pages/admin/Analytics.tsx
const chartData = useMemo(() => {
  return rawData.map(item => ({
    date: format(new Date(item.date), 'MMM dd'),
    value: item.count
  }));
}, [rawData]); // Only recalculate when rawData changes
```

#### useCallback for Functions:
```typescript
// Before
const handleFilter = (filter) => {
  setActiveFilter(filter);
};

// After (prevents child re-renders)
const handleFilter = useCallback((filter) => {
  setActiveFilter(filter);
}, []); // Dependencies array
```

---

### 3. Virtual Scrolling

For large lists (100+ items):

```typescript
// Install
npm install @tanstack/react-virtual

// Use in large tables
import { useVirtualizer } from '@tanstack/react-virtual';

function LargeUserList({ users }) {
  const parentRef = useRef();
  
  const virtualizer = useVirtualizer({
    count: users.length,
    getScrollElement: () => parentRef.current,
    estimateSize: () => 50, // Row height
  });

  return (
    <div ref={parentRef} style={{ height: '600px', overflow: 'auto' }}>
      <div style={{ height: `${virtualizer.getTotalSize()}px` }}>
        {virtualizer.getVirtualItems().map((virtualRow) => (
          <div
            key={virtualRow.index}
            style={{
              position: 'absolute',
              top: 0,
              left: 0,
              width: '100%',
              height: `${virtualRow.size}px`,
              transform: `translateY(${virtualRow.start}px)`,
            }}
          >
            {users[virtualRow.index].name}
          </div>
        ))}
      </div>
    </div>
  );
}
```

---

### 4. Image Optimization

#### Use Next-Gen Formats:
```typescript
// Prefer WebP/AVIF over JPEG/PNG
<img 
  src="/logo.webp" 
  alt="Logo"
  loading="lazy"  // Native lazy loading
/>

// Or with picture element
<picture>
  <source srcSet="/logo.avif" type="image/avif" />
  <source srcSet="/logo.webp" type="image/webp" />
  <img src="/logo.png" alt="Logo" loading="lazy" />
</picture>
```

#### Lazy Load Images:
```typescript
import { useEffect, useRef, useState } from 'react';

function LazyImage({ src, alt }) {
  const [imageSrc, setImageSrc] = useState('/placeholder.png');
  const imgRef = useRef();

  useEffect(() => {
    const observer = new IntersectionObserver((entries) => {
      if (entries[0].isIntersecting) {
        setImageSrc(src);
        observer.disconnect();
      }
    });

    if (imgRef.current) {
      observer.observe(imgRef.current);
    }

    return () => observer.disconnect();
  }, [src]);

  return <img ref={imgRef} src={imageSrc} alt={alt} />;
}
```

---

### 5. Debouncing & Throttling

#### Debounce Search:
```typescript
import { useMemo } from 'react';
import { debounce } from 'lodash-es'; // or custom implementation

function SearchComponent() {
  const [searchTerm, setSearchTerm] = useState('');

  const debouncedSearch = useMemo(
    () => debounce((term) => {
      // Actual search logic
      fetchResults(term);
    }, 300), // 300ms delay
    []
  );

  const handleChange = (e) => {
    setSearchTerm(e.target.value);
    debouncedSearch(e.target.value);
  };

  return <input value={searchTerm} onChange={handleChange} />;
}
```

#### Throttle Scroll Events:
```typescript
import { throttle } from 'lodash-es';

const handleScroll = useMemo(
  () => throttle(() => {
    // Scroll logic
    console.log('Scrolled');
  }, 100), // Max once per 100ms
  []
);

useEffect(() => {
  window.addEventListener('scroll', handleScroll);
  return () => window.removeEventListener('scroll', handleScroll);
}, [handleScroll]);
```

---

### 6. Bundle Optimization

#### Vite Configuration:
```typescript
// vite.config.ts
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  build: {
    rollupOptions: {
      output: {
        manualChunks: {
          // Split vendor code
          'react-vendor': ['react', 'react-dom', 'react-router-dom'],
          'ui-vendor': ['@radix-ui/react-dialog', '@radix-ui/react-dropdown-menu'],
          'chart-vendor': ['recharts'],
          'form-vendor': ['react-hook-form', 'zod'],
        },
      },
    },
    // Minification
    minify: 'terser',
    terserOptions: {
      compress: {
        drop_console: true, // Remove console.logs in production
      },
    },
  },
  // Optimize deps
  optimizeDeps: {
    include: ['react', 'react-dom'],
  },
});
```

---

## 🔄 Caching Strategies

### 1. React Query Caching

#### Already Using QueryClient:
```typescript
// src/App.tsx
const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 5 * 60 * 1000, // 5 minutes
      cacheTime: 10 * 60 * 1000, // 10 minutes
      refetchOnWindowFocus: false, // Prevent unnecessary refetches
      retry: 1, // Only retry once on failure
    },
  },
});
```

#### Use in Components:
```typescript
import { useQuery } from '@tanstack/react-query';

function Dashboard() {
  const { data: stats, isLoading } = useQuery({
    queryKey: ['dashboard-stats'],
    queryFn: async () => {
      const { data } = await supabase.rpc('get_dashboard_stats');
      return data;
    },
    staleTime: 5 * 60 * 1000, // Cache for 5 minutes
  });

  if (isLoading) return <Spinner />;
  return <div>{stats.total_users}</div>;
}
```

---

### 2. Local Storage Caching

```typescript
// Cache utility
export const cache = {
  set: (key: string, value: any, ttl = 5 * 60 * 1000) => {
    const item = {
      value,
      expiry: Date.now() + ttl,
    };
    localStorage.setItem(key, JSON.stringify(item));
  },

  get: (key: string) => {
    const itemStr = localStorage.getItem(key);
    if (!itemStr) return null;

    const item = JSON.parse(itemStr);
    if (Date.now() > item.expiry) {
      localStorage.removeItem(key);
      return null;
    }
    return item.value;
  },

  clear: (key: string) => {
    localStorage.removeItem(key);
  },
};

// Usage
const cachedData = cache.get('dashboard-stats');
if (cachedData) {
  setStats(cachedData);
} else {
  const { data } = await supabase.rpc('get_dashboard_stats');
  cache.set('dashboard-stats', data);
  setStats(data);
}
```

---

### 3. Service Worker (PWA)

```typescript
// public/sw.js
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open('v1').then((cache) => {
      return cache.addAll([
        '/',
        '/index.html',
        '/assets/index.css',
        '/assets/index.js',
      ]);
    })
  );
});

self.addEventListener('fetch', (event) => {
  event.respondWith(
    caches.match(event.request).then((response) => {
      return response || fetch(event.request);
    })
  );
});

// Register in main.tsx
if ('serviceWorker' in navigator) {
  navigator.serviceWorker.register('/sw.js');
}
```

---

## 📊 Performance Monitoring

### 1. Web Vitals

```typescript
// Install
npm install web-vitals

// src/lib/vitals.ts
import { getCLS, getFID, getFCP, getLCP, getTTFB } from 'web-vitals';

function sendToAnalytics({ name, delta, id }) {
  console.log(name, delta, id);
  
  // Send to your analytics
  supabase.rpc('record_performance_metric', {
    p_category: 'web-vitals',
    p_name: name,
    p_value: delta,
  });
}

// Measure
getCLS(sendToAnalytics);
getFID(sendToAnalytics);
getFCP(sendToAnalytics);
getLCP(sendToAnalytics);
getTTFB(sendToAnalytics);
```

### 2. Custom Performance Marks

```typescript
// Measure specific operations
performance.mark('data-fetch-start');

const data = await fetchData();

performance.mark('data-fetch-end');
performance.measure('data-fetch', 'data-fetch-start', 'data-fetch-end');

const measure = performance.getEntriesByName('data-fetch')[0];
console.log(`Data fetch took ${measure.duration}ms`);

// Record to database
supabase.rpc('record_performance_metric', {
  p_category: 'api',
  p_name: 'data-fetch',
  p_value: measure.duration,
});
```

---

## ✅ Optimization Checklist

### Database:
- [x] All tables have indexes
- [ ] Unused indexes removed
- [ ] Slow queries identified and optimized
- [x] Functions have STABLE attribute
- [ ] Materialized views for heavy analytics
- [x] Connection pooling configured

### Frontend:
- [x] Code splitting (lazy loading)
- [ ] Component memoization
- [ ] Virtual scrolling for large lists
- [ ] Image lazy loading
- [ ] Debounced search inputs
- [ ] Bundle size optimization
- [ ] Tree-shaking enabled

### Caching:
- [x] React Query configured
- [ ] LocalStorage caching for static data
- [ ] Service Worker for offline support
- [x] Stale-while-revalidate strategy

### Monitoring:
- [x] Performance metrics table
- [ ] Web Vitals tracking
- [ ] Custom performance marks
- [ ] Lighthouse CI integration

---

## 🎯 Performance Targets

### Load Time:
- **First Contentful Paint:** < 1.5s
- **Largest Contentful Paint:** < 2.5s
- **Time to Interactive:** < 3.5s
- **Cumulative Layout Shift:** < 0.1

### Runtime:
- **API Response Time:** < 500ms (p95)
- **Database Queries:** < 100ms (p95)
- **Frame Rate:** 60 FPS
- **Memory Usage:** < 100MB

### Bundle Size:
- **Main Bundle:** < 500KB
- **Vendor Bundle:** < 800KB
- **Total JS:** < 1.5MB (gzipped < 500KB)

---

**Performance optimization is an ongoing process. Monitor, measure, and iterate!** 🚀

