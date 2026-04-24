import { useState, useMemo } from 'react';
import { useApp } from '@/contexts/AppContext';
import { formatCurrency, formatDate } from '@/lib/formatters';
import {
  ArrowUpRight,
  ArrowDownRight,
  Search,
  Filter,
  AlertTriangle,
  Pencil,
  CheckSquare,
  Square,
  Trash2,
  Edit2,
} from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
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
import { EditTransactionModal } from './EditTransactionModal';
import { cn } from '@/lib/utils';
import type { Transaction } from '@/types/finance';
import { useToast } from '@/hooks/use-toast';

interface TransactionListProps {
  filteredTransactions?: Transaction[];
}

export function TransactionList({ filteredTransactions: externalFiltered }: TransactionListProps) {
  const {
    transactions,
    categories,
    subcategories,
    recurrences,
    bulkUpdateTransactions,
    bulkDeleteTransactions,
    linkTransactionsToRecurrence,
  } = useApp();
  const { toast } = useToast();

  const [searchQuery, setSearchQuery] = useState('');
  const [categoryFilter, setCategoryFilter] = useState<string>('all');
  const [editingTransaction, setEditingTransaction] = useState<Transaction | null>(null);

  // Bulk edit state
  const [bulkMode, setBulkMode] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [showBulkEdit, setShowBulkEdit] = useState(false);
  const [showBulkDelete, setShowBulkDelete] = useState(false);
  const [bulkEditData, setBulkEditData] = useState({
    categoryId: '',
    subcategoryId: '',
    description: '',
    recurrenceId: '',
  });

  const filteredTransactions = useMemo(() => {
    const baseTransactions = externalFiltered ?? transactions;
    if (!Array.isArray(baseTransactions)) return [];

    return baseTransactions
      .filter(t => {
        if (!t || !t.id) return false;
        if (categoryFilter !== 'all' && t.categoryId !== categoryFilter) return false;
        if (searchQuery) {
          const query = searchQuery.toLowerCase();
          const category = categories.find(c => c.id === t.categoryId);
          return (
            t.description?.toLowerCase().includes(query) ||
            category?.name.toLowerCase().includes(query)
          );
        }
        return true;
      })
      .sort((a, b) => {
        const dateA = a.date instanceof Date ? a.date : new Date(a.date);
        const dateB = b.date instanceof Date ? b.date : new Date(b.date);
        return dateB.getTime() - dateA.getTime();
      });
  }, [transactions, externalFiltered, categories, searchQuery, categoryFilter]);

  const totals = useMemo(() => {
    const income = filteredTransactions
      .filter(t => t.type === 'receita')
      .reduce((sum, t) => sum + (typeof t.amount === 'number' && !isNaN(t.amount) ? t.amount : 0), 0);
    const expenses = filteredTransactions
      .filter(t => t.type === 'despesa')
      .reduce((sum, t) => sum + (typeof t.amount === 'number' && !isNaN(t.amount) ? t.amount : 0), 0);
    return { income, expenses, balance: income - expenses };
  }, [filteredTransactions]);

  const toggleBulkMode = () => {
    setBulkMode(prev => !prev);
    setSelectedIds(new Set());
  };

  const toggleSelect = (id: string) => {
    setSelectedIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const toggleSelectAll = () => {
    if (selectedIds.size === filteredTransactions.length) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(filteredTransactions.map(t => t.id)));
    }
  };

  const filteredBulkSubcategories = subcategories.filter(
    s => s.categoryId === bulkEditData.categoryId
  );

  const handleBulkEdit = async () => {
    const updates: { categoryId?: string; subcategoryId?: string | null; description?: string } = {};
    if (bulkEditData.categoryId) updates.categoryId = bulkEditData.categoryId;
    if (bulkEditData.categoryId) updates.subcategoryId = bulkEditData.subcategoryId || null;
    if (bulkEditData.description.trim()) updates.description = bulkEditData.description.trim();

    const hasRecurrenceLink = !!bulkEditData.recurrenceId;
    const hasOtherUpdates = Object.keys(updates).length > 0;

    if (!hasOtherUpdates && !hasRecurrenceLink) {
      toast({ title: 'Nenhuma alteração selecionada', variant: 'destructive' });
      return;
    }

    try {
      const ids = Array.from(selectedIds);

      // Apply category/description updates first
      if (hasOtherUpdates) {
        await bulkUpdateTransactions(ids, updates);
      }

      // Link to recurrence/installment and mark instance as confirmed
      if (hasRecurrenceLink) {
        await linkTransactionsToRecurrence(ids, bulkEditData.recurrenceId);
      }

      toast({ title: `${selectedIds.size} lançamento(s) atualizado(s)!` });
      setSelectedIds(new Set());
      setShowBulkEdit(false);
      setBulkEditData({ categoryId: '', subcategoryId: '', description: '', recurrenceId: '' });
    } catch {
      toast({ title: 'Erro ao atualizar', variant: 'destructive' });
    }
  };

  const handleBulkDelete = async () => {
    try {
      await bulkDeleteTransactions(Array.from(selectedIds));
      toast({ title: `${selectedIds.size} lançamento(s) excluído(s)!` });
      setSelectedIds(new Set());
      setShowBulkDelete(false);
    } catch {
      toast({ title: 'Erro ao excluir', variant: 'destructive' });
    }
  };

  return (
    <div className="space-y-4">
      {/* Summary Cards */}
      <div className="grid grid-cols-3 gap-3">
        <div className="stat-card border-l-4 border-l-success">
          <p className="text-xs text-muted-foreground mb-1">Receitas</p>
          <p className="text-lg font-mono font-bold text-success">
            {formatCurrency(totals.income)}
          </p>
        </div>
        <div className="stat-card border-l-4 border-l-destructive">
          <p className="text-xs text-muted-foreground mb-1">Despesas</p>
          <p className="text-lg font-mono font-bold text-destructive">
            {formatCurrency(totals.expenses)}
          </p>
        </div>
        <div
          className={cn(
            'stat-card border-l-4',
            totals.balance >= 0 ? 'border-l-success' : 'border-l-destructive'
          )}
        >
          <p className="text-xs text-muted-foreground mb-1">Saldo</p>
          <p
            className={cn(
              'text-lg font-mono font-bold',
              totals.balance >= 0 ? 'text-success' : 'text-destructive'
            )}
          >
            {formatCurrency(totals.balance)}
          </p>
        </div>
      </div>

      {/* Filters + bulk toggle */}
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Buscar por descrição ou categoria..."
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
            className="pl-9"
          />
        </div>
        <Select value={categoryFilter} onValueChange={setCategoryFilter}>
          <SelectTrigger className="w-full sm:w-[180px]">
            <Filter className="h-4 w-4 mr-2" />
            <SelectValue placeholder="Categoria" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todas as categorias</SelectItem>
            {categories.map(cat => (
              <SelectItem key={cat.id} value={cat.id}>
                {cat.icon} {cat.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Button
          variant={bulkMode ? 'default' : 'outline'}
          size="sm"
          onClick={toggleBulkMode}
          className="gap-1.5 shrink-0"
        >
          {bulkMode ? <CheckSquare className="h-4 w-4" /> : <Square className="h-4 w-4" />}
          {bulkMode ? 'Cancelar seleção' : 'Selecionar'}
        </Button>
      </div>

      {/* Bulk action bar */}
      {bulkMode && selectedIds.size > 0 && (
        <div className="glass-card rounded-xl p-3 flex items-center gap-3 flex-wrap border border-primary/30">
          <span className="text-sm font-medium text-primary">
            {selectedIds.size} selecionado(s)
          </span>
          <div className="flex gap-2 ml-auto flex-wrap">
            <Button
              size="sm"
              variant="outline"
              onClick={() => {
                setBulkEditData({ categoryId: '', subcategoryId: '', description: '' });
                setShowBulkEdit(true);
              }}
              className="gap-1"
            >
              <Edit2 className="h-3.5 w-3.5" /> Editar
            </Button>
            <Button
              size="sm"
              variant="destructive"
              onClick={() => setShowBulkDelete(true)}
              className="gap-1"
            >
              <Trash2 className="h-3.5 w-3.5" /> Excluir
            </Button>
          </div>
        </div>
      )}

      {/* Transaction List */}
      <div className="glass-card rounded-xl divide-y divide-border">
        {/* Select All row when in bulk mode */}
        {bulkMode && filteredTransactions.length > 0 && (
          <div className="flex items-center gap-3 px-4 py-2 bg-muted/30">
            <Checkbox
              checked={selectedIds.size === filteredTransactions.length}
              onCheckedChange={toggleSelectAll}
            />
            <span className="text-xs text-muted-foreground">Selecionar todos</span>
          </div>
        )}

        {filteredTransactions.length === 0 ? (
          <div className="p-8 text-center text-muted-foreground">
            {transactions.length === 0
              ? 'Nenhum lançamento neste mês.'
              : 'Nenhum resultado encontrado.'}
          </div>
        ) : (
          filteredTransactions.map(transaction => {
            const category = categories.find(c => c.id === transaction.categoryId);
            const isIncome = transaction.type === 'receita';

            const safeAmount =
              typeof transaction.amount === 'number' && !isNaN(transaction.amount)
                ? transaction.amount
                : 0;
            const safeDate =
              transaction.date instanceof Date && !isNaN(transaction.date.getTime())
                ? transaction.date
                : new Date();

            return (
              <div
                key={transaction.id}
                className={cn(
                  'flex items-center justify-between p-4 hover:bg-muted/50 transition-colors',
                  bulkMode ? 'cursor-pointer' : 'cursor-pointer',
                  bulkMode && selectedIds.has(transaction.id) && 'bg-primary/5'
                )}
                onClick={() => {
                  if (bulkMode) {
                    toggleSelect(transaction.id);
                  } else {
                    setEditingTransaction(transaction);
                  }
                }}
              >
                <div className="flex items-center gap-3">
                  {bulkMode && (
                    <Checkbox
                      checked={selectedIds.has(transaction.id)}
                      onCheckedChange={() => toggleSelect(transaction.id)}
                      onClick={e => e.stopPropagation()}
                    />
                  )}
                  <div
                    className={cn(
                      'h-10 w-10 rounded-lg flex items-center justify-center text-lg',
                      isIncome ? 'bg-success/10' : 'bg-muted'
                    )}
                  >
                    {category?.icon ||
                      (isIncome ? (
                        <ArrowUpRight className="h-5 w-5 text-success" />
                      ) : (
                        <ArrowDownRight className="h-5 w-5" />
                      ))}
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <p className="font-medium">{category?.name || 'Sem categoria'}</p>
                      {transaction.needsReview && (
                        <AlertTriangle className="h-4 w-4 text-warning" />
                      )}
                      {transaction.origin === 'recurrence' && (
                        <span className="text-[10px] px-1.5 py-0.5 rounded bg-primary/10 text-primary">
                          Recorrência
                        </span>
                      )}
                    </div>
                    <p className="text-sm text-muted-foreground">
                      {formatDate(safeDate)}
                      {transaction.description && ` • ${transaction.description}`}
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-3">
                  <span
                    className={cn(
                      'font-mono font-medium',
                      isIncome ? 'text-success' : 'text-foreground'
                    )}
                  >
                    {isIncome ? '+' : '-'}{formatCurrency(safeAmount)}
                  </span>
                  {!bulkMode && <Pencil className="h-4 w-4 text-muted-foreground" />}
                </div>
              </div>
            );
          })
        )}
      </div>

      {/* Individual Edit Modal */}
      <EditTransactionModal
        transaction={editingTransaction}
        isOpen={!!editingTransaction}
        onClose={() => setEditingTransaction(null)}
      />

      {/* Bulk Edit Modal */}
      <Dialog open={showBulkEdit} onOpenChange={setShowBulkEdit}>
        <DialogContent className="sm:max-w-[400px]">
          <DialogHeader>
            <DialogTitle>Editar {selectedIds.size} lançamento(s)</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <p className="text-sm text-muted-foreground">
              Preencha apenas os campos que deseja alterar. Campos vazios serão ignorados.
            </p>

            <div className="space-y-2">
              <Label>Categoria</Label>
              <Select
                value={bulkEditData.categoryId || '__none__'}
                onValueChange={val =>
                  setBulkEditData(prev => ({
                    ...prev,
                    categoryId: val === '__none__' ? '' : val,
                    subcategoryId: '',
                  }))
                }
              >
                <SelectTrigger>
                  <SelectValue placeholder="Não alterar" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="__none__">Não alterar</SelectItem>
                  {categories.map(cat => (
                    <SelectItem key={cat.id} value={cat.id}>
                      {cat.icon} {cat.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {bulkEditData.categoryId && filteredBulkSubcategories.length > 0 && (
              <div className="space-y-2">
                <Label>Subcategoria</Label>
                <Select
                  value={bulkEditData.subcategoryId || '__none__'}
                  onValueChange={val =>
                    setBulkEditData(prev => ({
                      ...prev,
                      subcategoryId: val === '__none__' ? '' : val,
                    }))
                  }
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Nenhuma" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="__none__">Nenhuma</SelectItem>
                    {filteredBulkSubcategories.map(sub => (
                      <SelectItem key={sub.id} value={sub.id}>
                        {sub.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}

            <div className="space-y-2">
              <Label>Descrição (substituir)</Label>
              <Input
                value={bulkEditData.description}
                onChange={e =>
                  setBulkEditData(prev => ({ ...prev, description: e.target.value }))
                }
                placeholder="Deixe vazio para não alterar"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowBulkEdit(false)}>
              Cancelar
            </Button>
            <Button onClick={handleBulkEdit}>Salvar alterações</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Bulk Delete Confirm */}
      <AlertDialog open={showBulkDelete} onOpenChange={setShowBulkDelete}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir {selectedIds.size} lançamento(s)?</AlertDialogTitle>
            <AlertDialogDescription>Esta ação não pode ser desfeita.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleBulkDelete}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Excluir tudo
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
