export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[];

export type Database = {
  public: {
    Tables: {
      acceptance_conditions: {
        Row: {
          created_at: string;
          display_order: number;
          id: string;
          is_active: boolean;
          key: string;
          label: string;
        };
        Insert: {
          created_at?: string;
          display_order?: number;
          id?: string;
          is_active?: boolean;
          key: string;
          label: string;
        };
        Update: {
          created_at?: string;
          display_order?: number;
          id?: string;
          is_active?: boolean;
          key?: string;
          label?: string;
        };
        Relationships: [];
      };
      areas: {
        Row: {
          boundary: unknown;
          centroid: unknown;
          city: string;
          code: string;
          created_at: string;
          id: string;
          level: number;
          name: string;
          parent_area_id: string | null;
          prefecture: string;
        };
        Insert: {
          boundary?: unknown;
          centroid?: unknown;
          city: string;
          code: string;
          created_at?: string;
          id?: string;
          level: number;
          name: string;
          parent_area_id?: string | null;
          prefecture: string;
        };
        Update: {
          boundary?: unknown;
          centroid?: unknown;
          city?: string;
          code?: string;
          created_at?: string;
          id?: string;
          level?: number;
          name?: string;
          parent_area_id?: string | null;
          prefecture?: string;
        };
        Relationships: [
          {
            foreignKeyName: "areas_parent_area_id_fkey";
            columns: ["parent_area_id"];
            isOneToOne: false;
            referencedRelation: "areas";
            referencedColumns: ["id"];
          },
        ];
      };
      care_needs: {
        Row: {
          created_at: string;
          display_order: number;
          id: string;
          is_active: boolean;
          key: string;
          label: string;
        };
        Insert: {
          created_at?: string;
          display_order?: number;
          id?: string;
          is_active?: boolean;
          key: string;
          label: string;
        };
        Update: {
          created_at?: string;
          display_order?: number;
          id?: string;
          is_active?: boolean;
          key?: string;
          label?: string;
        };
        Relationships: [];
      };
      content_flags: {
        Row: {
          created_at: string;
          detail: string | null;
          id: string;
          reason: Database["public"]["Enums"]["flag_reason"];
          reporter_user_id: string;
          resolved_at: string | null;
          resolved_by: string | null;
          status: Database["public"]["Enums"]["flag_status"];
          target_id: string;
          target_type: Database["public"]["Enums"]["flag_target_type"];
          updated_at: string;
        };
        Insert: {
          created_at?: string;
          detail?: string | null;
          id?: string;
          reason: Database["public"]["Enums"]["flag_reason"];
          reporter_user_id: string;
          resolved_at?: string | null;
          resolved_by?: string | null;
          status?: Database["public"]["Enums"]["flag_status"];
          target_id: string;
          target_type: Database["public"]["Enums"]["flag_target_type"];
          updated_at?: string;
        };
        Update: {
          created_at?: string;
          detail?: string | null;
          id?: string;
          reason?: Database["public"]["Enums"]["flag_reason"];
          reporter_user_id?: string;
          resolved_at?: string | null;
          resolved_by?: string | null;
          status?: Database["public"]["Enums"]["flag_status"];
          target_id?: string;
          target_type?: Database["public"]["Enums"]["flag_target_type"];
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "content_flags_reporter_user_id_fkey";
            columns: ["reporter_user_id"];
            isOneToOne: false;
            referencedRelation: "users";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "content_flags_resolved_by_fkey";
            columns: ["resolved_by"];
            isOneToOne: false;
            referencedRelation: "users";
            referencedColumns: ["id"];
          },
        ];
      };
      evacuation_advices: {
        Row: {
          area_id: string;
          created_at: string;
          expires_at: string;
          generated_at: string;
          home_mesh_code: string;
          household_id: string;
          id: string;
          input_snapshot: Json;
          is_ai_generated: boolean;
          summary: string;
          user_id: string;
        };
        Insert: {
          area_id: string;
          created_at?: string;
          expires_at: string;
          generated_at?: string;
          home_mesh_code: string;
          household_id: string;
          id?: string;
          input_snapshot: Json;
          is_ai_generated?: boolean;
          summary: string;
          user_id: string;
        };
        Update: {
          area_id?: string;
          created_at?: string;
          expires_at?: string;
          generated_at?: string;
          home_mesh_code?: string;
          household_id?: string;
          id?: string;
          input_snapshot?: Json;
          is_ai_generated?: boolean;
          summary?: string;
          user_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "evacuation_advices_area_id_fkey";
            columns: ["area_id"];
            isOneToOne: false;
            referencedRelation: "areas";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "evacuation_advices_household_id_fkey";
            columns: ["household_id"];
            isOneToOne: false;
            referencedRelation: "households";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "evacuation_advices_user_id_fkey";
            columns: ["user_id"];
            isOneToOne: false;
            referencedRelation: "users";
            referencedColumns: ["id"];
          },
        ];
      };
      evacuation_options: {
        Row: {
          created_at: string;
          estimated_minutes: number | null;
          evacuation_advice_id: string;
          id: string;
          option_type: Database["public"]["Enums"]["evacuation_option_type"];
          rank: number;
          reason: string;
          risk_note: string | null;
          title: string;
          travel_mode: Database["public"]["Enums"]["travel_mode"];
        };
        Insert: {
          created_at?: string;
          estimated_minutes?: number | null;
          evacuation_advice_id: string;
          id?: string;
          option_type: Database["public"]["Enums"]["evacuation_option_type"];
          rank: number;
          reason: string;
          risk_note?: string | null;
          title: string;
          travel_mode: Database["public"]["Enums"]["travel_mode"];
        };
        Update: {
          created_at?: string;
          estimated_minutes?: number | null;
          evacuation_advice_id?: string;
          id?: string;
          option_type?: Database["public"]["Enums"]["evacuation_option_type"];
          rank?: number;
          reason?: string;
          risk_note?: string | null;
          title?: string;
          travel_mode?: Database["public"]["Enums"]["travel_mode"];
        };
        Relationships: [
          {
            foreignKeyName: "evacuation_options_evacuation_advice_id_fkey";
            columns: ["evacuation_advice_id"];
            isOneToOne: false;
            referencedRelation: "evacuation_advices";
            referencedColumns: ["id"];
          },
        ];
      };
      evacuation_switch_criteria: {
        Row: {
          comparator: string | null;
          created_at: string;
          description: string;
          display_order: number;
          evacuation_advice_id: string;
          evacuation_option_id: string;
          id: string;
          switch_to_option_id: string | null;
          threshold_unit: string | null;
          threshold_value: number | null;
          trigger_type: Database["public"]["Enums"]["switch_trigger_type"];
        };
        Insert: {
          comparator?: string | null;
          created_at?: string;
          description: string;
          display_order?: number;
          evacuation_advice_id: string;
          evacuation_option_id: string;
          id?: string;
          switch_to_option_id?: string | null;
          threshold_unit?: string | null;
          threshold_value?: number | null;
          trigger_type: Database["public"]["Enums"]["switch_trigger_type"];
        };
        Update: {
          comparator?: string | null;
          created_at?: string;
          description?: string;
          display_order?: number;
          evacuation_advice_id?: string;
          evacuation_option_id?: string;
          id?: string;
          switch_to_option_id?: string | null;
          threshold_unit?: string | null;
          threshold_value?: number | null;
          trigger_type?: Database["public"]["Enums"]["switch_trigger_type"];
        };
        Relationships: [
          {
            foreignKeyName: "evacuation_switch_criteria_evacuation_option_id_fkey";
            columns: ["evacuation_option_id"];
            isOneToOne: false;
            referencedRelation: "evacuation_options";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "evacuation_switch_criteria_option_fk";
            columns: ["evacuation_option_id", "evacuation_advice_id"];
            isOneToOne: false;
            referencedRelation: "evacuation_options";
            referencedColumns: ["id", "evacuation_advice_id"];
          },
          {
            foreignKeyName: "evacuation_switch_criteria_switch_to_fk";
            columns: ["switch_to_option_id", "evacuation_advice_id"];
            isOneToOne: false;
            referencedRelation: "evacuation_options";
            referencedColumns: ["id", "evacuation_advice_id"];
          },
        ];
      };
      field_report_digests: {
        Row: {
          caution_count: number;
          impassable_count: number;
          is_ai_summary: boolean;
          latest_reported_at: string;
          merged_count: number;
          mesh_code: string;
          passable_count: number;
          report_count: number;
          reporter_count: number;
          road_condition: Database["public"]["Enums"]["road_condition"];
          summary: string;
          updated_at: string;
        };
        Insert: {
          caution_count?: number;
          impassable_count?: number;
          is_ai_summary?: boolean;
          latest_reported_at: string;
          merged_count?: number;
          mesh_code: string;
          passable_count?: number;
          report_count: number;
          reporter_count: number;
          road_condition: Database["public"]["Enums"]["road_condition"];
          summary: string;
          updated_at?: string;
        };
        Update: {
          caution_count?: number;
          impassable_count?: number;
          is_ai_summary?: boolean;
          latest_reported_at?: string;
          merged_count?: number;
          mesh_code?: string;
          passable_count?: number;
          report_count?: number;
          reporter_count?: number;
          road_condition?: Database["public"]["Enums"]["road_condition"];
          summary?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      field_report_photos: {
        Row: {
          byte_size: number;
          created_at: string;
          exif_stripped: boolean;
          field_report_id: string;
          height: number | null;
          id: string;
          mime_type: string;
          processed_at: string | null;
          storage_path: string;
          width: number | null;
        };
        Insert: {
          byte_size: number;
          created_at?: string;
          exif_stripped?: boolean;
          field_report_id: string;
          height?: number | null;
          id?: string;
          mime_type: string;
          processed_at?: string | null;
          storage_path: string;
          width?: number | null;
        };
        Update: {
          byte_size?: number;
          created_at?: string;
          exif_stripped?: boolean;
          field_report_id?: string;
          height?: number | null;
          id?: string;
          mime_type?: string;
          processed_at?: string | null;
          storage_path?: string;
          width?: number | null;
        };
        Relationships: [
          {
            foreignKeyName: "field_report_photos_field_report_id_fkey";
            columns: ["field_report_id"];
            isOneToOne: false;
            referencedRelation: "field_reports";
            referencedColumns: ["id"];
          },
        ];
      };
      field_reports: {
        Row: {
          created_at: string;
          deleted_at: string | null;
          hazard_type: Database["public"]["Enums"]["hazard_type"] | null;
          id: string;
          mesh_code: string;
          mesh_level: Database["public"]["Enums"]["mesh_level"];
          report_type: Database["public"]["Enums"]["field_report_type"];
          road_condition: Database["public"]["Enums"]["road_condition"] | null;
          status: Database["public"]["Enums"]["report_status"];
          updated_at: string;
          user_id: string;
        };
        Insert: {
          created_at?: string;
          deleted_at?: string | null;
          hazard_type?: Database["public"]["Enums"]["hazard_type"] | null;
          id?: string;
          mesh_code: string;
          mesh_level?: Database["public"]["Enums"]["mesh_level"];
          report_type?: Database["public"]["Enums"]["field_report_type"];
          road_condition?: Database["public"]["Enums"]["road_condition"] | null;
          status?: Database["public"]["Enums"]["report_status"];
          updated_at?: string;
          user_id: string;
        };
        Update: {
          created_at?: string;
          deleted_at?: string | null;
          hazard_type?: Database["public"]["Enums"]["hazard_type"] | null;
          id?: string;
          mesh_code?: string;
          mesh_level?: Database["public"]["Enums"]["mesh_level"];
          report_type?: Database["public"]["Enums"]["field_report_type"];
          road_condition?: Database["public"]["Enums"]["road_condition"] | null;
          status?: Database["public"]["Enums"]["report_status"];
          updated_at?: string;
          user_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "field_reports_user_id_fkey";
            columns: ["user_id"];
            isOneToOne: false;
            referencedRelation: "users";
            referencedColumns: ["id"];
          },
        ];
      };
      household_member_care_needs: {
        Row: {
          care_need_id: string;
          detail: string | null;
          household_member_id: string;
        };
        Insert: {
          care_need_id: string;
          detail?: string | null;
          household_member_id: string;
        };
        Update: {
          care_need_id?: string;
          detail?: string | null;
          household_member_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "household_member_care_needs_care_need_id_fkey";
            columns: ["care_need_id"];
            isOneToOne: false;
            referencedRelation: "care_needs";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "household_member_care_needs_household_member_id_fkey";
            columns: ["household_member_id"];
            isOneToOne: false;
            referencedRelation: "household_members";
            referencedColumns: ["id"];
          },
        ];
      };
      household_members: {
        Row: {
          age_group: Database["public"]["Enums"]["age_group"];
          created_at: string;
          display_name: string;
          household_id: string;
          id: string;
          is_primary: boolean;
          needs_assistance: boolean;
          note: string | null;
          proxy_share_scope:
            | Database["public"]["Enums"]["status_share_scope"]
            | null;
          updated_at: string;
          user_id: string | null;
        };
        Insert: {
          age_group: Database["public"]["Enums"]["age_group"];
          created_at?: string;
          display_name: string;
          household_id: string;
          id?: string;
          is_primary?: boolean;
          needs_assistance?: boolean;
          note?: string | null;
          proxy_share_scope?:
            | Database["public"]["Enums"]["status_share_scope"]
            | null;
          updated_at?: string;
          user_id?: string | null;
        };
        Update: {
          age_group?: Database["public"]["Enums"]["age_group"];
          created_at?: string;
          display_name?: string;
          household_id?: string;
          id?: string;
          is_primary?: boolean;
          needs_assistance?: boolean;
          note?: string | null;
          proxy_share_scope?:
            | Database["public"]["Enums"]["status_share_scope"]
            | null;
          updated_at?: string;
          user_id?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: "household_members_household_id_fkey";
            columns: ["household_id"];
            isOneToOne: false;
            referencedRelation: "households";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "household_members_user_id_fkey";
            columns: ["user_id"];
            isOneToOne: false;
            referencedRelation: "users";
            referencedColumns: ["id"];
          },
        ];
      };
      households: {
        Row: {
          area_id: string;
          car_count: number;
          created_at: string;
          has_car: boolean | null;
          home_mesh_code: string;
          home_mesh_level: Database["public"]["Enums"]["mesh_level"];
          id: string;
          name: string;
          note: string | null;
          owner_user_id: string;
          updated_at: string;
        };
        Insert: {
          area_id: string;
          car_count?: number;
          created_at?: string;
          has_car?: boolean | null;
          home_mesh_code: string;
          home_mesh_level?: Database["public"]["Enums"]["mesh_level"];
          id?: string;
          name: string;
          note?: string | null;
          owner_user_id: string;
          updated_at?: string;
        };
        Update: {
          area_id?: string;
          car_count?: number;
          created_at?: string;
          has_car?: boolean | null;
          home_mesh_code?: string;
          home_mesh_level?: Database["public"]["Enums"]["mesh_level"];
          id?: string;
          name?: string;
          note?: string | null;
          owner_user_id?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "households_area_id_fkey";
            columns: ["area_id"];
            isOneToOne: false;
            referencedRelation: "areas";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "households_owner_is_member";
            columns: ["id", "owner_user_id"];
            isOneToOne: false;
            referencedRelation: "household_members";
            referencedColumns: ["household_id", "user_id"];
          },
          {
            foreignKeyName: "households_owner_user_id_fkey";
            columns: ["owner_user_id"];
            isOneToOne: false;
            referencedRelation: "users";
            referencedColumns: ["id"];
          },
        ];
      };
      member_status_events: {
        Row: {
          actor_user_id: string | null;
          created_at: string;
          household_member_id: string;
          id: string;
          mesh_code: string | null;
          message: string | null;
          needs_help: boolean;
          occurred_at: string;
          source: Database["public"]["Enums"]["member_status_source"];
          status: Database["public"]["Enums"]["user_status"];
        };
        Insert: {
          actor_user_id?: string | null;
          created_at?: string;
          household_member_id: string;
          id?: string;
          mesh_code?: string | null;
          message?: string | null;
          needs_help?: boolean;
          occurred_at?: string;
          source?: Database["public"]["Enums"]["member_status_source"];
          status: Database["public"]["Enums"]["user_status"];
        };
        Update: {
          actor_user_id?: string | null;
          created_at?: string;
          household_member_id?: string;
          id?: string;
          mesh_code?: string | null;
          message?: string | null;
          needs_help?: boolean;
          occurred_at?: string;
          source?: Database["public"]["Enums"]["member_status_source"];
          status?: Database["public"]["Enums"]["user_status"];
        };
        Relationships: [
          {
            foreignKeyName: "member_status_events_actor_user_id_fkey";
            columns: ["actor_user_id"];
            isOneToOne: false;
            referencedRelation: "users";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "member_status_events_household_member_id_fkey";
            columns: ["household_member_id"];
            isOneToOne: false;
            referencedRelation: "household_members";
            referencedColumns: ["id"];
          },
        ];
      };
      member_statuses: {
        Row: {
          household_member_id: string;
          mesh_code: string | null;
          mesh_level: Database["public"]["Enums"]["mesh_level"];
          message: string | null;
          needs_help: boolean;
          status: Database["public"]["Enums"]["user_status"];
          status_updated_at: string;
          updated_at: string;
        };
        Insert: {
          household_member_id: string;
          mesh_code?: string | null;
          mesh_level?: Database["public"]["Enums"]["mesh_level"];
          message?: string | null;
          needs_help?: boolean;
          status?: Database["public"]["Enums"]["user_status"];
          status_updated_at?: string;
          updated_at?: string;
        };
        Update: {
          household_member_id?: string;
          mesh_code?: string | null;
          mesh_level?: Database["public"]["Enums"]["mesh_level"];
          message?: string | null;
          needs_help?: boolean;
          status?: Database["public"]["Enums"]["user_status"];
          status_updated_at?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "member_statuses_household_member_id_fkey";
            columns: ["household_member_id"];
            isOneToOne: true;
            referencedRelation: "household_members";
            referencedColumns: ["id"];
          },
        ];
      };
      moderation_actions: {
        Row: {
          action: Database["public"]["Enums"]["moderation_action"];
          content_flag_id: string | null;
          created_at: string;
          id: string;
          moderator_user_id: string;
          reason: string;
          target_id: string;
          target_type: Database["public"]["Enums"]["flag_target_type"];
        };
        Insert: {
          action: Database["public"]["Enums"]["moderation_action"];
          content_flag_id?: string | null;
          created_at?: string;
          id?: string;
          moderator_user_id: string;
          reason: string;
          target_id: string;
          target_type: Database["public"]["Enums"]["flag_target_type"];
        };
        Update: {
          action?: Database["public"]["Enums"]["moderation_action"];
          content_flag_id?: string | null;
          created_at?: string;
          id?: string;
          moderator_user_id?: string;
          reason?: string;
          target_id?: string;
          target_type?: Database["public"]["Enums"]["flag_target_type"];
        };
        Relationships: [
          {
            foreignKeyName: "moderation_actions_content_flag_id_fkey";
            columns: ["content_flag_id"];
            isOneToOne: false;
            referencedRelation: "content_flags";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "moderation_actions_moderator_user_id_fkey";
            columns: ["moderator_user_id"];
            isOneToOne: false;
            referencedRelation: "users";
            referencedColumns: ["id"];
          },
        ];
      };
      pets: {
        Row: {
          count: number;
          created_at: string;
          household_id: string;
          id: string;
          is_crate_trained: boolean;
          note: string | null;
          size: Database["public"]["Enums"]["pet_size"];
          species: Database["public"]["Enums"]["pet_species"];
        };
        Insert: {
          count?: number;
          created_at?: string;
          household_id: string;
          id?: string;
          is_crate_trained?: boolean;
          note?: string | null;
          size: Database["public"]["Enums"]["pet_size"];
          species: Database["public"]["Enums"]["pet_species"];
        };
        Update: {
          count?: number;
          created_at?: string;
          household_id?: string;
          id?: string;
          is_crate_trained?: boolean;
          note?: string | null;
          size?: Database["public"]["Enums"]["pet_size"];
          species?: Database["public"]["Enums"]["pet_species"];
        };
        Relationships: [
          {
            foreignKeyName: "pets_household_id_fkey";
            columns: ["household_id"];
            isOneToOne: false;
            referencedRelation: "households";
            referencedColumns: ["id"];
          },
        ];
      };
      rate_limit_counters: {
        Row: {
          action: Database["public"]["Enums"]["rate_limit_action"];
          count: number;
          scope: Database["public"]["Enums"]["rate_limit_scope"];
          updated_at: string;
          user_id: string;
          window_start: string;
        };
        Insert: {
          action: Database["public"]["Enums"]["rate_limit_action"];
          count?: number;
          scope: Database["public"]["Enums"]["rate_limit_scope"];
          updated_at?: string;
          user_id: string;
          window_start: string;
        };
        Update: {
          action?: Database["public"]["Enums"]["rate_limit_action"];
          count?: number;
          scope?: Database["public"]["Enums"]["rate_limit_scope"];
          updated_at?: string;
          user_id?: string;
          window_start?: string;
        };
        Relationships: [
          {
            foreignKeyName: "rate_limit_counters_user_id_fkey";
            columns: ["user_id"];
            isOneToOne: false;
            referencedRelation: "users";
            referencedColumns: ["id"];
          },
        ];
      };
      rate_limits: {
        Row: {
          action: Database["public"]["Enums"]["rate_limit_action"];
          level: Database["public"]["Enums"]["verification_level"];
          max_count: number;
          scope: Database["public"]["Enums"]["rate_limit_scope"];
          updated_at: string;
        };
        Insert: {
          action: Database["public"]["Enums"]["rate_limit_action"];
          level: Database["public"]["Enums"]["verification_level"];
          max_count: number;
          scope: Database["public"]["Enums"]["rate_limit_scope"];
          updated_at?: string;
        };
        Update: {
          action?: Database["public"]["Enums"]["rate_limit_action"];
          level?: Database["public"]["Enums"]["verification_level"];
          max_count?: number;
          scope?: Database["public"]["Enums"]["rate_limit_scope"];
          updated_at?: string;
        };
        Relationships: [];
      };
      road_status_estimates: {
        Row: {
          confidence: Database["public"]["Enums"]["ai_confidence"];
          mesh_code: string;
          reasoning: string;
          report_count: number;
          road_condition: Database["public"]["Enums"]["road_condition"];
          updated_at: string;
        };
        Insert: {
          confidence: Database["public"]["Enums"]["ai_confidence"];
          mesh_code: string;
          reasoning: string;
          report_count: number;
          road_condition: Database["public"]["Enums"]["road_condition"];
          updated_at?: string;
        };
        Update: {
          confidence?: Database["public"]["Enums"]["ai_confidence"];
          mesh_code?: string;
          reasoning?: string;
          report_count?: number;
          road_condition?: Database["public"]["Enums"]["road_condition"];
          updated_at?: string;
        };
        Relationships: [];
      };
      shelter_acceptances: {
        Row: {
          condition_id: string;
          confirmed_at: string | null;
          note: string | null;
          shelter_id: string;
          status: Database["public"]["Enums"]["acceptance_status"];
        };
        Insert: {
          condition_id: string;
          confirmed_at?: string | null;
          note?: string | null;
          shelter_id: string;
          status?: Database["public"]["Enums"]["acceptance_status"];
        };
        Update: {
          condition_id?: string;
          confirmed_at?: string | null;
          note?: string | null;
          shelter_id?: string;
          status?: Database["public"]["Enums"]["acceptance_status"];
        };
        Relationships: [
          {
            foreignKeyName: "shelter_acceptances_condition_id_fkey";
            columns: ["condition_id"];
            isOneToOne: false;
            referencedRelation: "acceptance_conditions";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "shelter_acceptances_shelter_id_fkey";
            columns: ["shelter_id"];
            isOneToOne: false;
            referencedRelation: "shelters";
            referencedColumns: ["id"];
          },
        ];
      };
      shelter_assignments: {
        Row: {
          assigned_at: string;
          household_id: string;
          is_over_capacity: boolean;
          party_size: number;
          shelter_id: string;
          updated_at: string;
        };
        Insert: {
          assigned_at?: string;
          household_id: string;
          is_over_capacity?: boolean;
          party_size: number;
          shelter_id: string;
          updated_at?: string;
        };
        Update: {
          assigned_at?: string;
          household_id?: string;
          is_over_capacity?: boolean;
          party_size?: number;
          shelter_id?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "shelter_assignments_household_id_fkey";
            columns: ["household_id"];
            isOneToOne: true;
            referencedRelation: "households";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "shelter_assignments_shelter_id_fkey";
            columns: ["shelter_id"];
            isOneToOne: false;
            referencedRelation: "shelters";
            referencedColumns: ["id"];
          },
        ];
      };
      shelter_hazard_supports: {
        Row: {
          hazard_type: Database["public"]["Enums"]["hazard_type"];
          is_supported: boolean;
          note: string | null;
          shelter_id: string;
        };
        Insert: {
          hazard_type: Database["public"]["Enums"]["hazard_type"];
          is_supported: boolean;
          note?: string | null;
          shelter_id: string;
        };
        Update: {
          hazard_type?: Database["public"]["Enums"]["hazard_type"];
          is_supported?: boolean;
          note?: string | null;
          shelter_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "shelter_hazard_supports_shelter_id_fkey";
            columns: ["shelter_id"];
            isOneToOne: false;
            referencedRelation: "shelters";
            referencedColumns: ["id"];
          },
        ];
      };
      shelters: {
        Row: {
          address: string;
          area_id: string;
          capacity: number | null;
          category: Database["public"]["Enums"]["shelter_category"];
          created_at: string;
          elevation_m: number | null;
          external_code: string;
          floors: number | null;
          id: string;
          is_active: boolean;
          location: unknown;
          name: string;
          name_kana: string | null;
          operator: string | null;
          phone: string | null;
          source: string;
          source_updated_at: string | null;
          updated_at: string;
        };
        Insert: {
          address: string;
          area_id: string;
          capacity?: number | null;
          category?: Database["public"]["Enums"]["shelter_category"];
          created_at?: string;
          elevation_m?: number | null;
          external_code: string;
          floors?: number | null;
          id?: string;
          is_active?: boolean;
          location: unknown;
          name: string;
          name_kana?: string | null;
          operator?: string | null;
          phone?: string | null;
          source: string;
          source_updated_at?: string | null;
          updated_at?: string;
        };
        Update: {
          address?: string;
          area_id?: string;
          capacity?: number | null;
          category?: Database["public"]["Enums"]["shelter_category"];
          created_at?: string;
          elevation_m?: number | null;
          external_code?: string;
          floors?: number | null;
          id?: string;
          is_active?: boolean;
          location?: unknown;
          name?: string;
          name_kana?: string | null;
          operator?: string | null;
          phone?: string | null;
          source?: string;
          source_updated_at?: string | null;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "shelters_area_id_fkey";
            columns: ["area_id"];
            isOneToOne: false;
            referencedRelation: "areas";
            referencedColumns: ["id"];
          },
        ];
      };
      users: {
        Row: {
          area_id: string | null;
          created_at: string;
          deleted_at: string | null;
          display_name: string;
          home_mesh_code: string | null;
          home_mesh_level: Database["public"]["Enums"]["mesh_level"];
          id: string;
          status_share_scope: Database["public"]["Enums"]["status_share_scope"];
          updated_at: string;
          verification_level: Database["public"]["Enums"]["verification_level"];
        };
        Insert: {
          area_id?: string | null;
          created_at?: string;
          deleted_at?: string | null;
          display_name: string;
          home_mesh_code?: string | null;
          home_mesh_level?: Database["public"]["Enums"]["mesh_level"];
          id: string;
          status_share_scope?: Database["public"]["Enums"]["status_share_scope"];
          updated_at?: string;
          verification_level?: Database["public"]["Enums"]["verification_level"];
        };
        Update: {
          area_id?: string | null;
          created_at?: string;
          deleted_at?: string | null;
          display_name?: string;
          home_mesh_code?: string | null;
          home_mesh_level?: Database["public"]["Enums"]["mesh_level"];
          id?: string;
          status_share_scope?: Database["public"]["Enums"]["status_share_scope"];
          updated_at?: string;
          verification_level?: Database["public"]["Enums"]["verification_level"];
        };
        Relationships: [
          {
            foreignKeyName: "users_area_id_fkey";
            columns: ["area_id"];
            isOneToOne: false;
            referencedRelation: "areas";
            referencedColumns: ["id"];
          },
        ];
      };
    };
    Views: {
      [_ in never]: never;
    };
    Functions: {
      assign_shelter: {
        Args: {
          p_candidate_limit?: number;
          p_latitude: number;
          p_longitude: number;
          p_radius_m?: number;
        };
        Returns: {
          distance_m: number;
          expected_people: number;
          is_over_capacity: boolean;
          party_size: number;
          shelter_id: string;
        }[];
      };
      can_update_member_status: { Args: { target: string }; Returns: boolean };
      can_view_member_status: { Args: { target: string }; Returns: boolean };
      create_field_report: {
        Args: {
          p_mesh_code: string;
          p_road_condition: Database["public"]["Enums"]["road_condition"];
        };
        Returns: {
          created_at: string;
          id: string;
          mesh_code: string;
          road_condition: Database["public"]["Enums"]["road_condition"];
        }[];
      };
      import_shelters: {
        Args: { p_shelters: Json };
        Returns: {
          imported_code: string;
          is_created: boolean;
        }[];
      };
      is_household_member: { Args: { target: string }; Returns: boolean };
      is_household_owner: { Args: { target: string }; Returns: boolean };
      is_moderator: { Args: never; Returns: boolean };
      nearby_shelters: {
        Args: {
          p_latitude: number;
          p_limit?: number;
          p_longitude: number;
          p_radius_m?: number;
        };
        Returns: {
          address: string;
          area_id: string;
          capacity: number;
          category: Database["public"]["Enums"]["shelter_category"];
          distance_m: number;
          elevation_m: number;
          external_code: string;
          floors: number;
          id: string;
          latitude: number;
          longitude: number;
          name: string;
        }[];
      };
      save_evacuation_advice: {
        Args: {
          p_input_snapshot: Json;
          p_is_ai_generated: boolean;
          p_options: Json;
          p_summary: string;
          p_valid_minutes?: number;
        };
        Returns: {
          evacuation_advice_id: string;
          household_id: string;
          option_count: number;
        }[];
      };
      setup_user_account: {
        Args: {
          p_age_group?: Database["public"]["Enums"]["age_group"];
          p_area_id: string;
          p_car_count?: number;
          p_display_name: string;
          p_home_mesh_code: string;
          p_household_name?: string;
        };
        Returns: {
          area_id: string;
          car_count: number;
          display_name: string;
          has_car: boolean;
          home_mesh_code: string;
          household_id: string;
          household_member_id: string;
          household_name: string;
          is_created: boolean;
          user_id: string;
        }[];
      };
      shelter_loads: {
        Args: { p_shelter_ids: string[] };
        Returns: {
          capacity: number;
          expected_people: number;
          household_count: number;
          occupancy_rate: number;
          shelter_id: string;
        }[];
      };
      update_household_account: {
        Args: {
          p_area_id: string;
          p_car_count: number;
          p_home_mesh_code: string;
          p_members: Json;
          p_pets?: Json;
        };
        Returns: {
          area_id: string;
          car_count: number;
          has_car: boolean;
          home_mesh_code: string;
          household_id: string;
        }[];
      };
    };
    Enums: {
      acceptance_status: "available" | "limited" | "unavailable" | "unknown";
      age_group: "infant" | "child" | "adult" | "senior";
      ai_confidence: "high" | "medium" | "low";
      evacuation_option_type:
        | "stay_home"
        | "designated_shelter"
        | "relative_house"
        | "vertical"
        | "early_move"
        | "other";
      field_report_type: "road" | "hazard" | "shop" | "other";
      flag_reason: "false_info" | "privacy" | "spam" | "abuse" | "other";
      flag_status: "open" | "reviewing" | "actioned" | "dismissed";
      flag_target_type:
        | "field_report"
        | "community_post"
        | "community_comment"
        | "user";
      hazard_type:
        | "flood"
        | "inland_flood"
        | "landslide"
        | "storm_surge"
        | "tsunami"
        | "earthquake"
        | "fire";
      member_status_source: "self" | "proxy";
      mesh_level: "mesh_1km" | "mesh_500m" | "mesh_250m" | "mesh_125m";
      moderation_action: "hide" | "restore" | "delete" | "warn" | "suspend";
      pet_size: "small" | "medium" | "large";
      pet_species:
        | "dog"
        | "cat"
        | "small_animal"
        | "bird"
        | "reptile"
        | "other";
      rate_limit_action:
        | "field_report"
        | "confirmation"
        | "community_post"
        | "content_flag";
      rate_limit_scope: "hour" | "day";
      report_status: "active" | "resolved" | "expired" | "hidden";
      road_condition: "passable" | "caution" | "impassable";
      shelter_category:
        | "emergency_site"
        | "designated_shelter"
        | "welfare_shelter"
        | "temporary"
        | "other";
      status_share_scope: "household" | "family" | "none";
      switch_trigger_type:
        | "alert_level"
        | "rainfall"
        | "river_level"
        | "daylight"
        | "elapsed_time"
        | "observation"
        | "congestion";
      travel_mode: "walk" | "car" | "bicycle" | "none";
      user_status:
        | "unknown"
        | "safe_home"
        | "preparing"
        | "evacuating"
        | "at_shelter"
        | "needs_help"
        | "safe_other";
      verification_level: "anonymous" | "email" | "phone";
    };
    CompositeTypes: {
      [_ in never]: never;
    };
  };
};

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">;

