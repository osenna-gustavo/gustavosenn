import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { Plus, X } from 'lucide-react';
import { formatCurrency } from '@/lib/formatters';
import { v4 as uuid } from 'uuid';
import type { ScenarioCommitment, Category, Subcategory } from '@/types/finance';

interface ScenarioCommitmentFormProps {
  commitments: ScenarioCommitment[];
  onChange: (commitments: ScenarioCommitment[]) => void;
  categories: Category[];
  subcategories: Subcategory[];
}

export function ScenarioCommitmentForm({
  commitments,
  onChange,
  categories,
  subcategories,
}: ScenarioCommitmentFormProps) {
  const [isAdding, setIsAdding] = useState(false);
  const [name, setName] = useState('');
  const [amount, setAmount] = useState('');
  const [categoryId, setCategoryId] = useState('');
  const [subcategoryId, setSubcategoryId] = useState('');
  const [isFixed, setIsFixed] = useState(true);

  // Get all expense categories
  const expenseCategories = categories.filter(c => c.type === 'despesa');
  
  // Get subcategories for selected category
  const categorySubcategories = subcategories.filter(s => s.categoryId === categoryId);

  const handleAdd = () => {
    if (!name.trim() || !amount || !categoryId) return;

    const newCommitment: ScenarioCommitment = {
      id: uuid(),
      name: name.trim(),
      amount: parseFloat(amount.replace(',', '.')) || 0,
      categoryId,
      subcategoryId: subcategoryId || undefined,
      isFixed,
    };

    onChange([...commitments, newCommitment]);
    resetForm();
  };

  const handleRemove = (id: string) => {
    onChange(commitments.filter(c => c.id !== id));
  };

  const resetForm = () => {
    setName('');
    setAmount('');
    setCategoryId('');
    setSubcategoryId('');
    setIsFixed(true);
    setIsAdding(false);
  };

  const getCategory = (id: string) => categories.find(c => c.id === id);
  const getSubcategory = (id: string) => subcategories.find(s => s.id === id);

  return (
    <div className="space-y-3">
      {commitments.map((commitment) => {
        const cat = getCategory(commitment.categoryId);
        const sub = commitment.subcategoryId ? getSubcategory(commitment.subcategoryId) : null;
        
        return (
          <div key={commitment.id} className="flex items-center justify-between p-3 bg-muted/50 rounded-lg">
            <div>
              <div className="flex items-center gap-2">
                <span className="font-medium">{commitment.name}</span>
                {commitment.isFixed && (
                  <span className="text-[10px] uppercase px-1.5 py-0.5 rounded bg-primary/10 text-primary">
                    Fixo
                  </span>
                )}
              </div>
              <div className="text-xs text-muted-foreground">
                {cat?.icon} {cat?.name}
                {sub && ` → ${sub.name}`}
              </div>
            </div>
            <div className="flex items-center gap-3">
              <span className="font-mono font-medium text-destructive">
                -{formatCurrency(commitment.amount)}
              </span>
              <Button size="icon" variant="ghost" onClick={() => handleRemove(commitment.id)}>
                <X className="h-4 w-4" />
              </Button>
            </div>
          </div>
        );
      })}

      {!isAdding ? (
        <Button variant="outline" className="w-full gap-2" onClick={() => setIsAdding(true)}>
          <Plus className="h-4 w-4" />
          Adicionar compromisso
        </Button>
      ) : (
        <div className="p-4 border border-border rounded-lg space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="col-span-2 sm:col-span-1">
              <Label className="text-xs">Nome</Label>
              <Input
                placeholder="Ex: Financiamento carro"
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
                value={subcategoryId || "__none__"} 
                onValueChange={(val) => setSubcategoryId(val === "__none__" ? "" : val)}
                disabled={!categoryId || categorySubcategories.length === 0}
              >
                <SelectTrigger>
                  <SelectValue placeholder={categorySubcategories.length === 0 ? "(Sem subcategorias)" : "Opcional"} />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="__none__">Nenhuma</SelectItem>
                  {categorySubcategories.map(sub => (
                    <SelectItem key={sub.id} value={sub.id}>{sub.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Switch checked={isFixed} onCheckedChange={setIsFixed} />
              <Label className="text-sm">Despesa Fixa</Label>
            </div>
            <div className="flex gap-2">
              <Button variant="ghost" size="sm" onClick={resetForm}>Cancelar</Button>
              <Button size="sm" onClick={handleAdd} disabled={!name.trim() || !amount || !categoryId}>
                Adicionar
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
