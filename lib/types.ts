export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  __InternalSupabase: {
    PostgrestVersion: "14.5"
  }
  public: {
    Tables: {
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
      districts: {
        Row: {
          county_name: string | null
          created_at: string
          data_tier: number | null
          enrollment_fy25: number | null
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
          verification_status: Database["public"]["Enums"]["verification_status"] | null
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
          verification_status?: Database["public"]["Enums"]["verification_status"] | null
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
          verification_status?: Database["public"]["Enums"]["verification_status"] | null
          verified_at?: string | null
          verified_by?: string | null
          yoy_change_dollars?: number | null
          yoy_change_pct?: number | null
        }
        Relationships: []
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
          verification_status: Database["public"]["Enums"]["verification_status"] | null
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
          verification_status: Database["public"]["Enums"]["verification_status"] | null
        }
        Relationships: []
      }
    }
    Functions: {
      is_verifier: { Args: never; Returns: boolean }
    }
    Enums: {
      budget_status:
        | "proposed"
        | "tentative"
        | "adopted"
        | "disapproved"
        | "actual"
      extraction_run_status: "success" | "partial" | "failed"
      extraction_trigger: "cron" | "manual" | "backfill"
      verification_status: "unverified" | "verified" | "flagged" | "disputed"
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}
