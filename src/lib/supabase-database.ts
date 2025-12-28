import { supabase } from '@/integrations/supabase/client';
import type { 
  Category, 
  Subcategory, 
  Transaction, 
  Budget, 
  CategoryBudget,
  Recurrence, 
  RecurrenceInstance,
  ImportBatch,
  Scenario 
} from '@/types/finance';

// Helper to get current user ID
async function getUserId(): Promise<string> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error('User not authenticated');
  return user.id;
}

// Default categories to create for new users
const DEFAULT_CATEGORIES: Omit<Category, 'id' | 'createdAt'>[] = [
  { name: 'Assinaturas', icon: '📱', isFixed: true, type: 'despesa' },
  { name: 'Moradia', icon: '🏠', isFixed: true, type: 'despesa' },
  { name: 'Transporte', icon: '🚗', isFixed: false, type: 'despesa' },
  { name: 'Alimentação', icon: '🍽️', isFixed: false, type: 'despesa' },
  { name: 'Saúde', icon: '💊', isFixed: false, type: 'despesa' },
  { name: 'Lazer', icon: '🎮', isFixed: false, type: 'despesa' },
  { name: 'Educação', icon: '📚', isFixed: false, type: 'despesa' },
  { name: 'Compras', icon: '🛒', isFixed: false, type: 'despesa' },
  { name: 'Contas/Taxas', icon: '📄', isFixed: true, type: 'despesa' },
  { name: 'Outros', icon: '📦', isFixed: false, type: 'despesa' },
  { name: 'Salário', icon: '💰', isFixed: true, type: 'receita' },
  { name: 'Renda Extra', icon: '💵', isFixed: false, type: 'receita' },
];

// Initialize default categories for new user
export async function initializeDefaultCategories(): Promise<void> {
  const userId = await getUserId();
  
  const { data: existingCategories } = await supabase
    .from('categories')
    .select('id')
    .eq('user_id', userId)
    .limit(1);
  
  if (!existingCategories || existingCategories.length === 0) {
    const categoriesToInsert = DEFAULT_CATEGORIES.map(cat => ({
      user_id: userId,
      name: cat.name,
      type: cat.type,
      icon: cat.icon,
      is_fixed: cat.isFixed,
    }));
    
    await supabase.from('categories').insert(categoriesToInsert);
  }
}

// ==================== CATEGORIES ====================

export async function getCategories(): Promise<Category[]> {
  const userId = await getUserId();
  
  const { data, error } = await supabase
    .from('categories')
    .select('*')
    .eq('user_id', userId)
    .order('name');
    
  if (error) throw error;
  
  return (data || []).map(c => ({
    id: c.id,
    name: c.name,
    type: c.type as 'receita' | 'despesa',
    icon: c.icon || undefined,
    isFixed: c.is_fixed || false,
    parentId: c.parent_id || undefined,
    createdAt: new Date(c.created_at!),
  }));
}

export async function addCategory(category: Omit<Category, 'id' | 'createdAt'>): Promise<Category> {
  const userId = await getUserId();
  
  const { data, error } = await supabase
    .from('categories')
    .insert({
      user_id: userId,
      name: category.name,
      type: category.type,
      icon: category.icon,
      is_fixed: category.isFixed,
      parent_id: category.parentId,
    })
    .select()
    .single();
    
  if (error) throw error;
  
  return {
    id: data.id,
    name: data.name,
    type: data.type as 'receita' | 'despesa',
    icon: data.icon || undefined,
    isFixed: data.is_fixed || false,
    parentId: data.parent_id || undefined,
    createdAt: new Date(data.created_at!),
  };
}

export async function updateCategory(category: Category): Promise<void> {
  const { error } = await supabase
    .from('categories')
    .update({
      name: category.name,
      type: category.type,
      icon: category.icon,
      is_fixed: category.isFixed,
      parent_id: category.parentId,
    })
    .eq('id', category.id);
    
  if (error) throw error;
}

