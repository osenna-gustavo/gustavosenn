import { useApp } from '@/contexts/AppContext';
import { formatCurrency, formatDateShort } from '@/lib/formatters';
import { ArrowUpRight, ArrowDownRight } from 'lucide-react';
import { cn } from '@/lib/utils';

export function RecentTransactions() {
  const { transactions, categories, setCurrentScreen } = useApp();

  const recentTransactions = [...transactions]
    .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
    .slice(0, 5);

  return (
    <div className="glass-card rounded-xl p-4 lg:p-6">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-lg font-semibold">Últimos Lançamentos</h3>
        <button 
          onClick={() => setCurrentScreen('transactions')}
          className="text-sm text-primary hover:underline"
        >
          Ver todos
        </button>
      </div>

      {recentTransactions.length === 0 ? (
        <p className="text-muted-foreground text-sm text-center py-8">
          Nenhum lançamento neste mês.
        </p>
      ) : (
        <div className="space-y-3">
          {recentTransactions.map((transaction) => {
            const category = categories.find(c => c.id === transaction.categoryId);
            const isIncome = transaction.type === 'receita';
            
            return (
              <div 
                key={transaction.id}
                className="flex items-center justify-between py-2 border-b border-border/50 last:border-0"
              >
                <div className="flex items-center gap-3">
                  <div className={cn(
                    "h-8 w-8 rounded-lg flex items-center justify-center",
                    isIncome ? "bg-success/10" : "bg-destructive/10"
                  )}>
                    {isIncome ? (
                      <ArrowUpRight className="h-4 w-4 text-success" />
                    ) : (
                      <ArrowDownRight className="h-4 w-4 text-destructive" />
                    )}
                  </div>
                  <div>
                    <p className="font-medium text-sm">
                      {category?.name || 'Sem categoria'}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {formatDateShort(transaction.date)}
                      {transaction.description && ` • ${transaction.description}`}
                    </p>
                  </div>
                </div>
                <span className={cn(
                  "font-mono font-medium",
                  isIncome ? "text-success" : "text-foreground"
                )}>
                  {isIncome ? '+' : '-'}{formatCurrency(transaction.amount)}
                </span>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
