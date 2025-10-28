import { lazy, Suspense } from "react";
import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import Index from "./pages/Index";
import NotFound from "./pages/NotFound";
import { AdminLayout } from "./components/admin/AdminLayout";
import { ErrorBoundary } from "./components/ErrorBoundary";

// Lazy load admin pages for better code splitting
const AdminLogin = lazy(() => import("./pages/admin/Login"));
const AdminDashboard = lazy(() => import("./pages/admin/Dashboard"));
const AdminUsers = lazy(() => import("./pages/admin/Users"));
const AdminListings = lazy(() => import("./pages/admin/Listings"));
const AdminVerifications = lazy(() => import("./pages/admin/Verifications"));
const AdminMonitoring = lazy(() => import("./pages/admin/Monitoring"));
const AdminSecurity = lazy(() => import("./pages/admin/Security"));
const AdminBackups = lazy(() => import("./pages/admin/Backups"));
const AdminReports = lazy(() => import("./pages/admin/Reports"));
const AdminAnalytics = lazy(() => import("./pages/admin/Analytics"));
const AdminReportBuilder = lazy(() => import("./pages/admin/ReportBuilder"));
const AdminPerformance = lazy(() => import("./pages/admin/Performance"));
const AdminDashboardSettings = lazy(() => import("./pages/admin/DashboardSettings"));
const AdminMyTasks = lazy(() => import("./pages/admin/MyTasks"));
const AdminSecurityCenter = lazy(() => import("./pages/admin/SecurityCenter"));
const AdminAuditLogs = lazy(() => import("./pages/admin/AuditLogs"));
const AdminAdmins = lazy(() => import("./pages/admin/Admins"));
const AdminSettings = lazy(() => import("./pages/admin/Settings"));
const AdminKnowledgeBase = lazy(() => import("./pages/admin/KnowledgeBase"));

const queryClient = new QueryClient();

const App = () => (
  <ErrorBoundary>
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <Toaster />
        <Sonner />
        <BrowserRouter>
          <Suspense fallback={
            <div className="flex items-center justify-center min-h-screen">
              <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-gray-900"></div>
            </div>
          }>
            <ErrorBoundary>
              <Routes>
                <Route path="/" element={<Index />} />
                <Route path="/admin/login" element={<AdminLogin />} />
                <Route path="/admin" element={<AdminLayout />}>
                  <Route index element={<AdminDashboard />} />
                  <Route path="users" element={<AdminUsers />} />
                  <Route path="listings" element={<AdminListings />} />
                  <Route path="verifications" element={<AdminVerifications />} />
                  <Route path="monitoring" element={<AdminMonitoring />} />
                  <Route path="security" element={<AdminSecurity />} />
                  <Route path="backups" element={<AdminBackups />} />
                  <Route path="reports" element={<AdminReports />} />
                  <Route path="analytics" element={<AdminAnalytics />} />
                  <Route path="report-builder" element={<AdminReportBuilder />} />
                  <Route path="performance" element={<AdminPerformance />} />
                  <Route path="dashboard-settings" element={<AdminDashboardSettings />} />
                  <Route path="my-tasks" element={<AdminMyTasks />} />
                  <Route path="security-center" element={<AdminSecurityCenter />} />
                  <Route path="audit-logs" element={<AdminAuditLogs />} />
                  <Route path="admins" element={<AdminAdmins />} />
                  <Route path="settings" element={<AdminSettings />} />
                  <Route path="knowledge-base" element={<AdminKnowledgeBase />} />
                </Route>
                {/* ADD ALL CUSTOM ROUTES ABOVE THE CATCH-ALL "*" ROUTE */}
                <Route path="*" element={<NotFound />} />
              </Routes>
            </ErrorBoundary>
          </Suspense>
        </BrowserRouter>
      </TooltipProvider>
    </QueryClientProvider>
  </ErrorBoundary>
);

export default App;
