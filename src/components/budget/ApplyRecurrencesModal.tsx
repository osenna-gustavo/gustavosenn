import { useState, useMemo } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Label } from '@/components/ui/label';
import { formatCurrency } from '@/lib/formatters';
import { Plus, Replace } from 'lucide-react';
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
  onApply: (mode: 'sum' | 'replace', amounts: Record<string, number>) => void;
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

  // Calculate amounts to apply per category/subcategory
  const recurrenceAmounts = useMemo(() => {
    const byCategory: Record<string, number> = {};
    const bySubcategory: Record<string, number> = {};

    for (const rec of recurrences) {
      if (!rec.isActive || rec.type !== 'despesa') continue;

      const startDate = new Date(rec.startDate);
      const endDate = rec.endDate ? new Date(rec.endDate) : null;
      
      const monthStart = new Date(selectedYear, selectedMonth, 1);
      const monthEnd = new Date(selectedYear, selectedMonth + 1, 0);
      
      if (startDate > monthEnd) continue;
      if (endDate && endDate < monthStart) continue;

      const instance = instances.find(i => i.recurrenceId === rec.id);
      const amount = instance?.amount ?? rec.amount;

      if (rec.subcategoryId) {
        bySubcategory[rec.subcategoryId] = (bySubcategory[rec.subcategoryId] || 0) + amount;
      } else if (rec.categoryId) {
        byCategory[rec.categoryId] = (byCategory[rec.categoryId] || 0) + amount;
      }
    }

    return { byCategory, bySubcategory };
  }, [recurrences, instances, selectedMonth, selectedYear]);

  const totalToApply = useMemo(() => {
    return Object.values(recurrenceAmounts.byCategory).reduce((a, b) => a + b, 0) +
           Object.values(recurrenceAmounts.bySubcategory).reduce((a, b) => a + b, 0);
  }, [recurrenceAmounts]);

  const handleApply = () => {
    const amounts: Record<string, number> = {};
    
    // Add category amounts (for categories without subcategories)
    Object.entries(recurrenceAmounts.byCategory).forEach(([catId, amount]) => {
      amounts[`cat_${catId}`] = amount;
    });
    
    // Add subcategory amounts
    Object.entries(recurrenceAmounts.bySubcategory).forEach(([subId, amount]) => {
      amounts[`sub_${subId}`] = amount;
    });

    onApply(mode, amounts);
    onClose();
  };

  const categorySummary = useMemo(() => {
    const summary: Array<{ name: string; amount: number; isSubcategory: boolean }> = [];

    Object.entries(recurrenceAmounts.byCategory).forEach(([catId, amount]) => {
      const cat = categories.find(c => c.id === catId);
      if (cat) {
        summary.push({ name: `${cat.icon || ''} ${cat.name}`, amount, isSubcategory: false });
      }
    });

    Object.entries(recurrenceAmounts.bySubcategory).forEach(([subId, amount]) => {
      const sub = subcategories.find(s => s.id === subId);
      if (sub) {
        const cat = categories.find(c => c.id === sub.categoryId);
        summary.push({ 
          name: `${cat?.icon || ''} ${cat?.name} → ${sub.name}`, 
          amount, 
          isSubcategory: true 
        });
      }
    });

    return summary;
  }, [recurrenceAmounts, categories, subcategories]);

  if (totalToApply === 0) {
    return (
      <Dialog open={isOpen} onOpenChange={onClose}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Aplicar Recorrências ao Orçamento</DialogTitle>
            <DialogDescription>
              Não há recorrências de despesa ativas para aplicar neste mês.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={onClose}>Fechar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    );
  }

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Aplicar Recorrências ao Orçamento</DialogTitle>
          <DialogDescription>
            Escolha como deseja aplicar os valores das recorrências ao orçamento planejado.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          {/* Summary of what will be applied */}
          <div className="rounded-lg border border-border p-3 space-y-2">
            <div className="text-sm font-medium">Valores a aplicar:</div>
            <div className="space-y-1 max-h-40 overflow-y-auto">
              {categorySummary.map((item, idx) => (
                <div key={idx} className="flex justify-between text-sm">
                  <span className={item.isSubcategory ? 'text-muted-foreground' : ''}>
                    {item.name}
                  </span>
                  <span className="font-mono">{formatCurrency(item.amount)}</span>
                </div>
              ))}
            </div>
            <div className="flex justify-between text-sm font-semibold pt-2 border-t border-border">
              <span>Total</span>
              <span className="font-mono">{formatCurrency(totalToApply)}</span>
            </div>
          </div>

          {/* Mode selection */}
          <div className="space-y-3">
            <Label className="text-sm font-medium">Como aplicar?</Label>
            <RadioGroup value={mode} onValueChange={(v) => setMode(v as 'sum' | 'replace')}>
              <div className="flex items-center space-x-3 p-3 rounded-lg border border-border hover:bg-muted/50">
                <RadioGroupItem value="sum" id="sum" />
                <Label htmlFor="sum" className="flex-1 cursor-pointer">
                  <div className="flex items-center gap-2">
                    <Plus className="h-4 w-4 text-success" />
                    <span className="font-medium">Somar ao valor existente</span>
                  </div>
                  <p className="text-xs text-muted-foreground mt-1">
                    Os valores das recorrências serão adicionados aos valores já planejados.
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
                    Os valores planejados serão substituídos pelos valores das recorrências.
                  </p>
                </Label>
              </div>
            </RadioGroup>
          </div>
        </div>

        <DialogFooter className="gap-2 sm:gap-0">
          <Button variant="outline" onClick={onClose}>Cancelar</Button>
          <Button onClick={handleApply}>Aplicar ao Orçamento</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
