/**
 * Fonte única do "Planejado" por categoria/subcategoria.
 *
 * Regra (a mesma usada na tela de Orçamento):
 *   planejado = valor manual salvo em budget_items.planned_amount
 *             + soma esperada de recorrências/parcelamentos ativos do ciclo
 *
 * Toda tela que exibe "Planejado" deve usar estas funções para nunca divergir.
 */
import type { Budget, Recurrence, RecurrenceInstance, Subcategory, Transaction } from '@/types/finance';
import { computeCycleCommitments, type CycleCommitments } from '@/lib/cycle-commitments';

export interface PlannedBudgetMaps {
  /** Planejado total da categoria (manual + auto, incluindo suas subcategorias). */
  byCategory: Record<string, number>;
  /** Planejado da subcategoria (manual + auto). */
  bySubcategory: Record<string, number>;
  /** Valores automáticos (recorrências/parcelas) por categoria, sem subcategoria. */
  autoByCategory: Record<string, number>;
  /** Valores automáticos (recorrências/parcelas) por subcategoria. */
  autoBySubcategory: Record<string, number>;
  commitments: CycleCommitments;
}

export function buildPlannedBudgetMaps(
  budget: Budget | null | undefined,
  subcategories: Subcategory[],
  recurrences: Recurrence[],
  recurrenceInstances: RecurrenceInstance[],
  transactions: Transaction[],
  month: number,
  year: number,
): PlannedBudgetMaps {
  const commitments = computeCycleCommitments(
    recurrences,
    recurrenceInstances,
    transactions,
    month,
    year,
  );

  const autoByCategory = commitments.expectedByCategory;
  const autoBySubcategory = commitments.expectedBySubcategory;

  const manualByCategory: Record<string, number> = {};
  const manualBySubcategory: Record<string, number> = {};

  for (const cb of budget?.categoryBudgets ?? []) {
    if (cb.subcategoryId) {
      manualBySubcategory[cb.subcategoryId] =
        (manualBySubcategory[cb.subcategoryId] ?? 0) + cb.plannedAmount;
    } else {
      manualByCategory[cb.categoryId] =
        (manualByCategory[cb.categoryId] ?? 0) + cb.plannedAmount;
    }
  }

  const bySubcategory: Record<string, number> = {};
  for (const sub of subcategories) {
    const value = (manualBySubcategory[sub.id] ?? 0) + (autoBySubcategory[sub.id] ?? 0);
    if (value !== 0) bySubcategory[sub.id] = value;
  }

  const byCategory: Record<string, number> = {};
  const categoryIds = new Set<string>([
    ...Object.keys(manualByCategory),
    ...Object.keys(autoByCategory),
    ...subcategories.map(sub => sub.categoryId),
  ]);

  for (const categoryId of categoryIds) {
    const subTotal = subcategories
      .filter(sub => sub.categoryId === categoryId)
      .reduce((sum, sub) => sum + (bySubcategory[sub.id] ?? 0), 0);
    const value =
      (manualByCategory[categoryId] ?? 0) + (autoByCategory[categoryId] ?? 0) + subTotal;
    if (value !== 0) byCategory[categoryId] = value;
  }

  return { byCategory, bySubcategory, autoByCategory, autoBySubcategory, commitments };
}

export function getPlannedForCategory(maps: PlannedBudgetMaps, categoryId: string): number {
  return maps.byCategory[categoryId] ?? 0;
}

export function getPlannedForSubcategory(maps: PlannedBudgetMaps, subcategoryId: string): number {
  return maps.bySubcategory[subcategoryId] ?? 0;
}
