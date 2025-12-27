import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Plus, X } from 'lucide-react';
import { formatCurrency, formatMonthYearShort } from '@/lib/formatters';
import { v4 as uuid } from 'uuid';
import type { ScenarioOneTimeCost, Category, Subcategory } from '@/types/finance';

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
  referenceYear,
}: ScenarioOneTimeCostFormProps) {
  const [isAdding, setIsAdding] = useState(false);
  const [name, setName] = useState('');
  const [amount, setAmount] = useState('');
  const [categoryId, setCategoryId] = useState('');
  const [subcategoryId, setSubcategoryId] = useState('');
  const [impactMonth, setImpactMonth] = useState(referenceMonth);
  const [impactYear, setImpactYear] = useState(referenceYear);

  // Get all expense categories
  const expenseCategories = categories.filter(c => c.type === 'despesa');
  
  // Get subcategories for selected category
  const categorySubcategories = subcategories.filter(s => s.categoryId === categoryId);

  const handleAdd = () => {
    if (!name.trim() || !amount || !categoryId) return;

    const newCost: ScenarioOneTimeCost = {
      id: uuid(),
      name: name.trim(),
      amount: parseFloat(amount.replace(',', '.')) || 0,
      categoryId,
      subcategoryId: subcategoryId || undefined,
      impactMonth,
      impactYear,
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

  const getCategory = (id: string) => categories.find(c => c.id === id);
  const getSubcategory = (id: string) => subcategories.find(s => s.id === id);

  const currentYear = new Date().getFullYear();
  const years = [currentYear - 1, currentYear, currentYear + 1, currentYear + 2];

  return (
    <div className="space-y-3">
      {costs.map((cost) => {
        const cat = getCategory(cost.categoryId);
        const sub = cost.subcategoryId ? getSubcategory(cost.subcategoryId) : null;
        
        return (
          <div key={cost.id} className="flex items-center justify-between p-3 bg-muted/50 rounded-lg">
            <div>
              <div className="flex items-center gap-2">
                <span className="font-medium">{cost.name}</span>
                <span className="text-xs text-muted-foreground">
                  {formatMonthYearShort(cost.impactMonth, cost.impactYear)}
                </span>
              </div>
              <div className="text-xs text-muted-foreground">
                {cat?.icon} {cat?.name}
                {sub && ` → ${sub.name}`}
              </div>
            </div>
            <div className="flex items-center gap-3">
              <span className="font-mono font-medium text-destructive">
                -{formatCurrency(cost.amount)}
              </span>
              <Button size="icon" variant="ghost" onClick={() => handleRemove(cost.id)}>
                <X className="h-4 w-4" />
              </Button>
            </div>
          </div>
        );
      })}

      {!isAdding ? (
        <Button variant="outline" className="w-full gap-2" onClick={() => setIsAdding(true)}>
          <Plus className="h-4 w-4" />
          Adicionar custo pontual
        </Button>
      ) : (
        <div className="p-4 border border-border rounded-lg space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="col-span-2 sm:col-span-1">
              <Label className="text-xs">Nome</Label>
              <Input
                placeholder="Ex: Entrada do carro"
                value={name}
                onChange={(e) => setName(e.target.value)}
              />
            </div>
            <div className="col-span-2 sm:col-span-1">
              <Label className="text-xs">Valor (R$)</Label>
              <Input
                type="text"
                inputMode="decimal"
                placeholder="0,00"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                className="font-mono"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label className="text-xs">Categoria</Label>
              <Select value={categoryId} onValueChange={(val) => {
                setCategoryId(val);
                setSubcategoryId('');
              }}>
                <SelectTrigger>
                  <SelectValue placeholder="Selecione" />
                </SelectTrigger>
                <SelectContent>
                  {expenseCategories.map(cat => (
                    <SelectItem key={cat.id} value={cat.id}>
                      {cat.icon} {cat.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label className="text-xs">Subcategoria</Label>
              <Select 
                value={subcategoryId} 
                onValueChange={setSubcategoryId}
                disabled={!categoryId || categorySubcategories.length === 0}
              >
                <SelectTrigger>
                  <SelectValue placeholder={categorySubcategories.length === 0 ? "(Sem subcategorias)" : "Opcional"} />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="">Nenhuma</SelectItem>
                  {categorySubcategories.map(sub => (
                    <SelectItem key={sub.id} value={sub.id}>{sub.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label className="text-xs">Mês de Impacto</Label>
              <Select value={impactMonth.toString()} onValueChange={(val) => setImpactMonth(parseInt(val))}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {MONTHS.map((month, index) => (
                    <SelectItem key={index} value={index.toString()}>{month}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label className="text-xs">Ano</Label>
              <Select value={impactYear.toString()} onValueChange={(val) => setImpactYear(parseInt(val))}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {years.map(year => (
                    <SelectItem key={year} value={year.toString()}>{year}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="flex justify-end gap-2">
            <Button variant="ghost" size="sm" onClick={resetForm}>Cancelar</Button>
            <Button size="sm" onClick={handleAdd} disabled={!name.trim() || !amount || !categoryId}>
              Adicionar
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
