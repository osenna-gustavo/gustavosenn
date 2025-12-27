import { useState } from 'react';
import { TransactionList } from '@/components/transactions/TransactionList';
import { TransactionForm } from '@/components/transactions/TransactionForm';
import { useApp } from '@/contexts/AppContext';
import { formatMonthYear } from '@/lib/formatters';
import { Button } from '@/components/ui/button';
import { Plus } from 'lucide-react';

export function TransactionsPage() {
  const { selectedMonth, selectedYear } = useApp();
  const [isFormOpen, setIsFormOpen] = useState(false);

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
        <Button onClick={() => setIsFormOpen(true)} className="hidden lg:flex gap-2">
          <Plus className="h-4 w-4" />
          Novo Lançamento
        </Button>
      </div>

      <TransactionList />

      <TransactionForm 
        isOpen={isFormOpen} 
        onClose={() => setIsFormOpen(false)} 
      />
    </div>
  );
}