export async function deleteCategory(id: string): Promise<void> {
  const { error } = await supabase
    .from('categories')
    .delete()
    .eq('id', id);
    
  if (error) throw error;
}

// ==================== SUBCATEGORIES ====================

export async function getSubcategories(categoryId?: string): Promise<Subcategory[]> {
  const userId = await getUserId();
  
  let query = supabase
    .from('subcategories')
    .select('*')
    .eq('user_id', userId)
    .order('name');
    
  if (categoryId) {
    query = query.eq('category_id', categoryId);
  }
  
  const { data, error } = await query;
  if (error) throw error;
  
  return (data || []).map(s => ({
    id: s.id,
    categoryId: s.category_id,
    name: s.name,
    isFixed: s.is_fixed || false,
    createdAt: new Date(s.created_at!),
  }));
}

export async function addSubcategory(subcategory: Omit<Subcategory, 'id' | 'createdAt'>): Promise<Subcategory> {
  const userId = await getUserId();
  
  const { data, error } = await supabase
    .from('subcategories')
    .insert({
      user_id: userId,
      category_id: subcategory.categoryId,
      name: subcategory.name,
      is_fixed: subcategory.isFixed,
    })
    .select()
    .single();
    
  if (error) throw error;
  
  return {
    id: data.id,
    categoryId: data.category_id,
    name: data.name,
    isFixed: data.is_fixed || false,
    createdAt: new Date(data.created_at!),
  };
}

export async function updateSubcategory(subcategory: Subcategory): Promise<void> {
  const { error } = await supabase
    .from('subcategories')
    .update({
      name: subcategory.name,
      is_fixed: subcategory.isFixed,
      category_id: subcategory.categoryId,
    })
    .eq('id', subcategory.id);
    
  if (error) throw error;
}

export async function deleteSubcategory(id: string): Promise<void> {
  const { error } = await supabase
    .from('subcategories')
    .delete()
    .eq('id', id);
    
  if (error) throw error;
}

// ==================== TRANSACTIONS ====================

export async function getTransactions(month?: number, year?: number): Promise<Transaction[]> {
  const userId = await getUserId();
  
  let query = supabase
    .from('transactions')
    .select('*')
    .eq('user_id', userId)
    .order('date', { ascending: false });
  
  if (month !== undefined && year !== undefined) {
    const startDate = new Date(year, month, 1).toISOString();
    const endDate = new Date(year, month + 1, 0, 23, 59, 59).toISOString();
    query = query.gte('date', startDate).lte('date', endDate);
  }
  
  const { data, error } = await query;
  if (error) throw error;
  
  return (data || []).map(t => ({
    id: t.id,
    date: new Date(t.date),
    amount: Number(t.amount),
    type: t.type as 'receita' | 'despesa',
    categoryId: t.category_id || '',
    subcategoryId: t.subcategory_id || undefined,
    description: t.description || undefined,
    origin: (t.origin || 'manual') as 'manual' | 'import' | 'recurrence',
    needsReview: t.needs_review || false,
    importBatchId: t.import_batch_id || undefined,
    recurrenceId: t.recurrence_id || undefined,
    recurrenceInstanceId: t.recurrence_instance_id || undefined,
    createdAt: new Date(t.created_at!),
  }));
}

export async function getAllTransactions(): Promise<Transaction[]> {
  return getTransactions();
}

