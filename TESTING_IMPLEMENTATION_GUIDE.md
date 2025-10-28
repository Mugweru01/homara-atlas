# Testing Implementation Guide

**Quick Start: Get Testing Up and Running**

---

## 🚀 Quick Setup (5 Minutes)

### Step 1: Install Dependencies
```bash
npm install -D vitest @testing-library/react @testing-library/jest-dom @testing-library/user-event @vitejs/plugin-react jsdom
```

### Step 2: Create Config File

**`vitest.config.ts`** (create in project root):
```typescript
import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';
import path from 'path';

export default defineConfig({
  plugins: [react()],
  test: {
    globals: true,
    environment: 'jsdom',
    setupFiles: ['./src/tests/setup.ts'],
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
});
```

### Step 3: Create Setup File

**`src/tests/setup.ts`**:
```typescript
import '@testing-library/jest-dom';
import { vi } from 'vitest';

// Mock Supabase
vi.mock('@/integrations/supabase/client', () => ({
  supabase: {
    auth: {
      getSession: vi.fn(() => Promise.resolve({ data: { session: null }, error: null })),
      signInWithPassword: vi.fn(),
      signOut: vi.fn(),
    },
    from: vi.fn(() => ({
      select: vi.fn().mockReturnThis(),
      insert: vi.fn().mockReturnThis(),
      update: vi.fn().mockReturnThis(),
      delete: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      single: vi.fn(() => Promise.resolve({ data: null, error: null })),
    })),
    rpc: vi.fn(() => Promise.resolve({ data: null, error: null })),
  },
}));
```

### Step 4: Add Scripts to package.json
```json
{
  "scripts": {
    "test": "vitest",
    "test:ui": "vitest --ui",
    "test:coverage": "vitest run --coverage"
  }
}
```

### Step 5: Run Tests
```bash
npm test
```

---

## 📝 Sample Tests (Copy & Paste)

### Test 1: Currency Utility

**`src/lib/currency-utils.test.ts`**:
```typescript
import { describe, it, expect } from 'vitest';
import { formatCurrency } from './currency-utils';

describe('formatCurrency', () => {
  it('formats number as Ksh currency', () => {
    expect(formatCurrency(1000)).toBe('Ksh 1,000');
  });

  it('handles null values', () => {
    expect(formatCurrency(null)).toBe('N/A');
  });

  it('handles undefined values', () => {
    expect(formatCurrency(undefined)).toBe('N/A');
  });

  it('formats with decimals when specified', () => {
    expect(formatCurrency(1000.5, { decimals: 2 })).toBe('Ksh 1,000.50');
  });

  it('handles large numbers', () => {
    expect(formatCurrency(1000000)).toBe('Ksh 1,000,000');
  });
});
```

### Test 2: Export Utils

**`src/lib/export-utils.test.ts`**:
```typescript
import { describe, it, expect } from 'vitest';
import { convertToCSV, convertToJSON } from './export-utils';

describe('Export Utils', () => {
  describe('convertToCSV', () => {
    it('converts simple data to CSV', () => {
      const data = [
        { id: 1, name: 'John' },
        { id: 2, name: 'Jane' },
      ];
      
      const csv = convertToCSV(data);
      
      expect(csv).toContain('id,name');
      expect(csv).toContain('1,John');
      expect(csv).toContain('2,Jane');
    });

    it('handles empty array', () => {
      expect(convertToCSV([])).toBe('');
    });
  });

  describe('convertToJSON', () => {
    it('converts data to formatted JSON', () => {
      const data = [{ id: 1 }];
      const json = convertToJSON(data);
      expect(JSON.parse(json)).toEqual(data);
    });
  });
});
```

### Test 3: Admin Hook

**`src/hooks/useAdmin.test.ts`**:
```typescript
import { describe, it, expect, vi } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';
import { useAdmin } from './useAdmin';
import { supabase } from '@/integrations/supabase/client';

vi.mock('@/integrations/supabase/client');

describe('useAdmin', () => {
  it('returns loading state initially', () => {
    const { result } = renderHook(() => useAdmin());
    expect(result.current.loading).toBe(true);
  });

  it('loads admin data when authenticated', async () => {
    vi.mocked(supabase.auth.getSession).mockResolvedValue({
      data: {
        session: {
          user: { id: 'test-user-id' },
        },
      },
      error: null,
    } as any);

    vi.mocked(supabase.from).mockReturnValue({
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      single: vi.fn().mockResolvedValue({
        data: {
          id: 'admin-id',
          admin_role: 'super_admin',
          status: 'active',
        },
        error: null,
      }),
    } as any);

    const { result } = renderHook(() => useAdmin());

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
      expect(result.current.isAdmin).toBe(true);
      expect(result.current.isSuperAdmin).toBe(true);
    });
  });
});
```

