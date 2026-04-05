import { useState, useMemo } from 'react';
import { TransactionList } from '@/components/transactions/TransactionList';
import { TransactionForm } from '@/components/transactions/TransactionForm';
import { useApp } from '@/contexts/AppContext';
import { useFilters } from '@/contexts/FilterContext';
import { formatMonthYear } from '@/lib/formatters';
import { Button } from '@/components/ui/button';
import { Plus } from 'lucide-react';
import { FilterPanel } from '@/components/filters';
import { applyTransactionFilters } from '@/lib/filter-utils';

export function TransactionsPage() {
  const { selectedMonth, selectedYear, transactions, categories, subcategories } = useApp();
  const { filters } = useFilters();
  const [isFormOpen, setIsFormOpen] = useState(false);

  // Apply filters to transactions
  const filteredTransactions = useMemo(() => {
    return applyTransactionFilters(
      transactions,
      filters.transactions,
      categories,
      subcategories
    );
  }, [transactions, filters.transactions, categories, subcategories]);

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl lg:text-3xl font-bold">Lançamentos</h1>
          <p className="text-muted-foreground">
            {formatMonthYear(selectedMonth, selectedYear)}
          </p>
        </div>
        <div className="hidden lg:flex items-center gap-2">
          <Button onClick={() => setIsFormOpen(true)} className="gap-2">
            <Plus className="h-4 w-4" />
            Novo Lançamento
          </Button>
        </div>
      </div>

      {/* Filters */}
      <FilterPanel
        screen="transactions"
        categories={categories}
        subcategories={subcategories}
      />

      <TransactionList filteredTransactions={filteredTransactions} />

      <TransactionForm
        isOpen={isFormOpen}
        onClose={() => setIsFormOpen(false)}
      />
    </div>
  );
}