type DefaultSchema = DatabaseWithoutInternals[Extract<
  keyof Database,
  "public"
>];

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R;
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] &
        DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] &
        DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R;
      }
      ? R
      : never
    : never;

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I;
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I;
      }
      ? I
      : never
    : never;

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U;
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U;
      }
      ? U
      : never
    : never;

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never;

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never;

export const Constants = {
  public: {
    Enums: {
      acceptance_status: ["available", "limited", "unavailable", "unknown"],
      age_group: ["infant", "child", "adult", "senior"],
      ai_confidence: ["high", "medium", "low"],
      evacuation_option_type: [
        "stay_home",
        "designated_shelter",
        "relative_house",
        "vertical",
        "early_move",
        "other",
      ],
      field_report_type: ["road", "hazard", "shop", "other"],
      flag_reason: ["false_info", "privacy", "spam", "abuse", "other"],
      flag_status: ["open", "reviewing", "actioned", "dismissed"],
      flag_target_type: [
        "field_report",
        "community_post",
        "community_comment",
        "user",
      ],
      hazard_type: [
        "flood",
        "inland_flood",
        "landslide",
        "storm_surge",
        "tsunami",
        "earthquake",
        "fire",
      ],
      member_status_source: ["self", "proxy"],
      mesh_level: ["mesh_1km", "mesh_500m", "mesh_250m", "mesh_125m"],
      moderation_action: ["hide", "restore", "delete", "warn", "suspend"],
      pet_size: ["small", "medium", "large"],
      pet_species: ["dog", "cat", "small_animal", "bird", "reptile", "other"],
      rate_limit_action: [
        "field_report",
        "confirmation",
        "community_post",
        "content_flag",
      ],
      rate_limit_scope: ["hour", "day"],
      report_status: ["active", "resolved", "expired", "hidden"],
      road_condition: ["passable", "caution", "impassable"],
      shelter_category: [
        "emergency_site",
        "designated_shelter",
        "welfare_shelter",
        "temporary",
        "other",
      ],
      status_share_scope: ["household", "family", "none"],
      switch_trigger_type: [
        "alert_level",
        "rainfall",
        "river_level",
        "daylight",
        "elapsed_time",
        "observation",
        "congestion",
      ],
      travel_mode: ["walk", "car", "bicycle", "none"],
      user_status: [
        "unknown",
        "safe_home",
        "preparing",
        "evacuating",
        "at_shelter",
        "needs_help",
        "safe_other",
      ],
      verification_level: ["anonymous", "email", "phone"],
    },
  },
} as const;