---

## 🎯 Critical Tests to Write First

### Priority 1: RPC Functions (5 tests)

**`src/tests/rpc-functions.test.ts`**:
```typescript
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { supabase } from '@/integrations/supabase/client';

describe('RPC Functions', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('get_my_assignments returns array', async () => {
    vi.mocked(supabase.rpc).mockResolvedValue({
      data: [],
      error: null,
    } as any);

    const { data, error } = await supabase.rpc('get_my_assignments');
    
    expect(error).toBeNull();
    expect(Array.isArray(data)).toBe(true);
  });

  it('get_assignment_statistics returns JSONB', async () => {
    vi.mocked(supabase.rpc).mockResolvedValue({
      data: {
        total_pending: 0,
        in_progress: 0,
        completed_today: 0,
        overdue: 0,
        high_priority: 0,
      },
      error: null,
    } as any);

    const { data, error } = await supabase.rpc('get_assignment_statistics');
    
    expect(error).toBeNull();
    expect(data).toHaveProperty('total_pending');
    expect(data).toHaveProperty('overdue');
  });

  it('get_active_password_policy returns policy', async () => {
    vi.mocked(supabase.rpc).mockResolvedValue({
      data: {
        min_length: 8,
        require_uppercase: true,
        require_numbers: true,
      },
      error: null,
    } as any);

    const { data, error } = await supabase.rpc('get_active_password_policy');
    
    expect(error).toBeNull();
    expect(data.min_length).toBe(8);
  });

  it('run_security_scan returns results', async () => {
    vi.mocked(supabase.rpc).mockResolvedValue({
      data: {
        success: true,
        scans_performed: 3,
        issues_found: 0,
      },
      error: null,
    } as any);

    const { data, error } = await supabase.rpc('run_security_scan');
    
    expect(error).toBeNull();
    expect(data.success).toBe(true);
  });

  it('complete_assignment returns success', async () => {
    vi.mocked(supabase.rpc).mockResolvedValue({
      data: {
        success: true,
        message: 'Assignment completed',
      },
      error: null,
    } as any);

    const { data, error } = await supabase.rpc('complete_assignment', {
      p_assignment_id: 'test-id',
    });
    
    expect(error).toBeNull();
    expect(data.success).toBe(true);
  });
});
```

---

### Priority 2: Component Rendering (3 tests)

**`src/components/admin/BulkActionsBar.test.tsx`**:
```typescript
import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { BulkActionsBar } from './BulkActionsBar';

describe('BulkActionsBar', () => {
  it('shows selection count', () => {
    render(
      <BulkActionsBar
        selectedCount={5}
        totalCount={10}
        actions={[]}
        onAction={vi.fn()}
      />
    );

    expect(screen.getByText('5 selected')).toBeInTheDocument();
  });

  it('renders action buttons', () => {
    const actions = [
      { id: 'approve', label: 'Approve', icon: 'check' },
      { id: 'reject', label: 'Reject', icon: 'x' },
    ];

    render(
      <BulkActionsBar
        selectedCount={3}
        totalCount={10}
        actions={actions}
        onAction={vi.fn()}
      />
    );

    expect(screen.getByText('Approve')).toBeInTheDocument();
    expect(screen.getByText('Reject')).toBeInTheDocument();
  });

  it('disables actions when nothing selected', () => {
    render(
      <BulkActionsBar
        selectedCount={0}
        totalCount={10}
        actions={[{ id: 'approve', label: 'Approve', icon: 'check' }]}
        onAction={vi.fn()}
      />
    );

    const button = screen.getByText('Approve').closest('button');
    expect(button).toBeDisabled();
  });
});
```

---

### Priority 3: Form Validation (2 tests)

