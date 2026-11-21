import type { Recurrence, RecurrenceInstance, Transaction } from '@/types/finance';

export interface CycleCommitments {
  expectedByCategory: Record<string, number>;
  expectedBySubcategory: Record<string, number>;
  committedByCategory: Record<string, number>;
  committedBySubcategory: Record<string, number>;
  expectedExpenses: number;
  committedExpenses: number;
  expectedIncome: number;
  committedIncome: number;
  expectedRecurringExpenses: number;
  expectedInstallmentExpenses: number;
  committedRecurringExpenses: number;
  committedInstallmentExpenses: number;
}

function appliesToCycle(rec: Recurrence, month: number, year: number): boolean {
  if (!rec.isActive) return false;

  const startDate = new Date(rec.startDate);
  const endDate = rec.endDate ? new Date(rec.endDate) : null;
  const cycleStart = new Date(year, month, 1);
  const cycleEnd = new Date(year, month + 1, 0, 23, 59, 59, 999);

  if (startDate > cycleEnd) return false;
  if (endDate && endDate < cycleStart) return false;

  if (rec.totalInstallments) {
    const installmentNumber =
      (year - startDate.getFullYear()) * 12 + (month - startDate.getMonth()) + 1;
    if (installmentNumber < 1 || installmentNumber > rec.totalInstallments) return false;
  }

  return true;
}

function addAmount(target: Record<string, number>, key: string, amount: number) {
  target[key] = (target[key] ?? 0) + amount;
}

/**
 * Centraliza a regra do ciclo financeiro:
 * - esperado compõe o orçamento-base do ciclo;
 * - comprometido reserva orçamento enquanto a recorrência/parcela não virou lançamento;
 * - confirmado ou vinculado a um lançamento deixa de ser compromisso, evitando dupla contagem.
 */
export function computeCycleCommitments(
  recurrences: Recurrence[],
  instances: RecurrenceInstance[],
  transactions: Transaction[],
  month: number,
  year: number,
): CycleCommitments {
  const summary: CycleCommitments = {
    expectedByCategory: {},
    expectedBySubcategory: {},
    committedByCategory: {},
    committedBySubcategory: {},
    expectedExpenses: 0,
    committedExpenses: 0,
    expectedIncome: 0,
    committedIncome: 0,
    expectedRecurringExpenses: 0,
    expectedInstallmentExpenses: 0,
    committedRecurringExpenses: 0,
    committedInstallmentExpenses: 0,
  };

  for (const recurrence of recurrences) {
    if (!appliesToCycle(recurrence, month, year)) continue;

    const instance = instances.find(item => item.recurrenceId === recurrence.id);
    if (instance?.status === 'ignored') continue;

    const amount = instance?.amount ?? recurrence.amount;
    const hasLinkedTransaction = transactions.some(transaction =>
      transaction.recurrenceId === recurrence.id ||
      (instance && transaction.recurrenceInstanceId === instance.id),
    );
    const isStillCommitted = instance?.status !== 'confirmed' && !hasLinkedTransaction;

    if (recurrence.type === 'receita') {
      summary.expectedIncome += amount;
      if (isStillCommitted) summary.committedIncome += amount;
      continue;
    }

    summary.expectedExpenses += amount;
    if (recurrence.totalInstallments) summary.expectedInstallmentExpenses += amount;
    else summary.expectedRecurringExpenses += amount;
    if (recurrence.subcategoryId) {
      addAmount(summary.expectedBySubcategory, recurrence.subcategoryId, amount);
      if (isStillCommitted) {
        addAmount(summary.committedBySubcategory, recurrence.subcategoryId, amount);
      }
    } else {
      addAmount(summary.expectedByCategory, recurrence.categoryId, amount);
      if (isStillCommitted) {
        addAmount(summary.committedByCategory, recurrence.categoryId, amount);
      }
    }

    if (isStillCommitted) {
      summary.committedExpenses += amount;
      if (recurrence.totalInstallments) summary.committedInstallmentExpenses += amount;
      else summary.committedRecurringExpenses += amount;
    }
  }

  return summary;
}
