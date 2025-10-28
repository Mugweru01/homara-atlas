# Testing Strategy & Framework

**Week 6: Testing & Quality Assurance**  
**Created: November 2025**

---

## 📋 Overview

Comprehensive testing strategy for the Homara Gatekeeper Admin Panel, covering unit tests, integration tests, E2E tests, and performance testing.

---

## 🎯 Testing Objectives

### 1. **Quality Assurance**
- Ensure all features work as expected
- Catch bugs before production
- Prevent regressions

### 2. **Code Confidence**
- Safe refactoring
- Confident deployments
- Team collaboration

### 3. **Documentation**
- Tests serve as living documentation
- Show how features should work
- Onboard new developers

---

## 🧪 Testing Pyramid

```
        /\
       /E2E\      ← Few, slow, expensive (5%)
      /------\
     /Integration\ ← Moderate (30%)
    /-----------\
   /Unit Tests   \ ← Many, fast, cheap (65%)
  /--------------\
```

### Distribution:
- **65% Unit Tests** - Test individual functions and components
- **30% Integration Tests** - Test feature workflows
- **5% E2E Tests** - Test critical user journeys

---

## 🛠️ Testing Stack

### Frontend Testing
```json
{
  "dependencies": {
    "vitest": "^1.0.0",
    "react-testing-library": "^14.0.0",
    "@testing-library/jest-dom": "^6.0.0",
    "@testing-library/user-event": "^14.0.0",
    "msw": "^2.0.0",
    "playwright": "^1.40.0"
  }
}
```

### Database Testing
```json
{
  "dependencies": {
    "pgTAP": "^1.2.0",
    "supabase-test-helpers": "^0.0.5"
  }
}
```

---

## 📁 Test File Structure

```
homara-gatekeeper/
├── src/
│   ├── components/
│   │   └── admin/
│   │       ├── NotificationCenter.tsx
│   │       └── NotificationCenter.test.tsx  ← Component test
│   ├── pages/
│   │   └── admin/
│   │       ├── MyTasks.tsx
│   │       └── MyTasks.test.tsx  ← Page test
│   └── lib/
│       ├── export-utils.ts
│       └── export-utils.test.ts  ← Utility test
├── tests/
│   ├── integration/
│   │   ├── workflows.test.ts
│   │   ├── security.test.ts
│   │   └── reports.test.ts
│   ├── e2e/
│   │   ├── admin-login.spec.ts
│   │   ├── user-management.spec.ts
│   │   └── verification-flow.spec.ts
│   └── database/
│       ├── functions.test.sql
│       ├── triggers.test.sql
│       └── rls.test.sql
└── vitest.config.ts
```

---

## 🔧 Test Configuration

### `vitest.config.ts`
```typescript
import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';
import path from 'path';

export default defineConfig({
  plugins: [react()],
  test: {
    globals: true,
    environment: 'jsdom',
    setupFiles: ['./tests/setup.ts'],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json', 'html'],
      exclude: [
        'node_modules/',
        'tests/',
        '**/*.d.ts',
        '**/*.config.*',
        '**/mockData',
      ],
    },
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
});
```

### `tests/setup.ts`
```typescript
import '@testing-library/jest-dom';
import { cleanup } from '@testing-library/react';
import { afterEach, vi } from 'vitest';
import { server } from './mocks/server';

// Start MSW server
beforeAll(() => server.listen());
afterEach(() => {
  cleanup();
  server.resetHandlers();
});
afterAll(() => server.close());

// Mock Supabase client
vi.mock('@/integrations/supabase/client', () => ({
  supabase: {
    auth: {
      getSession: vi.fn(),
      signInWithPassword: vi.fn(),
      signOut: vi.fn(),
    },
    from: vi.fn(() => ({
      select: vi.fn().mockReturnThis(),
      insert: vi.fn().mockReturnThis(),
      update: vi.fn().mockReturnThis(),
      delete: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      single: vi.fn(),
    })),
    rpc: vi.fn(),
  },
}));
```

---

## 📝 Unit Testing Examples

### 1. Utility Function Test

