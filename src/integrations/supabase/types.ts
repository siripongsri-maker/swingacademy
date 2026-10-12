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
      ai_runs: {
        Row: {
          created_at: string
          created_by: string | null
          error: string | null
          id: string
          input_chars: number | null
          input_hash: string | null
          latency_ms: number | null
          model: string | null
          object_id: string | null
          object_type: string | null
          output_json: Json | null
          output_text: string | null
          params: Json | null
          prompt_version: string | null
          provider_host: string | null
          purpose: string
          status: string
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          error?: string | null
          id?: string
          input_chars?: number | null
          input_hash?: string | null
          latency_ms?: number | null
          model?: string | null
          object_id?: string | null
          object_type?: string | null
          output_json?: Json | null
          output_text?: string | null
          params?: Json | null
          prompt_version?: string | null
          provider_host?: string | null
          purpose: string
          status?: string
        }
        Update: {
          created_at?: string
          created_by?: string | null
          error?: string | null
          id?: string
          input_chars?: number | null
          input_hash?: string | null
          latency_ms?: number | null
          model?: string | null
          object_id?: string | null
          object_type?: string | null
          output_json?: Json | null
          output_text?: string | null
          params?: Json | null
          prompt_version?: string | null
          provider_host?: string | null
          purpose?: string
          status?: string
        }
        Relationships: []
      }
      assignments: {
        Row: {
          created_at: string
          created_by: string
          due_at: string | null
          id: string
          instructions: string | null
          lesson_id: string
          title: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          created_by: string
          due_at?: string | null
          id?: string
          instructions?: string | null
          lesson_id: string
          title: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          created_by?: string
          due_at?: string | null
          id?: string
          instructions?: string | null
          lesson_id?: string
          title?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "assignments_lesson_id_fkey"
            columns: ["lesson_id"]
            isOneToOne: false
            referencedRelation: "lessons"
            referencedColumns: ["id"]
          },
        ]
      }
      audit_events: {
        Row: {
          action: string
          actor_id: string | null
          created_at: string
          details: Json | null
          id: string
          object_id: string | null
          object_type: string | null
          purpose: string | null
        }
        Insert: {
          action: string
          actor_id?: string | null
          created_at?: string
          details?: Json | null
          id?: string
          object_id?: string | null
          object_type?: string | null
          purpose?: string | null
        }
        Update: {
          action?: string
          actor_id?: string | null
          created_at?: string
          details?: Json | null
          id?: string
          object_id?: string | null
          object_type?: string | null
          purpose?: string | null
        }
        Relationships: []
      }
      baseline_items: {
        Row: {
          artifacts: string | null
          audience: string | null
          confidence: string | null
          content_chars: number | null
          content_md: string | null
          created_at: string
          created_by: string | null
          date_end: string | null
          date_note: string | null
          date_start: string | null
          evidence: string | null
          external_id: string
          format: string | null
          has_action_items: boolean | null
          id: string
          import_batch: string | null
          item_type: string | null
          knowledge_level: string
          language: string | null
          linked_item: string | null
          notes: string | null
          organiser: string | null
          sample_set: string | null
          sensitivity: string | null
          sensitivity_note: string | null
          source: string
          source_group: string | null
          source_url: string | null
          status: string | null
          swing_role: string | null
          title: string
          topic_area: string | null
          updated_at: string
          verified: boolean
        }
        Insert: {
          artifacts?: string | null
          audience?: string | null
          confidence?: string | null
          content_chars?: number | null
          content_md?: string | null
          created_at?: string
          created_by?: string | null
          date_end?: string | null
          date_note?: string | null
          date_start?: string | null
          evidence?: string | null
          external_id: string
          format?: string | null
          has_action_items?: boolean | null
          id?: string
          import_batch?: string | null
          item_type?: string | null
          knowledge_level?: string
          language?: string | null
          linked_item?: string | null
          notes?: string | null
          organiser?: string | null
          sample_set?: string | null
          sensitivity?: string | null
          sensitivity_note?: string | null
          source: string
          source_group?: string | null
          source_url?: string | null
          status?: string | null
          swing_role?: string | null
          title: string
          topic_area?: string | null
          updated_at?: string
          verified?: boolean
        }
        Update: {
          artifacts?: string | null
          audience?: string | null
          confidence?: string | null
          content_chars?: number | null
          content_md?: string | null
          created_at?: string
          created_by?: string | null
          date_end?: string | null
          date_note?: string | null
          date_start?: string | null
          evidence?: string | null
          external_id?: string
          format?: string | null
          has_action_items?: boolean | null
          id?: string
          import_batch?: string | null
          item_type?: string | null
          knowledge_level?: string
          language?: string | null
          linked_item?: string | null
          notes?: string | null
          organiser?: string | null
          sample_set?: string | null
          sensitivity?: string | null
          sensitivity_note?: string | null
          source?: string
          source_group?: string | null
          source_url?: string | null
          status?: string | null
          swing_role?: string | null
          title?: string
          topic_area?: string | null
          updated_at?: string
          verified?: boolean
        }
        Relationships: []
      }
      capture_sessions: {
        Row: {
          audio_bytes: number | null
          audio_path: string | null
          audio_sha256: string | null
          audio_uploaded_at: string | null
          audio_uploaded_by: string | null
          code: string
          created_at: string
          created_by: string | null
          department: string | null
          duration_sec: number | null
          facilitator_id: string | null
          held_at: string | null
          id: string
          notes: string | null
          out_of_scope_attested: boolean
          out_of_scope_attested_by: string | null
          retention_until: string | null
          session_type: string
          site: string | null
          speaker_guidance_given_at: string | null
          speaker_guidance_given_by: string | null
          speaker_guidance_version: string | null
          status: string
          study_month: number | null
          title: string | null
          updated_at: string
        }
        Insert: {
          audio_bytes?: number | null
          audio_path?: string | null
          audio_sha256?: string | null
          audio_uploaded_at?: string | null
          audio_uploaded_by?: string | null
          code?: string
          created_at?: string
          created_by?: string | null
          department?: string | null
          duration_sec?: number | null
          facilitator_id?: string | null
          held_at?: string | null
          id?: string
          notes?: string | null
          out_of_scope_attested?: boolean
          out_of_scope_attested_by?: string | null
          retention_until?: string | null
          session_type: string
          site?: string | null
          speaker_guidance_given_at?: string | null
          speaker_guidance_given_by?: string | null
          speaker_guidance_version?: string | null
          status?: string
          study_month?: number | null
          title?: string | null
          updated_at?: string
        }
        Update: {
          audio_bytes?: number | null
          audio_path?: string | null
          audio_sha256?: string | null
          audio_uploaded_at?: string | null
          audio_uploaded_by?: string | null
          code?: string
          created_at?: string
          created_by?: string | null
          department?: string | null
          duration_sec?: number | null
          facilitator_id?: string | null
          held_at?: string | null
          id?: string
          notes?: string | null
          out_of_scope_attested?: boolean
          out_of_scope_attested_by?: string | null
          retention_until?: string | null
          session_type?: string
          site?: string | null
          speaker_guidance_given_at?: string | null
          speaker_guidance_given_by?: string | null
          speaker_guidance_version?: string | null
          status?: string
          study_month?: number | null
          title?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      classrooms: {
        Row: {
          cover_url: string | null
          created_at: string
          description: string | null
          id: string
          owner_id: string
          title: string
          updated_at: string
        }
        Insert: {
          cover_url?: string | null
          created_at?: string
          description?: string | null
          id?: string
          owner_id: string
          title: string
          updated_at?: string
        }
        Update: {
          cover_url?: string | null
          created_at?: string
          description?: string | null
          id?: string
          owner_id?: string
          title?: string
          updated_at?: string
        }
        Relationships: []
      }
      consent_form_versions: {
        Row: {
          approved_at: string | null
          approved_ref: string | null
          created_at: string
          created_by: string | null
          id: string
          items: Json
          status: string
          title: string
          version: string
        }
        Insert: {
          approved_at?: string | null
          approved_ref?: string | null
          created_at?: string
          created_by?: string | null
          id?: string
          items?: Json
          status?: string
          title: string
          version: string
        }
        Update: {
          approved_at?: string | null
          approved_ref?: string | null
          created_at?: string
          created_by?: string | null
          id?: string
          items?: Json
          status?: string
          title?: string
          version?: string
        }
        Relationships: []
      }
      consent_revisions: {
        Row: {
          changed_at: string
          changed_by: string | null
          consent_id: string
          form_version_id: string
          id: string
          item_key: string
          old_decision: string
          old_given_at: string
          old_method: string
          old_paper_ref: string | null
          old_taken_by: string | null
          participant_id: string
        }
        Insert: {
          changed_at?: string
          changed_by?: string | null
          consent_id: string
          form_version_id: string
          id?: string
          item_key: string
          old_decision: string
          old_given_at: string
          old_method: string
          old_paper_ref?: string | null
          old_taken_by?: string | null
          participant_id: string
        }
        Update: {
          changed_at?: string
          changed_by?: string | null
          consent_id?: string
          form_version_id?: string
          id?: string
          item_key?: string
          old_decision?: string
          old_given_at?: string
          old_method?: string
          old_paper_ref?: string | null
          old_taken_by?: string | null
          participant_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "consent_revisions_consent_id_fkey"
            columns: ["consent_id"]
            isOneToOne: false
            referencedRelation: "consents"
            referencedColumns: ["id"]
          },
        ]
      }
      consents: {
        Row: {
          created_at: string
          decision: string
          form_version_id: string
          given_at: string
          id: string
          item_key: string
          method: string
          paper_ref: string | null
          participant_id: string
          taken_by: string
          withdrawn_at: string | null
          withdrawn_recorded_by: string | null
        }
        Insert: {
          created_at?: string
          decision: string
          form_version_id: string
          given_at: string
          id?: string
          item_key: string
          method: string
          paper_ref?: string | null
          participant_id: string
          taken_by?: string
          withdrawn_at?: string | null
          withdrawn_recorded_by?: string | null
        }
        Update: {
          created_at?: string
          decision?: string
          form_version_id?: string
          given_at?: string
          id?: string
          item_key?: string
          method?: string
          paper_ref?: string | null
          participant_id?: string
          taken_by?: string
          withdrawn_at?: string | null
          withdrawn_recorded_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "consents_form_version_id_fkey"
            columns: ["form_version_id"]
            isOneToOne: false
            referencedRelation: "consent_form_versions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "consents_participant_id_fkey"
            columns: ["participant_id"]
            isOneToOne: false
            referencedRelation: "participants"
            referencedColumns: ["id"]
          },
        ]
      }
      course_files: {
        Row: {
          course_id: string
          created_at: string
          file_name: string
          file_path: string
          id: string
          lesson_id: string | null
          mime: string | null
          size: number | null
          uploaded_by: string
        }
        Insert: {
          course_id: string
          created_at?: string
          file_name: string
          file_path: string
          id?: string
          lesson_id?: string | null
          mime?: string | null
          size?: number | null
          uploaded_by: string
        }
        Update: {
          course_id?: string
          created_at?: string
          file_name?: string
          file_path?: string
          id?: string
          lesson_id?: string | null
          mime?: string | null
          size?: number | null
          uploaded_by?: string
        }
        Relationships: [
          {
            foreignKeyName: "course_files_course_id_fkey"
            columns: ["course_id"]
            isOneToOne: false
            referencedRelation: "courses"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "course_files_lesson_id_fkey"
            columns: ["lesson_id"]
            isOneToOne: false
            referencedRelation: "lessons"
            referencedColumns: ["id"]
          },
        ]
      }
      courses: {
        Row: {
          classroom_id: string
          cover_url: string | null
          created_at: string
          description: string | null
          id: string
          order_index: number
          owner_id: string
          slug: string
          title: string
          updated_at: string
        }
        Insert: {
          classroom_id: string
          cover_url?: string | null
          created_at?: string
          description?: string | null
          id?: string
          order_index?: number
          owner_id: string
          slug: string
          title: string
          updated_at?: string
        }
        Update: {
          classroom_id?: string
          cover_url?: string | null
          created_at?: string
          description?: string | null
          id?: string
          order_index?: number
          owner_id?: string
          slug?: string
          title?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "courses_classroom_id_fkey"
            columns: ["classroom_id"]
            isOneToOne: false
            referencedRelation: "classrooms"
            referencedColumns: ["id"]
          },
        ]
      }
      enrollments: {
        Row: {
          classroom_id: string
          created_at: string
          id: string
          role_in_class: Database["public"]["Enums"]["class_role"]
          user_id: string
        }
        Insert: {
          classroom_id: string
          created_at?: string
          id?: string
          role_in_class?: Database["public"]["Enums"]["class_role"]
          user_id: string
        }
        Update: {
          classroom_id?: string
          created_at?: string
          id?: string
          role_in_class?: Database["public"]["Enums"]["class_role"]
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "enrollments_classroom_id_fkey"
            columns: ["classroom_id"]
            isOneToOne: false
            referencedRelation: "classrooms"
            referencedColumns: ["id"]
          },
        ]
      }
      knowledge_activity_logs: {
        Row: {
          action: string
          actor_id: string | null
          attachment_content_type: string | null
          attachment_name: string | null
          attachment_path: string | null
          attachment_size: number | null
          created_at: string
          details: Json
          id: string
          knowledge_id: string
        }
        Insert: {
          action: string
          actor_id?: string | null
          attachment_content_type?: string | null
          attachment_name?: string | null
          attachment_path?: string | null
          attachment_size?: number | null
          created_at?: string
          details?: Json
          id?: string
          knowledge_id: string
        }
        Update: {
          action?: string
          actor_id?: string | null
          attachment_content_type?: string | null
          attachment_name?: string | null
          attachment_path?: string | null
          attachment_size?: number | null
          created_at?: string
          details?: Json
          id?: string
          knowledge_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "knowledge_activity_logs_knowledge_id_fkey"
            columns: ["knowledge_id"]
            isOneToOne: false
            referencedRelation: "knowledge_products"
            referencedColumns: ["id"]
          },
        ]
      }
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
      knowledge_ratings: {
        Row: {
          comment: string | null
          created_at: string
          id: string
          knowledge_id: string | null
          rater_hash: string
          rating: number
          slug: string
          updated_at: string
        }
        Insert: {
          comment?: string | null
          created_at?: string
          id?: string
          knowledge_id?: string | null
          rater_hash: string
          rating: number
          slug: string
          updated_at?: string
        }
        Update: {
          comment?: string | null
          created_at?: string
          id?: string
          knowledge_id?: string | null
          rater_hash?: string
          rating?: number
          slug?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "knowledge_ratings_knowledge_id_fkey"
            columns: ["knowledge_id"]
            isOneToOne: false
            referencedRelation: "knowledge_products"
            referencedColumns: ["id"]
          },
        ]
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
      knowledge_translations: {
        Row: {
          asset_id: string
          audience: string
          contributor_id: string | null
          created_at: string
          format: string
          hero_image_url: string | null
          id: string
          instruction: string
          language: string
          output_md: string
          owner_id: string | null
          published_at: string | null
          status: string
          title: string | null
          tone: string
          updated_at: string
        }
        Insert: {
          asset_id: string
          audience?: string
          contributor_id?: string | null
          created_at?: string
          format?: string
          hero_image_url?: string | null
          id?: string
          instruction?: string
          language?: string
          output_md?: string
          owner_id?: string | null
          published_at?: string | null
          status?: string
          title?: string | null
          tone?: string
          updated_at?: string
        }
        Update: {
          asset_id?: string
          audience?: string
          contributor_id?: string | null
          created_at?: string
          format?: string
          hero_image_url?: string | null
          id?: string
          instruction?: string
          language?: string
          output_md?: string
          owner_id?: string | null
          published_at?: string | null
          status?: string
          title?: string | null
          tone?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "knowledge_translations_asset_id_fkey"
            columns: ["asset_id"]
            isOneToOne: false
            referencedRelation: "knowledge_products"
            referencedColumns: ["id"]
          },
        ]
      }
      knowledge_views: {
        Row: {
          created_at: string
          id: string
          knowledge_id: string | null
          slug: string
          user_agent: string | null
          viewer_hash: string | null
        }
        Insert: {
          created_at?: string
          id?: string
          knowledge_id?: string | null
          slug: string
          user_agent?: string | null
          viewer_hash?: string | null
        }
        Update: {
          created_at?: string
          id?: string
          knowledge_id?: string | null
          slug?: string
          user_agent?: string | null
          viewer_hash?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "knowledge_views_knowledge_id_fkey"
            columns: ["knowledge_id"]
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
      lesson_notes: {
        Row: {
          body: string
          course_id: string
          created_at: string
          id: string
          lesson_id: string
          updated_at: string
          user_id: string
          visibility: Database["public"]["Enums"]["note_visibility"]
        }
        Insert: {
          body?: string
          course_id: string
          created_at?: string
          id?: string
          lesson_id: string
          updated_at?: string
          user_id: string
          visibility?: Database["public"]["Enums"]["note_visibility"]
        }
        Update: {
          body?: string
          course_id?: string
          created_at?: string
          id?: string
          lesson_id?: string
          updated_at?: string
          user_id?: string
          visibility?: Database["public"]["Enums"]["note_visibility"]
        }
        Relationships: [
          {
            foreignKeyName: "lesson_notes_course_id_fkey"
            columns: ["course_id"]
            isOneToOne: false
            referencedRelation: "courses"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "lesson_notes_lesson_id_fkey"
            columns: ["lesson_id"]
            isOneToOne: false
            referencedRelation: "lessons"
            referencedColumns: ["id"]
          },
        ]
      }
      lessons: {
        Row: {
          body_md: string | null
          course_id: string
          created_at: string
          id: string
          order_index: number
          owner_id: string
          title: string
          updated_at: string
        }
        Insert: {
          body_md?: string | null
          course_id: string
          created_at?: string
          id?: string
          order_index?: number
          owner_id: string
          title: string
          updated_at?: string
        }
        Update: {
          body_md?: string | null
          course_id?: string
          created_at?: string
          id?: string
          order_index?: number
          owner_id?: string
          title?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "lessons_course_id_fkey"
            columns: ["course_id"]
            isOneToOne: false
            referencedRelation: "courses"
            referencedColumns: ["id"]
          },
        ]
      }
      participant_identity: {
        Row: {
          contact: string | null
          full_name: string
          note: string | null
          participant_id: string
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          contact?: string | null
          full_name: string
          note?: string | null
          participant_id: string
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          contact?: string | null
          full_name?: string
          note?: string | null
          participant_id?: string
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "participant_identity_participant_id_fkey"
            columns: ["participant_id"]
            isOneToOne: true
            referencedRelation: "participants"
            referencedColumns: ["id"]
          },
        ]
      }
      participants: {
        Row: {
          active: boolean
          created_at: string
          created_by: string | null
          department: string | null
          experience_tier: string | null
          id: string
          pseudo_code: string
          roles: string[]
          site: string | null
        }
        Insert: {
          active?: boolean
          created_at?: string
          created_by?: string | null
          department?: string | null
          experience_tier?: string | null
          id?: string
          pseudo_code?: string
          roles?: string[]
          site?: string | null
        }
        Update: {
          active?: boolean
          created_at?: string
          created_by?: string | null
          department?: string | null
          experience_tier?: string | null
          id?: string
          pseudo_code?: string
          roles?: string[]
          site?: string | null
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
      research_members: {
        Row: {
          active: boolean
          created_at: string | null
          created_by: string | null
          department: string | null
          id: string
          note: string | null
          role: Database["public"]["Enums"]["research_role"]
          user_id: string
        }
        Insert: {
          active?: boolean
          created_at?: string | null
          created_by?: string | null
          department?: string | null
          id?: string
          note?: string | null
          role: Database["public"]["Enums"]["research_role"]
          user_id: string
        }
        Update: {
          active?: boolean
          created_at?: string | null
          created_by?: string | null
          department?: string | null
          id?: string
          note?: string | null
          role?: Database["public"]["Enums"]["research_role"]
          user_id?: string
        }
        Relationships: []
      }
      session_participants: {
        Row: {
          added_at: string
          added_by: string | null
          participant_id: string
          role: string
          session_id: string
        }
        Insert: {
          added_at?: string
          added_by?: string | null
          participant_id: string
          role?: string
          session_id: string
        }
        Update: {
          added_at?: string
          added_by?: string | null
          participant_id?: string
          role?: string
          session_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "session_participants_participant_id_fkey"
            columns: ["participant_id"]
            isOneToOne: false
            referencedRelation: "participants"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "session_participants_session_id_fkey"
            columns: ["session_id"]
            isOneToOne: false
            referencedRelation: "capture_sessions"
            referencedColumns: ["id"]
          },
        ]
      }
      site_visits: {
        Row: {
          created_at: string
          id: string
          path: string
          user_agent: string | null
          visitor_hash: string | null
        }
        Insert: {
          created_at?: string
          id?: string
          path?: string
          user_agent?: string | null
          visitor_hash?: string | null
        }
        Update: {
          created_at?: string
          id?: string
          path?: string
          user_agent?: string | null
          visitor_hash?: string | null
        }
        Relationships: []
      }
      study_settings: {
        Row: {
          collection_unlocked: boolean
          departments: string[]
          ethics_approved_at: string | null
          ethics_ref: string | null
          foundation_permission_at: string | null
          id: number
          mou_signed_at: string | null
          retention_years: number
          sites: string[]
          speaker_guidance_version: string | null
          study_end: string | null
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          collection_unlocked?: boolean
          departments?: string[]
          ethics_approved_at?: string | null
          ethics_ref?: string | null
          foundation_permission_at?: string | null
          id?: number
          mou_signed_at?: string | null
          retention_years?: number
          sites?: string[]
          speaker_guidance_version?: string | null
          study_end?: string | null
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          collection_unlocked?: boolean
          departments?: string[]
          ethics_approved_at?: string | null
          ethics_ref?: string | null
          foundation_permission_at?: string | null
          id?: number
          mou_signed_at?: string | null
          retention_years?: number
          sites?: string[]
          speaker_guidance_version?: string | null
          study_end?: string | null
          updated_at?: string
          updated_by?: string | null
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
      voice_records: {
        Row: {
          course_id: string | null
          created_at: string
          duration_sec: number | null
          file_path: string
          id: string
          lesson_id: string | null
          mime: string | null
          title: string | null
          user_id: string
        }
        Insert: {
          course_id?: string | null
          created_at?: string
          duration_sec?: number | null
          file_path: string
          id?: string
          lesson_id?: string | null
          mime?: string | null
          title?: string | null
          user_id: string
        }
        Update: {
          course_id?: string | null
          created_at?: string
          duration_sec?: number | null
          file_path?: string
          id?: string
          lesson_id?: string | null
          mime?: string | null
          title?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "voice_records_course_id_fkey"
            columns: ["course_id"]
            isOneToOne: false
            referencedRelation: "courses"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "voice_records_lesson_id_fkey"
            columns: ["lesson_id"]
            isOneToOne: false
            referencedRelation: "lessons"
            referencedColumns: ["id"]
          },
        ]
      }
      withdrawal_events: {
        Row: {
          id: string
          note: string | null
          participant_id: string
          recorded_at: string
          recorded_by: string
          scope: string
          sessions_put_on_hold: number
        }
        Insert: {
          id?: string
          note?: string | null
          participant_id: string
          recorded_at?: string
          recorded_by?: string
          scope: string
          sessions_put_on_hold?: number
        }
        Update: {
          id?: string
          note?: string | null
          participant_id?: string
          recorded_at?: string
          recorded_by?: string
          scope?: string
          sessions_put_on_hold?: number
        }
        Relationships: [
          {
            foreignKeyName: "withdrawal_events_participant_id_fkey"
            columns: ["participant_id"]
            isOneToOne: false
            referencedRelation: "participants"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      active_participant_codes: {
        Args: never
        Returns: {
          department: string
          id: string
          pseudo_code: string
          site: string
        }[]
      }
      apply_withdrawal: {
        Args: { _note: string; _participant: string; _scope: string }
        Returns: number
      }
      can_work_on_department: {
        Args: { _department: string; _user_id: string }
        Returns: boolean
      }
      has_research_role: {
        Args: {
          _role: Database["public"]["Enums"]["research_role"]
          _user_id: string
        }
        Returns: boolean
      }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      is_admin_user: { Args: { _user_id: string }; Returns: boolean }
      is_class_staff: {
        Args: { _classroom: string; _user: string }
        Returns: boolean
      }
      is_consent_keeper: { Args: { _user_id: string }; Returns: boolean }
      is_deid_assistant: { Args: { _user_id: string }; Returns: boolean }
      is_enrolled: {
        Args: { _classroom: string; _user: string }
        Returns: boolean
      }
      is_research_member: { Args: { _user_id: string }; Returns: boolean }
      is_session_worker: { Args: { _user_id: string }; Returns: boolean }
      is_staff_member: { Args: { _user_id: string }; Returns: boolean }
      participant_active_flags: {
        Args: never
        Returns: {
          active: boolean
          participant_id: string
        }[]
      }
      participant_cleared: {
        Args: { _gate: string; _participant: string }
        Returns: boolean
      }
      session_clearance: { Args: { _session: string }; Returns: Json }
    }
    Enums: {
      app_role: "learner" | "staff" | "admin" | "trainer" | "superadmin"
      class_role: "learner" | "trainer"
      note_visibility: "private" | "class"
      research_role:
        | "researcher"
        | "consent_officer"
        | "dept_coordinator"
        | "expert"
        | "dignity_panel"
        | "data_steward"
        | "deid_assistant"
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
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never) = never,
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
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
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
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
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
  EnumName extends (DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never) = never,
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
  CompositeTypeName extends (PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never) = never,
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
      class_role: ["learner", "trainer"],
      note_visibility: ["private", "class"],
      research_role: [
        "researcher",
        "consent_officer",
        "dept_coordinator",
        "expert",
        "dignity_panel",
        "data_steward",
        "deid_assistant",
      ],
    },
  },
} as const
