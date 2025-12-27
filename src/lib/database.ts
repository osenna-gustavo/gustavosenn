import { openDB, DBSchema, IDBPDatabase } from 'idb';
import { v4 as uuidv4 } from 'uuid';
import type { 
  Category, 
  Subcategory, 
  Transaction, 
  Budget, 
  Recurrence, 
  RecurrenceInstance,
  ImportBatch,
  Scenario 
} from '@/types/finance';

interface FluxoCaixaDB extends DBSchema {
  categories: {
    key: string;
    value: Category;
    indexes: { 'by-parent': string };
  };
  subcategories: {
    key: string;
    value: Subcategory;
    indexes: { 'by-category': string };
  };
  transactions: {
    key: string;
    value: Transaction;
    indexes: { 
      'by-date': Date;
      'by-category': string;
      'by-month': string;
    };
  };
  budgets: {
    key: string;
    value: Budget;
    indexes: { 'by-month-year': string };
  };
  recurrences: {
    key: string;
    value: Recurrence;
  };
  recurrenceInstances: {
    key: string;
    value: RecurrenceInstance;
    indexes: { 'by-recurrence': string; 'by-month-year': string };
  };
  importBatches: {
    key: string;
    value: ImportBatch;
  };
  scenarios: {
    key: string;
    value: Scenario;
  };
  settings: {
    key: string;
    value: { key: string; value: unknown };
  };
}

let dbInstance: IDBPDatabase<FluxoCaixaDB> | null = null;

const DB_VERSION = 2;

export async function getDB(): Promise<IDBPDatabase<FluxoCaixaDB>> {
  if (dbInstance) return dbInstance;

  dbInstance = await openDB<FluxoCaixaDB>('fluxocaixa-db', DB_VERSION, {
    upgrade(db, oldVersion) {
      // Categories store
      if (!db.objectStoreNames.contains('categories')) {
        const categoryStore = db.createObjectStore('categories', { keyPath: 'id' });
        categoryStore.createIndex('by-parent', 'parentId');
      }

      // Subcategories store
      if (!db.objectStoreNames.contains('subcategories')) {
        const subcategoryStore = db.createObjectStore('subcategories', { keyPath: 'id' });
        subcategoryStore.createIndex('by-category', 'categoryId');
      }

      // Transactions store
      if (!db.objectStoreNames.contains('transactions')) {
        const transactionStore = db.createObjectStore('transactions', { keyPath: 'id' });
        transactionStore.createIndex('by-date', 'date');
        transactionStore.createIndex('by-category', 'categoryId');
        transactionStore.createIndex('by-month', 'monthKey');
      }

      // Budgets store
      if (!db.objectStoreNames.contains('budgets')) {
        const budgetStore = db.createObjectStore('budgets', { keyPath: 'id' });
        budgetStore.createIndex('by-month-year', 'monthYearKey');
      }

      // Recurrences store
      if (!db.objectStoreNames.contains('recurrences')) {
        db.createObjectStore('recurrences', { keyPath: 'id' });
      }

      // RecurrenceInstances store (NEW in version 2)
      if (!db.objectStoreNames.contains('recurrenceInstances')) {
        const instanceStore = db.createObjectStore('recurrenceInstances', { keyPath: 'id' });
        instanceStore.createIndex('by-recurrence', 'recurrenceId');
        instanceStore.createIndex('by-month-year', 'monthYearKey');
      }

      // Import batches store
      if (!db.objectStoreNames.contains('importBatches')) {
        db.createObjectStore('importBatches', { keyPath: 'id' });
      }

      // Scenarios store
      if (!db.objectStoreNames.contains('scenarios')) {
        db.createObjectStore('scenarios', { keyPath: 'id' });
      }

      // Settings store
      if (!db.objectStoreNames.contains('settings')) {
        db.createObjectStore('settings', { keyPath: 'key' });
      }
    },
  });

  return dbInstance;
}

// Default categories
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

