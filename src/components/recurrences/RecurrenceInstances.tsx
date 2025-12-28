import { useState, useEffect } from 'react';
import { useApp } from '@/contexts/AppContext';
import { formatCurrency, formatMonthYear } from '@/lib/formatters';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Check, X, RefreshCw } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { cn } from '@/lib/utils';
import * as db from '@/lib/supabase-database';
import type { RecurrenceInstance, Recurrence } from '@/types/finance';

export function RecurrenceInstances() {
  const { 
    selectedMonth, 
    selectedYear, 
    recurrences, 
    categories,
    addTransaction,
    refreshData 
  } = useApp();
  const { toast } = useToast();
  
  const [instances, setInstances] = useState<RecurrenceInstance[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  // Generate or fetch instances for current month
  useEffect(() => {
    const loadInstances = async () => {
      setIsLoading(true);
      try {
        // Get existing instances for this month
        let existingInstances = await db.getRecurrenceInstances(selectedMonth, selectedYear);
        
        // Check each active recurrence and create instance if needed
        for (const rec of recurrences) {
          if (!rec.isActive) continue;
          
          const startDate = new Date(rec.startDate);
          const endDate = rec.endDate ? new Date(rec.endDate) : null;
          
          // Check if recurrence applies to this month
          const monthStart = new Date(selectedYear, selectedMonth, 1);
          const monthEnd = new Date(selectedYear, selectedMonth + 1, 0);
          
          if (startDate > monthEnd) continue;
          if (endDate && endDate < monthStart) continue;
          
          // Check if instance already exists
          const existingInstance = existingInstances.find(i => i.recurrenceId === rec.id);
          if (!existingInstance) {
            // Create new pending instance
            const newInstance = await db.addRecurrenceInstance({
              recurrenceId: rec.id,
              month: selectedMonth,
              year: selectedYear,
              status: 'pending',
              amount: rec.amount,
            });
            existingInstances.push(newInstance);
          }
        }
        
        setInstances(existingInstances);
      } catch (error) {
        console.error('Error loading instances:', error);
      } finally {
        setIsLoading(false);
      }
    };
    
    loadInstances();
  }, [selectedMonth, selectedYear, recurrences]);

  const handleConfirm = async (instance: RecurrenceInstance) => {
    const recurrence = recurrences.find(r => r.id === instance.recurrenceId);
    if (!recurrence) return;
    
    try {
      // Check if transaction already linked
      if (instance.linkedTransactionId) {
        toast({ title: 'Já confirmado', description: 'Este lançamento já foi confirmado.' });
        return;
      }
      
      // Create transaction
      const newTransaction = await addTransaction({
        date: new Date(selectedYear, selectedMonth, new Date(recurrence.startDate).getDate() || 1),
        amount: instance.amount,
        type: recurrence.type,
        categoryId: recurrence.categoryId,
        subcategoryId: recurrence.subcategoryId,
        description: recurrence.name,
        origin: 'recurrence',
        needsReview: false,
        recurrenceId: recurrence.id,
        recurrenceInstanceId: instance.id,
      });
      
      // Update instance
      const updatedInstance: RecurrenceInstance = {
        ...instance,
        status: 'confirmed',
        linkedTransactionId: newTransaction.id,
      };
      await db.updateRecurrenceInstance(updatedInstance);
      
      setInstances(prev => prev.map(i => i.id === instance.id ? updatedInstance : i));
      
      toast({ title: 'Recorrência confirmada!', description: 'Lançamento criado com sucesso.' });
    } catch (error) {
      toast({ title: 'Erro ao confirmar', variant: 'destructive' });
    }
  };

  const handleIgnore = async (instance: RecurrenceInstance) => {
    try {
      const updatedInstance: RecurrenceInstance = {
        ...instance,
        status: 'ignored',
      };
      await db.updateRecurrenceInstance(updatedInstance);
      setInstances(prev => prev.map(i => i.id === instance.id ? updatedInstance : i));
      toast({ title: 'Recorrência ignorada' });
    } catch (error) {
      toast({ title: 'Erro ao ignorar', variant: 'destructive' });
    }
  };

  const handleReopen = async (instance: RecurrenceInstance) => {
    try {
      const updatedInstance: RecurrenceInstance = {
        ...instance,
        status: 'pending',
      };
      await db.updateRecurrenceInstance(updatedInstance);
      setInstances(prev => prev.map(i => i.id === instance.id ? updatedInstance : i));
      toast({ title: 'Reaberto como pendente' });
    } catch (error) {
      toast({ title: 'Erro', variant: 'destructive' });
    }
  };

  if (isLoading) {
    return (
      <div className="p-8 text-center text-muted-foreground">
        Carregando...
      </div>
    );
  }

  if (instances.length === 0) {
    return (
      <div className="p-8 text-center text-muted-foreground">
        Nenhuma recorrência programada para {formatMonthYear(selectedMonth, selectedYear)}.
      </div>
    );
  }

  const pendingInstances = instances.filter(i => i.status === 'pending');
  const confirmedInstances = instances.filter(i => i.status === 'confirmed');
  const ignoredInstances = instances.filter(i => i.status === 'ignored');

  return (
    <div className="space-y-4">
      {/* Pending */}
      {pendingInstances.length > 0 && (
        <div className="space-y-2">
          <h4 className="text-sm font-medium text-muted-foreground px-1">
            Pendentes ({pendingInstances.length})
          </h4>
          {pendingInstances.map(instance => {
            const recurrence = recurrences.find(r => r.id === instance.recurrenceId);
            const category = categories.find(c => c.id === recurrence?.categoryId);
            if (!recurrence) return null;
            
            return (
              <div 
                key={instance.id}
                className="flex items-center justify-between p-3 rounded-lg border border-border bg-card"
              >
                <div className="flex items-center gap-3">
                  <div className="h-10 w-10 rounded-lg bg-warning/10 flex items-center justify-center">
                    <RefreshCw className="h-5 w-5 text-warning" />
                  </div>
                  <div>
                    <div className="font-medium">{recurrence.name}</div>
                    <div className="text-sm text-muted-foreground">
                      {category?.icon} {category?.name}
                    </div>
                  </div>
                </div>
                
                <div className="flex items-center gap-3">
                  <span className={cn(
                    "font-mono font-medium",
                    recurrence.type === 'receita' ? "text-success" : "text-foreground"
                  )}>
                    {recurrence.type === 'receita' ? '+' : '-'}{formatCurrency(instance.amount)}
                  </span>
                  <div className="flex gap-1">
                    <Button
                      size="sm"
                      variant="ghost"
                      className="h-8 w-8 p-0 text-success hover:text-success hover:bg-success/10"
                      onClick={() => handleConfirm(instance)}
                      title="Confirmar"
                    >
                      <Check className="h-4 w-4" />
                    </Button>
                    <Button
                      size="sm"
                      variant="ghost"
                      className="h-8 w-8 p-0 text-muted-foreground hover:text-destructive hover:bg-destructive/10"
                      onClick={() => handleIgnore(instance)}
                      title="Ignorar"
                    >
                      <X className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Confirmed */}
      {confirmedInstances.length > 0 && (
        <div className="space-y-2">
          <h4 className="text-sm font-medium text-muted-foreground px-1">
            Confirmados ({confirmedInstances.length})
          </h4>
          {confirmedInstances.map(instance => {
            const recurrence = recurrences.find(r => r.id === instance.recurrenceId);
            const category = categories.find(c => c.id === recurrence?.categoryId);
            if (!recurrence) return null;
            
            return (
              <div 
                key={instance.id}
                className="flex items-center justify-between p-3 rounded-lg border border-success/30 bg-success/5"
              >
                <div className="flex items-center gap-3">
                  <div className="h-10 w-10 rounded-lg bg-success/10 flex items-center justify-center">
                    <Check className="h-5 w-5 text-success" />
                  </div>
                  <div>
                    <div className="font-medium">{recurrence.name}</div>
                    <div className="text-sm text-muted-foreground">
                      {category?.icon} {category?.name}
                    </div>
                  </div>
                </div>
                
                <div className="flex items-center gap-3">
                  <Badge variant="outline" className="text-success border-success/30">
                    Confirmado
                  </Badge>
                  <span className={cn(
                    "font-mono font-medium",
                    recurrence.type === 'receita' ? "text-success" : "text-foreground"
                  )}>
                    {recurrence.type === 'receita' ? '+' : '-'}{formatCurrency(instance.amount)}
                  </span>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Ignored */}
      {ignoredInstances.length > 0 && (
        <div className="space-y-2">
          <h4 className="text-sm font-medium text-muted-foreground px-1">
            Ignorados ({ignoredInstances.length})
          </h4>
          {ignoredInstances.map(instance => {
            const recurrence = recurrences.find(r => r.id === instance.recurrenceId);
            const category = categories.find(c => c.id === recurrence?.categoryId);
            if (!recurrence) return null;
            
            return (
              <div 
                key={instance.id}
                className="flex items-center justify-between p-3 rounded-lg border border-border bg-muted/30 opacity-60"
              >
                <div className="flex items-center gap-3">
                  <div className="h-10 w-10 rounded-lg bg-muted flex items-center justify-center">
                    <X className="h-5 w-5 text-muted-foreground" />
                  </div>
                  <div>
                    <div className="font-medium">{recurrence.name}</div>
                    <div className="text-sm text-muted-foreground">
                      {category?.icon} {category?.name}
                    </div>
                  </div>
                </div>
                
                <div className="flex items-center gap-3">
                  <span className="font-mono text-muted-foreground">
                    {formatCurrency(instance.amount)}
                  </span>
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => handleReopen(instance)}
                  >
                    Reabrir
                  </Button>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
