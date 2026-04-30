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
      budget_allocations: {
        Row: {
          amount: number
          category_id: string
          created_at: string | null
          direction: string
          id: string
          month: number
          rule_id: string | null
          source: string
          source_id: string | null
          subcategory_id: string | null
          updated_at: string | null
          user_id: string
          year: number
        }
        Insert: {
          amount?: number
          category_id: string
          created_at?: string | null
          direction: string
          id?: string
          month: number
          rule_id?: string | null
          source: string
          source_id?: string | null
          subcategory_id?: string | null
          updated_at?: string | null
          user_id: string
          year: number
        }
        Update: {
          amount?: number
          category_id?: string
          created_at?: string | null
          direction?: string
          id?: string
          month?: number
          rule_id?: string | null
          source?: string
          source_id?: string | null
          subcategory_id?: string | null
          updated_at?: string | null
          user_id?: string
          year?: number
        }
        Relationships: [
          {
            foreignKeyName: "budget_allocations_category_id_fkey"
            columns: ["category_id"]
            isOneToOne: false
            referencedRelation: "categories"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "budget_allocations_rule_id_fkey"
            columns: ["rule_id"]
            isOneToOne: false
            referencedRelation: "recurrences"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "budget_allocations_subcategory_id_fkey"
            columns: ["subcategory_id"]
            isOneToOne: false
            referencedRelation: "subcategories"
            referencedColumns: ["id"]
          },
        ]
      }
      budget_items: {
        Row: {
          budget_id: string
          category_id: string
          id: string
          planned_amount: number | null
          subcategory_id: string | null
        }
        Insert: {
          budget_id: string
          category_id: string
          id?: string
          planned_amount?: number | null
          subcategory_id?: string | null
        }
        Update: {
          budget_id?: string
          category_id?: string
          id?: string
          planned_amount?: number | null
          subcategory_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "budget_items_budget_id_fkey"
            columns: ["budget_id"]
            isOneToOne: false
            referencedRelation: "budgets"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "budget_items_category_id_fkey"
            columns: ["category_id"]
            isOneToOne: false
            referencedRelation: "categories"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "budget_items_subcategory_id_fkey"
            columns: ["subcategory_id"]
            isOneToOne: false
            referencedRelation: "subcategories"
            referencedColumns: ["id"]
          },
        ]
      }
      budgets: {
        Row: {
          created_at: string | null
          id: string
          month: number
          planned_expenses: number | null
          planned_income: number | null
          user_id: string
          year: number
        }
        Insert: {
          created_at?: string | null
          id?: string
          month: number
          planned_expenses?: number | null
          planned_income?: number | null
          user_id: string
          year: number
        }
        Update: {
          created_at?: string | null
          id?: string
          month?: number
          planned_expenses?: number | null
          planned_income?: number | null
          user_id?: string
          year?: number
        }
        Relationships: []
      }
      categories: {
        Row: {
          created_at: string | null
          icon: string | null
          id: string
          is_fixed: boolean | null
          name: string
          parent_id: string | null
          type: string
          user_id: string
        }
        Insert: {
          created_at?: string | null
          icon?: string | null
          id?: string
          is_fixed?: boolean | null
          name: string
          parent_id?: string | null
          type: string
          user_id: string
        }
        Update: {
          created_at?: string | null
          icon?: string | null
          id?: string
          is_fixed?: boolean | null
          name?: string
          parent_id?: string | null
          type?: string
          user_id?: string
        }
        Relationships: []
      }
      categorization_rules: {
        Row: {
          category_id: string | null
          confidence: number | null
          created_at: string | null
          description_example: string | null
          id: string
          is_active: boolean | null
          last_used_at: string | null
          merchant_normalized: string
          origin: string | null
          recurrence_id: string | null
          subcategory_id: string | null
          usage_count: number | null
          user_id: string
        }
        Insert: {
          category_id?: string | null
          confidence?: number | null
          created_at?: string | null
          description_example?: string | null
          id?: string
          is_active?: boolean | null
          last_used_at?: string | null
          merchant_normalized: string
          origin?: string | null
          recurrence_id?: string | null
          subcategory_id?: string | null
          usage_count?: number | null
          user_id: string
        }
        Update: {
          category_id?: string | null
          confidence?: number | null
          created_at?: string | null
          description_example?: string | null
          id?: string
          is_active?: boolean | null
          last_used_at?: string | null
          merchant_normalized?: string
          origin?: string | null
          recurrence_id?: string | null
          subcategory_id?: string | null
          usage_count?: number | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "categorization_rules_category_id_fkey"
            columns: ["category_id"]
            isOneToOne: false
            referencedRelation: "categories"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "categorization_rules_recurrence_id_fkey"
            columns: ["recurrence_id"]
            isOneToOne: false
            referencedRelation: "recurrences"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "categorization_rules_subcategory_id_fkey"
            columns: ["subcategory_id"]
            isOneToOne: false
            referencedRelation: "subcategories"
            referencedColumns: ["id"]
          },
        ]
      }
      import_batches: {
        Row: {
          created_at: string | null
          id: string
          name: string
          status: string | null
          suggested_transactions: Json | null
          type: string
          user_id: string
        }
        Insert: {
          created_at?: string | null
          id?: string
          name: string
          status?: string | null
          suggested_transactions?: Json | null
          type: string
          user_id: string
        }
        Update: {
          created_at?: string | null
          id?: string
          name?: string
          status?: string | null
          suggested_transactions?: Json | null
          type?: string
          user_id?: string
        }
        Relationships: []
      }
      installments: {
        Row: {
          category_id: string | null
          created_at: string
          description: string | null
          first_payment_date: string
          id: string
          installment_amount: number
          is_active: boolean
          name: string
          subcategory_id: string | null
          total_amount: number
          total_installments: number
          user_id: string
        }
        Insert: {
          category_id?: string | null
          created_at?: string
          description?: string | null
          first_payment_date: string
          id?: string
          installment_amount: number
          is_active?: boolean
          name: string
          subcategory_id?: string | null
          total_amount: number
          total_installments: number
          user_id: string
        }
        Update: {
          category_id?: string | null
          created_at?: string
          description?: string | null
          first_payment_date?: string
          id?: string
          installment_amount?: number
          is_active?: boolean
          name?: string
          subcategory_id?: string | null
          total_amount?: number
          total_installments?: number
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "installments_category_id_fkey"
            columns: ["category_id"]
            isOneToOne: false
            referencedRelation: "categories"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "installments_subcategory_id_fkey"
            columns: ["subcategory_id"]
            isOneToOne: false
            referencedRelation: "subcategories"
            referencedColumns: ["id"]
          },
        ]
      }
      invoice_imports: {
        Row: {
          competencia: string | null
          created_at: string | null
          file_hash: string | null
          file_name: string | null
          id: string
          processing_log: Json | null
          source: string
          status: string
          total_confirmed: number | null
          total_duplicates: number | null
          total_extracted: number | null
          total_new: number | null
          user_id: string
        }
        Insert: {
          competencia?: string | null
          created_at?: string | null
          file_hash?: string | null
          file_name?: string | null
          id?: string
          processing_log?: Json | null
          source: string
          status?: string
          total_confirmed?: number | null
          total_duplicates?: number | null
          total_extracted?: number | null
          total_new?: number | null
          user_id: string
        }
        Update: {
          competencia?: string | null
          created_at?: string | null
          file_hash?: string | null
          file_name?: string | null
          id?: string
          processing_log?: Json | null
          source?: string
          status?: string
          total_confirmed?: number | null
          total_duplicates?: number | null
          total_extracted?: number | null
          total_new?: number | null
          user_id?: string
        }
        Relationships: []
      }
      invoice_transactions: {
        Row: {
          amount: number
          card_holder: string | null
          card_last_four: string | null
          card_name: string | null
          card_type: string | null
          created_at: string | null
          currency: string | null
          description_original: string
          existing_match_confidence: string | null
          existing_match_id: string | null
          id: string
          ignore_reason: string | null
          import_id: string
          installment_current: number | null
          installment_total: number | null
          is_installment: boolean | null
          knowledge_match_confidence: string | null
          linked_transaction_id: string | null
          merchant_normalized: string | null
          recurrence_match_confidence: string | null
          review_status: string | null
          suggested_category_id: string | null
          suggested_recurrence_id: string | null
          suggested_subcategory_id: string | null
          transaction_date: string
          transaction_type: string
          user_id: string
        }
        Insert: {
          amount: number
          card_holder?: string | null
          card_last_four?: string | null
          card_name?: string | null
          card_type?: string | null
          created_at?: string | null
          currency?: string | null
          description_original: string
          existing_match_confidence?: string | null
          existing_match_id?: string | null
          id?: string
          ignore_reason?: string | null
          import_id: string
          installment_current?: number | null
          installment_total?: number | null
          is_installment?: boolean | null
          knowledge_match_confidence?: string | null
          linked_transaction_id?: string | null
          merchant_normalized?: string | null
          recurrence_match_confidence?: string | null
          review_status?: string | null
          suggested_category_id?: string | null
          suggested_recurrence_id?: string | null
          suggested_subcategory_id?: string | null
          transaction_date: string
          transaction_type?: string
          user_id: string
        }
        Update: {
          amount?: number
          card_holder?: string | null
          card_last_four?: string | null
          card_name?: string | null
          card_type?: string | null
          created_at?: string | null
          currency?: string | null
          description_original?: string
          existing_match_confidence?: string | null
          existing_match_id?: string | null
          id?: string
          ignore_reason?: string | null
          import_id?: string
          installment_current?: number | null
          installment_total?: number | null
          is_installment?: boolean | null
          knowledge_match_confidence?: string | null
          linked_transaction_id?: string | null
          merchant_normalized?: string | null
          recurrence_match_confidence?: string | null
          review_status?: string | null
          suggested_category_id?: string | null
          suggested_recurrence_id?: string | null
          suggested_subcategory_id?: string | null
          transaction_date?: string
          transaction_type?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "invoice_transactions_existing_match_id_fkey"
            columns: ["existing_match_id"]
            isOneToOne: false
            referencedRelation: "transactions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "invoice_transactions_import_id_fkey"
            columns: ["import_id"]
            isOneToOne: false
            referencedRelation: "invoice_imports"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "invoice_transactions_linked_transaction_id_fkey"
            columns: ["linked_transaction_id"]
            isOneToOne: false
            referencedRelation: "transactions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "invoice_transactions_suggested_category_id_fkey"
            columns: ["suggested_category_id"]
            isOneToOne: false
            referencedRelation: "categories"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "invoice_transactions_suggested_recurrence_id_fkey"
            columns: ["suggested_recurrence_id"]
            isOneToOne: false
            referencedRelation: "recurrences"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "invoice_transactions_suggested_subcategory_id_fkey"
            columns: ["suggested_subcategory_id"]
            isOneToOne: false
            referencedRelation: "subcategories"
            referencedColumns: ["id"]
          },
        ]
      }
      recurrence_instances: {
        Row: {
          amount: number
          created_at: string | null
          id: string
          linked_transaction_id: string | null
          month: number
          recurrence_id: string
          status: string | null
          user_id: string
          year: number
        }
        Insert: {
          amount: number
          created_at?: string | null
          id?: string
          linked_transaction_id?: string | null
          month: number
          recurrence_id: string
          status?: string | null
          user_id: string
          year: number
        }
        Update: {
          amount?: number
          created_at?: string | null
          id?: string
          linked_transaction_id?: string | null
          month?: number
          recurrence_id?: string
          status?: string | null
          user_id?: string
          year?: number
        }
        Relationships: [
          {
            foreignKeyName: "recurrence_instances_linked_transaction_id_fkey"
            columns: ["linked_transaction_id"]
            isOneToOne: false
            referencedRelation: "transactions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "recurrence_instances_recurrence_id_fkey"
            columns: ["recurrence_id"]
            isOneToOne: false
            referencedRelation: "recurrences"
            referencedColumns: ["id"]
          },
        ]
      }
      recurrences: {
        Row: {
          amount: number
          category_id: string | null
          created_at: string | null
          end_date: string | null
          frequency: string
          id: string
          is_active: boolean | null
          last_match_at: string | null
          match_count: number | null
          merchant_normalized_base: string | null
          name: string
          start_date: string
          subcategory_id: string | null
          total_installments: number | null
          type: string
          user_id: string
          value_tolerance: number | null
        }
        Insert: {
          amount: number
          category_id?: string | null
          created_at?: string | null
          end_date?: string | null
          frequency: string
          id?: string
          is_active?: boolean | null
          last_match_at?: string | null
          match_count?: number | null
          merchant_normalized_base?: string | null
          name: string
          start_date: string
          subcategory_id?: string | null
          total_installments?: number | null
          type: string
          user_id: string
          value_tolerance?: number | null
        }
        Update: {
          amount?: number
          category_id?: string | null
          created_at?: string | null
          end_date?: string | null
          frequency?: string
          id?: string
          is_active?: boolean | null
          last_match_at?: string | null
          match_count?: number | null
          merchant_normalized_base?: string | null
          name?: string
          start_date?: string
          subcategory_id?: string | null
          total_installments?: number | null
          type?: string
          user_id?: string
          value_tolerance?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "recurrences_category_id_fkey"
            columns: ["category_id"]
            isOneToOne: false
            referencedRelation: "categories"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "recurrences_subcategory_id_fkey"
            columns: ["subcategory_id"]
            isOneToOne: false
            referencedRelation: "subcategories"
            referencedColumns: ["id"]
          },
        ]
      }
      saved_filters: {
        Row: {
          created_at: string | null
          filters: Json
          id: string
          name: string
          screen: string
          updated_at: string | null
          user_id: string
        }
        Insert: {
          created_at?: string | null
          filters?: Json
          id?: string
          name: string
          screen: string
          updated_at?: string | null
          user_id: string
        }
        Update: {
          created_at?: string | null
          filters?: Json
          id?: string
          name?: string
          screen?: string
          updated_at?: string | null
          user_id?: string
        }
        Relationships: []
      }
      scenarios: {
        Row: {
          baseline_month: number
          baseline_type: string
          baseline_year: number
          category_adjustments: Json | null
          created_at: string | null
          id: string
          minimum_balance: number | null
          monthly_commitments: Json | null
          name: string
          one_time_costs: Json | null
          user_id: string
        }
        Insert: {
          baseline_month: number
          baseline_type: string
          baseline_year: number
          category_adjustments?: Json | null
          created_at?: string | null
          id?: string
          minimum_balance?: number | null
          monthly_commitments?: Json | null
          name: string
          one_time_costs?: Json | null
          user_id: string
        }
        Update: {
          baseline_month?: number
          baseline_type?: string
          baseline_year?: number
          category_adjustments?: Json | null
          created_at?: string | null
          id?: string
          minimum_balance?: number | null
          monthly_commitments?: Json | null
          name?: string
          one_time_costs?: Json | null
          user_id?: string
        }
        Relationships: []
      }
      subcategories: {
        Row: {
          category_id: string
          created_at: string | null
          id: string
          is_fixed: boolean | null
          name: string
          user_id: string
        }
        Insert: {
          category_id: string
          created_at?: string | null
          id?: string
          is_fixed?: boolean | null
          name: string
          user_id: string
        }
        Update: {
          category_id?: string
          created_at?: string | null
          id?: string
          is_fixed?: boolean | null
          name?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "subcategories_category_id_fkey"
            columns: ["category_id"]
            isOneToOne: false
            referencedRelation: "categories"
            referencedColumns: ["id"]
          },
        ]
      }
      transaction_matches: {
        Row: {
          compared_fields: Json | null
          confidence: number | null
          created_at: string | null
          existing_transaction_id: string
          id: string
          invoice_transaction_id: string
          match_type: string
          user_id: string
        }
        Insert: {
          compared_fields?: Json | null
          confidence?: number | null
          created_at?: string | null
          existing_transaction_id: string
          id?: string
          invoice_transaction_id: string
          match_type: string
          user_id: string
        }
        Update: {
          compared_fields?: Json | null
          confidence?: number | null
          created_at?: string | null
          existing_transaction_id?: string
          id?: string
          invoice_transaction_id?: string
          match_type?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "transaction_matches_existing_transaction_id_fkey"
            columns: ["existing_transaction_id"]
            isOneToOne: false
            referencedRelation: "transactions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "transaction_matches_invoice_transaction_id_fkey"
            columns: ["invoice_transaction_id"]
            isOneToOne: false
            referencedRelation: "invoice_transactions"
            referencedColumns: ["id"]
          },
        ]
      }
      transactions: {
        Row: {
          amount: number
          category_id: string | null
          created_at: string | null
          date: string
          description: string | null
          id: string
          import_batch_id: string | null
          installment_id: string | null
          needs_review: boolean | null
          origin: string | null
          recurrence_id: string | null
          recurrence_instance_id: string | null
          subcategory_id: string | null
          type: string
          user_id: string
        }
        Insert: {
          amount: number
          category_id?: string | null
          created_at?: string | null
          date: string
          description?: string | null
          id?: string
          import_batch_id?: string | null
          installment_id?: string | null
          needs_review?: boolean | null
          origin?: string | null
          recurrence_id?: string | null
          recurrence_instance_id?: string | null
          subcategory_id?: string | null
          type: string
          user_id: string
        }
        Update: {
          amount?: number
          category_id?: string | null
          created_at?: string | null
          date?: string
          description?: string | null
          id?: string
          import_batch_id?: string | null
          installment_id?: string | null
          needs_review?: boolean | null
          origin?: string | null
          recurrence_id?: string | null
          recurrence_instance_id?: string | null
          subcategory_id?: string | null
          type?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "transactions_category_id_fkey"
            columns: ["category_id"]
            isOneToOne: false
            referencedRelation: "categories"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "transactions_installment_id_fkey"
            columns: ["installment_id"]
            isOneToOne: false
            referencedRelation: "installments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "transactions_subcategory_id_fkey"
            columns: ["subcategory_id"]
            isOneToOne: false
            referencedRelation: "subcategories"
            referencedColumns: ["id"]
          },
        ]
      }
      user_notes: {
        Row: {
          content: string
          created_at: string
          id: string
          title: string
          updated_at: string
          user_id: string
        }
        Insert: {
          content?: string
          created_at?: string
          id?: string
          title?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          content?: string
          created_at?: string
          id?: string
          title?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      [_ in never]: never
    }
    Enums: {
      [_ in never]: never
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
    Enums: {},
  },
} as const
