import { ReactNode } from 'react';
import { Navigate } from 'react-router-dom';
import { useAdmin } from '@/hooks/useAdmin';

interface ProtectedRouteProps {
  children: ReactNode;
  requiredRole?: 'super_admin' | 'senior_admin' | 'junior_admin' | 'support_admin';
  requireSeniorOrAbove?: boolean;
  requireSuperAdmin?: boolean;
}

export function ProtectedRoute({
  children,
  requiredRole,
  requireSeniorOrAbove,
  requireSuperAdmin
}: ProtectedRouteProps) {
  const { isAdmin, isSuperAdmin, isSeniorAdmin, adminInfo, loading } = useAdmin();

  // Show loading while checking auth
  if (loading) {
    return (
      <div className="flex h-screen items-center justify-center">
        <div className="text-center">
          <div className="h-12 w-12 animate-spin rounded-full border-4 border-primary/20 border-t-primary mx-auto mb-4"></div>
          <p className="text-sm text-muted-foreground">Loading...</p>
        </div>
      </div>
    );
  }

  // Must be an admin
  if (!isAdmin) {
    return <Navigate to="/admin/login" replace />;
  }

  // Check specific role requirements
  if (requireSuperAdmin && !isSuperAdmin) {
    return <Navigate to="/admin" replace />;
  }

  if (requireSeniorOrAbove && !isSeniorAdmin && !isSuperAdmin) {
    return <Navigate to="/admin" replace />;
  }

  if (requiredRole) {
    if (requiredRole === 'super_admin' && !isSuperAdmin) {
      return <Navigate to="/admin" replace />;
    }
    if (requiredRole === 'senior_admin' && !isSeniorAdmin && !isSuperAdmin) {
      return <Navigate to="/admin" replace />;
    }
    if (adminInfo?.admin_role !== requiredRole && !isSuperAdmin) {
      return <Navigate to="/admin" replace />;
    }
  }

  return <>{children}</>;
}
