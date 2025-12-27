import { useApp } from '@/contexts/AppContext';
import { formatCurrency, formatPercentage, formatMonthYear } from '@/lib/formatters';
import { FileText, TrendingUp, TrendingDown, AlertTriangle, CheckCircle } from 'lucide-react';
import { cn } from '@/lib/utils';

export function ReportsPage() {
  const { monthSummary, selectedMonth, selectedYear, categories } = useApp();

  if (!monthSummary) {
    return <div className="p-8 text-center text-muted-foreground">Carregando...</div>;
  }

  const exceededCategories = monthSummary.categoryBreakdown.filter(c => c.status === 'exceeded');
  const warningCategories = monthSummary.categoryBreakdown.filter(c => c.status === 'warning');
  const topCategories = [...monthSummary.categoryBreakdown]
    .filter(c => c.realized > 0)
    .sort((a, b) => b.realized - a.realized)
    .slice(0, 5);

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl lg:text-3xl font-bold">Relatório</h1>
          <p className="text-muted-foreground">{formatMonthYear(selectedMonth, selectedYear)}</p>
        </div>
        <FileText className="h-8 w-8 text-primary" />
      </div>

      {/* Summary Card */}
      <div className="glass-card rounded-xl p-6 space-y-4">
        <h2 className="text-xl font-semibold">Resumo do Mês</h2>
        
        <div className="grid sm:grid-cols-2 gap-4">
          <div className="space-y-2">
            <div className="flex justify-between">
              <span className="text-muted-foreground">Receitas Realizadas</span>
              <span className="font-mono font-medium text-success">{formatCurrency(monthSummary.realizedIncome)}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Despesas Realizadas</span>
              <span className="font-mono font-medium text-destructive">{formatCurrency(monthSummary.realizedExpenses)}</span>
            </div>
            <div className="flex justify-between border-t pt-2">
              <span className="font-medium">Saldo Atual</span>
              <span className={cn("font-mono font-bold", monthSummary.balance >= 0 ? "text-success" : "text-destructive")}>
                {formatCurrency(monthSummary.balance)}
              </span>
            </div>
          </div>
          
          <div className="space-y-2">
            <div className="flex justify-between">
              <span className="text-muted-foreground">Orçamento de Despesas</span>
              <span className="font-mono">{formatCurrency(monthSummary.plannedExpenses)}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Restante (Variável)</span>
              <span className="font-mono text-primary">{formatCurrency(monthSummary.remainingVariable)}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Falta de Fixo</span>
              <span className="font-mono">{formatCurrency(monthSummary.remainingFixed)}</span>
            </div>
          </div>
        </div>
      </div>

      {/* Alerts */}
      {exceededCategories.length > 0 && (
        <div className="glass-card rounded-xl p-4 border-l-4 border-l-destructive">
          <div className="flex items-center gap-2 mb-3">
            <AlertTriangle className="h-5 w-5 text-destructive" />
            <h3 className="font-semibold">Categorias Estouradas</h3>
          </div>
          <div className="space-y-2">
            {exceededCategories.map(cat => (
              <div key={cat.categoryId} className="flex justify-between text-sm">
                <span>{cat.categoryName}</span>
                <span className="font-mono text-destructive">
                  +{formatCurrency(cat.realized - cat.planned)} ({formatPercentage(cat.percentage)})
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Top Categories */}
      <div className="glass-card rounded-xl p-6">
        <h3 className="font-semibold mb-4">Maiores Gastos</h3>
        <div className="space-y-3">
          {topCategories.map((cat, index) => {
            const category = categories.find(c => c.id === cat.categoryId);
            return (
              <div key={cat.categoryId} className="flex items-center gap-3">
                <span className="text-lg w-6 text-center">{index + 1}º</span>
                <span className="text-xl">{category?.icon}</span>
                <span className="flex-1">{cat.categoryName}</span>
                <span className="font-mono font-medium">{formatCurrency(cat.realized)}</span>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