export async function addTransaction(transaction: Omit<Transaction, 'id' | 'createdAt'>): Promise<Transaction> {
  const userId = await getUserId();
  
  const { data, error } = await supabase
    .from('transactions')
    .insert({
      user_id: userId,
      date: transaction.date.toISOString(),
      amount: transaction.amount,
      type: transaction.type,
      category_id: transaction.categoryId || null,
      subcategory_id: transaction.subcategoryId || null,
      description: transaction.description,
      origin: transaction.origin,
      needs_review: transaction.needsReview,
      import_batch_id: transaction.importBatchId || null,
      recurrence_id: transaction.recurrenceId || null,
      recurrence_instance_id: transaction.recurrenceInstanceId || null,
    })
    .select()
    .single();
    
  if (error) throw error;
  
  return {
    id: data.id,
    date: new Date(data.date),
    amount: Number(data.amount),
    type: data.type as 'receita' | 'despesa',
    categoryId: data.category_id || '',
    subcategoryId: data.subcategory_id || undefined,
    description: data.description || undefined,
    origin: (data.origin || 'manual') as 'manual' | 'import' | 'recurrence',
    needsReview: data.needs_review || false,
    importBatchId: data.import_batch_id || undefined,
    recurrenceId: data.recurrence_id || undefined,
    recurrenceInstanceId: data.recurrence_instance_id || undefined,
    createdAt: new Date(data.created_at!),
  };
}

export async function updateTransaction(transaction: Transaction): Promise<void> {
  const { error } = await supabase
    .from('transactions')
    .update({
      date: transaction.date.toISOString(),
      amount: transaction.amount,
      type: transaction.type,
      category_id: transaction.categoryId || null,
      subcategory_id: transaction.subcategoryId || null,
      description: transaction.description,
      origin: transaction.origin,
      needs_review: transaction.needsReview,
    })
    .eq('id', transaction.id);
    
  if (error) throw error;
}

export async function deleteTransaction(id: string): Promise<void> {
  const { error } = await supabase
    .from('transactions')
    .delete()
    .eq('id', id);
    
  if (error) throw error;
}

// ==================== BUDGETS ====================

export async function getBudget(month: number, year: number): Promise<Budget | undefined> {
  const userId = await getUserId();
  
  const { data: budgetData, error: budgetError } = await supabase
    .from('budgets')
    .select('*')
    .eq('user_id', userId)
    .eq('month', month)
    .eq('year', year)
    .maybeSingle();
    
  if (budgetError) throw budgetError;
  if (!budgetData) return undefined;
  
  // Get budget items
  const { data: itemsData, error: itemsError } = await supabase
    .from('budget_items')
    .select('*')
    .eq('budget_id', budgetData.id);
    
  if (itemsError) throw itemsError;
  
  const categoryBudgets: CategoryBudget[] = (itemsData || []).map(item => ({
    categoryId: item.category_id,
    subcategoryId: item.subcategory_id || undefined,
    plannedAmount: Number(item.planned_amount),
  }));
  
  return {
    id: budgetData.id,
    month: budgetData.month,
    year: budgetData.year,
    plannedIncome: Number(budgetData.planned_income),
    plannedExpenses: Number(budgetData.planned_expenses),
    categoryBudgets,
    createdAt: new Date(budgetData.created_at!),
  };
}

export async function getAllBudgets(): Promise<Budget[]> {
  const userId = await getUserId();
  
  const { data, error } = await supabase
    .from('budgets')
    .select('*')
    .eq('user_id', userId);
    
  if (error) throw error;
  
  const budgets: Budget[] = [];
  for (const b of data || []) {
    const budget = await getBudget(b.month, b.year);
    if (budget) budgets.push(budget);
  }
  
  return budgets;
}

