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
    PostgrestVersion: "14.5"
  }
  public: {
    Tables: {
      knowledge_products: {
        Row: {
          approved_at: string | null
          approved_by: string | null
          audiences: string[]
          categories: string[]
          content_md: string
          cover_url: string | null
          created_at: string
          featured_order: number
          id: string
          is_featured: boolean
          key_message: string | null
          language: string
          metadata: Json
          owner_id: string | null
          product_service: string | null
          published_at: string | null
          slug: string
          source: string | null
          source_type: string | null
          sponsors: Json
          status: string
          summary: string | null
          tags: string[]
          title_en: string | null
          title_th: string
          updated_at: string
          visibility: string
        }
        Insert: {
          approved_at?: string | null
          approved_by?: string | null
          audiences?: string[]
          categories?: string[]
          content_md?: string
          cover_url?: string | null
          created_at?: string
          featured_order?: number
          id?: string
          is_featured?: boolean
          key_message?: string | null
          language?: string
          metadata?: Json
          owner_id?: string | null
          product_service?: string | null
          published_at?: string | null
          slug: string
          source?: string | null
          source_type?: string | null
          sponsors?: Json
          status?: string
          summary?: string | null
          tags?: string[]
          title_en?: string | null
          title_th: string
          updated_at?: string
          visibility?: string
        }
        Update: {
          approved_at?: string | null
          approved_by?: string | null
          audiences?: string[]
          categories?: string[]
          content_md?: string
          cover_url?: string | null
          created_at?: string
          featured_order?: number
          id?: string
          is_featured?: boolean
          key_message?: string | null
          language?: string
          metadata?: Json
          owner_id?: string | null
          product_service?: string | null
          published_at?: string | null
          slug?: string
          source?: string | null
          source_type?: string | null
          sponsors?: Json
          status?: string
          summary?: string | null
          tags?: string[]
          title_en?: string | null
          title_th?: string
          updated_at?: string
          visibility?: string
        }
        Relationships: []
      }
      knowledge_talent_mappings: {
        Row: {
          asset_id: string
          created_at: string
          evidence: Json
          id: string
          person_id: string
          role: string
          updated_at: string
        }
        Insert: {
          asset_id: string
          created_at?: string
          evidence?: Json
          id?: string
          person_id: string
          role: string
          updated_at?: string
        }
        Update: {
          asset_id?: string
          created_at?: string
          evidence?: Json
          id?: string
          person_id?: string
          role?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "knowledge_talent_mappings_asset_id_fkey"
            columns: ["asset_id"]
            isOneToOne: false
            referencedRelation: "knowledge_products"
            referencedColumns: ["id"]
          },
        ]
      }
      lesson_attachments: {
        Row: {
          course_id: string
          created_at: string
          description: string | null
          external_url: string | null
          id: string
          kind: string
          language: string | null
          lesson_id: string | null
          published: boolean
          storage_path: string | null
          title: string | null
          updated_at: string
          uploaded_by: string | null
        }
        Insert: {
          course_id: string
          created_at?: string
          description?: string | null
          external_url?: string | null
          id?: string
          kind: string
          language?: string | null
          lesson_id?: string | null
          published?: boolean
          storage_path?: string | null
          title?: string | null
          updated_at?: string
          uploaded_by?: string | null
        }
        Update: {
          course_id?: string
          created_at?: string
          description?: string | null
          external_url?: string | null
          id?: string
          kind?: string
          language?: string | null
          lesson_id?: string | null
          published?: boolean
          storage_path?: string | null
          title?: string | null
          updated_at?: string
          uploaded_by?: string | null
        }
        Relationships: []
      }
      person_avatars: {
        Row: {
          created_at: string
          mime_type: string | null
          person_id: string
          size_bytes: number | null
          storage_path: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          mime_type?: string | null
          person_id: string
          size_bytes?: number | null
          storage_path: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          mime_type?: string | null
          person_id?: string
          size_bytes?: number | null
          storage_path?: string
          updated_at?: string
        }
        Relationships: []
      }
      training_attachments: {
        Row: {
          created_at: string
          id: string
          is_public: boolean
          kind: string
          label: string | null
          mime_type: string | null
          size_bytes: number | null
          storage_path: string
          training_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          is_public?: boolean
          kind?: string
          label?: string | null
          mime_type?: string | null
          size_bytes?: number | null
          storage_path: string
          training_id: string
        }
        Update: {
          created_at?: string
          id?: string
          is_public?: boolean
          kind?: string
          label?: string | null
          mime_type?: string | null
          size_bytes?: number | null
          storage_path?: string
          training_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "training_attachments_training_id_fkey"
            columns: ["training_id"]
            isOneToOne: false
            referencedRelation: "trainings"
            referencedColumns: ["id"]
          },
        ]
      }
      trainings: {
        Row: {
          cover_attachment_id: string | null
          created_at: string
          end_date: string | null
          id: string
          location: string | null
          meeting_notes: string | null
          notes: string | null
          outcomes: string | null
          participants: string | null
          public_summary_en: string | null
          public_summary_th: string | null
          public_title_en: string | null
          public_title_th: string | null
          published: boolean
          sites: string | null
          source: string | null
          start_date: string | null
          topics: string | null
          updated_at: string
          visit_type: string | null
        }
        Insert: {
          cover_attachment_id?: string | null
          created_at?: string
          end_date?: string | null
          id?: string
          location?: string | null
          meeting_notes?: string | null
          notes?: string | null
          outcomes?: string | null
          participants?: string | null
          public_summary_en?: string | null
          public_summary_th?: string | null
          public_title_en?: string | null
          public_title_th?: string | null
          published?: boolean
          sites?: string | null
          source?: string | null
          start_date?: string | null
          topics?: string | null
          updated_at?: string
          visit_type?: string | null
        }
        Update: {
          cover_attachment_id?: string | null
          created_at?: string
          end_date?: string | null
          id?: string
          location?: string | null
          meeting_notes?: string | null
          notes?: string | null
          outcomes?: string | null
          participants?: string | null
          public_summary_en?: string | null
          public_summary_th?: string | null
          public_title_en?: string | null
          public_title_th?: string | null
          published?: boolean
          sites?: string | null
          source?: string | null
          start_date?: string | null
          topics?: string | null
          updated_at?: string
          visit_type?: string | null
        }
        Relationships: []
      }
      user_roles: {
        Row: {
          created_at: string
          id: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Update: {
          created_at?: string
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
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
    }
    Enums: {
      app_role: "learner" | "staff" | "admin" | "trainer" | "superadmin"
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
      app_role: ["learner", "staff", "admin", "trainer", "superadmin"],
    },
  },
} as const
