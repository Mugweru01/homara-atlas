import { Outlet, Link, useLocation, Navigate } from 'react-router-dom';
import { useAdmin } from '@/hooks/useAdmin';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { ThemeToggle } from '@/components/ThemeToggle';
import {
  LayoutDashboard,
  Users,
  Home,
  ShieldCheck,
  UserCog,
  ClipboardList,
  Settings,
  LogOut,
  Menu,
} from 'lucide-react';
import { useState } from 'react';
import { cn } from '@/lib/utils';

const navigation = [
  { name: 'Dashboard', href: '/admin', icon: LayoutDashboard, roles: ['all'] },
  { name: 'Users', href: '/admin/users', icon: Users, roles: ['all'] },
  { name: 'Listings', href: '/admin/listings', icon: Home, roles: ['all'] },
  { name: 'Verifications', href: '/admin/verifications', icon: ShieldCheck, roles: ['all'] },
  { name: 'Admins', href: '/admin/admins', icon: UserCog, roles: ['super_admin'] },
  { name: 'Audit Logs', href: '/admin/audit-logs', icon: ClipboardList, roles: ['super_admin', 'senior_admin'] },
  { name: 'Settings', href: '/admin/settings', icon: Settings, roles: ['super_admin'] },
];

export function AdminLayout() {
  const { isAdmin, isSuperAdmin, isSeniorAdmin, loading, signOut, adminInfo } = useAdmin();
  const location = useLocation();
  const [sidebarOpen, setSidebarOpen] = useState(true);

  if (loading) {
    return (
      <div className="flex h-screen items-center justify-center">
        <div className="text-center">
          <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent mx-auto mb-4" />
          <p className="text-muted-foreground">Loading...</p>
        </div>
      </div>
    );
  }

  if (!isAdmin) {
    return <Navigate to="/admin/login" replace />;
  }

  const canAccessRoute = (roles: string[]) => {
    if (roles.includes('all')) return true;
    if (roles.includes('super_admin') && isSuperAdmin) return true;
    if (roles.includes('senior_admin') && isSeniorAdmin) return true;
    return false;
  };

  const filteredNavigation = navigation.filter(item => canAccessRoute(item.roles));

  return (
    <div className="flex h-screen overflow-hidden bg-background">
      {/* Sidebar */}
      <aside
        className={cn(
          'fixed inset-y-0 left-0 z-50 flex flex-col border-r bg-card transition-all duration-300',
          sidebarOpen ? 'w-64' : 'w-20'
        )}
      >
        <div className="flex h-16 items-center gap-3 border-b px-4">
          <img src="/placeholder.svg" alt="Homara Logo" className="h-8 w-8" />
          {sidebarOpen && <span className="font-semibold text-lg">Homara Admin</span>}
        </div>

        <ScrollArea className="flex-1 px-3 py-4">
          <nav className="flex flex-col gap-1">
            {filteredNavigation.map((item) => {
              const Icon = item.icon;
              const isActive = location.pathname === item.href || 
                (item.href !== '/admin' && location.pathname.startsWith(item.href));
              
              return (
                <Link
                  key={item.href}
                  to={item.href}
                  className={cn(
                    'flex items-center gap-3 rounded-lg px-3 py-2 text-sm transition-all hover:bg-accent',
                    isActive
                      ? 'bg-primary text-primary-foreground hover:bg-primary/90'
                      : 'text-muted-foreground hover:text-foreground'
                  )}
                >
                  <Icon className="h-5 w-5 shrink-0" />
                  {sidebarOpen && <span>{item.name}</span>}
                </Link>
              );
            })}
          </nav>
        </ScrollArea>

        <div className="border-t p-4">
          <div className={cn('flex items-center gap-3', !sidebarOpen && 'justify-center')}>
            {sidebarOpen && (
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium truncate">{adminInfo?.admin_role}</p>
                <p className="text-xs text-muted-foreground truncate">
                  {adminInfo?.status}
                </p>
              </div>
            )}
            <Button
              variant="ghost"
              size="icon"
              onClick={() => signOut()}
              title="Sign out"
            >
              <LogOut className="h-5 w-5" />
            </Button>
          </div>
        </div>
      </aside>

      {/* Main Content */}
      <div className={cn('flex flex-1 flex-col', sidebarOpen ? 'ml-64' : 'ml-20')}>
        <header className="flex h-16 items-center gap-4 border-b bg-card px-6">
          <Button
            variant="ghost"
            size="icon"
            onClick={() => setSidebarOpen(!sidebarOpen)}
          >
            <Menu className="h-5 w-5" />
          </Button>
          <div className="flex-1" />
          <ThemeToggle />
        </header>

        <main className="flex-1 overflow-auto p-6">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
