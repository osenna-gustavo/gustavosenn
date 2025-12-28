// Budget allocation types for idempotent recurrence → budget flow

export interface BudgetAllocation {
  id: string;
  userId: string;
  month: number;
  year: number;
  direction: 'expense' | 'income';
  categoryId: string;
  subcategoryId?: string;
  source: 'manual' | 'recurrence';
  sourceId?: string;  // recurrence_instance_id when source = 'recurrence'
  ruleId?: string;    // recurrence rule id for reporting
  amount: number;
  createdAt: Date;
  updatedAt: Date;
}

export interface AllocationSummary {
  categoryId: string;
  subcategoryId?: string;
  manualAmount: number;
  recurrenceAmount: number;
  totalAmount: number;
}
