import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Plus, X } from 'lucide-react';
import { ScenarioOneTimeCost, Category, Subcategory } from '@/types/finance';
import { formatCurrency } from '@/lib/formatters';
import { v4 as uuid } from 'uuid';

const MONTHS = [
  'Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho',
  'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro'
];

interface ScenarioOneTimeCostFormProps {
  costs: ScenarioOneTimeCost[];
  onChange: (costs: ScenarioOneTimeCost[]) => void;
  categories: Category[];
  subcategories: Subcategory[];
  referenceMonth: number;
  referenceYear: number;
}

export function ScenarioOneTimeCostForm({
  costs,
  onChange,
  categories,
  subcategories,
  referenceMonth,
  referenceYear
}: ScenarioOneTimeCostFormProps) {
  const [isAdding, setIsAdding] = useState(false);
  const [name, setName] = useState('');
  const [amount, setAmount] = useState('');
  const [categoryId, setCategoryId] = useState('');
  const [subcategoryId, setSubcategoryId] = useState('');
  const [impactMonth, setImpactMonth] = useState(referenceMonth);
  const [impactYear, setImpactYear] = useState(referenceYear);

  const expenseCategories = categories.filter(c => c.type === 'despesa');
  const filteredSubcategories = subcategories.filter(s => s.categoryId === categoryId);
  const years = [referenceYear - 1, referenceYear, referenceYear + 1];

  const handleAdd = () => {
    if (!name.trim() || !amount || !categoryId) return;

    const newCost: ScenarioOneTimeCost = {
      id: uuid(),
      name: name.trim(),
      amount: parseFloat(amount),
      categoryId,
      subcategoryId: subcategoryId || undefined,
      impactMonth,
      impactYear
    };

    onChange([...costs, newCost]);
    resetForm();
  };

  const handleRemove = (id: string) => {
    onChange(costs.filter(c => c.id !== id));
  };

  const resetForm = () => {
    setName('');
    setAmount('');
    setCategoryId('');
    setSubcategoryId('');
    setImpactMonth(referenceMonth);
    setImpactYear(referenceYear);
    setIsAdding(false);
  };

  const getCategoryName = (catId: string) => 
    categories.find(c => c.id === catId)?.name || 'Categoria';

  return (
    <div className="space-y-3">
      {costs.length > 0 && (
        <div className="space-y-2">
          {costs.map((cost) => (
            <div
              key={cost.id}
              className="flex items-center justify-between p-3 rounded-lg bg-muted/50 border"
            >
              <div>
                <p className="font-medium text-foreground">{cost.name}</p>
                <p className="text-sm text-muted-foreground">
                  {formatCurrency(cost.amount)} • {getCategoryName(cost.categoryId)}
                  {' • '}{MONTHS[cost.impactMonth]}/{cost.impactYear}
                </p>
              </div>
              <Button
                variant="ghost"
                size="icon"
                onClick={() => handleRemove(cost.id)}
              >
                <X className="h-4 w-4" />
              </Button>
            </div>
          ))}
        </div>
      )}

      {isAdding ? (
        <div className="p-4 rounded-lg border bg-card space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Nome</Label>
              <Input
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Ex: Entrada do carro"
              />
            </div>
            <div className="space-y-2">
              <Label>Valor (R$)</Label>
              <Input
                type="number"
                min="0"
                step="0.01"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                placeholder="0,00"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Categoria</Label>
              <Select value={categoryId} onValueChange={(v) => {
                setCategoryId(v);
                setSubcategoryId('');
              }}>
                <SelectTrigger>
                  <SelectValue placeholder="Selecione" />
                </SelectTrigger>
                <SelectContent>
                  {expenseCategories.map(cat => (
                    <SelectItem key={cat.id} value={cat.id}>
                      {cat.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Subcategoria (opcional)</Label>
              <Select 
                value={subcategoryId} 
                onValueChange={setSubcategoryId}
                disabled={!categoryId || filteredSubcategories.length === 0}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Selecione" />
                </SelectTrigger>
                <SelectContent>
                  {filteredSubcategories.map(sub => (
                    <SelectItem key={sub.id} value={sub.id}>
                      {sub.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Mês de Impacto</Label>
              <Select 
                value={impactMonth.toString()} 
                onValueChange={(v) => setImpactMonth(parseInt(v))}
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
                value={impactYear.toString()} 
                onValueChange={(v) => setImpactYear(parseInt(v))}
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

          <div className="flex justify-end gap-2">
            <Button variant="outline" size="sm" onClick={resetForm}>
              Cancelar
            </Button>
            <Button 
              size="sm" 
              onClick={handleAdd}
              disabled={!name.trim() || !amount || !categoryId}
            >
              Adicionar
            </Button>
          </div>
        </div>
      ) : (
        <Button
          variant="outline"
          size="sm"
          className="w-full gap-2"
          onClick={() => setIsAdding(true)}
        >
          <Plus className="h-4 w-4" />
          Adicionar Custo Pontual
        </Button>
      )}
    </div>
  );
}
