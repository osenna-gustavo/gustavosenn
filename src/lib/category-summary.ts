/**
 * Centralized category/subcategory matching used by the dashboard, the
 * drill-down drawer and the month summary so that the number shown in a
 * card is ALWAYS the sum of the transactions opened by the drawer.
 *
 * Normalization rules:
 *  - If a transaction has a subcategoryId that exists, the source-of-truth
 *    categoryId is taken from `subcategory.categoryId` (fixes data where a
 *    transaction was moved between parents but the subcategory pointer
 *    stayed the same).
 */
import type { Category, Subcategory, Transaction } from '@/types/finance';

export interface NormalizedRef {
  categoryId: string;
  subcategoryId?: string;
}

export function normalizeTransactionRef(
  t: Pick<Transaction, 'categoryId' | 'subcategoryId'>,
  subcategories: Subcategory[],
): NormalizedRef {
  if (t.subcategoryId) {
    const sub = subcategories.find(s => s.id === t.subcategoryId);
    if (sub) {
      return { categoryId: sub.categoryId, subcategoryId: t.subcategoryId };
    }
  }
  return { categoryId: t.categoryId, subcategoryId: t.subcategoryId };
}

/**
 * True if a transaction belongs to the given (categoryId, subcategoryId)
 * filter, after normalization.
 */
export function transactionMatchesCategory(
  t: Pick<Transaction, 'categoryId' | 'subcategoryId'>,
  filter: { categoryId?: string; subcategoryId?: string },
  categories: Category[],
  subcategories: Subcategory[],
): boolean {
  const norm = normalizeTransactionRef(t, subcategories);

  if (filter.subcategoryId) {
    if (norm.subcategoryId !== filter.subcategoryId) return false;
  }

  if (filter.categoryId) {
    return norm.categoryId === filter.categoryId;
  }

  return true;
}

/**
 * Sum realized amount for a (category, subcategory) pair using the same
 * normalization the drawer uses.
 */
export function computeRealized(
  transactions: Transaction[],
  filter: { categoryId?: string; subcategoryId?: string; type?: 'receita' | 'despesa' },
  categories: Category[],
  subcategories: Subcategory[],
): number {
  return transactions.reduce((sum, t) => {
    if (filter.type && t.type !== filter.type) return sum;
    if (!transactionMatchesCategory(t, filter, categories, subcategories)) return sum;
    return sum + t.amount;
  }, 0);
}
