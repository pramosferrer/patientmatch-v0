type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[];

export type Database = {
  public: {
    Tables: {
      profiles: {
        Row: {
          user_id: string;
          age: number | null;
          sex: string | null;
          zip: string | null;
          travel_miles: number | null;
          prefers_remote: boolean | null;
          condition_slugs: string[] | null;
          alert_opt_in: boolean | null;
          created_at: string | null;
          updated_at: string | null;
        };
        Insert: {
          user_id: string;
          age?: number | null;
          sex?: string | null;
          zip?: string | null;
          travel_miles?: number | null;
          prefers_remote?: boolean | null;
          condition_slugs?: string[] | null;
          alert_opt_in?: boolean | null;
          created_at?: string | null;
          updated_at?: string | null;
        };
        Update: {
          user_id?: string;
          age?: number | null;
          sex?: string | null;
          zip?: string | null;
          travel_miles?: number | null;
          prefers_remote?: boolean | null;
          condition_slugs?: string[] | null;
          alert_opt_in?: boolean | null;
          created_at?: string | null;
          updated_at?: string | null;
        };
        Relationships: [];
      };
      saved_trials: {
        Row: {
          user_id: string;
          nct_id: string;
          created_at: string | null;
        };
        Insert: {
          user_id: string;
          nct_id: string;
          created_at?: string | null;
        };
        Update: {
          user_id?: string;
          nct_id?: string;
          created_at?: string | null;
        };
        Relationships: [];
      };
      screener_sessions: {
        Row: {
          session_id: string;
          nct_id: string;
          user_id: string | null;
          profile_snapshot: Json | null;
          answers: Json | null;
          result: Json | null;
          created_at: string | null;
          expires_at: string | null;
        };
        Insert: {
          session_id: string;
          nct_id: string;
          user_id?: string | null;
          profile_snapshot?: Json | null;
          answers?: Json | null;
          result?: Json | null;
          created_at?: string | null;
          expires_at?: string | null;
        };
        Update: {
          session_id?: string;
          nct_id?: string;
          user_id?: string | null;
          profile_snapshot?: Json | null;
          answers?: Json | null;
          result?: Json | null;
          created_at?: string | null;
          expires_at?: string | null;
        };
        Relationships: [];
      };
    };
    Views: Record<string, never>;
    Functions: Record<string, never>;
    Enums: Record<string, never>;
    CompositeTypes: Record<string, never>;
  };
};
