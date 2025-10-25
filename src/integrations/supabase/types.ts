export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "13.0.5"
  }
  public: {
    Tables: {
      admin_actions: {
        Row: {
          action_description: string
          action_type: string
          admin_id: string
          created_at: string | null
          error_message: string | null
          id: string
          ip_address: string
          request_metadata: Json | null
          resource_id: string | null
          resource_type: string
          response_time_ms: number | null
          risk_score: number | null
          session_id: string | null
          success: boolean
          suspicious_indicators: string[] | null
          user_agent: string | null
        }
        Insert: {
          action_description: string
          action_type: string
          admin_id: string
          created_at?: string | null
          error_message?: string | null
          id?: string
          ip_address: string
          request_metadata?: Json | null
          resource_id?: string | null
          resource_type: string
          response_time_ms?: number | null
          risk_score?: number | null
          session_id?: string | null
          success: boolean
          suspicious_indicators?: string[] | null
          user_agent?: string | null
        }
        Update: {
          action_description?: string
          action_type?: string
          admin_id?: string
          created_at?: string | null
          error_message?: string | null
          id?: string
          ip_address?: string
          request_metadata?: Json | null
          resource_id?: string | null
          resource_type?: string
          response_time_ms?: number | null
          risk_score?: number | null
          session_id?: string | null
          success?: boolean
          suspicious_indicators?: string[] | null
          user_agent?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "admin_actions_admin_id_fkey"
            columns: ["admin_id"]
            isOneToOne: false
            referencedRelation: "admins"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "admin_actions_session_id_fkey"
            columns: ["session_id"]
            isOneToOne: false
            referencedRelation: "admin_sessions"
            referencedColumns: ["id"]
          },
        ]
      }
      admin_approvals: {
        Row: {
          admin_id: string
          approval_status: string
          approval_type: string
          approved_at: string | null
          approver_id: string
          approver_notes: string | null
          background_check_completed: boolean | null
          conditions: string[] | null
          created_at: string | null
          expires_at: string | null
          id: string
          justification: string | null
          reason: string
          requested_at: string | null
          requested_changes: Json | null
          reviewed_at: string | null
          security_clearance_level: string | null
          training_completed: boolean | null
        }
        Insert: {
          admin_id: string
          approval_status?: string
          approval_type: string
          approved_at?: string | null
          approver_id: string
          approver_notes?: string | null
          background_check_completed?: boolean | null
          conditions?: string[] | null
          created_at?: string | null
          expires_at?: string | null
          id?: string
          justification?: string | null
          reason: string
          requested_at?: string | null
          requested_changes?: Json | null
          reviewed_at?: string | null
          security_clearance_level?: string | null
          training_completed?: boolean | null
        }
        Update: {
          admin_id?: string
          approval_status?: string
          approval_type?: string
          approved_at?: string | null
          approver_id?: string
          approver_notes?: string | null
          background_check_completed?: boolean | null
          conditions?: string[] | null
          created_at?: string | null
          expires_at?: string | null
          id?: string
          justification?: string | null
          reason?: string
          requested_at?: string | null
          requested_changes?: Json | null
          reviewed_at?: string | null
          security_clearance_level?: string | null
          training_completed?: boolean | null
        }
        Relationships: [
          {
            foreignKeyName: "admin_approvals_admin_id_fkey"
            columns: ["admin_id"]
            isOneToOne: false
            referencedRelation: "admins"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "admin_approvals_approver_id_fkey"
            columns: ["approver_id"]
            isOneToOne: false
            referencedRelation: "admins"
            referencedColumns: ["id"]
          },
        ]
      }
      admin_sessions: {
        Row: {
          admin_id: string
          created_at: string | null
          device_fingerprint: string | null
          expires_at: string
          id: string
          ip_address: string
          is_active: boolean | null
          last_activity: string | null
          location: string | null
          mfa_verified: boolean | null
          risk_score: number | null
          session_token: string
          user_agent: string | null
          vpn_verified: boolean | null
        }
        Insert: {
          admin_id: string
          created_at?: string | null
          device_fingerprint?: string | null
          expires_at: string
          id?: string
          ip_address: string
          is_active?: boolean | null
          last_activity?: string | null
          location?: string | null
          mfa_verified?: boolean | null
          risk_score?: number | null
          session_token: string
          user_agent?: string | null
          vpn_verified?: boolean | null
        }
        Update: {
          admin_id?: string
          created_at?: string | null
          device_fingerprint?: string | null
          expires_at?: string
          id?: string
          ip_address?: string
          is_active?: boolean | null
          last_activity?: string | null
          location?: string | null
          mfa_verified?: boolean | null
          risk_score?: number | null
          session_token?: string
          user_agent?: string | null
          vpn_verified?: boolean | null
        }
        Relationships: [
          {
            foreignKeyName: "admin_sessions_admin_id_fkey"
            columns: ["admin_id"]
            isOneToOne: false
            referencedRelation: "admins"
            referencedColumns: ["id"]
          },
        ]
      }
      admin_verification_logs: {
        Row: {
          action: string
          admin_id: string
          id: string
          metadata: Json | null
          new_status: Database["public"]["Enums"]["verification_status"] | null
          notes: string | null
          performed_at: string | null
          previous_status:
            | Database["public"]["Enums"]["verification_status"]
            | null
          reason: string | null
          verification_id: string
        }
        Insert: {
          action: string
          admin_id: string
          id?: string
          metadata?: Json | null
          new_status?: Database["public"]["Enums"]["verification_status"] | null
          notes?: string | null
          performed_at?: string | null
          previous_status?:
            | Database["public"]["Enums"]["verification_status"]
            | null
          reason?: string | null
          verification_id: string
        }
        Update: {
          action?: string
          admin_id?: string
          id?: string
          metadata?: Json | null
          new_status?: Database["public"]["Enums"]["verification_status"] | null
          notes?: string | null
          performed_at?: string | null
          previous_status?:
            | Database["public"]["Enums"]["verification_status"]
            | null
          reason?: string | null
          verification_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "admin_verification_logs_admin_id_fkey"
            columns: ["admin_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "admin_verification_logs_verification_id_fkey"
            columns: ["verification_id"]
            isOneToOne: false
            referencedRelation: "landlord_verifications"
            referencedColumns: ["id"]
          },
        ]
      }
      admins: {
        Row: {
          admin_code: string
          admin_role: Database["public"]["Enums"]["admin_role"]
          allowed_ips: string[] | null
          approved_at: string | null
          approved_by: string | null
          backup_codes: string[] | null
          created_at: string | null
          created_by: string | null
          email: string | null
          failed_login_attempts: number | null
          id: string
          last_login_at: string | null
          last_login_ip: string | null
          last_login_location: string | null
          last_reviewed_at: string | null
          locked_until: string | null
          max_session_duration: number | null
          next_review_due: string | null
          security_questions: Json | null
          status: Database["public"]["Enums"]["admin_status"]
          updated_at: string | null
          user_id: string
          vpn_required: boolean | null
        }
        Insert: {
          admin_code: string
          admin_role?: Database["public"]["Enums"]["admin_role"]
          allowed_ips?: string[] | null
          approved_at?: string | null
          approved_by?: string | null
          backup_codes?: string[] | null
          created_at?: string | null
          created_by?: string | null
          email?: string | null
          failed_login_attempts?: number | null
          id?: string
          last_login_at?: string | null
          last_login_ip?: string | null
          last_login_location?: string | null
          last_reviewed_at?: string | null
          locked_until?: string | null
          max_session_duration?: number | null
          next_review_due?: string | null
          security_questions?: Json | null
          status?: Database["public"]["Enums"]["admin_status"]
          updated_at?: string | null
          user_id: string
          vpn_required?: boolean | null
        }
        Update: {
          admin_code?: string
          admin_role?: Database["public"]["Enums"]["admin_role"]
          allowed_ips?: string[] | null
          approved_at?: string | null
          approved_by?: string | null
          backup_codes?: string[] | null
          created_at?: string | null
          created_by?: string | null
          email?: string | null
          failed_login_attempts?: number | null
          id?: string
          last_login_at?: string | null
          last_login_ip?: string | null
          last_login_location?: string | null
          last_reviewed_at?: string | null
          locked_until?: string | null
          max_session_duration?: number | null
          next_review_due?: string | null
          security_questions?: Json | null
          status?: Database["public"]["Enums"]["admin_status"]
          updated_at?: string | null
          user_id?: string
          vpn_required?: boolean | null
        }
        Relationships: [
          {
            foreignKeyName: "admins_approved_by_fkey"
            columns: ["approved_by"]
            isOneToOne: false
            referencedRelation: "admins"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "admins_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "admins"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "admins_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: true
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      audit_logs: {
        Row: {
          action: string
          created_at: string | null
          id: string
          ip_address: string | null
          new_data: Json | null
          old_data: Json | null
          record_id: string | null
          table_name: string
          user_agent: string | null
          user_id: string | null
        }
        Insert: {
          action: string
          created_at?: string | null
          id?: string
          ip_address?: string | null
          new_data?: Json | null
          old_data?: Json | null
          record_id?: string | null
          table_name: string
          user_agent?: string | null
          user_id?: string | null
        }
        Update: {
          action?: string
          created_at?: string | null
          id?: string
          ip_address?: string | null
          new_data?: Json | null
          old_data?: Json | null
          record_id?: string | null
          table_name?: string
          user_agent?: string | null
          user_id?: string | null
        }
        Relationships: []
      }
      cms_pages: {
        Row: {
          content: string
          id: string
          slug: string
          title: string
          updated_at: string
        }
        Insert: {
          content: string
          id?: string
          slug: string
          title: string
          updated_at?: string
        }
        Update: {
          content?: string
          id?: string
          slug?: string
          title?: string
          updated_at?: string
        }
        Relationships: []
      }
      contact_reveals: {
        Row: {
          amount_kes: number
          id: string
          payment_id: string | null
          property_id: string
          revealed_at: string
          user_id: string | null
        }
        Insert: {
          amount_kes: number
          id?: string
          payment_id?: string | null
          property_id: string
          revealed_at?: string
          user_id?: string | null
        }
        Update: {
          amount_kes?: number
          id?: string
          payment_id?: string | null
          property_id?: string
          revealed_at?: string
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "contact_reveals_payment_id_fkey"
            columns: ["payment_id"]
            isOneToOne: false
            referencedRelation: "payments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "contact_reveals_property_id_fkey"
            columns: ["property_id"]
            isOneToOne: false
            referencedRelation: "properties"
            referencedColumns: ["id"]
          },
        ]
      }
      data_retention_log: {
        Row: {
          executed_at: string | null
          id: string
          items_affected: number
          task_name: string
        }
        Insert: {
          executed_at?: string | null
          id?: string
          items_affected: number
          task_name: string
        }
        Update: {
          executed_at?: string | null
          id?: string
          items_affected?: number
          task_name?: string
        }
        Relationships: []
      }
      document_access_logs: {
        Row: {
          access_duration_seconds: number | null
          access_type: string
          admin_id: string
          created_at: string | null
          document_id: string
          document_type: string
          download_attempted: boolean | null
          id: string
          ip_address: string
          landlord_id: string
          pages_viewed: number | null
          risk_score: number | null
          screenshots_detected: boolean | null
          session_id: string | null
          suspicious_behavior: string[] | null
          user_agent: string | null
          verification_id: string
        }
        Insert: {
          access_duration_seconds?: number | null
          access_type: string
          admin_id: string
          created_at?: string | null
          document_id: string
          document_type: string
          download_attempted?: boolean | null
          id?: string
          ip_address: string
          landlord_id: string
          pages_viewed?: number | null
          risk_score?: number | null
          screenshots_detected?: boolean | null
          session_id?: string | null
          suspicious_behavior?: string[] | null
          user_agent?: string | null
          verification_id: string
        }
        Update: {
          access_duration_seconds?: number | null
          access_type?: string
          admin_id?: string
          created_at?: string | null
          document_id?: string
          document_type?: string
          download_attempted?: boolean | null
          id?: string
          ip_address?: string
          landlord_id?: string
          pages_viewed?: number | null
          risk_score?: number | null
          screenshots_detected?: boolean | null
          session_id?: string | null
          suspicious_behavior?: string[] | null
          user_agent?: string | null
          verification_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "document_access_logs_admin_id_fkey"
            columns: ["admin_id"]
            isOneToOne: false
            referencedRelation: "admins"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "document_access_logs_document_id_fkey"
            columns: ["document_id"]
            isOneToOne: false
            referencedRelation: "verification_documents"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "document_access_logs_session_id_fkey"
            columns: ["session_id"]
            isOneToOne: false
            referencedRelation: "admin_sessions"
            referencedColumns: ["id"]
          },
        ]
      }
      housemate_likes: {
        Row: {
          client_id: string
          created_at: string
          id: string
          post_id: string
          user_id: string | null
        }
        Insert: {
          client_id: string
          created_at?: string
          id?: string
          post_id: string
          user_id?: string | null
        }
        Update: {
          client_id?: string
          created_at?: string
          id?: string
          post_id?: string
          user_id?: string | null
        }
        Relationships: []
      }
      housemate_messages: {
        Row: {
          created_at: string
          id: string
          message: string
          post_id: string
          sender_name: string | null
        }
        Insert: {
          created_at?: string
          id?: string
          message: string
          post_id: string
          sender_name?: string | null
        }
        Update: {
          created_at?: string
          id?: string
          message?: string
          post_id?: string
          sender_name?: string | null
        }
        Relationships: []
      }
      housemate_posts: {
        Row: {
          about: string | null
          author_id: string | null
          bedrooms: number
          budget_kes: number
          created_at: string | null
          id: string
          is_verified: boolean | null
          likes: number | null
          name: string
          post_type: string | null
          preferred_areas: string | null
          shares: number | null
          views: number | null
        }
        Insert: {
          about?: string | null
          author_id?: string | null
          bedrooms: number
          budget_kes: number
          created_at?: string | null
          id?: string
          is_verified?: boolean | null
          likes?: number | null
          name: string
          post_type?: string | null
          preferred_areas?: string | null
          shares?: number | null
          views?: number | null
        }
        Update: {
          about?: string | null
          author_id?: string | null
          bedrooms?: number
          budget_kes?: number
          created_at?: string | null
          id?: string
          is_verified?: boolean | null
          likes?: number | null
          name?: string
          post_type?: string | null
          preferred_areas?: string | null
          shares?: number | null
          views?: number | null
        }
        Relationships: []
      }
      housemate_saves: {
        Row: {
          client_id: string | null
          created_at: string | null
          id: string
          post_id: string
          user_id: string | null
        }
        Insert: {
          client_id?: string | null
          created_at?: string | null
          id?: string
          post_id: string
          user_id?: string | null
        }
        Update: {
          client_id?: string | null
          created_at?: string | null
          id?: string
          post_id?: string
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "housemate_saves_post_id_fkey"
            columns: ["post_id"]
            isOneToOne: false
            referencedRelation: "housemate_posts"
            referencedColumns: ["id"]
          },
        ]
      }
      housemate_shares: {
        Row: {
          client_id: string | null
          created_at: string | null
          id: string
          post_id: string
          user_id: string | null
        }
        Insert: {
          client_id?: string | null
          created_at?: string | null
          id?: string
          post_id: string
          user_id?: string | null
        }
        Update: {
          client_id?: string | null
          created_at?: string | null
          id?: string
          post_id?: string
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "housemate_shares_post_id_fkey"
            columns: ["post_id"]
            isOneToOne: false
            referencedRelation: "housemate_posts"
            referencedColumns: ["id"]
          },
        ]
      }
      housemate_views: {
        Row: {
          client_id: string | null
          created_at: string | null
          id: string
          post_id: string
          user_id: string | null
        }
        Insert: {
          client_id?: string | null
          created_at?: string | null
          id?: string
          post_id: string
          user_id?: string | null
        }
        Update: {
          client_id?: string | null
          created_at?: string | null
          id?: string
          post_id?: string
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "housemate_views_post_id_fkey"
            columns: ["post_id"]
            isOneToOne: false
            referencedRelation: "housemate_posts"
            referencedColumns: ["id"]
          },
        ]
      }
      landlord_verifications: {
        Row: {
          admin_notes: string | null
          background_check_completed: boolean | null
          created_at: string | null
          email_verified: boolean | null
          expires_at: string | null
          id: string
          identity_verified: boolean | null
          kyc_provider: string | null
          kyc_reference_id: string | null
          landlord_id: string
          phone_verified: boolean | null
          property_verified: boolean | null
          reference_verified: boolean | null
          rejection_reason: string | null
          reviewed_at: string | null
          reviewed_by: string | null
          status: Database["public"]["Enums"]["verification_status"] | null
          submitted_at: string | null
          trust_score: number | null
          updated_at: string | null
          verification_email: string | null
          verification_level:
            | Database["public"]["Enums"]["verification_level"]
            | null
          verification_phone: string | null
        }
        Insert: {
          admin_notes?: string | null
          background_check_completed?: boolean | null
          created_at?: string | null
          email_verified?: boolean | null
          expires_at?: string | null
          id?: string
          identity_verified?: boolean | null
          kyc_provider?: string | null
          kyc_reference_id?: string | null
          landlord_id: string
          phone_verified?: boolean | null
          property_verified?: boolean | null
          reference_verified?: boolean | null
          rejection_reason?: string | null
          reviewed_at?: string | null
          reviewed_by?: string | null
          status?: Database["public"]["Enums"]["verification_status"] | null
          submitted_at?: string | null
          trust_score?: number | null
          updated_at?: string | null
          verification_email?: string | null
          verification_level?:
            | Database["public"]["Enums"]["verification_level"]
            | null
          verification_phone?: string | null
        }
        Update: {
          admin_notes?: string | null
          background_check_completed?: boolean | null
          created_at?: string | null
          email_verified?: boolean | null
          expires_at?: string | null
          id?: string
          identity_verified?: boolean | null
          kyc_provider?: string | null
          kyc_reference_id?: string | null
          landlord_id?: string
          phone_verified?: boolean | null
          property_verified?: boolean | null
          reference_verified?: boolean | null
          rejection_reason?: string | null
          reviewed_at?: string | null
          reviewed_by?: string | null
          status?: Database["public"]["Enums"]["verification_status"] | null
          submitted_at?: string | null
          trust_score?: number | null
          updated_at?: string | null
          verification_email?: string | null
          verification_level?:
            | Database["public"]["Enums"]["verification_level"]
            | null
          verification_phone?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "landlord_verifications_landlord_id_fkey"
            columns: ["landlord_id"]
            isOneToOne: true
            referencedRelation: "landlords"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "landlord_verifications_reviewed_by_fkey"
            columns: ["reviewed_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      landlords: {
        Row: {
          avatar_url: string | null
          bio: string | null
          company_name: string | null
          created_at: string
          email: string | null
          full_name: string
          id: string
          is_verified: boolean | null
          phone_e164: string | null
          trust_score: number | null
          updated_at: string | null
          verification_status: string | null
          verified: boolean
        }
        Insert: {
          avatar_url?: string | null
          bio?: string | null
          company_name?: string | null
          created_at?: string
          email?: string | null
          full_name: string
          id?: string
          is_verified?: boolean | null
          phone_e164?: string | null
          trust_score?: number | null
          updated_at?: string | null
          verification_status?: string | null
          verified?: boolean
        }
        Update: {
          avatar_url?: string | null
          bio?: string | null
          company_name?: string | null
          created_at?: string
          email?: string | null
          full_name?: string
          id?: string
          is_verified?: boolean | null
          phone_e164?: string | null
          trust_score?: number | null
          updated_at?: string | null
          verification_status?: string | null
          verified?: boolean
        }
        Relationships: [
          {
            foreignKeyName: "landlords_id_fkey"
            columns: ["id"]
            isOneToOne: true
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      listing_comment_likes: {
        Row: {
          comment_id: string
          created_at: string | null
          id: string
          user_id: string
        }
        Insert: {
          comment_id: string
          created_at?: string | null
          id?: string
          user_id: string
        }
        Update: {
          comment_id?: string
          created_at?: string | null
          id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "listing_comment_likes_comment_id_fkey"
            columns: ["comment_id"]
            isOneToOne: false
            referencedRelation: "listing_comments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "listing_comment_likes_comment_id_fkey"
            columns: ["comment_id"]
            isOneToOne: false
            referencedRelation: "listing_comments_with_stats"
            referencedColumns: ["id"]
          },
        ]
      }
      listing_comments: {
        Row: {
          content: string
          created_at: string | null
          deleted_at: string | null
          id: string
          listing_id: string
          parent_comment_id: string | null
          updated_at: string | null
          user_id: string
        }
        Insert: {
          content: string
          created_at?: string | null
          deleted_at?: string | null
          id?: string
          listing_id: string
          parent_comment_id?: string | null
          updated_at?: string | null
          user_id: string
        }
        Update: {
          content?: string
          created_at?: string | null
          deleted_at?: string | null
          id?: string
          listing_id?: string
          parent_comment_id?: string | null
          updated_at?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "listing_comments_listing_id_fkey"
            columns: ["listing_id"]
            isOneToOne: false
            referencedRelation: "properties"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "listing_comments_parent_comment_id_fkey"
            columns: ["parent_comment_id"]
            isOneToOne: false
            referencedRelation: "listing_comments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "listing_comments_parent_comment_id_fkey"
            columns: ["parent_comment_id"]
            isOneToOne: false
            referencedRelation: "listing_comments_with_stats"
            referencedColumns: ["id"]
          },
        ]
      }
      listing_likes: {
        Row: {
          created_at: string | null
          id: string
          listing_id: string
          user_id: string
        }
        Insert: {
          created_at?: string | null
          id?: string
          listing_id: string
          user_id: string
        }
        Update: {
          created_at?: string | null
          id?: string
          listing_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "listing_likes_listing_id_fkey"
            columns: ["listing_id"]
            isOneToOne: false
            referencedRelation: "properties"
            referencedColumns: ["id"]
          },
        ]
      }
      listing_shares: {
        Row: {
          created_at: string | null
          id: string
          listing_id: string
          share_platform: string | null
          user_id: string
        }
        Insert: {
          created_at?: string | null
          id?: string
          listing_id: string
          share_platform?: string | null
          user_id: string
        }
        Update: {
          created_at?: string | null
          id?: string
          listing_id?: string
          share_platform?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "listing_shares_listing_id_fkey"
            columns: ["listing_id"]
            isOneToOne: false
            referencedRelation: "properties"
            referencedColumns: ["id"]
          },
        ]
      }
      newsletter_subscribers: {
        Row: {
          brevo_contact_id: string | null
          created_at: string | null
          email: string
          id: string
          source_page: string | null
          subscribed_at: string | null
        }
        Insert: {
          brevo_contact_id?: string | null
          created_at?: string | null
          email: string
          id?: string
          source_page?: string | null
          subscribed_at?: string | null
        }
        Update: {
          brevo_contact_id?: string | null
          created_at?: string | null
          email?: string
          id?: string
          source_page?: string | null
          subscribed_at?: string | null
        }
        Relationships: []
      }
      newsletter_subscriptions: {
        Row: {
          email: string
          id: string
          is_subscribed: boolean | null
          preferences: Json | null
          subscribed_at: string | null
          unsubscribed_at: string | null
          user_id: string | null
        }
        Insert: {
          email: string
          id?: string
          is_subscribed?: boolean | null
          preferences?: Json | null
          subscribed_at?: string | null
          unsubscribed_at?: string | null
          user_id?: string | null
        }
        Update: {
          email?: string
          id?: string
          is_subscribed?: boolean | null
          preferences?: Json | null
          subscribed_at?: string | null
          unsubscribed_at?: string | null
          user_id?: string | null
        }
        Relationships: []
      }
      notification_preferences: {
        Row: {
          created_at: string | null
          frequency: string | null
          id: string
          inquiry_response_enabled: boolean | null
          message_enabled: boolean | null
          price_drop_enabled: boolean | null
          property_match_enabled: boolean | null
          quiet_hours_end: string | null
          quiet_hours_start: string | null
          review_enabled: boolean | null
          sound_enabled: boolean | null
          system_enabled: boolean | null
          updated_at: string | null
          user_id: string
          verification_status_enabled: boolean | null
        }
        Insert: {
          created_at?: string | null
          frequency?: string | null
          id?: string
          inquiry_response_enabled?: boolean | null
          message_enabled?: boolean | null
          price_drop_enabled?: boolean | null
          property_match_enabled?: boolean | null
          quiet_hours_end?: string | null
          quiet_hours_start?: string | null
          review_enabled?: boolean | null
          sound_enabled?: boolean | null
          system_enabled?: boolean | null
          updated_at?: string | null
          user_id: string
          verification_status_enabled?: boolean | null
        }
        Update: {
          created_at?: string | null
          frequency?: string | null
          id?: string
          inquiry_response_enabled?: boolean | null
          message_enabled?: boolean | null
          price_drop_enabled?: boolean | null
          property_match_enabled?: boolean | null
          quiet_hours_end?: string | null
          quiet_hours_start?: string | null
          review_enabled?: boolean | null
          sound_enabled?: boolean | null
          system_enabled?: boolean | null
          updated_at?: string | null
          user_id?: string
          verification_status_enabled?: boolean | null
        }
        Relationships: []
      }
      notification_subscriptions: {
        Row: {
          auth: string
          created_at: string | null
          endpoint: string
          id: string
          p256dh: string
          updated_at: string | null
          user_agent: string | null
          user_id: string
        }
        Insert: {
          auth: string
          created_at?: string | null
          endpoint: string
          id?: string
          p256dh: string
          updated_at?: string | null
          user_agent?: string | null
          user_id: string
        }
        Update: {
          auth?: string
          created_at?: string | null
          endpoint?: string
          id?: string
          p256dh?: string
          updated_at?: string | null
          user_agent?: string | null
          user_id?: string
        }
        Relationships: []
      }
      notifications: {
        Row: {
          created_at: string | null
          data: Json | null
          id: string
          message: string
          read: boolean | null
          title: string
          type: string
          updated_at: string | null
          user_id: string
        }
        Insert: {
          created_at?: string | null
          data?: Json | null
          id?: string
          message: string
          read?: boolean | null
          title: string
          type: string
          updated_at?: string | null
          user_id: string
        }
        Update: {
          created_at?: string | null
          data?: Json | null
          id?: string
          message?: string
          read?: boolean | null
          title?: string
          type?: string
          updated_at?: string | null
          user_id?: string
        }
        Relationships: []
      }
      payments: {
        Row: {
          amount_kes: number
          id: string
          initiated_at: string
          property_id: string
          provider_ref: string | null
          status: Database["public"]["Enums"]["payment_status"]
        }
        Insert: {
          amount_kes: number
          id?: string
          initiated_at?: string
          property_id: string
          provider_ref?: string | null
          status?: Database["public"]["Enums"]["payment_status"]
        }
        Update: {
          amount_kes?: number
          id?: string
          initiated_at?: string
          property_id?: string
          provider_ref?: string | null
          status?: Database["public"]["Enums"]["payment_status"]
        }
        Relationships: [
          {
            foreignKeyName: "payments_property_id_fkey"
            columns: ["property_id"]
            isOneToOne: false
            referencedRelation: "properties"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          avatar_url: string | null
          bio: string | null
          company_name: string | null
          created_at: string
          date_of_birth: string | null
          display_name: string | null
          email: string | null
          full_name: string | null
          gender: string | null
          id: string
          is_verified: boolean | null
          location: string | null
          phone_e164: string | null
          preferred_language: string | null
          role: string | null
          timezone: string | null
          updated_at: string | null
          website: string | null
        }
        Insert: {
          avatar_url?: string | null
          bio?: string | null
          company_name?: string | null
          created_at?: string
          date_of_birth?: string | null
          display_name?: string | null
          email?: string | null
          full_name?: string | null
          gender?: string | null
          id: string
          is_verified?: boolean | null
          location?: string | null
          phone_e164?: string | null
          preferred_language?: string | null
          role?: string | null
          timezone?: string | null
          updated_at?: string | null
          website?: string | null
        }
        Update: {
          avatar_url?: string | null
          bio?: string | null
          company_name?: string | null
          created_at?: string
          date_of_birth?: string | null
          display_name?: string | null
          email?: string | null
          full_name?: string | null
          gender?: string | null
          id?: string
          is_verified?: boolean | null
          location?: string | null
          phone_e164?: string | null
          preferred_language?: string | null
          role?: string | null
          timezone?: string | null
          updated_at?: string | null
          website?: string | null
        }
        Relationships: []
      }
      properties: {
        Row: {
          additional_fees: Json | null
          agent_commission: number | null
          amenities_json: Json | null
          application_requirements: string[] | null
          approval_status: string | null
          available_from: string | null
          bathrooms: number | null
          bedrooms: number
          cancellation_policy: string | null
          check_in_time: string | null
          check_out_time: string | null
          contact_preferences: Json | null
          county: string | null
          created_at: string
          deposit_amount: number | null
          description: string | null
          emergency_contact: string | null
          expires_at: string | null
          featured: boolean
          featured_until: string | null
          features_json: Json | null
          flagged_count: number | null
          furnishing_type: string | null
          house_rules: string | null
          id: string
          images_json: Json | null
          inquiries_count: number | null
          inquiries_this_week: number | null
          instant_booking: boolean | null
          is_active: boolean
          is_negotiable: boolean | null
          landlord_id: string
          lat: number | null
          lease_duration_months: number | null
          listing_type: string
          lng: number | null
          location_name: string | null
          maintenance_fee: number | null
          max_stay_nights: number | null
          meta_description: string | null
          min_stay_nights: number | null
          minimum_lease_duration: number | null
          moderated_at: string | null
          moderated_by: string | null
          moderation_notes: string | null
          parking_spaces: number | null
          parking_type: string | null
          pet_policy: string | null
          price_kes: number
          price_per_night: number | null
          promotion_settings: Json | null
          property_status: string | null
          property_type: string | null
          rejection_reason: string | null
          response_time_hours: number | null
          saves_count: number | null
          saves_this_week: number | null
          seo_keywords: string[] | null
          social_share_text: string | null
          square_footage: number | null
          title: string
          updated_at: string | null
          utilities_included: string[] | null
          video_url: string | null
          viewing_instructions: string | null
          viewing_schedule: string | null
          views_count: number | null
          views_today: number | null
          year_built: number | null
        }
        Insert: {
          additional_fees?: Json | null
          agent_commission?: number | null
          amenities_json?: Json | null
          application_requirements?: string[] | null
          approval_status?: string | null
          available_from?: string | null
          bathrooms?: number | null
          bedrooms: number
          cancellation_policy?: string | null
          check_in_time?: string | null
          check_out_time?: string | null
          contact_preferences?: Json | null
          county?: string | null
          created_at?: string
          deposit_amount?: number | null
          description?: string | null
          emergency_contact?: string | null
          expires_at?: string | null
          featured?: boolean
          featured_until?: string | null
          features_json?: Json | null
          flagged_count?: number | null
          furnishing_type?: string | null
          house_rules?: string | null
          id?: string
          images_json?: Json | null
          inquiries_count?: number | null
          inquiries_this_week?: number | null
          instant_booking?: boolean | null
          is_active?: boolean
          is_negotiable?: boolean | null
          landlord_id: string
          lat?: number | null
          lease_duration_months?: number | null
          listing_type?: string
          lng?: number | null
          location_name?: string | null
          maintenance_fee?: number | null
          max_stay_nights?: number | null
          meta_description?: string | null
          min_stay_nights?: number | null
          minimum_lease_duration?: number | null
          moderated_at?: string | null
          moderated_by?: string | null
          moderation_notes?: string | null
          parking_spaces?: number | null
          parking_type?: string | null
          pet_policy?: string | null
          price_kes: number
          price_per_night?: number | null
          promotion_settings?: Json | null
          property_status?: string | null
          property_type?: string | null
          rejection_reason?: string | null
          response_time_hours?: number | null
          saves_count?: number | null
          saves_this_week?: number | null
          seo_keywords?: string[] | null
          social_share_text?: string | null
          square_footage?: number | null
          title: string
          updated_at?: string | null
          utilities_included?: string[] | null
          video_url?: string | null
          viewing_instructions?: string | null
          viewing_schedule?: string | null
          views_count?: number | null
          views_today?: number | null
          year_built?: number | null
        }
        Update: {
          additional_fees?: Json | null
          agent_commission?: number | null
          amenities_json?: Json | null
          application_requirements?: string[] | null
          approval_status?: string | null
          available_from?: string | null
          bathrooms?: number | null
          bedrooms?: number
          cancellation_policy?: string | null
          check_in_time?: string | null
          check_out_time?: string | null
          contact_preferences?: Json | null
          county?: string | null
          created_at?: string
          deposit_amount?: number | null
          description?: string | null
          emergency_contact?: string | null
          expires_at?: string | null
          featured?: boolean
          featured_until?: string | null
          features_json?: Json | null
          flagged_count?: number | null
          furnishing_type?: string | null
          house_rules?: string | null
          id?: string
          images_json?: Json | null
          inquiries_count?: number | null
          inquiries_this_week?: number | null
          instant_booking?: boolean | null
          is_active?: boolean
          is_negotiable?: boolean | null
          landlord_id?: string
          lat?: number | null
          lease_duration_months?: number | null
          listing_type?: string
          lng?: number | null
          location_name?: string | null
          maintenance_fee?: number | null
          max_stay_nights?: number | null
          meta_description?: string | null
          min_stay_nights?: number | null
          minimum_lease_duration?: number | null
          moderated_at?: string | null
          moderated_by?: string | null
          moderation_notes?: string | null
          parking_spaces?: number | null
          parking_type?: string | null
          pet_policy?: string | null
          price_kes?: number
          price_per_night?: number | null
          promotion_settings?: Json | null
          property_status?: string | null
          property_type?: string | null
          rejection_reason?: string | null
          response_time_hours?: number | null
          saves_count?: number | null
          saves_this_week?: number | null
          seo_keywords?: string[] | null
          social_share_text?: string | null
          square_footage?: number | null
          title?: string
          updated_at?: string | null
          utilities_included?: string[] | null
          video_url?: string | null
          viewing_instructions?: string | null
          viewing_schedule?: string | null
          views_count?: number | null
          views_today?: number | null
          year_built?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "properties_landlord_id_fkey"
            columns: ["landlord_id"]
            isOneToOne: false
            referencedRelation: "landlords"
            referencedColumns: ["id"]
          },
        ]
      }
      property_flags: {
        Row: {
          admin_id: string | null
          created_at: string | null
          description: string | null
          flagged_by: string | null
          id: string
          property_id: string
          resolution_notes: string | null
          resolved_at: string | null
          resolved_by: string | null
          status: string | null
          updated_at: string | null
          violation_type: string
        }
        Insert: {
          admin_id?: string | null
          created_at?: string | null
          description?: string | null
          flagged_by?: string | null
          id?: string
          property_id: string
          resolution_notes?: string | null
          resolved_at?: string | null
          resolved_by?: string | null
          status?: string | null
          updated_at?: string | null
          violation_type: string
        }
        Update: {
          admin_id?: string | null
          created_at?: string | null
          description?: string | null
          flagged_by?: string | null
          id?: string
          property_id?: string
          resolution_notes?: string | null
          resolved_at?: string | null
          resolved_by?: string | null
          status?: string | null
          updated_at?: string | null
          violation_type?: string
        }
        Relationships: [
          {
            foreignKeyName: "property_flags_property_id_fkey"
            columns: ["property_id"]
            isOneToOne: false
            referencedRelation: "properties"
            referencedColumns: ["id"]
          },
        ]
      }
      property_images: {
        Row: {
          id: string
          image_url: string
          property_id: string
          sort_order: number
        }
        Insert: {
          id?: string
          image_url: string
          property_id: string
          sort_order?: number
        }
        Update: {
          id?: string
          image_url?: string
          property_id?: string
          sort_order?: number
        }
        Relationships: [
          {
            foreignKeyName: "property_images_property_id_fkey"
            columns: ["property_id"]
            isOneToOne: false
            referencedRelation: "properties"
            referencedColumns: ["id"]
          },
        ]
      }
      property_inquiries: {
        Row: {
          contact_info: Json | null
          created_at: string | null
          id: string
          inquiry_type: string | null
          landlord_id: string
          message: string | null
          property_id: string
          user_id: string | null
        }
        Insert: {
          contact_info?: Json | null
          created_at?: string | null
          id?: string
          inquiry_type?: string | null
          landlord_id: string
          message?: string | null
          property_id: string
          user_id?: string | null
        }
        Update: {
          contact_info?: Json | null
          created_at?: string | null
          id?: string
          inquiry_type?: string | null
          landlord_id?: string
          message?: string | null
          property_id?: string
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "property_inquiries_property_id_fkey"
            columns: ["property_id"]
            isOneToOne: false
            referencedRelation: "properties"
            referencedColumns: ["id"]
          },
        ]
      }
      property_moderation_actions: {
        Row: {
          action_type: string
          admin_id: string
          created_at: string | null
          id: string
          metadata: Json | null
          notes: string | null
          property_id: string
        }
        Insert: {
          action_type: string
          admin_id: string
          created_at?: string | null
          id?: string
          metadata?: Json | null
          notes?: string | null
          property_id: string
        }
        Update: {
          action_type?: string
          admin_id?: string
          created_at?: string | null
          id?: string
          metadata?: Json | null
          notes?: string | null
          property_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "property_moderation_actions_property_id_fkey"
            columns: ["property_id"]
            isOneToOne: false
            referencedRelation: "properties"
            referencedColumns: ["id"]
          },
        ]
      }
      property_saves: {
        Row: {
          id: string
          property_id: string
          saved_at: string
          user_id: string | null
        }
        Insert: {
          id?: string
          property_id: string
          saved_at?: string
          user_id?: string | null
        }
        Update: {
          id?: string
          property_id?: string
          saved_at?: string
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "property_saves_property_id_fkey"
            columns: ["property_id"]
            isOneToOne: false
            referencedRelation: "properties"
            referencedColumns: ["id"]
          },
        ]
      }
      property_views: {
        Row: {
          day: string
          id: string
          ip_address: unknown
          is_unique: boolean | null
          property_id: string
          referrer: string | null
          session_id: string | null
          user_agent: string | null
          user_id: string | null
          view_duration: number | null
          viewed_at: string
          viewer_ip_hash: string | null
        }
        Insert: {
          day?: string
          id?: string
          ip_address?: unknown
          is_unique?: boolean | null
          property_id: string
          referrer?: string | null
          session_id?: string | null
          user_agent?: string | null
          user_id?: string | null
          view_duration?: number | null
          viewed_at?: string
          viewer_ip_hash?: string | null
        }
        Update: {
          day?: string
          id?: string
          ip_address?: unknown
          is_unique?: boolean | null
          property_id?: string
          referrer?: string | null
          session_id?: string | null
          user_agent?: string | null
          user_id?: string | null
          view_duration?: number | null
          viewed_at?: string
          viewer_ip_hash?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "property_views_property_id_fkey"
            columns: ["property_id"]
            isOneToOne: false
            referencedRelation: "properties"
            referencedColumns: ["id"]
          },
        ]
      }
      referral_credits: {
        Row: {
          used_count: number
          user_email: string
        }
        Insert: {
          used_count?: number
          user_email: string
        }
        Update: {
          used_count?: number
          user_email?: string
        }
        Relationships: []
      }
      referrals: {
        Row: {
          created_at: string | null
          id: string
          referred_email: string
          referrer_email: string | null
          status: string
        }
        Insert: {
          created_at?: string | null
          id?: string
          referred_email: string
          referrer_email?: string | null
          status?: string
        }
        Update: {
          created_at?: string | null
          id?: string
          referred_email?: string
          referrer_email?: string | null
          status?: string
        }
        Relationships: []
      }
      review_helpful: {
        Row: {
          created_at: string | null
          id: string
          review_id: string
          user_id: string
        }
        Insert: {
          created_at?: string | null
          id?: string
          review_id: string
          user_id: string
        }
        Update: {
          created_at?: string | null
          id?: string
          review_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "review_helpful_review_id_fkey"
            columns: ["review_id"]
            isOneToOne: false
            referencedRelation: "reviews"
            referencedColumns: ["id"]
          },
        ]
      }
      reviews: {
        Row: {
          comment: string
          created_at: string | null
          helpful_count: number | null
          id: string
          images: Json | null
          landlord_id: string | null
          landlord_response: string | null
          landlord_response_at: string | null
          property_id: string
          rating: number
          title: string
          updated_at: string | null
          user_id: string
          verified: boolean | null
        }
        Insert: {
          comment: string
          created_at?: string | null
          helpful_count?: number | null
          id?: string
          images?: Json | null
          landlord_id?: string | null
          landlord_response?: string | null
          landlord_response_at?: string | null
          property_id: string
          rating: number
          title: string
          updated_at?: string | null
          user_id: string
          verified?: boolean | null
        }
        Update: {
          comment?: string
          created_at?: string | null
          helpful_count?: number | null
          id?: string
          images?: Json | null
          landlord_id?: string | null
          landlord_response?: string | null
          landlord_response_at?: string | null
          property_id?: string
          rating?: number
          title?: string
          updated_at?: string | null
          user_id?: string
          verified?: boolean | null
        }
        Relationships: [
          {
            foreignKeyName: "reviews_landlord_id_fkey"
            columns: ["landlord_id"]
            isOneToOne: false
            referencedRelation: "landlords"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "reviews_property_id_fkey"
            columns: ["property_id"]
            isOneToOne: false
            referencedRelation: "properties"
            referencedColumns: ["id"]
          },
        ]
      }
      saved_commutes: {
        Row: {
          created_at: string | null
          id: string
          label: string
          max_mins: number
          target: string
          user_email: string | null
        }
        Insert: {
          created_at?: string | null
          id?: string
          label: string
          max_mins: number
          target?: string
          user_email?: string | null
        }
        Update: {
          created_at?: string | null
          id?: string
          label?: string
          max_mins?: number
          target?: string
          user_email?: string | null
        }
        Relationships: []
      }
      saved_searches: {
        Row: {
          created_at: string
          criteria: Json | null
          email: string | null
          email_opt_in: boolean
          filters: Json
          id: string
          name: string | null
          user_id: string | null
        }
        Insert: {
          created_at?: string
          criteria?: Json | null
          email?: string | null
          email_opt_in?: boolean
          filters: Json
          id?: string
          name?: string | null
          user_id?: string | null
        }
        Update: {
          created_at?: string
          criteria?: Json | null
          email?: string | null
          email_opt_in?: boolean
          filters?: Json
          id?: string
          name?: string | null
          user_id?: string | null
        }
        Relationships: []
      }
      search_history: {
        Row: {
          created_at: string | null
          criteria: Json
          id: string
          results_count: number
          user_id: string
        }
        Insert: {
          created_at?: string | null
          criteria: Json
          id?: string
          results_count?: number
          user_id: string
        }
        Update: {
          created_at?: string | null
          criteria?: Json
          id?: string
          results_count?: number
          user_id?: string
        }
        Relationships: []
      }
      security_events: {
        Row: {
          admin_id: string | null
          affected_resources: string[] | null
          auto_response: Json | null
          created_at: string | null
          description: string
          device_fingerprint: string | null
          event_type: Database["public"]["Enums"]["security_event_type"]
          id: string
          ip_address: string | null
          location: string | null
          metadata: Json | null
          requires_review: boolean | null
          review_notes: string | null
          reviewed_at: string | null
          reviewed_by: string | null
          risk_indicators: string[] | null
          severity: string
          user_agent: string | null
        }
        Insert: {
          admin_id?: string | null
          affected_resources?: string[] | null
          auto_response?: Json | null
          created_at?: string | null
          description: string
          device_fingerprint?: string | null
          event_type: Database["public"]["Enums"]["security_event_type"]
          id?: string
          ip_address?: string | null
          location?: string | null
          metadata?: Json | null
          requires_review?: boolean | null
          review_notes?: string | null
          reviewed_at?: string | null
          reviewed_by?: string | null
          risk_indicators?: string[] | null
          severity: string
          user_agent?: string | null
        }
        Update: {
          admin_id?: string | null
          affected_resources?: string[] | null
          auto_response?: Json | null
          created_at?: string | null
          description?: string
          device_fingerprint?: string | null
          event_type?: Database["public"]["Enums"]["security_event_type"]
          id?: string
          ip_address?: string | null
          location?: string | null
          metadata?: Json | null
          requires_review?: boolean | null
          review_notes?: string | null
          reviewed_at?: string | null
          reviewed_by?: string | null
          risk_indicators?: string[] | null
          severity?: string
          user_agent?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "security_events_admin_id_fkey"
            columns: ["admin_id"]
            isOneToOne: false
            referencedRelation: "admins"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "security_events_reviewed_by_fkey"
            columns: ["reviewed_by"]
            isOneToOne: false
            referencedRelation: "admins"
            referencedColumns: ["id"]
          },
        ]
      }
      security_policies: {
        Row: {
          approved_by: string | null
          auto_enforce: boolean | null
          conditions: Json | null
          created_at: string | null
          created_by: string
          description: string
          exceptions: Json | null
          id: string
          is_active: boolean | null
          last_reviewed_at: string | null
          next_review_due: string | null
          policy_name: string
          policy_type: string
          rules: Json
          severity: string
          updated_at: string | null
        }
        Insert: {
          approved_by?: string | null
          auto_enforce?: boolean | null
          conditions?: Json | null
          created_at?: string | null
          created_by: string
          description: string
          exceptions?: Json | null
          id?: string
          is_active?: boolean | null
          last_reviewed_at?: string | null
          next_review_due?: string | null
          policy_name: string
          policy_type: string
          rules: Json
          severity: string
          updated_at?: string | null
        }
        Update: {
          approved_by?: string | null
          auto_enforce?: boolean | null
          conditions?: Json | null
          created_at?: string | null
          created_by?: string
          description?: string
          exceptions?: Json | null
          id?: string
          is_active?: boolean | null
          last_reviewed_at?: string | null
          next_review_due?: string | null
          policy_name?: string
          policy_type?: string
          rules?: Json
          severity?: string
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "security_policies_approved_by_fkey"
            columns: ["approved_by"]
            isOneToOne: false
            referencedRelation: "admins"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "security_policies_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "admins"
            referencedColumns: ["id"]
          },
        ]
      }
      social_comments: {
        Row: {
          content: string
          created_at: string | null
          deleted_at: string | null
          id: string
          media_urls: string[] | null
          parent_comment_id: string | null
          post_id: string
          updated_at: string | null
          user_id: string
        }
        Insert: {
          content: string
          created_at?: string | null
          deleted_at?: string | null
          id?: string
          media_urls?: string[] | null
          parent_comment_id?: string | null
          post_id: string
          updated_at?: string | null
          user_id: string
        }
        Update: {
          content?: string
          created_at?: string | null
          deleted_at?: string | null
          id?: string
          media_urls?: string[] | null
          parent_comment_id?: string | null
          post_id?: string
          updated_at?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "social_comments_parent_comment_id_fkey"
            columns: ["parent_comment_id"]
            isOneToOne: false
            referencedRelation: "social_comments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "social_comments_post_id_fkey"
            columns: ["post_id"]
            isOneToOne: false
            referencedRelation: "social_posts"
            referencedColumns: ["id"]
          },
        ]
      }
      social_conversations: {
        Row: {
          archived_by: Json | null
          created_at: string | null
          id: string
          is_muted: boolean | null
          last_message_content: string | null
          last_message_created_at: string | null
          last_message_id: string | null
          last_message_sender_id: string | null
          last_message_sender_name: string | null
          last_message_type: string | null
          last_read_at: string | null
          participant_avatar_url: string | null
          participant_id: string
          participant_is_online: boolean | null
          participant_last_seen: string | null
          participant_name: string
          pinned_by: Json | null
          thread_id: string
          unread_count: number | null
          updated_at: string | null
          user_id: string
        }
        Insert: {
          archived_by?: Json | null
          created_at?: string | null
          id?: string
          is_muted?: boolean | null
          last_message_content?: string | null
          last_message_created_at?: string | null
          last_message_id?: string | null
          last_message_sender_id?: string | null
          last_message_sender_name?: string | null
          last_message_type?: string | null
          last_read_at?: string | null
          participant_avatar_url?: string | null
          participant_id: string
          participant_is_online?: boolean | null
          participant_last_seen?: string | null
          participant_name: string
          pinned_by?: Json | null
          thread_id: string
          unread_count?: number | null
          updated_at?: string | null
          user_id: string
        }
        Update: {
          archived_by?: Json | null
          created_at?: string | null
          id?: string
          is_muted?: boolean | null
          last_message_content?: string | null
          last_message_created_at?: string | null
          last_message_id?: string | null
          last_message_sender_id?: string | null
          last_message_sender_name?: string | null
          last_message_type?: string | null
          last_read_at?: string | null
          participant_avatar_url?: string | null
          participant_id?: string
          participant_is_online?: boolean | null
          participant_last_seen?: string | null
          participant_name?: string
          pinned_by?: Json | null
          thread_id?: string
          unread_count?: number | null
          updated_at?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "social_conversations_last_message_id_fkey"
            columns: ["last_message_id"]
            isOneToOne: false
            referencedRelation: "social_messages"
            referencedColumns: ["id"]
          },
        ]
      }
      social_follows: {
        Row: {
          created_at: string | null
          follower_id: string
          following_id: string
          id: string
        }
        Insert: {
          created_at?: string | null
          follower_id: string
          following_id: string
          id?: string
        }
        Update: {
          created_at?: string | null
          follower_id?: string
          following_id?: string
          id?: string
        }
        Relationships: []
      }
      social_message_participants: {
        Row: {
          id: string
          joined_at: string | null
          left_at: string | null
          thread_id: string
          user_id: string
        }
        Insert: {
          id?: string
          joined_at?: string | null
          left_at?: string | null
          thread_id: string
          user_id: string
        }
        Update: {
          id?: string
          joined_at?: string | null
          left_at?: string | null
          thread_id?: string
          user_id?: string
        }
        Relationships: []
      }
      social_message_reactions: {
        Row: {
          created_at: string | null
          id: string
          message_id: string
          reaction_type: string
          updated_at: string | null
          user_id: string
        }
        Insert: {
          created_at?: string | null
          id?: string
          message_id: string
          reaction_type?: string
          updated_at?: string | null
          user_id: string
        }
        Update: {
          created_at?: string | null
          id?: string
          message_id?: string
          reaction_type?: string
          updated_at?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "social_message_reactions_message_id_fkey"
            columns: ["message_id"]
            isOneToOne: false
            referencedRelation: "social_messages"
            referencedColumns: ["id"]
          },
        ]
      }
      social_messages: {
        Row: {
          content: string
          created_at: string | null
          deleted_at: string | null
          deleted_for_recipient: boolean | null
          deleted_for_sender: boolean | null
          delivered_at: string | null
          id: string
          is_delivered: boolean | null
          is_read: boolean | null
          media_urls: string[] | null
          message_type: Database["public"]["Enums"]["message_type"] | null
          read_at: string | null
          recipient_id: string | null
          sender_id: string
          thread_id: string
          updated_at: string | null
        }
        Insert: {
          content: string
          created_at?: string | null
          deleted_at?: string | null
          deleted_for_recipient?: boolean | null
          deleted_for_sender?: boolean | null
          delivered_at?: string | null
          id?: string
          is_delivered?: boolean | null
          is_read?: boolean | null
          media_urls?: string[] | null
          message_type?: Database["public"]["Enums"]["message_type"] | null
          read_at?: string | null
          recipient_id?: string | null
          sender_id: string
          thread_id: string
          updated_at?: string | null
        }
        Update: {
          content?: string
          created_at?: string | null
          deleted_at?: string | null
          deleted_for_recipient?: boolean | null
          deleted_for_sender?: boolean | null
          delivered_at?: string | null
          id?: string
          is_delivered?: boolean | null
          is_read?: boolean | null
          media_urls?: string[] | null
          message_type?: Database["public"]["Enums"]["message_type"] | null
          read_at?: string | null
          recipient_id?: string | null
          sender_id?: string
          thread_id?: string
          updated_at?: string | null
        }
        Relationships: []
      }
      social_notifications: {
        Row: {
          created_at: string | null
          from_user_id: string | null
          id: string
          is_read: boolean | null
          message: string | null
          source_id: string | null
          type: Database["public"]["Enums"]["notification_type"]
          user_id: string
        }
        Insert: {
          created_at?: string | null
          from_user_id?: string | null
          id?: string
          is_read?: boolean | null
          message?: string | null
          source_id?: string | null
          type: Database["public"]["Enums"]["notification_type"]
          user_id: string
        }
        Update: {
          created_at?: string | null
          from_user_id?: string | null
          id?: string
          is_read?: boolean | null
          message?: string | null
          source_id?: string | null
          type?: Database["public"]["Enums"]["notification_type"]
          user_id?: string
        }
        Relationships: []
      }
      social_posts: {
        Row: {
          content: string
          created_at: string | null
          deleted_at: string | null
          id: string
          is_pinned: boolean | null
          is_public: boolean | null
          location: Json | null
          media_urls: string[] | null
          mentions: string[] | null
          post_type: Database["public"]["Enums"]["post_type"] | null
          property_id: string | null
          tags: string[] | null
          updated_at: string | null
          user_id: string
        }
        Insert: {
          content: string
          created_at?: string | null
          deleted_at?: string | null
          id?: string
          is_pinned?: boolean | null
          is_public?: boolean | null
          location?: Json | null
          media_urls?: string[] | null
          mentions?: string[] | null
          post_type?: Database["public"]["Enums"]["post_type"] | null
          property_id?: string | null
          tags?: string[] | null
          updated_at?: string | null
          user_id: string
        }
        Update: {
          content?: string
          created_at?: string | null
          deleted_at?: string | null
          id?: string
          is_pinned?: boolean | null
          is_public?: boolean | null
          location?: Json | null
          media_urls?: string[] | null
          mentions?: string[] | null
          post_type?: Database["public"]["Enums"]["post_type"] | null
          property_id?: string | null
          tags?: string[] | null
          updated_at?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "social_posts_property_id_fkey"
            columns: ["property_id"]
            isOneToOne: false
            referencedRelation: "properties"
            referencedColumns: ["id"]
          },
        ]
      }
      social_reactions: {
        Row: {
          comment_id: string | null
          created_at: string | null
          id: string
          post_id: string | null
          reaction_type: Database["public"]["Enums"]["reaction_type"]
          user_id: string
        }
        Insert: {
          comment_id?: string | null
          created_at?: string | null
          id?: string
          post_id?: string | null
          reaction_type: Database["public"]["Enums"]["reaction_type"]
          user_id: string
        }
        Update: {
          comment_id?: string | null
          created_at?: string | null
          id?: string
          post_id?: string | null
          reaction_type?: Database["public"]["Enums"]["reaction_type"]
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "social_reactions_comment_id_fkey"
            columns: ["comment_id"]
            isOneToOne: false
            referencedRelation: "social_comments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "social_reactions_post_id_fkey"
            columns: ["post_id"]
            isOneToOne: false
            referencedRelation: "social_posts"
            referencedColumns: ["id"]
          },
        ]
      }
      social_saves: {
        Row: {
          created_at: string | null
          id: string
          post_id: string
          user_id: string
        }
        Insert: {
          created_at?: string | null
          id?: string
          post_id: string
          user_id: string
        }
        Update: {
          created_at?: string | null
          id?: string
          post_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "social_saves_post_id_fkey"
            columns: ["post_id"]
            isOneToOne: false
            referencedRelation: "social_posts"
            referencedColumns: ["id"]
          },
        ]
      }
      social_shares: {
        Row: {
          created_at: string | null
          id: string
          post_id: string
          user_id: string
        }
        Insert: {
          created_at?: string | null
          id?: string
          post_id: string
          user_id: string
        }
        Update: {
          created_at?: string | null
          id?: string
          post_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "social_shares_post_id_fkey"
            columns: ["post_id"]
            isOneToOne: false
            referencedRelation: "social_posts"
            referencedColumns: ["id"]
          },
        ]
      }
      social_typing_indicators: {
        Row: {
          created_at: string | null
          id: string
          thread_id: string
          user_id: string
        }
        Insert: {
          created_at?: string | null
          id?: string
          thread_id: string
          user_id: string
        }
        Update: {
          created_at?: string | null
          id?: string
          thread_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "social_typing_indicators_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      system_alerts: {
        Row: {
          action_text: string | null
          action_url: string | null
          alert_type: string
          created_at: string | null
          expires_at: string | null
          id: string
          is_read: boolean | null
          message: string
          metadata: Json | null
          title: string
          user_id: string | null
        }
        Insert: {
          action_text?: string | null
          action_url?: string | null
          alert_type: string
          created_at?: string | null
          expires_at?: string | null
          id?: string
          is_read?: boolean | null
          message: string
          metadata?: Json | null
          title: string
          user_id?: string | null
        }
        Update: {
          action_text?: string | null
          action_url?: string | null
          alert_type?: string
          created_at?: string | null
          expires_at?: string | null
          id?: string
          is_read?: boolean | null
          message?: string
          metadata?: Json | null
          title?: string
          user_id?: string | null
        }
        Relationships: []
      }
      user_online_status: {
        Row: {
          created_at: string | null
          id: string
          is_online: boolean | null
          last_seen: string | null
          updated_at: string | null
          user_id: string
        }
        Insert: {
          created_at?: string | null
          id?: string
          is_online?: boolean | null
          last_seen?: string | null
          updated_at?: string | null
          user_id: string
        }
        Update: {
          created_at?: string | null
          id?: string
          is_online?: boolean | null
          last_seen?: string | null
          updated_at?: string | null
          user_id?: string
        }
        Relationships: []
      }
      verification_checks: {
        Row: {
          check_data: Json | null
          check_status: string
          check_type: string
          created_at: string | null
          id: string
          notes: string | null
          performed_at: string | null
          performed_by: string | null
          result_data: Json | null
          verification_id: string
        }
        Insert: {
          check_data?: Json | null
          check_status: string
          check_type: string
          created_at?: string | null
          id?: string
          notes?: string | null
          performed_at?: string | null
          performed_by?: string | null
          result_data?: Json | null
          verification_id: string
        }
        Update: {
          check_data?: Json | null
          check_status?: string
          check_type?: string
          created_at?: string | null
          id?: string
          notes?: string | null
          performed_at?: string | null
          performed_by?: string | null
          result_data?: Json | null
          verification_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "verification_checks_performed_by_fkey"
            columns: ["performed_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "verification_checks_verification_id_fkey"
            columns: ["verification_id"]
            isOneToOne: false
            referencedRelation: "landlord_verifications"
            referencedColumns: ["id"]
          },
        ]
      }
      verification_decisions: {
        Row: {
          admin_notes: string | null
          approved_at: string | null
          compliance_checklist: Json | null
          created_at: string | null
          decision: string
          escalated_to: string | null
          id: string
          implemented_at: string | null
          primary_admin_id: string
          reason: string
          requires_secondary_approval: boolean | null
          reviewed_at: string | null
          risk_assessment: Json | null
          secondary_admin_id: string | null
          status: string
          submitted_at: string | null
          supporting_documents: string[] | null
          updated_at: string | null
          verification_id: string
        }
        Insert: {
          admin_notes?: string | null
          approved_at?: string | null
          compliance_checklist?: Json | null
          created_at?: string | null
          decision: string
          escalated_to?: string | null
          id?: string
          implemented_at?: string | null
          primary_admin_id: string
          reason: string
          requires_secondary_approval?: boolean | null
          reviewed_at?: string | null
          risk_assessment?: Json | null
          secondary_admin_id?: string | null
          status?: string
          submitted_at?: string | null
          supporting_documents?: string[] | null
          updated_at?: string | null
          verification_id: string
        }
        Update: {
          admin_notes?: string | null
          approved_at?: string | null
          compliance_checklist?: Json | null
          created_at?: string | null
          decision?: string
          escalated_to?: string | null
          id?: string
          implemented_at?: string | null
          primary_admin_id?: string
          reason?: string
          requires_secondary_approval?: boolean | null
          reviewed_at?: string | null
          risk_assessment?: Json | null
          secondary_admin_id?: string | null
          status?: string
          submitted_at?: string | null
          supporting_documents?: string[] | null
          updated_at?: string | null
          verification_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "verification_decisions_escalated_to_fkey"
            columns: ["escalated_to"]
            isOneToOne: false
            referencedRelation: "admins"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "verification_decisions_primary_admin_id_fkey"
            columns: ["primary_admin_id"]
            isOneToOne: false
            referencedRelation: "admins"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "verification_decisions_secondary_admin_id_fkey"
            columns: ["secondary_admin_id"]
            isOneToOne: false
            referencedRelation: "admins"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "verification_decisions_verification_id_fkey"
            columns: ["verification_id"]
            isOneToOne: false
            referencedRelation: "landlord_verifications"
            referencedColumns: ["id"]
          },
        ]
      }
      verification_documents: {
        Row: {
          created_at: string | null
          document_type: Database["public"]["Enums"]["document_type"]
          expires_at: string | null
          extracted_data: Json | null
          file_name: string
          file_path: string
          file_size: number | null
          id: string
          is_redacted: boolean | null
          is_valid: boolean | null
          mime_type: string | null
          ocr_text: string | null
          processed_at: string | null
          uploaded_at: string | null
          validation_notes: string | null
          verification_id: string
        }
        Insert: {
          created_at?: string | null
          document_type: Database["public"]["Enums"]["document_type"]
          expires_at?: string | null
          extracted_data?: Json | null
          file_name: string
          file_path: string
          file_size?: number | null
          id?: string
          is_redacted?: boolean | null
          is_valid?: boolean | null
          mime_type?: string | null
          ocr_text?: string | null
          processed_at?: string | null
          uploaded_at?: string | null
          validation_notes?: string | null
          verification_id: string
        }
        Update: {
          created_at?: string | null
          document_type?: Database["public"]["Enums"]["document_type"]
          expires_at?: string | null
          extracted_data?: Json | null
          file_name?: string
          file_path?: string
          file_size?: number | null
          id?: string
          is_redacted?: boolean | null
          is_valid?: boolean | null
          mime_type?: string | null
          ocr_text?: string | null
          processed_at?: string | null
          uploaded_at?: string | null
          validation_notes?: string | null
          verification_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "verification_documents_verification_id_fkey"
            columns: ["verification_id"]
            isOneToOne: false
            referencedRelation: "landlord_verifications"
            referencedColumns: ["id"]
          },
        ]
      }
      verification_notifications: {
        Row: {
          channel: string
          created_at: string | null
          delivered_at: string | null
          error_message: string | null
          id: string
          notification_type: string
          recipient_id: string
          recipient_type: string
          sent_at: string | null
          status: string | null
          template_data: Json | null
          verification_id: string
        }
        Insert: {
          channel: string
          created_at?: string | null
          delivered_at?: string | null
          error_message?: string | null
          id?: string
          notification_type: string
          recipient_id: string
          recipient_type: string
          sent_at?: string | null
          status?: string | null
          template_data?: Json | null
          verification_id: string
        }
        Update: {
          channel?: string
          created_at?: string | null
          delivered_at?: string | null
          error_message?: string | null
          id?: string
          notification_type?: string
          recipient_id?: string
          recipient_type?: string
          sent_at?: string | null
          status?: string | null
          template_data?: Json | null
          verification_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "verification_notifications_verification_id_fkey"
            columns: ["verification_id"]
            isOneToOne: false
            referencedRelation: "landlord_verifications"
            referencedColumns: ["id"]
          },
        ]
      }
      verification_requirements: {
        Row: {
          created_at: string | null
          description: string | null
          id: string
          is_required: boolean | null
          requirement_name: string
          requirement_type: string
          sort_order: number | null
          verification_level: Database["public"]["Enums"]["verification_level"]
        }
        Insert: {
          created_at?: string | null
          description?: string | null
          id?: string
          is_required?: boolean | null
          requirement_name: string
          requirement_type: string
          sort_order?: number | null
          verification_level: Database["public"]["Enums"]["verification_level"]
        }
        Update: {
          created_at?: string | null
          description?: string | null
          id?: string
          is_required?: boolean | null
          requirement_name?: string
          requirement_type?: string
          sort_order?: number | null
          verification_level?: Database["public"]["Enums"]["verification_level"]
        }
        Relationships: []
      }
    }
    Views: {
      listing_comments_with_stats: {
        Row: {
          content: string | null
          created_at: string | null
          deleted_at: string | null
          id: string | null
          is_liked: boolean | null
          like_count: number | null
          listing_id: string | null
          parent_comment_id: string | null
          reply_count: number | null
          updated_at: string | null
          user_avatar: string | null
          user_full_name: string | null
          user_id: string | null
          user_name: string | null
          user_verified: boolean | null
        }
        Relationships: [
          {
            foreignKeyName: "listing_comments_listing_id_fkey"
            columns: ["listing_id"]
            isOneToOne: false
            referencedRelation: "properties"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "listing_comments_parent_comment_id_fkey"
            columns: ["parent_comment_id"]
            isOneToOne: false
            referencedRelation: "listing_comments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "listing_comments_parent_comment_id_fkey"
            columns: ["parent_comment_id"]
            isOneToOne: false
            referencedRelation: "listing_comments_with_stats"
            referencedColumns: ["id"]
          },
        ]
      }
      property_ratings: {
        Row: {
          average_rating: number | null
          five_star_count: number | null
          four_star_count: number | null
          one_star_count: number | null
          property_id: string | null
          three_star_count: number | null
          total_reviews: number | null
          two_star_count: number | null
        }
        Relationships: [
          {
            foreignKeyName: "reviews_property_id_fkey"
            columns: ["property_id"]
            isOneToOne: false
            referencedRelation: "properties"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Functions: {
      add_message_reaction: {
        Args: { message_id_input: string; reaction_type_input: string }
        Returns: undefined
      }
      approve_landlord_verification: {
        Args: { p_admin_id: string; p_verification_id: string }
        Returns: boolean
      }
      approve_property: {
        Args: { p_admin_id: string; p_notes?: string; p_property_id: string }
        Returns: Json
      }
      archive_inactive_properties: { Args: never; Returns: number }
      bulk_delete_properties: {
        Args: { p_admin_id: string; p_property_ids: string[] }
        Returns: Json
      }
      bulk_update_properties: {
        Args: { p_admin_id: string; p_property_ids: string[]; p_updates: Json }
        Returns: Json
      }
      calculate_daily_stats: { Args: never; Returns: undefined }
      calculate_trust_score: {
        Args: { verification_id: string }
        Returns: number
      }
      cleanup_old_audit_logs: { Args: never; Returns: number }
      cleanup_old_search_history: { Args: never; Returns: number }
      create_listing_comment: {
        Args: {
          content_input: string
          listing_id_input: string
          parent_comment_id_input?: string
        }
        Returns: {
          content: string
          created_at: string
          id: string
          is_liked: boolean
          like_count: number
          listing_id: string
          parent_comment_id: string
          reply_count: number
          user_avatar: string
          user_id: string
          user_name: string
          user_verified: boolean
        }[]
      }
      create_newsletter_subscription_alert: {
        Args: { p_email: string; p_user_id: string }
        Returns: undefined
      }
      create_social_notification: {
        Args: {
          p_from_user_id?: string
          p_message?: string
          p_source_id: string
          p_type: Database["public"]["Enums"]["notification_type"]
          p_user_id: string
        }
        Returns: undefined
      }
      create_super_admin: {
        Args: {
          admin_email: string
          admin_name: string
          admin_password: string
          admin_phone?: string
        }
        Returns: Json
      }
      delete_old_notifications: { Args: never; Returns: number }
      flag_property:
        | {
            Args: {
              p_admin_id: string
              p_description: string
              p_property_id: string
              p_violation_type: string
            }
            Returns: Json
          }
        | {
            Args: {
              p_admin_id: string
              p_description: string
              p_property_id: string
              p_violation_type: string
            }
            Returns: string
          }
      gdpr_delete_user_data: { Args: { p_user_id: string }; Returns: boolean }
      generate_admin_code: { Args: never; Returns: string }
      get_comment_replies: {
        Args: { parent_comment_id_input: string }
        Returns: {
          content: string
          created_at: string
          id: string
          is_liked: boolean
          like_count: number
          listing_id: string
          parent_comment_id: string
          reply_count: number
          updated_at: string
          user_avatar: string
          user_full_name: string
          user_id: string
          user_name: string
          user_verified: boolean
        }[]
      }
      get_conversation_stats_enhanced: {
        Args: never
        Returns: {
          archived_conversations: number
          pinned_conversations: number
          total_conversations: number
          unread_conversations: number
          unread_messages: number
        }[]
      }
      get_conversations_enhanced: {
        Args: never
        Returns: {
          is_archived: boolean
          is_muted: boolean
          is_pinned: boolean
          last_message_content: string
          last_message_created_at: string
          last_message_id: string
          last_message_sender_id: string
          last_message_sender_name: string
          last_message_type: string
          last_read_at: string
          participant_avatar_url: string
          participant_id: string
          participant_is_online: boolean
          participant_last_seen: string
          participant_name: string
          thread_id: string
          unread_count: number
        }[]
      }
      get_conversations_for_user: {
        Args: never
        Returns: {
          created_at: string
          is_archived: boolean
          is_muted: boolean
          is_pinned: boolean
          last_message_content: string
          last_message_created_at: string
          last_message_id: string
          last_message_sender_id: string
          last_message_sender_name: string
          last_message_type: string
          last_read_at: string
          participant_avatar_url: string
          participant_id: string
          participant_is_online: boolean
          participant_last_seen: string
          participant_name: string
          thread_id: string
          unread_count: number
          updated_at: string
        }[]
      }
      get_county_filter_options: {
        Args: { p_county?: string }
        Returns: {
          max_price: number
          min_bedrooms: number
          min_price: number
          property_types: string[]
        }[]
      }
      get_dashboard_stats: { Args: never; Returns: Json }
      get_featured_by_county: {
        Args: {
          p_county: string
          p_limit?: number
          p_max_price?: number
          p_min_bedrooms?: number
          p_min_price?: number
          p_offset?: number
          p_property_type?: string
          p_sort_by?: string
          p_sort_order?: string
        }
        Returns: {
          bathrooms: number
          bedrooms: number
          county: string
          created_at: string
          id: string
          images_json: Json
          landlord_avatar_url: string
          landlord_id: string
          landlord_is_verified: boolean
          landlord_name: string
          location_name: string
          price_kes: number
          property_type: string
          saves_count: number
          title: string
          views_count: number
        }[]
      }
      get_featured_listings_feed: {
        Args: { p_county?: string; p_limit?: number; p_offset?: number }
        Returns: {
          bathrooms: number
          bedrooms: number
          county: string
          created_at: string
          id: string
          images_json: Json
          landlord_avatar_url: string
          landlord_id: string
          landlord_is_verified: boolean
          landlord_name: string
          location_name: string
          price_kes: number
          property_type: string
          saves_count: number
          title: string
          views_count: number
        }[]
      }
      get_landlord_analytics: {
        Args: { landlord_uuid: string }
        Returns: {
          active_properties: number
          average_view_duration: number
          conversion_rate: number
          total_inquiries: number
          total_properties: number
          total_saves: number
          total_views: number
          views_this_month: number
          views_this_week: number
          views_today: number
        }[]
      }
      get_listing_comments: {
        Args: {
          limit_count?: number
          listing_id_input: string
          offset_count?: number
        }
        Returns: {
          content: string
          created_at: string
          id: string
          is_liked: boolean
          like_count: number
          listing_id: string
          parent_comment_id: string
          reply_count: number
          updated_at: string
          user_avatar: string
          user_full_name: string
          user_id: string
          user_name: string
          user_verified: boolean
        }[]
      }
      get_listing_engagement_stats: {
        Args: { listing_id_input: string }
        Returns: {
          comments_count: number
          likes_count: number
          shares_count: number
          user_has_liked: boolean
        }[]
      }
      get_major_counties: {
        Args: never
        Returns: {
          county: string
          listing_count: number
        }[]
      }
      get_message_reactions: {
        Args: { message_id_input: string }
        Returns: {
          reaction_type: string
          user_count: number
          user_ids: string[]
        }[]
      }
      get_property_analytics: { Args: { p_property_id: string }; Returns: Json }
      get_saves_total: {
        Args: { property_ids: string[] }
        Returns: {
          property_id: string
          saves: number
        }[]
      }
      get_social_stats_simple: {
        Args: never
        Returns: {
          unread_conversations_count: number
          unread_messages_count: number
        }[]
      }
      get_social_stats_v2: {
        Args: never
        Returns: {
          total_notifications_count: number
          unread_conversations_count: number
          unread_messages_count: number
        }[]
      }
      get_unread_alerts_count: { Args: { p_user_id: string }; Returns: number }
      get_unread_notification_count: { Args: never; Returns: number }
      get_user_activity: { Args: { p_user_id: string }; Returns: Json }
      get_user_audit_logs: {
        Args: { p_limit?: number; p_user_id?: string }
        Returns: {
          action: string
          created_at: string
          id: string
          new_data: Json
          old_data: Json
          record_id: string
          table_name: string
        }[]
      }
      get_user_followers: {
        Args: { user_id_input?: string }
        Returns: {
          avatar_url: string
          display_name: string
          followed_at: string
          full_name: string
          id: string
          is_verified: boolean
        }[]
      }
      get_user_following: {
        Args: { user_id_input?: string }
        Returns: {
          avatar_url: string
          display_name: string
          followed_at: string
          full_name: string
          id: string
          is_verified: boolean
        }[]
      }
      get_user_online_status: {
        Args: { user_uuid: string }
        Returns: {
          is_online: boolean
          last_seen: string
        }[]
      }
      get_user_profile_posts: {
        Args: { p_limit?: number; p_offset?: number; p_user_id: string }
        Returns: {
          comment_count: number
          content: string
          created_at: string
          id: string
          media_urls: string[]
          post_type: Database["public"]["Enums"]["post_type"]
          reaction_count: number
        }[]
      }
      get_user_social_feed: {
        Args: { p_limit?: number; p_offset?: number; p_user_id: string }
        Returns: {
          author_avatar: string
          author_name: string
          comment_count: number
          content: string
          created_at: string
          id: string
          is_liked: boolean
          is_pinned: boolean
          is_public: boolean
          is_saved: boolean
          location: Json
          media_urls: string[]
          mentions: string[]
          post_type: Database["public"]["Enums"]["post_type"]
          property_id: string
          reaction_counts: Json
          share_count: number
          tags: string[]
          updated_at: string
          user_id: string
        }[]
      }
      get_user_social_stats: {
        Args: { p_user_id: string }
        Returns: {
          engagement_rate: number
          total_followers: number
          total_following: number
          total_likes: number
          total_posts: number
        }[]
      }
      get_user_system_alerts: {
        Args: {
          p_alert_type?: string
          p_limit?: number
          p_offset?: number
          p_user_id: string
        }
        Returns: {
          action_text: string
          action_url: string
          alert_type: string
          created_at: string
          expires_at: string
          id: string
          is_read: boolean
          message: string
          metadata: Json
          title: string
        }[]
      }
      get_views_today: {
        Args: { property_ids: string[] }
        Returns: {
          property_id: string
          views: number
        }[]
      }
      get_views_total: {
        Args: { property_ids: string[] }
        Returns: {
          property_id: string
          views: number
        }[]
      }
      increment_property_shares: {
        Args: { property_id_input: string }
        Returns: undefined
      }
      increment_property_views: {
        Args: { property_id_input: string }
        Returns: undefined
      }
      is_admin: { Args: { user_id: string }; Returns: boolean }
      log_audit: {
        Args: {
          p_action: string
          p_new_data?: Json
          p_old_data?: Json
          p_record_id: string
          p_table_name: string
        }
        Returns: string
      }
      mark_all_notifications_read: { Args: never; Returns: undefined }
      mark_notification_read: {
        Args: { notification_id: string }
        Returns: undefined
      }
      mark_system_alert_read: {
        Args: { p_alert_id: string }
        Returns: undefined
      }
      mark_user_offline: { Args: { user_uuid: string }; Returns: undefined }
      reject_landlord_verification: {
        Args: {
          p_admin_id: string
          p_rejection_reason: string
          p_verification_id: string
        }
        Returns: boolean
      }
      reject_property: {
        Args: { p_admin_id: string; p_property_id: string; p_reason: string }
        Returns: Json
      }
      remove_message_reaction: {
        Args: { message_id_input: string; reaction_type_input: string }
        Returns: undefined
      }
      reset_admin_code: { Args: { admin_id_param: string }; Returns: string }
      resolve_property_flag: {
        Args: {
          p_admin_id: string
          p_flag_id: string
          p_resolution: string
          p_resolution_notes?: string
        }
        Returns: Json
      }
      run_all_data_retention_tasks: {
        Args: never
        Returns: {
          executed_at: string
          items_affected: number
          task_name: string
        }[]
      }
      search_featured_in_county: {
        Args: {
          p_county: string
          p_limit?: number
          p_offset?: number
          p_search_term: string
        }
        Returns: {
          bathrooms: number
          bedrooms: number
          county: string
          created_at: string
          id: string
          images_json: Json
          landlord_avatar_url: string
          landlord_id: string
          landlord_is_verified: boolean
          landlord_name: string
          location_name: string
          price_kes: number
          property_type: string
          saves_count: number
          title: string
          views_count: number
        }[]
      }
      toggle_comment_like: {
        Args: { comment_id_input: string }
        Returns: {
          is_liked: boolean
          like_count: number
        }[]
      }
      toggle_conversation_archive: {
        Args: { thread_id_input: string }
        Returns: undefined
      }
      toggle_conversation_mute: {
        Args: { thread_id_input: string }
        Returns: undefined
      }
      toggle_conversation_pin: {
        Args: { thread_id_input: string }
        Returns: undefined
      }
      toggle_listing_like: {
        Args: { listing_id_input: string }
        Returns: {
          is_liked: boolean
          like_count: number
        }[]
      }
      track_listing_share: {
        Args: { listing_id_input: string; platform_input?: string }
        Returns: undefined
      }
      update_verification_checkpoint: {
        Args: {
          p_admin_id: string
          p_field: string
          p_value: boolean
          p_verification_id: string
        }
        Returns: Json
      }
    }
    Enums: {
      admin_role:
        | "super_admin"
        | "senior_admin"
        | "junior_admin"
        | "support_admin"
      admin_status: "active" | "suspended" | "pending_approval" | "deactivated"
      document_type:
        | "national_id"
        | "passport"
        | "drivers_license"
        | "title_deed"
        | "lease_agreement"
        | "property_management_contract"
        | "business_registration"
        | "bank_statement"
        | "utility_bill"
        | "reference_letter"
        | "property_photos"
        | "other"
      message_type: "text" | "image" | "video" | "file" | "property_link"
      notification_type:
        | "like"
        | "comment"
        | "follow"
        | "message"
        | "mention"
        | "property_interest"
      payment_status: "pending" | "success" | "failed"
      post_type: "text" | "image" | "video" | "property_share" | "announcement"
      reaction_type: "like" | "love" | "laugh" | "wow" | "sad" | "angry"
      security_event_type:
        | "login_success"
        | "login_failed"
        | "mfa_success"
        | "mfa_failed"
        | "admin_action"
        | "document_access"
        | "verification_decision"
        | "suspicious_activity"
        | "account_locked"
        | "ip_blocked"
        | "mfa_code_generated"
      verification_level: "unverified" | "basic" | "enhanced" | "premium"
      verification_status:
        | "pending"
        | "in_review"
        | "approved"
        | "rejected"
        | "expired"
        | "suspended"
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] &
        DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] &
        DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R
      }
      ? R
      : never
    : never

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I
      }
      ? I
      : never
    : never

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U
      }
      ? U
      : never
    : never

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  public: {
    Enums: {
      admin_role: [
        "super_admin",
        "senior_admin",
        "junior_admin",
        "support_admin",
      ],
      admin_status: ["active", "suspended", "pending_approval", "deactivated"],
      document_type: [
        "national_id",
        "passport",
        "drivers_license",
        "title_deed",
        "lease_agreement",
        "property_management_contract",
        "business_registration",
        "bank_statement",
        "utility_bill",
        "reference_letter",
        "property_photos",
        "other",
      ],
      message_type: ["text", "image", "video", "file", "property_link"],
      notification_type: [
        "like",
        "comment",
        "follow",
        "message",
        "mention",
        "property_interest",
      ],
      payment_status: ["pending", "success", "failed"],
      post_type: ["text", "image", "video", "property_share", "announcement"],
      reaction_type: ["like", "love", "laugh", "wow", "sad", "angry"],
      security_event_type: [
        "login_success",
        "login_failed",
        "mfa_success",
        "mfa_failed",
        "admin_action",
        "document_access",
        "verification_decision",
        "suspicious_activity",
        "account_locked",
        "ip_blocked",
        "mfa_code_generated",
      ],
      verification_level: ["unverified", "basic", "enhanced", "premium"],
      verification_status: [
        "pending",
        "in_review",
        "approved",
        "rejected",
        "expired",
        "suspended",
      ],
    },
  },
} as const
