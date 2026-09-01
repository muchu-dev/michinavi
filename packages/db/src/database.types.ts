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
      is_household_member: { Args: { target: string }; Returns: boolean };
      is_household_owner: { Args: { target: string }; Returns: boolean };
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
      age_group: "infant" | "child" | "adult" | "senior";
      field_report_type: "road" | "hazard" | "shop" | "other";
      hazard_type:
        | "flood"
        | "inland_flood"
        | "landslide"
        | "storm_surge"
        | "tsunami"
        | "earthquake"
        | "fire";
      mesh_level: "mesh_1km" | "mesh_500m" | "mesh_250m" | "mesh_125m";
      pet_size: "small" | "medium" | "large";
      pet_species:
        | "dog"
        | "cat"
        | "small_animal"
        | "bird"
        | "reptile"
        | "other";
      road_condition: "passable" | "caution" | "impassable";
      status_share_scope: "household" | "family" | "none";
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
      age_group: ["infant", "child", "adult", "senior"],
      field_report_type: ["road", "hazard", "shop", "other"],
      hazard_type: [
        "flood",
        "inland_flood",
        "landslide",
        "storm_surge",
        "tsunami",
        "earthquake",
        "fire",
      ],
      mesh_level: ["mesh_1km", "mesh_500m", "mesh_250m", "mesh_125m"],
      pet_size: ["small", "medium", "large"],
      pet_species: ["dog", "cat", "small_animal", "bird", "reptile", "other"],
      road_condition: ["passable", "caution", "impassable"],
      status_share_scope: ["household", "family", "none"],
      verification_level: ["anonymous", "email", "phone"],
    },
  },
} as const;
