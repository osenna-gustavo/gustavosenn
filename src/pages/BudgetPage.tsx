import { useState } from 'react';
import { useApp } from '@/contexts/AppContext';
import { formatCurrency, formatMonthYear } from '@/lib/formatters';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useToast } from '@/hooks/use-toast';
import { Save } from 'lucide-react';

export function BudgetPage() {
  const { 
    selectedMonth, 
    selectedYear, 
    categories, 
    budget, 
    saveBudget 
  } = useApp();
  const { toast } = useToast();

  const [plannedIncome, setPlannedIncome] = useState(
    budget?.plannedIncome?.toString() || ''
  );
  const [plannedExpenses, setPlannedExpenses] = useState(
    budget?.plannedExpenses?.toString() || ''
  );
  const [categoryBudgets, setCategoryBudgets] = useState<Record<string, string>>(
    () => {
      const initial: Record<string, string> = {};
      categories.forEach(cat => {
        const existing = budget?.categoryBudgets.find(cb => cb.categoryId === cat.id);
        initial[cat.id] = existing?.plannedAmount?.toString() || '';
      });
      return initial;
    }
  );
  const [isSaving, setIsSaving] = useState(false);

  // Update state when budget changes
  useState(() => {
    if (budget) {
      setPlannedIncome(budget.plannedIncome?.toString() || '');
      setPlannedExpenses(budget.plannedExpenses?.toString() || '');
      const newCatBudgets: Record<string, string> = {};
      categories.forEach(cat => {
        const existing = budget.categoryBudgets.find(cb => cb.categoryId === cat.id);
        newCatBudgets[cat.id] = existing?.plannedAmount?.toString() || '';
      });
      setCategoryBudgets(newCatBudgets);
    }
  });

  const totalCategoryBudget = Object.values(categoryBudgets)
    .reduce((sum, val) => sum + (parseFloat(val.replace(',', '.')) || 0), 0);

  const handleSave = async () => {
    setIsSaving(true);
    try {
      const parsedIncome = parseFloat(plannedIncome.replace(',', '.')) || 0;
      const parsedExpenses = parseFloat(plannedExpenses.replace(',', '.')) || 0;
      
      const categoryBudgetsArray = Object.entries(categoryBudgets)
        .filter(([_, value]) => value && parseFloat(value.replace(',', '.')) > 0)
        .map(([categoryId, value]) => ({
          categoryId,
          plannedAmount: parseFloat(value.replace(',', '.')) || 0,
        }));

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
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl lg:text-3xl font-bold">Orçamento</h1>
          <p className="text-muted-foreground">
            Planejamento de {formatMonthYear(selectedMonth, selectedYear)}
          </p>
        </div>
        <Button onClick={handleSave} disabled={isSaving} className="gap-2">
          <Save className="h-4 w-4" />
          {isSaving ? 'Salvando...' : 'Salvar'}
        </Button>
      </div>

      {/* Total Budget */}
      <div className="grid sm:grid-cols-2 gap-4">
        <div className="glass-card rounded-xl p-4">
          <Label htmlFor="income" className="text-sm text-muted-foreground">
            Receita Planejada (R$)
          </Label>
          <Input
            id="income"
            type="text"
            inputMode="decimal"
            placeholder="0,00"
            value={plannedIncome}
            onChange={(e) => setPlannedIncome(e.target.value)}
            className="mt-2 text-lg font-mono border-success/30 focus:border-success"
          />
        </div>
        <div className="glass-card rounded-xl p-4">
          <Label htmlFor="expenses" className="text-sm text-muted-foreground">
            Despesas Planejadas (R$)
          </Label>
          <Input
            id="expenses"
            type="text"
            inputMode="decimal"
            placeholder="0,00"
            value={plannedExpenses}
            onChange={(e) => setPlannedExpenses(e.target.value)}
            className="mt-2 text-lg font-mono border-destructive/30 focus:border-destructive"
          />
          <p className="text-xs text-muted-foreground mt-2">
            Soma das categorias: {formatCurrency(totalCategoryBudget)}
          </p>
        </div>
      </div>

      {/* Category Budgets */}
      <div className="glass-card rounded-xl p-4 lg:p-6">
        <h3 className="text-lg font-semibold mb-4">Orçamento por Categoria</h3>
        
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {categories.map((cat) => (
            <div key={cat.id} className="space-y-2">
              <Label className="flex items-center gap-2 text-sm">
                <span>{cat.icon}</span>
                <span>{cat.name}</span>
                {cat.isFixed && (
                  <span className="text-[10px] uppercase px-1.5 py-0.5 rounded bg-muted text-muted-foreground">
                    Fixo
                  </span>
                )}
              </Label>
              <Input
                type="text"
                inputMode="decimal"
                placeholder="0,00"
                value={categoryBudgets[cat.id] || ''}
                onChange={(e) => setCategoryBudgets(prev => ({
                  ...prev,
                  [cat.id]: e.target.value,
                }))}
                className="font-mono"
              />
            </div>
          ))}
        </div>
      </div>

      {/* Summary */}
      <div className="glass-card rounded-xl p-4">
        <div className="flex items-center justify-between">
          <span className="text-muted-foreground">Saldo Planejado</span>
          <span className="text-xl font-mono font-bold">
            {formatCurrency(
              (parseFloat(plannedIncome.replace(',', '.')) || 0) -
              (parseFloat(plannedExpenses.replace(',', '.')) || 0)
            )}
          </span>
        </div>
      </div>
    </div>
  );
}
