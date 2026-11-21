import { useCallback, useEffect, useRef, useState } from 'react';
import { AlertTriangle, ChevronDown, Clock3, PiggyBank, RefreshCw, Wallet } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { useApp } from '@/contexts/AppContext';
import { cn } from '@/lib/utils';
import { formatCurrency, formatDateShort } from '@/lib/formatters';
import * as db from '@/lib/supabase-database';
import {
  canComputeCashPosition,
  computeCashPosition,
  getCycleRangeForDate,
  getLastPaidInvoiceClose,
  STALE_BALANCE_DAYS,
  type CashPosition,
} from '@/lib/cash-position';
import { UpdateBalancesDialog } from './UpdateBalancesDialog';

const DEFAULT_CLOSE_DAY = 20;

export function CashPositionPanel() {
  const { accounts, categories, recurrences, transactions, billingCloseDay, refreshData, isInitialized, isLoading } = useApp();
  const [position, setPosition] = useState<CashPosition | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [showDetails, setShowDetails] = useState(false);
  const requestIdRef = useRef(0);

  const load = useCallback(async () => {
    // Só calcula depois que o app terminou de carregar (evita R$ 0,00 provisório e nunca trava sem contas).
    if (!canComputeCashPosition({ isInitialized, isLoading })) return;
    const requestId = ++requestIdRef.current;
    try {
      const today = new Date();
      const closeDay = billingCloseDay ?? DEFAULT_CLOSE_DAY;
      const { month, year, range } = getCycleRangeForDate(today, closeDay);

      let start = range.start;
      let end = range.end;
      try {
        const savedCycle = await db.getFinancialCycle(month, year);
        if (savedCycle) {
          start = savedCycle.startDate;
          end = new Date(savedCycle.endDate.getFullYear(), savedCycle.endDate.getMonth(), savedCycle.endDate.getDate(), 23, 59, 59, 999);
        }
      } catch (cycleError) {
        console.error('[CashPositionPanel] Falha ao ler ciclo salvo, usando dia de fechamento:', cycleError);
      }

      const previous = month === 0 ? { month: 11, year: year - 1 } : { month: month - 1, year };
      const lookbackStart = new Date(start.getFullYear(), start.getMonth(), start.getDate() - 25);
      const [latestBalances, currentInstances, previousInstances, recentTransactions, cardTransactions] = await Promise.all([
        db.getLatestAccountBalances(),
        db.getRecurrenceInstances(month, year),
        db.getRecurrenceInstances(previous.month, previous.year),
        db.getTransactions(undefined, undefined, { start: lookbackStart, end }),
        db.getCreditCardTransactionsSince(getLastPaidInvoiceClose(today)),
      ]);
      const instances = [...currentInstances, ...previousInstances];

      // Uma resposta antiga não pode sobrescrever uma mais nova.
      if (requestId !== requestIdRef.current) return;
      setPosition(computeCashPosition({
        today,
        cycle: { month, year, start, end },
        accounts,
        latestBalances,
        categories,
        recurrences,
        instances,
        recentTransactions,
        cardTransactions,
      }));
      setLoadError(null);
    } catch (error) {
      if (requestId !== requestIdRef.current) return;
      console.error('[CashPositionPanel] Falha ao calcular posição de caixa:', error);
      setLoadError(error instanceof Error ? error.message : String(error));
    }
  }, [accounts, categories, recurrences, billingCloseDay, isInitialized, isLoading]);

  // Recalcula quando os dados do app mudam (lançamento novo, recorrência editada etc.).
  useEffect(() => {
    void load();
  }, [load, transactions]);

  if (loadError) {
    return (
      <div className="stat-card border-l-4 border-l-destructive">
        <p className="text-sm font-medium">Não foi possível calcular dinheiro na conta e comprometido.</p>
        <p className="text-xs text-muted-foreground mt-1">{loadError}</p>
        <Button size="sm" variant="outline" className="mt-3" onClick={() => void load()}>Tentar de novo</Button>
      </div>
    );
  }

  if (!position) {
    return (
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {[...Array(3)].map((_, index) => (
          <div key={index} className="stat-card animate-pulse">
            <div className="h-4 bg-muted rounded w-24 mb-2" />
            <div className="h-8 bg-muted rounded w-32" />
          </div>
        ))}
      </div>
    );
  }

  const cycleStartLabel = formatDateShort(position.cycle.start);
  const cycleEndLabel = formatDateShort(position.cycle.end);
  const freeIsNegative = position.hasAnyCashBalance && position.freeTotal < 0;
  const freeTone = !position.hasAnyCashBalance ? 'neutral' : freeIsNegative ? 'negative' : 'positive';

  return (
    <section className="space-y-3" aria-label="Dinheiro na conta e comprometido">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <h2 className="text-lg font-semibold">Dinheiro hoje</h2>
          <p className="text-xs text-muted-foreground">
            O que está na conta, o que vence até {cycleEndLabel} e o que sobra de verdade.
          </p>
        </div>
        <Button size="sm" variant="outline" onClick={() => setIsDialogOpen(true)}>
          <RefreshCw className="h-4 w-4 mr-1" />
          Atualizar saldos
        </Button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {/* Dinheiro na conta */}
        <div className="stat-card border-l-4 border-l-primary/50" data-testid="card-na-conta">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Dinheiro na conta</span>
            <Wallet className="h-4 w-4 text-primary" />
          </div>
          {position.hasAnyCashBalance ? (
            <span className="text-xl lg:text-2xl font-bold font-mono">{formatCurrency(position.cashTotal)}</span>
          ) : (
            <button type="button" className="text-sm font-medium text-primary underline" onClick={() => setIsDialogOpen(true)}>
              Informe os saldos das contas
            </button>
          )}
          <ul className="mt-2 space-y-1">
            {position.cashAccounts.map(item => (
              <li key={item.account.id} className="flex flex-wrap justify-between gap-x-2 text-xs">
                <span className="text-muted-foreground">{item.account.name}</span>
                <span className={cn('font-mono whitespace-nowrap', item.isStale && 'text-warning')}>
                  {item.balance !== null && item.referenceDate
                    ? `${formatCurrency(item.balance)} · atualizado em ${formatDateShort(item.referenceDate)}`
                    : 'sem saldo'}
                </span>
              </li>
            ))}
          </ul>
          {position.hasStaleBalance && (
            <p className="mt-2 flex items-center gap-1 text-xs text-warning">
              <AlertTriangle className="h-3 w-3" />
              Saldo desatualizado (mais de {STALE_BALANCE_DAYS} dias)
            </p>
          )}
          <div className="mt-3 border-t pt-2">
            <div className="flex items-center justify-between text-xs">
              <span className="flex items-center gap-1 text-muted-foreground">
                <PiggyBank className="h-3 w-3" />
                Reservas (não entram no livre)
              </span>
              <span className="font-mono">{formatCurrency(position.reserveTotal)}</span>
            </div>
            {position.reserveAccounts.length === 0 ? (
              <p className="text-xs text-muted-foreground mt-1">Nenhuma caixinha cadastrada.</p>
            ) : (
              <ul className="mt-1 space-y-1">
                {position.reserveAccounts.map(item => (
                  <li key={item.account.id} className="flex flex-wrap justify-between gap-x-2 text-xs">
                    <span className="text-muted-foreground">{item.account.name}</span>
                    <span className="font-mono whitespace-nowrap">
                      {item.balance !== null && item.referenceDate
                        ? `${formatCurrency(item.balance)} · atualizado em ${formatDateShort(item.referenceDate)}`
                        : 'sem saldo'}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>

        {/* Dinheiro comprometido */}
        <div className="stat-card border-l-4 border-l-warning" data-testid="card-comprometido">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Dinheiro comprometido</span>
            <Clock3 className="h-4 w-4 text-warning" />
          </div>
          <span className="text-xl lg:text-2xl font-bold font-mono text-warning">{formatCurrency(position.committedTotal)}</span>
          <p className="text-xs text-muted-foreground mt-1">tudo que vence de {cycleStartLabel} a {cycleEndLabel}</p>
          <ul className="mt-2 space-y-1 text-xs">
            <li className="flex justify-between gap-2">
              <span className="text-muted-foreground">Contas fixas pendentes ({position.recurringItems.length})</span>
              <span className="font-mono">{formatCurrency(position.recurringTotal)}</span>
            </li>
            <li className="flex justify-between gap-2">
              <span className="text-muted-foreground">Parcelas pendentes ({position.installmentItems.length})</span>
              <span className="font-mono">{formatCurrency(position.installmentTotal)}</span>
            </li>
            {position.openInvoices.length === 0 ? (
              <li className="flex justify-between gap-2">
                <span className="text-muted-foreground">Fatura do cartão em aberto</span>
                <span className="font-mono">{formatCurrency(0)}</span>
              </li>
            ) : position.openInvoices.map(invoice => (
              <li key={invoice.dueDate.toISOString()} className="flex justify-between gap-2">
                <span className="text-muted-foreground">Fatura C6 vence {formatDateShort(invoice.dueDate)} ({invoice.count})</span>
                <span className="font-mono">{formatCurrency(invoice.amount)}</span>
              </li>
            ))}
          </ul>
          <p className="text-[11px] text-muted-foreground mt-2">Aportes em reserva não contam como gasto.</p>
        </div>

        {/* Livre de fato */}
        <div
          className={cn('stat-card border-l-4', freeTone === 'negative' && 'border-l-destructive', freeTone === 'positive' && 'border-l-success', freeTone === 'neutral' && 'border-l-primary/50')}
          data-testid="card-livre"
        >
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Livre de fato</span>
            <Wallet className={cn('h-4 w-4', freeTone === 'negative' && 'text-destructive', freeTone === 'positive' && 'text-success', freeTone === 'neutral' && 'text-muted-foreground')} />
          </div>
          <span className={cn('text-xl lg:text-2xl font-bold font-mono', freeTone === 'negative' && 'text-destructive', freeTone === 'positive' && 'text-success', freeTone === 'neutral' && 'text-muted-foreground')}>
            {position.hasAnyCashBalance ? formatCurrency(position.freeTotal) : '—'}
          </span>
          <p className="text-xs text-muted-foreground mt-1">
            {position.hasAnyCashBalance
              ? 'na conta menos comprometido'
              : 'aparece depois de informar os saldos'}
          </p>
          {freeIsNegative && (
            <p className="text-xs text-destructive mt-2">Faltam {formatCurrency(Math.abs(position.freeTotal))} para cobrir o que já tem destino.</p>
          )}
        </div>
      </div>

      <Collapsible open={showDetails} onOpenChange={setShowDetails}>
        <CollapsibleTrigger asChild>
          <Button variant="ghost" size="sm" className="text-xs">
            <ChevronDown className={cn('h-4 w-4 mr-1 transition-transform', showDetails && 'rotate-180')} />
            {showDetails ? 'Esconder o que está comprometido' : 'Ver o que está comprometido'}
          </Button>
        </CollapsibleTrigger>
        <CollapsibleContent>
          <div className="stat-card mt-2 grid grid-cols-1 md:grid-cols-2 gap-4 text-xs">
            <div>
              <p className="font-semibold mb-1">Contas fixas pendentes</p>
              {position.recurringItems.length === 0 ? <p className="text-muted-foreground">Nenhuma.</p> : (
                <ul className="space-y-1">
                  {position.recurringItems.map(item => (
                    <li key={item.recurrenceId} className="flex justify-between gap-2">
                      <span className="truncate">{formatDateShort(item.dueDate)} · {item.name}</span>
                      <span className="font-mono">{formatCurrency(item.amount)}</span>
                    </li>
                  ))}
                </ul>
              )}
            </div>
            <div>
              <p className="font-semibold mb-1">Parcelas pendentes</p>
              {position.installmentItems.length === 0 ? <p className="text-muted-foreground">Nenhuma.</p> : (
                <ul className="space-y-1">
                  {position.installmentItems.map(item => (
                    <li key={item.recurrenceId} className="flex justify-between gap-2">
                      <span className="truncate">{formatDateShort(item.dueDate)} · {item.name}</span>
                      <span className="font-mono">{formatCurrency(item.amount)}</span>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </div>
        </CollapsibleContent>
      </Collapsible>

      <UpdateBalancesDialog
        open={isDialogOpen}
        onOpenChange={setIsDialogOpen}
        cashAccounts={position.cashAccounts}
        reserveAccounts={position.reserveAccounts}
        onSaved={load}
        onAccountCreated={refreshData}
      />
    </section>
  );
}
