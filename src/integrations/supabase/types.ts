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
    PostgrestVersion: "14.1"
  }
  public: {
    Tables: {
      admin_audit_logs: {
        Row: {
          action: string
          admin_user_id: string
          created_at: string
          details: Json | null
          id: string
          target_id: string | null
          target_table: string | null
        }
        Insert: {
          action: string
          admin_user_id: string
          created_at?: string
          details?: Json | null
          id?: string
          target_id?: string | null
          target_table?: string | null
        }
        Update: {
          action?: string
          admin_user_id?: string
          created_at?: string
          details?: Json | null
          id?: string
          target_id?: string | null
          target_table?: string | null
        }
        Relationships: []
      }
      admin_cleaning_logs: {
        Row: {
          areas: string[]
          cleaned_at: string
          cleaned_by: string
          created_at: string
          id: string
          notes: string | null
        }
        Insert: {
          areas?: string[]
          cleaned_at?: string
          cleaned_by: string
          created_at?: string
          id?: string
          notes?: string | null
        }
        Update: {
          areas?: string[]
          cleaned_at?: string
          cleaned_by?: string
          created_at?: string
          id?: string
          notes?: string | null
        }
        Relationships: []
      }
      admin_inventory: {
        Row: {
          category: string
          created_at: string
          id: string
          item_name: string
          min_quantity: number
          quantity: number
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          category?: string
          created_at?: string
          id?: string
          item_name: string
          min_quantity?: number
          quantity?: number
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          category?: string
          created_at?: string
          id?: string
          item_name?: string
          min_quantity?: number
          quantity?: number
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: []
      }
      admin_tasks: {
        Row: {
          assigned_to: string | null
          completed_at: string | null
          created_at: string
          created_by: string
          deadline: string | null
          description: string | null
          id: string
          is_team_task: boolean
          priority: string
          status: string
          title: string
          updated_at: string
        }
        Insert: {
          assigned_to?: string | null
          completed_at?: string | null
          created_at?: string
          created_by: string
          deadline?: string | null
          description?: string | null
          id?: string
          is_team_task?: boolean
          priority?: string
          status?: string
          title: string
          updated_at?: string
        }
        Update: {
          assigned_to?: string | null
          completed_at?: string | null
          created_at?: string
          created_by?: string
          deadline?: string | null
          description?: string | null
          id?: string
          is_team_task?: boolean
          priority?: string
          status?: string
          title?: string
          updated_at?: string
        }
        Relationships: []
      }
      admin_vending: {
        Row: {
          created_at: string
          id: string
          is_full: boolean
          item_name: string
          max_quantity: number
          next_purchase_date: string | null
          quantity: number
          updated_at: string
        }
        Insert: {
          created_at?: string
          id?: string
          is_full?: boolean
          item_name: string
          max_quantity?: number
          next_purchase_date?: string | null
          quantity?: number
          updated_at?: string
        }
        Update: {
          created_at?: string
          id?: string
          is_full?: boolean
          item_name?: string
          max_quantity?: number
          next_purchase_date?: string | null
          quantity?: number
          updated_at?: string
        }
        Relationships: []
      }
      app_config: {
        Row: {
          category: string
          config_key: string
          config_value: Json
          created_at: string
          description: string | null
          id: string
          is_active: boolean
          sort_order: number
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          category?: string
          config_key: string
          config_value?: Json
          created_at?: string
          description?: string | null
          id?: string
          is_active?: boolean
          sort_order?: number
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          category?: string
          config_key?: string
          config_value?: Json
          created_at?: string
          description?: string | null
          id?: string
          is_active?: boolean
          sort_order?: number
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: []
      }
      booking_access: {
        Row: {
          access_end: string
          access_start: string
          access_status: string
          booking_id: string | null
          checked_in_at: string | null
          created_at: string
          id: string
          last_unlock_attempt: string | null
          last_unlock_result: string | null
          nuki_authorization_id: string | null
          smartlock_id: string
          studio_id: string
          updated_at: string
          user_id: string
        }
        Insert: {
          access_end: string
          access_start: string
          access_status?: string
          booking_id?: string | null
          checked_in_at?: string | null
          created_at?: string
          id?: string
          last_unlock_attempt?: string | null
          last_unlock_result?: string | null
          nuki_authorization_id?: string | null
          smartlock_id: string
          studio_id: string
          updated_at?: string
          user_id: string
        }
        Update: {
          access_end?: string
          access_start?: string
          access_status?: string
          booking_id?: string | null
          checked_in_at?: string | null
          created_at?: string
          id?: string
          last_unlock_attempt?: string | null
          last_unlock_result?: string | null
          nuki_authorization_id?: string | null
          smartlock_id?: string
          studio_id?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "booking_access_booking_id_fkey"
            columns: ["booking_id"]
            isOneToOne: true
            referencedRelation: "bookings"
            referencedColumns: ["id"]
          },
        ]
      }
      booking_feedback: {
        Row: {
          booking_id: string
          comment: string | null
          created_at: string
          id: string
          rating: number
          user_id: string
        }
        Insert: {
          booking_id: string
          comment?: string | null
          created_at?: string
          id?: string
          rating: number
          user_id: string
        }
        Update: {
          booking_id?: string
          comment?: string | null
          created_at?: string
          id?: string
          rating?: number
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "booking_feedback_booking_id_fkey"
            columns: ["booking_id"]
            isOneToOne: true
            referencedRelation: "bookings"
            referencedColumns: ["id"]
          },
        ]
      }
      bookings: {
        Row: {
          booking_date: string
          cancellation_refund: string | null
          cancelled_at: string | null
          created_at: string
          duration_hours: number
          extras: string[] | null
          id: string
          label_artist_id: string | null
          label_id: string | null
          notes: string | null
          notifications_sent: Json | null
          session_type: string
          start_time: string
          status: string
          stripe_session_id: string | null
          studio_id: string
          total_price: number
          updated_at: string
          user_id: string
          wallet_applied: number
        }
        Insert: {
          booking_date: string
          cancellation_refund?: string | null
          cancelled_at?: string | null
          created_at?: string
          duration_hours?: number
          extras?: string[] | null
          id?: string
          label_artist_id?: string | null
          label_id?: string | null
          notes?: string | null
          notifications_sent?: Json | null
          session_type?: string
          start_time: string
          status?: string
          stripe_session_id?: string | null
          studio_id: string
          total_price?: number
          updated_at?: string
          user_id: string
          wallet_applied?: number
        }
        Update: {
          booking_date?: string
          cancellation_refund?: string | null
          cancelled_at?: string | null
          created_at?: string
          duration_hours?: number
          extras?: string[] | null
          id?: string
          label_artist_id?: string | null
          label_id?: string | null
          notes?: string | null
          notifications_sent?: Json | null
          session_type?: string
          start_time?: string
          status?: string
          stripe_session_id?: string | null
          studio_id?: string
          total_price?: number
          updated_at?: string
          user_id?: string
          wallet_applied?: number
        }
        Relationships: []
      }
      broedplaats_config: {
        Row: {
          config_key: string
          config_value: Json
          id: string
          updated_at: string
        }
        Insert: {
          config_key: string
          config_value?: Json
          id?: string
          updated_at?: string
        }
        Update: {
          config_key?: string
          config_value?: Json
          id?: string
          updated_at?: string
        }
        Relationships: []
      }
      broedplaats_rsvp: {
        Row: {
          activity: string | null
          confirmed: boolean
          created_at: string
          id: string
          slot_type: string
          updated_at: string
          user_id: string
        }
        Insert: {
          activity?: string | null
          confirmed?: boolean
          created_at?: string
          id?: string
          slot_type: string
          updated_at?: string
          user_id: string
        }
        Update: {
          activity?: string | null
          confirmed?: boolean
          created_at?: string
          id?: string
          slot_type?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      broedplaats_workshops: {
        Row: {
          created_at: string
          description: string | null
          draaiboek_url: string | null
          end_time: string
          id: string
          learning_module: string | null
          start_time: string
          title: string
          updated_at: string
          workshop_date: string
        }
        Insert: {
          created_at?: string
          description?: string | null
          draaiboek_url?: string | null
          end_time?: string
          id?: string
          learning_module?: string | null
          start_time?: string
          title?: string
          updated_at?: string
          workshop_date: string
        }
        Update: {
          created_at?: string
          description?: string | null
          draaiboek_url?: string | null
          end_time?: string
          id?: string
          learning_module?: string | null
          start_time?: string
          title?: string
          updated_at?: string
          workshop_date?: string
        }
        Relationships: []
      }
      content_requests: {
        Row: {
          alternative_date: string | null
          created_at: string
          description: string | null
          id: string
          location_preference: string | null
          preferred_date: string | null
          reference_links: string[] | null
          request_type: string
          staff_notes: string | null
          status: string
          user_id: string
        }
        Insert: {
          alternative_date?: string | null
          created_at?: string
          description?: string | null
          id?: string
          location_preference?: string | null
          preferred_date?: string | null
          reference_links?: string[] | null
          request_type: string
          staff_notes?: string | null
          status?: string
          user_id: string
        }
        Update: {
          alternative_date?: string | null
          created_at?: string
          description?: string | null
          id?: string
          location_preference?: string | null
          preferred_date?: string | null
          reference_links?: string[] | null
          request_type?: string
          staff_notes?: string | null
          status?: string
          user_id?: string
        }
        Relationships: []
      }
      email_send_log: {
        Row: {
          created_at: string
          error_message: string | null
          id: string
          message_id: string | null
          metadata: Json | null
          recipient_email: string
          status: string
          template_name: string
        }
        Insert: {
          created_at?: string
          error_message?: string | null
          id?: string
          message_id?: string | null
          metadata?: Json | null
          recipient_email: string
          status: string
          template_name: string
        }
        Update: {
          created_at?: string
          error_message?: string | null
          id?: string
          message_id?: string | null
          metadata?: Json | null
          recipient_email?: string
          status?: string
          template_name?: string
        }
        Relationships: []
      }
      email_send_state: {
        Row: {
          auth_email_ttl_minutes: number
          batch_size: number
          id: number
          retry_after_until: string | null
          send_delay_ms: number
          transactional_email_ttl_minutes: number
          updated_at: string
        }
        Insert: {
          auth_email_ttl_minutes?: number
          batch_size?: number
          id?: number
          retry_after_until?: string | null
          send_delay_ms?: number
          transactional_email_ttl_minutes?: number
          updated_at?: string
        }
        Update: {
          auth_email_ttl_minutes?: number
          batch_size?: number
          id?: number
          retry_after_until?: string | null
          send_delay_ms?: number
          transactional_email_ttl_minutes?: number
          updated_at?: string
        }
        Relationships: []
      }
      email_unsubscribe_tokens: {
        Row: {
          created_at: string
          email: string
          id: string
          token: string
          used_at: string | null
        }
        Insert: {
          created_at?: string
          email: string
          id?: string
          token: string
          used_at?: string | null
        }
        Update: {
          created_at?: string
          email?: string
          id?: string
          token?: string
          used_at?: string | null
        }
        Relationships: []
      }
      error_logs: {
        Row: {
          created_at: string
          error_message: string
          error_stack: string | null
          id: string
          notes: string | null
          page_url: string | null
          resolved: boolean
          user_agent: string | null
          user_id: string
        }
        Insert: {
          created_at?: string
          error_message: string
          error_stack?: string | null
          id?: string
          notes?: string | null
          page_url?: string | null
          resolved?: boolean
          user_agent?: string | null
          user_id: string
        }
        Update: {
          created_at?: string
          error_message?: string
          error_stack?: string | null
          id?: string
          notes?: string | null
          page_url?: string | null
          resolved?: boolean
          user_agent?: string | null
          user_id?: string
        }
        Relationships: []
      }
      notifications: {
        Row: {
          created_at: string
          id: string
          link: string | null
          message: string
          read: boolean
          title: string
          type: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          link?: string | null
          message: string
          read?: boolean
          title: string
          type?: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          link?: string | null
          message?: string
          read?: boolean
          title?: string
          type?: string
          user_id?: string
        }
        Relationships: []
      }
      nuki_smartlocks: {
        Row: {
          created_at: string
          id: string
          is_active: boolean
          is_entrance: boolean
          name: string
          smartlock_id: string
          studio_id: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          id?: string
          is_active?: boolean
          is_entrance?: boolean
          name: string
          smartlock_id: string
          studio_id: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          id?: string
          is_active?: boolean
          is_entrance?: boolean
          name?: string
          smartlock_id?: string
          studio_id?: string
          updated_at?: string
        }
        Relationships: []
      }
      nuki_events: {
        Row: {
          created_at: string
          event_type: string | null
          feature: string | null
          id: string
          payload: Json
          smartlock_id: string | null
        }
        Insert: {
          created_at?: string
          event_type?: string | null
          feature?: string | null
          id?: string
          payload: Json
          smartlock_id?: string | null
        }
        Update: {
          created_at?: string
          event_type?: string | null
          feature?: string | null
          id?: string
          payload?: Json
          smartlock_id?: string | null
        }
        Relationships: []
      }
      nuki_unlock_log: {
        Row: {
          action: string
          booking_access_id: string | null
          created_at: string
          error_message: string | null
          id: string
          result: string
          smartlock_id: string
          studio_id: string
          user_id: string
        }
        Insert: {
          action: string
          booking_access_id?: string | null
          created_at?: string
          error_message?: string | null
          id?: string
          result: string
          smartlock_id: string
          studio_id: string
          user_id: string
        }
        Update: {
          action?: string
          booking_access_id?: string | null
          created_at?: string
          error_message?: string | null
          id?: string
          result?: string
          smartlock_id?: string
          studio_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "nuki_unlock_log_booking_access_id_fkey"
            columns: ["booking_access_id"]
            isOneToOne: false
            referencedRelation: "booking_access"
            referencedColumns: ["id"]
          },
        ]
      }
      org_ambassadors: {
        Row: {
          created_at: string
          id: string
          name: string
          phone: string | null
          role: string | null
        }
        Insert: {
          created_at?: string
          id?: string
          name: string
          phone?: string | null
          role?: string | null
        }
        Update: {
          created_at?: string
          id?: string
          name?: string
          phone?: string | null
          role?: string | null
        }
        Relationships: []
      }
      org_attendance: {
        Row: {
          created_at: string
          id: string
          participant_id: string
          present: boolean
          session_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          participant_id: string
          present?: boolean
          session_id: string
        }
        Update: {
          created_at?: string
          id?: string
          participant_id?: string
          present?: boolean
          session_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "org_attendance_participant_id_fkey"
            columns: ["participant_id"]
            isOneToOne: false
            referencedRelation: "org_participants"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "org_attendance_session_id_fkey"
            columns: ["session_id"]
            isOneToOne: false
            referencedRelation: "org_sessions"
            referencedColumns: ["id"]
          },
        ]
      }
      org_locations: {
        Row: {
          address: string | null
          contact_email: string | null
          contact_person: string | null
          contact_phone: string | null
          created_at: string
          id: string
          is_active: boolean
          name: string
          updated_at: string
        }
        Insert: {
          address?: string | null
          contact_email?: string | null
          contact_person?: string | null
          contact_phone?: string | null
          created_at?: string
          id?: string
          is_active?: boolean
          name: string
          updated_at?: string
        }
        Update: {
          address?: string | null
          contact_email?: string | null
          contact_person?: string | null
          contact_phone?: string | null
          created_at?: string
          id?: string
          is_active?: boolean
          name?: string
          updated_at?: string
        }
        Relationships: []
      }
      org_participants: {
        Row: {
          address: string | null
          city: string | null
          created_at: string
          guardian_phone: string | null
          id: string
          name: string
          phone: string | null
          traject_id: string | null
          workshop_id: string | null
        }
        Insert: {
          address?: string | null
          city?: string | null
          created_at?: string
          guardian_phone?: string | null
          id?: string
          name: string
          phone?: string | null
          traject_id?: string | null
          workshop_id?: string | null
        }
        Update: {
          address?: string | null
          city?: string | null
          created_at?: string
          guardian_phone?: string | null
          id?: string
          name?: string
          phone?: string | null
          traject_id?: string | null
          workshop_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "org_participants_traject_id_fkey"
            columns: ["traject_id"]
            isOneToOne: false
            referencedRelation: "org_trajecten"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "org_participants_workshop_id_fkey"
            columns: ["workshop_id"]
            isOneToOne: false
            referencedRelation: "broedplaats_workshops"
            referencedColumns: ["id"]
          },
        ]
      }
      org_schools: {
        Row: {
          address: string | null
          contact_email: string | null
          contact_person: string | null
          contact_phone: string | null
          created_at: string
          default_traject_duration: string | null
          id: string
          is_active: boolean
          location_id: string | null
          name: string
          notes: string | null
          updated_at: string
        }
        Insert: {
          address?: string | null
          contact_email?: string | null
          contact_person?: string | null
          contact_phone?: string | null
          created_at?: string
          default_traject_duration?: string | null
          id?: string
          is_active?: boolean
          location_id?: string | null
          name: string
          notes?: string | null
          updated_at?: string
        }
        Update: {
          address?: string | null
          contact_email?: string | null
          contact_person?: string | null
          contact_phone?: string | null
          created_at?: string
          default_traject_duration?: string | null
          id?: string
          is_active?: boolean
          location_id?: string | null
          name?: string
          notes?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "org_schools_location_id_fkey"
            columns: ["location_id"]
            isOneToOne: false
            referencedRelation: "org_locations"
            referencedColumns: ["id"]
          },
        ]
      }
      org_session_checklist: {
        Row: {
          checked: boolean
          created_at: string
          id: string
          item: string
          session_id: string
        }
        Insert: {
          checked?: boolean
          created_at?: string
          id?: string
          item: string
          session_id: string
        }
        Update: {
          checked?: boolean
          created_at?: string
          id?: string
          item?: string
          session_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "org_session_checklist_session_id_fkey"
            columns: ["session_id"]
            isOneToOne: false
            referencedRelation: "org_sessions"
            referencedColumns: ["id"]
          },
        ]
      }
      org_session_reports: {
        Row: {
          created_at: string
          file_urls: string[] | null
          id: string
          notes: string | null
          participant_count: number | null
          reported_by: string
          session_id: string
          status: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          file_urls?: string[] | null
          id?: string
          notes?: string | null
          participant_count?: number | null
          reported_by: string
          session_id: string
          status?: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          file_urls?: string[] | null
          id?: string
          notes?: string | null
          participant_count?: number | null
          reported_by?: string
          session_id?: string
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "org_session_reports_session_id_fkey"
            columns: ["session_id"]
            isOneToOne: false
            referencedRelation: "org_sessions"
            referencedColumns: ["id"]
          },
        ]
      }
      org_sessions: {
        Row: {
          created_at: string
          created_by: string
          description: string | null
          draaiboek_url: string | null
          end_time: string
          guest_teacher: string | null
          id: string
          location_id: string | null
          org_workshop_id: string | null
          session_date: string
          session_type: string
          start_time: string
          status: string
          team_member_id: string | null
          title: string
          traject_id: string | null
          updated_at: string
        }
        Insert: {
          created_at?: string
          created_by: string
          description?: string | null
          draaiboek_url?: string | null
          end_time?: string
          guest_teacher?: string | null
          id?: string
          location_id?: string | null
          org_workshop_id?: string | null
          session_date: string
          session_type?: string
          start_time?: string
          status?: string
          team_member_id?: string | null
          title: string
          traject_id?: string | null
          updated_at?: string
        }
        Update: {
          created_at?: string
          created_by?: string
          description?: string | null
          draaiboek_url?: string | null
          end_time?: string
          guest_teacher?: string | null
          id?: string
          location_id?: string | null
          org_workshop_id?: string | null
          session_date?: string
          session_type?: string
          start_time?: string
          status?: string
          team_member_id?: string | null
          title?: string
          traject_id?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "org_sessions_location_id_fkey"
            columns: ["location_id"]
            isOneToOne: false
            referencedRelation: "org_locations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "org_sessions_org_workshop_id_fkey"
            columns: ["org_workshop_id"]
            isOneToOne: false
            referencedRelation: "org_workshops"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "org_sessions_team_member_id_fkey"
            columns: ["team_member_id"]
            isOneToOne: false
            referencedRelation: "org_team_members"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "org_sessions_traject_id_fkey"
            columns: ["traject_id"]
            isOneToOne: false
            referencedRelation: "org_trajecten"
            referencedColumns: ["id"]
          },
        ]
      }
      org_tasks: {
        Row: {
          assigned_to: string | null
          created_at: string
          created_by: string
          deadline: string | null
          description: string | null
          id: string
          org_workshop_id: string | null
          priority: string
          scheduled_date: string | null
          status: string
          title: string
          traject_id: string | null
          updated_at: string
          workshop_id: string | null
        }
        Insert: {
          assigned_to?: string | null
          created_at?: string
          created_by: string
          deadline?: string | null
          description?: string | null
          id?: string
          org_workshop_id?: string | null
          priority?: string
          scheduled_date?: string | null
          status?: string
          title: string
          traject_id?: string | null
          updated_at?: string
          workshop_id?: string | null
        }
        Update: {
          assigned_to?: string | null
          created_at?: string
          created_by?: string
          deadline?: string | null
          description?: string | null
          id?: string
          org_workshop_id?: string | null
          priority?: string
          scheduled_date?: string | null
          status?: string
          title?: string
          traject_id?: string | null
          updated_at?: string
          workshop_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "org_tasks_assigned_to_fkey"
            columns: ["assigned_to"]
            isOneToOne: false
            referencedRelation: "org_team_members"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "org_tasks_org_workshop_id_fkey"
            columns: ["org_workshop_id"]
            isOneToOne: false
            referencedRelation: "org_workshops"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "org_tasks_traject_id_fkey"
            columns: ["traject_id"]
            isOneToOne: false
            referencedRelation: "org_trajecten"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "org_tasks_workshop_id_fkey"
            columns: ["workshop_id"]
            isOneToOne: false
            referencedRelation: "broedplaats_workshops"
            referencedColumns: ["id"]
          },
        ]
      }
      org_team_members: {
        Row: {
          city: string | null
          created_at: string
          email: string | null
          id: string
          is_active: boolean
          name: string
          phone: string | null
          role: string | null
        }
        Insert: {
          city?: string | null
          created_at?: string
          email?: string | null
          id?: string
          is_active?: boolean
          name: string
          phone?: string | null
          role?: string | null
        }
        Update: {
          city?: string | null
          created_at?: string
          email?: string | null
          id?: string
          is_active?: boolean
          name?: string
          phone?: string | null
          role?: string | null
        }
        Relationships: []
      }
      org_trajecten: {
        Row: {
          created_at: string
          created_by: string
          description: string | null
          end_date: string | null
          id: string
          location_id: string | null
          notes: string | null
          participant_count: number | null
          school_id: string | null
          spent_budget: number | null
          start_date: string | null
          status: string
          team_member_id: string | null
          title: string
          total_budget: number | null
          traject_type: string | null
          updated_at: string
        }
        Insert: {
          created_at?: string
          created_by: string
          description?: string | null
          end_date?: string | null
          id?: string
          location_id?: string | null
          notes?: string | null
          participant_count?: number | null
          school_id?: string | null
          spent_budget?: number | null
          start_date?: string | null
          status?: string
          team_member_id?: string | null
          title: string
          total_budget?: number | null
          traject_type?: string | null
          updated_at?: string
        }
        Update: {
          created_at?: string
          created_by?: string
          description?: string | null
          end_date?: string | null
          id?: string
          location_id?: string | null
          notes?: string | null
          participant_count?: number | null
          school_id?: string | null
          spent_budget?: number | null
          start_date?: string | null
          status?: string
          team_member_id?: string | null
          title?: string
          total_budget?: number | null
          traject_type?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "org_trajecten_location_id_fkey"
            columns: ["location_id"]
            isOneToOne: false
            referencedRelation: "org_locations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "org_trajecten_school_id_fkey"
            columns: ["school_id"]
            isOneToOne: false
            referencedRelation: "org_schools"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "org_trajecten_team_member_id_fkey"
            columns: ["team_member_id"]
            isOneToOne: false
            referencedRelation: "org_team_members"
            referencedColumns: ["id"]
          },
        ]
      }
      org_workshop_checklist: {
        Row: {
          checked: boolean
          created_at: string
          id: string
          item: string
          workshop_id: string
        }
        Insert: {
          checked?: boolean
          created_at?: string
          id?: string
          item: string
          workshop_id: string
        }
        Update: {
          checked?: boolean
          created_at?: string
          id?: string
          item?: string
          workshop_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "org_workshop_checklist_workshop_id_fkey"
            columns: ["workshop_id"]
            isOneToOne: false
            referencedRelation: "broedplaats_workshops"
            referencedColumns: ["id"]
          },
        ]
      }
      org_workshop_reports: {
        Row: {
          created_at: string
          file_urls: string[] | null
          id: string
          notes: string | null
          participant_count: number | null
          reported_by: string
          status: string
          updated_at: string
          workshop_id: string
        }
        Insert: {
          created_at?: string
          file_urls?: string[] | null
          id?: string
          notes?: string | null
          participant_count?: number | null
          reported_by: string
          status?: string
          updated_at?: string
          workshop_id: string
        }
        Update: {
          created_at?: string
          file_urls?: string[] | null
          id?: string
          notes?: string | null
          participant_count?: number | null
          reported_by?: string
          status?: string
          updated_at?: string
          workshop_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "org_workshop_reports_workshop_id_fkey"
            columns: ["workshop_id"]
            isOneToOne: false
            referencedRelation: "broedplaats_workshops"
            referencedColumns: ["id"]
          },
        ]
      }
      org_workshop_session_reports: {
        Row: {
          created_at: string
          file_urls: string[] | null
          id: string
          notes: string | null
          org_workshop_id: string
          participant_count: number | null
          reported_by: string
          session_id: string
          status: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          file_urls?: string[] | null
          id?: string
          notes?: string | null
          org_workshop_id: string
          participant_count?: number | null
          reported_by: string
          session_id: string
          status?: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          file_urls?: string[] | null
          id?: string
          notes?: string | null
          org_workshop_id?: string
          participant_count?: number | null
          reported_by?: string
          session_id?: string
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "org_workshop_session_reports_org_workshop_id_fkey"
            columns: ["org_workshop_id"]
            isOneToOne: false
            referencedRelation: "org_workshops"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "org_workshop_session_reports_session_id_fkey"
            columns: ["session_id"]
            isOneToOne: false
            referencedRelation: "org_sessions"
            referencedColumns: ["id"]
          },
        ]
      }
      org_workshops: {
        Row: {
          class_name: string | null
          class_size: number | null
          created_at: string
          created_by: string
          description: string | null
          end_date: string | null
          id: string
          last_lesson_at_studio: boolean
          location_id: string | null
          notes: string | null
          school_id: string | null
          start_date: string | null
          status: string
          team_member_id: string | null
          title: string
          total_lessons: number
          updated_at: string
        }
        Insert: {
          class_name?: string | null
          class_size?: number | null
          created_at?: string
          created_by: string
          description?: string | null
          end_date?: string | null
          id?: string
          last_lesson_at_studio?: boolean
          location_id?: string | null
          notes?: string | null
          school_id?: string | null
          start_date?: string | null
          status?: string
          team_member_id?: string | null
          title: string
          total_lessons?: number
          updated_at?: string
        }
        Update: {
          class_name?: string | null
          class_size?: number | null
          created_at?: string
          created_by?: string
          description?: string | null
          end_date?: string | null
          id?: string
          last_lesson_at_studio?: boolean
          location_id?: string | null
          notes?: string | null
          school_id?: string | null
          start_date?: string | null
          status?: string
          team_member_id?: string | null
          title?: string
          total_lessons?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "org_workshops_location_id_fkey"
            columns: ["location_id"]
            isOneToOne: false
            referencedRelation: "org_locations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "org_workshops_school_id_fkey"
            columns: ["school_id"]
            isOneToOne: false
            referencedRelation: "org_schools"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "org_workshops_team_member_id_fkey"
            columns: ["team_member_id"]
            isOneToOne: false
            referencedRelation: "org_team_members"
            referencedColumns: ["id"]
          },
        ]
      }
      producer_bookings: {
        Row: {
          created_at: string
          description: string | null
          id: string
          preferred_date: string
          preferred_time: string
          producer_notes: string | null
          status: string
          stripe_session_id: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          description?: string | null
          id?: string
          preferred_date: string
          preferred_time: string
          producer_notes?: string | null
          status?: string
          stripe_session_id?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          description?: string | null
          id?: string
          preferred_date?: string
          preferred_time?: string
          producer_notes?: string | null
          status?: string
          stripe_session_id?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      profiles: {
        Row: {
          address: string | null
          broedplaats: string | null
          city: string | null
          content_hours: number
          created_at: string
          credit_balance: number
          email: string | null
          full_name: string | null
          id: string
          language: string | null
          last_winback_at: string | null
          membership: string | null
          membership_end_date: string | null
          membership_override: string | null
          notification_prefs: Json
          phone: string | null
          points_balance: number
          postal_code: string | null
          referral_code: string | null
          studio1_hours: number
          studio2_hours: number
          updated_at: string
        }
        Insert: {
          address?: string | null
          broedplaats?: string | null
          city?: string | null
          content_hours?: number
          created_at?: string
          credit_balance?: number
          email?: string | null
          full_name?: string | null
          id: string
          language?: string | null
          last_winback_at?: string | null
          membership?: string | null
          membership_end_date?: string | null
          membership_override?: string | null
          notification_prefs?: Json
          phone?: string | null
          points_balance?: number
          postal_code?: string | null
          referral_code?: string | null
          studio1_hours?: number
          studio2_hours?: number
          updated_at?: string
        }
        Update: {
          address?: string | null
          broedplaats?: string | null
          city?: string | null
          content_hours?: number
          created_at?: string
          credit_balance?: number
          email?: string | null
          full_name?: string | null
          id?: string
          language?: string | null
          last_winback_at?: string | null
          membership?: string | null
          membership_end_date?: string | null
          membership_override?: string | null
          notification_prefs?: Json
          phone?: string | null
          points_balance?: number
          postal_code?: string | null
          referral_code?: string | null
          studio1_hours?: number
          studio2_hours?: number
          updated_at?: string
        }
        Relationships: []
      }
      projects: {
        Row: {
          created_at: string
          description: string | null
          id: string
          price: number
          reference_links: string[] | null
          staff_notes: string | null
          status: string
          stripe_session_id: string | null
          style: string | null
          title: string
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          description?: string | null
          id?: string
          price?: number
          reference_links?: string[] | null
          staff_notes?: string | null
          status?: string
          stripe_session_id?: string | null
          style?: string | null
          title: string
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          description?: string | null
          id?: string
          price?: number
          reference_links?: string[] | null
          staff_notes?: string | null
          status?: string
          stripe_session_id?: string | null
          style?: string | null
          title?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      push_subscriptions: {
        Row: {
          auth: string | null
          created_at: string
          endpoint: string | null
          fcm_token: string | null
          id: string
          p256dh: string | null
          platform: string
          updated_at: string
          user_agent: string | null
          user_id: string
        }
        Insert: {
          auth?: string | null
          created_at?: string
          endpoint?: string | null
          fcm_token?: string | null
          id?: string
          p256dh?: string | null
          platform: string
          updated_at?: string
          user_agent?: string | null
          user_id: string
        }
        Update: {
          auth?: string | null
          created_at?: string
          endpoint?: string | null
          fcm_token?: string | null
          id?: string
          p256dh?: string | null
          platform?: string
          updated_at?: string
          user_agent?: string | null
          user_id?: string
        }
        Relationships: []
      }
      booking_waitlist: {
        Row: {
          booking_date: string
          created_at: string
          id: string
          notified_at: string | null
          status: string
          studio_id: string
          user_id: string
        }
        Insert: {
          booking_date: string
          created_at?: string
          id?: string
          notified_at?: string | null
          status?: string
          studio_id: string
          user_id: string
        }
        Update: {
          booking_date?: string
          created_at?: string
          id?: string
          notified_at?: string | null
          status?: string
          studio_id?: string
          user_id?: string
        }
        Relationships: []
      }
      creator_profiles: {
        Row: {
          artist_name: string | null
          brand_description: string | null
          camera_comfort: string | null
          coach_notes: string | null
          created_at: string
          followers_total: number | null
          genre: string | null
          goals: string | null
          intake_by: string
          intake_completed_at: string | null
          last_weekly_reminder_at: string | null
          milestones: Json
          money_budget: string | null
          posting_platforms: string[] | null
          process_stage: string
          reference_artists: string | null
          release_plan: Json
          releases: string | null
          socials: Json
          strengths: string | null
          struggles: string | null
          target_audience: string | null
          time_budget: string | null
          updated_at: string
          user_id: string
          weekly_content_goal: number | null
          weekly_reminder: boolean
        }
        Insert: {
          artist_name?: string | null
          brand_description?: string | null
          camera_comfort?: string | null
          coach_notes?: string | null
          created_at?: string
          followers_total?: number | null
          genre?: string | null
          goals?: string | null
          intake_by?: string
          intake_completed_at?: string | null
          last_weekly_reminder_at?: string | null
          milestones?: Json
          money_budget?: string | null
          posting_platforms?: string[] | null
          process_stage?: string
          reference_artists?: string | null
          release_plan?: Json
          releases?: string | null
          socials?: Json
          strengths?: string | null
          struggles?: string | null
          target_audience?: string | null
          time_budget?: string | null
          updated_at?: string
          user_id: string
          weekly_content_goal?: number | null
          weekly_reminder?: boolean
        }
        Update: {
          artist_name?: string | null
          brand_description?: string | null
          camera_comfort?: string | null
          coach_notes?: string | null
          created_at?: string
          followers_total?: number | null
          genre?: string | null
          goals?: string | null
          intake_by?: string
          intake_completed_at?: string | null
          last_weekly_reminder_at?: string | null
          milestones?: Json
          money_budget?: string | null
          posting_platforms?: string[] | null
          process_stage?: string
          reference_artists?: string | null
          release_plan?: Json
          releases?: string | null
          socials?: Json
          strengths?: string | null
          struggles?: string | null
          target_audience?: string | null
          time_budget?: string | null
          updated_at?: string
          user_id?: string
          weekly_content_goal?: number | null
          weekly_reminder?: boolean
        }
        Relationships: []
      }
      content_plans: {
        Row: {
          booking_id: string | null
          created_at: string
          generated_by: string
          id: string
          items: Json
          source: string
          title: string
          updated_at: string
          user_id: string
          week_start: string
        }
        Insert: {
          booking_id?: string | null
          created_at?: string
          generated_by?: string
          id?: string
          items?: Json
          source?: string
          title: string
          updated_at?: string
          user_id: string
          week_start: string
        }
        Update: {
          booking_id?: string | null
          created_at?: string
          generated_by?: string
          id?: string
          items?: Json
          source?: string
          title?: string
          updated_at?: string
          user_id?: string
          week_start?: string
        }
        Relationships: []
      }
      coach_checkins: {
        Row: {
          content_plan_id: string | null
          created_at: string
          id: string
          posted: boolean | null
          reach_note: string | null
          reflection: string | null
          user_id: string
        }
        Insert: {
          content_plan_id?: string | null
          created_at?: string
          id?: string
          posted?: boolean | null
          reach_note?: string | null
          reflection?: string | null
          user_id: string
        }
        Update: {
          content_plan_id?: string | null
          created_at?: string
          id?: string
          posted?: boolean | null
          reach_note?: string | null
          reflection?: string | null
          user_id?: string
        }
        Relationships: []
      }
      labels: {
        Row: {
          active: boolean
          billing_address: string | null
          contact_email: string | null
          contact_name: string | null
          created_at: string
          default_rate: number
          hours_balance: number
          id: string
          manager_user_id: string | null
          name: string
          notes: string | null
          updated_at: string
          vat_number: string | null
        }
        Insert: {
          active?: boolean
          billing_address?: string | null
          contact_email?: string | null
          contact_name?: string | null
          created_at?: string
          default_rate?: number
          hours_balance?: number
          id?: string
          manager_user_id?: string | null
          name: string
          notes?: string | null
          updated_at?: string
          vat_number?: string | null
        }
        Update: {
          active?: boolean
          billing_address?: string | null
          contact_email?: string | null
          contact_name?: string | null
          created_at?: string
          default_rate?: number
          hours_balance?: number
          id?: string
          manager_user_id?: string | null
          name?: string
          notes?: string | null
          updated_at?: string
          vat_number?: string | null
        }
        Relationships: []
      }
      label_artists: {
        Row: {
          active: boolean
          created_at: string
          id: string
          label_id: string
          name: string
          user_id: string | null
        }
        Insert: {
          active?: boolean
          created_at?: string
          id?: string
          label_id: string
          name: string
          user_id?: string | null
        }
        Update: {
          active?: boolean
          created_at?: string
          id?: string
          label_id?: string
          name?: string
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "label_artists_label_id_fkey"
            columns: ["label_id"]
            isOneToOne: false
            referencedRelation: "labels"
            referencedColumns: ["id"]
          },
        ]
      }
      collab_posts: {
        Row: {
          contact_info: string | null
          created_at: string
          description: string | null
          genre: string | null
          id: string
          looking_for: string[]
          status: string
          title: string
          user_id: string
        }
        Insert: {
          contact_info?: string | null
          created_at?: string
          description?: string | null
          genre?: string | null
          id?: string
          looking_for?: string[]
          status?: string
          title: string
          user_id: string
        }
        Update: {
          contact_info?: string | null
          created_at?: string
          description?: string | null
          genre?: string | null
          id?: string
          looking_for?: string[]
          status?: string
          title?: string
          user_id?: string
        }
        Relationships: []
      }
      gift_cards: {
        Row: {
          amount: number
          code: string
          created_at: string
          id: string
          message: string | null
          purchaser_user_id: string | null
          recipient_email: string | null
          redeemed_at: string | null
          redeemed_by: string | null
          status: string
          stripe_session_id: string | null
        }
        Insert: {
          amount: number
          code: string
          created_at?: string
          id?: string
          message?: string | null
          purchaser_user_id?: string | null
          recipient_email?: string | null
          redeemed_at?: string | null
          redeemed_by?: string | null
          status?: string
          stripe_session_id?: string | null
        }
        Update: {
          amount?: number
          code?: string
          created_at?: string
          id?: string
          message?: string | null
          purchaser_user_id?: string | null
          recipient_email?: string | null
          redeemed_at?: string | null
          redeemed_by?: string | null
          status?: string
          stripe_session_id?: string | null
        }
        Relationships: []
      }
      label_managers: {
        Row: {
          created_at: string
          id: string
          label_id: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          label_id: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          label_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "label_managers_label_id_fkey"
            columns: ["label_id"]
            isOneToOne: false
            referencedRelation: "labels"
            referencedColumns: ["id"]
          },
        ]
      }
      label_hour_transactions: {
        Row: {
          artist_id: string | null
          booking_id: string | null
          created_at: string
          hours: number
          id: string
          label_id: string
          note: string | null
          type: string
        }
        Insert: {
          artist_id?: string | null
          booking_id?: string | null
          created_at?: string
          hours: number
          id?: string
          label_id: string
          note?: string | null
          type: string
        }
        Update: {
          artist_id?: string | null
          booking_id?: string | null
          created_at?: string
          hours?: number
          id?: string
          label_id?: string
          note?: string | null
          type?: string
        }
        Relationships: []
      }
      label_invoices: {
        Row: {
          created_at: string
          created_by: string | null
          hours: number
          id: string
          invoice_number: string
          label_id: string
          last_reminder_at: string | null
          paid_at: string | null
          reminder_count: number
          pdf_path: string | null
          rate: number
          sent_at: string | null
          status: string
          subtotal: number
          term: string | null
          total: number
          vat_amount: number
          vat_rate: number
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          hours: number
          id?: string
          invoice_number: string
          label_id: string
          last_reminder_at?: string | null
          paid_at?: string | null
          reminder_count?: number
          pdf_path?: string | null
          rate: number
          sent_at?: string | null
          status?: string
          subtotal: number
          term?: string | null
          total: number
          vat_amount: number
          vat_rate?: number
        }
        Update: {
          created_at?: string
          created_by?: string | null
          hours?: number
          id?: string
          invoice_number?: string
          label_id?: string
          last_reminder_at?: string | null
          paid_at?: string | null
          reminder_count?: number
          pdf_path?: string | null
          rate?: number
          sent_at?: string | null
          status?: string
          subtotal?: number
          term?: string | null
          total?: number
          vat_amount?: number
          vat_rate?: number
        }
        Relationships: []
      }
      media_submissions: {
        Row: {
          booking_id: string | null
          consent: boolean
          created_at: string
          id: string
          kind: string
          points_awarded: number
          review_note: string | null
          reviewed_at: string | null
          reviewed_by: string | null
          status: string
          storage_path: string
          user_id: string
        }
        Insert: {
          booking_id?: string | null
          consent?: boolean
          created_at?: string
          id?: string
          kind: string
          points_awarded?: number
          review_note?: string | null
          reviewed_at?: string | null
          reviewed_by?: string | null
          status?: string
          storage_path: string
          user_id: string
        }
        Update: {
          booking_id?: string | null
          consent?: boolean
          created_at?: string
          id?: string
          kind?: string
          points_awarded?: number
          review_note?: string | null
          reviewed_at?: string | null
          reviewed_by?: string | null
          status?: string
          storage_path?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "media_submissions_booking_id_fkey"
            columns: ["booking_id"]
            isOneToOne: false
            referencedRelation: "bookings"
            referencedColumns: ["id"]
          },
        ]
      }
      points_transactions: {
        Row: {
          created_at: string
          id: string
          note: string | null
          points: number
          reference_id: string | null
          type: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          note?: string | null
          points: number
          reference_id?: string | null
          type: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          note?: string | null
          points?: number
          reference_id?: string | null
          type?: string
          user_id?: string
        }
        Relationships: []
      }
      fault_reports: {
        Row: {
          booking_id: string | null
          category: string
          compensation: number
          created_at: string
          description: string
          id: string
          photo_path: string | null
          resolved_at: string | null
          resolved_by: string | null
          status: string
          studio_id: string
          user_id: string
        }
        Insert: {
          booking_id?: string | null
          category: string
          compensation?: number
          created_at?: string
          description: string
          id?: string
          photo_path?: string | null
          resolved_at?: string | null
          resolved_by?: string | null
          status?: string
          studio_id: string
          user_id: string
        }
        Update: {
          booking_id?: string | null
          category?: string
          compensation?: number
          created_at?: string
          description?: string
          id?: string
          photo_path?: string | null
          resolved_at?: string | null
          resolved_by?: string | null
          status?: string
          studio_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "fault_reports_booking_id_fkey"
            columns: ["booking_id"]
            isOneToOne: false
            referencedRelation: "bookings"
            referencedColumns: ["id"]
          },
        ]
      }
      room_blocks: {
        Row: {
          active: boolean
          blocked_from: string
          blocked_until: string | null
          created_at: string
          created_by: string | null
          fault_report_id: string | null
          id: string
          reason: string
          studio_id: string
        }
        Insert: {
          active?: boolean
          blocked_from?: string
          blocked_until?: string | null
          created_at?: string
          created_by?: string | null
          fault_report_id?: string | null
          id?: string
          reason: string
          studio_id: string
        }
        Update: {
          active?: boolean
          blocked_from?: string
          blocked_until?: string | null
          created_at?: string
          created_by?: string | null
          fault_report_id?: string | null
          id?: string
          reason?: string
          studio_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "room_blocks_fault_report_id_fkey"
            columns: ["fault_report_id"]
            isOneToOne: false
            referencedRelation: "fault_reports"
            referencedColumns: ["id"]
          },
        ]
      }
      wallet_transactions: {
        Row: {
          amount: number
          booking_id: string | null
          created_at: string
          expires_at: string | null
          id: string
          note: string | null
          type: string
          user_id: string
        }
        Insert: {
          amount: number
          booking_id?: string | null
          created_at?: string
          expires_at?: string | null
          id?: string
          note?: string | null
          type: string
          user_id: string
        }
        Update: {
          amount?: number
          booking_id?: string | null
          created_at?: string
          expires_at?: string | null
          id?: string
          note?: string | null
          type?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "wallet_transactions_booking_id_fkey"
            columns: ["booking_id"]
            isOneToOne: false
            referencedRelation: "bookings"
            referencedColumns: ["id"]
          },
        ]
      }
      referrals: {
        Row: {
          created_at: string
          id: string
          referral_code: string
          referred_id: string | null
          referrer_id: string
          status: string
        }
        Insert: {
          created_at?: string
          id?: string
          referral_code: string
          referred_id?: string | null
          referrer_id: string
          status?: string
        }
        Update: {
          created_at?: string
          id?: string
          referral_code?: string
          referred_id?: string | null
          referrer_id?: string
          status?: string
        }
        Relationships: []
      }
      suppressed_emails: {
        Row: {
          created_at: string
          email: string
          id: string
          metadata: Json | null
          reason: string
        }
        Insert: {
          created_at?: string
          email: string
          id?: string
          metadata?: Json | null
          reason: string
        }
        Update: {
          created_at?: string
          email?: string
          id?: string
          metadata?: Json | null
          reason?: string
        }
        Relationships: []
      }
      user_roles: {
        Row: {
          id: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Insert: {
          id?: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Update: {
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id?: string
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      delete_email: {
        Args: { message_id: number; queue_name: string }
        Returns: boolean
      }
      enqueue_email: {
        Args: { payload: Json; queue_name: string }
        Returns: number
      }
      get_booking_availability: {
        Args: { target_date: string; target_studio_id?: string }
        Returns: {
          duration_hours: number
          start_time: string
          studio_id: string
        }[]
      }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      move_to_dlq: {
        Args: {
          dlq_name: string
          message_id: number
          payload: Json
          source_queue: string
        }
        Returns: number
      }
      read_email_batch: {
        Args: { batch_size: number; queue_name: string; vt: number }
        Returns: {
          message: Json
          msg_id: number
          read_ct: number
        }[]
      }
      points_apply: {
        Args: {
          p_user_id: string
          p_points: number
          p_type: string
          p_reference_id?: string
          p_note?: string
        }
        Returns: number
      }
      label_hours_apply: {
        Args: {
          p_label_id: string
          p_hours: number
          p_type: string
          p_artist_id?: string
          p_booking_id?: string
          p_note?: string
        }
        Returns: number
      }
      is_label_manager: {
        Args: { _user_id: string; _label_id: string }
        Returns: boolean
      }
      wallet_apply: {
        Args: {
          p_user_id: string
          p_amount: number
          p_type: string
          p_booking_id?: string
          p_note?: string
          p_expires_at?: string
        }
        Returns: number
      }
    }
    Enums: {
      app_role: "admin" | "staff" | "user"
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
      app_role: ["admin", "staff", "user"],
    },
  },
} as const