export async function saveBudget(budget: Omit<Budget, 'id' | 'createdAt'> & { id?: string }): Promise<Budget> {
  const userId = await getUserId();
  
  // Check if budget exists for this month/year
  const existing = await getBudget(budget.month, budget.year);
  
  let budgetId: string;
  
  if (existing) {
    // Update existing budget
    const { error: updateError } = await supabase
      .from('budgets')
      .update({
        planned_income: budget.plannedIncome,
        planned_expenses: budget.plannedExpenses,
      })
      .eq('id', existing.id);
      
    if (updateError) throw updateError;
    budgetId = existing.id;
    
    // Delete existing budget items
    await supabase.from('budget_items').delete().eq('budget_id', existing.id);
  } else {
    // Create new budget
    const { data: newBudget, error: insertError } = await supabase
      .from('budgets')
      .insert({
        user_id: userId,
        month: budget.month,
        year: budget.year,
        planned_income: budget.plannedIncome,
        planned_expenses: budget.plannedExpenses,
      })
      .select()
      .single();
      
    if (insertError) throw insertError;
    budgetId = newBudget.id;
  }
  
  // Insert budget items
  if (budget.categoryBudgets.length > 0) {
    const items = budget.categoryBudgets.map(cb => ({
      budget_id: budgetId,
      category_id: cb.categoryId,
      subcategory_id: cb.subcategoryId || null,
      planned_amount: cb.plannedAmount,
    }));
    
    const { error: itemsError } = await supabase.from('budget_items').insert(items);
    if (itemsError) throw itemsError;
  }
  
  return (await getBudget(budget.month, budget.year))!;
}

// ==================== RECURRENCES ====================

export async function getRecurrences(): Promise<Recurrence[]> {
  const userId = await getUserId();
  
  const { data, error } = await supabase
    .from('recurrences')
    .select('*')
    .eq('user_id', userId)
    .order('name');
    
  if (error) throw error;
  
  return (data || []).map(r => ({
    id: r.id,
    name: r.name,
    type: r.type as 'receita' | 'despesa',
    amount: Number(r.amount),
    categoryId: r.category_id || '',
    subcategoryId: r.subcategory_id || undefined,
    frequency: r.frequency as 'daily' | 'weekly' | 'monthly',
    startDate: new Date(r.start_date),
    endDate: r.end_date ? new Date(r.end_date) : undefined,
    isActive: r.is_active || true,
    createdAt: new Date(r.created_at!),
  }));
}

export async function addRecurrence(recurrence: Omit<Recurrence, 'id' | 'createdAt'>): Promise<Recurrence> {
  const userId = await getUserId();
  
  const { data, error } = await supabase
    .from('recurrences')
    .insert({
      user_id: userId,
      name: recurrence.name,
      type: recurrence.type,
      amount: recurrence.amount,
      category_id: recurrence.categoryId || null,
      subcategory_id: recurrence.subcategoryId || null,
      frequency: recurrence.frequency,
      start_date: recurrence.startDate.toISOString().split('T')[0],
      end_date: recurrence.endDate ? recurrence.endDate.toISOString().split('T')[0] : null,
      is_active: recurrence.isActive,
    })
    .select()
    .single();
    
  if (error) throw error;
  
  return {
    id: data.id,
    name: data.name,
    type: data.type as 'receita' | 'despesa',
    amount: Number(data.amount),
    categoryId: data.category_id || '',
    subcategoryId: data.subcategory_id || undefined,
    frequency: data.frequency as 'daily' | 'weekly' | 'monthly',
    startDate: new Date(data.start_date),
    endDate: data.end_date ? new Date(data.end_date) : undefined,
    isActive: data.is_active || true,
    createdAt: new Date(data.created_at!),
  };
}

export async function updateRecurrence(recurrence: Recurrence): Promise<void> {
  const { error } = await supabase
    .from('recurrences')
    .update({
      name: recurrence.name,
      type: recurrence.type,
      amount: recurrence.amount,
      category_id: recurrence.categoryId || null,
      subcategory_id: recurrence.subcategoryId || null,
      frequency: recurrence.frequency,
      start_date: recurrence.startDate.toISOString().split('T')[0],
      end_date: recurrence.endDate ? recurrence.endDate.toISOString().split('T')[0] : null,
      is_active: recurrence.isActive,
    })
    .eq('id', recurrence.id);
    
  if (error) throw error;
}

export async function deleteRecurrence(id: string): Promise<void> {
  const { error } = await supabase
    .from('recurrences')
    .delete()
    .eq('id', id);
    
  if (error) throw error;
}

// ==================== RECURRENCE INSTANCES ====================

