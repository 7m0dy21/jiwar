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
    PostgrestVersion: "14.1"
  }
  public: {
    Tables: {
      admin_permissions: {
        Row: {
          can_manage_admins: boolean
          can_manage_customers: boolean
          can_manage_merchants: boolean
          can_manage_transactions: boolean
          can_view_reports: boolean
          created_at: string
          created_by: string | null
          id: string
          is_super_admin: boolean
          updated_at: string
          user_id: string
        }
        Insert: {
          can_manage_admins?: boolean
          can_manage_customers?: boolean
          can_manage_merchants?: boolean
          can_manage_transactions?: boolean
          can_view_reports?: boolean
          created_at?: string
          created_by?: string | null
          id?: string
          is_super_admin?: boolean
          updated_at?: string
          user_id: string
        }
        Update: {
          can_manage_admins?: boolean
          can_manage_customers?: boolean
          can_manage_merchants?: boolean
          can_manage_transactions?: boolean
          can_view_reports?: boolean
          created_at?: string
          created_by?: string | null
          id?: string
          is_super_admin?: boolean
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      customer_verifications: {
        Row: {
          created_at: string
          customer_id: string
          details: Json | null
          id: string
          provider: string
          reference: string | null
          status: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          customer_id: string
          details?: Json | null
          id?: string
          provider: string
          reference?: string | null
          status?: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          customer_id?: string
          details?: Json | null
          id?: string
          provider?: string
          reference?: string | null
          status?: string
          updated_at?: string
        }
        Relationships: []
      }
      customers: {
        Row: {
          available_balance: number
          created_at: string
          credit_limit: number
          id: string
          is_verified: boolean
          nafath_verified: boolean
          nafith_signed: boolean
          onboarding_completed: boolean
          qr_code: string | null
          simah_score: number | null
          updated_at: string
          user_id: string
        }
        Insert: {
          available_balance?: number
          created_at?: string
          credit_limit?: number
          id?: string
          is_verified?: boolean
          nafath_verified?: boolean
          nafith_signed?: boolean
          onboarding_completed?: boolean
          qr_code?: string | null
          simah_score?: number | null
          updated_at?: string
          user_id: string
        }
        Update: {
          available_balance?: number
          created_at?: string
          credit_limit?: number
          id?: string
          is_verified?: boolean
          nafath_verified?: boolean
          nafith_signed?: boolean
          onboarding_completed?: boolean
          qr_code?: string | null
          simah_score?: number | null
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      error_logs: {
        Row: {
          code: string | null
          correlation_id: string
          created_at: string
          details: Json | null
          id: string
          message: string
          route: string | null
          severity: string
          source: string
          user_agent: string | null
          user_id: string | null
        }
        Insert: {
          code?: string | null
          correlation_id: string
          created_at?: string
          details?: Json | null
          id?: string
          message: string
          route?: string | null
          severity?: string
          source: string
          user_agent?: string | null
          user_id?: string | null
        }
        Update: {
          code?: string | null
          correlation_id?: string
          created_at?: string
          details?: Json | null
          id?: string
          message?: string
          route?: string | null
          severity?: string
          source?: string
          user_agent?: string | null
          user_id?: string | null
        }
        Relationships: []
      }
      merchant_risk_alerts: {
        Row: {
          created_at: string
          id: string
          level: string
          merchant_id: string
          message: string
          resolved: boolean
        }
        Insert: {
          created_at?: string
          id?: string
          level: string
          merchant_id: string
          message: string
          resolved?: boolean
        }
        Update: {
          created_at?: string
          id?: string
          level?: string
          merchant_id?: string
          message?: string
          resolved?: boolean
        }
        Relationships: []
      }
      merchant_risk_scores: {
        Row: {
          failed_count: number
          id: string
          level: string
          merchant_id: string
          reason: string | null
          score: number
          total_transactions: number
          total_volume: number
          updated_at: string
        }
        Insert: {
          failed_count?: number
          id?: string
          level?: string
          merchant_id: string
          reason?: string | null
          score?: number
          total_transactions?: number
          total_volume?: number
          updated_at?: string
        }
        Update: {
          failed_count?: number
          id?: string
          level?: string
          merchant_id?: string
          reason?: string | null
          score?: number
          total_transactions?: number
          total_volume?: number
          updated_at?: string
        }
        Relationships: []
      }
      merchant_transfers: {
        Row: {
          amount: number
          bank_name: string | null
          created_at: string
          iban: string | null
          id: string
          merchant_id: string
          notes: string | null
          status: string
        }
        Insert: {
          amount: number
          bank_name?: string | null
          created_at?: string
          iban?: string | null
          id?: string
          merchant_id: string
          notes?: string | null
          status?: string
        }
        Update: {
          amount?: number
          bank_name?: string | null
          created_at?: string
          iban?: string | null
          id?: string
          merchant_id?: string
          notes?: string | null
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "merchant_transfers_merchant_id_fkey"
            columns: ["merchant_id"]
            isOneToOne: false
            referencedRelation: "merchants"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "merchant_transfers_merchant_id_fkey"
            columns: ["merchant_id"]
            isOneToOne: false
            referencedRelation: "merchants_public"
            referencedColumns: ["id"]
          },
        ]
      }
      merchants: {
        Row: {
          bank_name: string | null
          commercial_registration: string | null
          created_at: string
          iban: string | null
          id: string
          is_active: boolean
          location_lat: number | null
          location_lng: number | null
          store_address: string | null
          store_name: string
          updated_at: string
          user_id: string
        }
        Insert: {
          bank_name?: string | null
          commercial_registration?: string | null
          created_at?: string
          iban?: string | null
          id?: string
          is_active?: boolean
          location_lat?: number | null
          location_lng?: number | null
          store_address?: string | null
          store_name?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          bank_name?: string | null
          commercial_registration?: string | null
          created_at?: string
          iban?: string | null
          id?: string
          is_active?: boolean
          location_lat?: number | null
          location_lng?: number | null
          store_address?: string | null
          store_name?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      monthly_statements: {
        Row: {
          created_at: string
          customer_id: string
          due_date: string
          id: string
          paid_amount: number
          period_end: string
          period_start: string
          status: Database["public"]["Enums"]["payment_status"]
          total_amount: number
          updated_at: string
        }
        Insert: {
          created_at?: string
          customer_id: string
          due_date: string
          id?: string
          paid_amount?: number
          period_end: string
          period_start: string
          status?: Database["public"]["Enums"]["payment_status"]
          total_amount?: number
          updated_at?: string
        }
        Update: {
          created_at?: string
          customer_id?: string
          due_date?: string
          id?: string
          paid_amount?: number
          period_end?: string
          period_start?: string
          status?: Database["public"]["Enums"]["payment_status"]
          total_amount?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "monthly_statements_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "customers"
            referencedColumns: ["id"]
          },
        ]
      }
      notifications: {
        Row: {
          created_at: string
          id: string
          is_read: boolean
          message: string
          title: string
          type: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          is_read?: boolean
          message: string
          title: string
          type?: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          is_read?: boolean
          message?: string
          title?: string
          type?: string
          user_id?: string
        }
        Relationships: []
      }
      payment_requests: {
        Row: {
          amount: number
          created_at: string
          customer_id: string
          customer_user_id: string
          expires_at: string
          id: string
          merchant_id: string
          merchant_user_id: string
          reason: string | null
          status: string
          transaction_id: string | null
          updated_at: string
        }
        Insert: {
          amount: number
          created_at?: string
          customer_id: string
          customer_user_id: string
          expires_at?: string
          id?: string
          merchant_id: string
          merchant_user_id: string
          reason?: string | null
          status?: string
          transaction_id?: string | null
          updated_at?: string
        }
        Update: {
          amount?: number
          created_at?: string
          customer_id?: string
          customer_user_id?: string
          expires_at?: string
          id?: string
          merchant_id?: string
          merchant_user_id?: string
          reason?: string | null
          status?: string
          transaction_id?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "payment_requests_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "customers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "payment_requests_merchant_id_fkey"
            columns: ["merchant_id"]
            isOneToOne: false
            referencedRelation: "merchants"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "payment_requests_merchant_id_fkey"
            columns: ["merchant_id"]
            isOneToOne: false
            referencedRelation: "merchants_public"
            referencedColumns: ["id"]
          },
        ]
      }
      payments: {
        Row: {
          amount: number
          created_at: string
          customer_id: string
          id: string
          payment_method: string | null
          statement_id: string | null
        }
        Insert: {
          amount: number
          created_at?: string
          customer_id: string
          id?: string
          payment_method?: string | null
          statement_id?: string | null
        }
        Update: {
          amount?: number
          created_at?: string
          customer_id?: string
          id?: string
          payment_method?: string | null
          statement_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "payments_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "customers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "payments_statement_id_fkey"
            columns: ["statement_id"]
            isOneToOne: false
            referencedRelation: "monthly_statements"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          avatar_url: string | null
          created_at: string
          full_name: string
          id: string
          national_id: string | null
          phone: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          avatar_url?: string | null
          created_at?: string
          full_name?: string
          id?: string
          national_id?: string | null
          phone?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          avatar_url?: string | null
          created_at?: string
          full_name?: string
          id?: string
          national_id?: string | null
          phone?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      qr_audit_log: {
        Row: {
          amount: number | null
          created_at: string
          customer_id: string | null
          event_type: string
          id: string
          merchant_id: string | null
          metadata: Json | null
          reason: string | null
        }
        Insert: {
          amount?: number | null
          created_at?: string
          customer_id?: string | null
          event_type: string
          id?: string
          merchant_id?: string | null
          metadata?: Json | null
          reason?: string | null
        }
        Update: {
          amount?: number | null
          created_at?: string
          customer_id?: string | null
          event_type?: string
          id?: string
          merchant_id?: string | null
          metadata?: Json | null
          reason?: string | null
        }
        Relationships: []
      }
      role_check_audit: {
        Row: {
          attempts: number
          code: string | null
          correlation_id: string
          created_at: string
          decision: string
          details: Json | null
          id: string
          latency_ms: number | null
          reason: string | null
          resolved_role: string | null
          route: string | null
          user_agent: string | null
          user_id: string | null
        }
        Insert: {
          attempts?: number
          code?: string | null
          correlation_id: string
          created_at?: string
          decision: string
          details?: Json | null
          id?: string
          latency_ms?: number | null
          reason?: string | null
          resolved_role?: string | null
          route?: string | null
          user_agent?: string | null
          user_id?: string | null
        }
        Update: {
          attempts?: number
          code?: string | null
          correlation_id?: string
          created_at?: string
          decision?: string
          details?: Json | null
          id?: string
          latency_ms?: number | null
          reason?: string | null
          resolved_role?: string | null
          route?: string | null
          user_agent?: string | null
          user_id?: string | null
        }
        Relationships: []
      }
      transaction_limits: {
        Row: {
          daily_limit: number
          entity_id: string
          entity_type: string
          id: string
          monthly_limit: number
          per_transaction_limit: number
          updated_at: string
        }
        Insert: {
          daily_limit?: number
          entity_id: string
          entity_type: string
          id?: string
          monthly_limit?: number
          per_transaction_limit?: number
          updated_at?: string
        }
        Update: {
          daily_limit?: number
          entity_id?: string
          entity_type?: string
          id?: string
          monthly_limit?: number
          per_transaction_limit?: number
          updated_at?: string
        }
        Relationships: []
      }
      transactions: {
        Row: {
          amount: number
          created_at: string
          customer_id: string
          description: string | null
          id: string
          merchant_id: string
          status: Database["public"]["Enums"]["transaction_status"]
        }
        Insert: {
          amount: number
          created_at?: string
          customer_id: string
          description?: string | null
          id?: string
          merchant_id: string
          status?: Database["public"]["Enums"]["transaction_status"]
        }
        Update: {
          amount?: number
          created_at?: string
          customer_id?: string
          description?: string | null
          id?: string
          merchant_id?: string
          status?: Database["public"]["Enums"]["transaction_status"]
        }
        Relationships: [
          {
            foreignKeyName: "transactions_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "customers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "transactions_merchant_id_fkey"
            columns: ["merchant_id"]
            isOneToOne: false
            referencedRelation: "merchants"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "transactions_merchant_id_fkey"
            columns: ["merchant_id"]
            isOneToOne: false
            referencedRelation: "merchants_public"
            referencedColumns: ["id"]
          },
        ]
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
      merchants_public: {
        Row: {
          created_at: string | null
          id: string | null
          is_active: boolean | null
          location_lat: number | null
          location_lng: number | null
          store_address: string | null
          store_name: string | null
        }
        Insert: {
          created_at?: string | null
          id?: string | null
          is_active?: boolean | null
          location_lat?: number | null
          location_lng?: number | null
          store_address?: string | null
          store_name?: string | null
        }
        Update: {
          created_at?: string | null
          id?: string | null
          is_active?: boolean | null
          location_lat?: number | null
          location_lng?: number | null
          store_address?: string | null
          store_name?: string | null
        }
        Relationships: []
      }
    }
    Functions: {
      _ci_db_guardrails_probe: { Args: never; Returns: Json }
      get_effective_limits: {
        Args: { p_entity_id: string; p_entity_type: string }
        Returns: {
          daily: number
          monthly: number
          per_transaction: number
        }[]
      }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      is_super_admin: { Args: { _user_id: string }; Returns: boolean }
      log_qr_audit: {
        Args: {
          p_amount?: number
          p_customer_id: string
          p_event: string
          p_merchant_id: string
          p_metadata?: Json
          p_reason?: string
        }
        Returns: string
      }
      log_role_check: {
        Args: {
          _attempts?: number
          _code?: string
          _correlation_id: string
          _decision: string
          _details?: Json
          _latency_ms?: number
          _reason?: string
          _resolved_role?: string
          _route?: string
          _user_agent?: string
        }
        Returns: string
      }
      make_payment: {
        Args: {
          p_amount: number
          p_customer_id: string
          p_payment_method?: string
        }
        Returns: string
      }
      process_dynamic_qr_transaction: {
        Args: {
          p_amount: number
          p_customer_id: string
          p_merchant_user_id: string
        }
        Returns: string
      }
      process_transaction: {
        Args: { p_amount: number; p_customer_id: string; p_merchant_id: string }
        Returns: string
      }
      recalculate_merchant_risk: {
        Args: { p_merchant_id: string }
        Returns: undefined
      }
      respond_payment_request: {
        Args: { p_approve: boolean; p_request_id: string }
        Returns: Json
      }
    }
    Enums: {
      app_role: "admin" | "merchant" | "customer"
      payment_status: "pending" | "paid" | "overdue" | "partial"
      transaction_status: "pending" | "completed" | "cancelled" | "refunded"
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
      app_role: ["admin", "merchant", "customer"],
      payment_status: ["pending", "paid", "overdue", "partial"],
      transaction_status: ["pending", "completed", "cancelled", "refunded"],
    },
  },
} as const
