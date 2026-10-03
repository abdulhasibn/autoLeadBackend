/**
 * Generated via Supabase MCP `generate_typescript_types` for project pptljtbxqzmjossuamve.
 * Do not edit by hand — regenerate after schema migrations.
 */

export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[];

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: '14.5';
  };
  public: {
    Tables: {
      audit_logs: {
        Row: {
          action: string;
          actor_id: string | null;
          after_value: Json | null;
          before_value: Json | null;
          created_at: string;
          entity_id: string;
          entity_type: string;
          id: string;
          metadata: Json | null;
        };
        Insert: {
          action: string;
          actor_id?: string | null;
          after_value?: Json | null;
          before_value?: Json | null;
          created_at?: string;
          entity_id: string;
          entity_type: string;
          id?: string;
          metadata?: Json | null;
        };
        Update: {
          action?: string;
          actor_id?: string | null;
          after_value?: Json | null;
          before_value?: Json | null;
          created_at?: string;
          entity_id?: string;
          entity_type?: string;
          id?: string;
          metadata?: Json | null;
        };
        Relationships: [
          {
            foreignKeyName: 'audit_logs_actor_id_fkey';
            columns: ['actor_id'];
            isOneToOne: false;
            referencedRelation: 'users';
            referencedColumns: ['id'];
          },
        ];
      };
      buyer_preferences: {
        Row: {
          buyer_id: string;
          created_at: string;
          id: string;
          preference_type: string;
          value: string;
        };
        Insert: {
          buyer_id: string;
          created_at?: string;
          id?: string;
          preference_type: string;
          value: string;
        };
        Update: {
          buyer_id?: string;
          created_at?: string;
          id?: string;
          preference_type?: string;
          value?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'buyer_preferences_buyer_id_fkey';
            columns: ['buyer_id'];
            isOneToOne: false;
            referencedRelation: 'buyers';
            referencedColumns: ['id'];
          },
        ];
      };
      buyers: {
        Row: {
          budget_max: number | null;
          budget_min: number | null;
          created_at: string;
          id: string;
          location: string | null;
          preferred_contact_method: string | null;
          updated_at: string;
          user_id: string;
        };
        Insert: {
          budget_max?: number | null;
          budget_min?: number | null;
          created_at?: string;
          id?: string;
          location?: string | null;
          preferred_contact_method?: string | null;
          updated_at?: string;
          user_id: string;
        };
        Update: {
          budget_max?: number | null;
          budget_min?: number | null;
          created_at?: string;
          id?: string;
          location?: string | null;
          preferred_contact_method?: string | null;
          updated_at?: string;
          user_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'buyers_user_id_fkey';
            columns: ['user_id'];
            isOneToOne: true;
            referencedRelation: 'users';
            referencedColumns: ['id'];
          },
        ];
      };
      contacts: {
        Row: {
          created_at: string;
          created_by: string | null;
          deleted_at: string | null;
          email: string | null;
          full_name: string;
          id: string;
          merged_into_user_id: string | null;
          phone: string;
          updated_at: string;
        };
        Insert: {
          created_at?: string;
          created_by?: string | null;
          deleted_at?: string | null;
          email?: string | null;
          full_name: string;
          id?: string;
          merged_into_user_id?: string | null;
          phone: string;
          updated_at?: string;
        };
        Update: {
          created_at?: string;
          created_by?: string | null;
          deleted_at?: string | null;
          email?: string | null;
          full_name?: string;
          id?: string;
          merged_into_user_id?: string | null;
          phone?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'contacts_created_by_fkey';
            columns: ['created_by'];
            isOneToOne: false;
            referencedRelation: 'users';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'contacts_merged_into_user_id_fkey';
            columns: ['merged_into_user_id'];
            isOneToOne: false;
            referencedRelation: 'users';
            referencedColumns: ['id'];
          },
        ];
      };
      expenses: {
        Row: {
          amount: number;
          category: string;
          created_at: string;
          deleted_at: string | null;
          description: string | null;
          id: string;
          incurred_on: string;
          recorded_by: string;
          showroom_id: string;
          type: string;
          updated_at: string;
          vehicle_id: string | null;
        };
        Insert: {
          amount: number;
          category: string;
          created_at?: string;
          deleted_at?: string | null;
          description?: string | null;
          id?: string;
          incurred_on: string;
          recorded_by: string;
          showroom_id: string;
          type: string;
          updated_at?: string;
          vehicle_id?: string | null;
        };
        Update: {
          amount?: number;
          category?: string;
          created_at?: string;
          deleted_at?: string | null;
          description?: string | null;
          id?: string;
          incurred_on?: string;
          recorded_by?: string;
          showroom_id?: string;
          type?: string;
          updated_at?: string;
          vehicle_id?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: 'expenses_recorded_by_fkey';
            columns: ['recorded_by'];
            isOneToOne: false;
            referencedRelation: 'users';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'expenses_showroom_id_fkey';
            columns: ['showroom_id'];
            isOneToOne: false;
            referencedRelation: 'showrooms';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'expenses_vehicle_id_fkey';
            columns: ['vehicle_id'];
            isOneToOne: false;
            referencedRelation: 'vehicles';
            referencedColumns: ['id'];
          },
        ];
      };
      follow_ups: {
        Row: {
          assigned_to: string;
          completed_at: string | null;
          created_at: string;
          created_by: string;
          deleted_at: string | null;
          id: string;
          lead_id: string;
          notes: string | null;
          outcome: string | null;
          scheduled_at: string;
          task_type: string;
          updated_at: string;
        };
        Insert: {
          assigned_to: string;
          completed_at?: string | null;
          created_at?: string;
          created_by: string;
          deleted_at?: string | null;
          id?: string;
          lead_id: string;
          notes?: string | null;
          outcome?: string | null;
          scheduled_at: string;
          task_type: string;
          updated_at?: string;
        };
        Update: {
          assigned_to?: string;
          completed_at?: string | null;
          created_at?: string;
          created_by?: string;
          deleted_at?: string | null;
          id?: string;
          lead_id?: string;
          notes?: string | null;
          outcome?: string | null;
          scheduled_at?: string;
          task_type?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'follow_ups_assigned_to_fkey';
            columns: ['assigned_to'];
            isOneToOne: false;
            referencedRelation: 'users';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'follow_ups_created_by_fkey';
            columns: ['created_by'];
            isOneToOne: false;
            referencedRelation: 'users';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'follow_ups_lead_id_fkey';
            columns: ['lead_id'];
            isOneToOne: false;
            referencedRelation: 'leads';
            referencedColumns: ['id'];
          },
        ];
      };
      income: {
        Row: {
          amount: number;
          category: string;
          created_at: string;
          deleted_at: string | null;
          description: string | null;
          id: string;
          received_on: string;
          recorded_by: string;
          showroom_id: string;
          updated_at: string;
          vehicle_id: string | null;
        };
        Insert: {
          amount: number;
          category: string;
          created_at?: string;
          deleted_at?: string | null;
          description?: string | null;
          id?: string;
          received_on: string;
          recorded_by: string;
          showroom_id: string;
          updated_at?: string;
          vehicle_id?: string | null;
        };
        Update: {
          amount?: number;
          category?: string;
          created_at?: string;
          deleted_at?: string | null;
          description?: string | null;
          id?: string;
          received_on?: string;
          recorded_by?: string;
          showroom_id?: string;
          updated_at?: string;
          vehicle_id?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: 'income_recorded_by_fkey';
            columns: ['recorded_by'];
            isOneToOne: false;
            referencedRelation: 'users';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'income_showroom_id_fkey';
            columns: ['showroom_id'];
            isOneToOne: false;
            referencedRelation: 'showrooms';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'income_vehicle_id_fkey';
            columns: ['vehicle_id'];
            isOneToOne: false;
            referencedRelation: 'vehicles';
            referencedColumns: ['id'];
          },
        ];
      };
      lead_status_history: {
        Row: {
          changed_at: string;
          changed_by: string;
          from_status: string | null;
          id: string;
          lead_id: string;
          notes: string | null;
          to_status: string;
        };
        Insert: {
          changed_at?: string;
          changed_by: string;
          from_status?: string | null;
          id?: string;
          lead_id: string;
          notes?: string | null;
          to_status: string;
        };
        Update: {
          changed_at?: string;
          changed_by?: string;
          from_status?: string | null;
          id?: string;
          lead_id?: string;
          notes?: string | null;
          to_status?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'lead_status_history_changed_by_fkey';
            columns: ['changed_by'];
            isOneToOne: false;
            referencedRelation: 'users';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'lead_status_history_lead_id_fkey';
            columns: ['lead_id'];
            isOneToOne: false;
            referencedRelation: 'leads';
            referencedColumns: ['id'];
          },
        ];
      };
      leads: {
        Row: {
          assigned_to: string | null;
          budget: number | null;
          contact_id: string | null;
          created_at: string;
          created_by: string;
          current_vehicle: string | null;
          deleted_at: string | null;
          finance_required: boolean | null;
          id: string;
          notes: string | null;
          preferred_vehicle: string | null;
          purchase_timeline: string | null;
          showroom_id: string;
          source: string;
          status: string;
          trade_in_required: boolean | null;
          updated_at: string;
          user_id: string | null;
          vehicle_id: string | null;
        };
        Insert: {
          assigned_to?: string | null;
          budget?: number | null;
          contact_id?: string | null;
          created_at?: string;
          created_by: string;
          current_vehicle?: string | null;
          deleted_at?: string | null;
          finance_required?: boolean | null;
          id?: string;
          notes?: string | null;
          preferred_vehicle?: string | null;
          purchase_timeline?: string | null;
          showroom_id: string;
          source: string;
          status?: string;
          trade_in_required?: boolean | null;
          updated_at?: string;
          user_id?: string | null;
          vehicle_id?: string | null;
        };
        Update: {
          assigned_to?: string | null;
          budget?: number | null;
          contact_id?: string | null;
          created_at?: string;
          created_by?: string;
          current_vehicle?: string | null;
          deleted_at?: string | null;
          finance_required?: boolean | null;
          id?: string;
          notes?: string | null;
          preferred_vehicle?: string | null;
          purchase_timeline?: string | null;
          showroom_id?: string;
          source?: string;
          status?: string;
          trade_in_required?: boolean | null;
          updated_at?: string;
          user_id?: string | null;
          vehicle_id?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: 'leads_assigned_to_fkey';
            columns: ['assigned_to'];
            isOneToOne: false;
            referencedRelation: 'users';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'leads_contact_id_fkey';
            columns: ['contact_id'];
            isOneToOne: false;
            referencedRelation: 'contacts';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'leads_created_by_fkey';
            columns: ['created_by'];
            isOneToOne: false;
            referencedRelation: 'users';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'leads_showroom_id_fkey';
            columns: ['showroom_id'];
            isOneToOne: false;
            referencedRelation: 'showrooms';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'leads_user_id_fkey';
            columns: ['user_id'];
            isOneToOne: false;
            referencedRelation: 'users';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'leads_vehicle_id_fkey';
            columns: ['vehicle_id'];
            isOneToOne: false;
            referencedRelation: 'vehicles';
            referencedColumns: ['id'];
          },
        ];
      };
      makes: {
        Row: {
          deleted_at: string | null;
          id: string;
          name: string;
        };
        Insert: {
          deleted_at?: string | null;
          id?: string;
          name: string;
        };
        Update: {
          deleted_at?: string | null;
          id?: string;
          name?: string;
        };
        Relationships: [];
      };
      models: {
        Row: {
          deleted_at: string | null;
          id: string;
          make_id: string;
          name: string;
        };
        Insert: {
          deleted_at?: string | null;
          id?: string;
          make_id: string;
          name: string;
        };
        Update: {
          deleted_at?: string | null;
          id?: string;
          make_id?: string;
          name?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'models_make_id_fkey';
            columns: ['make_id'];
            isOneToOne: false;
            referencedRelation: 'makes';
            referencedColumns: ['id'];
          },
        ];
      };
      notifications: {
        Row: {
          body: string | null;
          created_at: string;
          due_at: string | null;
          entity_id: string | null;
          entity_type: string | null;
          id: string;
          is_read: boolean;
          title: string;
          type: string;
          user_id: string;
        };
        Insert: {
          body?: string | null;
          created_at?: string;
          due_at?: string | null;
          entity_id?: string | null;
          entity_type?: string | null;
          id?: string;
          is_read?: boolean;
          title: string;
          type: string;
          user_id: string;
        };
        Update: {
          body?: string | null;
          created_at?: string;
          due_at?: string | null;
          entity_id?: string | null;
          entity_type?: string | null;
          id?: string;
          is_read?: boolean;
          title?: string;
          type?: string;
          user_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'notifications_user_id_fkey';
            columns: ['user_id'];
            isOneToOne: false;
            referencedRelation: 'users';
            referencedColumns: ['id'];
          },
        ];
      };
      owners: {
        Row: {
          address: string | null;
          alt_phone: string | null;
          city: string | null;
          created_at: string;
          created_by: string | null;
          deleted_at: string | null;
          email: string | null;
          full_name: string;
          id: string;
          id_info: string | null;
          notes: string | null;
          phone: string;
          preferred_contact_method: string | null;
          updated_at: string;
          user_id: string | null;
        };
        Insert: {
          address?: string | null;
          alt_phone?: string | null;
          city?: string | null;
          created_at?: string;
          created_by?: string | null;
          deleted_at?: string | null;
          email?: string | null;
          full_name: string;
          id?: string;
          id_info?: string | null;
          notes?: string | null;
          phone: string;
          preferred_contact_method?: string | null;
          updated_at?: string;
          user_id?: string | null;
        };
        Update: {
          address?: string | null;
          alt_phone?: string | null;
          city?: string | null;
          created_at?: string;
          created_by?: string | null;
          deleted_at?: string | null;
          email?: string | null;
          full_name?: string;
          id?: string;
          id_info?: string | null;
          notes?: string | null;
          phone?: string;
          preferred_contact_method?: string | null;
          updated_at?: string;
          user_id?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: 'owners_created_by_fkey';
            columns: ['created_by'];
            isOneToOne: false;
            referencedRelation: 'users';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'owners_user_id_fkey';
            columns: ['user_id'];
            isOneToOne: false;
            referencedRelation: 'users';
            referencedColumns: ['id'];
          },
        ];
      };
      recently_viewed: {
        Row: {
          buyer_id: string;
          id: string;
          vehicle_id: string;
          viewed_at: string;
        };
        Insert: {
          buyer_id: string;
          id?: string;
          vehicle_id: string;
          viewed_at?: string;
        };
        Update: {
          buyer_id?: string;
          id?: string;
          vehicle_id?: string;
          viewed_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'recently_viewed_buyer_id_fkey';
            columns: ['buyer_id'];
            isOneToOne: false;
            referencedRelation: 'buyers';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'recently_viewed_vehicle_id_fkey';
            columns: ['vehicle_id'];
            isOneToOne: false;
            referencedRelation: 'vehicles';
            referencedColumns: ['id'];
          },
        ];
      };
      roles: {
        Row: {
          description: string | null;
          id: string;
          name: string;
        };
        Insert: {
          description?: string | null;
          id?: string;
          name: string;
        };
        Update: {
          description?: string | null;
          id?: string;
          name?: string;
        };
        Relationships: [];
      };
      saved_vehicles: {
        Row: {
          buyer_id: string;
          id: string;
          saved_at: string;
          vehicle_id: string;
        };
        Insert: {
          buyer_id: string;
          id?: string;
          saved_at?: string;
          vehicle_id: string;
        };
        Update: {
          buyer_id?: string;
          id?: string;
          saved_at?: string;
          vehicle_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'saved_vehicles_buyer_id_fkey';
            columns: ['buyer_id'];
            isOneToOne: false;
            referencedRelation: 'buyers';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'saved_vehicles_vehicle_id_fkey';
            columns: ['vehicle_id'];
            isOneToOne: false;
            referencedRelation: 'vehicles';
            referencedColumns: ['id'];
          },
        ];
      };
      showrooms: {
        Row: {
          address: string;
          city: string;
          created_at: string;
          google_maps_url: string | null;
          id: string;
          is_active: boolean;
          name: string;
          opening_hours: Json | null;
          phone: string;
          updated_at: string;
        };
        Insert: {
          address: string;
          city: string;
          created_at?: string;
          google_maps_url?: string | null;
          id?: string;
          is_active?: boolean;
          name: string;
          opening_hours?: Json | null;
          phone: string;
          updated_at?: string;
        };
        Update: {
          address?: string;
          city?: string;
          created_at?: string;
          google_maps_url?: string | null;
          id?: string;
          is_active?: boolean;
          name?: string;
          opening_hours?: Json | null;
          phone?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      user_roles: {
        Row: {
          deleted_at: string | null;
          granted_at: string;
          granted_by: string | null;
          id: string;
          role_id: string;
          user_id: string;
        };
        Insert: {
          deleted_at?: string | null;
          granted_at?: string;
          granted_by?: string | null;
          id?: string;
          role_id: string;
          user_id: string;
        };
        Update: {
          deleted_at?: string | null;
          granted_at?: string;
          granted_by?: string | null;
          id?: string;
          role_id?: string;
          user_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'user_roles_granted_by_fkey';
            columns: ['granted_by'];
            isOneToOne: false;
            referencedRelation: 'users';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'user_roles_role_id_fkey';
            columns: ['role_id'];
            isOneToOne: false;
            referencedRelation: 'roles';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'user_roles_user_id_fkey';
            columns: ['user_id'];
            isOneToOne: false;
            referencedRelation: 'users';
            referencedColumns: ['id'];
          },
        ];
      };
      users: {
        Row: {
          avatar_url: string | null;
          created_at: string;
          deleted_at: string | null;
          email: string | null;
          full_name: string;
          id: string;
          phone: string | null;
          showroom_id: string | null;
          updated_at: string;
        };
        Insert: {
          avatar_url?: string | null;
          created_at?: string;
          deleted_at?: string | null;
          email?: string | null;
          full_name: string;
          id: string;
          phone?: string | null;
          showroom_id?: string | null;
          updated_at?: string;
        };
        Update: {
          avatar_url?: string | null;
          created_at?: string;
          deleted_at?: string | null;
          email?: string | null;
          full_name?: string;
          id?: string;
          phone?: string | null;
          showroom_id?: string | null;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'users_showroom_id_fkey';
            columns: ['showroom_id'];
            isOneToOne: false;
            referencedRelation: 'showrooms';
            referencedColumns: ['id'];
          },
        ];
      };
      variants: {
        Row: {
          body_type: string | null;
          cylinders: number | null;
          deleted_at: string | null;
          displacement_cc: number | null;
          ex_showroom_price: number | null;
          fuel_tank_capacity_l: number | null;
          fuel_type: string | null;
          height_mm: number | null;
          id: string;
          length_mm: number | null;
          model_id: string;
          name: string;
          power: number | null;
          seating_capacity: number | null;
          torque: number | null;
          transmission: string | null;
          width_mm: number | null;
        };
        Insert: {
          body_type?: string | null;
          cylinders?: number | null;
          deleted_at?: string | null;
          displacement_cc?: number | null;
          ex_showroom_price?: number | null;
          fuel_tank_capacity_l?: number | null;
          fuel_type?: string | null;
          height_mm?: number | null;
          id?: string;
          length_mm?: number | null;
          model_id: string;
          name: string;
          power?: number | null;
          seating_capacity?: number | null;
          torque?: number | null;
          transmission?: string | null;
          width_mm?: number | null;
        };
        Update: {
          body_type?: string | null;
          cylinders?: number | null;
          deleted_at?: string | null;
          displacement_cc?: number | null;
          ex_showroom_price?: number | null;
          fuel_tank_capacity_l?: number | null;
          fuel_type?: string | null;
          height_mm?: number | null;
          id?: string;
          length_mm?: number | null;
          model_id?: string;
          name?: string;
          power?: number | null;
          seating_capacity?: number | null;
          torque?: number | null;
          transmission?: string | null;
          width_mm?: number | null;
        };
        Relationships: [
          {
            foreignKeyName: 'variants_model_id_fkey';
            columns: ['model_id'];
            isOneToOne: false;
            referencedRelation: 'models';
            referencedColumns: ['id'];
          },
        ];
      };
      vehicle_documents: {
        Row: {
          doc_type: string | null;
          id: string;
          is_sensitive: boolean;
          storage_path: string;
          uploaded_at: string;
          uploaded_by: string;
          vehicle_id: string;
        };
        Insert: {
          doc_type?: string | null;
          id?: string;
          is_sensitive?: boolean;
          storage_path: string;
          uploaded_at?: string;
          uploaded_by: string;
          vehicle_id: string;
        };
        Update: {
          doc_type?: string | null;
          id?: string;
          is_sensitive?: boolean;
          storage_path?: string;
          uploaded_at?: string;
          uploaded_by?: string;
          vehicle_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'vehicle_documents_uploaded_by_fkey';
            columns: ['uploaded_by'];
            isOneToOne: false;
            referencedRelation: 'users';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'vehicle_documents_vehicle_id_fkey';
            columns: ['vehicle_id'];
            isOneToOne: false;
            referencedRelation: 'vehicles';
            referencedColumns: ['id'];
          },
        ];
      };
      vehicle_financials: {
        Row: {
          actual_selling_price: number | null;
          commission_amount: number | null;
          commission_percent: number | null;
          company_purchase_price: number | null;
          expected_selling_price: number | null;
          id: string;
          listed_price: number | null;
          minimum_selling_price: number | null;
          other_costs: number | null;
          owner_expected_price: number | null;
          sold_at: string | null;
          sold_by: string | null;
          updated_at: string;
          vehicle_id: string;
        };
        Insert: {
          actual_selling_price?: number | null;
          commission_amount?: number | null;
          commission_percent?: number | null;
          company_purchase_price?: number | null;
          expected_selling_price?: number | null;
          id?: string;
          listed_price?: number | null;
          minimum_selling_price?: number | null;
          other_costs?: number | null;
          owner_expected_price?: number | null;
          sold_at?: string | null;
          sold_by?: string | null;
          updated_at?: string;
          vehicle_id: string;
        };
        Update: {
          actual_selling_price?: number | null;
          commission_amount?: number | null;
          commission_percent?: number | null;
          company_purchase_price?: number | null;
          expected_selling_price?: number | null;
          id?: string;
          listed_price?: number | null;
          minimum_selling_price?: number | null;
          other_costs?: number | null;
          owner_expected_price?: number | null;
          sold_at?: string | null;
          sold_by?: string | null;
          updated_at?: string;
          vehicle_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'vehicle_financials_sold_by_fkey';
            columns: ['sold_by'];
            isOneToOne: false;
            referencedRelation: 'users';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'vehicle_financials_vehicle_id_fkey';
            columns: ['vehicle_id'];
            isOneToOne: true;
            referencedRelation: 'vehicles';
            referencedColumns: ['id'];
          },
        ];
      };
      vehicle_media: {
        Row: {
          category: string | null;
          id: string;
          sort_order: number;
          storage_path: string;
          uploaded_at: string;
          uploaded_by: string;
          vehicle_id: string;
        };
        Insert: {
          category?: string | null;
          id?: string;
          sort_order?: number;
          storage_path: string;
          uploaded_at?: string;
          uploaded_by: string;
          vehicle_id: string;
        };
        Update: {
          category?: string | null;
          id?: string;
          sort_order?: number;
          storage_path?: string;
          uploaded_at?: string;
          uploaded_by?: string;
          vehicle_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'vehicle_media_uploaded_by_fkey';
            columns: ['uploaded_by'];
            isOneToOne: false;
            referencedRelation: 'users';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'vehicle_media_vehicle_id_fkey';
            columns: ['vehicle_id'];
            isOneToOne: false;
            referencedRelation: 'vehicles';
            referencedColumns: ['id'];
          },
        ];
      };
      vehicle_status_history: {
        Row: {
          changed_at: string;
          changed_by: string;
          from_status: string | null;
          id: string;
          reason: string | null;
          to_status: string;
          vehicle_id: string;
        };
        Insert: {
          changed_at?: string;
          changed_by: string;
          from_status?: string | null;
          id?: string;
          reason?: string | null;
          to_status: string;
          vehicle_id: string;
        };
        Update: {
          changed_at?: string;
          changed_by?: string;
          from_status?: string | null;
          id?: string;
          reason?: string | null;
          to_status?: string;
          vehicle_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'vehicle_status_history_changed_by_fkey';
            columns: ['changed_by'];
            isOneToOne: false;
            referencedRelation: 'users';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'vehicle_status_history_vehicle_id_fkey';
            columns: ['vehicle_id'];
            isOneToOne: false;
            referencedRelation: 'vehicles';
            referencedColumns: ['id'];
          },
        ];
      };
      vehicles: {
        Row: {
          accident_history: boolean;
          acquisition_type: string;
          colour: string;
          created_at: string;
          deleted_at: string | null;
          description: string | null;
          fuel_type: string;
          id: string;
          insurance_valid_until: string | null;
          km_driven: number;
          loan_status: string | null;
          location: string | null;
          num_previous_owners: number;
          owner_id: string;
          rc_status: string | null;
          registration_number: string;
          service_history: string | null;
          showroom_id: string;
          status: string;
          submitted_by: string;
          transmission: string;
          updated_at: string;
          variant_id: string;
          year: number;
        };
        Insert: {
          accident_history?: boolean;
          acquisition_type: string;
          colour: string;
          created_at?: string;
          deleted_at?: string | null;
          description?: string | null;
          fuel_type: string;
          id?: string;
          insurance_valid_until?: string | null;
          km_driven: number;
          loan_status?: string | null;
          location?: string | null;
          num_previous_owners?: number;
          owner_id: string;
          rc_status?: string | null;
          registration_number: string;
          service_history?: string | null;
          showroom_id: string;
          status?: string;
          submitted_by: string;
          transmission: string;
          updated_at?: string;
          variant_id: string;
          year: number;
        };
        Update: {
          accident_history?: boolean;
          acquisition_type?: string;
          colour?: string;
          created_at?: string;
          deleted_at?: string | null;
          description?: string | null;
          fuel_type?: string;
          id?: string;
          insurance_valid_until?: string | null;
          km_driven?: number;
          loan_status?: string | null;
          location?: string | null;
          num_previous_owners?: number;
          owner_id?: string;
          rc_status?: string | null;
          registration_number?: string;
          service_history?: string | null;
          showroom_id?: string;
          status?: string;
          submitted_by?: string;
          transmission?: string;
          updated_at?: string;
          variant_id?: string;
          year?: number;
        };
        Relationships: [
          {
            foreignKeyName: 'vehicles_owner_id_fkey';
            columns: ['owner_id'];
            isOneToOne: false;
            referencedRelation: 'owners';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'vehicles_showroom_id_fkey';
            columns: ['showroom_id'];
            isOneToOne: false;
            referencedRelation: 'showrooms';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'vehicles_submitted_by_fkey';
            columns: ['submitted_by'];
            isOneToOne: false;
            referencedRelation: 'users';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'vehicles_variant_id_fkey';
            columns: ['variant_id'];
            isOneToOne: false;
            referencedRelation: 'variants';
            referencedColumns: ['id'];
          },
        ];
      };
    };
    Views: {
      [_ in never]: never;
    };
    Functions: {
      save_lead: {
        Args: {
          p_budget: number | null;
          p_contact_created_by: string | null;
          p_contact_email: string | null;
          p_contact_full_name: string | null;
          p_contact_id: string;
          p_contact_phone: string | null;
          p_created_by: string;
          p_current_vehicle: string | null;
          p_deleted_at: string | null;
          p_finance_required: boolean | null;
          p_id: string;
          p_notes: string | null;
          p_preferred_vehicle: string | null;
          p_purchase_timeline: string | null;
          p_showroom_id: string;
          p_source: string;
          p_status: string;
          p_status_notes: string | null;
          p_trade_in_required: boolean | null;
          p_vehicle_id: string | null;
          p_write_history: boolean;
        };
        Returns: undefined;
      };
      save_staff_user: {
        Args: {
          p_deleted_at: string | null;
          p_email: string | null;
          p_full_name: string;
          p_granted_by: string | null;
          p_id: string;
          p_phone: string;
          p_role_names: string[];
          p_showroom_id: string | null;
        };
        Returns: undefined;
      };
      save_vehicle: {
        Args: {
          p_accident_history: boolean;
          p_acquisition_type: string;
          p_actor_id: string;
          p_colour: string;
          p_deleted_at: string | null;
          p_description: string | null;
          p_fuel_type: string;
          p_id: string;
          p_insurance_valid_until: string | null;
          p_km_driven: number;
          p_loan_status: string | null;
          p_location: string | null;
          p_num_previous_owners: number;
          p_owner_id: string;
          p_rc_status: string | null;
          p_registration_number: string;
          p_service_history: string | null;
          p_showroom_id: string;
          p_status: string;
          p_submitted_by: string;
          p_transmission: string;
          p_variant_id: string;
          p_year: number;
        };
        Returns: undefined;
      };
      schedule_follow_up: {
        Args: {
          p_assigned_to: string;
          p_created_by: string;
          p_due_at: string;
          p_id: string;
          p_lead_id: string;
          p_notes: string | null;
          p_notification_id: string;
          p_scheduled_at: string;
          p_task_type: string;
        };
        Returns: undefined;
      };
    };
    Enums: {
      [_ in never]: never;
    };
    CompositeTypes: {
      [_ in never]: never;
    };
  };
};

