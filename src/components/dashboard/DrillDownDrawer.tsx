import { useApp } from '@/contexts/AppContext';
import { formatCurrency, formatDateShort, formatMonthYear } from '@/lib/formatters';
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ArrowUpRight, ArrowDownRight, ExternalLink, X } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { Transaction, TransactionType } from '@/types/finance';

export interface DrillDownFilter {
  type: 'all' | 'expenses' | 'income' | 'fixed' | 'variable';
  categoryId?: string;
  subcategoryId?: string;
  title: string;
}

interface DrillDownDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  filter: DrillDownFilter | null;
}

export function DrillDownDrawer({ isOpen, onClose, filter }: DrillDownDrawerProps) {
  const { 
    transactions, 
    categories, 
    subcategories,
    selectedMonth, 
    selectedYear, 
    setCurrentScreen 
  } = useApp();

  if (!filter) return null;

  // Filter transactions based on drill-down criteria
  const filteredTransactions = transactions.filter(t => {
    // Filter by type
    if (filter.type === 'expenses' && t.type !== 'despesa') return false;
    if (filter.type === 'income' && t.type !== 'receita') return false;
    
    // Filter by fixed/variable
    if (filter.type === 'fixed') {
      const category = categories.find(c => c.id === t.categoryId);
      if (!category?.isFixed || t.type !== 'despesa') return false;
    }
    if (filter.type === 'variable') {
      const category = categories.find(c => c.id === t.categoryId);
      if (category?.isFixed || t.type !== 'despesa') return false;
    }
    
    // Filter by category
    if (filter.categoryId && t.categoryId !== filter.categoryId) return false;
    
    // Filter by subcategory
    if (filter.subcategoryId && t.subcategoryId !== filter.subcategoryId) return false;
    
    return true;
  }).sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

  // Calculate total
  const total = filteredTransactions.reduce((sum, t) => {
    if (t.type === 'receita') return sum + t.amount;
    return sum - t.amount;
  }, 0);

  const totalExpenses = filteredTransactions
    .filter(t => t.type === 'despesa')
    .reduce((sum, t) => sum + t.amount, 0);

  const totalIncome = filteredTransactions
    .filter(t => t.type === 'receita')
    .reduce((sum, t) => sum + t.amount, 0);

  // Build filter description
  const buildFilterDescription = () => {
    const parts = [formatMonthYear(selectedMonth, selectedYear)];
    
    if (filter.type === 'expenses') parts.push('Despesas');
    else if (filter.type === 'income') parts.push('Receitas');
    else if (filter.type === 'fixed') parts.push('Fixos');
    else if (filter.type === 'variable') parts.push('Variáveis');
    
    if (filter.categoryId) {
      const cat = categories.find(c => c.id === filter.categoryId);
      if (cat) parts.push(cat.name);
    }
    
    if (filter.subcategoryId) {
      const sub = subcategories.find(s => s.id === filter.subcategoryId);
      if (sub) parts.push(sub.name);
    }
    
    return parts.join(' • ');
  };

  const handleOpenTransactions = () => {
    setCurrentScreen('transactions');
    onClose();
  };

  return (
    <Sheet open={isOpen} onOpenChange={onClose}>
      <SheetContent className="w-full sm:max-w-lg overflow-y-auto">
        <SheetHeader className="space-y-4 pb-4 border-b border-border">
          <div className="flex items-center justify-between">
            <SheetTitle>{filter.title}</SheetTitle>
          </div>
          
          <div className="text-xs text-muted-foreground">
            {buildFilterDescription()}
          </div>

          {/* Totals */}
          <div className="grid grid-cols-2 gap-3">
            {(filter.type === 'all' || filter.type === 'income') && totalIncome > 0 && (
              <div className="bg-success/10 rounded-lg p-3">
                <span className="text-xs text-muted-foreground">Receitas</span>
                <p className="text-lg font-mono font-bold text-success">
                  {formatCurrency(totalIncome)}
                </p>
              </div>
            )}
            {(filter.type === 'all' || filter.type !== 'income') && totalExpenses > 0 && (
              <div className="bg-destructive/10 rounded-lg p-3">
                <span className="text-xs text-muted-foreground">Despesas</span>
                <p className="text-lg font-mono font-bold text-destructive">
                  {formatCurrency(totalExpenses)}
                </p>
              </div>
            )}
          </div>
        </SheetHeader>

        <div className="py-4 space-y-2">
          {filteredTransactions.length === 0 ? (
            <p className="text-center text-muted-foreground py-8">
              Nenhum lançamento encontrado.
            </p>
          ) : (
            filteredTransactions.map((transaction) => {
              const category = categories.find(c => c.id === transaction.categoryId);
              const subcategory = subcategories.find(s => s.id === transaction.subcategoryId);
              const isIncome = transaction.type === 'receita';
              
              return (
                <div 
                  key={transaction.id}
                  className="flex items-center justify-between py-3 px-2 rounded-lg hover:bg-muted/50 transition-colors"
                >
                  <div className="flex items-center gap-3">
                    <div className={cn(
                      "h-8 w-8 rounded-lg flex items-center justify-center flex-shrink-0",
                      isIncome ? "bg-success/10" : "bg-destructive/10"
                    )}>
                      {isIncome ? (
                        <ArrowUpRight className="h-4 w-4 text-success" />
                      ) : (
                        <ArrowDownRight className="h-4 w-4 text-destructive" />
                      )}
                    </div>
                    <div className="min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-medium text-sm truncate">
                          {category?.name || 'Sem categoria'}
                        </span>
                        {subcategory && (
                          <Badge variant="outline" className="text-[10px] px-1.5">
                            {subcategory.name}
                          </Badge>
                        )}
                      </div>
                      <p className="text-xs text-muted-foreground truncate">
                        {formatDateShort(transaction.date)}
                        {transaction.description && ` • ${transaction.description}`}
                      </p>
                    </div>
                  </div>
                  <span className={cn(
                    "font-mono font-medium text-sm flex-shrink-0 ml-2",
                    isIncome ? "text-success" : "text-foreground"
                  )}>
                    {isIncome ? '+' : '-'}{formatCurrency(transaction.amount)}
                  </span>
                </div>
              );
            })
          )}
        </div>

        {filteredTransactions.length > 0 && (
          <div className="border-t border-border pt-4">
            <Button 
              variant="outline" 
              className="w-full gap-2"
              onClick={handleOpenTransactions}
            >
              <ExternalLink className="h-4 w-4" />
              Abrir em Lançamentos
            </Button>
          </div>
        )}
      </SheetContent>
    </Sheet>
  );
}