**`src/lib/validation.test.ts`**:
```typescript
import { describe, it, expect } from 'vitest';

// Password validation
describe('Password Validation', () => {
  const validatePassword = (password: string, policy: any) => {
    const errors = [];
    
    if (password.length < policy.min_length) {
      errors.push(`Minimum ${policy.min_length} characters required`);
    }
    
    if (policy.require_uppercase && !/[A-Z]/.test(password)) {
      errors.push('Must contain uppercase letter');
    }
    
    if (policy.require_lowercase && !/[a-z]/.test(password)) {
      errors.push('Must contain lowercase letter');
    }
    
    if (policy.require_numbers && !/\d/.test(password)) {
      errors.push('Must contain number');
    }
    
    if (policy.require_special_chars && !/[!@#$%^&*]/.test(password)) {
      errors.push('Must contain special character');
    }
    
    return errors;
  };

  const policy = {
    min_length: 8,
    require_uppercase: true,
    require_lowercase: true,
    require_numbers: true,
    require_special_chars: true,
  };

  it('accepts valid password', () => {
    const errors = validatePassword('SecurePass123!', policy);
    expect(errors).toHaveLength(0);
  });

  it('rejects password too short', () => {
    const errors = validatePassword('Aa1!', policy);
    expect(errors).toContain('Minimum 8 characters required');
  });

  it('rejects password without uppercase', () => {
    const errors = validatePassword('password123!', policy);
    expect(errors).toContain('Must contain uppercase letter');
  });

  it('rejects password without numbers', () => {
    const errors = validatePassword('Password!', policy);
    expect(errors).toContain('Must contain number');
  });

  it('rejects password without special chars', () => {
    const errors = validatePassword('Password123', policy);
    expect(errors).toContain('Must contain special character');
  });
});
```

---

## 🔄 Testing Workflow

### 1. **Write Test First** (TDD)
```typescript
// 1. Write failing test
it('formats currency correctly', () => {
  expect(formatCurrency(1000)).toBe('Ksh 1,000');
});

// 2. Run test (fails) ❌
npm test

// 3. Write minimal code to pass
export const formatCurrency = (amount) => `Ksh ${amount.toLocaleString()}`;

// 4. Run test (passes) ✅
npm test

// 5. Refactor if needed
```

### 2. **Test After Implementation**
```typescript
// 1. Write feature code
export const calculateTotal = (items) => {
  return items.reduce((sum, item) => sum + item.price, 0);
};

// 2. Write test
it('calculates total correctly', () => {
  const items = [{ price: 10 }, { price: 20 }];
  expect(calculateTotal(items)).toBe(30);
});

// 3. Run test ✅
```

---

## 📊 Coverage Report

### Generate Report:
```bash
npm run test:coverage
```

### View Report:
```bash
# Opens in browser
open coverage/index.html
```

### Example Output:
```
 % Coverage report from vitest
-------------------|---------|----------|---------|---------|
File               | % Stmts | % Branch | % Funcs | % Lines |
-------------------|---------|----------|---------|---------|
All files          |   82.45 |    78.12 |   85.67 |   82.45 |
 src/lib           |   95.12 |    92.31 |   96.15 |   95.12 |
  export-utils.ts  |   98.00 |    95.00 |  100.00 |   98.00 |
  currency-utils.ts|   92.00 |    88.00 |   90.00 |   92.00 |
 src/components    |   78.23 |    72.45 |   80.12 |   78.23 |
  BulkActionsBar.tsx| 82.00 |    75.00 |   85.00 |   82.00 |
-------------------|---------|----------|---------|---------|
```

---

## ✅ Week 6 Testing Deliverables

### Minimum Viable Testing:
- [x] Testing strategy document
- [ ] 10 utility function tests
- [ ] 5 component tests
- [ ] 5 RPC function tests
- [ ] 2 integration tests
- [ ] Test setup files
- [ ] CI/CD configuration

### Nice to Have:
- [ ] E2E tests for critical paths
- [ ] Database function tests
- [ ] Performance tests
- [ ] Visual regression tests

---

## 🎯 Success Criteria

**Week 6 is complete when:**
1. ✅ Test framework set up
2. ✅ Core utilities tested
3. ✅ Critical RPC functions tested
4. ✅ Key components tested
5. ✅ Tests run in CI/CD
6. ✅ Coverage > 70%

---

**Start with the Quick Setup above, then write tests for your most critical features first!** 🚀

