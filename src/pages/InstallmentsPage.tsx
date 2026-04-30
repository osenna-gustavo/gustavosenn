import { useState, useMemo } from 'react';
import { useApp } from '@/contexts/AppContext';
import { formatCurrency, formatMonthYear } from '@/lib/formatters';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
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
import { Plus, Pencil, Trash2, CreditCard, Pause, Play, ChevronDown, ChevronRight, Check, RotateCcw } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import type { Recurrence, RecurrenceInstance, TransactionType } from '@/types/finance';
import { cn } from '@/lib/utils';
import * as db from '@/lib/supabase-database';

function getInstallmentNumber(startDate: Date, selectedMonth: number, selectedYear: number): number {
  const start = new Date(startDate);
  const diff = (selectedYear - start.getFullYear()) * 12 + (selectedMonth - start.getMonth());
  return diff + 1;
}

export function InstallmentsPage() {
  const {
    categories,
    subcategories,
    recurrences,
    recurrenceInstances,
    selectedMonth,
    selectedYear,
    addRecurrence,
    updateRecurrence,
    deleteRecurrence,
    bulkUpdateRecurrences,
    bulkDeleteRecurrences,
    addTransaction,
    deleteTransaction,
    refreshData,
  } = useApp();
  const { toast } = useToast();

  const [isFormOpen, setIsFormOpen] = useState(false);
  const [editingPlan, setEditingPlan] = useState<Recurrence | null>(null);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [showBulkDelete, setShowBulkDelete] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [collapsedGroups, setCollapsedGroups] = useState<Set<string>>(new Set());

  const toggleGroup = (key: string) => {
    setCollapsedGroups(prev => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  };

  const [formData, setFormData] = useState({
    name: '',
    type: 'despesa' as TransactionType,
    amount: '',
    categoryId: '',
    subcategoryId: '',
    totalInstallments: '',
    startDate: new Date().toISOString().split('T')[0],
    isActive: true,
  });

  // Filter only installment plans (recurrences with totalInstallments set)
  const installmentPlans = useMemo(
    () => recurrences.filter(r => r.totalInstallments && r.totalInstallments > 0),
    [recurrences]
  );

  // Group installments by category
  const groupedInstallments = useMemo(() => {
    const groups = new Map<string, { category: typeof categories[0] | undefined; plans: typeof installmentPlans }>();
    installmentPlans.forEach(plan => {
      const key = plan.categoryId || '__sem_categoria__';
      if (!groups.has(key)) {
        groups.set(key, { category: categories.find(c => c.id === plan.categoryId), plans: [] });
      }
      groups.get(key)!.plans.push(plan);
    });
    return Array.from(groups.values()).sort((a, b) => {
      if (!a.category) return 1;
      if (!b.category) return -1;
      return a.category.name.localeCompare(b.category.name);
    });
  }, [installmentPlans, categories]);

  const filteredSubcategories = subcategories.filter(s => s.categoryId === formData.categoryId);

  const openForm = (plan?: Recurrence) => {
    if (plan) {
      setEditingPlan(plan);
      setFormData({
        name: plan.name,
        type: plan.type,
        amount: plan.amount.toString(),
        categoryId: plan.categoryId,
        subcategoryId: plan.subcategoryId || '',
        totalInstallments: plan.totalInstallments?.toString() || '',
        startDate: new Date(plan.startDate).toISOString().split('T')[0],
        isActive: plan.isActive,
      });
    } else {
      setEditingPlan(null);
      setFormData({
        name: '',
        type: 'despesa',
        amount: '',
        categoryId: '',
        subcategoryId: '',
        totalInstallments: '',
        startDate: new Date().toISOString().split('T')[0],
        isActive: true,
      });
    }
    setIsFormOpen(true);
  };

  const handleSave = async () => {
    if (!formData.name.trim() || !formData.amount || !formData.categoryId || !formData.totalInstallments) {
      toast({ title: 'Preencha todos os campos obrigatórios', variant: 'destructive' });
      return;
    }

    const parsedAmount = parseFloat(formData.amount.replace(',', '.'));
    const parsedInstallments = parseInt(formData.totalInstallments);

    if (isNaN(parsedAmount) || parsedAmount <= 0) {
      toast({ title: 'Valor inválido', variant: 'destructive' });
      return;
    }
    if (isNaN(parsedInstallments) || parsedInstallments < 1) {
      toast({ title: 'Número de parcelas inválido', variant: 'destructive' });
      return;
    }

    try {
      const data = {
        name: formData.name,
        type: formData.type,
        amount: parsedAmount,
        categoryId: formData.categoryId,
        subcategoryId: formData.subcategoryId || undefined,
        frequency: 'monthly' as const,
        startDate: new Date(formData.startDate + 'T12:00:00'),
        isActive: formData.isActive,
        totalInstallments: parsedInstallments,
      };

      if (editingPlan) {
        await updateRecurrence({ ...editingPlan, ...data });
        toast({ title: 'Parcelamento atualizado!' });
      } else {
        await addRecurrence(data);
        toast({ title: 'Parcelamento criado!' });
      }
      setIsFormOpen(false);
    } catch {
      toast({ title: 'Erro ao salvar', variant: 'destructive' });
    }
  };

  const handleToggleActive = async (plan: Recurrence) => {
    await updateRecurrence({ ...plan, isActive: !plan.isActive });
    toast({ title: plan.isActive ? 'Parcelamento pausado' : 'Parcelamento ativado' });
  };

  const handleDelete = async () => {
    if (deleteId) {
      await deleteRecurrence(deleteId);
      toast({ title: 'Parcelamento excluído!' });
      setDeleteId(null);
    }
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
    if (selectedIds.size === installmentPlans.length) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(installmentPlans.map(p => p.id)));
    }
  };

  const handleBulkPause = async () => {
    await bulkUpdateRecurrences(Array.from(selectedIds), { isActive: false });
    toast({ title: `${selectedIds.size} parcelamento(s) pausado(s)` });
    setSelectedIds(new Set());
  };

  const handleBulkActivate = async () => {
    await bulkUpdateRecurrences(Array.from(selectedIds), { isActive: true });
    toast({ title: `${selectedIds.size} parcelamento(s) ativado(s)` });
    setSelectedIds(new Set());
  };

  const handleBulkDelete = async () => {
    await bulkDeleteRecurrences(Array.from(selectedIds));
    toast({ title: `${selectedIds.size} parcelamento(s) excluído(s)` });
    setSelectedIds(new Set());
    setShowBulkDelete(false);
  };

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl lg:text-3xl font-bold">Parcelamentos</h1>
          <p className="text-muted-foreground">Gerencie seus planos de parcelamento</p>
        </div>
        <Button onClick={() => openForm()} className="gap-2">
          <Plus className="h-4 w-4" />
          Novo Parcelamento
        </Button>
      </div>

      {/* Bulk action bar */}
      {selectedIds.size > 0 && (
        <div className="glass-card rounded-xl p-3 flex items-center gap-3 flex-wrap border border-primary/30">
          <span className="text-sm font-medium text-primary">
            {selectedIds.size} selecionado(s)
          </span>
          <div className="flex gap-2 ml-auto flex-wrap">
            <Button size="sm" variant="outline" onClick={handleBulkPause} className="gap-1">
              <Pause className="h-3.5 w-3.5" /> Pausar
            </Button>
            <Button size="sm" variant="outline" onClick={handleBulkActivate} className="gap-1">
              <Play className="h-3.5 w-3.5" /> Ativar
            </Button>
            <Button size="sm" variant="destructive" onClick={() => setShowBulkDelete(true)} className="gap-1">
              <Trash2 className="h-3.5 w-3.5" /> Excluir
            </Button>
            <Button size="sm" variant="ghost" onClick={() => setSelectedIds(new Set())}>
              Cancelar
            </Button>
          </div>
        </div>
      )}

      {/* List */}
      <div className="glass-card rounded-xl overflow-hidden">
        {installmentPlans.length === 0 ? (
          <div className="p-12 text-center text-muted-foreground">
            <CreditCard className="h-10 w-10 mx-auto mb-3 opacity-30" />
            <p>Nenhum parcelamento cadastrado.</p>
            <p className="text-sm mt-1">Crie um para acompanhar pagamentos parcelados.</p>
          </div>
        ) : (
          <div className="divide-y divide-border">
            {/* Select All row */}
            <div className="flex items-center gap-3 px-4 py-2 bg-muted/30">
              <Checkbox
                checked={selectedIds.size === installmentPlans.length && installmentPlans.length > 0}
                onCheckedChange={toggleSelectAll}
              />
              <span className="text-xs text-muted-foreground">Selecionar todos</span>
            </div>

            {groupedInstallments.map(({ category, plans }) => {
              const groupKey = category?.id ?? '__sem_categoria__';
              const isCollapsed = collapsedGroups.has(groupKey);
              const groupTotal = plans
                .filter(p => {
                  if (!p.isActive) return false;
                  const n = getInstallmentNumber(new Date(p.startDate), selectedMonth, selectedYear);
                  return n >= 1 && n <= p.totalInstallments!;
                })
                .reduce((sum, p) => sum + p.amount, 0);

              return (
                <div key={groupKey}>
                  {/* Category header — clicável para recolher */}
                  <button
                    onClick={() => toggleGroup(groupKey)}
                    className="w-full flex items-center justify-between px-4 py-2.5 bg-muted/50 border-b border-border hover:bg-muted/70 transition-colors"
                  >
                    <div className="flex items-center gap-2">
                      {isCollapsed
                        ? <ChevronRight className="h-4 w-4 text-muted-foreground shrink-0" />
                        : <ChevronDown className="h-4 w-4 text-muted-foreground shrink-0" />
                      }
                      <span className="text-base">{category?.icon ?? '📦'}</span>
                      <span className="text-sm font-semibold text-foreground">
                        {category?.name ?? 'Sem categoria'}
                      </span>
                      <span className="text-xs text-muted-foreground">
                        ({plans.length} parcelamento{plans.length !== 1 ? 's' : ''})
                      </span>
                    </div>
                    {groupTotal > 0 && (
                      <span className="text-xs font-mono text-muted-foreground">
                        {formatCurrency(groupTotal)}/mês
                      </span>
                    )}
                  </button>

                  {/* Plans in this category */}
                  {!isCollapsed && <div className="divide-y divide-border/50">
                    {plans.map(plan => {
                      const subcategory = subcategories.find(s => s.id === plan.subcategoryId);
                      const startDate = new Date(plan.startDate);
                      const currentNum = getInstallmentNumber(startDate, selectedMonth, selectedYear);
                      const total = plan.totalInstallments!;
                      const isActive = plan.isActive && currentNum >= 1 && currentNum <= total;
                      const pct = Math.min(100, (currentNum / total) * 100);
                      const remaining = total - currentNum + 1;

                      return (
                        <div
                          key={plan.id}
                          className={cn(
                            'flex items-center gap-3 p-4 transition-colors',
                            !plan.isActive && 'opacity-50'
                          )}
                        >
                          <Checkbox
                            checked={selectedIds.has(plan.id)}
                            onCheckedChange={() => toggleSelect(plan.id)}
                          />

                          <div className="h-10 w-10 rounded-lg bg-muted flex items-center justify-center shrink-0">
                            <CreditCard className="h-5 w-5 text-muted-foreground" />
                          </div>

                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 flex-wrap">
                              <span className="font-medium truncate">{plan.name}</span>
                              {isActive && currentNum >= 1 && currentNum <= total && (
                                <Badge variant="secondary" className="text-xs shrink-0">
                                  parcela {currentNum}/{total}
                                </Badge>
                              )}
                              {!plan.isActive && (
                                <Badge variant="outline" className="text-xs text-muted-foreground shrink-0">
                                  Pausado
                                </Badge>
                              )}
                              {currentNum > total && (
                                <Badge variant="outline" className="text-xs text-success border-success/30 shrink-0">
                                  Quitado
                                </Badge>
                              )}
                            </div>
                            <div className="text-sm text-muted-foreground mt-0.5">
                              {subcategory ? `→ ${subcategory.name}` : null}
                              {' • '}
                              {remaining > 0 && currentNum <= total
                                ? `${remaining} parcela(s) restante(s)`
                                : 'Concluído'}
                            </div>
                            <div className="mt-2 space-y-1">
                              <Progress value={pct} className="h-1.5" />
                              <div className="flex justify-between text-xs text-muted-foreground">
                                <span>{currentNum > 0 ? Math.min(currentNum - 1, total) : 0} pagas</span>
                                <span>{total} total</span>
                              </div>
                            </div>
                          </div>

                          <div className="flex items-center gap-3 shrink-0">
                            <span className="font-mono font-medium">{formatCurrency(plan.amount)}/mês</span>
                            <div className="flex gap-1">
                              <Button
                                variant="ghost"
                                size="icon"
                                className="h-8 w-8"
                                onClick={() => handleToggleActive(plan)}
                              >
                                {plan.isActive ? <Pause className="h-4 w-4" /> : <Play className="h-4 w-4" />}
                              </Button>
                              <Button
                                variant="ghost"
                                size="icon"
                                className="h-8 w-8"
                                onClick={() => openForm(plan)}
                              >
                                <Pencil className="h-4 w-4" />
                              </Button>
                              <Button
                                variant="ghost"
                                size="icon"
                                className="h-8 w-8 text-muted-foreground hover:text-destructive"
                                onClick={() => setDeleteId(plan.id)}
                              >
                                <Trash2 className="h-4 w-4" />
                              </Button>
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>}
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Summary card */}
      {installmentPlans.length > 0 && (
        <div className="glass-card rounded-xl p-4">
          <p className="text-sm text-muted-foreground mb-1">
            Total comprometido em {formatMonthYear(selectedMonth, selectedYear)}
          </p>
          <p className="text-2xl font-mono font-bold">
            {formatCurrency(
              installmentPlans
                .filter(p => {
                  if (!p.isActive) return false;
                  const n = getInstallmentNumber(new Date(p.startDate), selectedMonth, selectedYear);
                  return n >= 1 && n <= p.totalInstallments!;
                })
                .reduce((sum, p) => sum + p.amount, 0)
            )}
          </p>
        </div>
      )}

      {/* Form Dialog */}
      <Dialog open={isFormOpen} onOpenChange={setIsFormOpen}>
        <DialogContent className="sm:max-w-[460px]">
          <DialogHeader>
            <DialogTitle>
              {editingPlan ? 'Editar Parcelamento' : 'Novo Parcelamento'}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4 mt-2">
            {/* Type */}
            <div className="flex rounded-lg bg-muted p-1">
              <button
                type="button"
                onClick={() => setFormData(prev => ({ ...prev, type: 'despesa' }))}
                className={cn(
                  'flex-1 py-2 rounded-md text-sm font-medium transition-all',
                  formData.type === 'despesa'
                    ? 'bg-destructive text-destructive-foreground'
                    : 'text-muted-foreground hover:text-foreground'
                )}
              >
                Despesa
              </button>
              <button
                type="button"
                onClick={() => setFormData(prev => ({ ...prev, type: 'receita' }))}
                className={cn(
                  'flex-1 py-2 rounded-md text-sm font-medium transition-all',
                  formData.type === 'receita'
                    ? 'bg-success text-success-foreground'
                    : 'text-muted-foreground hover:text-foreground'
                )}
              >
                Receita
              </button>
            </div>

            <div className="space-y-2">
              <Label>Nome</Label>
              <Input
                value={formData.name}
                onChange={e => setFormData(prev => ({ ...prev, name: e.target.value }))}
                placeholder="Ex: Financiamento do carro"
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Valor por parcela (R$)</Label>
                <Input
                  type="text"
                  inputMode="decimal"
                  value={formData.amount}
                  onChange={e => setFormData(prev => ({ ...prev, amount: e.target.value }))}
                  placeholder="0,00"
                  className="font-mono"
                />
              </div>
              <div className="space-y-2">
                <Label>Nº de parcelas</Label>
                <Input
                  type="number"
                  min={1}
                  max={360}
                  value={formData.totalInstallments}
                  onChange={e => setFormData(prev => ({ ...prev, totalInstallments: e.target.value }))}
                  placeholder="Ex: 12"
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label>Data da 1ª parcela</Label>
              <Input
                type="date"
                value={formData.startDate}
                onChange={e => setFormData(prev => ({ ...prev, startDate: e.target.value }))}
              />
            </div>

            <div className="space-y-2">
              <Label>Categoria</Label>
              <Select
                value={formData.categoryId}
                onValueChange={value => setFormData(prev => ({ ...prev, categoryId: value, subcategoryId: '' }))}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Selecione..." />
                </SelectTrigger>
                <SelectContent>
                  {categories.map(cat => (
                    <SelectItem key={cat.id} value={cat.id}>
                      {cat.icon} {cat.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {formData.categoryId && filteredSubcategories.length > 0 && (
              <div className="space-y-2">
                <Label>Subcategoria (opcional)</Label>
                <Select
                  value={formData.subcategoryId || '__none__'}
                  onValueChange={val =>
                    setFormData(prev => ({ ...prev, subcategoryId: val === '__none__' ? '' : val }))
                  }
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Selecione..." />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="__none__">Nenhuma</SelectItem>
                    {filteredSubcategories.map(sub => (
                      <SelectItem key={sub.id} value={sub.id}>
                        {sub.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}

            {formData.totalInstallments && formData.startDate && (
              <div className="text-xs text-muted-foreground bg-muted rounded px-3 py-2">
                Término estimado:{' '}
                {(() => {
                  const end = new Date(formData.startDate + 'T12:00:00');
                  end.setMonth(end.getMonth() + parseInt(formData.totalInstallments) - 1);
                  return end.toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' });
                })()}
              </div>
            )}

            <Button onClick={handleSave} className="w-full">
              Salvar
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Delete single */}
      <AlertDialog open={!!deleteId} onOpenChange={() => setDeleteId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir parcelamento?</AlertDialogTitle>
            <AlertDialogDescription>Esta ação não pode ser desfeita.</AlertDialogDescription>
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

      {/* Bulk delete */}
      <AlertDialog open={showBulkDelete} onOpenChange={setShowBulkDelete}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir {selectedIds.size} parcelamento(s)?</AlertDialogTitle>
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
