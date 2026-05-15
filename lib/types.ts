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
      api_keys: {
        Row: {
          created_at: string
          id: string
          key_hash: string
          last_used_at: string | null
          name: string
          prefix: string
          revoked_at: string | null
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          key_hash: string
          last_used_at?: string | null
          name: string
          prefix: string
          revoked_at?: string | null
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          key_hash?: string
          last_used_at?: string | null
          name?: string
          prefix?: string
          revoked_at?: string | null
          user_id?: string
        }
        Relationships: []
      }
      budget_event_components: {
        Row: {
          amount: number
          budget_event_id: string
          category: Database["public"]["Enums"]["expenditure_category"]
          created_at: string
          definition: string | null
          id: string
          line_or_cell_reference: string | null
        }
        Insert: {
          amount: number
          budget_event_id: string
          category: Database["public"]["Enums"]["expenditure_category"]
          created_at?: string
          definition?: string | null
          id?: string
          line_or_cell_reference?: string | null
        }
        Update: {
          amount?: number
          budget_event_id?: string
          category?: Database["public"]["Enums"]["expenditure_category"]
          created_at?: string
          definition?: string | null
          id?: string
          line_or_cell_reference?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "budget_event_components_budget_event_id_fkey"
            columns: ["budget_event_id"]
            isOneToOne: false
            referencedRelation: "budget_events"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "budget_event_components_budget_event_id_fkey"
            columns: ["budget_event_id"]
            isOneToOne: false
            referencedRelation: "budget_events_current"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "budget_event_components_budget_event_id_fkey"
            columns: ["budget_event_id"]
            isOneToOne: false
            referencedRelation: "unverified_events_high_priority"
            referencedColumns: ["event_id"]
          },
          {
            foreignKeyName: "budget_event_components_budget_event_id_fkey"
            columns: ["budget_event_id"]
            isOneToOne: false
            referencedRelation: "v_district_full_spend"
            referencedColumns: ["budget_event_id"]
          },
          {
            foreignKeyName: "budget_event_components_budget_event_id_fkey"
            columns: ["budget_event_id"]
            isOneToOne: false
            referencedRelation: "v_per_pupil_metrics"
            referencedColumns: ["budget_event_id"]
          },
          {
            foreignKeyName: "budget_event_components_budget_event_id_fkey"
            columns: ["budget_event_id"]
            isOneToOne: false
            referencedRelation: "verifications_pending_review"
            referencedColumns: ["event_id"]
          },
        ]
      }
      budget_events: {
        Row: {
          created_at: string
          event_date: string | null
          extraction_run_id: string | null
          fiscal_year: number
          id: string
          is_superseded: boolean
          leaid: string
          prior_year_baseline: number | null
          source_document_id: string
          status: Database["public"]["Enums"]["budget_status"]
          topline_amount: number
          topline_definition: string | null
          updated_at: string
          verification_notes: string | null
          verification_status: Database["public"]["Enums"]["verification_status"]
          verified_at: string | null
          verified_by: string | null
          yoy_change_dollars: number | null
          yoy_change_pct: number | null
        }
        Insert: {
          created_at?: string
          event_date?: string | null
          extraction_run_id?: string | null
          fiscal_year: number
          id?: string
          is_superseded?: boolean
          leaid: string
          prior_year_baseline?: number | null
          source_document_id: string
          status: Database["public"]["Enums"]["budget_status"]
          topline_amount: number
          topline_definition?: string | null
          updated_at?: string
          verification_notes?: string | null
          verification_status?: Database["public"]["Enums"]["verification_status"]
          verified_at?: string | null
          verified_by?: string | null
          yoy_change_dollars?: number | null
          yoy_change_pct?: number | null
        }
        Update: {
          created_at?: string
          event_date?: string | null
          extraction_run_id?: string | null
          fiscal_year?: number
          id?: string
          is_superseded?: boolean
          leaid?: string
          prior_year_baseline?: number | null
          source_document_id?: string
          status?: Database["public"]["Enums"]["budget_status"]
          topline_amount?: number
          topline_definition?: string | null
          updated_at?: string
          verification_notes?: string | null
          verification_status?: Database["public"]["Enums"]["verification_status"]
          verified_at?: string | null
          verified_by?: string | null
          yoy_change_dollars?: number | null
          yoy_change_pct?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "budget_events_extraction_run_id_fkey"
            columns: ["extraction_run_id"]
            isOneToOne: false
            referencedRelation: "extraction_runs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "budget_events_leaid_fkey"
            columns: ["leaid"]
            isOneToOne: false
            referencedRelation: "districts"
            referencedColumns: ["leaid"]
          },
          {
            foreignKeyName: "budget_events_source_document_id_fkey"
            columns: ["source_document_id"]
            isOneToOne: false
            referencedRelation: "source_documents"
            referencedColumns: ["id"]
          },
        ]
      }
      cooperative_membership: {
        Row: {
          allocation_basis: string | null
          allocation_share: number | null
          cooperative_leaid: string
          created_at: string
          fiscal_year: number
          member_leaid: string
          updated_at: string
        }
        Insert: {
          allocation_basis?: string | null
          allocation_share?: number | null
          cooperative_leaid: string
          created_at?: string
          fiscal_year: number
          member_leaid: string
          updated_at?: string
        }
        Update: {
          allocation_basis?: string | null
          allocation_share?: number | null
          cooperative_leaid?: string
          created_at?: string
          fiscal_year?: number
          member_leaid?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "cooperative_membership_cooperative_leaid_fkey"
            columns: ["cooperative_leaid"]
            isOneToOne: false
            referencedRelation: "districts"
            referencedColumns: ["leaid"]
          },
          {
            foreignKeyName: "cooperative_membership_member_leaid_fkey"
            columns: ["member_leaid"]
            isOneToOne: false
            referencedRelation: "districts"
            referencedColumns: ["leaid"]
          },
        ]
      }
      districts: {
        Row: {
          county_name: string | null
          created_at: string
          data_tier: number | null
          enrollment_fy25: number | null
          entity_type: string
          exp_total_fy23: number | null
          fy_calendar: string | null
          is_operating_district: boolean
          lea_name: string
          leaid: string
          state_leaid: string | null
          state_postal: string
          updated_at: string
        }
        Insert: {
          county_name?: string | null
          created_at?: string
          data_tier?: number | null
          enrollment_fy25?: number | null
          entity_type?: string
          exp_total_fy23?: number | null
          fy_calendar?: string | null
          is_operating_district?: boolean
          lea_name: string
          leaid: string
          state_leaid?: string | null
          state_postal: string
          updated_at?: string
        }
        Update: {
          county_name?: string | null
          created_at?: string
          data_tier?: number | null
          enrollment_fy25?: number | null
          entity_type?: string
          exp_total_fy23?: number | null
          fy_calendar?: string | null
          is_operating_district?: boolean
          lea_name?: string
          leaid?: string
          state_leaid?: string | null
          state_postal?: string
          updated_at?: string
        }
        Relationships: []
      }
      extraction_runs: {
        Row: {
          error_summary: string | null
          extractor_name: string
          finished_at: string | null
          git_commit_sha: string | null
          id: string
          records_changed: number | null
          records_extracted: number | null
          started_at: string
          status: Database["public"]["Enums"]["extraction_run_status"]
          triggered_by: Database["public"]["Enums"]["extraction_trigger"]
        }
        Insert: {
          error_summary?: string | null
          extractor_name: string
          finished_at?: string | null
          git_commit_sha?: string | null
          id?: string
          records_changed?: number | null
          records_extracted?: number | null
          started_at?: string
          status?: Database["public"]["Enums"]["extraction_run_status"]
          triggered_by?: Database["public"]["Enums"]["extraction_trigger"]
        }
        Update: {
          error_summary?: string | null
          extractor_name?: string
          finished_at?: string | null
          git_commit_sha?: string | null
          id?: string
          records_changed?: number | null
          records_extracted?: number | null
          started_at?: string
          status?: Database["public"]["Enums"]["extraction_run_status"]
          triggered_by?: Database["public"]["Enums"]["extraction_trigger"]
        }
        Relationships: []
      }
      extractor_triggers: {
        Row: {
          created_at: string
          error_summary: string | null
          extraction_run_id: string | null
          finished_at: string | null
          fiscal_year: number | null
          github_run_id: number | null
          id: string
          log_url: string | null
          module: string
          status: string
          triggered_by_user: string | null
        }
        Insert: {
          created_at?: string
          error_summary?: string | null
          extraction_run_id?: string | null
          finished_at?: string | null
          fiscal_year?: number | null
          github_run_id?: number | null
          id?: string
          log_url?: string | null
          module: string
          status: string
          triggered_by_user?: string | null
        }
        Update: {
          created_at?: string
          error_summary?: string | null
          extraction_run_id?: string | null
          finished_at?: string | null
          fiscal_year?: number | null
          github_run_id?: number | null
          id?: string
          log_url?: string | null
          module?: string
          status?: string
          triggered_by_user?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "extractor_triggers_extraction_run_id_fkey"
            columns: ["extraction_run_id"]
            isOneToOne: false
            referencedRelation: "extraction_runs"
            referencedColumns: ["id"]
          },
        ]
      }
      probe_runs: {
        Row: {
          applied: boolean
          id: string
          n_hits: number
          n_misses: number
          ran_at: string
          results: Json
          triggered_by: string
          triggered_by_user: string | null
        }
        Insert: {
          applied?: boolean
          id?: string
          n_hits?: number
          n_misses?: number
          ran_at?: string
          results: Json
          triggered_by?: string
          triggered_by_user?: string | null
        }
        Update: {
          applied?: boolean
          id?: string
          n_hits?: number
          n_misses?: number
          ran_at?: string
          results?: Json
          triggered_by?: string
          triggered_by_user?: string | null
        }
        Relationships: []
      }
      researcher_allowlist: {
        Row: {
          email: string
          invited_at: string
          invited_by: string | null
          note: string | null
          revoked_at: string | null
        }
        Insert: {
          email: string
          invited_at?: string
          invited_by?: string | null
          note?: string | null
          revoked_at?: string | null
        }
        Update: {
          email?: string
          invited_at?: string
          invited_by?: string | null
          note?: string | null
          revoked_at?: string | null
        }
        Relationships: []
      }
      source_documents: {
        Row: {
          content_hash_sha256: string | null
          created_at: string
          document_type: string | null
          fetched_at: string
          id: string
          line_or_cell_reference: string | null
          mime_type: string | null
          notes: string | null
          page_number: number | null
          publisher: string | null
          source_url: string | null
          storage_path: string | null
          updated_at: string
        }
        Insert: {
          content_hash_sha256?: string | null
          created_at?: string
          document_type?: string | null
          fetched_at?: string
          id?: string
          line_or_cell_reference?: string | null
          mime_type?: string | null
          notes?: string | null
          page_number?: number | null
          publisher?: string | null
          source_url?: string | null
          storage_path?: string | null
          updated_at?: string
        }
        Update: {
          content_hash_sha256?: string | null
          created_at?: string
          document_type?: string | null
          fetched_at?: string
          id?: string
          line_or_cell_reference?: string | null
          mime_type?: string | null
          notes?: string | null
          page_number?: number | null
          publisher?: string | null
          source_url?: string | null
          storage_path?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      state_calendars: {
        Row: {
          adoption_deadline: string | null
          created_at: string
          fiscal_year: number
          notes: string | null
          oversight_review_deadline: string | null
          proposed_window_end: string | null
          proposed_window_start: string | null
          state_postal: string
          statute_citation: string | null
          updated_at: string
        }
        Insert: {
          adoption_deadline?: string | null
          created_at?: string
          fiscal_year: number
          notes?: string | null
          oversight_review_deadline?: string | null
          proposed_window_end?: string | null
          proposed_window_start?: string | null
          state_postal: string
          statute_citation?: string | null
          updated_at?: string
        }
        Update: {
          adoption_deadline?: string | null
          created_at?: string
          fiscal_year?: number
          notes?: string | null
          oversight_review_deadline?: string | null
          proposed_window_end?: string | null
          proposed_window_start?: string | null
          state_postal?: string
          statute_citation?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      state_extractor_metadata: {
        Row: {
          coverage_tier: string
          state_postal: string
          tier_rationale: string | null
          updated_at: string
        }
        Insert: {
          coverage_tier: string
          state_postal: string
          tier_rationale?: string | null
          updated_at?: string
        }
        Update: {
          coverage_tier?: string
          state_postal?: string
          tier_rationale?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      verification_log: {
        Row: {
          action: string
          actor: string
          budget_event_id: string
          created_at: string
          id: string
          new_status: string | null
          notes: string | null
          previous_status: string | null
        }
        Insert: {
          action: string
          actor: string
          budget_event_id: string
          created_at?: string
          id?: string
          new_status?: string | null
          notes?: string | null
          previous_status?: string | null
        }
        Update: {
          action?: string
          actor?: string
          budget_event_id?: string
          created_at?: string
          id?: string
          new_status?: string | null
          notes?: string | null
          previous_status?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "verification_log_budget_event_id_fkey"
            columns: ["budget_event_id"]
            isOneToOne: false
            referencedRelation: "budget_events"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "verification_log_budget_event_id_fkey"
            columns: ["budget_event_id"]
            isOneToOne: false
            referencedRelation: "budget_events_current"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "verification_log_budget_event_id_fkey"
            columns: ["budget_event_id"]
            isOneToOne: false
            referencedRelation: "unverified_events_high_priority"
            referencedColumns: ["event_id"]
          },
          {
            foreignKeyName: "verification_log_budget_event_id_fkey"
            columns: ["budget_event_id"]
            isOneToOne: false
            referencedRelation: "v_district_full_spend"
            referencedColumns: ["budget_event_id"]
          },
          {
            foreignKeyName: "verification_log_budget_event_id_fkey"
            columns: ["budget_event_id"]
            isOneToOne: false
            referencedRelation: "v_per_pupil_metrics"
            referencedColumns: ["budget_event_id"]
          },
          {
            foreignKeyName: "verification_log_budget_event_id_fkey"
            columns: ["budget_event_id"]
            isOneToOne: false
            referencedRelation: "verifications_pending_review"
            referencedColumns: ["event_id"]
          },
        ]
      }
    }
    Views: {
      budget_events_current: {
        Row: {
          created_at: string | null
          event_date: string | null
          extraction_run_id: string | null
          fiscal_year: number | null
          id: string | null
          is_superseded: boolean | null
          leaid: string | null
          prior_year_baseline: number | null
          source_document_id: string | null
          status: Database["public"]["Enums"]["budget_status"] | null
          topline_amount: number | null
          topline_definition: string | null
          updated_at: string | null
          verification_notes: string | null
          verification_status:
            | Database["public"]["Enums"]["verification_status"]
            | null
          verified_at: string | null
          verified_by: string | null
          yoy_change_dollars: number | null
          yoy_change_pct: number | null
        }
        Insert: {
          created_at?: string | null
          event_date?: string | null
          extraction_run_id?: string | null
          fiscal_year?: number | null
          id?: string | null
          is_superseded?: boolean | null
          leaid?: string | null
          prior_year_baseline?: number | null
          source_document_id?: string | null
          status?: Database["public"]["Enums"]["budget_status"] | null
          topline_amount?: number | null
          topline_definition?: string | null
          updated_at?: string | null
          verification_notes?: string | null
          verification_status?:
            | Database["public"]["Enums"]["verification_status"]
            | null
          verified_at?: string | null
          verified_by?: string | null
          yoy_change_dollars?: number | null
          yoy_change_pct?: number | null
        }
        Update: {
          created_at?: string | null
          event_date?: string | null
          extraction_run_id?: string | null
          fiscal_year?: number | null
          id?: string | null
          is_superseded?: boolean | null
          leaid?: string | null
          prior_year_baseline?: number | null
          source_document_id?: string | null
          status?: Database["public"]["Enums"]["budget_status"] | null
          topline_amount?: number | null
          topline_definition?: string | null
          updated_at?: string | null
          verification_notes?: string | null
          verification_status?:
            | Database["public"]["Enums"]["verification_status"]
            | null
          verified_at?: string | null
          verified_by?: string | null
          yoy_change_dollars?: number | null
          yoy_change_pct?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "budget_events_extraction_run_id_fkey"
            columns: ["extraction_run_id"]
            isOneToOne: false
            referencedRelation: "extraction_runs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "budget_events_leaid_fkey"
            columns: ["leaid"]
            isOneToOne: false
            referencedRelation: "districts"
            referencedColumns: ["leaid"]
          },
          {
            foreignKeyName: "budget_events_source_document_id_fkey"
            columns: ["source_document_id"]
            isOneToOne: false
            referencedRelation: "source_documents"
            referencedColumns: ["id"]
          },
        ]
      }
      unverified_events_high_priority: {
        Row: {
          enrollment_fy25: number | null
          event_created_at: string | null
          event_date: string | null
          event_id: string | null
          fiscal_year: number | null
          lea_name: string | null
          line_or_cell_reference: string | null
          page_number: number | null
          publisher: string | null
          source_url: string | null
          state_postal: string | null
          status: Database["public"]["Enums"]["budget_status"] | null
          storage_path: string | null
          topline_amount: number | null
          verification_status:
            | Database["public"]["Enums"]["verification_status"]
            | null
          yoy_change_pct: number | null
        }
        Relationships: []
      }
      v_dashboard_summary: {
        Row: {
          covered_enrollment: number | null
          fy25_n_leas: number | null
          fy25_total: number | null
          fy26_n_leas: number | null
          fy26_total: number | null
          n_adopted_pipelines: number | null
          n_live_states: number | null
        }
        Relationships: []
      }
      v_district_full_spend: {
        Row: {
          allocated_cooperative_spend: number | null
          budget_event_id: string | null
          cooperative_count: number | null
          enrollment_fy25: number | null
          entity_type: string | null
          fiscal_year: number | null
          full_spend_per_pupil: number | null
          lea_name: string | null
          leaid: string | null
          own_spend: number | null
          state_postal: string | null
          status: Database["public"]["Enums"]["budget_status"] | null
          total_full_spend: number | null
        }
        Relationships: [
          {
            foreignKeyName: "budget_events_leaid_fkey"
            columns: ["leaid"]
            isOneToOne: false
            referencedRelation: "districts"
            referencedColumns: ["leaid"]
          },
        ]
      }
      v_fy27_rollup: {
        Row: {
          change_bucket: string | null
          county_name: string | null
          dollar_change: number | null
          enrollment_fy25: number | null
          entity_type: string | null
          fy26_baseline_amount: number | null
          fy26_baseline_definition: string | null
          fy26_baseline_status:
            | Database["public"]["Enums"]["budget_status"]
            | null
          fy26_event_id: string | null
          fy26_per_pupil: number | null
          fy27_amount: number | null
          fy27_definition: string | null
          fy27_event_id: string | null
          fy27_per_pupil: number | null
          fy27_source_document_id: string | null
          lea_name: string | null
          leaid: string | null
          pct_change: number | null
          state_leaid: string | null
          state_postal: string | null
        }
        Relationships: []
      }
      v_per_pupil_metrics: {
        Row: {
          administration_amount: number | null
          administration_per_pupil: number | null
          budget_event_id: string | null
          capital_outlay_amount: number | null
          capital_outlay_per_pupil: number | null
          county_name: string | null
          debt_service_amount: number | null
          debt_service_per_pupil: number | null
          employee_benefits_amount: number | null
          employee_benefits_per_pupil: number | null
          enrollment_fy25: number | null
          fiscal_year: number | null
          food_service_amount: number | null
          food_service_per_pupil: number | null
          instruction_amount: number | null
          instruction_per_pupil: number | null
          is_operating_district: boolean | null
          lea_name: string | null
          leaid: string | null
          operations_maintenance_amount: number | null
          operations_maintenance_per_pupil: number | null
          other_amount: number | null
          other_per_pupil: number | null
          prior_year_baseline: number | null
          revenue_federal_amount: number | null
          revenue_federal_per_pupil: number | null
          revenue_local_amount: number | null
          revenue_local_per_pupil: number | null
          revenue_state_amount: number | null
          revenue_state_per_pupil: number | null
          state_leaid: string | null
          state_postal: string | null
          status: Database["public"]["Enums"]["budget_status"] | null
          support_services_instruction_amount: number | null
          support_services_instruction_per_pupil: number | null
          support_services_student_amount: number | null
          support_services_student_per_pupil: number | null
          topline_amount: number | null
          topline_definition: string | null
          topline_per_pupil: number | null
          transportation_amount: number | null
          transportation_per_pupil: number | null
          verification_status:
            | Database["public"]["Enums"]["verification_status"]
            | null
          yoy_change_dollars: number | null
          yoy_change_pct: number | null
        }
        Relationships: [
          {
            foreignKeyName: "budget_events_leaid_fkey"
            columns: ["leaid"]
            isOneToOne: false
            referencedRelation: "districts"
            referencedColumns: ["leaid"]
          },
        ]
      }
      v_state_fy_coverage: {
        Row: {
          fiscal_year: number | null
          latest_event_created_at: string | null
          n_leas: number | null
          n_leas_verified: number | null
          state_postal: string | null
          status: Database["public"]["Enums"]["budget_status"] | null
          total_amount: number | null
        }
        Relationships: []
      }
      verifications_pending_review: {
        Row: {
          action: string | null
          action_at: string | null
          actor: string | null
          actor_notes: string | null
          enrollment_fy25: number | null
          event_id: string | null
          fiscal_year: number | null
          lea_name: string | null
          new_status: string | null
          page_number: number | null
          previous_status: string | null
          publisher: string | null
          source_url: string | null
          state_postal: string | null
          status: Database["public"]["Enums"]["budget_status"] | null
          storage_path: string | null
          topline_amount: number | null
          verification_status:
            | Database["public"]["Enums"]["verification_status"]
            | null
        }
        Relationships: []
      }
    }
    Functions: {
      custom_access_token_hook: { Args: { event: Json }; Returns: Json }
      is_admin: { Args: never; Returns: boolean }
      is_verifier: { Args: never; Returns: boolean }
    }
    Enums: {
      budget_status:
        | "proposed"
        | "tentative"
        | "adopted"
        | "disapproved"
        | "actual"
      expenditure_category:
        | "instruction"
        | "support_services_student"
        | "support_services_instruction"
        | "administration"
        | "operations_maintenance"
        | "transportation"
        | "food_service"
        | "employee_benefits"
        | "capital_outlay"
        | "debt_service"
        | "revenue_federal"
        | "revenue_state"
        | "revenue_local"
        | "other"
      extraction_run_status: "success" | "partial" | "failed"
      extraction_trigger: "cron" | "manual" | "backfill"
      verification_status: "unverified" | "verified" | "flagged" | "disputed"
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
      budget_status: [
        "proposed",
        "tentative",
        "adopted",
        "disapproved",
        "actual",
      ],
      expenditure_category: [
        "instruction",
        "support_services_student",
        "support_services_instruction",
        "administration",
        "operations_maintenance",
        "transportation",
        "food_service",
        "employee_benefits",
        "capital_outlay",
        "debt_service",
        "revenue_federal",
        "revenue_state",
        "revenue_local",
        "other",
      ],
      extraction_run_status: ["success", "partial", "failed"],
      extraction_trigger: ["cron", "manual", "backfill"],
      verification_status: ["unverified", "verified", "flagged", "disputed"],
    },
  },
} as const
