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
  Project,
  FinancialCycle,
  PaymentMethod,
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

type DatabaseTransaction = {
  id: string; date: string; amount: number; type: string;
  category_id: string | null; subcategory_id: string | null; description: string | null;
  origin: string | null; needs_review: boolean | null; import_batch_id: string | null;
  recurrence_id: string | null; recurrence_instance_id: string | null;
  payment_method: string; cash_date: string | null; affects_budget: boolean; affects_cash: boolean;
  credit_card_label: string | null; created_at: string | null;
};

function mapTransaction(t: DatabaseTransaction): Transaction {
  return {
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
    paymentMethod: (t.payment_method || 'account') as PaymentMethod,
    cashDate: t.cash_date ? new Date(t.cash_date) : undefined,
    affectsBudget: t.affects_budget ?? true,
    affectsCash: t.affects_cash ?? true,
    creditCardLabel: t.credit_card_label || undefined,
    createdAt: new Date(t.created_at!),
  };
}


export async function getTransactions(
  month?: number,
  year?: number,
  dateRange?: { start: Date; end: Date }
): Promise<Transaction[]> {
  const userId = await getUserId();

  let query = supabase
    .from('transactions')
    .select('*')
    .eq('user_id', userId)
    .eq('affects_budget', true)
    .order('date', { ascending: false });

  if (dateRange) {
    query = query
      .gte('date', dateRange.start.toISOString())
      .lte('date', dateRange.end.toISOString());
  } else if (month !== undefined && year !== undefined) {
    const startDate = new Date(year, month, 1).toISOString();
    const endDate = new Date(year, month + 1, 0, 23, 59, 59).toISOString();
    query = query.gte('date', startDate).lte('date', endDate);
  }
  
  const { data, error } = await query;
  if (error) throw error;
  
  return (data || []).map(mapTransaction);
}

export async function getAllTransactions(): Promise<Transaction[]> {
  return getTransactions();
}

export async function getCashTransactions(
  dateRange?: { start: Date; end: Date },
): Promise<Transaction[]> {
  const userId = await getUserId();

  let query = supabase
    .from('transactions')
    .select('*')
    .eq('user_id', userId)
    .eq('affects_cash', true)
    .not('cash_date', 'is', null)
    .order('cash_date', { ascending: false });

  if (dateRange) {
    query = query
      .gte('cash_date', dateRange.start.toISOString())
      .lte('cash_date', dateRange.end.toISOString());
  }

  const { data, error } = await query;
  if (error) throw error;
  return (data || []).map(mapTransaction);
}

export async function addTransaction(transaction: Omit<Transaction, 'id' | 'createdAt'>): Promise<Transaction> {
  const userId = await getUserId();
  const paymentMethod = transaction.paymentMethod ?? 'account';
  const affectsBudget = transaction.affectsBudget ?? paymentMethod !== 'invoice_payment';
  const affectsCash = transaction.affectsCash ?? paymentMethod !== 'credit_card';
  const cashDate = affectsCash ? (transaction.cashDate ?? transaction.date) : undefined;
  
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
      payment_method: paymentMethod,
      cash_date: cashDate?.toISOString() ?? null,
      affects_budget: affectsBudget,
      affects_cash: affectsCash,
      credit_card_label: transaction.creditCardLabel || null,
    })
    .select()
    .single();
    
  if (error) throw error;
  
  return mapTransaction(data);
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
      payment_method: transaction.paymentMethod ?? 'account',
      cash_date: transaction.affectsCash === false
        ? null
        : (transaction.cashDate ?? transaction.date).toISOString(),
      affects_budget: transaction.affectsBudget ?? transaction.paymentMethod !== 'invoice_payment',
      affects_cash: transaction.affectsCash ?? transaction.paymentMethod !== 'credit_card',
      credit_card_label: transaction.creditCardLabel || null,
    })
    .eq('id', transaction.id);
    
  if (error) throw error;
}

// ==================== FINANCIAL CYCLES ====================

function parseLocalDate(value: string): Date {
  const [year, month, day] = value.split('-').map(Number);
  return new Date(year, month - 1, day);
}

