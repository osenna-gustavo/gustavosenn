import { useState, useMemo } from 'react';
import { useApp } from '@/contexts/AppContext';
import { formatCurrency, formatDate } from '@/lib/formatters';
import { 
  ArrowUpRight, 
  ArrowDownRight, 
  Search, 
  Filter,
  AlertTriangle,
  Pencil
} from 'lucide-react';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { EditTransactionModal } from './EditTransactionModal';
import { cn } from '@/lib/utils';
import type { Transaction } from '@/types/finance';

export function TransactionList() {
  const { transactions, categories } = useApp();
  
  const [searchQuery, setSearchQuery] = useState('');
  const [categoryFilter, setCategoryFilter] = useState<string>('all');
  const [editingTransaction, setEditingTransaction] = useState<Transaction | null>(null);

  const filteredTransactions = useMemo(() => {
    return transactions
      .filter(t => {
        if (categoryFilter !== 'all' && t.categoryId !== categoryFilter) {
          return false;
        }
        if (searchQuery) {
          const query = searchQuery.toLowerCase();
          const category = categories.find(c => c.id === t.categoryId);
          const matchesDescription = t.description?.toLowerCase().includes(query);
          const matchesCategory = category?.name.toLowerCase().includes(query);
          return matchesDescription || matchesCategory;
        }
        return true;
      })
      .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
  }, [transactions, categories, searchQuery, categoryFilter]);

  const totals = useMemo(() => {
    const income = filteredTransactions
      .filter(t => t.type === 'receita')
      .reduce((sum, t) => sum + t.amount, 0);
    const expenses = filteredTransactions
      .filter(t => t.type === 'despesa')
      .reduce((sum, t) => sum + t.amount, 0);
    return { income, expenses, balance: income - expenses };
  }, [filteredTransactions]);

  return (
    <div className="space-y-4">
      {/* Summary Cards */}
      <div className="grid grid-cols-3 gap-3">
        <div className="stat-card border-l-4 border-l-success">
          <p className="text-xs text-muted-foreground mb-1">Receitas</p>
          <p className="text-lg font-mono font-bold text-success">
            {formatCurrency(totals.income)}
          </p>
        </div>
        <div className="stat-card border-l-4 border-l-destructive">
          <p className="text-xs text-muted-foreground mb-1">Despesas</p>
          <p className="text-lg font-mono font-bold text-destructive">
            {formatCurrency(totals.expenses)}
          </p>
        </div>
        <div className={cn(
          "stat-card border-l-4",
          totals.balance >= 0 ? "border-l-success" : "border-l-destructive"
        )}>
          <p className="text-xs text-muted-foreground mb-1">Saldo</p>
          <p className={cn(
            "text-lg font-mono font-bold",
            totals.balance >= 0 ? "text-success" : "text-destructive"
          )}>
            {formatCurrency(totals.balance)}
          </p>
        </div>
      </div>

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Buscar por descrição ou categoria..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-9"
          />
        </div>
        <Select value={categoryFilter} onValueChange={setCategoryFilter}>
          <SelectTrigger className="w-full sm:w-[180px]">
            <Filter className="h-4 w-4 mr-2" />
            <SelectValue placeholder="Categoria" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todas as categorias</SelectItem>
            {categories.map((cat) => (
              <SelectItem key={cat.id} value={cat.id}>
                {cat.icon} {cat.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Transaction List */}
      <div className="glass-card rounded-xl divide-y divide-border">
        {filteredTransactions.length === 0 ? (
          <div className="p-8 text-center text-muted-foreground">
            {transactions.length === 0 
              ? 'Nenhum lançamento neste mês.'
              : 'Nenhum resultado encontrado.'}
          </div>
        ) : (
          filteredTransactions.map((transaction) => {
            const category = categories.find(c => c.id === transaction.categoryId);
            const isIncome = transaction.type === 'receita';
            
            return (
              <div 
                key={transaction.id}
                className="flex items-center justify-between p-4 hover:bg-muted/50 transition-colors cursor-pointer"
                onClick={() => setEditingTransaction(transaction)}
              >
                <div className="flex items-center gap-3">
                  <div className={cn(
                    "h-10 w-10 rounded-lg flex items-center justify-center text-lg",
                    isIncome ? "bg-success/10" : "bg-muted"
                  )}>
                    {category?.icon || (isIncome ? <ArrowUpRight className="h-5 w-5 text-success" /> : <ArrowDownRight className="h-5 w-5" />)}
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <p className="font-medium">{category?.name || 'Sem categoria'}</p>
                      {transaction.needsReview && (
                        <AlertTriangle className="h-4 w-4 text-warning" />
                      )}
                      {transaction.origin === 'recurrence' && (
                        <span className="text-[10px] px-1.5 py-0.5 rounded bg-primary/10 text-primary">
                          Recorrência
                        </span>
                      )}
                    </div>
                    <p className="text-sm text-muted-foreground">
                      {formatDate(transaction.date)}
                      {transaction.description && ` • ${transaction.description}`}
                    </p>
                  </div>
                </div>
                
                <div className="flex items-center gap-3">
                  <span className={cn(
                    "font-mono font-medium",
                    isIncome ? "text-success" : "text-foreground"
                  )}>
                    {isIncome ? '+' : '-'}{formatCurrency(transaction.amount)}
                  </span>
                  <Pencil className="h-4 w-4 text-muted-foreground" />
                </div>
              </div>
            );
          })
        )}
      </div>

      {/* Edit Modal */}
      <EditTransactionModal
        transaction={editingTransaction}
        isOpen={!!editingTransaction}
        onClose={() => setEditingTransaction(null)}
      />
    </div>
  );
}
