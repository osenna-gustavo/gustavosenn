import { useMemo } from 'react';
import { formatCurrency } from '@/lib/formatters';
import { Badge } from '@/components/ui/badge';
import { RefreshCw, Check, X, TrendingDown, TrendingUp } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { Recurrence, RecurrenceInstance, Category, Subcategory } from '@/types/finance';

interface BudgetRecurrencesListProps {
  recurrences: Recurrence[];
  instances: RecurrenceInstance[];
  categories: Category[];
  subcategories: Subcategory[];
  selectedMonth: number;
  selectedYear: number;
}

export function BudgetRecurrencesList({
  recurrences,
  instances,
  categories,
  subcategories,
  selectedMonth,
  selectedYear,
}: BudgetRecurrencesListProps) {
  // Generate preview of recurrences for the month
  const monthRecurrences = useMemo(() => {
    const result: Array<{
      recurrence: Recurrence;
      instance?: RecurrenceInstance;
      category?: Category;
      subcategory?: Subcategory;
    }> = [];

    for (const rec of recurrences) {
      if (!rec.isActive) continue;
      
      const startDate = new Date(rec.startDate);
      const endDate = rec.endDate ? new Date(rec.endDate) : null;
      
      const monthStart = new Date(selectedYear, selectedMonth, 1);
      const monthEnd = new Date(selectedYear, selectedMonth + 1, 0);
      
      if (startDate > monthEnd) continue;
      if (endDate && endDate < monthStart) continue;
      
      const instance = instances.find(i => i.recurrenceId === rec.id);
      const category = categories.find(c => c.id === rec.categoryId);
      const subcategory = rec.subcategoryId 
        ? subcategories.find(s => s.id === rec.subcategoryId) 
        : undefined;
      
      result.push({ recurrence: rec, instance, category, subcategory });
    }

    return result;
  }, [recurrences, instances, categories, subcategories, selectedMonth, selectedYear]);

  const totals = useMemo(() => {
    let income = 0;
    let expenses = 0;
    let fixedExpenses = 0;

    for (const item of monthRecurrences) {
      const amount = item.instance?.amount ?? item.recurrence.amount;
      if (item.recurrence.type === 'receita') {
        income += amount;
      } else {
        expenses += amount;
        if (item.category?.isFixed) {
          fixedExpenses += amount;
        }
      }
    }

    return { income, expenses, fixedExpenses };
  }, [monthRecurrences]);

  if (monthRecurrences.length === 0) {
    return (
      <div className="text-center py-6 text-muted-foreground">
        Nenhuma recorrência programada para este mês.
      </div>
    );
  }

  const incomeRecurrences = monthRecurrences.filter(r => r.recurrence.type === 'receita');
  const expenseRecurrences = monthRecurrences.filter(r => r.recurrence.type === 'despesa');

  return (
    <div className="space-y-4">
      {/* Summary Cards */}
      <div className="grid grid-cols-3 gap-3">
        <div className="p-3 rounded-lg bg-success/10 border border-success/20">
          <div className="text-xs text-muted-foreground flex items-center gap-1">
            <TrendingUp className="h-3 w-3" />
            Receitas Previstas
          </div>
          <div className="text-lg font-mono font-semibold text-success">
            {formatCurrency(totals.income)}
          </div>
        </div>
        <div className="p-3 rounded-lg bg-destructive/10 border border-destructive/20">
          <div className="text-xs text-muted-foreground flex items-center gap-1">
            <TrendingDown className="h-3 w-3" />
            Despesas Previstas
          </div>
          <div className="text-lg font-mono font-semibold text-destructive">
            {formatCurrency(totals.expenses)}
          </div>
        </div>
        <div className="p-3 rounded-lg bg-warning/10 border border-warning/20">
          <div className="text-xs text-muted-foreground flex items-center gap-1">
            <RefreshCw className="h-3 w-3" />
            Fixos Previstos
          </div>
          <div className="text-lg font-mono font-semibold text-warning">
            {formatCurrency(totals.fixedExpenses)}
          </div>
        </div>
      </div>

      {/* Income Recurrences */}
      {incomeRecurrences.length > 0 && (
        <div className="space-y-2">
          <h4 className="text-sm font-medium text-muted-foreground">
            Receitas ({incomeRecurrences.length})
          </h4>
          {incomeRecurrences.map(({ recurrence, instance, category }) => (
            <RecurrenceItem
              key={recurrence.id}
              recurrence={recurrence}
              instance={instance}
              category={category}
            />
          ))}
        </div>
      )}

      {/* Expense Recurrences */}
      {expenseRecurrences.length > 0 && (
        <div className="space-y-2">
          <h4 className="text-sm font-medium text-muted-foreground">
            Despesas ({expenseRecurrences.length})
          </h4>
          {expenseRecurrences.map(({ recurrence, instance, category, subcategory }) => (
            <RecurrenceItem
              key={recurrence.id}
              recurrence={recurrence}
              instance={instance}
              category={category}
              subcategory={subcategory}
            />
          ))}
        </div>
      )}
    </div>
  );
}

function RecurrenceItem({
  recurrence,
  instance,
  category,
  subcategory,
}: {
  recurrence: Recurrence;
  instance?: RecurrenceInstance;
  category?: Category;
  subcategory?: Subcategory;
}) {
  const status = instance?.status || 'pending';
  const amount = instance?.amount ?? recurrence.amount;

  const statusConfig = {
    pending: { icon: RefreshCw, color: 'text-warning', bg: 'bg-warning/10', label: 'Pendente' },
    confirmed: { icon: Check, color: 'text-success', bg: 'bg-success/10', label: 'Confirmado' },
    ignored: { icon: X, color: 'text-muted-foreground', bg: 'bg-muted', label: 'Ignorado' },
  };

  const config = statusConfig[status];
  const Icon = config.icon;

  return (
    <div className={cn(
      "flex items-center justify-between p-3 rounded-lg border",
      status === 'ignored' ? 'opacity-50' : '',
      status === 'confirmed' ? 'border-success/30 bg-success/5' : 'border-border bg-card'
    )}>
      <div className="flex items-center gap-3">
        <div className={cn("h-8 w-8 rounded-lg flex items-center justify-center", config.bg)}>
          <Icon className={cn("h-4 w-4", config.color)} />
        </div>
        <div>
          <div className="font-medium text-sm">{recurrence.name}</div>
          <div className="text-xs text-muted-foreground flex items-center gap-2">
            <span>{category?.icon} {category?.name}</span>
            {subcategory && <span>• {subcategory.name}</span>}
          </div>
        </div>
      </div>
      
      <div className="flex items-center gap-2">
        {category?.isFixed && (
          <Badge variant="outline" className="text-xs border-primary/30 text-primary">
            FIXO
          </Badge>
        )}
        <Badge variant="outline" className={cn("text-xs", config.color)}>
          {config.label}
        </Badge>
        <span className={cn(
          "font-mono font-medium",
          recurrence.type === 'receita' ? 'text-success' : 'text-foreground'
        )}>
          {recurrence.type === 'receita' ? '+' : '-'}{formatCurrency(amount)}
        </span>
      </div>
    </div>
  );
}
