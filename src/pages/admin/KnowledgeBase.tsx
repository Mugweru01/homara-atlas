import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { DocumentationViewer } from '@/components/admin/DocumentationViewer';
import { useAdmin } from '@/hooks/useAdmin';
import {
  Book,
  Search,
  Database,
  Code,
  Users,
  Shield,
  Rocket,
  FileText,
  HelpCircle,
  Layers,
  Settings,
  TrendingUp,
  Zap,
  CheckCircle2,
  BookOpen,
  GraduationCap,
  Lightbulb,
  Star,
  ArrowRight,
  Sparkles,
  BarChart3,
  Clock,
  ChevronRight,
  FileCode,
  Lock
} from 'lucide-react';
import { cn } from '@/lib/utils';

interface DocSection {
  id: string;
  title: string;
  description: string;
  icon: React.ElementType;
  color: string;
  gradient: string;
  documents: DocItem[];
  allowedRoles: string[]; // 'admin', 'senior_admin', 'super_admin'
}

interface DocItem {
  id: string;
  title: string;
  description: string;
  file: string;
  pages: string;
  status: 'complete' | 'planned';
}

export default function KnowledgeBase() {
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedDoc, setSelectedDoc] = useState<string | null>(null);
  const { isSuperAdmin, isSeniorAdmin, adminInfo } = useAdmin();

  // Determine current admin role for filtering
  const currentRole = isSuperAdmin 
    ? 'super_admin' 
    : isSeniorAdmin 
    ? 'senior_admin' 
    : 'admin';

  useEffect(() => {
    // Listen for internal documentation navigation
    const handleOpenDocInViewer = (e: any) => {
      const filename = e.detail;
      setSelectedDoc(filename);
    };

    window.addEventListener('openDocInViewer', handleOpenDocInViewer);
    return () => window.removeEventListener('openDocInViewer', handleOpenDocInViewer);
  }, []);

  const sections: DocSection[] = [
    {
      id: 'getting-started',
      title: 'Getting Started',
      description: 'Essential information to kickstart your journey with Homara Gatekeeper.',
      icon: Rocket,
      color: 'text-blue-600',
      gradient: 'from-blue-500 to-cyan-500',
      allowedRoles: ['admin', 'senior_admin', 'super_admin'], // All admins
      documents: [
        { id: 'system-overview', title: 'System Overview', description: 'Understand the architecture and core components.', file: 'KB_01_SYSTEM_OVERVIEW.md', pages: '25+', status: 'complete' },
        { id: 'quick-start-guide', title: 'Quick Start Guide', description: 'A rapid guide to get new admins up and running.', file: 'KB_02_QUICK_START_GUIDE.md', pages: '10', status: 'planned' },
        { id: 'admin-roles', title: 'Admin Roles & Permissions', description: 'Detailed breakdown of access levels and responsibilities.', file: 'KB_03_ADMIN_ROLES.md', pages: '8', status: 'planned' },
      ],
    },
    {
      id: 'database',
      title: 'Database & Schema',
      description: 'Complete database documentation, tables, relationships, and SQL functions.',
      icon: Database,
      color: 'text-purple-600',
      gradient: 'from-purple-500 to-pink-500',
      allowedRoles: ['super_admin'], // Super admins only
      documents: [
        { id: 'database-schema', title: 'Database Schema', description: 'Complete schema with all tables, columns, and relationships.', file: 'KB_04_DATABASE_SCHEMA.md', pages: '45+', status: 'complete' },
        { id: 'functions-reference', title: 'Functions Reference', description: 'All PostgreSQL functions with parameters and examples.', file: 'KB_05_FUNCTIONS_REFERENCE.md', pages: '60+', status: 'complete' },
        { id: 'migrations-guide', title: 'Migrations Guide', description: 'How to create, apply, and manage database migrations.', file: 'KB_06_MIGRATIONS_GUIDE.md', pages: '12', status: 'planned' },
      ],
    },
    {
      id: 'features',
      title: 'Features & Capabilities',
      description: 'Comprehensive guides for every feature in the admin panel.',
      icon: Sparkles,
      color: 'text-emerald-600',
      gradient: 'from-emerald-500 to-teal-500',
      allowedRoles: ['admin', 'senior_admin', 'super_admin'], // All admins
      documents: [
        { id: 'complete-features', title: 'Complete Features Guide', description: 'All features implemented with usage instructions.', file: 'KB_COMPLETE_FEATURES_GUIDE.md', pages: '80+', status: 'complete' },
        { id: 'notification-system', title: 'Notification System', description: 'Real-time notifications and alert management.', file: 'KB_07_NOTIFICATION_SYSTEM.md', pages: '15', status: 'planned' },
        { id: 'security-features', title: 'Security Features', description: '2FA, IP whitelist, session management, and more.', file: 'KB_08_SECURITY_FEATURES.md', pages: '18', status: 'planned' },
        { id: 'analytics-reporting', title: 'Analytics & Reporting', description: 'Charts, metrics, custom reports, and exports.', file: 'KB_09_ANALYTICS_REPORTING.md', pages: '20', status: 'planned' },
      ],
    },
    {
      id: 'admin-guide',
      title: 'Admin User Guide',
      description: 'Day-to-day usage guide for admin users at all levels.',
      icon: Users,
      color: 'text-orange-600',
      gradient: 'from-orange-500 to-red-500',
      allowedRoles: ['admin', 'senior_admin', 'super_admin'], // All admins
      documents: [
        { id: 'admin-guide', title: 'Admin User Guide', description: 'Complete guide for daily admin tasks and workflows.', file: 'KB_16_ADMIN_GUIDE.md', pages: '40+', status: 'complete' },
        { id: 'dashboard-guide', title: 'Dashboard Customization', description: 'Personalize your admin dashboard layout.', file: 'KB_17_DASHBOARD_CUSTOMIZATION.md', pages: '8', status: 'planned' },
        { id: 'bulk-operations', title: 'Bulk Operations', description: 'Efficiently manage multiple items at once.', file: 'KB_18_BULK_OPERATIONS.md', pages: '10', status: 'planned' },
      ],
    },
    {
      id: 'development',
      title: 'Development & API',
      description: 'Technical documentation for developers and integrators.',
      icon: Code,
      color: 'text-indigo-600',
      gradient: 'from-indigo-500 to-purple-500',
      allowedRoles: ['super_admin'], // Super admins only
      documents: [
        { id: 'api-reference', title: 'API Reference', description: 'Complete REST API and RPC function documentation.', file: 'KB_19_API_REFERENCE.md', pages: '50', status: 'planned' },
        { id: 'frontend-architecture', title: 'Frontend Architecture', description: 'React components, hooks, and state management.', file: 'KB_20_FRONTEND_ARCHITECTURE.md', pages: '30', status: 'planned' },
        { id: 'testing-guide', title: 'Testing Guide', description: 'Unit tests, integration tests, and E2E testing.', file: 'KB_21_TESTING_GUIDE.md', pages: '25', status: 'planned' },
      ],
    },
    {
      id: 'deployment',
      title: 'Deployment & Operations',
      description: 'Production deployment, monitoring, and maintenance guides.',
      icon: Settings,
      color: 'text-slate-600',
      gradient: 'from-slate-500 to-gray-500',
      allowedRoles: ['senior_admin', 'super_admin'], // Senior and Super admins
      documents: [
        { id: 'deployment-guide', title: 'Deployment Guide', description: 'Step-by-step production deployment instructions.', file: 'DEPLOYMENT_GUIDE.md', pages: '30+', status: 'complete' },
        { id: 'monitoring-alerts', title: 'Monitoring & Alerts', description: 'System health monitoring and alert configuration.', file: 'KB_22_MONITORING_ALERTS.md', pages: '15', status: 'planned' },
        { id: 'backup-recovery', title: 'Backup & Recovery', description: 'Automated backups and disaster recovery procedures.', file: 'KB_23_BACKUP_RECOVERY.md', pages: '12', status: 'planned' },
      ],
    },
    {
      id: 'help',
      title: 'Help & Support',
      description: 'Troubleshooting, FAQs, and best practices.',
      icon: HelpCircle,
      color: 'text-rose-600',
      gradient: 'from-rose-500 to-pink-500',
      allowedRoles: ['admin', 'senior_admin', 'super_admin'], // All admins
      documents: [
        { id: 'faq', title: 'Frequently Asked Questions', description: 'Common questions and answers.', file: 'KB_32_FAQ.md', pages: '20+', status: 'complete' },
        { id: 'troubleshooting', title: 'Troubleshooting Guide', description: 'Common issues and solutions.', file: 'KB_30_TROUBLESHOOTING.md', pages: '18', status: 'planned' },
        { id: 'best-practices', title: 'Best Practices', description: 'Security, performance, and workflow recommendations.', file: 'KB_31_BEST_PRACTICES.md', pages: '15', status: 'planned' },
      ],
    },
  ];

  // Filter sections by role first, then by search term
  const filteredSections = sections
    .filter(section => section.allowedRoles.includes(currentRole))
    .map(section => ({
      ...section,
      documents: section.documents.filter(doc =>
        doc.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
        doc.description.toLowerCase().includes(searchTerm.toLowerCase())
      )
    }))
    .filter(section => section.documents.length > 0);

  const openDoc = (file: string) => {
    setSelectedDoc(file);
  };

  // Calculate accessible stats based on role
  const accessibleSections = sections.filter(section => section.allowedRoles.includes(currentRole));
  const totalAccessibleDocs = accessibleSections.reduce((sum, section) => sum + section.documents.length, 0);
  const completeDocs = accessibleSections.reduce((sum, section) => 
    sum + section.documents.filter(doc => doc.status === 'complete').length, 0
  );

  const stats = [
    { label: 'Accessible Docs', value: totalAccessibleDocs.toString(), icon: Book, color: 'from-blue-500 to-cyan-500', iconColor: 'text-blue-600' },
    { label: 'Docs Complete', value: completeDocs.toString(), icon: CheckCircle2, color: 'from-emerald-500 to-teal-500', iconColor: 'text-emerald-600' },
    { label: 'Categories', value: accessibleSections.length.toString(), icon: Layers, color: 'from-purple-500 to-pink-500', iconColor: 'text-purple-600' },
    { label: 'Your Role', value: currentRole === 'super_admin' ? 'Super' : currentRole === 'senior_admin' ? 'Senior' : 'Admin', icon: Shield, color: 'from-orange-500 to-red-500', iconColor: 'text-orange-600' },
    { label: 'Access Level', value: currentRole === 'super_admin' ? 'Full' : currentRole === 'senior_admin' ? 'Advanced' : 'Standard', icon: Sparkles, color: 'from-indigo-500 to-purple-500', iconColor: 'text-indigo-600' },
  ];

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-white to-slate-100 dark:from-slate-950 dark:via-slate-900 dark:to-slate-950">
      <div className="relative overflow-hidden">
        {/* Decorative Background Elements */}
        <div className="absolute inset-0 overflow-hidden pointer-events-none">
          <div className="absolute -top-40 -right-40 w-96 h-96 bg-primary/5 rounded-full blur-3xl" />
          <div className="absolute top-1/2 -left-40 w-96 h-96 bg-blue-500/5 rounded-full blur-3xl" />
          <div className="absolute bottom-0 right-1/3 w-96 h-96 bg-purple-500/5 rounded-full blur-3xl" />
        </div>

        <div className="relative max-w-7xl mx-auto px-6 py-12 space-y-12">
          {/* Premium Header */}
          <div className="text-center space-y-6">
            <div className="flex items-center justify-center gap-3 flex-wrap">
              <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-gradient-to-r from-primary/10 to-primary/5 border border-primary/20">
                <Sparkles className="h-4 w-4 text-primary" />
                <span className="text-sm font-medium text-primary">Complete Documentation</span>
              </div>
              <div className={cn(
                "inline-flex items-center gap-2 px-4 py-2 rounded-full border",
                currentRole === 'super_admin' 
                  ? "bg-gradient-to-r from-purple-50 to-pink-50 dark:from-purple-950 dark:to-pink-950 border-purple-200 dark:border-purple-800"
                  : currentRole === 'senior_admin'
                  ? "bg-gradient-to-r from-blue-50 to-cyan-50 dark:from-blue-950 dark:to-cyan-950 border-blue-200 dark:border-blue-800"
                  : "bg-gradient-to-r from-emerald-50 to-teal-50 dark:from-emerald-950 dark:to-teal-950 border-emerald-200 dark:border-emerald-800"
              )}>
                <Shield className={cn(
                  "h-4 w-4",
                  currentRole === 'super_admin' 
                    ? "text-purple-600 dark:text-purple-400"
                    : currentRole === 'senior_admin'
                    ? "text-blue-600 dark:text-blue-400"
                    : "text-emerald-600 dark:text-emerald-400"
                )} />
                <span className={cn(
                  "text-sm font-medium",
                  currentRole === 'super_admin' 
                    ? "text-purple-700 dark:text-purple-300"
                    : currentRole === 'senior_admin'
                    ? "text-blue-700 dark:text-blue-300"
                    : "text-emerald-700 dark:text-emerald-300"
                )}>
                  {currentRole === 'super_admin' ? 'Full Access' : currentRole === 'senior_admin' ? 'Advanced Access' : 'Standard Access'}
                </span>
              </div>
            </div>
            <div className="space-y-4">
              <h1 className="text-6xl font-bold bg-gradient-to-r from-slate-900 via-slate-800 to-slate-900 dark:from-white dark:via-slate-200 dark:to-white bg-clip-text text-transparent">
                Knowledge Base
              </h1>
              <p className="text-xl text-muted-foreground max-w-2xl mx-auto">
                {currentRole === 'super_admin' 
                  ? 'Full access to all technical documentation, database schemas, and development guides.'
                  : currentRole === 'senior_admin'
                  ? 'Access to features, deployment guides, and advanced administration documentation.'
                  : 'Essential documentation for daily admin tasks and feature usage.'}
              </p>
            </div>
          </div>

          {/* Premium Stats Grid */}
          <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
            {stats.map((stat, index) => (
              <Card
                key={index}
                className="group relative overflow-hidden border-0 shadow-lg hover:shadow-2xl transition-all duration-300 hover:-translate-y-1"
              >
                <div className={cn("absolute inset-0 bg-gradient-to-br opacity-5 group-hover:opacity-10 transition-opacity", `bg-gradient-to-br ${stat.color}`)} />
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2 relative z-10">
                  <CardTitle className="text-sm font-medium text-muted-foreground">{stat.label}</CardTitle>
                  <div className={cn("p-2 rounded-lg bg-gradient-to-br", stat.color, "bg-opacity-10")}>
                    <stat.icon className={cn("h-4 w-4", stat.iconColor)} />
                  </div>
                </CardHeader>
                <CardContent className="relative z-10">
                  <div className="text-3xl font-bold">{stat.value}</div>
                  <div className="mt-2 h-1 w-full bg-gradient-to-r from-transparent via-current to-transparent opacity-10" />
                </CardContent>
              </Card>
            ))}
          </div>

          {/* Premium Tabs */}
          <Tabs defaultValue="browse" className="w-full">
            <div className="flex justify-center mb-8">
              <TabsList className="inline-flex h-12 p-1 bg-white/50 dark:bg-slate-900/50 backdrop-blur-xl border border-slate-200 dark:border-slate-800 shadow-lg">
                <TabsTrigger value="browse" className="px-8 data-[state=active]:bg-white data-[state=active]:shadow-md dark:data-[state=active]:bg-slate-800">
                  <BookOpen className="h-4 w-4 mr-2" />
                  Browse
                </TabsTrigger>
                <TabsTrigger value="learning-paths" className="px-8 data-[state=active]:bg-white data-[state=active]:shadow-md dark:data-[state=active]:bg-slate-800">
                  <GraduationCap className="h-4 w-4 mr-2" />
                  Learning Paths
                </TabsTrigger>
                <TabsTrigger value="quick-start" className="px-8 data-[state=active]:bg-white data-[state=active]:shadow-md dark:data-[state=active]:bg-slate-800">
                  <Zap className="h-4 w-4 mr-2" />
                  Quick Start
                </TabsTrigger>
              </TabsList>
            </div>

            {/* Browse Tab */}
            <TabsContent value="browse" className="mt-8 space-y-12">
              <div className="relative max-w-2xl mx-auto">
                <Search className="absolute left-4 top-1/2 -translate-y-1/2 h-5 w-5 text-muted-foreground" />
                <Input
                  placeholder="Search documentation..."
                  className="pl-12 h-14 text-lg bg-white/80 dark:bg-slate-900/80 backdrop-blur-xl border-slate-200 dark:border-slate-800 shadow-lg"
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                />
              </div>

              <div className="space-y-20">
                {filteredSections.map((section) => (
                  <div key={section.id} className="relative">
                    {/* Decorative background element */}
                    <div className={cn("absolute -top-4 -left-4 w-72 h-72 bg-gradient-to-br opacity-5 blur-3xl rounded-full -z-10", section.gradient)} />
                    
                    {/* Section Header */}
                    <div className="flex items-start gap-6 mb-8 pb-6 border-b-2 border-slate-200 dark:border-slate-800">
                      <div className={cn("p-4 rounded-2xl bg-gradient-to-br shadow-xl flex-shrink-0", section.gradient)}>
                        <section.icon className="h-8 w-8 text-white" />
                      </div>
                      <div className="flex-1">
                        <div className="flex items-center gap-3 mb-2">
                          <h2 className="text-4xl font-bold bg-gradient-to-r from-foreground to-foreground/60 bg-clip-text">{section.title}</h2>
                          <Badge variant="secondary" className="px-3 py-1 text-base font-semibold">
                            {section.documents.length} docs
                          </Badge>
                        </div>
                        <p className="text-lg text-muted-foreground leading-relaxed">{section.description}</p>
                      </div>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                      {section.documents.map((doc) => (
                        <Card
                          key={doc.id}
                          className="group cursor-pointer hover:shadow-2xl transition-all duration-300 hover:-translate-y-2 border-0 bg-white dark:bg-slate-900 overflow-hidden relative"
                          onClick={() => openDoc(doc.file)}
                        >
                          {/* Top gradient bar */}
                          <div className={cn("h-1.5 bg-gradient-to-r", section.gradient)} />
                          
                          {/* Decorative gradient background */}
                          <div className={cn("absolute inset-0 bg-gradient-to-br opacity-0 group-hover:opacity-5 transition-opacity duration-300", section.gradient)} />
                          
                          <CardHeader className="space-y-4 relative z-10 pb-4">
                            {/* Icon and status */}
                            <div className="flex items-start justify-between">
                              <div className={cn("p-3 rounded-xl bg-gradient-to-br shadow-md", section.gradient)}>
                                <FileText className="h-5 w-5 text-white" />
                              </div>
                              {doc.status === 'complete' ? (
                                <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-emerald-50 dark:bg-emerald-950 border border-emerald-200 dark:border-emerald-800">
                                  <CheckCircle2 className="h-3.5 w-3.5 text-emerald-600 dark:text-emerald-400" />
                                  <span className="text-xs font-semibold text-emerald-700 dark:text-emerald-300">Complete</span>
                                </div>
                              ) : (
                                <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-orange-50 dark:bg-orange-950 border border-orange-200 dark:border-orange-800">
                                  <Clock className="h-3.5 w-3.5 text-orange-600 dark:text-orange-400" />
                                  <span className="text-xs font-semibold text-orange-700 dark:text-orange-300">Planned</span>
                                </div>
                              )}
                            </div>

                            {/* Title */}
                            <div>
                              <CardTitle className="text-xl font-bold mb-2 group-hover:text-primary transition-colors line-clamp-2">
                                {doc.title}
                              </CardTitle>
                              <CardDescription className="text-sm leading-relaxed line-clamp-3 text-muted-foreground">
                                {doc.description}
                              </CardDescription>
                            </div>
                          </CardHeader>

                          {/* Footer */}
                          <CardContent className="pt-0 relative z-10">
                            <div className="flex items-center justify-between pt-4 border-t border-slate-200 dark:border-slate-800">
                              <div className="flex items-center gap-2">
                                <div className={cn("w-1.5 h-1.5 rounded-full bg-gradient-to-r", section.gradient)} />
                                <span className="text-sm font-medium text-muted-foreground">
                                  {doc.pages} pages
                                </span>
                              </div>
                              <div className="flex items-center gap-1 text-primary font-medium text-sm group-hover:gap-2 transition-all">
                                Read
                                <ChevronRight className="h-4 w-4 group-hover:translate-x-1 transition-transform" />
                              </div>
                            </div>
                          </CardContent>
                        </Card>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </TabsContent>

            {/* Learning Paths Tab */}
            <TabsContent value="learning-paths" className="mt-8">
              <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                {/* New Admin Path */}
                <Card className="group hover:shadow-2xl transition-all duration-300 hover:-translate-y-2 border-0 bg-gradient-to-br from-blue-50 to-cyan-50 dark:from-blue-950 dark:to-cyan-950 overflow-hidden">
                  <div className="h-2 bg-gradient-to-r from-blue-500 to-cyan-500" />
                  <CardHeader className="space-y-4">
                    <div className="p-4 rounded-2xl bg-gradient-to-br from-blue-500 to-cyan-500 w-fit">
                      <GraduationCap className="h-8 w-8 text-white" />
                    </div>
                    <div>
                      <CardTitle className="text-2xl font-bold mb-2">New Admin Path</CardTitle>
                      <CardDescription className="text-base">
                        Perfect for newcomers. Get up to speed quickly with essential admin tasks.
                      </CardDescription>
                    </div>
                  </CardHeader>
                  <CardContent className="space-y-6">
                    <div className="space-y-3">
                      {[
                        'System Overview',
                        'Admin Guide - Getting Started',
                        'Dashboard & Basic Features',
                        'Frequently Asked Questions'
                      ].map((item, i) => (
                        <div key={i} className="flex items-center gap-3">
                          <CheckCircle2 className="h-4 w-4 text-emerald-500 flex-shrink-0" />
                          <span className="text-sm">{item}</span>
                        </div>
                      ))}
                    </div>
                    <div className="pt-4 border-t border-blue-200 dark:border-blue-800">
                      <div className="flex items-center justify-between mb-4">
                        <span className="text-sm font-semibold text-blue-600 dark:text-blue-400">Est. 1-2 Days</span>
                        <Badge variant="secondary">Beginner</Badge>
                      </div>
                      <Button className="w-full bg-gradient-to-r from-blue-500 to-cyan-500 hover:from-blue-600 hover:to-cyan-600" onClick={() => openDoc('KB_01_SYSTEM_OVERVIEW.md')}>
                        Start Learning
                        <ArrowRight className="h-4 w-4 ml-2" />
                      </Button>
                    </div>
                  </CardContent>
                </Card>

                {/* Super Admin Path */}
                <Card className="group hover:shadow-2xl transition-all duration-300 hover:-translate-y-2 border-0 bg-gradient-to-br from-purple-50 to-pink-50 dark:from-purple-950 dark:to-pink-950 overflow-hidden">
                  <div className="h-2 bg-gradient-to-r from-purple-500 to-pink-500" />
                  <CardHeader className="space-y-4">
                    <div className="p-4 rounded-2xl bg-gradient-to-br from-purple-500 to-pink-500 w-fit">
                      <Star className="h-8 w-8 text-white" />
                    </div>
                    <div>
                      <CardTitle className="text-2xl font-bold mb-2">Super Admin Path</CardTitle>
                      <CardDescription className="text-base">
                        Master advanced features, security, monitoring, and comprehensive reporting.
                      </CardDescription>
                    </div>
                  </CardHeader>
                  <CardContent className="space-y-6">
                    <div className="space-y-3">
                      {[
                        'Complete: New Admin Path',
                        'Complete Features Guide',
                        'Security, Monitoring, Reports',
                        'Database Schema & Functions'
                      ].map((item, i) => (
                        <div key={i} className="flex items-center gap-3">
                          <CheckCircle2 className="h-4 w-4 text-emerald-500 flex-shrink-0" />
                          <span className="text-sm">{item}</span>
                        </div>
                      ))}
                    </div>
                    <div className="pt-4 border-t border-purple-200 dark:border-purple-800">
                      <div className="flex items-center justify-between mb-4">
                        <span className="text-sm font-semibold text-purple-600 dark:text-purple-400">Est. 3-5 Days</span>
                        <Badge variant="secondary">Advanced</Badge>
                      </div>
                      <Button className="w-full bg-gradient-to-r from-purple-500 to-pink-500 hover:from-purple-600 hover:to-pink-600" onClick={() => openDoc('KB_COMPLETE_FEATURES_GUIDE.md')}>
                        Advance Skills
                        <ArrowRight className="h-4 w-4 ml-2" />
                      </Button>
                    </div>
                  </CardContent>
                </Card>

                {/* Developer Path */}
                <Card className="group hover:shadow-2xl transition-all duration-300 hover:-translate-y-2 border-0 bg-gradient-to-br from-indigo-50 to-purple-50 dark:from-indigo-950 dark:to-purple-950 overflow-hidden">
                  <div className="h-2 bg-gradient-to-r from-indigo-500 to-purple-500" />
                  <CardHeader className="space-y-4">
                    <div className="p-4 rounded-2xl bg-gradient-to-br from-indigo-500 to-purple-500 w-fit">
                      <Code className="h-8 w-8 text-white" />
                    </div>
                    <div>
                      <CardTitle className="text-2xl font-bold mb-2">Developer Path</CardTitle>
                      <CardDescription className="text-base">
                        Deep dive into architecture, database design, and technical implementation.
                      </CardDescription>
                    </div>
                  </CardHeader>
                  <CardContent className="space-y-6">
                    <div className="space-y-3">
                      {[
                        'System Architecture',
                        'Complete Database Schema',
                        'All Functions & RPCs',
                        'Testing & Deployment'
                      ].map((item, i) => (
                        <div key={i} className="flex items-center gap-3">
                          <CheckCircle2 className="h-4 w-4 text-emerald-500 flex-shrink-0" />
                          <span className="text-sm">{item}</span>
                        </div>
                      ))}
                    </div>
                    <div className="pt-4 border-t border-indigo-200 dark:border-indigo-800">
                      <div className="flex items-center justify-between mb-4">
                        <span className="text-sm font-semibold text-indigo-600 dark:text-indigo-400">Est. 5-7 Days</span>
                        <Badge variant="secondary">Expert</Badge>
                      </div>
                      <Button className="w-full bg-gradient-to-r from-indigo-500 to-purple-500 hover:from-indigo-600 hover:to-purple-600" onClick={() => openDoc('KB_04_DATABASE_SCHEMA.md')}>
                        Start Coding
                        <ArrowRight className="h-4 w-4 ml-2" />
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              </div>
            </TabsContent>

            {/* Quick Start Tab */}
            <TabsContent value="quick-start" className="mt-8 space-y-8">
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                {/* Quick Start Cards */}
                {[
                  {
                    title: 'For New Users',
                    description: 'Jump straight into the most important documents for daily admin tasks.',
                    icon: Zap,
                    gradient: 'from-emerald-500 to-teal-500',
                    time: '2-3 Hours',
                    docs: [
                      { name: 'System Overview', file: 'KB_01_SYSTEM_OVERVIEW.md', icon: BookOpen },
                      { name: 'Admin User Guide', file: 'KB_16_ADMIN_GUIDE.md', icon: Users },
                      { name: 'Frequently Asked Questions', file: 'KB_32_FAQ.md', icon: HelpCircle },
                    ]
                  },
                  {
                    title: 'For Developers',
                    description: 'Essential technical documentation for understanding the codebase.',
                    icon: Code,
                    gradient: 'from-red-500 to-orange-500',
                    time: '4-6 Hours',
                    docs: [
                      { name: 'Database Schema', file: 'KB_04_DATABASE_SCHEMA.md', icon: Database },
                      { name: 'Functions Reference', file: 'KB_05_FUNCTIONS_REFERENCE.md', icon: FileCode },
                      { name: 'Deployment Guide', file: 'DEPLOYMENT_GUIDE.md', icon: Settings },
                    ]
                  }
                ].map((section, index) => (
                  <Card key={index} className="group hover:shadow-2xl transition-all duration-300 hover:-translate-y-2 border-0 bg-white/80 dark:bg-slate-900/80 backdrop-blur-xl overflow-hidden">
                    <div className={cn("h-2 bg-gradient-to-r", section.gradient)} />
                    <CardHeader className="space-y-4">
                      <div className={cn("p-4 rounded-2xl bg-gradient-to-br w-fit", section.gradient)}>
                        <section.icon className="h-8 w-8 text-white" />
                      </div>
                      <div>
                        <CardTitle className="text-2xl font-bold mb-2">{section.title}</CardTitle>
                        <CardDescription className="text-base">{section.description}</CardDescription>
                      </div>
                    </CardHeader>
                    <CardContent className="space-y-6">
                      <div className="space-y-2">
                        {section.docs.map((doc, i) => (
                          <Button
                            key={i}
                            variant="ghost"
                            className="w-full justify-start hover:bg-primary/5"
                            onClick={() => openDoc(doc.file)}
                          >
                            <doc.icon className="h-4 w-4 mr-3 text-muted-foreground" />
                            <span className="flex-1 text-left">{doc.name}</span>
                            <ChevronRight className="h-4 w-4 opacity-0 group-hover:opacity-100 transition-opacity" />
                          </Button>
                        ))}
                      </div>
                      <div className="pt-4 border-t">
                        <span className="text-sm font-semibold text-muted-foreground">⏱️ {section.time}</span>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>

              {/* Most Popular */}
              <Card className="border-0 bg-gradient-to-br from-yellow-50 to-orange-50 dark:from-yellow-950 dark:to-orange-950 shadow-lg overflow-hidden">
                <div className="h-2 bg-gradient-to-r from-yellow-500 to-orange-500" />
                <CardHeader>
                  <div className="flex items-center gap-3">
                    <TrendingUp className="h-6 w-6 text-orange-600" />
                    <CardTitle className="text-2xl font-bold">Most Popular Documents</CardTitle>
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                    {[
                      'KB_COMPLETE_FEATURES_GUIDE.md',
                      'KB_16_ADMIN_GUIDE.md',
                      'KB_04_DATABASE_SCHEMA.md',
                      'KB_05_FUNCTIONS_REFERENCE.md',
                      'KB_32_FAQ.md',
                      'DEPLOYMENT_GUIDE.md'
                    ].map((file, i) => (
                      <Button
                        key={i}
                        variant="outline"
                        className="justify-start h-auto py-3 bg-white dark:bg-slate-900"
                        onClick={() => openDoc(file)}
                      >
                        <FileText className="h-4 w-4 mr-2 flex-shrink-0" />
                        <span className="truncate">{file.replace('.md', '').replace(/_/g, ' ')}</span>
                      </Button>
                    ))}
                  </div>
                </CardContent>
              </Card>
            </TabsContent>
          </Tabs>

          {/* Premium Footer CTA */}
          <Card className="border-0 bg-gradient-to-r from-primary/10 via-primary/5 to-primary/10 backdrop-blur-xl shadow-xl">
            <CardContent className="p-8">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-4">
                  <div className="p-4 rounded-2xl bg-gradient-to-br from-primary to-primary/60">
                    <Book className="h-8 w-8 text-white" />
                  </div>
                  <div>
                    <p className="text-xl font-bold mb-1">Complete Knowledge Base</p>
                    <p className="text-muted-foreground">
                      All documentation files are in <code className="px-2 py-1 rounded bg-primary/10 text-primary text-sm">/docs</code> folder
                    </p>
                  </div>
                </div>
                <Button
                  size="lg"
                  variant="default"
                  className="bg-gradient-to-r from-primary to-primary/80 hover:from-primary/90 hover:to-primary/70 shadow-lg"
                  onClick={() => openDoc('KNOWLEDGE_BASE_INDEX.md')}
                >
                  <BookOpen className="h-5 w-5 mr-2" />
                  View Full Index
                  <ChevronRight className="h-5 w-5 ml-2" />
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Documentation Viewer Modal */}
      {selectedDoc && (
        <DocumentationViewer
          file={selectedDoc}
          onClose={() => setSelectedDoc(null)}
        />
      )}
    </div>
  );
}