**`src/lib/export-utils.test.ts`**
```typescript
import { describe, it, expect } from 'vitest';
import { convertToCSV, convertToJSON, downloadFile } from './export-utils';

describe('Export Utils', () => {
  describe('convertToCSV', () => {
    it('converts array of objects to CSV string', () => {
      const data = [
        { id: 1, name: 'John', email: 'john@example.com' },
        { id: 2, name: 'Jane', email: 'jane@example.com' },
      ];
      
      const csv = convertToCSV(data);
      
      expect(csv).toContain('id,name,email');
      expect(csv).toContain('1,John,john@example.com');
      expect(csv).toContain('2,Jane,jane@example.com');
    });

    it('handles empty array', () => {
      const csv = convertToCSV([]);
      expect(csv).toBe('');
    });

    it('handles nested objects', () => {
      const data = [{ id: 1, user: { name: 'John' } }];
      const csv = convertToCSV(data);
      expect(csv).toContain('John');
    });
  });

  describe('convertToJSON', () => {
    it('converts and formats data as JSON', () => {
      const data = [{ id: 1, name: 'Test' }];
      const json = convertToJSON(data);
      
      expect(JSON.parse(json)).toEqual(data);
    });
  });

  describe('downloadFile', () => {
    it('triggers file download', () => {
      const createElementSpy = vi.spyOn(document, 'createElement');
      const clickSpy = vi.fn();
      
      downloadFile('test data', 'test.txt', 'text/plain');
      
      expect(createElementSpy).toHaveBeenCalledWith('a');
    });
  });
});
```

---

### 2. Component Test

**`src/components/admin/NotificationCenter.test.tsx`**
```typescript
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { NotificationCenter } from './NotificationCenter';
import { supabase } from '@/integrations/supabase/client';

vi.mock('@/integrations/supabase/client');

describe('NotificationCenter', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders notification bell with count', async () => {
    vi.mocked(supabase.from).mockReturnValue({
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      limit: vi.fn().mockResolvedValue({
        data: [
          { id: '1', title: 'New User', is_read: false },
          { id: '2', title: 'New Verification', is_read: false },
        ],
        error: null,
      }),
    } as any);

    render(<NotificationCenter />);

    await waitFor(() => {
      expect(screen.getByText('2')).toBeInTheDocument();
    });
  });

  it('marks notification as read when clicked', async () => {
    const user = userEvent.setup();
    const updateMock = vi.fn().mockResolvedValue({ error: null });
    
    vi.mocked(supabase.from).mockReturnValue({
      update: updateMock,
      eq: vi.fn().mockReturnThis(),
    } as any);

    render(<NotificationCenter />);
    
    const notification = screen.getByText('New User');
    await user.click(notification);

    expect(updateMock).toHaveBeenCalledWith({ is_read: true });
  });

  it('shows empty state when no notifications', async () => {
    vi.mocked(supabase.from).mockReturnValue({
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      limit: vi.fn().mockResolvedValue({
        data: [],
        error: null,
      }),
    } as any);

    render(<NotificationCenter />);

    await waitFor(() => {
      expect(screen.getByText('No new notifications')).toBeInTheDocument();
    });
  });
});
```

---

### 3. Page Test

**`src/pages/admin/MyTasks.test.tsx`**
```typescript
import { describe, it, expect, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import { BrowserRouter } from 'react-router-dom';
import MyTasks from './MyTasks';
import { supabase } from '@/integrations/supabase/client';

const renderWithRouter = (component: React.ReactElement) => {
  return render(<BrowserRouter>{component}</BrowserRouter>);
};

describe('MyTasks Page', () => {
  it('displays statistics correctly', async () => {
    vi.mocked(supabase.rpc).mockImplementation((fn) => {
      if (fn === 'get_assignment_statistics') {
        return Promise.resolve({
          data: {
            total_pending: 5,
            in_progress: 2,
            completed_today: 3,
            overdue: 1,
            high_priority: 2,
          },
          error: null,
        }) as any;
      }
      return Promise.resolve({ data: [], error: null }) as any;
    });

    renderWithRouter(<MyTasks />);

    await waitFor(() => {
      expect(screen.getByText('5')).toBeInTheDocument(); // pending
      expect(screen.getByText('2')).toBeInTheDocument(); // in progress
    });
  });

  it('filters tasks by overdue', async () => {
    // Test filter functionality
  });

  it('completes task successfully', async () => {
    // Test task completion
  });
});
```

---

## 🔗 Integration Testing Examples

### Workflow Integration Test

**`tests/integration/workflows.test.ts`**
```typescript
import { describe, it, expect } from 'vitest';
import { supabase } from '@/integrations/supabase/client';

describe('Automated Workflows', () => {
  it('auto-assigns verification to admin with least workload', async () => {
    // Create test verification
    const { data: verification } = await supabase
      .from('landlord_verifications')
      .insert({
        landlord_id: 'test-landlord-id',
        status: 'pending',
      })
      .select()
      .single();

    // Wait for trigger to execute
    await new Promise(resolve => setTimeout(resolve, 1000));

    // Check assignment created
    const { data: assignment } = await supabase
      .from('task_assignments')
      .select('*')
      .eq('entity_id', verification.id)
      .single();

    expect(assignment).toBeTruthy();
    expect(assignment.assignment_reason).toBe('workflow');
    expect(assignment.status).toBe('pending');
  });

  it('escalates overdue tasks automatically', async () => {
    // Test escalation logic
  });
});
```

---

