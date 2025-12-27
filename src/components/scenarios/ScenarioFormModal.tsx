import { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Scenario } from '@/types/finance';

const MONTHS = [
  'Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho',
  'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro'
];

interface ScenarioFormModalProps {
  open: boolean;
  onClose: () => void;
  onSave: (data: Omit<Scenario, 'id' | 'createdAt'>) => void;
  scenario?: Scenario | null;
  selectedMonth: number;
  selectedYear: number;
}

export function ScenarioFormModal({
  open,
  onClose,
  onSave,
  scenario,
  selectedMonth,
  selectedYear
}: ScenarioFormModalProps) {
  const [name, setName] = useState(scenario?.name || '');
  const [baselineType, setBaselineType] = useState<'planned' | 'realized' | 'average'>(
    scenario?.baselineType || 'planned'
  );
  const [baselineMonth, setBaselineMonth] = useState(scenario?.baselineMonth ?? selectedMonth);
  const [baselineYear, setBaselineYear] = useState(scenario?.baselineYear ?? selectedYear);
  const [minimumBalance, setMinimumBalance] = useState(scenario?.minimumBalance?.toString() || '0');

  useEffect(() => {
    if (open) {
      setName(scenario?.name || '');
      setBaselineType(scenario?.baselineType || 'planned');
      setBaselineMonth(scenario?.baselineMonth ?? selectedMonth);
      setBaselineYear(scenario?.baselineYear ?? selectedYear);
      setMinimumBalance(scenario?.minimumBalance?.toString() || '0');
    }
  }, [open, scenario, selectedMonth, selectedYear]);

  const handleSave = () => {
    if (!name.trim()) return;
    
    onSave({
      name: name.trim(),
      baselineType,
      baselineMonth,
      baselineYear,
      minimumBalance: parseFloat(minimumBalance) || 0,
      monthlyCommitments: scenario?.monthlyCommitments || [],
      oneTimeCosts: scenario?.oneTimeCosts || [],
      categoryAdjustments: scenario?.categoryAdjustments || [],
    });
  };

  const years = [selectedYear - 1, selectedYear, selectedYear + 1];

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle>
            {scenario ? 'Editar Cenário' : 'Novo Cenário'}
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-6 py-4">
          <div className="space-y-2">
            <Label htmlFor="name">Nome do Cenário</Label>
            <Input
              id="name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Ex: Trocar de carro"
            />
          </div>

          <div className="space-y-3">
            <Label>Baseline (base de cálculo)</Label>
            <RadioGroup
              value={baselineType}
              onValueChange={(v) => setBaselineType(v as typeof baselineType)}
            >
              <div className="flex items-center space-x-2">
                <RadioGroupItem value="planned" id="planned" />
                <Label htmlFor="planned" className="font-normal">
                  Orçamento planejado do mês
                </Label>
              </div>
              <div className="flex items-center space-x-2">
                <RadioGroupItem value="realized" id="realized" />
                <Label htmlFor="realized" className="font-normal">
                  Realizado do mês
                </Label>
              </div>
              <div className="flex items-center space-x-2">
                <RadioGroupItem value="average" id="average" />
                <Label htmlFor="average" className="font-normal">
                  Média dos últimos 3 meses (realizado)
                </Label>
              </div>
            </RadioGroup>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Mês de Referência</Label>
              <Select
                value={baselineMonth.toString()}
                onValueChange={(v) => setBaselineMonth(parseInt(v))}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {MONTHS.map((m, i) => (
                    <SelectItem key={i} value={i.toString()}>
                      {m}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Ano</Label>
              <Select
                value={baselineYear.toString()}
                onValueChange={(v) => setBaselineYear(parseInt(v))}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {years.map((y) => (
                    <SelectItem key={y} value={y.toString()}>
                      {y}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="minimumBalance">Meta de Saldo Mínimo (R$)</Label>
            <Input
              id="minimumBalance"
              type="number"
              min="0"
              step="0.01"
              value={minimumBalance}
              onChange={(e) => setMinimumBalance(e.target.value)}
              placeholder="0,00"
            />
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            Cancelar
          </Button>
          <Button onClick={handleSave} disabled={!name.trim()}>
            {scenario ? 'Salvar' : 'Criar Cenário'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
