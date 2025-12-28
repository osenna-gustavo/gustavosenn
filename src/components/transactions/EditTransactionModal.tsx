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
      setType(transaction.type || 'despesa');
      const safeAmount = typeof transaction.amount === 'number' && !isNaN(transaction.amount) 
        ? transaction.amount 
        : 0;
      setAmount(safeAmount.toString().replace('.', ','));
      
      // Handle date safely
      let safeDate: Date;
      if (transaction.date instanceof Date && !isNaN(transaction.date.getTime())) {
        safeDate = transaction.date;
      } else if (typeof transaction.date === 'string') {
        safeDate = new Date(transaction.date);
      } else {
        safeDate = new Date();
      }
      setDate(safeDate.toISOString().split('T')[0]);
      
      setCategoryId(transaction.categoryId || '');
      setSubcategoryId(transaction.subcategoryId || '');
      setDescription(transaction.description || '');
      setNeedsReview(transaction.needsReview || false);
    }
  }, [transaction]);

  const filteredSubcategories = subcategories.filter(s => s.categoryId === categoryId);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!transaction) return;
    
    // Validate required fields
    if (!amount || !categoryId) {
      toast({
        title: 'Campos obrigatórios',
        description: 'Preencha o valor e a categoria.',
        variant: 'destructive',
      });
      return;
    }

    if (!date) {
      toast({
        title: 'Data inválida',
        description: 'Selecione uma data válida.',
        variant: 'destructive',
      });
      return;
    }

    // Parse amount safely (handles pt-BR format)
    const cleanedAmount = amount.replace(/\s/g, '').replace(/\./g, '').replace(',', '.');
    const parsedAmount = parseFloat(cleanedAmount);
    
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
        date: new Date(date + 'T12:00:00'), // Use noon to avoid timezone issues
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
      console.error('Error updating transaction:', error);
      toast({
        title: 'Falha ao salvar',
        description: 'Tente novamente.',
        variant: 'destructive',
      });
      // Keep modal open on error - don't call onClose()
    } finally {
      setIsSubmitting(false);
    }
  };

  const [isDeleting, setIsDeleting] = useState(false);
  
  const handleDelete = async () => {
    if (!transaction) return;
    
    setIsDeleting(true);
    try {
      await deleteTransaction(transaction.id);
      toast({ title: 'Lançamento excluído!' });
      setShowDeleteConfirm(false);
      onClose();
    } catch (error) {
      console.error('Error deleting transaction:', error);
      toast({
        title: 'Não foi possível excluir',
        description: 'Tente novamente.',
        variant: 'destructive',
      });
      setShowDeleteConfirm(false);
      // Keep modal open - don't call onClose()
    } finally {
      setIsDeleting(false);
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
              <Select 
                value={subcategoryId || "__none__"} 
                onValueChange={(val) => setSubcategoryId(val === "__none__" ? "" : val)}
              >
                  <SelectTrigger>
                    <SelectValue placeholder="Selecione..." />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="__none__">Nenhuma</SelectItem>
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
      <AlertDialog open={showDeleteConfirm} onOpenChange={(open) => !isDeleting && setShowDeleteConfirm(open)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Tem certeza que deseja excluir este lançamento?</AlertDialogTitle>
            <AlertDialogDescription>
              Esta ação não pode ser desfeita.
              {transaction?.recurrenceInstanceId && (
                <span className="block mt-2 text-warning">
                  Este lançamento está vinculado a uma recorrência. Ao excluir, a instância voltará para "Pendente".
                </span>
              )}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isDeleting}>Cancelar</AlertDialogCancel>
            <AlertDialogAction 
              onClick={handleDelete} 
              disabled={isDeleting}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {isDeleting ? 'Excluindo...' : 'Excluir'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