export async function initializeDefaultCategories(): Promise<void> {
  const db = await getDB();
  const existingCategories = await db.getAll('categories');
  
  if (existingCategories.length === 0) {
    const tx = db.transaction('categories', 'readwrite');
    for (const cat of DEFAULT_CATEGORIES) {
      await tx.store.add({
        ...cat,
        id: uuidv4(),
        createdAt: new Date(),
      });
    }
    await tx.done;
  }
}

// Category operations
export async function getCategories(): Promise<Category[]> {
  const db = await getDB();
  return db.getAll('categories');
}

export async function addCategory(category: Omit<Category, 'id' | 'createdAt'>): Promise<Category> {
  const db = await getDB();
  const newCategory: Category = {
    ...category,
    id: uuidv4(),
    createdAt: new Date(),
  };
  await db.add('categories', newCategory);
  return newCategory;
}

export async function updateCategory(category: Category): Promise<void> {
  const db = await getDB();
  await db.put('categories', category);
}

export async function deleteCategory(id: string): Promise<void> {
  const db = await getDB();
  await db.delete('categories', id);
}

// Subcategory operations
export async function getSubcategories(categoryId?: string): Promise<Subcategory[]> {
  const db = await getDB();
  if (categoryId) {
    return db.getAllFromIndex('subcategories', 'by-category', categoryId);
  }
  return db.getAll('subcategories');
}

export async function addSubcategory(subcategory: Omit<Subcategory, 'id' | 'createdAt'>): Promise<Subcategory> {
  const db = await getDB();
  const newSubcategory: Subcategory = {
    ...subcategory,
    id: uuidv4(),
    createdAt: new Date(),
  };
  await db.add('subcategories', newSubcategory);
  return newSubcategory;
}

export async function updateSubcategory(subcategory: Subcategory): Promise<void> {
  const db = await getDB();
  await db.put('subcategories', subcategory);
}

export async function deleteSubcategory(id: string): Promise<void> {
  const db = await getDB();
  await db.delete('subcategories', id);
}

// Transaction operations
export async function getTransactions(month?: number, year?: number): Promise<Transaction[]> {
  const db = await getDB();
  const allTransactions = await db.getAll('transactions');
  
  if (month !== undefined && year !== undefined) {
    return allTransactions.filter(t => {
      const date = new Date(t.date);
      return date.getMonth() === month && date.getFullYear() === year;
    });
  }
  
  return allTransactions;
}

export async function getAllTransactions(): Promise<Transaction[]> {
  const db = await getDB();
  return db.getAll('transactions');
}

export async function addTransaction(transaction: Omit<Transaction, 'id' | 'createdAt'>): Promise<Transaction> {
  const db = await getDB();
  const newTransaction: Transaction = {
    ...transaction,
    id: uuidv4(),
    createdAt: new Date(),
  };
  await db.add('transactions', newTransaction);
  return newTransaction;
}

export async function updateTransaction(transaction: Transaction): Promise<void> {
  const db = await getDB();
  await db.put('transactions', transaction);
}

export async function deleteTransaction(id: string): Promise<void> {
  const db = await getDB();
  await db.delete('transactions', id);
}

// Budget operations
export async function getBudget(month: number, year: number): Promise<Budget | undefined> {
  const db = await getDB();
  const allBudgets = await db.getAll('budgets');
  return allBudgets.find(b => b.month === month && b.year === year);
}

export async function getAllBudgets(): Promise<Budget[]> {
  const db = await getDB();
  return db.getAll('budgets');
}

export async function saveBudget(budget: Omit<Budget, 'id' | 'createdAt'> & { id?: string }): Promise<Budget> {
  const db = await getDB();
  const existing = await getBudget(budget.month, budget.year);
  
  if (existing) {
    const updated = { ...existing, ...budget };
    await db.put('budgets', updated);
    return updated;
  }
  
  const newBudget: Budget = {
    ...budget,
    id: budget.id || uuidv4(),
    createdAt: new Date(),
  };
  await db.add('budgets', newBudget);
  return newBudget;
}

// Recurrence operations
export async function getRecurrences(): Promise<Recurrence[]> {
  const db = await getDB();
  return db.getAll('recurrences');
}