type DatabaseWithoutInternals = Omit<Database, '__InternalSupabase'>;

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, 'public'>];

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema['Tables'] & DefaultSchema['Views'])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions['schema']]['Tables'] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions['schema']]['Views'])
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions['schema']]['Tables'] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions['schema']]['Views'])[TableName] extends {
      Row: infer R;
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema['Tables'] & DefaultSchema['Views'])
    ? (DefaultSchema['Tables'] & DefaultSchema['Views'])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R;
      }
      ? R
      : never
    : never;

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    keyof DefaultSchema['Tables'] | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions['schema']]['Tables']
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions['schema']]['Tables'][TableName] extends {
      Insert: infer I;
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema['Tables']
    ? DefaultSchema['Tables'][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I;
      }
      ? I
      : never
    : never;

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    keyof DefaultSchema['Tables'] | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions['schema']]['Tables']
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions['schema']]['Tables'][TableName] extends {
      Update: infer U;
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema['Tables']
    ? DefaultSchema['Tables'][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U;
      }
      ? U
      : never
    : never;

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    keyof DefaultSchema['Enums'] | { schema: keyof DatabaseWithoutInternals },
  EnumName extends (DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions['schema']]['Enums']
    : never) = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions['schema']]['Enums'][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema['Enums']
    ? DefaultSchema['Enums'][DefaultSchemaEnumNameOrOptions]
    : never;

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    keyof DefaultSchema['CompositeTypes'] | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends (PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions['schema']]['CompositeTypes']
    : never) = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions['schema']]['CompositeTypes'][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema['CompositeTypes']
    ? DefaultSchema['CompositeTypes'][PublicCompositeTypeNameOrOptions]
    : never;

export const Constants = {
  public: {
    Enums: {},
  },
} as const;
