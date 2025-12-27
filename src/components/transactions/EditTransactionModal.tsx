import { useState, useEffect } from 'react';
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
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import type { Transaction, TransactionType } from '@/types/finance';
import { useToast } from '@/hooks/use-toast';
import { cn } from '@/lib/utils';
import { Trash2 } from 'lucide-react';

interface EditTransactionModalProps {
  transaction: Transaction | null;
  isOpen: boolean;
  onClose: () => void;
}

export function EditTransactionModal({ transaction, isOpen, onClose }: EditTransactionModalProps) {
  const { categories, subcategories, updateTransaction, deleteTransaction } = useApp();
  const { toast } = useToast();
  
  const [type, setType] = useState<TransactionType>('despesa');
  const [amount, setAmount] = useState('');
  const [date, setDate] = useState('');
  const [categoryId, setCategoryId] = useState('');
  const [subcategoryId, setSubcategoryId] = useState('');
  const [description, setDescription] = useState('');
  const [needsReview, setNeedsReview] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);

  // Populate form when transaction changes
  useEffect(() => {
    if (transaction) {
      setType(transaction.type);
      setAmount(transaction.amount.toString().replace('.', ','));
      setDate(new Date(transaction.date).toISOString().split('T')[0]);
      setCategoryId(transaction.categoryId);
      setSubcategoryId(transaction.subcategoryId || '');
      setDescription(transaction.description || '');
      setNeedsReview(transaction.needsReview);
    }
  }, [transaction]);

  const filteredSubcategories = subcategories.filter(s => s.categoryId === categoryId);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!transaction) return;
    
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
      await updateTransaction({
        ...transaction,
        date: new Date(date),
        amount: parsedAmount,
        type,
        categoryId,
        subcategoryId: subcategoryId || undefined,
        description: description || undefined,
        needsReview,
      });

      toast({
        title: 'Lançamento atualizado!',
      });

      onClose();
    } catch (error) {
      toast({
        title: 'Erro ao salvar',
        description: 'Tente novamente.',
        variant: 'destructive',
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDelete = async () => {
    if (!transaction) return;
    
    try {
      await deleteTransaction(transaction.id);
      toast({ title: 'Lançamento excluído!' });
      setShowDeleteConfirm(false);
      onClose();
    } catch (error) {
      toast({
        title: 'Erro ao excluir',
        description: 'Tente novamente.',
        variant: 'destructive',
      });
    }
  };

  if (!transaction) return null;

  return (
    <>
      <Dialog open={isOpen} onOpenChange={onClose}>
        <DialogContent className="sm:max-w-[425px]">
          <DialogHeader>
            <DialogTitle>Editar Lançamento</DialogTitle>
          </DialogHeader>

          <form onSubmit={handleSubmit} className="space-y-4 mt-2">
            {/* Origin indicator */}
            {transaction.origin !== 'manual' && (
              <div className="text-xs text-muted-foreground bg-muted rounded px-2 py-1">
                Origem: {transaction.origin === 'import' ? 'Importação' : 'Recorrência'}
              </div>
            )}

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
                id="amount"
                type="text"
                inputMode="decimal"
                placeholder="0,00"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                className="text-lg font-mono"
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
                    <SelectItem value="">Nenhuma</SelectItem>
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

            {/* Actions */}
            <div className="flex gap-3 pt-2">
              <Button 
                type="button"
                variant="destructive"
                size="icon"
                onClick={() => setShowDeleteConfirm(true)}
              >
                <Trash2 className="h-4 w-4" />
              </Button>
              <Button 
                type="button" 
                variant="outline"
                onClick={onClose}
                className="flex-1"
              >
                Cancelar
              </Button>
              <Button 
                type="submit" 
                className="flex-1"
                disabled={isSubmitting}
              >
                {isSubmitting ? 'Salvando...' : 'Salvar'}
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation */}
      <AlertDialog open={showDeleteConfirm} onOpenChange={setShowDeleteConfirm}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir lançamento?</AlertDialogTitle>
            <AlertDialogDescription>
              Esta ação não pode ser desfeita.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction 
              onClick={handleDelete} 
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Excluir
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
