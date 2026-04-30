import { useState } from 'react';
import { useApp } from '@/contexts/AppContext';
import { formatDateShort } from '@/lib/formatters';
import { Settings, CreditCard, Info, Check } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { useToast } from '@/hooks/use-toast';

export function SettingsPage() {
  const { billingCloseDay, setBillingCloseDay, billingDateRange, selectedMonth, selectedYear } = useApp();
  const { toast } = useToast();

  const [draftDay, setDraftDay] = useState<string>(
    billingCloseDay !== null ? String(billingCloseDay) : '__none__'
  );

  const handleSave = () => {
    if (draftDay === '__none__' || draftDay === '') {
      setBillingCloseDay(null);
      toast({ title: 'Configurações salvas. Ciclo de fatura desativado.' });
    } else {
      const day = Number(draftDay);
      setBillingCloseDay(day);
      toast({ title: `Ciclo de fatura configurado: fechamento no dia ${day}.` });
    }
  };

  const days = Array.from({ length: 28 }, (_, i) => i + 1);

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
            Quando ativado, cada "mês" exibe os lançamentos do período entre o fechamento do mês
            anterior e o fechamento do mês selecionado — igual ao ciclo da sua fatura.
            <br />
            Exemplo: fechamento no dia 20 → "Abril" mostra de 21/Mar a 20/Abr.
          </p>
        </div>

        <div className="space-y-2">
          <Label>Dia de fechamento da fatura</Label>
          <div className="flex items-center gap-3">
            <Select value={draftDay} onValueChange={setDraftDay}>
              <SelectTrigger className="w-[180px]">
                <SelectValue placeholder="Selecionar dia" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="__none__">Desativado (mês normal)</SelectItem>
                {days.map(d => (
                  <SelectItem key={d} value={String(d)}>
                    Dia {d}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Button onClick={handleSave} className="gap-1.5">
              <Check className="h-4 w-4" /> Salvar
            </Button>
          </div>
        </div>

        {billingDateRange && (
          <div className="p-3 rounded-lg bg-success/10 text-sm">
            <p className="font-medium text-success">Ciclo ativo — fechamento no dia {billingCloseDay}</p>
            <p className="text-muted-foreground mt-0.5">
              Período atual ({new Date(selectedYear, selectedMonth, 1).toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' })}):
              {' '}{formatDateShort(billingDateRange.start)} → {formatDateShort(billingDateRange.end)}
            </p>
          </div>
        )}

        {(!billingCloseDay || billingCloseDay === null) && draftDay === '__none__' && (
          <p className="text-sm text-muted-foreground">
            Ciclo desativado. Os lançamentos são exibidos por mês calendário (dia 1 ao último dia do mês).
          </p>
        )}
      </div>
    </div>
  );
}
