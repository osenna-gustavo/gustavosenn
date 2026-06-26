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
import { CollapsibleCategoryGroup } from '@/components/recurrences/CollapsibleCategoryGroup';
import { CurrencyInput } from '@/components/ui/currency-input';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import type { Recurrence, RecurrenceInstance } from '@/types/finance';

/**
 * Compute the automatic budget contributions from recurrences and installments
 * that apply to a given month, grouped by category and subcategory.
 * Only expenses contribute; income recurrences are aggregated separately.
 */
function computeAutoBudget(
  recurrences: Recurrence[],
  instances: RecurrenceInstance[],
  month: number,
  year: number,
) {
  const byCategory: Record<string, number> = {};
  const bySubcategory: Record<string, number> = {};
  let autoIncome = 0;

  const monthStart = new Date(year, month, 1);
  const monthEnd = new Date(year, month + 1, 0);

  for (const rec of recurrences) {
    if (!rec.isActive) continue;
    const startDate = new Date(rec.startDate);
    const endDate = rec.endDate ? new Date(rec.endDate) : null;
    if (startDate > monthEnd) continue;
    if (endDate && endDate < monthStart) continue;
    if (rec.totalInstallments) {
      const currentNum =
        (year - startDate.getFullYear()) * 12 + (month - startDate.getMonth()) + 1;
      if (currentNum < 1 || currentNum > rec.totalInstallments) continue;
    }

    const instance = instances.find(i => i.recurrenceId === rec.id);
    const amount = instance?.amount ?? rec.amount;

    if (rec.type === 'receita') {
      autoIncome += amount;
      continue;
    }

    if (rec.subcategoryId) {
      bySubcategory[rec.subcategoryId] = (bySubcategory[rec.subcategoryId] || 0) + amount;
    } else {
      byCategory[rec.categoryId] = (byCategory[rec.categoryId] || 0) + amount;
    }
  }

  return { byCategory, bySubcategory, autoIncome };
}

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
    refreshData,
  } = useApp();
  const { toast } = useToast();

  const [plannedIncome, setPlannedIncome] = useState('');
  const [plannedExpenses, setPlannedExpenses] = useState('');
  const [categoryBudgets, setCategoryBudgets] = useState<Record<string, string>>({});
  const [subcategoryBudgets, setSubcategoryBudgets] = useState<Record<string, string>>({});
  const [isSaving, setIsSaving] = useState(false);
  const [isDirty, setIsDirty] = useState(false);
  const [showDuplicateModal, setShowDuplicateModal] = useState(false);
  const [showRecurrences, setShowRecurrences] = useState(true);
  const [showInstallments, setShowInstallments] = useState(true);
  const [collapsedInstallmentGroups, setCollapsedInstallmentGroups] = useState<Set<string>>(new Set());
  const toggleInstallmentGroup = (key: string) => {
    setCollapsedInstallmentGroups(prev => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key); else next.add(key);
      return next;
    });
  };

  // Wrapped setters that mark form as dirty (user has unsaved edits)
  const updateCategoryBudget = (id: string, value: string) => {
    setIsDirty(true);
    setCategoryBudgets(prev => ({ ...prev, [id]: value }));
  };
  const updateSubcategoryBudget = (id: string, value: string) => {
    setIsDirty(true);
    setSubcategoryBudgets(prev => ({ ...prev, [id]: value }));
  };
  const updatePlannedIncome = (v: string) => { setIsDirty(true); setPlannedIncome(v); };
  const updatePlannedExpenses = (v: string) => { setIsDirty(true); setPlannedExpenses(v); };

  // Auto contributions from recurrences + installments for this month
  const { byCategory: autoByCategory, bySubcategory: autoBySubcategory, autoIncome } = useMemo(
    () => computeAutoBudget(recurrences, recurrenceInstances, selectedMonth, selectedYear),
    [recurrences, recurrenceInstances, selectedMonth, selectedYear],
  );

  // Initialize manual values from saved budget (only when no unsaved edits)
  useEffect(() => {
    if (isDirty) return;

    if (budget) {
      setPlannedIncome(budget.plannedIncome > 0 ? formatNumberToBRL(budget.plannedIncome) : '');
      setPlannedExpenses(budget.plannedExpenses > 0 ? formatNumberToBRL(budget.plannedExpenses) : '');
    } else {
      setPlannedIncome('');
      setPlannedExpenses('');
    }

    const catBudgets: Record<string, string> = {};
    const subBudgets: Record<string, string> = {};

    categories.filter(c => c.type === 'despesa').forEach(cat => {
      catBudgets[cat.id] = '';
    });
    subcategories.forEach(sub => {
      subBudgets[sub.id] = '';
    });

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
  }, [budget, categories, subcategories, isDirty]);

  // Reset dirty flag when month changes
  useEffect(() => { setIsDirty(false); }, [selectedMonth, selectedYear]);

  // Realized amounts per category/subcategory
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

  // Active installment plans for the selected month (for the read-only block)
  const activeInstallments = useMemo(() => {
    return recurrences.filter(r => {
      if (!r.totalInstallments || !r.isActive) return false;
      const start = new Date(r.startDate);
      const currentNum = (selectedYear - start.getFullYear()) * 12 + (selectedMonth - start.getMonth()) + 1;
      return currentNum >= 1 && currentNum <= r.totalInstallments;
    });
  }, [recurrences, selectedMonth, selectedYear]);

  const expenseCategories = useMemo(() => {
    return categories.filter(c => c.type === 'despesa').sort((a, b) => a.name.localeCompare(b.name));
  }, [categories]);

  // Total per category = manual + auto (across category + its subcategories)
  const totalCategoryBudget = useMemo(() => {
    let total = 0;
    expenseCategories.forEach(cat => {
      const manualCat = parseBRLToNumber(categoryBudgets[cat.id] || '0');
      const autoCat = autoByCategory[cat.id] || 0;
      const catSubs = subcategories.filter(s => s.categoryId === cat.id);
      let subTotal = 0;
      catSubs.forEach(sub => {
        subTotal +=
          parseBRLToNumber(subcategoryBudgets[sub.id] || '0') + (autoBySubcategory[sub.id] || 0);
      });
      total += manualCat + autoCat + subTotal;
    });
    return Math.round(total * 100) / 100;
  }, [expenseCategories, subcategories, categoryBudgets, subcategoryBudgets, autoByCategory, autoBySubcategory]);

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

      setIsDirty(false);
      toast({
        title: 'Orçamento salvo!',
        description: `Orçamento de ${formatMonthYear(selectedMonth, selectedYear)} atualizado.`,
      });
    } catch {
      toast({ title: 'Erro ao salvar', description: 'Tente novamente.', variant: 'destructive' });
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
        <div className="flex gap-2 flex-wrap">
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
            onChange={updatePlannedIncome}
            className="mt-2 text-lg border-success/30 focus:border-success"
          />
          {autoIncome > 0 && (
            <p className="text-xs text-muted-foreground mt-2">
              Recorrências de receita previstas: {formatCurrency(autoIncome)}
            </p>
          )}
        </div>
        <div className="glass-card rounded-xl p-4">
          <Label htmlFor="expenses" className="text-sm text-muted-foreground">
            Despesas Planejadas (R$)
          </Label>
          <CurrencyInput
            id="expenses"
            value={plannedExpenses}
            onChange={updatePlannedExpenses}
            className="mt-2 text-lg border-destructive/30 focus:border-destructive"
          />
          <p className="text-xs text-muted-foreground mt-2">
            Soma das categorias: {formatCurrency(totalCategoryBudget)}
          </p>
        </div>
      </div>

      {/* Recurrences Block (reference only) */}
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
                recurrences={recurrences.filter(r => !r.totalInstallments)}
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

      {/* Installments Block (reference only) */}
      {activeInstallments.length > 0 && (
        <Collapsible open={showInstallments} onOpenChange={setShowInstallments}>
          <div className="glass-card rounded-xl overflow-hidden">
            <CollapsibleTrigger asChild>
              <button className="w-full flex items-center justify-between p-4 lg:p-6 hover:bg-muted/50 transition-colors">
                <div className="flex items-center gap-2">
                  <CreditCard className="h-5 w-5 text-primary" />
                  <h3 className="text-lg font-semibold">
                    Parcelamentos do Mês
                    <span className="ml-2 text-sm font-normal text-muted-foreground">
                      ({activeInstallments.length} ativo{activeInstallments.length !== 1 ? 's' : ''})
                    </span>
                  </h3>
                </div>
                {showInstallments ? (
                  <ChevronUp className="h-5 w-5 text-muted-foreground" />
                ) : (
                  <ChevronDown className="h-5 w-5 text-muted-foreground" />
                )}
              </button>
            </CollapsibleTrigger>
            <CollapsibleContent>
              <div className="px-4 pb-4 lg:px-6 lg:pb-6 space-y-3">
                {(() => {
                  const grouped = new Map<string, typeof activeInstallments>();
                  for (const plan of activeInstallments) {
                    const key = plan.categoryId || '__none__';
                    const arr = grouped.get(key) || [];
                    arr.push(plan);
                    grouped.set(key, arr);
                  }
                  const entries = Array.from(grouped.entries()).sort((a, b) => {
                    const nA = categories.find(c => c.id === a[0])?.name || '';
                    const nB = categories.find(c => c.id === b[0])?.name || '';
                    return nA.localeCompare(nB);
                  });
                  return entries.map(([catId, plans]) => {
                    const category = categories.find(c => c.id === catId);
                    const groupTotal = plans.reduce((s, p) => s + p.amount, 0);
                    return (
                      <CollapsibleCategoryGroup
                        key={catId}
                        groupKey={`inst-${catId}`}
                        icon={category?.icon}
                        name={category?.name}
                        count={plans.length}
                        collapsedGroups={collapsedInstallmentGroups}
                        onToggle={toggleInstallmentGroup}
                        variant="md"
                      >
                        <div className="space-y-2 pl-2">
                          {plans.map(plan => {
                            const subcategory = subcategories.find(s => s.id === plan.subcategoryId);
                            const start = new Date(plan.startDate);
                            const currentNum = (selectedYear - start.getFullYear()) * 12 + (selectedMonth - start.getMonth()) + 1;
                            return (
                              <div key={plan.id} className="flex items-center justify-between p-3 rounded-lg bg-muted/40">
                                <div>
                                  <div className="font-medium text-sm">{plan.name}</div>
                                  <div className="text-xs text-muted-foreground">
                                    {subcategory && `${subcategory.name} • `}parcela {currentNum}/{plan.totalInstallments}
                                  </div>
                                </div>
                                <span className="font-mono text-sm font-medium">
                                  {formatCurrency(plan.amount)}
                                </span>
                              </div>
                            );
                          })}
                          <div className="text-right text-xs text-muted-foreground pr-1">
                            Subtotal: <span className="font-mono font-medium text-foreground">{formatCurrency(groupTotal)}</span>
                          </div>
                        </div>
                      </CollapsibleCategoryGroup>
                    );
                  });
                })()}
                <div className="pt-2 border-t border-border text-sm text-muted-foreground">
                  Total: <span className="font-mono font-medium text-foreground">
                    {formatCurrency(activeInstallments.reduce((s, p) => s + p.amount, 0))}
                  </span>
                </div>
              </div>
            </CollapsibleContent>
          </div>
        </Collapsible>
      )}

      {/* Category Budgets */}
      <div className="glass-card rounded-xl p-4 lg:p-6">
        <div className="flex items-start justify-between mb-4 gap-3 flex-wrap">
          <div>
            <h3 className="text-lg font-semibold">Orçamento por Categoria (Despesas)</h3>
            <p className="text-xs text-muted-foreground mt-1">
              Inclui automaticamente os valores de recorrências e parcelamentos do mês. Adicione valores extras conforme necessário.
            </p>
          </div>
        </div>

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
                onCategoryChange={updateCategoryBudget}
                onSubcategoryChange={updateSubcategoryBudget}
                realizedByCategory={realizedByCategory}
                realizedBySubcategory={realizedBySubcategory}
                autoByCategory={autoByCategory}
                autoBySubcategory={autoBySubcategory}
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
    </div>
  );
}
