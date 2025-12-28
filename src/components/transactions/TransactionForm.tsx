import { useState, useEffect, useRef } from 'react';
import { useApp } from '@/contexts/AppContext';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import type { TransactionType } from '@/types/finance';
import { useToast } from '@/hooks/use-toast';
import { cn } from '@/lib/utils';

interface TransactionFormProps {
  isOpen: boolean;
  onClose: () => void;
}

export function TransactionForm({ isOpen, onClose }: TransactionFormProps) {
  const { categories, subcategories, addTransaction, lastUsedCategoryId } = useApp();
  const { toast } = useToast();
  const amountInputRef = useRef<HTMLInputElement>(null);
  
  const [type, setType] = useState<TransactionType>('despesa');
  const [amount, setAmount] = useState('');
  const [date, setDate] = useState(new Date().toISOString().split('T')[0]);
  const [categoryId, setCategoryId] = useState('');
  const [subcategoryId, setSubcategoryId] = useState('');
  const [description, setDescription] = useState('');
  const [needsReview, setNeedsReview] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Reset form completely when opened (only on open, not on subsequent saves)
  useEffect(() => {
    if (isOpen) {
      setType('despesa');
      setAmount('');
      setDate(new Date().toISOString().split('T')[0]);
      setCategoryId(lastUsedCategoryId || '');
      setSubcategoryId('');
      setDescription('');
      setNeedsReview(false);
    }
  }, [isOpen, lastUsedCategoryId]);

  const filteredSubcategories = subcategories.filter(s => s.categoryId === categoryId);

  // Reset only value/description fields after successful save (keep type, category, subcategory, date)
  const resetForNextEntry = () => {
    setAmount('');
    setDescription('');
    setNeedsReview(false);
    // Focus on amount field for next entry
    setTimeout(() => {
      amountInputRef.current?.focus();
    }, 100);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!amount || !categoryId) {
      toast({
        title: 'Campos obrigatórios',
        description: 'Preencha o valor e a categoria.',
        variant: 'destructive',
      });
      return;
    }

    const parsedAmount = parseFloat(amount.replace(',', '.'));
    if (isNaN(parsedAmount) || parsedAmount <= 0) {
      toast({
        title: 'Valor inválido',
        description: 'Digite um valor numérico positivo.',
        variant: 'destructive',
      });
      return;
    }

    setIsSubmitting(true);
    try {
      await addTransaction({
        date: new Date(date),
        amount: parsedAmount,
        type,
        categoryId,
        subcategoryId: subcategoryId || undefined,
        description: description || undefined,
        origin: 'manual',
        needsReview,
      });

      toast({
        title: 'Lançamento salvo',
        description: `${type === 'receita' ? 'Receita' : 'Despesa'} de R$ ${parsedAmount.toFixed(2)} adicionada.`,
      });

      // Reset only specific fields, keep modal open for next entry
      resetForNextEntry();
    } catch (error) {
      toast({
        title: 'Falha ao salvar',
        description: 'Tente novamente.',
        variant: 'destructive',
      });
      // Keep modal open and data intact on error
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle>Novo Lançamento</DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4 mt-2">
          {/* Type Toggle */}
          <div className="flex rounded-lg bg-muted p-1">
            <button
              type="button"
              onClick={() => setType('despesa')}
              className={cn(
                "flex-1 py-2 rounded-md text-sm font-medium transition-all",
                type === 'despesa' 
                  ? "bg-destructive text-destructive-foreground" 
                  : "text-muted-foreground hover:text-foreground"
              )}
            >
              Despesa
            </button>
            <button
              type="button"
              onClick={() => setType('receita')}
              className={cn(
                "flex-1 py-2 rounded-md text-sm font-medium transition-all",
                type === 'receita' 
                  ? "bg-success text-success-foreground" 
                  : "text-muted-foreground hover:text-foreground"
              )}
            >
              Receita
            </button>
          </div>

          {/* Amount */}
          <div className="space-y-2">
            <Label htmlFor="amount">Valor (R$)</Label>
            <Input
              ref={amountInputRef}
              id="amount"
              type="text"
              inputMode="decimal"
              placeholder="0,00"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              className="text-lg font-mono"
              autoFocus
            />
          </div>

          {/* Date */}
          <div className="space-y-2">
            <Label htmlFor="date">Data</Label>
            <Input
              id="date"
              type="date"
              value={date}
              onChange={(e) => setDate(e.target.value)}
            />
          </div>

          {/* Category */}
          <div className="space-y-2">
            <Label>Categoria</Label>
            <Select value={categoryId} onValueChange={(value) => {
              setCategoryId(value);
              setSubcategoryId('');
            }}>
              <SelectTrigger>
                <SelectValue placeholder="Selecione..." />
              </SelectTrigger>
              <SelectContent>
                {categories.map((cat) => (
                  <SelectItem key={cat.id} value={cat.id}>
                    {cat.icon} {cat.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Subcategory */}
          {filteredSubcategories.length > 0 && (
            <div className="space-y-2">
              <Label>Subcategoria (opcional)</Label>
              <Select value={subcategoryId} onValueChange={setSubcategoryId}>
                <SelectTrigger>
                  <SelectValue placeholder="Selecione..." />
                </SelectTrigger>
                <SelectContent>
                  {filteredSubcategories.map((sub) => (
                    <SelectItem key={sub.id} value={sub.id}>
                      {sub.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}

          {/* Description */}
          <div className="space-y-2">
            <Label htmlFor="description">Descrição (opcional)</Label>
            <Textarea
              id="description"
              placeholder="Ex: Almoço no restaurante"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={2}
            />
          </div>

          {/* Needs Review */}
          <div className="flex items-center justify-between">
            <Label htmlFor="needsReview" className="text-sm">
              Marcar para revisar
            </Label>
            <Switch
              id="needsReview"
              checked={needsReview}
              onCheckedChange={setNeedsReview}
            />
          </div>

          {/* Submit */}
          <Button 
            type="submit" 
            className="w-full"
            disabled={isSubmitting}
          >
            {isSubmitting ? 'Salvando...' : 'Salvar Lançamento'}
          </Button>
        </form>
      </DialogContent>
    </Dialog>
  );
}