export async function getRecurrenceInstances(month: number, year: number): Promise<RecurrenceInstance[]> {
  const userId = await getUserId();
  
  const { data, error } = await supabase
    .from('recurrence_instances')
    .select('*')
    .eq('user_id', userId)
    .eq('month', month)
    .eq('year', year);
    
  if (error) throw error;
  
  return (data || []).map(i => ({
    id: i.id,
    recurrenceId: i.recurrence_id,
    month: i.month,
    year: i.year,
    status: i.status as 'pending' | 'confirmed' | 'ignored',
    linkedTransactionId: i.linked_transaction_id || undefined,
    amount: Number(i.amount),
    createdAt: new Date(i.created_at!),
  }));
}

export async function addRecurrenceInstance(instance: Omit<RecurrenceInstance, 'id' | 'createdAt'>): Promise<RecurrenceInstance> {
  const userId = await getUserId();
  
  const { data, error } = await supabase
    .from('recurrence_instances')
    .insert({
      user_id: userId,
      recurrence_id: instance.recurrenceId,
      month: instance.month,
      year: instance.year,
      status: instance.status,
      linked_transaction_id: instance.linkedTransactionId || null,
      amount: instance.amount,
    })
    .select()
    .single();
    
  if (error) throw error;
  
  return {
    id: data.id,
    recurrenceId: data.recurrence_id,
    month: data.month,
    year: data.year,
    status: data.status as 'pending' | 'confirmed' | 'ignored',
    linkedTransactionId: data.linked_transaction_id || undefined,
    amount: Number(data.amount),
    createdAt: new Date(data.created_at!),
  };
}

export async function updateRecurrenceInstance(instance: RecurrenceInstance): Promise<void> {
  const { error } = await supabase
    .from('recurrence_instances')
    .update({
      status: instance.status,
      linked_transaction_id: instance.linkedTransactionId || null,
      amount: instance.amount,
    })
    .eq('id', instance.id);
    
  if (error) throw error;
}

export async function deleteRecurrenceInstance(id: string): Promise<void> {
  const { error } = await supabase
    .from('recurrence_instances')
    .delete()
    .eq('id', id);
    
  if (error) throw error;
}

// ==================== SCENARIOS ====================

export async function getScenarios(): Promise<Scenario[]> {
  const userId = await getUserId();
  
  const { data, error } = await supabase
    .from('scenarios')
    .select('*')
    .eq('user_id', userId)
    .order('name');
    
  if (error) throw error;
  
  return (data || []).map(s => ({
    id: s.id,
    name: s.name,
    baselineType: s.baseline_type as 'planned' | 'realized' | 'average',
    baselineMonth: s.baseline_month,
    baselineYear: s.baseline_year,
    monthlyCommitments: (s.monthly_commitments as any[]) || [],
    oneTimeCosts: (s.one_time_costs as any[]) || [],
    categoryAdjustments: (s.category_adjustments as any[]) || [],
    minimumBalance: Number(s.minimum_balance),
    createdAt: new Date(s.created_at!),
  }));
}

export async function addScenario(scenario: Omit<Scenario, 'id' | 'createdAt'>): Promise<Scenario> {
  const userId = await getUserId();
  
  const { data, error } = await supabase
    .from('scenarios')
    .insert({
      user_id: userId,
      name: scenario.name,
      baseline_type: scenario.baselineType,
      baseline_month: scenario.baselineMonth,
      baseline_year: scenario.baselineYear,
      monthly_commitments: JSON.parse(JSON.stringify(scenario.monthlyCommitments)),
      one_time_costs: JSON.parse(JSON.stringify(scenario.oneTimeCosts)),
      category_adjustments: JSON.parse(JSON.stringify(scenario.categoryAdjustments)),
      minimum_balance: scenario.minimumBalance,
    })
    .select()
    .single();
    
  if (error) throw error;
  
  return {
    id: data.id,
    name: data.name,
    baselineType: data.baseline_type as 'planned' | 'realized' | 'average',
    baselineMonth: data.baseline_month,
    baselineYear: data.baseline_year,
    monthlyCommitments: (data.monthly_commitments as any[]) || [],
    oneTimeCosts: (data.one_time_costs as any[]) || [],
    categoryAdjustments: (data.category_adjustments as any[]) || [],
    minimumBalance: Number(data.minimum_balance),
    createdAt: new Date(data.created_at!),
  };
}

