import { supabase } from '@/integrations/supabase/client';
import type { BudgetAllocation, AllocationSummary } from '@/types/budget-allocation';
import type { Recurrence, RecurrenceInstance } from '@/types/finance';

// Helper to get current user ID
async function getUserId(): Promise<string> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error('User not authenticated');
  return user.id;
}

// Get all allocations for a month
export async function getBudgetAllocations(month: number, year: number): Promise<BudgetAllocation[]> {
  const userId = await getUserId();
  
  const { data, error } = await supabase
    .from('budget_allocations')
    .select('*')
    .eq('user_id', userId)
    .eq('month', month)
    .eq('year', year);
    
  if (error) throw error;
  
  return (data || []).map(a => ({
    id: a.id,
    userId: a.user_id,
    month: a.month,
    year: a.year,
    direction: a.direction as 'expense' | 'income',
    categoryId: a.category_id,
    subcategoryId: a.subcategory_id || undefined,
    source: a.source as 'manual' | 'recurrence',
    sourceId: a.source_id || undefined,
    ruleId: a.rule_id || undefined,
    amount: Number(a.amount),
    createdAt: new Date(a.created_at!),
    updatedAt: new Date(a.updated_at!),
  }));
}

// Upsert a single allocation (idempotent)
export async function upsertBudgetAllocation(
  allocation: Omit<BudgetAllocation, 'id' | 'userId' | 'createdAt' | 'updatedAt'>
): Promise<BudgetAllocation> {
  const userId = await getUserId();
  
  // Check if allocation already exists
  const { data: existing } = await supabase
    .from('budget_allocations')
    .select('id')
    .eq('user_id', userId)
    .eq('year', allocation.year)
    .eq('month', allocation.month)
    .eq('direction', allocation.direction)
    .eq('category_id', allocation.categoryId)
    .eq('source', allocation.source)
    .eq('source_id', allocation.sourceId || '')
    .maybeSingle();
  
  if (existing) {
    // Update existing
    const { data, error } = await supabase
      .from('budget_allocations')
      .update({
        amount: allocation.amount,
        subcategory_id: allocation.subcategoryId || null,
        rule_id: allocation.ruleId || null,
      })
      .eq('id', existing.id)
      .select()
      .single();
      
    if (error) throw error;
    
    return {
      id: data.id,
      userId: data.user_id,
      month: data.month,
      year: data.year,
      direction: data.direction as 'expense' | 'income',
      categoryId: data.category_id,
      subcategoryId: data.subcategory_id || undefined,
      source: data.source as 'manual' | 'recurrence',
      sourceId: data.source_id || undefined,
      ruleId: data.rule_id || undefined,
      amount: Number(data.amount),
      createdAt: new Date(data.created_at!),
      updatedAt: new Date(data.updated_at!),
    };
  } else {
    // Insert new
    const { data, error } = await supabase
      .from('budget_allocations')
      .insert({
        user_id: userId,
        month: allocation.month,
        year: allocation.year,
        direction: allocation.direction,
        category_id: allocation.categoryId,
        subcategory_id: allocation.subcategoryId || null,
        source: allocation.source,
        source_id: allocation.sourceId || null,
        rule_id: allocation.ruleId || null,
        amount: allocation.amount,
      })
      .select()
      .single();
      
    if (error) throw error;
    
    return {
      id: data.id,
      userId: data.user_id,
      month: data.month,
      year: data.year,
      direction: data.direction as 'expense' | 'income',
      categoryId: data.category_id,
      subcategoryId: data.subcategory_id || undefined,
      source: data.source as 'manual' | 'recurrence',
      sourceId: data.source_id || undefined,
      ruleId: data.rule_id || undefined,
      amount: Number(data.amount),
      createdAt: new Date(data.created_at!),
      updatedAt: new Date(data.updated_at!),
    };
  }
}

// Delete allocations by source (e.g., when removing recurrence)
export async function deleteAllocationsBySource(
  source: 'manual' | 'recurrence',
  sourceId: string
): Promise<void> {
  const userId = await getUserId();
  
  const { error } = await supabase
    .from('budget_allocations')
    .delete()
    .eq('user_id', userId)
    .eq('source', source)
    .eq('source_id', sourceId);
    
  if (error) throw error;
}

// Delete all recurrence allocations for a month (before recalculating)
export async function deleteRecurrenceAllocationsForMonth(
  month: number,
  year: number
): Promise<void> {
  const userId = await getUserId();
  
  const { error } = await supabase
    .from('budget_allocations')
    .delete()
    .eq('user_id', userId)
    .eq('month', month)
    .eq('year', year)
    .eq('source', 'recurrence');
    
  if (error) throw error;
}

// Apply recurrences to budget allocations (idempotent)
export async function applyRecurrencesToBudget(
  month: number,
  year: number,
  recurrences: Recurrence[],
  instances: RecurrenceInstance[]
): Promise<BudgetAllocation[]> {
  const allocations: BudgetAllocation[] = [];
  
  // First, delete all existing recurrence allocations for this month
  await deleteRecurrenceAllocationsForMonth(month, year);
  
  // Then, create new allocations from active recurrences
  for (const rec of recurrences) {
    if (!rec.isActive) continue;
    
    const startDate = new Date(rec.startDate);
    const endDate = rec.endDate ? new Date(rec.endDate) : null;
    
    const monthStart = new Date(year, month, 1);
    const monthEnd = new Date(year, month + 1, 0);
    
    // Check if recurrence applies to this month
    if (startDate > monthEnd) continue;
    if (endDate && endDate < monthStart) continue;
    
    // Find instance for this month (if exists)
    const instance = instances.find(i => i.recurrenceId === rec.id);
    const amount = instance?.amount ?? rec.amount;
    
    // Create allocation
    const allocation = await upsertBudgetAllocation({
      month,
      year,
      direction: rec.type === 'receita' ? 'income' : 'expense',
      categoryId: rec.categoryId,
      subcategoryId: rec.subcategoryId,
      source: 'recurrence',
      sourceId: instance?.id || rec.id, // Use instance ID if available, else rule ID
      ruleId: rec.id,
      amount,
    });
    
    allocations.push(allocation);
  }
  
  return allocations;
}

// Get allocation summary by category (combines manual + recurrence)
export async function getAllocationSummary(
  month: number,
  year: number
): Promise<AllocationSummary[]> {
  const allocations = await getBudgetAllocations(month, year);
  
  const summaryMap = new Map<string, AllocationSummary>();
  
  for (const alloc of allocations) {
    const key = alloc.subcategoryId 
      ? `${alloc.categoryId}_${alloc.subcategoryId}`
      : alloc.categoryId;
    
    const existing = summaryMap.get(key) || {
      categoryId: alloc.categoryId,
      subcategoryId: alloc.subcategoryId,
      manualAmount: 0,
      recurrenceAmount: 0,
      totalAmount: 0,
    };
    
    if (alloc.source === 'manual') {
      existing.manualAmount += alloc.amount;
    } else {
      existing.recurrenceAmount += alloc.amount;
    }
    existing.totalAmount = existing.manualAmount + existing.recurrenceAmount;
    
    summaryMap.set(key, existing);
  }
  
  return Array.from(summaryMap.values());
}
