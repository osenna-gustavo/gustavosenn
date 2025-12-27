import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Plus, X } from 'lucide-react';
import { ScenarioCommitment, Category, Subcategory } from '@/types/finance';
import { formatCurrency } from '@/lib/formatters';
import { v4 as uuid } from 'uuid';

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
  subcategories
}: ScenarioCommitmentFormProps) {
  const [isAdding, setIsAdding] = useState(false);
  const [name, setName] = useState('');
  const [amount, setAmount] = useState('');
  const [categoryId, setCategoryId] = useState('');
  const [subcategoryId, setSubcategoryId] = useState('');
  const [isFixed, setIsFixed] = useState(true);

  const expenseCategories = categories.filter(c => c.type === 'despesa');
  const filteredSubcategories = subcategories.filter(s => s.categoryId === categoryId);

  const handleAdd = () => {
    if (!name.trim() || !amount || !categoryId) return;

    const newCommitment: ScenarioCommitment = {
      id: uuid(),
      name: name.trim(),
      amount: parseFloat(amount),
      categoryId,
      subcategoryId: subcategoryId || undefined,
      isFixed
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

  const getCategoryName = (catId: string) => 
    categories.find(c => c.id === catId)?.name || 'Categoria';

  return (
    <div className="space-y-3">
      {commitments.length > 0 && (
        <div className="space-y-2">
          {commitments.map((commitment) => (
            <div
              key={commitment.id}
              className="flex items-center justify-between p-3 rounded-lg bg-muted/50 border"
            >
              <div>
                <p className="font-medium text-foreground">{commitment.name}</p>
                <p className="text-sm text-muted-foreground">
                  {formatCurrency(commitment.amount)} • {getCategoryName(commitment.categoryId)}
                  {commitment.isFixed ? ' • Fixo' : ' • Variável'}
                </p>
              </div>
              <Button
                variant="ghost"
                size="icon"
                onClick={() => handleRemove(commitment.id)}
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
                placeholder="Ex: Financiamento"
              />
            </div>
            <div className="space-y-2">
              <Label>Valor Mensal (R$)</Label>
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

          <div className="flex items-center gap-2">
            <Switch checked={isFixed} onCheckedChange={setIsFixed} />
            <Label>Despesa fixa</Label>
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
          Adicionar Compromisso Mensal
        </Button>
      )}
    </div>
  );
}
