import { useAdmin } from './useAdmin';

export interface Permissions {
  // Junior Admin (Customer Service) Permissions
  canViewTickets: boolean;
  canManageTickets: boolean;
  canViewUsers: boolean;
  canEditUsers: boolean; // Only verify users
  canDeleteUsers: boolean;
  canViewProperties: boolean;
  canViewBookings: boolean;
  canViewHomaraDesk: boolean;
  
  // Senior Admin (Team Leader) Permissions
  canViewReports: boolean;
  canViewAgentPerformance: boolean;
  canViewTeamAnalytics: boolean;
  canViewTicketAnalytics: boolean;
  canExportReports: boolean;
  canViewAuditLogs: boolean;
  
  // Super Admin Permissions
  canManageAdmins: boolean;
  canManageSettings: boolean;
  canViewBusinessIntelligence: boolean;
  canManageSystem: boolean;
  canViewSecurityCenter: boolean;
  canManageBackups: boolean;
  canViewAllData: boolean;
  
  // HomaraDesk Permissions
  // Tickets - All admins can view and manage
  canViewTicketsHD: boolean;
  canManageTicketsHD: boolean;
  
  // Canned Responses - Junior can use, Senior+ can edit
  canViewCannedResponses: boolean;
  canEditCannedResponses: boolean;
  
  // Macros - Junior can use, Senior+ can edit
  canViewMacros: boolean;
  canEditMacros: boolean;
  
  // Workflows - Senior+ only
  canViewWorkflows: boolean;
  canEditWorkflows: boolean;
  
  // Custom Fields - Senior+ only
  canViewCustomFields: boolean;
  canEditCustomFields: boolean;
  
  // Surveys - Senior+ only
  canViewSurveys: boolean;
  canEditSurveys: boolean;
  
  // Holiday Calendars - Senior+ only
  canViewHolidayCalendars: boolean;
  canEditHolidayCalendars: boolean;
  
  // Email Integration - Senior+ only
  canViewEmailIntegration: boolean;
  canEditEmailIntegration: boolean;
  
  // Live Chat - All admins can view, Senior+ can configure
  canViewLiveChat: boolean;
  canEditLiveChat: boolean;
  
  // Advanced Routing - Senior+ only
  canViewAdvancedRouting: boolean;
  canEditAdvancedRouting: boolean;
  
  // Analytics - Senior+ only
  canViewAnalytics: boolean;
  
  // Reports - Senior+ only
  canViewReportsHD: boolean;
  
  // Auto-Assignment - Senior+ only
  canViewAutoAssignment: boolean;
  canEditAutoAssignment: boolean;
  
  // SLA Management - Senior+ only
  canViewSLA: boolean;
  canEditSLA: boolean;
  
  // Email Templates - Senior+ only
  canViewEmailTemplates: boolean;
  canEditEmailTemplates: boolean;
  
  // Knowledge Base - All can view, Super Admin only can edit
  canViewKnowledgeBase: boolean;
  canEditKnowledgeBase: boolean;
  
  // Common Permissions
  canEdit: boolean;
  canDelete: boolean;
  canCreate: boolean;
}

