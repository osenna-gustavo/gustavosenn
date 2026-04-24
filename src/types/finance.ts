export type TransactionType = 'receita' | 'despesa';

export interface Category {
  id: string;
  name: string;
  type: TransactionType;
  icon?: string;
  isFixed: boolean;
  parentId?: string;
  createdAt: Date;
}

export interface Subcategory {
  id: string;
  categoryId: string;
  name: string;
  isFixed: boolean;
  createdAt: Date;
}

export interface Transaction {
  id: string;
  date: Date;
  amount: number;
  type: TransactionType;
  categoryId: string;
  subcategoryId?: string;
  description?: string;
  origin: 'manual' | 'import' | 'recurrence';
  needsReview: boolean;
  importBatchId?: string;
  recurrenceId?: string;
  recurrenceInstanceId?: string;
  createdAt: Date;
}

export interface Budget {
  id: string;
  month: number;
  year: number;
  plannedIncome: number;
  plannedExpenses: number;
  categoryBudgets: CategoryBudget[];
  createdAt: Date;
}

export interface CategoryBudget {
  categoryId: string;
  subcategoryId?: string;
  plannedAmount: number;
}

export interface Recurrence {
  id: string;
  name: string;
  type: TransactionType;
  amount: number;
  categoryId: string;
  subcategoryId?: string;
  frequency: 'daily' | 'weekly' | 'monthly';
  startDate: Date;
  endDate?: Date;
  isActive: boolean;
  totalInstallments?: number;
  createdAt: Date;
}

export interface RecurrenceInstance {
  id: string;
  recurrenceId: string;
  month: number;
  year: number;
  status: 'pending' | 'confirmed' | 'ignored';
  linkedTransactionId?: string;
  amount: number;
  createdAt: Date;
}

export interface ImportBatch {
  id: string;
  name: string;
  type: 'image' | 'pdf';
  status: 'pending' | 'processing' | 'completed' | 'error';
  suggestedTransactions: SuggestedTransaction[];
  createdAt: Date;
}

export interface SuggestedTransaction {
  id: string;
  date?: Date;
  amount?: number;
  type: TransactionType;
  description?: string;
  suggestedCategoryId?: string;
  suggestedSubcategoryId?: string;
  confirmed: boolean;
  needsReview: boolean;
  rawText?: string;
}

export interface Scenario {
  id: string;
  name: string;
  baselineType: 'planned' | 'realized' | 'average';
  baselineMonth: number;
  baselineYear: number;
  monthlyCommitments: ScenarioCommitment[];
  oneTimeCosts: ScenarioOneTimeCost[];
  categoryAdjustments: ScenarioCategoryAdjustment[];
  minimumBalance: number;
  createdAt: Date;
}

export interface ScenarioCommitment {
  id: string;
  name: string;
  amount: number;
  categoryId: string;
  subcategoryId?: string;
  isFixed: boolean;
}

export interface ScenarioOneTimeCost {
  id: string;
  name: string;
  amount: number;
  categoryId: string;
  subcategoryId?: string;
  impactMonth: number;
  impactYear: number;
}

export interface ScenarioCategoryAdjustment {
  categoryId: string;
  subcategoryId?: string;
  adjustedAmount: number;
}

export interface ScenarioModification {
  id: string;
  type: 'monthly_commitment' | 'one_time_cost' | 'budget_adjustment';
  name: string;
  amount: number;
  categoryId: string;
  subcategoryId?: string;
  isFixed: boolean;
  impactMonth?: number;
  impactYear?: number;
}

export interface MonthSummary {
  month: number;
  year: number;
  plannedIncome: number;
  plannedExpenses: number;
  realizedIncome: number;
  realizedExpenses: number;
  plannedFixed: number;
  realizedFixed: number;
  plannedVariable: number;
  realizedVariable: number;
  balance: number;
  remainingFixed: number;
  remainingVariable: number;
  categoryBreakdown: CategorySummary[];
}

export interface CategorySummary {
  categoryId: string;
  categoryName: string;
  isFixed: boolean;
  planned: number;
  realized: number;
  status: 'ok' | 'warning' | 'exceeded';
  percentage: number;
}

export type AppScreen =
  | 'dashboard'
  | 'transactions'
  | 'budget'
  | 'categories'
  | 'recurrences'
  | 'installments'
  | 'import'
  | 'reports'
  | 'scenarios';
