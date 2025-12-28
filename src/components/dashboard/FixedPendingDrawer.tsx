import { useState } from 'react';
import { useApp } from '@/contexts/AppContext';
import { formatCurrency, formatMonthYear } from '@/lib/formatters';
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { AlertTriangle, CheckCircle2, Clock, Check } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useToast } from '@/hooks/use-toast';
import * as db from '@/lib/supabase-database';

interface FixedPendingDrawerProps {
  isOpen: boolean;
  onClose: () => void;
}

interface FixedPendingItem {
  categoryId: string;
  categoryName: string;
  subcategoryId?: string;
  subcategoryName?: string;
  icon?: string;
  plannedFixed: number;
  realizedFixed: number;
  pendingAmount: number;
}

interface PendingRecurrenceItem {
  instanceId: string;
  recurrenceId: string;
  recurrenceName: string;
  categoryId: string;
  categoryName: string;
  amount: number;
}

export function FixedPendingDrawer({ isOpen, onClose }: FixedPendingDrawerProps) {
  const { 
    transactions, 
    categories, 
    subcategories: allSubcategories,
    budget,
    recurrences,
    recurrenceInstances,
    selectedMonth, 
    selectedYear,
    refreshData,
    addTransaction,
  } = useApp();
  const { toast } = useToast();
  const [confirmingId, setConfirmingId] = useState<string | null>(null);

  // Get fixed categories and subcategories
  const fixedCategories = categories.filter(c => c.isFixed && c.type === 'despesa');
  const fixedSubcategories = allSubcategories.filter(s => s.isFixed);

  // Calculate fixed planned from budget
  const pendingItems: FixedPendingItem[] = [];

  // Process categories
  fixedCategories.forEach(cat => {
    const catBudgets = budget?.categoryBudgets.filter(cb => cb.categoryId === cat.id && !cb.subcategoryId) ?? [];
    const plannedFixed = catBudgets.reduce((sum, cb) => sum + cb.plannedAmount, 0);
    
    const realizedFixed = transactions
      .filter(t => t.type === 'despesa' && t.categoryId === cat.id && !t.subcategoryId)
      .reduce((sum, t) => sum + t.amount, 0);

    // Also add confirmed recurrence instances
    const confirmedRecurrenceAmount = recurrenceInstances
      .filter(i => {
        if (i.status !== 'confirmed') return false;
        const rec = recurrences.find(r => r.id === i.recurrenceId);
        return rec?.categoryId === cat.id && !rec?.subcategoryId && rec?.type === 'despesa';
      })
      .reduce((sum, i) => sum + i.amount, 0);

    const totalRealized = realizedFixed + confirmedRecurrenceAmount;
    const pendingAmount = Math.max(0, plannedFixed - totalRealized);

    if (plannedFixed > 0 || totalRealized > 0) {
      pendingItems.push({
        categoryId: cat.id,
        categoryName: cat.name,
        icon: cat.icon,
        plannedFixed,
        realizedFixed: totalRealized,
        pendingAmount,
      });
    }
  });

  // Process subcategories
  fixedSubcategories.forEach(sub => {
    const cat = categories.find(c => c.id === sub.categoryId);
    if (!cat || cat.type !== 'despesa') return;

    const subBudgets = budget?.categoryBudgets.filter(cb => cb.subcategoryId === sub.id) ?? [];
    const plannedFixed = subBudgets.reduce((sum, cb) => sum + cb.plannedAmount, 0);
    
    const realizedFixed = transactions
      .filter(t => t.type === 'despesa' && t.subcategoryId === sub.id)
      .reduce((sum, t) => sum + t.amount, 0);

    // Also add confirmed recurrence instances
    const confirmedRecurrenceAmount = recurrenceInstances
      .filter(i => {
        if (i.status !== 'confirmed') return false;
        const rec = recurrences.find(r => r.id === i.recurrenceId);
        return rec?.subcategoryId === sub.id && rec?.type === 'despesa';
      })
      .reduce((sum, i) => sum + i.amount, 0);

    const totalRealized = realizedFixed + confirmedRecurrenceAmount;
    const pendingAmount = Math.max(0, plannedFixed - totalRealized);

    if (plannedFixed > 0 || totalRealized > 0) {
      pendingItems.push({
        categoryId: cat.id,
        categoryName: cat.name,
        subcategoryId: sub.id,
        subcategoryName: sub.name,
        icon: cat.icon,
        plannedFixed,
        realizedFixed: totalRealized,
        pendingAmount,
      });
    }
  });

  // Add recurrence planned amounts for fixed recurrences
  const pendingRecurrenceInstances = recurrenceInstances.filter(i => i.status === 'pending');
  
  pendingRecurrenceInstances.forEach(instance => {
    const rec = recurrences.find(r => r.id === instance.recurrenceId);
    if (!rec || rec.type !== 'despesa') return;
    
    const cat = categories.find(c => c.id === rec.categoryId);
    if (!cat?.isFixed && !allSubcategories.find(s => s.id === rec.subcategoryId)?.isFixed) return;

    // Check if this is already in pendingItems
    const existingIdx = pendingItems.findIndex(p => 
      p.categoryId === rec.categoryId && 
      (p.subcategoryId === rec.subcategoryId || (!p.subcategoryId && !rec.subcategoryId))
    );

    if (existingIdx === -1) {
      // Add new pending item for this recurrence
      const sub = allSubcategories.find(s => s.id === rec.subcategoryId);
      pendingItems.push({
        categoryId: rec.categoryId,
        categoryName: cat?.name || 'Sem categoria',
        subcategoryId: rec.subcategoryId,
        subcategoryName: sub?.name,
        icon: cat?.icon,
        plannedFixed: instance.amount,
        realizedFixed: 0,
        pendingAmount: instance.amount,
      });
    }
  });

  // Calculate total pending
  const totalPending = pendingItems.reduce((sum, item) => sum + item.pendingAmount, 0);

  // Get pending recurrences list
  const pendingRecurrences: PendingRecurrenceItem[] = pendingRecurrenceInstances
    .map(instance => {
      const rec = recurrences.find(r => r.id === instance.recurrenceId);
      if (!rec || rec.type !== 'despesa') return null;
      
      const cat = categories.find(c => c.id === rec.categoryId);
      
      return {
        instanceId: instance.id,
        recurrenceId: rec.id,
        recurrenceName: rec.name,
        categoryId: rec.categoryId,
        categoryName: cat?.name || 'Sem categoria',
        amount: instance.amount,
      };
    })
    .filter((item): item is PendingRecurrenceItem => item !== null);

  const handleConfirmRecurrence = async (instanceId: string) => {
    setConfirmingId(instanceId);
    try {
      const instance = recurrenceInstances.find(i => i.id === instanceId);
      if (!instance) return;

      const rec = recurrences.find(r => r.id === instance.recurrenceId);
      if (!rec) return;

      // Create transaction
      const transaction = await addTransaction({
        date: new Date(),
        amount: instance.amount,
        type: rec.type,
        categoryId: rec.categoryId,
        subcategoryId: rec.subcategoryId,
        description: rec.name,
        origin: 'recurrence',
        needsReview: false,
        recurrenceId: rec.id,
        recurrenceInstanceId: instance.id,
      });

      // Update instance status
      await db.updateRecurrenceInstance({
        ...instance,
        status: 'confirmed',
        linkedTransactionId: transaction.id,
      });

      await refreshData();

      toast({
        title: 'Recorrência confirmada',
        description: `${rec.name} foi adicionado aos lançamentos.`,
      });
    } catch (error) {
      console.error('Error confirming recurrence:', error);
      toast({
        title: 'Erro',
        description: 'Não foi possível confirmar a recorrência.',
        variant: 'destructive',
      });
    } finally {
      setConfirmingId(null);
    }
  };

  return (
    <Sheet open={isOpen} onOpenChange={onClose}>
      <SheetContent className="w-full sm:max-w-lg overflow-y-auto">
        <SheetHeader className="space-y-4 pb-4 border-b border-border">
          <div className="flex items-center gap-2">
            <AlertTriangle className="h-5 w-5 text-warning" />
            <SheetTitle>Falta de Fixo (Pendências)</SheetTitle>
          </div>
          
          <div className="text-xs text-muted-foreground">
            {formatMonthYear(selectedMonth, selectedYear)}
          </div>

          {/* Total KPI */}
          <div className={cn(
            "rounded-lg p-4",
            totalPending > 0 ? "bg-warning/10" : "bg-success/10"
          )}>
            <span className="text-xs text-muted-foreground">Total que ainda falta pagar</span>
            <p className={cn(
              "text-2xl font-mono font-bold flex items-center gap-2",
              totalPending > 0 ? "text-warning" : "text-success"
            )}>
              {totalPending > 0 ? <AlertTriangle className="h-5 w-5" /> : <CheckCircle2 className="h-5 w-5" />}
              {formatCurrency(totalPending)}
            </p>
          </div>
        </SheetHeader>

        <div className="py-4 space-y-6">
          {/* Pending Items by Category */}
          <div>
            <h4 className="text-sm font-semibold mb-3">Pendências por Categoria/Subcategoria</h4>
            {pendingItems.length === 0 ? (
              <p className="text-center text-muted-foreground py-4">
                Nenhum item fixo planejado.
              </p>
            ) : (
              <div className="space-y-2">
                {pendingItems.map((item, idx) => (
                  <div
                    key={`${item.categoryId}-${item.subcategoryId || idx}`}
                    className="rounded-lg bg-muted/30 p-3"
                  >
                    <div className="flex items-center justify-between mb-2">
                      <div className="flex items-center gap-2">
                        <span className="text-base">{item.icon || '📦'}</span>
                        <div>
                          <span className="font-medium text-sm">{item.categoryName}</span>
                          {item.subcategoryName && (
                            <Badge variant="outline" className="ml-2 text-[10px]">
                              {item.subcategoryName}
                            </Badge>
                          )}
                        </div>
                      </div>
                      <Badge variant={item.pendingAmount > 0 ? 'destructive' : 'default'}>
                        {item.pendingAmount > 0 ? 'Pendente' : 'Pago'}
                      </Badge>
                    </div>
                    
                    <div className="grid grid-cols-3 gap-2 text-xs">
                      <div>
                        <span className="text-muted-foreground">Planejado</span>
                        <p className="font-mono font-medium">{formatCurrency(item.plannedFixed)}</p>
                      </div>
                      <div>
                        <span className="text-muted-foreground">Realizado</span>
                        <p className="font-mono font-medium text-success">{formatCurrency(item.realizedFixed)}</p>
                      </div>
                      <div>
                        <span className="text-muted-foreground">Falta</span>
                        <p className={cn(
                          "font-mono font-bold",
                          item.pendingAmount > 0 ? "text-warning" : "text-success"
                        )}>
                          {formatCurrency(item.pendingAmount)}
                        </p>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Pending Recurrences */}
          {pendingRecurrences.length > 0 && (
            <div>
              <h4 className="text-sm font-semibold mb-3 flex items-center gap-2">
                <Clock className="h-4 w-4" />
                Recorrências Pendentes
              </h4>
              <div className="space-y-2">
                {pendingRecurrences.map(rec => (
                  <div
                    key={rec.instanceId}
                    className="flex items-center justify-between py-3 px-3 rounded-lg bg-muted/30"
                  >
                    <div className="min-w-0 flex-1">
                      <span className="font-medium text-sm truncate block">{rec.recurrenceName}</span>
                      <span className="text-xs text-muted-foreground">{rec.categoryName}</span>
                    </div>
                    <div className="flex items-center gap-3">
                      <span className="font-mono font-medium text-sm">
                        {formatCurrency(rec.amount)}
                      </span>
                      <Button
                        size="sm"
                        variant="outline"
                        className="gap-1"
                        disabled={confirmingId === rec.instanceId}
                        onClick={() => handleConfirmRecurrence(rec.instanceId)}
                      >
                        <Check className="h-3 w-3" />
                        Confirmar
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </SheetContent>
    </Sheet>
  );
}
