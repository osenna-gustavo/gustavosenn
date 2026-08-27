import { useEffect, useState } from 'react';
import { useApp } from '@/contexts/AppContext';
import { formatDateShort } from '@/lib/formatters';
import { Settings, CreditCard, Info, Check, CalendarDays } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { useToast } from '@/hooks/use-toast';

export function SettingsPage() {
  const { billingDateRange, financialCycle, saveFinancialCycle, selectedMonth, selectedYear } = useApp();
  const { toast } = useToast();

  const toInputDate = (date: Date) => {
    const y = date.getFullYear(); const m = String(date.getMonth() + 1).padStart(2, '0'); const d = String(date.getDate()).padStart(2, '0');
    return `${y}-${m}-${d}`;
  };
  const calendarStart = new Date(selectedYear, selectedMonth, 1);
  const calendarEnd = new Date(selectedYear, selectedMonth + 1, 0);
  const [draftStart, setDraftStart] = useState(toInputDate(financialCycle?.startDate ?? calendarStart));
  const [draftEnd, setDraftEnd] = useState(toInputDate(financialCycle?.endDate ?? calendarEnd));

  // Keep dropdown in sync when cloud value loads/changes
  useEffect(() => {
    setDraftStart(toInputDate(financialCycle?.startDate ?? calendarStart));
    setDraftEnd(toInputDate(financialCycle?.endDate ?? calendarEnd));
  }, [financialCycle, selectedMonth, selectedYear]);

  const handleSave = async () => {
    const start = new Date(`${draftStart}T00:00:00`);
    const end = new Date(`${draftEnd}T00:00:00`);
    if (!draftStart || !draftEnd || Number.isNaN(start.getTime()) || Number.isNaN(end.getTime()) || end < start) {
      toast({ title: 'Período inválido', description: 'A data final deve ser igual ou posterior à inicial.', variant: 'destructive' });
      return;
    }
    try {
      await saveFinancialCycle({ month: selectedMonth, year: selectedYear, startDate: start, endDate: end });
      toast({ title: 'Ciclo salvo', description: 'Este ciclo passa a ser a competência do mês selecionado.' });
    } catch {
      toast({ title: 'Erro ao salvar ciclo', description: 'Tente novamente.', variant: 'destructive' });
    }
  };

  return (
    <div className="space-y-6 max-w-2xl">
      <div className="flex items-center gap-3">
        <Settings className="h-6 w-6 text-primary" />
        <h1 className="text-2xl font-bold">Configurações</h1>
      </div>

      {/* Billing cycle card */}
      <div className="glass-card rounded-xl p-6 space-y-5">
        <div className="flex items-center gap-2">
          <CreditCard className="h-5 w-5 text-primary" />
          <h2 className="text-lg font-semibold">Ciclo de Fatura do Cartão</h2>
        </div>

        <div className="flex items-start gap-2 p-3 rounded-lg bg-primary/5 text-sm text-muted-foreground">
          <Info className="h-4 w-4 mt-0.5 shrink-0 text-primary/60" />
          <p>
            O fechamento pode mudar de data quando cai em fim de semana. Por isso, cada mês tem seu próprio período real de competência.
            Compras no cartão entram na competência na data da compra; o caixa só muda quando você lançar o pagamento da fatura.
          </p>
        </div>

        <div className="space-y-2">
          <Label>Período do ciclo de {new Date(selectedYear, selectedMonth, 1).toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' })}</Label>
          <div className="grid sm:grid-cols-[1fr_1fr_auto] items-end gap-3">
            <div><Label className="text-xs text-muted-foreground">Início</Label><input type="date" value={draftStart} onChange={e => setDraftStart(e.target.value)} className="mt-1 flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm" /></div>
            <div><Label className="text-xs text-muted-foreground">Fim / fechamento</Label><input type="date" value={draftEnd} onChange={e => setDraftEnd(e.target.value)} className="mt-1 flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm" /></div>
            <Button onClick={handleSave} className="gap-1.5">
              <Check className="h-4 w-4" /> Salvar
            </Button>
          </div>
        </div>

        {billingDateRange && (
          <div className="p-3 rounded-lg bg-success/10 text-sm">
            <p className="font-medium text-success flex items-center gap-2"><CalendarDays className="h-4 w-4" /> Ciclo personalizado ativo</p>
            <p className="text-muted-foreground mt-0.5">
              Período atual ({new Date(selectedYear, selectedMonth, 1).toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' })}):
              {' '}{formatDateShort(billingDateRange.start)} → {formatDateShort(billingDateRange.end)}
            </p>
          </div>
        )}

        {!financialCycle && <p className="text-sm text-muted-foreground">Ainda não há um fechamento personalizado salvo para este mês; o sistema usa o mês calendário como referência.</p>}
      </div>
    </div>
  );
}
