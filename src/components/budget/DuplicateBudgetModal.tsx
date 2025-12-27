import { useState } from 'react';
import { useApp } from '@/contexts/AppContext';
import { formatMonthYear } from '@/lib/formatters';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { useToast } from '@/hooks/use-toast';
import { Copy, Percent } from 'lucide-react';
import * as db from '@/lib/database';
import type { Budget, CategoryBudget } from '@/types/finance';

interface DuplicateBudgetModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
}

type AdjustmentType = 'all' | 'fixed' | 'variable' | 'selected';

export function DuplicateBudgetModal({ isOpen, onClose, onSuccess }: DuplicateBudgetModalProps) {
  const { selectedMonth, selectedYear, categories } = useApp();
  const { toast } = useToast();

  // Step 1: Selection
  const [step, setStep] = useState<1 | 2>(1);
  
  // Source month (default: previous month)
  const prevMonth = selectedMonth === 0 ? 11 : selectedMonth - 1;
  const prevYear = selectedMonth === 0 ? selectedYear - 1 : selectedYear;
  const [sourceMonth, setSourceMonth] = useState(prevMonth);
  const [sourceYear, setSourceYear] = useState(prevYear);
  
  // What to copy
  const [copyTotals, setCopyTotals] = useState(true);
  const [copyCategoryBudgets, setCopyCategoryBudgets] = useState(true);
  const [copyFixedFlags, setCopyFixedFlags] = useState(true);
  
  // Mass adjustment
  const [adjustmentPercent, setAdjustmentPercent] = useState('0');
  const [adjustmentType, setAdjustmentType] = useState<AdjustmentType>('all');
  const [selectedCategories, setSelectedCategories] = useState<string[]>([]);
  
  const [isLoading, setIsLoading] = useState(false);

  const months = [
    { value: 0, label: 'Janeiro' },
    { value: 1, label: 'Fevereiro' },
    { value: 2, label: 'Março' },
    { value: 3, label: 'Abril' },
    { value: 4, label: 'Maio' },
    { value: 5, label: 'Junho' },
    { value: 6, label: 'Julho' },
    { value: 7, label: 'Agosto' },
    { value: 8, label: 'Setembro' },
    { value: 9, label: 'Outubro' },
    { value: 10, label: 'Novembro' },
    { value: 11, label: 'Dezembro' },
  ];

  const years = Array.from({ length: 5 }, (_, i) => selectedYear - 2 + i);

  const handleDuplicate = async (withMassAdjust: boolean) => {
    if (withMassAdjust) {
      setStep(2);
      return;
    }
    await executeDuplication(0, 'all', []);
  };

  const executeDuplication = async (percent: number, type: AdjustmentType, selected: string[]) => {
    setIsLoading(true);
    try {
      const sourceBudget = await db.getBudget(sourceMonth, sourceYear);
      
      if (!sourceBudget) {
        toast({
          title: 'Orçamento não encontrado',
          description: `Não há orçamento em ${formatMonthYear(sourceMonth, sourceYear)}.`,
          variant: 'destructive',
        });
        setIsLoading(false);
        return;
      }

      // Apply adjustments to category budgets
      let newCategoryBudgets: CategoryBudget[] = [];
      
      if (copyCategoryBudgets) {
        newCategoryBudgets = sourceBudget.categoryBudgets.map(cb => {
          const category = categories.find(c => c.id === cb.categoryId);
          let shouldAdjust = false;

          switch (type) {
            case 'all':
              shouldAdjust = true;
              break;
            case 'fixed':
              shouldAdjust = category?.isFixed === true;
              break;
            case 'variable':
              shouldAdjust = category?.isFixed === false;
              break;
            case 'selected':
              shouldAdjust = selected.includes(cb.categoryId);
              break;
          }

          const multiplier = shouldAdjust ? (1 + percent / 100) : 1;
          return {
            ...cb,
            plannedAmount: Math.round(cb.plannedAmount * multiplier * 100) / 100,
          };
        });
      }

      // Calculate adjusted totals
      let newPlannedExpenses = sourceBudget.plannedExpenses;
      if (copyTotals && percent !== 0 && type === 'all') {
        newPlannedExpenses = Math.round(sourceBudget.plannedExpenses * (1 + percent / 100) * 100) / 100;
      } else if (copyCategoryBudgets && newCategoryBudgets.length > 0) {
        newPlannedExpenses = newCategoryBudgets.reduce((sum, cb) => sum + cb.plannedAmount, 0);
      }

      await db.saveBudget({
        month: selectedMonth,
        year: selectedYear,
        plannedIncome: copyTotals ? sourceBudget.plannedIncome : 0,
        plannedExpenses: newPlannedExpenses,
        categoryBudgets: newCategoryBudgets,
      });

      toast({
        title: 'Orçamento duplicado!',
        description: `Orçamento de ${formatMonthYear(sourceMonth, sourceYear)} copiado para ${formatMonthYear(selectedMonth, selectedYear)}.`,
      });
      
      onSuccess();
      onClose();
      setStep(1);
    } catch (error) {
      toast({
        title: 'Erro ao duplicar',
        description: 'Tente novamente.',
        variant: 'destructive',
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleMassAdjust = () => {
    const percent = parseFloat(adjustmentPercent.replace(',', '.')) || 0;
    executeDuplication(percent, adjustmentType, selectedCategories);
  };

  const toggleCategory = (categoryId: string) => {
    setSelectedCategories(prev => 
      prev.includes(categoryId) 
        ? prev.filter(id => id !== categoryId)
        : [...prev, categoryId]
    );
  };

  const handleClose = () => {
    setStep(1);
    onClose();
  };

  return (
    <Dialog open={isOpen} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Copy className="h-5 w-5" />
            {step === 1 ? 'Duplicar Orçamento' : 'Ajuste em Massa'}
          </DialogTitle>
          <DialogDescription>
            {step === 1 
              ? 'Copie o orçamento de um mês anterior para o mês atual.'
              : 'Aplique ajustes percentuais aos valores do orçamento.'
            }
          </DialogDescription>
        </DialogHeader>

        {step === 1 ? (
          <div className="space-y-6 mt-4">
            {/* Source Month */}
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Mês Origem</Label>
                <Select 
                  value={sourceMonth.toString()} 
                  onValueChange={(v) => setSourceMonth(parseInt(v))}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {months.map(m => (
                      <SelectItem key={m.value} value={m.value.toString()}>
                        {m.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Ano Origem</Label>
                <Select 
                  value={sourceYear.toString()} 
                  onValueChange={(v) => setSourceYear(parseInt(v))}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {years.map(y => (
                      <SelectItem key={y} value={y.toString()}>
                        {y}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            {/* Destination */}
            <div className="p-3 rounded-lg bg-muted">
              <p className="text-sm text-muted-foreground">Destino</p>
              <p className="font-medium">{formatMonthYear(selectedMonth, selectedYear)}</p>
            </div>

            {/* What to copy */}
            <div className="space-y-3">
              <Label>O que copiar:</Label>
              <div className="space-y-2">
                <div className="flex items-center gap-2">
                  <Checkbox 
                    id="copyTotals" 
                    checked={copyTotals} 
                    onCheckedChange={(c) => setCopyTotals(!!c)} 
                  />
                  <Label htmlFor="copyTotals" className="font-normal cursor-pointer">
                    Totais planejados (receitas e despesas)
                  </Label>
                </div>
                <div className="flex items-center gap-2">
                  <Checkbox 
                    id="copyCategoryBudgets" 
                    checked={copyCategoryBudgets} 
                    onCheckedChange={(c) => setCopyCategoryBudgets(!!c)} 
                  />
                  <Label htmlFor="copyCategoryBudgets" className="font-normal cursor-pointer">
                    Orçamento por categoria/subcategoria
                  </Label>
                </div>
                <div className="flex items-center gap-2">
                  <Checkbox 
                    id="copyFixedFlags" 
                    checked={copyFixedFlags} 
                    onCheckedChange={(c) => setCopyFixedFlags(!!c)} 
                  />
                  <Label htmlFor="copyFixedFlags" className="font-normal cursor-pointer">
                    Flags de fixo/variável
                  </Label>
                </div>
              </div>
            </div>

            {/* Actions */}
            <div className="flex gap-3">
              <Button variant="outline" onClick={handleClose} className="flex-1">
                Cancelar
              </Button>
              <Button 
                variant="secondary" 
                onClick={() => handleDuplicate(true)} 
                disabled={isLoading}
                className="flex-1 gap-2"
              >
                <Percent className="h-4 w-4" />
                Ajustar em Massa
              </Button>
              <Button 
                onClick={() => handleDuplicate(false)} 
                disabled={isLoading}
                className="flex-1"
              >
                Duplicar
              </Button>
            </div>
          </div>
        ) : (
          <div className="space-y-6 mt-4">
            {/* Percentage */}
            <div className="space-y-2">
              <Label>Ajuste Percentual</Label>
              <div className="flex items-center gap-2">
                <Input
                  type="text"
                  value={adjustmentPercent}
                  onChange={(e) => setAdjustmentPercent(e.target.value)}
                  placeholder="0"
                  className="w-24 font-mono"
                />
                <span className="text-muted-foreground">%</span>
                <span className="text-sm text-muted-foreground ml-2">
                  (use valores negativos para reduzir)
                </span>
              </div>
            </div>

            {/* Adjustment Type */}
            <div className="space-y-3">
              <Label>Aplicar em:</Label>
              <RadioGroup 
                value={adjustmentType} 
                onValueChange={(v) => setAdjustmentType(v as AdjustmentType)}
              >
                <div className="flex items-center space-x-2">
                  <RadioGroupItem value="all" id="all" />
                  <Label htmlFor="all" className="font-normal cursor-pointer">
                    Todas as categorias
                  </Label>
                </div>
                <div className="flex items-center space-x-2">
                  <RadioGroupItem value="fixed" id="fixed" />
                  <Label htmlFor="fixed" className="font-normal cursor-pointer">
                    Apenas custos fixos
                  </Label>
                </div>
                <div className="flex items-center space-x-2">
                  <RadioGroupItem value="variable" id="variable" />
                  <Label htmlFor="variable" className="font-normal cursor-pointer">
                    Apenas custos variáveis
                  </Label>
                </div>
                <div className="flex items-center space-x-2">
                  <RadioGroupItem value="selected" id="selected" />
                  <Label htmlFor="selected" className="font-normal cursor-pointer">
                    Categorias selecionadas
                  </Label>
                </div>
              </RadioGroup>
            </div>

            {/* Category Selection */}
            {adjustmentType === 'selected' && (
              <div className="space-y-2 max-h-48 overflow-y-auto border rounded-lg p-3">
                {categories.map(cat => (
                  <div key={cat.id} className="flex items-center gap-2">
                    <Checkbox
                      id={`cat-${cat.id}`}
                      checked={selectedCategories.includes(cat.id)}
                      onCheckedChange={() => toggleCategory(cat.id)}
                    />
                    <Label 
                      htmlFor={`cat-${cat.id}`} 
                      className="font-normal cursor-pointer flex items-center gap-2"
                    >
                      <span>{cat.icon}</span>
                      <span>{cat.name}</span>
                      {cat.isFixed && (
                        <span className="text-[10px] uppercase px-1.5 py-0.5 rounded bg-muted text-muted-foreground">
                          Fixo
                        </span>
                      )}
                    </Label>
                  </div>
                ))}
              </div>
            )}

            {/* Actions */}
            <div className="flex gap-3">
              <Button variant="outline" onClick={() => setStep(1)} className="flex-1">
                Voltar
              </Button>
              <Button onClick={handleMassAdjust} disabled={isLoading} className="flex-1">
                {isLoading ? 'Aplicando...' : 'Aplicar e Duplicar'}
              </Button>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
