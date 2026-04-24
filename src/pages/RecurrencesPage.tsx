import { useState } from 'react';
import { useApp } from '@/contexts/AppContext';
import { formatCurrency, formatDate, formatMonthYear } from '@/lib/formatters';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
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
import { Plus, Pencil, Trash2, RefreshCw, Pause, Play, CheckSquare, Square } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { Checkbox } from '@/components/ui/checkbox';
import type { Recurrence, TransactionType } from '@/types/finance';
import { cn } from '@/lib/utils';
import { RecurrenceInstances } from '@/components/recurrences/RecurrenceInstances';

export function RecurrencesPage() {
  const { categories, subcategories, recurrences, selectedMonth, selectedYear, addRecurrence, updateRecurrence, deleteRecurrence } = useApp();
  const { toast } = useToast();

  const [isFormOpen, setIsFormOpen] = useState(false);
  const [editingRecurrence, setEditingRecurrence] = useState<Recurrence | null>(null);
  const [deleteId, setDeleteId] = useState<string | null>(null);

  const [formData, setFormData] = useState({
    name: '',
    type: 'despesa' as TransactionType,
    amount: '',
    categoryId: '',
    subcategoryId: '',
    frequency: 'monthly' as 'daily' | 'weekly' | 'monthly',
    startDate: new Date().toISOString().split('T')[0],
    endDate: '',
    isActive: true,
  });

  // Filter subcategories based on selected category
  const filteredSubcategories = subcategories.filter(
    s => s.categoryId === formData.categoryId
  );

  const openForm = (recurrence?: Recurrence) => {
    if (recurrence) {
      setEditingRecurrence(recurrence);
      setFormData({
        name: recurrence.name,
        type: recurrence.type,
        amount: recurrence.amount.toString(),
        categoryId: recurrence.categoryId,
        subcategoryId: recurrence.subcategoryId || '',
        frequency: recurrence.frequency,
        startDate: new Date(recurrence.startDate).toISOString().split('T')[0],
        endDate: recurrence.endDate ? new Date(recurrence.endDate).toISOString().split('T')[0] : '',
        isActive: recurrence.isActive,
      });
    } else {
      setEditingRecurrence(null);
      setFormData({
        name: '',
        type: 'despesa',
        amount: '',
        categoryId: '',
        subcategoryId: '',
        frequency: 'monthly',
        startDate: new Date().toISOString().split('T')[0],
        endDate: '',
        isActive: true,
      });
    }
    setIsFormOpen(true);
  };

  const handleSave = async () => {
    if (!formData.name.trim() || !formData.amount || !formData.categoryId) {
      toast({ title: 'Preencha todos os campos obrigatórios', variant: 'destructive' });
      return;
    }

    const parsedAmount = parseFloat(formData.amount.replace(',', '.'));
    if (isNaN(parsedAmount) || parsedAmount <= 0) {
      toast({ title: 'Valor inválido', variant: 'destructive' });
      return;
    }

    try {
      const data = {
        name: formData.name,
        type: formData.type,
        amount: parsedAmount,
        categoryId: formData.categoryId,
        subcategoryId: formData.subcategoryId || undefined,
        frequency: formData.frequency,
        startDate: new Date(formData.startDate),
        endDate: formData.endDate ? new Date(formData.endDate) : undefined,
        isActive: formData.isActive,
      };

      if (editingRecurrence) {
        await updateRecurrence({ ...editingRecurrence, ...data });
        toast({ title: 'Recorrência atualizada!' });
      } else {
        await addRecurrence(data);
        toast({ title: 'Recorrência criada!' });
      }
      setIsFormOpen(false);
    } catch (error) {
      toast({ title: 'Erro ao salvar', variant: 'destructive' });
    }
  };

  const handleToggleActive = async (recurrence: Recurrence) => {
    await updateRecurrence({ ...recurrence, isActive: !recurrence.isActive });
    toast({ title: recurrence.isActive ? 'Recorrência pausada' : 'Recorrência ativada' });
  };

  const handleDelete = async () => {
    if (deleteId) {
      await deleteRecurrence(deleteId);
      toast({ title: 'Recorrência excluída!' });
      setDeleteId(null);
    }
  };

  const frequencyLabels = {
    daily: 'Diária',
    weekly: 'Semanal',
    monthly: 'Mensal',
  };

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl lg:text-3xl font-bold">Recorrências</h1>
          <p className="text-muted-foreground">
            Gerencie lançamentos automáticos
          </p>
        </div>
        <Button onClick={() => openForm()} className="gap-2">
          <Plus className="h-4 w-4" />
          Nova Recorrência
        </Button>
      </div>

      {/* Tabs */}
      <Tabs defaultValue="month" className="w-full">
        <TabsList className="grid w-full grid-cols-2 max-w-md">
          <TabsTrigger value="month">
            Do Mês ({formatMonthYear(selectedMonth, selectedYear)})
          </TabsTrigger>
          <TabsTrigger value="all">Todas as Regras</TabsTrigger>
        </TabsList>
        
        <TabsContent value="month" className="mt-4">
          <div className="glass-card rounded-xl">
            <RecurrenceInstances />
          </div>
        </TabsContent>
        
        <TabsContent value="all" className="mt-4">
          <div className="glass-card rounded-xl divide-y divide-border">
            {recurrences.length === 0 ? (
              <div className="p-8 text-center text-muted-foreground">
                Nenhuma recorrência criada.
              </div>
            ) : (
              recurrences.map((recurrence) => {
                const category = categories.find(c => c.id === recurrence.categoryId);
                const isIncome = recurrence.type === 'receita';
                
                return (
                  <div 
                    key={recurrence.id}
                    className={cn(
                      "flex items-center justify-between p-4 transition-colors",
                      !recurrence.isActive && "opacity-50"
                    )}
                  >
                    <div className="flex items-center gap-3">
                      <div className={cn(
                        "h-10 w-10 rounded-lg flex items-center justify-center",
                        isIncome ? "bg-success/10" : "bg-muted"
                      )}>
                        <RefreshCw className={cn(
                          "h-5 w-5",
                          isIncome ? "text-success" : "text-muted-foreground"
                        )} />
                      </div>
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="font-medium">{recurrence.name}</span>
                          <span className="text-xs px-2 py-0.5 rounded bg-muted text-muted-foreground">
                            {frequencyLabels[recurrence.frequency]}
                          </span>
                        </div>
                        <div className="text-sm text-muted-foreground">
                          {category?.icon} {category?.name} • Início: {formatDate(recurrence.startDate)}
                        </div>
                      </div>
                    </div>
                    
                    <div className="flex items-center gap-3">
                      <span className={cn(
                        "font-mono font-medium",
                        isIncome ? "text-success" : "text-foreground"
                      )}>
                        {isIncome ? '+' : '-'}{formatCurrency(recurrence.amount)}
                      </span>
                      <div className="flex items-center gap-1">
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8"
                          onClick={() => handleToggleActive(recurrence)}
                        >
                          {recurrence.isActive ? (
                            <Pause className="h-4 w-4" />
                          ) : (
                            <Play className="h-4 w-4" />
                          )}
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8"
                          onClick={() => openForm(recurrence)}
                        >
                          <Pencil className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8 text-muted-foreground hover:text-destructive"
                          onClick={() => setDeleteId(recurrence.id)}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </TabsContent>
      </Tabs>

      {/* Form Dialog */}
      <Dialog open={isFormOpen} onOpenChange={setIsFormOpen}>
        <DialogContent className="sm:max-w-[450px]">
          <DialogHeader>
            <DialogTitle>
              {editingRecurrence ? 'Editar Recorrência' : 'Nova Recorrência'}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4 mt-2">
            {/* Type Toggle */}
            <div className="flex rounded-lg bg-muted p-1">
              <button
                type="button"
                onClick={() => setFormData(prev => ({ ...prev, type: 'despesa' }))}
                className={cn(
                  "flex-1 py-2 rounded-md text-sm font-medium transition-all",
                  formData.type === 'despesa' 
                    ? "bg-destructive text-destructive-foreground" 
                    : "text-muted-foreground hover:text-foreground"
                )}
              >
                Despesa
              </button>
              <button
                type="button"
                onClick={() => setFormData(prev => ({ ...prev, type: 'receita' }))}
                className={cn(
                  "flex-1 py-2 rounded-md text-sm font-medium transition-all",
                  formData.type === 'receita' 
                    ? "bg-success text-success-foreground" 
                    : "text-muted-foreground hover:text-foreground"
                )}
              >
                Receita
              </button>
            </div>

            <div className="space-y-2">
              <Label>Nome</Label>
              <Input
                value={formData.name}
                onChange={(e) => setFormData(prev => ({ ...prev, name: e.target.value }))}
                placeholder="Ex: Aluguel, Netflix, Salário"
              />
            </div>

            <div className="space-y-2">
              <Label>Valor (R$)</Label>
              <Input
                type="text"
                inputMode="decimal"
                value={formData.amount}
                onChange={(e) => setFormData(prev => ({ ...prev, amount: e.target.value }))}
                placeholder="0,00"
                className="font-mono"
              />
            </div>

            <div className="space-y-2">
              <Label>Categoria</Label>
              <Select 
                value={formData.categoryId} 
                onValueChange={(value) => setFormData(prev => ({ ...prev, categoryId: value, subcategoryId: '' }))}
              >
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

            {/* Subcategory - only show when category is selected and has subcategories */}
            {formData.categoryId && filteredSubcategories.length > 0 && (
              <div className="space-y-2">
                <Label>Subcategoria (opcional)</Label>
                <Select 
                  value={formData.subcategoryId || "__none__"} 
                  onValueChange={(val) => setFormData(prev => ({ ...prev, subcategoryId: val === "__none__" ? '' : val }))}
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

            <div className="space-y-2">
              <Label>Frequência</Label>
              <Select 
                value={formData.frequency} 
                onValueChange={(value) => setFormData(prev => ({ ...prev, frequency: value as any }))}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="daily">Diária</SelectItem>
                  <SelectItem value="weekly">Semanal</SelectItem>
                  <SelectItem value="monthly">Mensal</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Data Início</Label>
                <Input
                  type="date"
                  value={formData.startDate}
                  onChange={(e) => setFormData(prev => ({ ...prev, startDate: e.target.value }))}
                />
              </div>
              <div className="space-y-2">
                <Label>Data Fim (opcional)</Label>
                <Input
                  type="date"
                  value={formData.endDate}
                  onChange={(e) => setFormData(prev => ({ ...prev, endDate: e.target.value }))}
                />
              </div>
            </div>

            <div className="flex items-center justify-between">
              <Label>Ativa</Label>
              <Switch
                checked={formData.isActive}
                onCheckedChange={(checked) => setFormData(prev => ({ ...prev, isActive: checked }))}
              />
            </div>

            <Button onClick={handleSave} className="w-full">
              Salvar
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation */}
      <AlertDialog open={!!deleteId} onOpenChange={() => setDeleteId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir recorrência?</AlertDialogTitle>
            <AlertDialogDescription>
              Esta ação não pode ser desfeita.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
              Excluir
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
