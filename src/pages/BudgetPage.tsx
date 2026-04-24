import { useState, useEffect, useMemo } from 'react';
import { useApp } from '@/contexts/AppContext';
import { formatCurrency, formatMonthYear } from '@/lib/formatters';
import { formatNumberToBRL, parseBRLToNumber } from '@/lib/currencyInput';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { useToast } from '@/hooks/use-toast';
import { Save, Copy, RefreshCw, ChevronDown, ChevronUp, CreditCard } from 'lucide-react';
import { SubcategoryBudgetEditor } from '@/components/budget/SubcategoryBudgetEditor';
import { DuplicateBudgetModal } from '@/components/budget/DuplicateBudgetModal';
import { BudgetRecurrencesList } from '@/components/budget/BudgetRecurrencesList';
import { ApplyRecurrencesModal } from '@/components/budget/ApplyRecurrencesModal';
import { CurrencyInput } from '@/components/ui/currency-input';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';

export function BudgetPage() {
  const { 
    selectedMonth, 
    selectedYear, 
    categories,
    subcategories, 
    transactions,
    budget,
    recurrences,
    recurrenceInstances,
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
  const [showApplyRecurrencesModal, setShowApplyRecurrencesModal] = useState(false);
  const [showRecurrences, setShowRecurrences] = useState(true);
  const [showInstallments, setShowInstallments] = useState(true);

  // Initialize from budget AND ensure all categories are represented
  useEffect(() => {
    // Set income/expenses from budget
    if (budget) {
      setPlannedIncome(budget.plannedIncome > 0 ? formatNumberToBRL(budget.plannedIncome) : '');
      setPlannedExpenses(budget.plannedExpenses > 0 ? formatNumberToBRL(budget.plannedExpenses) : '');
    } else {
      setPlannedIncome('');
      setPlannedExpenses('');
    }
    
    // Initialize ALL expense categories with budget values or empty
    const catBudgets: Record<string, string> = {};
    const subBudgets: Record<string, string> = {};
    
    // First, initialize all expense categories with empty values
    const expenseCats = categories.filter(c => c.type === 'despesa');
    expenseCats.forEach(cat => {
      catBudgets[cat.id] = '';
    });
    
    // Initialize all subcategories with empty values
    subcategories.forEach(sub => {
      subBudgets[sub.id] = '';
    });
    
    // Then overlay with budget values if they exist
    if (budget) {
      budget.categoryBudgets.forEach(cb => {
        if (cb.subcategoryId) {
          subBudgets[cb.subcategoryId] = cb.plannedAmount > 0 ? formatNumberToBRL(cb.plannedAmount) : '';
        } else {
          catBudgets[cb.categoryId] = cb.plannedAmount > 0 ? formatNumberToBRL(cb.plannedAmount) : '';
        }
      });
    }
    
    setCategoryBudgets(catBudgets);
    setSubcategoryBudgets(subBudgets);
  }, [budget, categories, subcategories, selectedMonth, selectedYear]);

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

  // Filter only expense categories for budget display - show ALL of them
  const expenseCategories = useMemo(() => {
    return categories.filter(c => c.type === 'despesa').sort((a, b) => a.name.localeCompare(b.name));
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

  const handleApplyRecurrences = (mode: 'sum' | 'replace', amounts: Record<string, number>) => {
    const newCatBudgets = { ...categoryBudgets };
    const newSubBudgets = { ...subcategoryBudgets };
    
    Object.entries(amounts).forEach(([key, amount]) => {
      if (key.startsWith('cat_')) {
        const catId = key.replace('cat_', '');
        const current = parseBRLToNumber(newCatBudgets[catId] || '0');
        const newValue = mode === 'sum' ? current + amount : amount;
        newCatBudgets[catId] = formatNumberToBRL(newValue);
      } else if (key.startsWith('sub_')) {
        const subId = key.replace('sub_', '');
        const current = parseBRLToNumber(newSubBudgets[subId] || '0');
        const newValue = mode === 'sum' ? current + amount : amount;
        newSubBudgets[subId] = formatNumberToBRL(newValue);
      }
    });
    
    setCategoryBudgets(newCatBudgets);
    setSubcategoryBudgets(newSubBudgets);
    
    toast({
      title: 'Recorrências aplicadas!',
      description: `Valores ${mode === 'sum' ? 'somados ao' : 'substituídos no'} orçamento.`,
    });
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
        <div className="flex gap-2 flex-wrap">
          <Button 
            variant="outline" 
            onClick={() => setShowApplyRecurrencesModal(true)} 
            className="gap-2"
          >
            <RefreshCw className="h-4 w-4" />
            Aplicar Recorrências
          </Button>
          <Button variant="outline" onClick={() => setShowDuplicateModal(true)} className="gap-2">
            <Copy className="h-4 w-4" />
            Duplicar Mês
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

      {/* Recurrences Block */}
      <Collapsible open={showRecurrences} onOpenChange={setShowRecurrences}>
        <div className="glass-card rounded-xl overflow-hidden">
          <CollapsibleTrigger asChild>
            <button className="w-full flex items-center justify-between p-4 lg:p-6 hover:bg-muted/50 transition-colors">
              <div className="flex items-center gap-2">
                <RefreshCw className="h-5 w-5 text-primary" />
                <h3 className="text-lg font-semibold">Recorrências do Mês</h3>
              </div>
              {showRecurrences ? (
                <ChevronUp className="h-5 w-5 text-muted-foreground" />
              ) : (
                <ChevronDown className="h-5 w-5 text-muted-foreground" />
              )}
            </button>
          </CollapsibleTrigger>
          <CollapsibleContent>
            <div className="px-4 pb-4 lg:px-6 lg:pb-6">
              <BudgetRecurrencesList
                recurrences={recurrences}
                instances={recurrenceInstances}
                categories={categories}
                subcategories={subcategories}
                selectedMonth={selectedMonth}
                selectedYear={selectedYear}
              />
            </div>
          </CollapsibleContent>
        </div>
      </Collapsible>

      {/* Category Budgets */}
      <div className="glass-card rounded-xl p-4 lg:p-6">
        <h3 className="text-lg font-semibold mb-4">Orçamento por Categoria (Despesas)</h3>
        
        {expenseCategories.length === 0 ? (
          <p className="text-center text-muted-foreground py-6">
            Nenhuma categoria de despesa cadastrada.
          </p>
        ) : (
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
        )}
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

      {/* Modals */}
      <DuplicateBudgetModal
        isOpen={showDuplicateModal}
        onClose={() => setShowDuplicateModal(false)}
        onSuccess={refreshData}
      />
      
      <ApplyRecurrencesModal
        isOpen={showApplyRecurrencesModal}
        onClose={() => setShowApplyRecurrencesModal(false)}
        recurrences={recurrences}
        instances={recurrenceInstances}
        categories={categories}
        subcategories={subcategories}
        selectedMonth={selectedMonth}
        selectedYear={selectedYear}
        onApply={handleApplyRecurrences}
      />
    </div>
  );
}
