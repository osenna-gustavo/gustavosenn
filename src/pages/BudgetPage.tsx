import { useState, useEffect, useMemo } from 'react';
import { useApp } from '@/contexts/AppContext';
import { formatCurrency, formatMonthYear } from '@/lib/formatters';
import { formatNumberToBRL, parseBRLToNumber } from '@/lib/currencyInput';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { useToast } from '@/hooks/use-toast';
import { Save, Copy } from 'lucide-react';
import { SubcategoryBudgetEditor } from '@/components/budget/SubcategoryBudgetEditor';
import { DuplicateBudgetModal } from '@/components/budget/DuplicateBudgetModal';
import { CurrencyInput } from '@/components/ui/currency-input';

export function BudgetPage() {
  const { 
    selectedMonth, 
    selectedYear, 
    categories,
    subcategories, 
    transactions,
    budget, 
    saveBudget,
    refreshData 
  } = useApp();
  const { toast } = useToast();

  const [plannedIncome, setPlannedIncome] = useState('');
  const [plannedExpenses, setPlannedExpenses] = useState('');
  const [categoryBudgets, setCategoryBudgets] = useState<Record<string, string>>({});
  const [subcategoryBudgets, setSubcategoryBudgets] = useState<Record<string, string>>({});
  const [isSaving, setIsSaving] = useState(false);
  const [showDuplicateModal, setShowDuplicateModal] = useState(false);

  // Initialize from budget - format as BRL
  useEffect(() => {
    if (budget) {
      setPlannedIncome(budget.plannedIncome > 0 ? formatNumberToBRL(budget.plannedIncome) : '');
      setPlannedExpenses(budget.plannedExpenses > 0 ? formatNumberToBRL(budget.plannedExpenses) : '');
      
      const catBudgets: Record<string, string> = {};
      const subBudgets: Record<string, string> = {};
      
      budget.categoryBudgets.forEach(cb => {
        if (cb.subcategoryId) {
          subBudgets[cb.subcategoryId] = cb.plannedAmount > 0 ? formatNumberToBRL(cb.plannedAmount) : '';
        } else {
          catBudgets[cb.categoryId] = cb.plannedAmount > 0 ? formatNumberToBRL(cb.plannedAmount) : '';
        }
      });
      
      setCategoryBudgets(catBudgets);
      setSubcategoryBudgets(subBudgets);
    } else {
      setPlannedIncome('');
      setPlannedExpenses('');
      setCategoryBudgets({});
      setSubcategoryBudgets({});
    }
  }, [budget, selectedMonth, selectedYear]);

  // Calculate realized amounts
  const { realizedByCategory, realizedBySubcategory } = useMemo(() => {
    const byCategory: Record<string, number> = {};
    const bySubcategory: Record<string, number> = {};
    
    transactions.filter(t => t.type === 'despesa').forEach(t => {
      byCategory[t.categoryId] = (byCategory[t.categoryId] || 0) + t.amount;
      if (t.subcategoryId) {
        bySubcategory[t.subcategoryId] = (bySubcategory[t.subcategoryId] || 0) + t.amount;
      }
    });
    
    return { realizedByCategory: byCategory, realizedBySubcategory: bySubcategory };
  }, [transactions]);

  // Filter only expense categories for budget display
  const expenseCategories = useMemo(() => {
    return categories.filter(c => c.type === 'despesa');
  }, [categories]);

  const totalCategoryBudget = useMemo(() => {
    let total = 0;
    expenseCategories.forEach(cat => {
      const catSubs = subcategories.filter(s => s.categoryId === cat.id);
      if (catSubs.length > 0) {
        // Sum subcategories
        catSubs.forEach(sub => {
          total += parseBRLToNumber(subcategoryBudgets[sub.id] || '0');
        });
      } else {
        // Use category value directly
        total += parseBRLToNumber(categoryBudgets[cat.id] || '0');
      }
    });
    return Math.round(total * 100) / 100; // Round to avoid floating point issues
  }, [expenseCategories, subcategories, categoryBudgets, subcategoryBudgets]);

  const handleSave = async () => {
    setIsSaving(true);
    try {
      const parsedIncome = parseBRLToNumber(plannedIncome);
      const parsedExpenses = parseBRLToNumber(plannedExpenses) || totalCategoryBudget;
      
      const categoryBudgetsArray = [
        ...Object.entries(categoryBudgets)
          .filter(([_, value]) => value && parseBRLToNumber(value) > 0)
          .map(([categoryId, value]) => ({
            categoryId,
            plannedAmount: parseBRLToNumber(value),
          })),
        ...Object.entries(subcategoryBudgets)
          .filter(([_, value]) => value && parseBRLToNumber(value) > 0)
          .map(([subcategoryId, value]) => {
            const sub = subcategories.find(s => s.id === subcategoryId);
            return {
              categoryId: sub?.categoryId || '',
              subcategoryId,
              plannedAmount: parseBRLToNumber(value),
            };
          }),
      ];

      await saveBudget({
        month: selectedMonth,
        year: selectedYear,
        plannedIncome: parsedIncome,
        plannedExpenses: parsedExpenses,
        categoryBudgets: categoryBudgetsArray,
      });

      toast({
        title: 'Orçamento salvo!',
        description: `Orçamento de ${formatMonthYear(selectedMonth, selectedYear)} atualizado.`,
      });
    } catch (error) {
      toast({
        title: 'Erro ao salvar',
        description: 'Tente novamente.',
        variant: 'destructive',
      });
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl lg:text-3xl font-bold">Orçamento</h1>
          <p className="text-muted-foreground">
            Planejamento de {formatMonthYear(selectedMonth, selectedYear)}
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={() => setShowDuplicateModal(true)} className="gap-2">
            <Copy className="h-4 w-4" />
            Duplicar Mês Anterior
          </Button>
          <Button onClick={handleSave} disabled={isSaving} className="gap-2">
            <Save className="h-4 w-4" />
            {isSaving ? 'Salvando...' : 'Salvar'}
          </Button>
        </div>
      </div>

      {/* Total Budget */}
      <div className="grid sm:grid-cols-2 gap-4">
        <div className="glass-card rounded-xl p-4">
          <Label htmlFor="income" className="text-sm text-muted-foreground">
            Receita Planejada (R$)
          </Label>
          <CurrencyInput
            id="income"
            value={plannedIncome}
            onChange={setPlannedIncome}
            className="mt-2 text-lg border-success/30 focus:border-success"
          />
        </div>
        <div className="glass-card rounded-xl p-4">
          <Label htmlFor="expenses" className="text-sm text-muted-foreground">
            Despesas Planejadas (R$)
          </Label>
          <CurrencyInput
            id="expenses"
            value={plannedExpenses}
            onChange={setPlannedExpenses}
            className="mt-2 text-lg border-destructive/30 focus:border-destructive"
          />
          <p className="text-xs text-muted-foreground mt-2">
            Soma das categorias: {formatCurrency(totalCategoryBudget)}
          </p>
        </div>
      </div>

      {/* Category Budgets */}
      <div className="glass-card rounded-xl p-4 lg:p-6">
        <h3 className="text-lg font-semibold mb-4">Orçamento por Categoria (Despesas)</h3>
        
        <div className="space-y-3">
          {expenseCategories.map((cat) => (
            <SubcategoryBudgetEditor
              key={cat.id}
              category={cat}
              subcategories={subcategories}
              categoryBudgets={categoryBudgets}
              subcategoryBudgets={subcategoryBudgets}
              onCategoryChange={(id, value) => setCategoryBudgets(prev => ({ ...prev, [id]: value }))}
              onSubcategoryChange={(id, value) => setSubcategoryBudgets(prev => ({ ...prev, [id]: value }))}
              realizedByCategory={realizedByCategory}
              realizedBySubcategory={realizedBySubcategory}
            />
          ))}
        </div>
      </div>

      {/* Summary */}
      <div className="glass-card rounded-xl p-4">
        <div className="flex items-center justify-between">
          <span className="text-muted-foreground">Saldo Planejado</span>
          <span className="text-xl font-mono font-bold">
            {formatCurrency(
              parseBRLToNumber(plannedIncome) -
              (parseBRLToNumber(plannedExpenses) || totalCategoryBudget)
            )}
          </span>
        </div>
      </div>

      {/* Duplicate Modal */}
      <DuplicateBudgetModal
        isOpen={showDuplicateModal}
        onClose={() => setShowDuplicateModal(false)}
        onSuccess={refreshData}
      />
    </div>
  );
}
