import type { Category, Transaction } from '@/types/finance';

export interface DuplicateGroup {
  amount: number;
  type: Transaction['type'];
  transactions: {
    id: string;
    date: string;
    description?: string;
    categoryName?: string;
  }[];
}

/**
 * Agrupa lançamentos com o mesmo valor e tipo cujas datas estão a poucos dias
 * de distância — candidatos a duplicidade (ex.: mesma compra lançada duas vezes).
 * É determinístico (não depende do modelo de IA "adivinhar" duplicidade).
 */
export function findPotentialDuplicates(
  transactions: Transaction[],
  categories: Category[],
  maxDayGap = 3,
): DuplicateGroup[] {
  const categoryNameById = new Map(categories.map(c => [c.id, c.name]));
  const sorted = [...transactions].sort((a, b) => a.amount - b.amount || a.date.getTime() - b.date.getTime());

  const groups: DuplicateGroup[] = [];
  const used = new Set<string>();

  for (let i = 0; i < sorted.length; i++) {
    const a = sorted[i];
    if (used.has(a.id)) continue;
    const cluster = [a];

    for (let j = i + 1; j < sorted.length; j++) {
      const b = sorted[j];
      if (used.has(b.id) || b.id === a.id) continue;
      if (b.amount !== a.amount || b.type !== a.type) continue;
      const dayGap = Math.abs(b.date.getTime() - a.date.getTime()) / 86_400_000;
      if (dayGap > maxDayGap) continue;
      cluster.push(b);
    }

    if (cluster.length > 1) {
      cluster.forEach(t => used.add(t.id));
      groups.push({
        amount: a.amount,
        type: a.type,
        transactions: cluster.map(t => ({
          id: t.id,
          date: t.date.toISOString().slice(0, 10),
          description: t.description,
          categoryName: categoryNameById.get(t.categoryId),
        })),
      });
    }
  }

  return groups;
}