function toDateOnly(value: Date): string {
  const year = value.getFullYear();
  const month = String(value.getMonth() + 1).padStart(2, '0');
  const day = String(value.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

export async function getFinancialCycle(month: number, year: number): Promise<FinancialCycle | null> {
  const userId = await getUserId();
  const { data, error } = await supabase
    .from('financial_cycles')
    .select('*')
    .eq('user_id', userId)
    .eq('month', month)
    .eq('year', year)
    .maybeSingle();

  if (error) throw error;
  if (!data) return null;

  return {
    id: data.id,
    month: data.month,
    year: data.year,
    startDate: parseLocalDate(data.start_date),
    endDate: parseLocalDate(data.end_date),
    createdAt: new Date(data.created_at),
    updatedAt: new Date(data.updated_at),
  };
}

export async function saveFinancialCycle(
  cycle: Omit<FinancialCycle, 'id' | 'createdAt' | 'updatedAt'>,
): Promise<FinancialCycle> {
  const userId = await getUserId();
  const { error } = await supabase
    .from('financial_cycles')
    .upsert({
      user_id: userId,
      month: cycle.month,
      year: cycle.year,
      start_date: toDateOnly(cycle.startDate),
      end_date: toDateOnly(cycle.endDate),
    }, { onConflict: 'user_id,month,year' });

  if (error) throw error;
  const saved = await getFinancialCycle(cycle.month, cycle.year);
  if (!saved) throw new Error('Não foi possível carregar o ciclo salvo.');
  return saved;
}

export async function deleteTransaction(id: string): Promise<void> {
  // First, check if this transaction is linked to a recurrence instance
  const { data: transaction, error: fetchError } = await supabase
    .from('transactions')
    .select('recurrence_instance_id')
    .eq('id', id)
    .maybeSingle();
  
  if (fetchError) throw fetchError;
  
  // If linked to a recurrence instance, reset the instance to pending
  if (transaction?.recurrence_instance_id) {
    const { error: instanceError } = await supabase
      .from('recurrence_instances')
      .update({
        status: 'pending',
        linked_transaction_id: null,
      })
      .eq('id', transaction.recurrence_instance_id);
    
    if (instanceError) {
      console.error('Error resetting recurrence instance:', instanceError);
      // Continue with deletion anyway
    }
  }
  
  // Now delete the transaction
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
    totalInstallments: r.total_installments || undefined,
    createdAt: new Date(r.created_at!),
  }));
}

export async function addRecurrence(recurrence: Omit<Recurrence, 'id' | 'createdAt'>): Promise<Recurrence> {
  const userId = await getUserId();

  // For installment plans, auto-calculate endDate from startDate + totalInstallments
  let endDate = recurrence.endDate;
  if (recurrence.totalInstallments && !endDate) {
    const end = new Date(recurrence.startDate);
    end.setMonth(end.getMonth() + recurrence.totalInstallments - 1);
    endDate = end;
  }

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
      end_date: endDate ? endDate.toISOString().split('T')[0] : null,
      is_active: recurrence.isActive,
      total_installments: recurrence.totalInstallments || null,
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
    totalInstallments: data.total_installments || undefined,
    createdAt: new Date(data.created_at!),
  };
}

