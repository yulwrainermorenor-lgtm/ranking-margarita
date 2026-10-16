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
      matches: {
        Row: {
          created_at: string
          id: string
          loser_id: string
          loser_score_after: number
          loser_score_before: number
          loser_sets: number
          played_at: string
          points_exchanged: number
          winner_id: string
          winner_score_after: number
          winner_score_before: number
          winner_sets: number
        }
        Insert: {
          created_at?: string
          id?: string
          loser_id: string
          loser_score_after: number
          loser_score_before: number
          loser_sets?: number
          played_at?: string
          points_exchanged: number
          winner_id: string
          winner_score_after: number
          winner_score_before: number
          winner_sets?: number
        }
        Update: {
          created_at?: string
          id?: string
          loser_id?: string
          loser_score_after?: number
          loser_score_before?: number
          loser_sets?: number
          played_at?: string
          points_exchanged?: number
          winner_id?: string
          winner_score_after?: number
          winner_score_before?: number
          winner_sets?: number
        }
        Relationships: [
          {
            foreignKeyName: "matches_loser_id_fkey"
            columns: ["loser_id"]
            isOneToOne: false
            referencedRelation: "players"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "matches_winner_id_fkey"
            columns: ["winner_id"]
            isOneToOne: false
            referencedRelation: "players"
            referencedColumns: ["id"]
          },
        ]
      }
      players: {
        Row: {
          club: string | null
          created_at: string
          id: string
          initial_score: number
          is_active: boolean
          name: string
          score: number
          updated_at: string
        }
        Insert: {
          club?: string | null
          created_at?: string
          id?: string
          initial_score?: number
          is_active?: boolean
          name: string
          score?: number
          updated_at?: string
        }
        Update: {
          club?: string | null
          created_at?: string
          id?: string
          initial_score?: number
          is_active?: boolean
          name?: string
          score?: number
          updated_at?: string
        }
        Relationships: []
      }
      tournament_matches: {
        Row: {
          created_at: string
          group_label: string | null
          id: string
          loser_id: string | null
          match_id: string | null
          match_number: number
          next_match_id: string | null
          next_match_loser_id: string | null
          next_match_slot: number | null
          phase: Database["public"]["Enums"]["tournament_phase"]
          played_at: string | null
          player1_id: string | null
          player1_sets: number | null
          player2_id: string | null
          player2_sets: number | null
          round: number
          tournament_id: string
          updated_at: string
          winner_id: string | null
        }
        Insert: {
          created_at?: string
          group_label?: string | null
          id?: string
          loser_id?: string | null
          match_id?: string | null
          match_number: number
          next_match_id?: string | null
          next_match_loser_id?: string | null
          next_match_slot?: number | null
          phase?: Database["public"]["Enums"]["tournament_phase"]
          played_at?: string | null
          player1_id?: string | null
          player1_sets?: number | null
          player2_id?: string | null
          player2_sets?: number | null
          round?: number
          tournament_id: string
          updated_at?: string
          winner_id?: string | null
        }
        Update: {
          created_at?: string
          group_label?: string | null
          id?: string
          loser_id?: string | null
          match_id?: string | null
          match_number?: number
          next_match_id?: string | null
          next_match_loser_id?: string | null
          next_match_slot?: number | null
          phase?: Database["public"]["Enums"]["tournament_phase"]
          played_at?: string | null
          player1_id?: string | null
          player1_sets?: number | null
          player2_id?: string | null
          player2_sets?: number | null
          round?: number
          tournament_id?: string
          updated_at?: string
          winner_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "tournament_matches_next_match_id_fkey"
            columns: ["next_match_id"]
            isOneToOne: false
            referencedRelation: "tournament_matches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tournament_matches_next_match_loser_id_fkey"
            columns: ["next_match_loser_id"]
            isOneToOne: false
            referencedRelation: "tournament_matches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tournament_matches_tournament_id_fkey"
            columns: ["tournament_id"]
            isOneToOne: false
            referencedRelation: "tournaments"
            referencedColumns: ["id"]
          },
        ]
      }
      tournament_participants: {
        Row: {
          created_at: string
          eliminated: boolean
          group_label: string | null
          id: string
          player_id: string
          seed: number | null
          tournament_id: string
        }
        Insert: {
          created_at?: string
          eliminated?: boolean
          group_label?: string | null
          id?: string
          player_id: string
          seed?: number | null
          tournament_id: string
        }
        Update: {
          created_at?: string
          eliminated?: boolean
          group_label?: string | null
          id?: string
          player_id?: string
          seed?: number | null
          tournament_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "tournament_participants_tournament_id_fkey"
            columns: ["tournament_id"]
            isOneToOne: false
            referencedRelation: "tournaments"
            referencedColumns: ["id"]
          },
        ]
      }
      tournaments: {
        Row: {
          created_at: string
          end_date: string | null
          format: Database["public"]["Enums"]["tournament_format"]
          id: string
          name: string
          notes: string | null
          start_date: string | null
          status: Database["public"]["Enums"]["tournament_status"]
          updated_at: string
          winner_id: string | null
        }
        Insert: {
          created_at?: string
          end_date?: string | null
          format: Database["public"]["Enums"]["tournament_format"]
          id?: string
          name: string
          notes?: string | null
          start_date?: string | null
          status?: Database["public"]["Enums"]["tournament_status"]
          updated_at?: string
          winner_id?: string | null
        }
        Update: {
          created_at?: string
          end_date?: string | null
          format?: Database["public"]["Enums"]["tournament_format"]
          id?: string
          name?: string
          notes?: string | null
          start_date?: string | null
          status?: Database["public"]["Enums"]["tournament_status"]
          updated_at?: string
          winner_id?: string | null
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
      app_role: "admin" | "user"
      tournament_format:
        | "single_elimination"
        | "double_elimination"
        | "groups_elimination"
      tournament_phase:
        | "group"
        | "upper"
        | "lower"
        | "final"
        | "main"
        | "third_place"
      tournament_status: "draft" | "in_progress" | "finished"
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
      app_role: ["admin", "user"],
      tournament_format: [
        "single_elimination",
        "double_elimination",
        "groups_elimination",
      ],
      tournament_phase: [
        "group",
        "upper",
        "lower",
        "final",
        "main",
        "third_place",
      ],
      tournament_status: ["draft", "in_progress", "finished"],
    },
  },
} as const