## 🎭 E2E Testing Examples

### Playwright Configuration

**`playwright.config.ts`**
```typescript
import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
  testDir: './tests/e2e',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: process.env.CI ? 1 : undefined,
  reporter: 'html',
  use: {
    baseURL: 'http://localhost:8080',
    trace: 'on-first-retry',
  },
  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
  ],
  webServer: {
    command: 'npm run dev',
    url: 'http://localhost:8080',
    reuseExistingServer: !process.env.CI,
  },
});
```

### E2E Test Example

**`tests/e2e/admin-login.spec.ts`**
```typescript
import { test, expect } from '@playwright/test';

test.describe('Admin Login', () => {
  test('successful login redirects to dashboard', async ({ page }) => {
    await page.goto('/admin/login');

    await page.fill('input[name="email"]', 'admin@example.com');
    await page.fill('input[name="password"]', 'SecurePassword123!');
    await page.click('button[type="submit"]');

    await expect(page).toHaveURL('/admin');
    await expect(page.locator('h1')).toContainText('Dashboard');
  });

  test('failed login shows error message', async ({ page }) => {
    await page.goto('/admin/login');

    await page.fill('input[name="email"]', 'admin@example.com');
    await page.fill('input[name="password"]', 'wrong-password');
    await page.click('button[type="submit"]');

    await expect(page.locator('.error-message')).toBeVisible();
  });

  test('enforces password policy', async ({ page }) => {
    await page.goto('/admin/login');

    // Test weak password
    await page.fill('input[name="password"]', '123');
    
    await expect(page.locator('.password-error')).toContainText(
      'Password must be at least 8 characters'
    );
  });
});
```

**`tests/e2e/verification-flow.spec.ts`**
```typescript
import { test, expect } from '@playwright/test';

test.describe('Verification Workflow', () => {
  test.beforeEach(async ({ page }) => {
    // Login as admin
    await page.goto('/admin/login');
    await page.fill('input[name="email"]', 'admin@example.com');
    await page.fill('input[name="password"]', 'SecurePassword123!');
    await page.click('button[type="submit"]');
  });

  test('admin can approve verification', async ({ page }) => {
    await page.goto('/admin/verifications');

    // Find first pending verification
    const firstVerification = page.locator('.verification-card').first();
    await firstVerification.click();

    // Approve it
    await page.click('button:has-text("Approve")');
    await page.fill('textarea[name="notes"]', 'Documents verified');
    await page.click('button:has-text("Confirm Approval")');

    // Check success message
    await expect(page.locator('.toast-success')).toBeVisible();
    await expect(page.locator('.toast-success')).toContainText('approved');
  });

  test('task appears in My Tasks after verification submission', async ({ page }) => {
    // Submit new verification (via API or UI)
    
    // Navigate to My Tasks
    await page.goto('/admin/my-tasks');

    // Verify task appears
    await expect(page.locator('.task-card')).toBeVisible();
    await expect(page.locator('.task-card')).toContainText('Verification');
  });
});
```

---

## 🗄️ Database Testing

### pgTAP Tests

**`tests/database/functions.test.sql`**
```sql
-- Test get_my_assignments function
BEGIN;
SELECT plan(5);

-- Test 1: Function exists
SELECT has_function('get_my_assignments');

-- Test 2: Returns empty for non-admin user
SET SESSION AUTHORIZATION 'anon';
SELECT is_empty(
  'SELECT * FROM get_my_assignments()',
  'Non-admin user gets no assignments'
);

-- Test 3: Admin sees only their assignments
-- (Create test admin and assignments)

-- Test 4: Results are sorted by priority
-- (Verify sort order)

-- Test 5: Only pending/in_progress tasks returned
-- (Verify status filtering)

SELECT * FROM finish();
ROLLBACK;
```

**`tests/database/triggers.test.sql`**
```sql
-- Test auto_assign_verification trigger
BEGIN;
SELECT plan(3);

-- Test 1: Trigger exists
SELECT has_trigger('landlord_verifications', 'trigger_auto_assign_verification');

-- Test 2: Assignment created on verification insert
INSERT INTO landlord_verifications (landlord_id, status)
VALUES ('test-id', 'pending')
RETURNING id INTO v_verification_id;

SELECT isnt_empty(
  'SELECT * FROM task_assignments WHERE entity_id = ''' || v_verification_id || '''',
  'Assignment created for new verification'
);

-- Test 3: Assignment not created for non-pending status
INSERT INTO landlord_verifications (landlord_id, status)
VALUES ('test-id-2', 'approved');

SELECT is_empty(
  'SELECT * FROM task_assignments WHERE entity_id = (SELECT id FROM landlord_verifications WHERE landlord_id = ''test-id-2'')',
  'No assignment for non-pending verification'
);

SELECT * FROM finish();
ROLLBACK;
```

