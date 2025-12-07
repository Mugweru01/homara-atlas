import { lazy, Suspense } from "react";
import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import Index from "./pages/Index";
import NotFound from "./pages/NotFound";
import { AdminLayout } from "./components/admin/AdminLayout";
import { ProtectedRoute } from "./components/admin/ProtectedRoute";
import { CrmLayout } from "./components/crm/CrmLayout";
import { HomaraDeskLayout } from "./components/homaradesk/HomaraDeskLayout";
import { SupportLayout } from "./components/support/SupportLayout";
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
// Marketplace Pages
const AdminAuctions = lazy(() => import("./pages/admin/marketplace/Auctions"));
const AdminSessions = lazy(() => import("./pages/admin/marketplace/Sessions"));
const AdminAuctionDetail = lazy(() => import("./pages/admin/marketplace/AuctionDetail"));
const AdminBids = lazy(() => import("./pages/admin/marketplace/Bids"));
const AdminBidQueue = lazy(() => import("./pages/admin/marketplace/BidQueue"));
const AdminAuctionAnalytics = lazy(() => import("./pages/admin/marketplace/AuctionAnalytics"));
// Payment Pages
const AdminTransactions = lazy(() => import("./pages/admin/payments/Transactions"));
const AdminPaymentProcessing = lazy(() => import("./pages/admin/payments/PaymentProcessing"));
const AdminEscrow = lazy(() => import("./pages/admin/payments/Escrow"));
const AdminFinancialReports = lazy(() => import("./pages/admin/payments/FinancialReports"));
const AdminPayouts = lazy(() => import("./pages/admin/payments/Payouts"));
// Booking Pages
const AdminShortStayBookings = lazy(() => import("./pages/admin/bookings/ShortStayBookings"));
const AdminViewingBookings = lazy(() => import("./pages/admin/bookings/ViewingBookings"));
const AdminBookingAnalytics = lazy(() => import("./pages/admin/bookings/BookingAnalytics"));
// Moderation Pages
const AdminPostsModeration = lazy(() => import("./pages/admin/moderation/PostsModeration"));
const AdminCommentsModeration = lazy(() => import("./pages/admin/moderation/CommentsModeration"));
const AdminMediaModeration = lazy(() => import("./pages/admin/moderation/MediaModeration"));
const AdminCommunityModeration = lazy(() => import("./pages/admin/moderation/CommunityModeration"));
const AdminAutomatedModeration = lazy(() => import("./pages/admin/moderation/AutomatedModeration"));
// Review Pages
const AdminReviewsOverview = lazy(() => import("./pages/admin/reviews/ReviewsOverview"));
const AdminReviewModeration = lazy(() => import("./pages/admin/reviews/ReviewModeration"));
const AdminFlaggedReviews = lazy(() => import("./pages/admin/reviews/FlaggedReviews"));
const AdminReviewAnalytics = lazy(() => import("./pages/admin/reviews/ReviewAnalytics"));
// Maintenance Pages
const AdminWorkOrders = lazy(() => import("./pages/admin/maintenance/WorkOrders"));
const AdminWorkOrderDetail = lazy(() => import("./pages/admin/maintenance/WorkOrderDetail"));
const AdminMaintenanceAnalytics = lazy(() => import("./pages/admin/maintenance/MaintenanceAnalytics"));
// Dispute Pages
const AdminDisputes = lazy(() => import("./pages/admin/disputes/Disputes"));
const AdminDisputeDetail = lazy(() => import("./pages/admin/disputes/DisputeDetail"));
const AdminDisputeAnalytics = lazy(() => import("./pages/admin/disputes/DisputeAnalytics"));
// CMS Pages
const AdminBlog = lazy(() => import("./pages/admin/cms/Blog"));
const AdminCMSPages = lazy(() => import("./pages/admin/cms/CMSPages"));
const AdminNewsletters = lazy(() => import("./pages/admin/cms/Newsletters"));
// User Analytics
const AdminUserAnalytics = lazy(() => import("./pages/admin/users/UserAnalytics"));
// Business Intelligence Pages
const BusinessIntelligenceLayout = lazy(() => import("./pages/admin/business-intelligence/BusinessIntelligenceLayout"));
const AdminFinancialDashboard = lazy(() => import("./pages/admin/business-intelligence/FinancialDashboard"));
const AdminExecutiveDashboard = lazy(() => import("./pages/admin/business-intelligence/ExecutiveDashboard"));
const AdminCustomerAnalytics = lazy(() => import("./pages/admin/business-intelligence/CustomerAnalytics"));
// Team Performance Pages (Senior Admin & Super Admin)
const AdminTeamPerformance = lazy(() => import("./pages/admin/TeamPerformance"));
const AdminAgentReports = lazy(() => import("./pages/admin/AgentReports"));
const AdminTicketAnalytics = lazy(() => import("./pages/admin/TicketAnalytics"));
// HomaraDesk Pages
const HomaraDeskDashboard = lazy(() => import("./pages/admin/homaradesk/Dashboard"));
const HomaraDeskTickets = lazy(() => import("./pages/admin/homaradesk/Tickets"));
const HomaraDeskTicketDetail = lazy(() => import("./pages/admin/homaradesk/TicketDetail"));
const HomaraDeskAutoAssignment = lazy(() => import("./pages/admin/homaradesk/AutoAssignment"));
const HomaraDeskSLAManagement = lazy(() => import("./pages/admin/homaradesk/SLAManagement"));
const HomaraDeskEmailTemplates = lazy(() => import("./pages/admin/homaradesk/EmailTemplates"));
const HomaraDeskKnowledgeBase = lazy(() => import("./pages/admin/homaradesk/KnowledgeBaseManagement"));
const HomaraDeskAnalytics = lazy(() => import("./pages/admin/homaradesk/Analytics"));
const HomaraDeskReports = lazy(() => import("./pages/admin/homaradesk/Reports"));
const HomaraDeskCannedResponses = lazy(() => import("./pages/admin/homaradesk/CannedResponses"));
const HomaraDeskMacros = lazy(() => import("./pages/admin/homaradesk/Macros"));
const HomaraDeskWorkflows = lazy(() => import("./pages/admin/homaradesk/Workflows"));
const HomaraDeskCustomFields = lazy(() => import("./pages/admin/homaradesk/CustomFields"));
const HomaraDeskSurveys = lazy(() => import("./pages/admin/homaradesk/SatisfactionSurveys"));
const HomaraDeskHolidayCalendars = lazy(() => import("./pages/admin/homaradesk/HolidayCalendars"));
const HomaraDeskEmailIntegration = lazy(() => import("./pages/admin/homaradesk/EmailIntegration"));
const HomaraDeskLiveChat = lazy(() => import("./pages/admin/homaradesk/LiveChat"));
const HomaraDeskAdvancedRouting = lazy(() => import("./pages/admin/homaradesk/AdvancedRouting"));
// Support Pages (Customer Portal)
const SupportHome = lazy(() => import("./pages/support/SupportHome"));
const SupportTickets = lazy(() => import("./pages/support/Tickets"));
const SupportCreateTicket = lazy(() => import("./pages/support/CreateTicket"));
const SupportTicketDetail = lazy(() => import("./pages/support/TicketDetail"));
const SupportKnowledgeBase = lazy(() => import("./pages/support/KnowledgeBase"));
const SupportArticleDetail = lazy(() => import("./pages/support/ArticleDetail"));
// CRM Pages
const CrmDashboard = lazy(() => import("./pages/crm/Dashboard"));
const CRMContacts = lazy(() => import("./pages/admin/crm/Contacts"));
const CRMContactDetail = lazy(() => import("./pages/admin/crm/ContactDetail"));
const CRMTags = lazy(() => import("./pages/admin/crm/Tags"));
const CRMCustomFields = lazy(() => import("./pages/admin/crm/CustomFields"));
const CRMActivities = lazy(() => import("./pages/admin/crm/Activities"));
const CRMLeads = lazy(() => import("./pages/admin/crm/Leads"));
const CRMLeadDetail = lazy(() => import("./pages/admin/crm/LeadDetail"));

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
                  <Route path="verifications" element={
                    <ProtectedRoute requireSuperAdmin>
                      <AdminVerifications />
                    </ProtectedRoute>
                  } />
                  <Route path="monitoring" element={
                    <ProtectedRoute requireSuperAdmin>
                      <AdminMonitoring />
                    </ProtectedRoute>
                  } />
                  <Route path="security" element={<AdminSecurity />} />
                  <Route path="backups" element={
                    <ProtectedRoute requireSuperAdmin>
                      <AdminBackups />
                    </ProtectedRoute>
                  } />
                  <Route path="reports" element={
                    <ProtectedRoute requireSeniorOrAbove>
                      <AdminReports />
                    </ProtectedRoute>
                  } />
                  <Route path="analytics" element={
                    <ProtectedRoute requireSuperAdmin>
                      <AdminAnalytics />
                    </ProtectedRoute>
                  } />
                  <Route path="business-intelligence" element={
                    <ProtectedRoute requireSuperAdmin>
                      <BusinessIntelligenceLayout />
                    </ProtectedRoute>
                  }>
                    <Route path="financial" element={<AdminFinancialDashboard />} />
                    <Route path="executive" element={<AdminExecutiveDashboard />} />
                    <Route path="customers" element={<AdminCustomerAnalytics />} />
                  </Route>
                  {/* Team Performance Routes (Senior Admin & Super Admin) */}
                  <Route path="team-performance" element={
                    <ProtectedRoute requireSeniorOrAbove>
                      <AdminTeamPerformance />
                    </ProtectedRoute>
                  } />
                  <Route path="agent-reports" element={
                    <ProtectedRoute requireSeniorOrAbove>
                      <AdminAgentReports />
                    </ProtectedRoute>
                  } />
                  <Route path="ticket-analytics" element={
                    <ProtectedRoute requireSeniorOrAbove>
                      <AdminTicketAnalytics />
                    </ProtectedRoute>
                  } />
                  <Route path="report-builder" element={
                    <ProtectedRoute requireSuperAdmin>
                      <AdminReportBuilder />
                    </ProtectedRoute>
                  } />
                  <Route path="performance" element={
                    <ProtectedRoute requireSuperAdmin>
                      <AdminPerformance />
                    </ProtectedRoute>
                  } />
                  <Route path="dashboard-settings" element={<AdminDashboardSettings />} />
                  <Route path="my-tasks" element={<AdminMyTasks />} />
                  <Route path="security-center" element={
                    <ProtectedRoute requireSuperAdmin>
                      <AdminSecurityCenter />
                    </ProtectedRoute>
                  } />
                  <Route path="audit-logs" element={
                    <ProtectedRoute requireSeniorOrAbove>
                      <AdminAuditLogs />
                    </ProtectedRoute>
                  } />
                  <Route path="admins" element={
                    <ProtectedRoute requireSuperAdmin>
                      <AdminAdmins />
                    </ProtectedRoute>
                  } />
                  <Route path="settings" element={
                    <ProtectedRoute requireSuperAdmin>
                      <AdminSettings />
                    </ProtectedRoute>
                  } />
                  <Route path="knowledge-base" element={<AdminKnowledgeBase />} />
                  <Route path="marketplace/auctions" element={<AdminAuctions />} />
                  <Route path="marketplace/auctions/:id" element={<AdminAuctionDetail />} />
                  <Route path="marketplace/bids" element={<AdminBids />} />
                  <Route path="marketplace/queue" element={<AdminBidQueue />} />
                  <Route path="marketplace/sessions" element={<AdminSessions />} />
                  <Route path="marketplace/analytics" element={<AdminAuctionAnalytics />} />
                  <Route path="payments/transactions" element={<AdminTransactions />} />
                  <Route path="payments/processing" element={<AdminPaymentProcessing />} />
                  <Route path="payments/escrow" element={<AdminEscrow />} />
                  <Route path="payments/reports" element={<AdminFinancialReports />} />
                  <Route path="payments/payouts" element={<AdminPayouts />} />
                  <Route path="bookings/short-stays" element={<AdminShortStayBookings />} />
                  <Route path="bookings/viewings" element={<AdminViewingBookings />} />
                  <Route path="bookings/analytics" element={<AdminBookingAnalytics />} />
                  <Route path="moderation/posts" element={
                    <ProtectedRoute requireSuperAdmin>
                      <AdminPostsModeration />
                    </ProtectedRoute>
                  } />
                  <Route path="moderation/comments" element={
                    <ProtectedRoute requireSuperAdmin>
                      <AdminCommentsModeration />
                    </ProtectedRoute>
                  } />
                  <Route path="moderation/media" element={
                    <ProtectedRoute requireSuperAdmin>
                      <AdminMediaModeration />
                    </ProtectedRoute>
                  } />
                  <Route path="moderation/community" element={
                    <ProtectedRoute requireSuperAdmin>
                      <AdminCommunityModeration />
                    </ProtectedRoute>
                  } />
                  <Route path="moderation/automated" element={
                    <ProtectedRoute requireSuperAdmin>
                      <AdminAutomatedModeration />
                    </ProtectedRoute>
                  } />
                  <Route path="reviews">
                    <Route index element={
                      <ProtectedRoute requireSuperAdmin>
                        <AdminReviewsOverview />
                      </ProtectedRoute>
                    } />
                    <Route path="moderation" element={
                      <ProtectedRoute requireSuperAdmin>
                        <AdminReviewModeration />
                      </ProtectedRoute>
                    } />
                    <Route path="flagged" element={
                      <ProtectedRoute requireSuperAdmin>
                        <AdminFlaggedReviews />
                      </ProtectedRoute>
                    } />
                    <Route path="analytics" element={
                      <ProtectedRoute requireSuperAdmin>
                        <AdminReviewAnalytics />
                      </ProtectedRoute>
                    } />
                  </Route>
                  <Route path="maintenance">
                    <Route index element={
                      <ProtectedRoute requireSuperAdmin>
                        <AdminWorkOrders />
                      </ProtectedRoute>
                    } />
                    <Route path="work-orders" element={
                      <ProtectedRoute requireSuperAdmin>
                        <AdminWorkOrders />
                      </ProtectedRoute>
                    } />
                    <Route path="work-orders/:id" element={
                      <ProtectedRoute requireSuperAdmin>
                        <AdminWorkOrderDetail />
                      </ProtectedRoute>
                    } />
                    <Route path="analytics" element={
                      <ProtectedRoute requireSuperAdmin>
                        <AdminMaintenanceAnalytics />
                      </ProtectedRoute>
                    } />
                  </Route>
                  <Route path="disputes">
                    <Route index element={
                      <ProtectedRoute requireSuperAdmin>
                        <AdminDisputes />
                      </ProtectedRoute>
                    } />
                    <Route path=":id" element={
                      <ProtectedRoute requireSuperAdmin>
                        <AdminDisputeDetail />
                      </ProtectedRoute>
                    } />
                    <Route path="analytics" element={
                      <ProtectedRoute requireSuperAdmin>
                        <AdminDisputeAnalytics />
                      </ProtectedRoute>
                    } />
                  </Route>
                  <Route path="content">
                    <Route path="blog" element={
                      <ProtectedRoute requireSuperAdmin>
                        <AdminBlog />
                      </ProtectedRoute>
                    } />
                    <Route path="pages" element={
                      <ProtectedRoute requireSuperAdmin>
                        <AdminCMSPages />
                      </ProtectedRoute>
                    } />
                    <Route path="newsletters" element={
                      <ProtectedRoute requireSuperAdmin>
                        <AdminNewsletters />
                      </ProtectedRoute>
                    } />
                  </Route>
                  <Route path="users/analytics" element={
                    <ProtectedRoute requireSuperAdmin>
                      <AdminUserAnalytics />
                    </ProtectedRoute>
                  } />
                </Route>
                {/* CRM Routes - Dedicated CRM Section (Super Admin Only) */}
                <Route path="/crm" element={
                  <ProtectedRoute requireSuperAdmin>
                    <CrmLayout />
                  </ProtectedRoute>
                }>
                  <Route index element={<CrmDashboard />} />
                  <Route path="contacts" element={<CRMContacts />} />
                  <Route path="contacts/:id" element={<CRMContactDetail />} />
                  <Route path="tags" element={<CRMTags />} />
                  <Route path="custom-fields" element={<CRMCustomFields />} />
                  <Route path="activities" element={<CRMActivities />} />
                  <Route path="leads" element={<CRMLeads />} />
                  <Route path="leads/:id" element={<CRMLeadDetail />} />
                </Route>
                {/* HomaraDesk Routes - Dedicated Support Section */}
                <Route path="/homaradesk" element={<HomaraDeskLayout />}>
                  <Route index element={<HomaraDeskDashboard />} />
                  <Route path="tickets" element={<HomaraDeskTickets />} />
                  <Route path="tickets/:id" element={<HomaraDeskTicketDetail />} />
                  <Route path="auto-assignment" element={<HomaraDeskAutoAssignment />} />
                  <Route path="sla" element={<HomaraDeskSLAManagement />} />
                  <Route path="email-templates" element={<HomaraDeskEmailTemplates />} />
                  <Route path="knowledge-base" element={<HomaraDeskKnowledgeBase />} />
                  <Route path="canned-responses" element={<HomaraDeskCannedResponses />} />
                  <Route path="macros" element={<HomaraDeskMacros />} />
                  <Route path="workflows" element={<HomaraDeskWorkflows />} />
                  <Route path="custom-fields" element={<HomaraDeskCustomFields />} />
                  <Route path="surveys" element={<HomaraDeskSurveys />} />
                  <Route path="holiday-calendars" element={<HomaraDeskHolidayCalendars />} />
                  <Route path="email-integration" element={<HomaraDeskEmailIntegration />} />
                  <Route path="live-chat" element={<HomaraDeskLiveChat />} />
                  <Route path="advanced-routing" element={<HomaraDeskAdvancedRouting />} />
                  <Route path="analytics" element={<HomaraDeskAnalytics />} />
                  <Route path="reports" element={<HomaraDeskReports />} />
                </Route>
                {/* Support Routes - Customer Portal */}
                <Route path="/support" element={<SupportLayout />}>
                  <Route index element={<SupportHome />} />
                  <Route path="tickets" element={<SupportTickets />} />
                  <Route path="tickets/:id" element={<SupportTicketDetail />} />
                  <Route path="new" element={<SupportCreateTicket />} />
                  <Route path="kb" element={<SupportKnowledgeBase />} />
                  <Route path="kb/:id" element={<SupportArticleDetail />} />
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