export async function updateRecurrence(recurrence: Recurrence): Promise<void> {
  // For installment plans, auto-calculate endDate from startDate + totalInstallments
  let endDate = recurrence.endDate;
  if (recurrence.totalInstallments && !endDate) {
    const end = new Date(recurrence.startDate);
    end.setMonth(end.getMonth() + recurrence.totalInstallments - 1);
    endDate = end;
  }

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
      end_date: endDate ? endDate.toISOString().split('T')[0] : null,
      is_active: recurrence.isActive,
      total_installments: recurrence.totalInstallments || null,
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
  
  // Upsert by (recurrence_id, year, month) to avoid creating duplicates if the
  // app tries to regenerate instances for an already-existing month.
  const { data, error } = await supabase
    .from('recurrence_instances')
    .upsert({
      user_id: userId,
      recurrence_id: instance.recurrenceId,
      month: instance.month,
      year: instance.year,
      status: instance.status,
      linked_transaction_id: instance.linkedTransactionId || null,
      amount: instance.amount,
    }, { onConflict: 'recurrence_id,year,month', ignoreDuplicates: false })
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

// ==================== PROJECTS ====================

export async function getProjects(): Promise<Project[]> {
  const userId = await getUserId();

  const { data, error } = await supabase
    .from('projects')
    .select('*')
    .eq('user_id', userId)
    .order('position', { ascending: true })
    .order('created_at', { ascending: false });

  if (error) throw error;

  return (data || []).map(p => ({
    id: p.id,
    name: p.name,
    description: p.description || undefined,
    status: p.status as Project['status'],
    items: (p.items as any[]) || [],
    position: p.position ?? 0,
    createdAt: new Date(p.created_at!),
  }));
}

export async function addProject(project: Omit<Project, 'id' | 'createdAt'>): Promise<Project> {
  const userId = await getUserId();

  const { data, error } = await supabase
    .from('projects')
    .insert({
      user_id: userId,
      name: project.name,
      description: project.description || null,
      status: project.status,
      items: JSON.parse(JSON.stringify(project.items)),
      position: project.position,
    })
    .select()
    .single();

  if (error) throw error;

  return {
    id: data.id,
    name: data.name,
    description: data.description || undefined,
    status: data.status as Project['status'],
    items: (data.items as any[]) || [],
    position: data.position ?? 0,
    createdAt: new Date(data.created_at!),
  };
}

export async function updateProject(project: Project): Promise<void> {
  const { error } = await supabase
    .from('projects')
    .update({
      name: project.name,
      description: project.description || null,
      status: project.status,
      items: JSON.parse(JSON.stringify(project.items)),
      position: project.position,
    })
    .eq('id', project.id);

  if (error) throw error;
}

export async function deleteProject(id: string): Promise<void> {
  const { error } = await supabase
    .from('projects')
    .delete()
    .eq('id', id);

  if (error) throw error;
}

export async function reorderProjects(updates: { id: string; position: number }[]): Promise<void> {
  for (const { id, position } of updates) {
    const { error } = await supabase
      .from('projects')
      .update({ position })
      .eq('id', id);

    if (error) throw error;
  }
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

// ==================== BULK OPERATIONS ====================

export async function bulkUpdateTransactions(
  ids: string[],
  updates: { categoryId?: string; subcategoryId?: string | null; description?: string; type?: 'receita' | 'despesa' }
): Promise<void> {
  if (ids.length === 0) return;

  const payload: Record<string, unknown> = {};
  if (updates.categoryId !== undefined) payload.category_id = updates.categoryId;
  if (updates.subcategoryId !== undefined) payload.subcategory_id = updates.subcategoryId;
  if (updates.description !== undefined) payload.description = updates.description;
  if (updates.type !== undefined) payload.type = updates.type;

  const { error } = await supabase
    .from('transactions')
    .update(payload)
    .in('id', ids);

  if (error) throw error;
}

export async function bulkDeleteTransactions(ids: string[]): Promise<void> {
  if (ids.length === 0) return;

  // Reset any linked recurrence instances to pending first
  const { data: linkedTransactions } = await supabase
    .from('transactions')
    .select('id, recurrence_instance_id')
    .in('id', ids);

  const instanceIds = (linkedTransactions || [])
    .map(t => t.recurrence_instance_id)
    .filter(Boolean) as string[];

  if (instanceIds.length > 0) {
    await supabase
      .from('recurrence_instances')
      .update({ status: 'pending', linked_transaction_id: null })
      .in('id', instanceIds);
  }

  const { error } = await supabase
    .from('transactions')
    .delete()
    .in('id', ids);

  if (error) throw error;
}

export async function linkTransactionsToRecurrence(
  transactionIds: string[],
  recurrenceId: string,
  month: number,
  year: number,
  recurrenceAmount: number
): Promise<void> {
  if (transactionIds.length === 0) return;
  const userId = await getUserId();

  // Find existing instance for this recurrence/month/year
  const { data: existingInstances } = await supabase
    .from('recurrence_instances')
    .select('*')
    .eq('user_id', userId)
    .eq('recurrence_id', recurrenceId)
    .eq('month', month)
    .eq('year', year)
    .limit(1);

  let instanceId: string;
  const primaryTransactionId = transactionIds[0];

  if (existingInstances && existingInstances.length > 0) {
    // Update existing instance to confirmed
    instanceId = existingInstances[0].id;
    await supabase
      .from('recurrence_instances')
      .update({
        status: 'confirmed',
        linked_transaction_id: primaryTransactionId,
      })
      .eq('id', instanceId);
  } else {
    // Create a new confirmed instance
    const { data: newInstance, error: instanceError } = await supabase
      .from('recurrence_instances')
      .insert({
        user_id: userId,
        recurrence_id: recurrenceId,
        month,
        year,
        status: 'confirmed',
        linked_transaction_id: primaryTransactionId,
        amount: recurrenceAmount,
      })
      .select()
      .single();
    if (instanceError) throw instanceError;
    instanceId = newInstance.id;
  }

  // Set recurrenceId on all selected transactions
  // Set recurrenceInstanceId only on the primary transaction
  await supabase
    .from('transactions')
    .update({ recurrence_id: recurrenceId, recurrence_instance_id: instanceId })
    .eq('id', primaryTransactionId);

  if (transactionIds.length > 1) {
    const rest = transactionIds.slice(1);
    await supabase
      .from('transactions')
      .update({ recurrence_id: recurrenceId, recurrence_instance_id: null })
      .in('id', rest);
  }
}

export async function bulkUpdateRecurrences(
  ids: string[],
  updates: { isActive?: boolean; categoryId?: string; subcategoryId?: string | null }
): Promise<void> {
  if (ids.length === 0) return;

  const payload: Record<string, unknown> = {};
  if (updates.isActive !== undefined) payload.is_active = updates.isActive;
  if (updates.categoryId !== undefined) payload.category_id = updates.categoryId;
  if (updates.subcategoryId !== undefined) payload.subcategory_id = updates.subcategoryId;

  const { error } = await supabase
    .from('recurrences')
    .update(payload)
    .in('id', ids);

  if (error) throw error;
}

export async function bulkDeleteRecurrences(ids: string[]): Promise<void> {
  if (ids.length === 0) return;

  const { error } = await supabase
    .from('recurrences')
    .delete()
    .in('id', ids);

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