export function usePermissions(): Permissions {
  const { isSuperAdmin, isSeniorAdmin, adminInfo } = useAdmin();
  
  const isJuniorAdmin = adminInfo?.admin_role === 'junior_admin' || adminInfo?.admin_role === 'support_admin';
  
  return {
    // Junior Admin - Customer Service Focus
    canViewTickets: true, // All admins can view tickets
    canManageTickets: true, // All admins can manage tickets
    canViewUsers: true, // All admins can view users
    canEditUsers: isSeniorAdmin || isSuperAdmin, // Only senior+ can edit users (except verify)
    canDeleteUsers: isSuperAdmin, // Only super admins can delete users
    canViewProperties: true, // All admins can view properties
    canViewBookings: true, // All admins can view bookings
    canViewHomaraDesk: true, // All admins can access helpdesk
    
    // Senior Admin - Team Leader
    canViewReports: isSeniorAdmin || isSuperAdmin,
    canViewAgentPerformance: isSeniorAdmin || isSuperAdmin,
    canViewTeamAnalytics: isSeniorAdmin || isSuperAdmin,
    canViewTicketAnalytics: isSeniorAdmin || isSuperAdmin,
    canExportReports: isSeniorAdmin || isSuperAdmin,
    canViewAuditLogs: isSeniorAdmin || isSuperAdmin,
    
    // Super Admin - Full Access
    canManageAdmins: isSuperAdmin,
    canManageSettings: isSuperAdmin,
    canViewBusinessIntelligence: isSuperAdmin,
    canManageSystem: isSuperAdmin,
    canViewSecurityCenter: isSuperAdmin,
    canManageBackups: isSuperAdmin,
    canViewAllData: isSuperAdmin,
    
    // HomaraDesk Permissions
    // Tickets - All admins
    canViewTicketsHD: true,
    canManageTicketsHD: true,
    
    // Canned Responses - Junior can use, Senior+ can edit
    canViewCannedResponses: true,
    canEditCannedResponses: isSeniorAdmin || isSuperAdmin,
    
    // Macros - Junior can use, Senior+ can edit
    canViewMacros: true,
    canEditMacros: isSeniorAdmin || isSuperAdmin,
    
    // Workflows - Senior+ only
    canViewWorkflows: isSeniorAdmin || isSuperAdmin,
    canEditWorkflows: isSeniorAdmin || isSuperAdmin,
    
    // Custom Fields - Senior+ only
    canViewCustomFields: isSeniorAdmin || isSuperAdmin,
    canEditCustomFields: isSeniorAdmin || isSuperAdmin,
    
    // Surveys - Senior+ only
    canViewSurveys: isSeniorAdmin || isSuperAdmin,
    canEditSurveys: isSeniorAdmin || isSuperAdmin,
    
    // Holiday Calendars - Senior+ only
    canViewHolidayCalendars: isSeniorAdmin || isSuperAdmin,
    canEditHolidayCalendars: isSeniorAdmin || isSuperAdmin,
    
    // Email Integration - Senior+ only
    canViewEmailIntegration: isSeniorAdmin || isSuperAdmin,
    canEditEmailIntegration: isSeniorAdmin || isSuperAdmin,
    
    // Live Chat - All can view, Senior+ can configure
    canViewLiveChat: true,
    canEditLiveChat: isSeniorAdmin || isSuperAdmin,
    
    // Advanced Routing - Senior+ only
    canViewAdvancedRouting: isSeniorAdmin || isSuperAdmin,
    canEditAdvancedRouting: isSeniorAdmin || isSuperAdmin,
    
    // Analytics - Senior+ only
    canViewAnalytics: isSeniorAdmin || isSuperAdmin,
    
    // Reports - Senior+ only
    canViewReportsHD: isSeniorAdmin || isSuperAdmin,
    
    // Auto-Assignment - Senior+ only
    canViewAutoAssignment: isSeniorAdmin || isSuperAdmin,
    canEditAutoAssignment: isSeniorAdmin || isSuperAdmin,
    
    // SLA Management - Senior+ only
    canViewSLA: isSeniorAdmin || isSuperAdmin,
    canEditSLA: isSeniorAdmin || isSuperAdmin,
    
    // Email Templates - Senior+ only
    canViewEmailTemplates: isSeniorAdmin || isSuperAdmin,
    canEditEmailTemplates: isSeniorAdmin || isSuperAdmin,
    
    // Knowledge Base - All can view, Super Admin only can edit
    canViewKnowledgeBase: true,
    canEditKnowledgeBase: isSuperAdmin,
    
    // Edit Permissions
    canEdit: isSeniorAdmin || isSuperAdmin, // Junior admins can't edit most things
    canDelete: isSuperAdmin, // Only super admins can delete
    canCreate: isSeniorAdmin || isSuperAdmin, // Senior and super can create
  };
}


