import { useEffect, useState } from 'react';
import { toast } from 'sonner';
import { Plus } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { CurrencyInput } from '@/components/ui/currency-input';
import { parseBRLToNumber } from '@/lib/currencyInput';
import { formatCurrency, formatDateShort } from '@/lib/formatters';
import * as db from '@/lib/supabase-database';
import type { AccountPosition } from '@/lib/cash-position';

interface UpdateBalancesDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  cashAccounts: AccountPosition[];
  reserveAccounts: AccountPosition[];
  onSaved: () => Promise<void> | void;
  onAccountCreated: () => Promise<void> | void;
}

function todayInputValue(): string {
  const now = new Date();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const day = String(now.getDate()).padStart(2, '0');
  return `${now.getFullYear()}-${month}-${day}`;
}

function parseInputDate(value: string): Date | null {
  const [year, month, day] = value.split('-').map(Number);
  if (!year || !month || !day) return null;
  return new Date(year, month - 1, day);
}

type Draft = Record<string, { value: string; date: string }>;

export function UpdateBalancesDialog({
  open,
  onOpenChange,
  cashAccounts,
  reserveAccounts,
  onSaved,
  onAccountCreated,
}: UpdateBalancesDialogProps) {
  const [draft, setDraft] = useState<Draft>({});
  const [isSaving, setIsSaving] = useState(false);
  const [newReserveName, setNewReserveName] = useState('');
  const [newReserveInstitution, setNewReserveInstitution] = useState('');
  const [isCreating, setIsCreating] = useState(false);

  useEffect(() => {
    if (open) setDraft({});
  }, [open]);

  const setRow = (accountId: string, patch: Partial<{ value: string; date: string }>) => {
    setDraft(prev => ({
      ...prev,
      [accountId]: { value: prev[accountId]?.value ?? '', date: prev[accountId]?.date ?? todayInputValue(), ...patch },
    }));
  };

  const handleSave = async () => {
    const rows = Object.entries(draft)
      .filter(([, row]) => row.value.trim() !== '')
      .map(([accountId, row]) => ({ accountId, balance: parseBRLToNumber(row.value), referenceDate: parseInputDate(row.date) }));

    if (rows.length === 0) {
      toast.info('Digite o saldo de pelo menos uma conta.');
      return;
    }
    if (rows.some(row => !row.referenceDate)) {
      toast.error('Confira a data de todos os saldos digitados.');
      return;
    }

    setIsSaving(true);
    try {
      await db.addAccountBalances(rows.map(row => ({ accountId: row.accountId, balance: row.balance, referenceDate: row.referenceDate as Date })));
      toast.success(rows.length === 1 ? 'Saldo atualizado.' : `${rows.length} saldos atualizados.`);
      await onSaved();
      onOpenChange(false);
    } catch (error) {
      console.error('[UpdateBalancesDialog] Erro ao salvar saldos:', error);
      toast.error('Não foi possível salvar os saldos. Tente de novo.');
    } finally {
      setIsSaving(false);
    }
  };

  const handleCreateReserve = async () => {
    const name = newReserveName.trim();
    if (!name) {
      toast.info('Dê um nome para a caixinha.');
      return;
    }
    setIsCreating(true);
    try {
      await db.addAccount({ name, kind: 'caixinha', institution: newReserveInstitution.trim() || undefined });
      toast.success(`Caixinha "${name}" criada.`);
      setNewReserveName('');
      setNewReserveInstitution('');
      await onAccountCreated();
    } catch (error) {
      console.error('[UpdateBalancesDialog] Erro ao criar caixinha:', error);
      toast.error('Não foi possível criar a caixinha. Tente de novo.');
    } finally {
      setIsCreating(false);
    }
  };

  const renderRow = (position: AccountPosition) => {
    const row = draft[position.account.id];
    return (
      <div key={position.account.id} className="grid grid-cols-1 sm:grid-cols-[1fr_9rem_9rem] gap-2 items-end">
        <div className="min-w-0">
          <p className="text-sm font-medium truncate">{position.account.name}</p>
          <p className="text-xs text-muted-foreground">
            {position.balance !== null && position.referenceDate
              ? `Atual: ${formatCurrency(position.balance)} em ${formatDateShort(position.referenceDate)}`
              : 'Sem saldo informado'}
          </p>
        </div>
        <CurrencyInput
          aria-label={`Saldo de ${position.account.name}`}
          placeholder="0,00"
          value={row?.value ?? ''}
          onChange={value => setRow(position.account.id, { value })}
        />
        <Input
          type="date"
          aria-label={`Data do saldo de ${position.account.name}`}
          value={row?.date ?? todayInputValue()}
          onChange={event => setRow(position.account.id, { date: event.target.value })}
        />
      </div>
    );
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Atualizar saldos</DialogTitle>
          <DialogDescription>
            Digite o saldo que aparece no app do banco e a data. Só as contas preenchidas são salvas; os saldos anteriores ficam guardados.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-5">
          <section className="space-y-3">
            <h3 className="text-sm font-semibold">Contas (dinheiro livre)</h3>
            {cashAccounts.length === 0
              ? <p className="text-sm text-muted-foreground">Nenhuma conta corrente cadastrada.</p>
              : cashAccounts.map(renderRow)}
          </section>

          <section className="space-y-3">
            <h3 className="text-sm font-semibold">Caixinhas e reservas (não entram no livre)</h3>
            {reserveAccounts.length === 0
              ? <p className="text-sm text-muted-foreground">Nenhuma caixinha cadastrada ainda.</p>
              : reserveAccounts.map(renderRow)}

            <div className="rounded-lg border border-dashed p-3 space-y-2">
              <p className="text-xs font-medium text-muted-foreground">Adicionar caixinha</p>
              <div className="grid grid-cols-1 sm:grid-cols-[1fr_9rem_auto] gap-2 items-end">
                <div className="space-y-1">
                  <Label htmlFor="new-reserve-name" className="text-xs">Nome</Label>
                  <Input
                    id="new-reserve-name"
                    placeholder="Ex.: Reserva de Emergência"
                    value={newReserveName}
                    onChange={event => setNewReserveName(event.target.value)}
                  />
                </div>
                <div className="space-y-1">
                  <Label htmlFor="new-reserve-institution" className="text-xs">Banco</Label>
                  <Input
                    id="new-reserve-institution"
                    placeholder="Ex.: Nubank"
                    value={newReserveInstitution}
                    onChange={event => setNewReserveInstitution(event.target.value)}
                  />
                </div>
                <Button type="button" variant="outline" onClick={handleCreateReserve} disabled={isCreating}>
                  <Plus className="h-4 w-4 mr-1" />
                  {isCreating ? 'Criando...' : 'Adicionar'}
                </Button>
              </div>
            </div>
          </section>
        </div>

        <DialogFooter>
          <Button type="button" variant="ghost" onClick={() => onOpenChange(false)} disabled={isSaving}>Cancelar</Button>
          <Button type="button" onClick={handleSave} disabled={isSaving}>{isSaving ? 'Salvando...' : 'Salvar saldos'}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
