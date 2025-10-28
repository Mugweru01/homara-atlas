import { Outlet, Link, useLocation, Navigate } from 'react-router-dom';
import { useAdmin } from '@/hooks/useAdmin';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { ThemeToggle } from '@/components/ThemeToggle';
import { NotificationCenter } from '@/components/admin/NotificationCenter';
import {
  Sheet,
  SheetContent,
  SheetTrigger,
} from '@/components/ui/sheet';
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
  Search,
  X,
  Database,
  Activity,
  Shield,
  FileBarChart,
  BarChart3,
  FileSpreadsheet,
  Sliders,
  ListTodo,
  ShieldAlert,
  BookOpen,
} from 'lucide-react';
import { useState, useEffect } from 'react';
import { cn } from '@/lib/utils';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';

const navigation = [
  { name: 'Dashboard', href: '/admin', icon: LayoutDashboard, roles: ['all'] },
  { name: 'My Tasks', href: '/admin/my-tasks', icon: ListTodo, roles: ['all'], badge: 0 },
  { name: 'Customize Dashboard', href: '/admin/dashboard-settings', icon: Sliders, roles: ['all'] },
  { name: 'Users', href: '/admin/users', icon: Users, roles: ['all'] },
  { name: 'Listings', href: '/admin/listings', icon: Home, roles: ['all'] },
  { name: 'Verifications', href: '/admin/verifications', icon: ShieldCheck, roles: ['all'], badge: 0 },
  { name: 'Analytics', href: '/admin/analytics', icon: BarChart3, roles: ['all'] },
  { name: 'Report Builder', href: '/admin/report-builder', icon: FileSpreadsheet, roles: ['all'] },
  { name: 'Reports', href: '/admin/reports', icon: FileBarChart, roles: ['all'] },
  { name: 'Monitoring', href: '/admin/monitoring', icon: Activity, roles: ['super_admin', 'senior_admin'] },
  { name: 'Performance', href: '/admin/performance', icon: Activity, roles: ['super_admin', 'senior_admin'] },
  { name: 'Security', href: '/admin/security', icon: Shield, roles: ['all'] },
  { name: 'Security Center', href: '/admin/security-center', icon: ShieldAlert, roles: ['super_admin', 'senior_admin'] },
  { name: 'Admins', href: '/admin/admins', icon: UserCog, roles: ['super_admin'] },
  { name: 'Backups', href: '/admin/backups', icon: Database, roles: ['super_admin'] },
  { name: 'Audit Logs', href: '/admin/audit-logs', icon: ClipboardList, roles: ['super_admin', 'senior_admin'] },
  { name: 'Settings', href: '/admin/settings', icon: Settings, roles: ['super_admin'] },
  { name: 'Knowledge Base', href: '/admin/knowledge-base', icon: BookOpen, roles: ['all'] },
];

