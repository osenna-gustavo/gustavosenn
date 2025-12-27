import { useApp } from '@/contexts/AppContext';
import { formatCurrency, formatPercentage } from '@/lib/formatters';
import { 
  TrendingUp, 
  TrendingDown, 
  Wallet, 
  Target,
  AlertTriangle,
  CheckCircle2,
  ArrowUpRight,
  ArrowDownRight
} from 'lucide-react';
import { cn } from '@/lib/utils';
import type { DrillDownFilter } from './DrillDownDrawer';

interface DashboardKPIsProps {
  onDrillDown?: (filter: DrillDownFilter) => void;
}

export function DashboardKPIs({ onDrillDown }: DashboardKPIsProps) {
  const { monthSummary } = useApp();

  if (!monthSummary) {
    return (
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {[...Array(4)].map((_, i) => (
          <div key={i} className="stat-card animate-pulse">
            <div className="h-4 bg-muted rounded w-24 mb-2" />
            <div className="h-8 bg-muted rounded w-32" />
          </div>
        ))}
      </div>
    );
  }

  const kpis = [
    {
      label: 'Saldo do Mês',
      value: monthSummary.balance,
      icon: Wallet,
      trend: monthSummary.balance >= 0 ? 'positive' : 'negative',
      description: monthSummary.balance >= 0 ? 'Positivo' : 'Negativo',
      drillDownFilter: { type: 'all' as const, title: 'Todos os Lançamentos' },
    },
    {
      label: 'Planejado vs Realizado',
      value: monthSummary.realizedExpenses,
      target: monthSummary.plannedExpenses,
      icon: Target,
      trend: monthSummary.realizedExpenses <= monthSummary.plannedExpenses ? 'positive' : 'negative',
      percentage: monthSummary.plannedExpenses > 0 
        ? (monthSummary.realizedExpenses / monthSummary.plannedExpenses) * 100 
        : 0,
      drillDownFilter: { type: 'expenses' as const, title: 'Despesas do Mês' },
    },
    {
      label: 'Falta de Fixo',
      value: monthSummary.remainingFixed,
      icon: monthSummary.remainingFixed > 0 ? AlertTriangle : CheckCircle2,
      trend: monthSummary.remainingFixed > 0 ? 'warning' : 'positive',
      description: monthSummary.remainingFixed > 0 ? 'Ainda não coberto' : 'Fixos cobertos',
      drillDownFilter: { type: 'fixed' as const, title: 'Despesas Fixas' },
    },
    {
      label: 'Disponível (Variável)',
      value: monthSummary.remainingVariable,
      icon: monthSummary.remainingVariable > 0 ? TrendingUp : TrendingDown,
      trend: monthSummary.remainingVariable > 0 ? 'positive' : 'negative',
      description: monthSummary.remainingVariable > 0 ? 'Pode gastar' : 'Limite atingido',
      drillDownFilter: { type: 'variable' as const, title: 'Despesas Variáveis' },
    },
  ];

  const handleClick = (filter: DrillDownFilter) => {
    if (onDrillDown) {
      onDrillDown(filter);
    }
  };

  return (
    <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
      {kpis.map((kpi, index) => {
        const Icon = kpi.icon;
        return (
          <div 
            key={index} 
            className={cn(
              "stat-card cursor-pointer hover:scale-[1.02] transition-transform",
              kpi.trend === 'positive' && "border-l-4 border-l-success",
              kpi.trend === 'negative' && "border-l-4 border-l-destructive",
              kpi.trend === 'warning' && "border-l-4 border-l-warning"
            )}
            onClick={() => handleClick(kpi.drillDownFilter)}
          >
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
                {kpi.label}
              </span>
              <Icon className={cn(
                "h-4 w-4",
                kpi.trend === 'positive' && "text-success",
                kpi.trend === 'negative' && "text-destructive",
                kpi.trend === 'warning' && "text-warning"
              )} />
            </div>
            
            <div className="flex items-baseline gap-2">
              <span className={cn(
                "text-xl lg:text-2xl font-bold font-mono",
                kpi.trend === 'positive' && "text-success",
                kpi.trend === 'negative' && "text-destructive",
                kpi.trend === 'warning' && "text-warning"
              )}>
                {formatCurrency(kpi.value)}
              </span>
              
              {kpi.percentage !== undefined && (
                <span className={cn(
                  "text-xs font-medium flex items-center gap-0.5",
                  kpi.percentage <= 100 ? "text-success" : "text-destructive"
                )}>
                  {kpi.percentage <= 100 ? (
                    <ArrowDownRight className="h-3 w-3" />
                  ) : (
                    <ArrowUpRight className="h-3 w-3" />
                  )}
                  {formatPercentage(kpi.percentage)}
                </span>
              )}
            </div>

            {kpi.target !== undefined && (
              <div className="mt-2">
                <div className="flex justify-between text-xs text-muted-foreground mb-1">
                  <span>de {formatCurrency(kpi.target)}</span>
                </div>
                <div className="h-1.5 bg-muted rounded-full overflow-hidden">
                  <div 
                    className={cn(
                      "h-full rounded-full transition-all duration-500",
                      kpi.percentage! <= 80 && "bg-success",
                      kpi.percentage! > 80 && kpi.percentage! <= 100 && "bg-warning",
                      kpi.percentage! > 100 && "bg-destructive"
                    )}
                    style={{ width: `${Math.min(kpi.percentage!, 100)}%` }}
                  />
                </div>
              </div>
            )}

            {kpi.description && !kpi.target && (
              <p className="text-xs text-muted-foreground mt-1">{kpi.description}</p>
            )}
          </div>
        );
      })}
    </div>
  );
}
