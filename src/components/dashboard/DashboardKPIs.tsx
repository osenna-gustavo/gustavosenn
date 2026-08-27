import { useApp } from '@/contexts/AppContext';
import { formatCurrency, formatPercentage } from '@/lib/formatters';
import { Banknote, CircleDollarSign, Clock3, ReceiptText, Target } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { DrillDownFilter } from './DrillDownDrawer';

interface DashboardKPIsProps {
  onDrillDown?: (filter: DrillDownFilter) => void;
  mode?: 'competence' | 'cash';
}

type KpiTrend = 'positive' | 'negative' | 'warning' | 'neutral';

export function DashboardKPIs({ onDrillDown, mode = 'competence' }: DashboardKPIsProps) {
  const { monthSummary } = useApp();

  if (!monthSummary) {
    return (
      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-5 gap-4">
        {[...Array(5)].map((_, index) => (
          <div key={index} className="stat-card animate-pulse">
            <div className="h-4 bg-muted rounded w-24 mb-2" />
            <div className="h-8 bg-muted rounded w-32" />
          </div>
        ))}
      </div>
    );
  }

  const kpis: Array<{
    label: string;
    value: number;
    icon: typeof Banknote;
    trend: KpiTrend;
    description: string;
    percentage?: number;
    drillDownFilter?: DrillDownFilter;
  }> = mode === 'cash' ? [
    { label: 'Entradas no caixa', value: monthSummary.cashIncome, icon: Banknote, trend: 'positive', description: 'movimentações efetivamente recebidas' },
    { label: 'Saídas no caixa', value: monthSummary.cashExpenses, icon: ReceiptText, trend: 'negative', description: 'inclui pagamentos de fatura' },
    { label: 'Saldo do caixa', value: monthSummary.cashBalance, icon: CircleDollarSign, trend: monthSummary.cashBalance >= 0 ? 'positive' : 'negative', description: 'entradas menos saídas' },
    { label: 'Compras no cartão', value: monthSummary.creditCardExpenses, icon: Clock3, trend: 'warning', description: 'já comprometem o orçamento' },
    { label: 'Modo atual', value: monthSummary.cashExpenses, icon: Target, trend: 'neutral', description: 'troque para Competência para ver o orçamento' },
  ] : [
    {
      label: 'Receitas no ciclo',
      value: monthSummary.realizedIncome,
      icon: Banknote,
      trend: 'positive',
      description: monthSummary.plannedIncome > 0
        ? `de ${formatCurrency(monthSummary.plannedIncome)} previstas`
        : 'entradas já lançadas',
      drillDownFilter: { type: 'income', title: 'Receitas do ciclo' },
    },
    {
      label: 'Orçamento do ciclo',
      value: monthSummary.plannedExpenses,
      icon: Target,
      trend: 'neutral',
      description: 'inclui recorrências e parcelas',
    },
    {
      label: 'Já gasto',
      value: monthSummary.realizedExpenses,
      icon: ReceiptText,
      trend: monthSummary.budgetUsagePercentage > 100 ? 'negative' : 'neutral',
      description: 'compras e despesas lançadas',
      drillDownFilter: { type: 'expenses', title: 'Gastos do ciclo' },
    },
    {
      label: 'Ainda comprometido',
      value: monthSummary.committedExpenses,
      icon: Clock3,
      trend: monthSummary.committedExpenses > 0 ? 'warning' : 'positive',
      description: 'recorrências e parcelas pendentes',
    },
    {
      label: 'Disponível',
      value: monthSummary.availableBudget,
      icon: CircleDollarSign,
      trend: monthSummary.availableBudget < 0 ? 'negative' : 'positive',
      description: 'livre para gastar neste ciclo',
      percentage: monthSummary.budgetUsagePercentage,
      drillDownFilter: { type: 'planned-vs-realized', title: 'Uso do orçamento' },
    },
  ];

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-5 gap-4">
      {kpis.map(kpi => {
        const Icon = kpi.icon;
        const isClickable = Boolean(kpi.drillDownFilter && onDrillDown);

        return (
          <button
            key={kpi.label}
            type="button"
            disabled={!isClickable}
            onClick={() => kpi.drillDownFilter && onDrillDown?.(kpi.drillDownFilter)}
            className={cn(
              'stat-card text-left transition-transform disabled:cursor-default',
              isClickable && 'cursor-pointer hover:scale-[1.02]',
              kpi.trend === 'positive' && 'border-l-4 border-l-success',
              kpi.trend === 'negative' && 'border-l-4 border-l-destructive',
              kpi.trend === 'warning' && 'border-l-4 border-l-warning',
              kpi.trend === 'neutral' && 'border-l-4 border-l-primary/50',
            )}
          >
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
                {kpi.label}
              </span>
              <Icon className={cn(
                'h-4 w-4',
                kpi.trend === 'positive' && 'text-success',
                kpi.trend === 'negative' && 'text-destructive',
                kpi.trend === 'warning' && 'text-warning',
                kpi.trend === 'neutral' && 'text-primary',
              )} />
            </div>

            <div className="flex items-baseline gap-2">
              <span className={cn(
                'text-xl lg:text-2xl font-bold font-mono',
                kpi.trend === 'positive' && 'text-success',
                kpi.trend === 'negative' && 'text-destructive',
                kpi.trend === 'warning' && 'text-warning',
              )}>
                {formatCurrency(kpi.value)}
              </span>
              {kpi.percentage !== undefined && (
                <span className={cn(
                  'text-xs font-medium',
                  kpi.percentage > 100 ? 'text-destructive' : 'text-muted-foreground',
                )}>
                  {formatPercentage(kpi.percentage)} usado
                </span>
              )}
            </div>

            <p className="text-xs text-muted-foreground mt-1">{kpi.description}</p>
          </button>
        );
      })}
    </div>
  );
}