export function AdminLayout() {
  const { isAdmin, isSuperAdmin, isSeniorAdmin, loading, signOut, adminInfo } = useAdmin();
  const location = useLocation();
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  // Load sidebar preference from localStorage
  useEffect(() => {
    const saved = localStorage.getItem('sidebarOpen');
    if (saved !== null) {
      setSidebarOpen(JSON.parse(saved));
    }
  }, []);

  // Save sidebar preference
  const toggleSidebar = () => {
    const newState = !sidebarOpen;
    setSidebarOpen(newState);
    localStorage.setItem('sidebarOpen', JSON.stringify(newState));
  };

  if (loading) {
    return (
      <div className="flex h-screen items-center justify-center bg-gradient-to-br from-background via-primary-50/30 to-background">
        <div className="text-center">
          <div className="relative mx-auto mb-6">
            <div className="h-12 w-12 animate-spin rounded-full border-4 border-primary/20 border-t-primary"></div>
            <div className="absolute inset-0 h-12 w-12 animate-pulse rounded-full bg-primary/10"></div>
          </div>
          <p className="text-sm font-medium text-muted-foreground animate-pulse">
            Loading your workspace...
          </p>
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

  // Sidebar Content Component (reusable for both desktop and mobile)
  const SidebarContent = ({ mobile = false }: { mobile?: boolean }) => (
    <>
      {/* Logo Section */}
        <div className="flex h-16 items-center gap-3 border-b border-border/50 px-4 bg-gradient-to-r from-primary/5 to-transparent">
        <div className="relative">
          <div className="absolute -inset-1 rounded-lg bg-gradient-to-r from-primary to-primary-glow opacity-20 blur"></div>
          <img 
            src="https://zsgyqhsajyiiluiutopg.supabase.co/storage/v1/object/public/logo/logo.png" 
            alt="Homara Logo" 
            className="relative h-8 w-8 rounded-lg object-contain"
          />
        </div>
        {(mobile || sidebarOpen) && (
          <div className="flex-1 animate-fade-in">
            <span className="font-bold text-lg tracking-tight">Homara</span>
            <p className="text-2xs text-muted-foreground">Admin Control Center</p>
          </div>
        )}
        {mobile && (
          <Button
            variant="ghost"
            size="icon"
            onClick={() => setMobileMenuOpen(false)}
            className="ml-auto md:hidden"
          >
            <X className="h-5 w-5" />
          </Button>
        )}
      </div>

      {/* Navigation */}
      <ScrollArea className="flex-1 px-3 py-4">
        <nav className="flex flex-col gap-1.5">
          <TooltipProvider delayDuration={0}>
            {filteredNavigation.map((item) => {
              const Icon = item.icon;
              const isActive = location.pathname === item.href || 
                (item.href !== '/admin' && location.pathname.startsWith(item.href));
              
              const navItem = (
                <Link
                  key={item.href}
                  to={item.href}
                  onClick={() => mobile && setMobileMenuOpen(false)}
                  className={cn(
                    'group relative flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-all duration-200',
                    isActive
                      ? 'bg-gradient-to-r from-primary to-primary-600 text-primary-foreground shadow-glow'
                      : 'text-muted-foreground hover:text-foreground hover:bg-accent/50 hover:scale-[1.02] active:scale-[0.98]'
                  )}
                >
                  {/* Active Indicator */}
                  {isActive && (
                    <div className="absolute left-0 top-1/2 -translate-y-1/2 w-1 h-8 bg-primary-foreground rounded-r-full shadow-glow-lg"></div>
                  )}
                  
                  <Icon className={cn(
                    "h-5 w-5 shrink-0 transition-transform duration-200",
                    isActive && "scale-110",
                    !isActive && "group-hover:scale-110 group-hover:rotate-3"
                  )} />
                  
                  {(mobile || sidebarOpen) && (
                    <span className="flex-1 animate-fade-in">{item.name}</span>
                  )}
                  
                  {/* Badge for notifications */}
                  {(mobile || sidebarOpen) && item.badge !== undefined && item.badge > 0 && (
                    <span className="px-2 py-0.5 text-2xs font-semibold rounded-full bg-warning text-warning-foreground animate-pulse-glow">
                      {item.badge}
                    </span>
                  )}
                </Link>
              );

              return (!mobile && !sidebarOpen) ? (
                <Tooltip key={item.href}>
                  <TooltipTrigger asChild>
                    {navItem}
                  </TooltipTrigger>
                  <TooltipContent side="right" className="font-medium">
                    {item.name}
                  </TooltipContent>
                </Tooltip>
              ) : navItem;
            })}
          </TooltipProvider>
        </nav>
      </ScrollArea>

      {/* User Section */}
      <div className="border-t border-border/50 p-4 bg-gradient-to-t from-primary/5 to-transparent">
        <div className={cn('flex items-center gap-3', !sidebarOpen && !mobile && 'justify-center')}>
          {(mobile || sidebarOpen) && (
            <div className="flex-1 min-w-0 animate-fade-in">
              <div className="flex items-center gap-2 mb-1">
                <div className="h-2 w-2 rounded-full bg-success animate-pulse"></div>
                <p className="text-sm font-semibold truncate capitalize">
                  {adminInfo?.admin_role?.replace(/_/g, ' ')}
                </p>
              </div>
              <p className="text-2xs text-muted-foreground truncate">
                {adminInfo?.status}
              </p>
            </div>
          )}
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => signOut()}
                  className="hover:bg-destructive/10 hover:text-destructive transition-all duration-200 hover:scale-110"
                >
                  <LogOut className="h-5 w-5" />
                </Button>
              </TooltipTrigger>
              <TooltipContent side={(mobile || sidebarOpen) ? "top" : "right"}>
                Sign Out
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>
        </div>
      </div>
    </>
  );

  return (
    <div className="flex h-screen overflow-hidden bg-background">
      {/* Desktop Sidebar */}
      <aside
        className={cn(
          'hidden md:fixed inset-y-0 left-0 z-50 md:flex flex-col border-r border-border/50 bg-card/95 backdrop-blur-xl transition-all duration-300 ease-in-out-circ shadow-soft',
          sidebarOpen ? 'w-64' : 'w-20'
        )}
      >
        <SidebarContent />
      </aside>

      {/* Mobile Sidebar (Sheet) */}
      <Sheet open={mobileMenuOpen} onOpenChange={setMobileMenuOpen}>
        <SheetContent side="left" className="w-64 p-0 md:hidden">
          <div className="flex h-full flex-col">
            <SidebarContent mobile />
          </div>
        </SheetContent>
      </Sheet>

      {/* Main Content Area */}
      <div className={cn(
        'flex flex-1 flex-col transition-all duration-300 ease-in-out-circ',
        'md:ml-20',
        sidebarOpen && 'md:ml-64'
      )}>
        {/* Enhanced Top Bar */}
        <header className="sticky top-0 z-40 flex h-16 items-center gap-4 border-b border-border/50 bg-card/80 backdrop-blur-xl px-4 md:px-6 shadow-sm">
          {/* Left Section */}
          <div className="flex items-center gap-3">
            {/* Mobile Menu Button */}
            <Button
              variant="ghost"
              size="icon"
              onClick={() => setMobileMenuOpen(true)}
              className="md:hidden transition-all duration-200 hover:scale-110 hover:bg-accent"
            >
              <Menu className="h-5 w-5" />
            </Button>
            
            {/* Desktop Sidebar Toggle */}
            <Button
              variant="ghost"
              size="icon"
              onClick={toggleSidebar}
              className="hidden md:flex transition-all duration-200 hover:scale-110 hover:bg-accent"
            >
              <Menu className={cn(
                "h-5 w-5 transition-transform duration-300",
                sidebarOpen ? "rotate-0" : "rotate-180"
              )} />
            </Button>
          </div>

          {/* Center - Breadcrumbs/Page Title */}
          <div className="flex-1 flex items-center gap-2">
            <h2 className="text-base md:text-lg font-semibold tracking-tight animate-fade-in truncate">
              {filteredNavigation.find(item => 
                location.pathname === item.href || 
                (item.href !== '/admin' && location.pathname.startsWith(item.href))
              )?.name || 'Dashboard'}
            </h2>
          </div>

          {/* Right Section */}
          <div className="flex items-center gap-1 md:gap-2">
            {/* Search Button (hidden on small mobile) */}
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button 
                    variant="ghost" 
                    size="icon"
                    className="hidden sm:flex relative hover:bg-accent transition-all duration-200 hover:scale-110"
                  >
                    <Search className="h-5 w-5" />
                  </Button>
                </TooltipTrigger>
                <TooltipContent>
                  Search (⌘K)
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>

            {/* Notifications */}
            <NotificationCenter />

            {/* Theme Toggle */}
            <ThemeToggle />
          </div>
        </header>

        {/* Main Content with Gradient Background */}
        <main className="flex-1 overflow-auto bg-gradient-to-br from-background via-primary-50/10 to-background">
          <div className="p-4 md:p-6 animate-fade-up">
            <Outlet />
          </div>
        </main>
      </div>
    </div>
  );
}
