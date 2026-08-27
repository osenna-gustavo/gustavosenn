import React, { createContext, useContext, useState, useEffect, useCallback, useMemo } from 'react';
import type {
  Category,
  Subcategory,
  Transaction,
  Budget,
  Recurrence,
  RecurrenceInstance,
  MonthSummary,
  AppScreen,
  FinancialCycle,
} from '@/types/finance';
import * as db from '@/lib/supabase-database';
import { supabase } from '@/integrations/supabase/client';
import { getCurrentMonthYear, getBillingPeriod } from '@/lib/formatters';
import { useAuth } from '@/contexts/AuthContext';
import { computeRealized } from '@/lib/category-summary';
import { computeCycleCommitments } from '@/lib/cycle-commitments';

const BILLING_CLOSE_DAY_KEY = 'fluxocaixa_billing_close_day';

interface AppContextType {
  // Navigation
  currentScreen: AppScreen;
  setCurrentScreen: (screen: AppScreen) => void;
  
  // Month selection
  selectedMonth: number;
  selectedYear: number;
  setSelectedMonth: (month: number, year: number) => void;
  
  // Data
  categories: Category[];
  subcategories: Subcategory[];
  transactions: Transaction[];
  cashTransactions: Transaction[];
  financialCycle: FinancialCycle | null;
  budget: Budget | null;
  recurrences: Recurrence[];
  recurrenceInstances: RecurrenceInstance[];
  monthSummary: MonthSummary | null;
  
  // Loading states
  isLoading: boolean;
  isInitialized: boolean;
  
  // Actions
  refreshData: () => Promise<void>;
  addTransaction: (transaction: Omit<Transaction, 'id' | 'createdAt'>) => Promise<Transaction>;
  updateTransaction: (transaction: Transaction) => Promise<void>;
  deleteTransaction: (id: string) => Promise<void>;
  addCategory: (category: Omit<Category, 'id' | 'createdAt'>) => Promise<Category>;
  updateCategory: (category: Category) => Promise<void>;
  deleteCategory: (id: string) => Promise<void>;
  addSubcategory: (subcategory: Omit<Subcategory, 'id' | 'createdAt'>) => Promise<Subcategory>;
  updateSubcategory: (subcategory: Subcategory) => Promise<void>;
  deleteSubcategory: (id: string) => Promise<void>;
  saveBudget: (budget: Omit<Budget, 'id' | 'createdAt'>) => Promise<Budget>;
  addRecurrence: (recurrence: Omit<Recurrence, 'id' | 'createdAt'>) => Promise<Recurrence>;
  updateRecurrence: (recurrence: Recurrence) => Promise<void>;
  deleteRecurrence: (id: string) => Promise<void>;
  bulkUpdateTransactions: (ids: string[], updates: { categoryId?: string; subcategoryId?: string | null; description?: string; type?: 'receita' | 'despesa' }) => Promise<void>;
  bulkDeleteTransactions: (ids: string[]) => Promise<void>;
  bulkUpdateRecurrences: (ids: string[], updates: { isActive?: boolean; categoryId?: string; subcategoryId?: string | null }) => Promise<void>;
  bulkDeleteRecurrences: (ids: string[]) => Promise<void>;
  linkTransactionsToRecurrence: (transactionIds: string[], recurrenceId: string) => Promise<void>;
  saveFinancialCycle: (cycle: Omit<FinancialCycle, 'id' | 'createdAt' | 'updatedAt'>) => Promise<FinancialCycle>;
  
  // Billing cycle settings
  billingCloseDay: number | null;
  setBillingCloseDay: (day: number | null) => void;
  billingDateRange: { start: Date; end: Date } | null;

  // Last used category for quick entry
  lastUsedCategoryId: string | null;
  setLastUsedCategoryId: (id: string) => void;
}

const AppContext = createContext<AppContextType | null>(null);