export async function addRecurrence(recurrence: Omit<Recurrence, 'id' | 'createdAt'>): Promise<Recurrence> {
  const db = await getDB();
  const newRecurrence: Recurrence = {
    ...recurrence,
    id: uuidv4(),
    createdAt: new Date(),
  };
  await db.add('recurrences', newRecurrence);
  return newRecurrence;
}

export async function updateRecurrence(recurrence: Recurrence): Promise<void> {
  const db = await getDB();
  await db.put('recurrences', recurrence);
}

export async function deleteRecurrence(id: string): Promise<void> {
  const db = await getDB();
  await db.delete('recurrences', id);
}

// Recurrence Instance operations
export async function getRecurrenceInstances(month: number, year: number): Promise<RecurrenceInstance[]> {
  const db = await getDB();
  const all = await db.getAll('recurrenceInstances');
  return all.filter(i => i.month === month && i.year === year);
}

export async function getRecurrenceInstancesByRecurrence(recurrenceId: string): Promise<RecurrenceInstance[]> {
  const db = await getDB();
  return db.getAllFromIndex('recurrenceInstances', 'by-recurrence', recurrenceId);
}

export async function addRecurrenceInstance(instance: Omit<RecurrenceInstance, 'id' | 'createdAt'>): Promise<RecurrenceInstance> {
  const db = await getDB();
  const newInstance: RecurrenceInstance = {
    ...instance,
    id: uuidv4(),
    createdAt: new Date(),
  };
  await db.add('recurrenceInstances', newInstance);
  return newInstance;
}

export async function updateRecurrenceInstance(instance: RecurrenceInstance): Promise<void> {
  const db = await getDB();
  await db.put('recurrenceInstances', instance);
}

export async function deleteRecurrenceInstance(id: string): Promise<void> {
  const db = await getDB();
  await db.delete('recurrenceInstances', id);
}

// Scenario operations
export async function getScenarios(): Promise<Scenario[]> {
  const db = await getDB();
  return db.getAll('scenarios');
}

export async function getScenario(id: string): Promise<Scenario | undefined> {
  const db = await getDB();
  return db.get('scenarios', id);
}

export async function addScenario(scenario: Omit<Scenario, 'id' | 'createdAt'>): Promise<Scenario> {
  const db = await getDB();
  const newScenario: Scenario = {
    ...scenario,
    id: uuidv4(),
    createdAt: new Date(),
  };
  await db.add('scenarios', newScenario);
  return newScenario;
}

export async function updateScenario(scenario: Scenario): Promise<void> {
  const db = await getDB();
  await db.put('scenarios', scenario);
}

export async function deleteScenario(id: string): Promise<void> {
  const db = await getDB();
  await db.delete('scenarios', id);
}

// Import batch operations
export async function getImportBatches(): Promise<ImportBatch[]> {
  const db = await getDB();
  return db.getAll('importBatches');
}

export async function addImportBatch(batch: Omit<ImportBatch, 'id' | 'createdAt'>): Promise<ImportBatch> {
  const db = await getDB();
  const newBatch: ImportBatch = {
    ...batch,
    id: uuidv4(),
    createdAt: new Date(),
  };
  await db.add('importBatches', newBatch);
  return newBatch;
}

export async function updateImportBatch(batch: ImportBatch): Promise<void> {
  const db = await getDB();
  await db.put('importBatches', batch);
}

export async function deleteImportBatch(id: string): Promise<void> {
  const db = await getDB();
  await db.delete('importBatches', id);
}

// Settings operations
export async function getSetting<T>(key: string): Promise<T | undefined> {
  const db = await getDB();
  const setting = await db.get('settings', key);
  return setting?.value as T | undefined;
}

export async function setSetting<T>(key: string, value: T): Promise<void> {
  const db = await getDB();
  await db.put('settings', { key, value });
}

// Check if app has been initialized
export async function isAppInitialized(): Promise<boolean> {
  return (await getSetting<boolean>('initialized')) ?? false;
}

export async function setAppInitialized(): Promise<void> {
  await setSetting('initialized', true);
}
