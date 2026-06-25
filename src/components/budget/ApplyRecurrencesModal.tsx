import { useState, useMemo } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import { formatCurrency } from '@/lib/formatters';
import { Plus, Replace, RefreshCw, CreditCard, TrendingUp } from 'lucide-react';
import type { Recurrence, RecurrenceInstance, Category, Subcategory } from '@/types/finance';

interface ApplyRecurrencesModalProps {
  isOpen: boolean;
  onClose: () => void;
  recurrences: Recurrence[];
  instances: RecurrenceInstance[];
  categories: Category[];
  subcategories: Subcategory[];
  selectedMonth: number;
  selectedYear: number;
  onApply: (
    mode: 'sum' | 'replace',
    amounts: Record<string, number>,
    incomeTotal: number,
    includeIncome: boolean,
  ) => void;
}

type Source = 'recurrence' | 'installment';

interface BreakdownItem {
  key: string;          // cat_<id> | sub_<id>
  source: Source;
  type: 'receita' | 'despesa';
  name: string;
  amount: number;
}

export function ApplyRecurrencesModal({
  isOpen,
  onClose,
  recurrences,
  instances,
  categories,
  subcategories,
  selectedMonth,
  selectedYear,
  onApply,
}: ApplyRecurrencesModalProps) {
  const [mode, setMode] = useState<'sum' | 'replace'>('sum');
  const [includeRecurrences, setIncludeRecurrences] = useState(true);
  const [includeInstallments, setIncludeInstallments] = useState(true);
  const [includeIncome, setIncludeIncome] = useState(true);

  // Build breakdown of what applies to this month from recurrences + installments
  const { items, expenseByKey, incomeTotal } = useMemo(() => {
    const monthStart = new Date(selectedYear, selectedMonth, 1);
    const monthEnd = new Date(selectedYear, selectedMonth + 1, 0);
    const items: BreakdownItem[] = [];
    const expenseByKey: Record<string, number> = {};
    let incomeTotal = 0;

    for (const rec of recurrences) {
      if (!rec.isActive) continue;

      const startDate = new Date(rec.startDate);
      const endDate = rec.endDate ? new Date(rec.endDate) : null;
      if (startDate > monthEnd) continue;
      if (endDate && endDate < monthStart) continue;

      const isInstallment = !!rec.totalInstallments;
      if (isInstallment) {
        const currentNum =
          (selectedYear - startDate.getFullYear()) * 12 +
          (selectedMonth - startDate.getMonth()) + 1;
        if (currentNum < 1 || currentNum > (rec.totalInstallments || 0)) continue;
      }

      const source: Source = isInstallment ? 'installment' : 'recurrence';
      if (source === 'recurrence' && !includeRecurrences) continue;
      if (source === 'installment' && !includeInstallments) continue;
      if (rec.type === 'receita' && !includeIncome) continue;

      const instance = instances.find(i => i.recurrenceId === rec.id);
      const amount = instance?.amount ?? rec.amount;

      const cat = categories.find(c => c.id === rec.categoryId);
      const sub = rec.subcategoryId ? subcategories.find(s => s.id === rec.subcategoryId) : undefined;
      const name = `${cat?.icon || ''} ${cat?.name || '—'}${sub ? ` → ${sub.name}` : ''} • ${rec.name}`;

      if (rec.type === 'receita') {
        incomeTotal += amount;
        items.push({ key: `income_${rec.id}`, source, type: 'receita', name, amount });
      } else {
        const key = rec.subcategoryId ? `sub_${rec.subcategoryId}` : `cat_${rec.categoryId}`;
        expenseByKey[key] = (expenseByKey[key] || 0) + amount;
        items.push({ key, source, type: 'despesa', name, amount });
      }
    }

    return { items, expenseByKey, incomeTotal };
  }, [
    recurrences, instances, categories, subcategories,
    selectedMonth, selectedYear,
    includeRecurrences, includeInstallments, includeIncome,
  ]);

  const expenseTotal = useMemo(
    () => Object.values(expenseByKey).reduce((a, b) => a + b, 0),
    [expenseByKey],
  );
  const totalToApply = expenseTotal + (includeIncome ? incomeTotal : 0);

  const handleApply = () => {
    onApply(mode, expenseByKey, incomeTotal, includeIncome);
    onClose();
  };

  const recurrenceItems = items.filter(i => i.source === 'recurrence');
  const installmentItems = items.filter(i => i.source === 'installment');

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Montar Orçamento Automaticamente</DialogTitle>
          <DialogDescription>
            Puxa recorrências e parcelamentos ativos do mês como base. Você pode ajustar
            cada categoria depois.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-2">
          {/* Source toggles */}
          <div className="space-y-2">
            <Label className="text-sm font-medium">O que incluir?</Label>
            <div className="space-y-2">
              <label className="flex items-center gap-3 p-3 rounded-lg border border-border cursor-pointer hover:bg-muted/50">
                <Checkbox checked={includeRecurrences} onCheckedChange={(v) => setIncludeRecurrences(!!v)} />
                <RefreshCw className="h-4 w-4 text-primary" />
                <span className="text-sm flex-1">Recorrências (receitas e despesas fixas)</span>
              </label>
              <label className="flex items-center gap-3 p-3 rounded-lg border border-border cursor-pointer hover:bg-muted/50">
                <Checkbox checked={includeInstallments} onCheckedChange={(v) => setIncludeInstallments(!!v)} />
                <CreditCard className="h-4 w-4 text-primary" />
                <span className="text-sm flex-1">Parcelamentos ativos no mês</span>
              </label>
              <label className="flex items-center gap-3 p-3 rounded-lg border border-border cursor-pointer hover:bg-muted/50">
                <Checkbox checked={includeIncome} onCheckedChange={(v) => setIncludeIncome(!!v)} />
                <TrendingUp className="h-4 w-4 text-success" />
                <span className="text-sm flex-1">Preencher Receita Planejada também</span>
              </label>
            </div>
          </div>

          {/* Preview */}
          <div className="rounded-lg border border-border p-3 space-y-3">
            <div className="text-sm font-medium">Pré-visualização</div>

            {recurrenceItems.length > 0 && (
              <div className="space-y-1">
                <div className="text-xs text-muted-foreground flex items-center gap-1">
                  <RefreshCw className="h-3 w-3" /> Recorrências
                </div>
                {recurrenceItems.map((it, i) => (
                  <div key={`r${i}`} className="flex justify-between text-sm">
                    <span className={it.type === 'receita' ? 'text-success' : ''}>{it.name}</span>
                    <span className="font-mono">
                      {it.type === 'receita' ? '+' : '-'}{formatCurrency(it.amount)}
                    </span>
                  </div>
                ))}
              </div>
            )}

            {installmentItems.length > 0 && (
              <div className="space-y-1">
                <div className="text-xs text-muted-foreground flex items-center gap-1">
                  <CreditCard className="h-3 w-3" /> Parcelamentos
                </div>
                {installmentItems.map((it, i) => (
                  <div key={`i${i}`} className="flex justify-between text-sm">
                    <span>{it.name}</span>
                    <span className="font-mono">-{formatCurrency(it.amount)}</span>
                  </div>
                ))}
              </div>
            )}

            {items.length === 0 && (
              <p className="text-sm text-muted-foreground py-2">
                Nada a aplicar com a seleção atual.
              </p>
            )}

            <div className="pt-2 border-t border-border space-y-1 text-sm">
              {includeIncome && (
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Receitas previstas</span>
                  <span className="font-mono text-success">+{formatCurrency(incomeTotal)}</span>
                </div>
              )}
              <div className="flex justify-between">
                <span className="text-muted-foreground">Despesas previstas</span>
                <span className="font-mono">-{formatCurrency(expenseTotal)}</span>
              </div>
              <div className="flex justify-between font-semibold pt-1">
                <span>Total considerado</span>
                <span className="font-mono">{formatCurrency(totalToApply)}</span>
              </div>
            </div>
          </div>

          {/* Mode */}
          <div className="space-y-2">
            <Label className="text-sm font-medium">Como aplicar nas categorias?</Label>
            <RadioGroup value={mode} onValueChange={(v) => setMode(v as 'sum' | 'replace')}>
              <div className="flex items-center space-x-3 p-3 rounded-lg border border-border hover:bg-muted/50">
                <RadioGroupItem value="sum" id="sum" />
                <Label htmlFor="sum" className="flex-1 cursor-pointer">
                  <div className="flex items-center gap-2">
                    <Plus className="h-4 w-4 text-success" />
                    <span className="font-medium">Somar ao valor existente</span>
                  </div>
                  <p className="text-xs text-muted-foreground mt-1">
                    Mantém o que já estava planejado e adiciona os valores acima.
                  </p>
                </Label>
              </div>
              <div className="flex items-center space-x-3 p-3 rounded-lg border border-border hover:bg-muted/50">
                <RadioGroupItem value="replace" id="replace" />
                <Label htmlFor="replace" className="flex-1 cursor-pointer">
                  <div className="flex items-center gap-2">
                    <Replace className="h-4 w-4 text-warning" />
                    <span className="font-medium">Substituir valor existente</span>
                  </div>
                  <p className="text-xs text-muted-foreground mt-1">
                    Sobrescreve as categorias afetadas com os valores acima.
                  </p>
                </Label>
              </div>
            </RadioGroup>
          </div>
        </div>

        <DialogFooter className="gap-2 sm:gap-0">
          <Button variant="outline" onClick={onClose}>Cancelar</Button>
          <Button onClick={handleApply} disabled={totalToApply === 0}>
            Aplicar ao Orçamento
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
