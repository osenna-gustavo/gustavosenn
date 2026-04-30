import React, { createContext, useContext, useState, useEffect, useCallback, useMemo } from 'react';
import type {
  Category,
  Subcategory,
  Transaction,
  Budget,
  Recurrence,
  RecurrenceInstance,
  MonthSummary,
  AppScreen
} from '@/types/finance';
import * as db from '@/lib/supabase-database';
import { getCurrentMonthYear, getBillingPeriod } from '@/lib/formatters';
import { useAuth } from '@/contexts/AuthContext';

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
  const [currentScreen, setCurrentScreen] = useState<AppScreen>('dashboard');
  const { month: currentMonth, year: currentYear } = getCurrentMonthYear();
  const [selectedMonth, setSelectedMonthState] = useState(currentMonth);
  const [selectedYear, setSelectedYearState] = useState(currentYear);
  
  const [categories, setCategories] = useState<Category[]>([]);
  const [subcategories, setSubcategories] = useState<Subcategory[]>([]);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
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

  const setBillingCloseDay = useCallback((day: number | null) => {
    setBillingCloseDayState(day);
    try {
      if (day === null) {
        localStorage.removeItem(BILLING_CLOSE_DAY_KEY);
      } else {
        localStorage.setItem(BILLING_CLOSE_DAY_KEY, String(day));
      }
    } catch { /* ignore */ }
  }, []);

  const billingDateRange = useMemo(() => {
    if (!billingCloseDay) return null;
    return getBillingPeriod(selectedMonth, selectedYear, billingCloseDay);
  }, [billingCloseDay, selectedMonth, selectedYear]);

  const setSelectedMonth = useCallback((month: number, year: number) => {
    setSelectedMonthState(month);
    setSelectedYearState(year);
  }, []);

  const calculateMonthSummary = useCallback((
    cats: Category[],
    trans: Transaction[],
    budg: Budget | null,
    recs: Recurrence[],
    instances: RecurrenceInstance[],
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

    const plannedIncome = budg?.plannedIncome ?? 0;
    const plannedExpenses = budg?.plannedExpenses ?? 0;

    // Calculate fixed vs variable
    const fixedCategoryIds = cats.filter(c => c.isFixed).map(c => c.id);
    
    const realizedFixed = monthTransactions
      .filter(t => t.type === 'despesa' && fixedCategoryIds.includes(t.categoryId))
      .reduce((sum, t) => sum + t.amount, 0);

    const realizedVariable = realizedExpenses - realizedFixed;

    // Calculate planned fixed from budget + recurrences
    let plannedFixed = budg?.categoryBudgets
      .filter(cb => fixedCategoryIds.includes(cb.categoryId))
      .reduce((sum, cb) => sum + cb.plannedAmount, 0) ?? 0;

    // Add pending recurrences to planned fixed
    const pendingRecurrences = instances.filter(i => i.status === 'pending');
    for (const instance of pendingRecurrences) {
      const rec = recs.find(r => r.id === instance.recurrenceId);
      if (rec && rec.type === 'despesa') {
        const cat = cats.find(c => c.id === rec.categoryId);
        if (cat?.isFixed) {
          plannedFixed += instance.amount;
        }
      }
    }

    const plannedVariable = plannedExpenses - plannedFixed;

    // Category breakdown
    const categoryBreakdown = cats.map(cat => {
      const catBudget = budg?.categoryBudgets.find(cb => cb.categoryId === cat.id);
      const planned = catBudget?.plannedAmount ?? 0;
      const realized = monthTransactions
        .filter(t => t.type === 'despesa' && t.categoryId === cat.id)
        .reduce((sum, t) => sum + t.amount, 0);
      
      const percentage = planned > 0 ? (realized / planned) * 100 : (realized > 0 ? 100 : 0);
      let status: 'ok' | 'warning' | 'exceeded' = 'ok';
      if (percentage > 100) status = 'exceeded';
      else if (percentage >= 80) status = 'warning';

      return {
        categoryId: cat.id,
        categoryName: cat.name,
        isFixed: cat.isFixed,
        planned,
        realized,
        status,
        percentage,
      };
    });

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
      balance: realizedIncome - realizedExpenses,
      remainingFixed: Math.max(0, plannedFixed - realizedFixed),
      remainingVariable: Math.max(0, plannedVariable - realizedVariable),
      categoryBreakdown,
    };
  }, []);

  const refreshData = useCallback(async () => {
    if (!user) return;

    setIsLoading(true);
    try {
      const [cats, subs, trans, budg, recs, instances] = await Promise.all([
        db.getCategories(),
        db.getSubcategories(),
        db.getTransactions(selectedMonth, selectedYear, billingDateRange ?? undefined),
        db.getBudget(selectedMonth, selectedYear),
        db.getRecurrences(),
        db.getRecurrenceInstances(selectedMonth, selectedYear),
      ]);

      setCategories(cats);
      setSubcategories(subs);
      setTransactions(trans);
      setBudget(budg ?? null);
      setRecurrences(recs);
      setRecurrenceInstances(instances);

      const summary = calculateMonthSummary(
        cats, trans, budg ?? null, recs, instances,
        selectedMonth, selectedYear,
        billingDateRange ?? undefined
      );
      setMonthSummary(summary);
    } catch (error) {
      console.error('Error refreshing data:', error);
    } finally {
      setIsLoading(false);
    }
  }, [user, selectedMonth, selectedYear, billingDateRange, calculateMonthSummary]);

  // Initialize app when user is authenticated
  useEffect(() => {
    const init = async () => {
      if (!user) return;
      
      try {
        await db.initializeDefaultCategories();
        await db.setAppInitialized();
        setIsInitialized(true);
        await refreshData();
      } catch (error) {
        console.error('Error initializing app:', error);
      }
    };
    init();
  }, [user]);

  // Refresh when month changes
  useEffect(() => {
    if (isInitialized && user) {
      refreshData();
    }
  }, [selectedMonth, selectedYear, isInitialized, user, refreshData]);

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