export function AppProvider({ children }: { children: React.ReactNode }) {
  const { user } = useAuth();
  // Supabase recria o objeto `user` a cada evento de auth (ex.: refresh de token,
  // revalidação ao focar a aba) mesmo quando o usuário logado não muda. Usar o id
  // como dependência evita refetch/loading em loop nesses casos.
  const userId = user?.id;
  const [currentScreen, setCurrentScreen] = useState<AppScreen>('dashboard');
  const { month: currentMonth, year: currentYear } = getCurrentMonthYear();
  const [selectedMonth, setSelectedMonthState] = useState(currentMonth);
  const [selectedYear, setSelectedYearState] = useState(currentYear);
  
  const [categories, setCategories] = useState<Category[]>([]);
  const [subcategories, setSubcategories] = useState<Subcategory[]>([]);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [cashTransactions, setCashTransactions] = useState<Transaction[]>([]);
  const [financialCycle, setFinancialCycle] = useState<FinancialCycle | null>(null);
  const [budget, setBudget] = useState<Budget | null>(null);
  const [recurrences, setRecurrences] = useState<Recurrence[]>([]);
  const [recurrenceInstances, setRecurrenceInstances] = useState<RecurrenceInstance[]>([]);
  const [monthSummary, setMonthSummary] = useState<MonthSummary | null>(null);
  
  const [isLoading, setIsLoading] = useState(true);
  const [isInitialized, setIsInitialized] = useState(false);
  const [lastUsedCategoryId, setLastUsedCategoryId] = useState<string | null>(null);

  const [billingCloseDay, setBillingCloseDayState] = useState<number | null>(() => {
    try {
      const stored = localStorage.getItem(BILLING_CLOSE_DAY_KEY);
      if (stored === null) return null;
      const val = Number(stored);
      return val >= 1 && val <= 28 ? val : null;
    } catch {
      return null;
    }
  });

  const setBillingCloseDay = useCallback(async (day: number | null) => {
    setBillingCloseDayState(day);
    try {
      if (day === null) {
        localStorage.removeItem(BILLING_CLOSE_DAY_KEY);
      } else {
        localStorage.setItem(BILLING_CLOSE_DAY_KEY, String(day));
      }
    } catch { /* ignore */ }

    // Persist to cloud so it stays consistent across devices/sessions
    if (user) {
      try {
        await supabase
          .from('user_settings')
          .upsert(
            { user_id: user.id, billing_close_day: day },
            { onConflict: 'user_id' }
          );
      } catch (err) {
        console.error('[AppContext] Failed to persist billing_close_day:', err);
      }
    }
  }, [userId]);

  // Load billing_close_day from cloud when user logs in (cloud is source of truth)
  useEffect(() => {
    if (!user) return;
    let cancelled = false;
    (async () => {
      try {
        const { data, error } = await supabase
          .from('user_settings')
          .select('billing_close_day')
          .eq('user_id', user.id)
          .maybeSingle();
        if (cancelled) return;
        if (error) {
          console.error('[AppContext] Failed to load user_settings:', error);
          return;
        }
        if (data) {
          const day = data.billing_close_day;
          setBillingCloseDayState(day);
          try {
            if (day === null || day === undefined) {
              localStorage.removeItem(BILLING_CLOSE_DAY_KEY);
            } else {
              localStorage.setItem(BILLING_CLOSE_DAY_KEY, String(day));
            }
          } catch { /* ignore */ }
        } else {
          // No row yet: if we have a local value, push it up so it's persisted
          const local = localStorage.getItem(BILLING_CLOSE_DAY_KEY);
          if (local !== null) {
            const val = Number(local);
            if (val >= 1 && val <= 28) {
              await supabase
                .from('user_settings')
                .upsert(
                  { user_id: user.id, billing_close_day: val },
                  { onConflict: 'user_id' }
                );
            }
          }
        }
      } catch (err) {
        console.error('[AppContext] Error loading user_settings:', err);
      }
    })();
    return () => { cancelled = true; };
  }, [userId]);

  const billingDateRange = useMemo(() => {
    if (financialCycle) return { start: financialCycle.startDate, end: new Date(financialCycle.endDate.getFullYear(), financialCycle.endDate.getMonth(), financialCycle.endDate.getDate(), 23, 59, 59, 999) };
    if (!billingCloseDay) return null;
    return getBillingPeriod(selectedMonth, selectedYear, billingCloseDay);
  }, [billingCloseDay, financialCycle, selectedMonth, selectedYear]);

  const setSelectedMonth = useCallback((month: number, year: number) => {
    setSelectedMonthState(month);
    setSelectedYearState(year);
  }, []);

  const calculateMonthSummary = useCallback((
    cats: Category[],
    subs: Subcategory[],
    trans: Transaction[],
    budg: Budget | null,
    recs: Recurrence[],
    instances: RecurrenceInstance[],
    cashTrans: Transaction[],
    month: number,
    year: number,
    dateRange?: { start: Date; end: Date }
  ): MonthSummary => {
    // When billing period is active, transactions are pre-filtered by getTransactions.
    // Skip the calendar-month filter so cross-month billing periods work correctly.
    const monthTransactions = dateRange ? trans : trans.filter(t => {
      const date = new Date(t.date);
      return date.getMonth() === month && date.getFullYear() === year;
    });

    const realizedIncome = monthTransactions
      .filter(t => t.type === 'receita')
      .reduce((sum, t) => sum + t.amount, 0);

    const realizedExpenses = monthTransactions
      .filter(t => t.type === 'despesa')
      .reduce((sum, t) => sum + t.amount, 0);

    const commitments = computeCycleCommitments(recs, instances, monthTransactions, month, year);
    const plannedIncome = Math.max(budg?.plannedIncome ?? 0, commitments.expectedIncome);

    // Calculate fixed vs variable
    const fixedCategoryIds = cats.filter(c => c.isFixed).map(c => c.id);
    
    const realizedFixed = monthTransactions
      .filter(t => t.type === 'despesa' && fixedCategoryIds.includes(t.categoryId))
      .reduce((sum, t) => sum + t.amount, 0);

    const realizedVariable = realizedExpenses - realizedFixed;

    // Orçamento manual e compromissos automáticos formam um único plano do ciclo.
    const manualPlannedFixed = budg?.categoryBudgets
      .filter(cb => fixedCategoryIds.includes(cb.categoryId))
      .reduce((sum, cb) => sum + cb.plannedAmount, 0) ?? 0;

    const expectedFixed = fixedCategoryIds.reduce((sum, categoryId) => {
      const categoryAmount = commitments.expectedByCategory[categoryId] ?? 0;
      const subcategoryAmount = subs
        .filter(sub => sub.categoryId === categoryId)
        .reduce((subtotal, sub) => subtotal + (commitments.expectedBySubcategory[sub.id] ?? 0), 0);
      return sum + categoryAmount + subcategoryAmount;
    }, 0);
    const committedFixed = fixedCategoryIds.reduce((sum, categoryId) => {
      const categoryAmount = commitments.committedByCategory[categoryId] ?? 0;
      const subcategoryAmount = subs
        .filter(sub => sub.categoryId === categoryId)
        .reduce((subtotal, sub) => subtotal + (commitments.committedBySubcategory[sub.id] ?? 0), 0);
      return sum + categoryAmount + subcategoryAmount;
    }, 0);
    const plannedFixed = manualPlannedFixed + expectedFixed;

    // Category breakdown — use centralized matching so the dashboard numbers
    // are always equal to what the drill-down drawer shows for the same
    // (categoryId, subcategoryId) pair.
    const categoryBreakdown = cats.map(cat => {
      const manualPlanned = budg?.categoryBudgets
        .filter(cb => cb.categoryId === cat.id)
        .reduce((sum, cb) => sum + cb.plannedAmount, 0) ?? 0;
      const expectedAtCategory = commitments.expectedByCategory[cat.id] ?? 0;
      const expectedAtSubcategories = subs
        .filter(sub => sub.categoryId === cat.id)
        .reduce((sum, sub) => sum + (commitments.expectedBySubcategory[sub.id] ?? 0), 0);
      const planned = manualPlanned + expectedAtCategory + expectedAtSubcategories;
      const realized = computeRealized(
        monthTransactions,
        { categoryId: cat.id, type: 'despesa' },
        cats,
        subs,
      );

      const committedAtCategory = commitments.committedByCategory[cat.id] ?? 0;
      const committedAtSubcategories = subs
        .filter(sub => sub.categoryId === cat.id)
        .reduce((sum, sub) => sum + (commitments.committedBySubcategory[sub.id] ?? 0), 0);
      const committed = committedAtCategory + committedAtSubcategories;
      const projected = realized + committed;
      const available = planned - projected;
      const percentage = planned > 0 ? (projected / planned) * 100 : (projected > 0 ? 100 : 0);
      let status: 'ok' | 'warning' | 'exceeded' = 'ok';
      if (percentage > 100) status = 'exceeded';
      else if (percentage >= 80) status = 'warning';

      return {
        categoryId: cat.id,
        categoryName: cat.name,
        isFixed: cat.isFixed,
        planned,
        realized,
        committed,
        projected,
        available,
        status,
        percentage,
      };
    });

    const categoryPlannedExpenses = categoryBreakdown
      .filter(category => cats.find(cat => cat.id === category.categoryId)?.type === 'despesa')
      .reduce((sum, category) => sum + category.planned, 0);
    const plannedExpenses = Math.max(budg?.plannedExpenses ?? 0, categoryPlannedExpenses);
    const committedExpenses = commitments.committedExpenses;
    const projectedExpenses = realizedExpenses + committedExpenses;
    const availableBudget = plannedExpenses - projectedExpenses;
    const budgetUsagePercentage = plannedExpenses > 0
      ? (projectedExpenses / plannedExpenses) * 100
      : (projectedExpenses > 0 ? 100 : 0);
    const plannedVariable = Math.max(0, plannedExpenses - plannedFixed);

    return {
      month,
      year,
      plannedIncome,
      plannedExpenses,
      realizedIncome,
      realizedExpenses,
      plannedFixed,
      realizedFixed,
      plannedVariable,
      realizedVariable,
      committedExpenses,
      projectedExpenses,
      availableBudget,
      budgetUsagePercentage,
      balance: realizedIncome - realizedExpenses,
      remainingFixed: Math.max(0, plannedFixed - realizedFixed - committedFixed),
      remainingVariable: Math.max(0, plannedVariable - realizedVariable - (committedExpenses - committedFixed)),
      categoryBreakdown,
      cashIncome: cashTrans.filter(t => t.type === 'receita').reduce((sum, t) => sum + t.amount, 0),
      cashExpenses: cashTrans.filter(t => t.type === 'despesa').reduce((sum, t) => sum + t.amount, 0),
      cashBalance: cashTrans.reduce((sum, t) => sum + (t.type === 'receita' ? t.amount : -t.amount), 0),
      creditCardExpenses: monthTransactions.filter(t => t.type === 'despesa' && t.paymentMethod === 'credit_card').reduce((sum, t) => sum + t.amount, 0),
    };
  }, []);

  const refreshData = useCallback(async () => {
    if (!user) return;

    setIsLoading(true);
    const errors: string[] = [];
    const fail = (label: string, error: unknown) => {
      console.error(`[AppContext] Falha ao carregar ${label}:`, error);
      const message = error instanceof Error ? error.message : String(error);
      errors.push(`${label}: ${message}`);
    };

    try {
      // O ciclo financeiro é opcional: uma falha aqui não pode impedir o
      // carregamento de categorias, recorrências e lançamentos.
      let cycle: FinancialCycle | null = null;
      try {
        cycle = await db.getFinancialCycle(selectedMonth, selectedYear);
      } catch (cycleError) {
        fail('ciclo financeiro', cycleError);
      }
      setFinancialCycle(cycle);

      const resolvedRange = cycle
        ? { start: cycle.startDate, end: new Date(cycle.endDate.getFullYear(), cycle.endDate.getMonth(), cycle.endDate.getDate(), 23, 59, 59, 999) }
        : billingDateRange;

      // Cada consulta é independente: uma falha isolada não zera o restante.
      const [catsR, subsR, transR, cashR, budgR, recsR, instancesR] = await Promise.allSettled([
        db.getCategories(),
        db.getSubcategories(),
        db.getTransactions(selectedMonth, selectedYear, resolvedRange ?? undefined),
        db.getCashTransactions(resolvedRange ?? undefined),
        db.getBudget(selectedMonth, selectedYear),
        db.getRecurrences(),
        db.getRecurrenceInstances(selectedMonth, selectedYear),
      ]);

      const cats = catsR.status === 'fulfilled' ? catsR.value : (fail('categorias', catsR.reason), categoriesRef.current);
      const subs = subsR.status === 'fulfilled' ? subsR.value : (fail('subcategorias', subsR.reason), subcategoriesRef.current);
      const trans = transR.status === 'fulfilled' ? transR.value : (fail('lançamentos', transR.reason), []);
      const cashTrans = cashR.status === 'fulfilled' ? cashR.value : (fail('caixa', cashR.reason), []);
      const budg = budgR.status === 'fulfilled' ? (budgR.value ?? null) : (fail('orçamento', budgR.reason), null);
      const recs = recsR.status === 'fulfilled' ? recsR.value : (fail('recorrências', recsR.reason), recurrencesRef.current);
      const instances = instancesR.status === 'fulfilled' ? instancesR.value : (fail('recorrências do mês', instancesR.reason), []);

      setCategories(cats);
      setSubcategories(subs);
      setTransactions(trans);
      setCashTransactions(cashTrans);
      setBudget(budg);
      setRecurrences(recs);
      setRecurrenceInstances(instances);

      try {
        const summary = calculateMonthSummary(
          cats, subs, trans, budg, recs, instances,
          cashTrans,
          selectedMonth, selectedYear,
          resolvedRange ?? undefined
        );
        setMonthSummary(summary);
      } catch (summaryError) {
        fail('resumo do mês', summaryError);
      }

      setLoadError(errors.length > 0 ? errors.join(' | ') : null);
    } catch (error) {
      console.error('Error refreshing data:', error);
      setLoadError(error instanceof Error ? error.message : String(error));
    } finally {
      setIsLoading(false);
    }
  }, [userId, selectedMonth, selectedYear, billingDateRange, calculateMonthSummary, categories, subcategories, recurrences]);

  // Initialize app when user is authenticated
  useEffect(() => {
    const init = async () => {
      if (!user) return;

      try {
        await db.initializeDefaultCategories();
        await db.setAppInitialized();
      } catch (error) {
        console.error('Error initializing app:', error);
        setLoadError(error instanceof Error ? error.message : String(error));
      } finally {
        // O app deve sempre sair do estado "Carregando...", mesmo com erro.
        setIsInitialized(true);
      }
      await refreshData();
    };
    init();
  }, [userId]);

  // Refresh when month changes
  useEffect(() => {
    if (isInitialized && user) {
      refreshData();
    }
  }, [selectedMonth, selectedYear, isInitialized, userId, refreshData]);

  // Transaction actions
  const addTransaction = useCallback(async (transaction: Omit<Transaction, 'id' | 'createdAt'>) => {
    const newTrans = await db.addTransaction(transaction);
    setLastUsedCategoryId(transaction.categoryId);
    await refreshData();
    return newTrans;
  }, [refreshData]);

  const updateTransaction = useCallback(async (transaction: Transaction) => {
    await db.updateTransaction(transaction);
    await refreshData();
  }, [refreshData]);

  const deleteTransaction = useCallback(async (id: string) => {
    await db.deleteTransaction(id);
    await refreshData();
  }, [refreshData]);

  // Category actions
  const addCategory = useCallback(async (category: Omit<Category, 'id' | 'createdAt'>) => {
    const newCat = await db.addCategory(category);
    await refreshData();
    return newCat;
  }, [refreshData]);

  const updateCategory = useCallback(async (category: Category) => {
    await db.updateCategory(category);
    await refreshData();
  }, [refreshData]);

  const deleteCategory = useCallback(async (id: string) => {
    await db.deleteCategory(id);
    await refreshData();
  }, [refreshData]);

  // Subcategory actions
  const addSubcategory = useCallback(async (subcategory: Omit<Subcategory, 'id' | 'createdAt'>) => {
    const newSub = await db.addSubcategory(subcategory);
    await refreshData();
    return newSub;
  }, [refreshData]);

  const updateSubcategory = useCallback(async (subcategory: Subcategory) => {
    await db.updateSubcategory(subcategory);
    await refreshData();
  }, [refreshData]);

  const deleteSubcategory = useCallback(async (id: string) => {
    await db.deleteSubcategory(id);
    await refreshData();
  }, [refreshData]);

  // Budget actions
  const saveBudget = useCallback(async (budget: Omit<Budget, 'id' | 'createdAt'>) => {
    const saved = await db.saveBudget(budget);
    await refreshData();
    return saved;
  }, [refreshData]);

  // Recurrence actions
  const addRecurrence = useCallback(async (recurrence: Omit<Recurrence, 'id' | 'createdAt'>) => {
    const newRec = await db.addRecurrence(recurrence);
    await refreshData();
    return newRec;
  }, [refreshData]);

  const updateRecurrence = useCallback(async (recurrence: Recurrence) => {
    await db.updateRecurrence(recurrence);
    await refreshData();
  }, [refreshData]);

  const deleteRecurrence = useCallback(async (id: string) => {
    await db.deleteRecurrence(id);
    await refreshData();
  }, [refreshData]);

  const bulkUpdateTransactions = useCallback(async (ids: string[], updates: { categoryId?: string; subcategoryId?: string | null; description?: string; type?: 'receita' | 'despesa' }) => {
    await db.bulkUpdateTransactions(ids, updates);
    await refreshData();
  }, [refreshData]);

  const bulkDeleteTransactions = useCallback(async (ids: string[]) => {
    await db.bulkDeleteTransactions(ids);
    await refreshData();
  }, [refreshData]);

  const bulkUpdateRecurrences = useCallback(async (ids: string[], updates: { isActive?: boolean; categoryId?: string; subcategoryId?: string | null }) => {
    await db.bulkUpdateRecurrences(ids, updates);
    await refreshData();
  }, [refreshData]);

  const bulkDeleteRecurrences = useCallback(async (ids: string[]) => {
    await db.bulkDeleteRecurrences(ids);
    await refreshData();
  }, [refreshData]);

  const linkTransactionsToRecurrence = useCallback(async (transactionIds: string[], recurrenceId: string) => {
    const rec = recurrences.find(r => r.id === recurrenceId);
    if (!rec) throw new Error('Recorrência não encontrada');
    await db.linkTransactionsToRecurrence(transactionIds, recurrenceId, selectedMonth, selectedYear, rec.amount);
    await refreshData();
  }, [refreshData, recurrences, selectedMonth, selectedYear]);

  const saveFinancialCycle = useCallback(async (cycle: Omit<FinancialCycle, 'id' | 'createdAt' | 'updatedAt'>) => {
    const saved = await db.saveFinancialCycle(cycle);
    setFinancialCycle(saved);
    await refreshData();
    return saved;
  }, [refreshData]);

  return (
    <AppContext.Provider value={{
      currentScreen,
      setCurrentScreen,
      selectedMonth,
      selectedYear,
      setSelectedMonth,
      categories,
      subcategories,
      transactions,
      cashTransactions,
      financialCycle,
      budget,
      recurrences,
      recurrenceInstances,
      monthSummary,
      isLoading,
      isInitialized,
      refreshData,
      addTransaction,
      updateTransaction,
      deleteTransaction,
      addCategory,
      updateCategory,
      deleteCategory,
      addSubcategory,
      updateSubcategory,
      deleteSubcategory,
      saveBudget,
      addRecurrence,
      updateRecurrence,
      deleteRecurrence,
      bulkUpdateTransactions,
      bulkDeleteTransactions,
      bulkUpdateRecurrences,
      bulkDeleteRecurrences,
      linkTransactionsToRecurrence,
      saveFinancialCycle,
      billingCloseDay,
      setBillingCloseDay,
      billingDateRange,
      lastUsedCategoryId,
      setLastUsedCategoryId,
    }}>
      {children}
    </AppContext.Provider>
  );
}

export function useApp() {
  const context = useContext(AppContext);
  if (!context) {
    throw new Error('useApp must be used within AppProvider');
  }
  return context;
}
