export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[];

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "14.5";
  };
  public: {
    Tables: {
      analyses: {
        Row: {
          anomalies_json: Json;
          computed_by: string | null;
          created_at: string;
          dataset_id: string;
          date_column: string | null;
          error_message: string | null;
          granularity: string | null;
          id: string;
          insights_json: Json;
          results_json: Json;
          status: Database["public"]["Enums"]["analysis_status"];
          target_column: string | null;
          updated_at: string;
          workspace_id: string;
        };
        Insert: {
          anomalies_json?: Json;
          computed_by?: string | null;
          created_at?: string;
          dataset_id: string;
          date_column?: string | null;
          error_message?: string | null;
          granularity?: string | null;
          id?: string;
          insights_json?: Json;
          results_json?: Json;
          status?: Database["public"]["Enums"]["analysis_status"];
          target_column?: string | null;
          updated_at?: string;
          workspace_id: string;
        };
        Update: {
          anomalies_json?: Json;
          computed_by?: string | null;
          created_at?: string;
          dataset_id?: string;
          date_column?: string | null;
          error_message?: string | null;
          granularity?: string | null;
          id?: string;
          insights_json?: Json;
          results_json?: Json;
          status?: Database["public"]["Enums"]["analysis_status"];
          target_column?: string | null;
          updated_at?: string;
          workspace_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "analyses_dataset_id_fkey";
            columns: ["dataset_id"];
            isOneToOne: false;
            referencedRelation: "datasets";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "analyses_workspace_id_fkey";
            columns: ["workspace_id"];
            isOneToOne: false;
            referencedRelation: "workspaces";
            referencedColumns: ["id"];
          },
        ];
      };
      anomaly_runs: {
        Row: {
          aggregate: string;
          anomalies: Json;
          computed_by: string;
          created_at: string;
          dataset_id: string;
          date_column: string;
          error_message: string | null;
          forecast_id: string | null;
          granularity: string | null;
          id: string;
          methods: string[];
          parameters: Json;
          series: Json;
          status: Database["public"]["Enums"]["anomaly_status"];
          summary: Json;
          target_column: string;
          updated_at: string;
          workspace_id: string;
        };
        Insert: {
          aggregate?: string;
          anomalies?: Json;
          computed_by: string;
          created_at?: string;
          dataset_id: string;
          date_column: string;
          error_message?: string | null;
          forecast_id?: string | null;
          granularity?: string | null;
          id?: string;
          methods?: string[];
          parameters?: Json;
          series?: Json;
          status?: Database["public"]["Enums"]["anomaly_status"];
          summary?: Json;
          target_column: string;
          updated_at?: string;
          workspace_id: string;
        };
        Update: {
          aggregate?: string;
          anomalies?: Json;
          computed_by?: string;
          created_at?: string;
          dataset_id?: string;
          date_column?: string;
          error_message?: string | null;
          forecast_id?: string | null;
          granularity?: string | null;
          id?: string;
          methods?: string[];
          parameters?: Json;
          series?: Json;
          status?: Database["public"]["Enums"]["anomaly_status"];
          summary?: Json;
          target_column?: string;
          updated_at?: string;
          workspace_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "anomaly_runs_dataset_id_fkey";
            columns: ["dataset_id"];
            isOneToOne: false;
            referencedRelation: "datasets";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "anomaly_runs_forecast_id_fkey";
            columns: ["forecast_id"];
            isOneToOne: false;
            referencedRelation: "forecasts";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "anomaly_runs_workspace_id_fkey";
            columns: ["workspace_id"];
            isOneToOne: false;
            referencedRelation: "workspaces";
            referencedColumns: ["id"];
          },
        ];
      };
      audit_logs: {
        Row: {
          action: string;
          actor_id: string | null;
          created_at: string;
          id: string;
          metadata: Json;
        };
        Insert: {
          action: string;
          actor_id?: string | null;
          created_at?: string;
          id?: string;
          metadata?: Json;
        };
        Update: {
          action?: string;
          actor_id?: string | null;
          created_at?: string;
          id?: string;
          metadata?: Json;
        };
        Relationships: [];
      };
      conversations: {
        Row: {
          created_at: string;
          created_by: string;
          dataset_id: string | null;
          id: string;
          title: string;
          updated_at: string;
          workspace_id: string;
        };
        Insert: {
          created_at?: string;
          created_by: string;
          dataset_id?: string | null;
          id?: string;
          title?: string;
          updated_at?: string;
          workspace_id: string;
        };
        Update: {
          created_at?: string;
          created_by?: string;
          dataset_id?: string | null;
          id?: string;
          title?: string;
          updated_at?: string;
          workspace_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "conversations_dataset_id_fkey";
            columns: ["dataset_id"];
            isOneToOne: false;
            referencedRelation: "datasets";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "conversations_workspace_id_fkey";
            columns: ["workspace_id"];
            isOneToOne: false;
            referencedRelation: "workspaces";
            referencedColumns: ["id"];
          },
        ];
      };
      dataset_columns: {
        Row: {
          column_name: string;
          created_at: string;
          data_type: Database["public"]["Enums"]["column_data_type"];
          dataset_id: string;
          id: string;
          missing_percentage: number | null;
          nullable: boolean;
          position: number;
          stats: Json;
          unique_ratio: number | null;
        };
        Insert: {
          column_name: string;
          created_at?: string;
          data_type?: Database["public"]["Enums"]["column_data_type"];
          dataset_id: string;
          id?: string;
          missing_percentage?: number | null;
          nullable?: boolean;
          position: number;
          stats?: Json;
          unique_ratio?: number | null;
        };
        Update: {
          column_name?: string;
          created_at?: string;
          data_type?: Database["public"]["Enums"]["column_data_type"];
          dataset_id?: string;
          id?: string;
          missing_percentage?: number | null;
          nullable?: boolean;
          position?: number;
          stats?: Json;
          unique_ratio?: number | null;
        };
        Relationships: [
          {
            foreignKeyName: "dataset_columns_dataset_id_fkey";
            columns: ["dataset_id"];
            isOneToOne: false;
            referencedRelation: "datasets";
            referencedColumns: ["id"];
          },
        ];
      };
      dataset_profiles: {
        Row: {
          created_at: string;
          dataset_id: string;
          id: string;
          issues_json: Json;
          quality_score: number;
          summary_json: Json;
          updated_at: string;
        };
        Insert: {
          created_at?: string;
          dataset_id: string;
          id?: string;
          issues_json?: Json;
          quality_score?: number;
          summary_json?: Json;
          updated_at?: string;
        };
        Update: {
          created_at?: string;
          dataset_id?: string;
          id?: string;
          issues_json?: Json;
          quality_score?: number;
          summary_json?: Json;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "dataset_profiles_dataset_id_fkey";
            columns: ["dataset_id"];
            isOneToOne: true;
            referencedRelation: "datasets";
            referencedColumns: ["id"];
          },
        ];
      };
      datasets: {
        Row: {
          column_count: number | null;
          created_at: string;
          error_message: string | null;
          file_type: string;
          filename: string;
          id: string;
          row_count: number | null;
          size_bytes: number | null;
          status: Database["public"]["Enums"]["dataset_status"];
          storage_path: string;
          updated_at: string;
          uploaded_by: string;
          workspace_id: string;
        };
        Insert: {
          column_count?: number | null;
          created_at?: string;
          error_message?: string | null;
          file_type: string;
          filename: string;
          id?: string;
          row_count?: number | null;
          size_bytes?: number | null;
          status?: Database["public"]["Enums"]["dataset_status"];
          storage_path: string;
          updated_at?: string;
          uploaded_by: string;
          workspace_id: string;
        };
        Update: {
          column_count?: number | null;
          created_at?: string;
          error_message?: string | null;
          file_type?: string;
          filename?: string;
          id?: string;
          row_count?: number | null;
          size_bytes?: number | null;
          status?: Database["public"]["Enums"]["dataset_status"];
          storage_path?: string;
          updated_at?: string;
          uploaded_by?: string;
          workspace_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "datasets_workspace_id_fkey";
            columns: ["workspace_id"];
            isOneToOne: false;
            referencedRelation: "workspaces";
            referencedColumns: ["id"];
          },
        ];
      };
      forecasts: {
        Row: {
          assumptions: Json;
          backtest_points: Json;
          computed_by: string | null;
          confidence_intervals: Json;
          created_at: string;
          dataset_id: string;
          date_column: string | null;
          error_message: string | null;
          forecast_points: Json;
          granularity: string | null;
          horizon: number;
          id: string;
          metrics: Json;
          model_comparison: Json;
          model_name: string;
          parameters: Json;
          status: Database["public"]["Enums"]["forecast_status"];
          target_column: string | null;
          train_range: Json;
          updated_at: string;
          workspace_id: string;
        };
        Insert: {
          assumptions?: Json;
          backtest_points?: Json;
          computed_by?: string | null;
          confidence_intervals?: Json;
          created_at?: string;
          dataset_id: string;
          date_column?: string | null;
          error_message?: string | null;
          forecast_points?: Json;
          granularity?: string | null;
          horizon: number;
          id?: string;
          metrics?: Json;
          model_comparison?: Json;
          model_name: string;
          parameters?: Json;
          status?: Database["public"]["Enums"]["forecast_status"];
          target_column?: string | null;
          train_range?: Json;
          updated_at?: string;
          workspace_id: string;
        };
        Update: {
          assumptions?: Json;
          backtest_points?: Json;
          computed_by?: string | null;
          confidence_intervals?: Json;
          created_at?: string;
          dataset_id?: string;
          date_column?: string | null;
          error_message?: string | null;
          forecast_points?: Json;
          granularity?: string | null;
          horizon?: number;
          id?: string;
          metrics?: Json;
          model_comparison?: Json;
          model_name?: string;
          parameters?: Json;
          status?: Database["public"]["Enums"]["forecast_status"];
          target_column?: string | null;
          train_range?: Json;
          updated_at?: string;
          workspace_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "forecasts_dataset_id_fkey";
            columns: ["dataset_id"];
            isOneToOne: false;
            referencedRelation: "datasets";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "forecasts_workspace_id_fkey";
            columns: ["workspace_id"];
            isOneToOne: false;
            referencedRelation: "workspaces";
            referencedColumns: ["id"];
          },
        ];
      };
      messages: {
        Row: {
          citations_json: Json;
          content: string;
          conversation_id: string;
          created_at: string;
          id: string;
          role: Database["public"]["Enums"]["message_role"];
          token_usage_json: Json;
        };
        Insert: {
          citations_json?: Json;
          content: string;
          conversation_id: string;
          created_at?: string;
          id?: string;
          role: Database["public"]["Enums"]["message_role"];
          token_usage_json?: Json;
        };
        Update: {
          citations_json?: Json;
          content?: string;
          conversation_id?: string;
          created_at?: string;
          id?: string;
          role?: Database["public"]["Enums"]["message_role"];
          token_usage_json?: Json;
        };
        Relationships: [
          {
            foreignKeyName: "messages_conversation_id_fkey";
            columns: ["conversation_id"];
            isOneToOne: false;
            referencedRelation: "conversations";
            referencedColumns: ["id"];
          },
        ];
      };
      profiles: {
        Row: {
          avatar_url: string | null;
          created_at: string;
          email: string | null;
          full_name: string | null;
          id: string;
          role: Database["public"]["Enums"]["app_role"];
          updated_at: string;
        };
        Insert: {
          avatar_url?: string | null;
          created_at?: string;
          email?: string | null;
          full_name?: string | null;
          id: string;
          role?: Database["public"]["Enums"]["app_role"];
          updated_at?: string;
        };
        Update: {
          avatar_url?: string | null;
          created_at?: string;
          email?: string | null;
          full_name?: string | null;
          id?: string;
          role?: Database["public"]["Enums"]["app_role"];
          updated_at?: string;
        };
        Relationships: [];
      };
      reports: {
        Row: {
          ai_model: string | null;
          ai_provider: string | null;
          citations: Json;
          created_at: string;
          created_by: string;
          dataset_id: string;
          evidence_snapshot: Json;
          id: string;
          narratives: Json;
          risk_score: Json;
          sections: Json;
          title: string;
          type: Database["public"]["Enums"]["report_type"];
          updated_at: string;
          workspace_id: string;
        };
        Insert: {
          ai_model?: string | null;
          ai_provider?: string | null;
          citations?: Json;
          created_at?: string;
          created_by: string;
          dataset_id: string;
          evidence_snapshot?: Json;
          id?: string;
          narratives?: Json;
          risk_score?: Json;
          sections?: Json;
          title: string;
          type: Database["public"]["Enums"]["report_type"];
          updated_at?: string;
          workspace_id: string;
        };
        Update: {
          ai_model?: string | null;
          ai_provider?: string | null;
          citations?: Json;
          created_at?: string;
          created_by?: string;
          dataset_id?: string;
          evidence_snapshot?: Json;
          id?: string;
          narratives?: Json;
          risk_score?: Json;
          sections?: Json;
          title?: string;
          type?: Database["public"]["Enums"]["report_type"];
          updated_at?: string;
          workspace_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "reports_dataset_id_fkey";
            columns: ["dataset_id"];
            isOneToOne: false;
            referencedRelation: "datasets";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "reports_workspace_id_fkey";
            columns: ["workspace_id"];
            isOneToOne: false;
            referencedRelation: "workspaces";
            referencedColumns: ["id"];
          },
        ];
      };
      workspace_members: {
        Row: {
          created_at: string;
          id: string;
          role: Database["public"]["Enums"]["workspace_role"];
          user_id: string;
          workspace_id: string;
        };
        Insert: {
          created_at?: string;
          id?: string;
          role?: Database["public"]["Enums"]["workspace_role"];
          user_id: string;
          workspace_id: string;
        };
        Update: {
          created_at?: string;
          id?: string;
          role?: Database["public"]["Enums"]["workspace_role"];
          user_id?: string;
          workspace_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "workspace_members_workspace_id_fkey";
            columns: ["workspace_id"];
            isOneToOne: false;
            referencedRelation: "workspaces";
            referencedColumns: ["id"];
          },
        ];
      };
      workspaces: {
        Row: {
          created_at: string;
          description: string | null;
          id: string;
          name: string;
          owner_id: string;
          updated_at: string;
        };
        Insert: {
          created_at?: string;
          description?: string | null;
          id?: string;
          name: string;
          owner_id: string;
          updated_at?: string;
        };
        Update: {
          created_at?: string;
          description?: string | null;
          id?: string;
          name?: string;
          owner_id?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
    };
    Views: {
      [_ in never]: never;
    };
    Functions: {
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"];
          _user_id: string;
        };
        Returns: boolean;
      };
      is_workspace_member: {
        Args: { _user_id: string; _workspace_id: string };
        Returns: boolean;
      };
      is_workspace_owner: {
        Args: { _user_id: string; _workspace_id: string };
        Returns: boolean;
      };
    };
    Enums: {
      analysis_status: "pending" | "running" | "ready" | "failed";
      anomaly_status: "pending" | "running" | "ready" | "failed";
      app_role: "admin" | "member";
      column_data_type:
        | "numeric"
        | "integer"
        | "boolean"
        | "date"
        | "datetime"
        | "string"
        | "categorical"
        | "unknown";
      dataset_status: "uploading" | "profiling" | "ready" | "failed";
      forecast_status: "pending" | "running" | "ready" | "failed";
      message_role: "user" | "assistant" | "system";
      report_type:
        | "executive_summary"
        | "boardroom"
        | "risk_brief"
        | "forecast_brief"
        | "anomaly_investigation";
      workspace_role: "owner" | "editor" | "viewer";
    };
    CompositeTypes: {
      [_ in never]: never;
    };
  };
};

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">;

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">];

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
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] & DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
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
      analysis_status: ["pending", "running", "ready", "failed"],
      anomaly_status: ["pending", "running", "ready", "failed"],
      app_role: ["admin", "member"],
      column_data_type: [
        "numeric",
        "integer",
        "boolean",
        "date",
        "datetime",
        "string",
        "categorical",
        "unknown",
      ],
      dataset_status: ["uploading", "profiling", "ready", "failed"],
      forecast_status: ["pending", "running", "ready", "failed"],
      message_role: ["user", "assistant", "system"],
      report_type: [
        "executive_summary",
        "boardroom",
        "risk_brief",
        "forecast_brief",
        "anomaly_investigation",
      ],
      workspace_role: ["owner", "editor", "viewer"],
    },
  },
} as const;