export async function updateScenario(scenario: Scenario): Promise<void> {
  const { error } = await supabase
    .from('scenarios')
    .update({
      name: scenario.name,
      baseline_type: scenario.baselineType,
      baseline_month: scenario.baselineMonth,
      baseline_year: scenario.baselineYear,
      monthly_commitments: JSON.parse(JSON.stringify(scenario.monthlyCommitments)),
      one_time_costs: JSON.parse(JSON.stringify(scenario.oneTimeCosts)),
      category_adjustments: JSON.parse(JSON.stringify(scenario.categoryAdjustments)),
      minimum_balance: scenario.minimumBalance,
    })
    .eq('id', scenario.id);
    
  if (error) throw error;
}

export async function deleteScenario(id: string): Promise<void> {
  const { error } = await supabase
    .from('scenarios')
    .delete()
    .eq('id', id);
    
  if (error) throw error;
}

// ==================== IMPORT BATCHES ====================

export async function getImportBatches(): Promise<ImportBatch[]> {
  const userId = await getUserId();
  
  const { data, error } = await supabase
    .from('import_batches')
    .select('*')
    .eq('user_id', userId)
    .order('created_at', { ascending: false });
    
  if (error) throw error;
  
  return (data || []).map(b => ({
    id: b.id,
    name: b.name,
    type: b.type as 'image' | 'pdf',
    status: b.status as 'pending' | 'processing' | 'completed' | 'error',
    suggestedTransactions: (b.suggested_transactions as any[]) || [],
    createdAt: new Date(b.created_at!),
  }));
}

export async function addImportBatch(batch: Omit<ImportBatch, 'id' | 'createdAt'>): Promise<ImportBatch> {
  const userId = await getUserId();
  
  const { data, error } = await supabase
    .from('import_batches')
    .insert({
      user_id: userId,
      name: batch.name,
      type: batch.type,
      status: batch.status,
      suggested_transactions: JSON.parse(JSON.stringify(batch.suggestedTransactions)),
    })
    .select()
    .single();
    
  if (error) throw error;
  
  return {
    id: data.id,
    name: data.name,
    type: data.type as 'image' | 'pdf',
    status: data.status as 'pending' | 'processing' | 'completed' | 'error',
    suggestedTransactions: (data.suggested_transactions as any[]) || [],
    createdAt: new Date(data.created_at!),
  };
}

export async function updateImportBatch(batch: ImportBatch): Promise<void> {
  const { error } = await supabase
    .from('import_batches')
    .update({
      name: batch.name,
      type: batch.type,
      status: batch.status,
      suggested_transactions: JSON.parse(JSON.stringify(batch.suggestedTransactions)),
    })
    .eq('id', batch.id);
    
  if (error) throw error;
}

export async function deleteImportBatch(id: string): Promise<void> {
  const { error } = await supabase
    .from('import_batches')
    .delete()
    .eq('id', id);
    
  if (error) throw error;
}

// ==================== SETTINGS (using localStorage for non-critical settings) ====================

export async function isAppInitialized(): Promise<boolean> {
  return localStorage.getItem('fluxocaixa_initialized') === 'true';
}

export async function setAppInitialized(): Promise<void> {
  localStorage.setItem('fluxocaixa_initialized', 'true');
}

export async function getSetting<T>(key: string): Promise<T | undefined> {
  const value = localStorage.getItem(`fluxocaixa_${key}`);
  return value ? JSON.parse(value) : undefined;
}

export async function setSetting<T>(key: string, value: T): Promise<void> {
  localStorage.setItem(`fluxocaixa_${key}`, JSON.stringify(value));
}