---

## 📊 Test Coverage Goals

### Minimum Coverage Targets:
- **Overall: 80%+**
- **Critical Paths: 95%+**
- **Utilities: 90%+**
- **Components: 75%+**

### Critical Paths:
1. ✅ Admin login/auth
2. ✅ User verification approval
3. ✅ Listing management
4. ✅ Task assignment workflow
5. ✅ Security policy enforcement
6. ✅ Report generation
7. ✅ Bulk operations

---

## 🚀 Running Tests

### Package.json Scripts:
```json
{
  "scripts": {
    "test": "vitest",
    "test:ui": "vitest --ui",
    "test:coverage": "vitest run --coverage",
    "test:e2e": "playwright test",
    "test:e2e:ui": "playwright test --ui",
    "test:db": "pg_prove tests/database/*.sql"
  }
}
```

### Commands:
```bash
# Run all unit tests
npm test

# Run with UI
npm run test:ui

# Run E2E tests
npm run test:e2e

# Generate coverage report
npm run test:coverage

# Run database tests
npm run test:db

# Run specific test file
npm test -- MyTasks.test.tsx

# Run in watch mode
npm test -- --watch
```

---

## ✅ Testing Checklist

### Setup
- [ ] Install testing dependencies
- [ ] Configure Vitest
- [ ] Configure Playwright
- [ ] Setup MSW for API mocking
- [ ] Create test utilities
- [ ] Setup CI/CD integration

### Unit Tests
- [ ] Utility functions (export, currency, etc.)
- [ ] React components
- [ ] Custom hooks
- [ ] Helper functions
- [ ] Form validation

### Integration Tests
- [ ] Workflow automation
- [ ] Security features
- [ ] Report generation
- [ ] Bulk operations
- [ ] Export functionality

### E2E Tests
- [ ] Admin login flow
- [ ] User management
- [ ] Verification workflow
- [ ] Listing management
- [ ] Task completion
- [ ] Security settings

### Database Tests
- [ ] All RPC functions
- [ ] All triggers
- [ ] RLS policies
- [ ] Data integrity

---

## 🔄 CI/CD Integration

### GitHub Actions Example:
```yaml
name: Tests

on: [push, pull_request]

jobs:
  test:
    runs-on: ubuntu-latest
    
    steps:
      - uses: actions/checkout@v3
      
      - name: Setup Node
        uses: actions/setup-node@v3
        with:
          node-version: '18'
          
      - name: Install dependencies
        run: npm ci
        
      - name: Run unit tests
        run: npm run test:coverage
        
      - name: Upload coverage
        uses: codecov/codecov-action@v3
        
      - name: Run E2E tests
        run: npm run test:e2e
        
      - name: Upload test results
        uses: actions/upload-artifact@v3
        with:
          name: test-results
          path: test-results/
```

---

## 📈 Testing Best Practices

### 1. **AAA Pattern**
```typescript
// Arrange
const data = [{ id: 1, name: 'Test' }];

// Act
const result = processData(data);

// Assert
expect(result).toEqual(expected);
```

### 2. **Test Naming**
```typescript
// ❌ Bad
it('works', () => {});

// ✅ Good
it('returns empty array when no data provided', () => {});
```

### 3. **One Assertion Per Test** (when practical)
```typescript
// ❌ Bad
it('does everything', () => {
  expect(a).toBe(1);
  expect(b).toBe(2);
  expect(c).toBe(3);
});

// ✅ Good
it('sets value a to 1', () => {
  expect(a).toBe(1);
});

it('sets value b to 2', () => {
  expect(b).toBe(2);
});
```

### 4. **Avoid Test Interdependence**
```typescript
// ❌ Bad - tests depend on each other
let globalState = {};

it('sets state', () => {
  globalState.value = 1;
});

it('uses state', () => {
  expect(globalState.value).toBe(1); // Depends on previous test
});

// ✅ Good - independent tests
it('sets state', () => {
  const state = { value: 1 };
  expect(state.value).toBe(1);
});

it('updates state', () => {
  const state = { value: 1 };
  state.value = 2;
  expect(state.value).toBe(2);
});
```

---

## 🎯 Priority Testing Areas

### High Priority (Week 6):
1. ✅ Authentication & Authorization
2. ✅ RPC function responses
3. ✅ Workflow automation
4. ✅ Security enforcement
5. ✅ Data export/import

### Medium Priority (Week 7):
1. ⏳ UI component rendering
2. ⏳ Form validation
3. ⏳ Navigation flows
4. ⏳ Error handling

### Low Priority (Week 8):
1. ⏳ Edge cases
2. ⏳ Performance tests
3. ⏳ Accessibility tests
4. ⏳ Visual regression

---

**Testing is complete when you have confidence to deploy! 🚀**

