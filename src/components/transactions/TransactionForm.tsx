import { useEffect, useRef, useState } from 'react';
import { ChevronDown } from 'lucide-react';
import { useApp } from '@/contexts/AppContext';
import { Button } from '@/components/ui/button';
import { CurrencyInput } from '@/components/ui/currency-input';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import type { TransactionType } from '@/types/finance';
import { useToast } from '@/hooks/use-toast';
import { cn } from '@/lib/utils';
import { parseBRLToNumber } from '@/lib/currencyInput';

interface TransactionFormProps {
  isOpen: boolean;
  onClose: () => void;
}

function getTodayForInput() {
  const today = new Date();
  const year = today.getFullYear();
  const month = String(today.getMonth() + 1).padStart(2, '0');
  const day = String(today.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

export function TransactionForm({ isOpen, onClose }: TransactionFormProps) {
  const { categories, subcategories, addTransaction, lastUsedCategoryId } = useApp();
  const { toast } = useToast();
  const amountInputRef = useRef<HTMLInputElement>(null);

  const [type, setType] = useState<TransactionType>('despesa');
  const [amount, setAmount] = useState('');
  const [date, setDate] = useState(getTodayForInput);
  const [categoryId, setCategoryId] = useState('');
  const [subcategoryId, setSubcategoryId] = useState('');
  const [description, setDescription] = useState('');
  const [needsReview, setNeedsReview] = useState(false);
  const [showDetails, setShowDetails] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    if (!isOpen) return;

    const lastCategory = categories.find(category => category.id === lastUsedCategoryId);
    setType('despesa');
    setAmount('');
    setDate(getTodayForInput());
    setCategoryId(lastCategory?.type === 'despesa' ? lastCategory.id : '');
    setSubcategoryId('');
    setDescription('');
    setNeedsReview(false);
    setShowDetails(false);
  }, [isOpen, lastUsedCategoryId, categories]);

  const availableCategories = categories.filter(category => category.type === type);
  const filteredSubcategories = subcategories.filter(subcategory => subcategory.categoryId === categoryId);

  const selectType = (nextType: TransactionType) => {
    if (nextType === type) return;
    setType(nextType);
    setCategoryId('');
    setSubcategoryId('');
  };

  const resetForNextEntry = () => {
    setAmount('');
    setDescription('');
    setNeedsReview(false);
    setTimeout(() => amountInputRef.current?.focus(), 100);
  };

  const saveTransaction = async (closeAfterSave: boolean) => {
    const parsedAmount = parseBRLToNumber(amount);
    if (parsedAmount <= 0 || !categoryId) {
      toast({
        title: 'Falta pouca coisa',
        description: 'Informe o valor e escolha uma categoria.',
        variant: 'destructive',
      });
      return;
    }

    setIsSubmitting(true);
    try {
      await addTransaction({
        date: new Date(`${date}T12:00:00`),
        amount: parsedAmount,
        type,
        categoryId,
        subcategoryId: subcategoryId || undefined,
        description: description.trim() || undefined,
        origin: 'manual',
        needsReview,
      });

      toast({
        title: 'Lançamento salvo',
        description: `${type === 'receita' ? 'Receita' : 'Despesa'} adicionada ao ciclo.`,
      });

      if (closeAfterSave) onClose();
      else resetForNextEntry();
    } catch {
      toast({
        title: 'Falha ao salvar',
        description: 'Tente novamente.',
        variant: 'destructive',
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-[440px]">
        <DialogHeader>
          <DialogTitle>Novo lançamento</DialogTitle>
        </DialogHeader>

        <form
          onSubmit={event => {
            event.preventDefault();
            void saveTransaction(true);
          }}
          className="space-y-4 mt-2"
        >
          <div className="flex rounded-lg bg-muted p-1">
            <button
              type="button"
              onClick={() => selectType('despesa')}
              className={cn(
                'flex-1 py-2 rounded-md text-sm font-medium transition-all',
                type === 'despesa' ? 'bg-destructive text-destructive-foreground' : 'text-muted-foreground hover:text-foreground',
              )}
            >
              Despesa
            </button>
            <button
              type="button"
              onClick={() => selectType('receita')}
              className={cn(
                'flex-1 py-2 rounded-md text-sm font-medium transition-all',
                type === 'receita' ? 'bg-success text-success-foreground' : 'text-muted-foreground hover:text-foreground',
              )}
            >
              Receita
            </button>
          </div>

          <div className="space-y-2">
            <Label htmlFor="amount">Valor</Label>
            <CurrencyInput
              ref={amountInputRef}
              id="amount"
              value={amount}
              onChange={setAmount}
              className="text-xl font-mono"
              autoFocus
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="description">Descrição</Label>
            <Input
              id="description"
              placeholder="Ex.: mercado, gasolina, salário"
              value={description}
              onChange={event => setDescription(event.target.value)}
            />
          </div>

          <div className="space-y-2">
            <Label>Categoria</Label>
            <Select
              value={categoryId}
              onValueChange={value => {
                setCategoryId(value);
                setSubcategoryId('');
              }}
            >
              <SelectTrigger>
                <SelectValue placeholder="Escolha a categoria" />
              </SelectTrigger>
              <SelectContent>
                {availableCategories.map(category => (
                  <SelectItem key={category.id} value={category.id}>
                    {category.icon} {category.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {filteredSubcategories.length > 0 && (
            <div className="space-y-2">
              <Label>Subcategoria <span className="text-muted-foreground font-normal">(opcional)</span></Label>
              <Select value={subcategoryId || '__none__'} onValueChange={value => setSubcategoryId(value === '__none__' ? '' : value)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="__none__">Sem subcategoria</SelectItem>
                  {filteredSubcategories.map(subcategory => (
                    <SelectItem key={subcategory.id} value={subcategory.id}>{subcategory.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}

          <Collapsible open={showDetails} onOpenChange={setShowDetails}>
            <CollapsibleTrigger asChild>
              <button type="button" className="flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground">
                <ChevronDown className={cn('h-4 w-4 transition-transform', showDetails && 'rotate-180')} />
                Data e opções
              </button>
            </CollapsibleTrigger>
            <CollapsibleContent className="space-y-4 pt-3">
              <div className="space-y-2">
                <Label htmlFor="date">Data</Label>
                <Input id="date" type="date" value={date} onChange={event => setDate(event.target.value)} />
              </div>
              <div className="flex items-center justify-between rounded-lg border border-border p-3">
                <Label htmlFor="needsReview" className="text-sm">Marcar para revisar depois</Label>
                <Switch id="needsReview" checked={needsReview} onCheckedChange={setNeedsReview} />
              </div>
            </CollapsibleContent>
          </Collapsible>

          <div className="flex gap-2 pt-1">
            <Button
              type="button"
              variant="outline"
              className="flex-1"
              disabled={isSubmitting}
              onClick={() => void saveTransaction(false)}
            >
              Salvar e continuar
            </Button>
            <Button type="submit" className="flex-1" disabled={isSubmitting}>
              {isSubmitting ? 'Salvando...' : 'Salvar'}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
