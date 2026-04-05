import { useState, useCallback } from 'react';
import {
  CheckCircle2, XCircle, AlertCircle, RotateCcw, ChevronDown,
  ChevronRight, Repeat2, Plus, BookOpen, Eye, EyeOff, Edit2
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useApp } from '@/contexts/AppContext';
import { useToast } from '@/hooks/use-toast';
import { formatCurrency } from '@/lib/formatters';
import { saveCategorizationRule } from '@/lib/invoice-database';
import { updateInvoiceTransactionStatus } from '@/lib/invoice-database';
import { cn } from '@/lib/utils';
import type { InvoiceTransaction, ReviewGroups } from '@/types/invoice';

// ─── Badge helpers ────────────────────────────────────────────────────────────

function MatchBadge({ confidence }: { confidence: string }) {
  if (confidence === 'exact' || confidence === 'very_likely') {
    return <Badge variant="secondary" className="text-xs bg-red-500/10 text-red-400 border-red-500/20">Já lançado</Badge>;
  }
  if (confidence === 'doubtful') {
    return <Badge variant="secondary" className="text-xs bg-yellow-500/10 text-yellow-400 border-yellow-500/20">Dúvida</Badge>;
  }
  return null;
}

function TypeBadge({ type }: { type: string }) {
  const map: Record<string, { label: string; color: string }> = {
    compra: { label: 'Compra', color: 'bg-blue-500/10 text-blue-400 border-blue-500/20' },
    estorno: { label: 'Estorno', color: 'bg-green-500/10 text-green-400 border-green-500/20' },
    iof: { label: 'IOF', color: 'bg-orange-500/10 text-orange-400 border-orange-500/20' },
    tarifa: { label: 'Tarifa', color: 'bg-zinc-500/10 text-zinc-400 border-zinc-500/20' },
    ajuste: { label: 'Ajuste', color: 'bg-purple-500/10 text-purple-400 border-purple-500/20' },
  };
  const info = map[type] ?? { label: type, color: 'bg-muted text-muted-foreground border-border' };
  return <Badge variant="outline" className={cn('text-xs', info.color)}>{info.label}</Badge>;
}

// ─── Single transaction row ───────────────────────────────────────────────────

interface TransactionRowProps {
  tx: InvoiceTransaction;
  onConfirm: (tx: InvoiceTransaction, categoryId?: string, subcategoryId?: string) => Promise<void>;
  onIgnore: (tx: InvoiceTransaction) => void;
  onSaveRule: (tx: InvoiceTransaction, categoryId: string) => Promise<void>;
  loading: boolean;
}

function TransactionRow({ tx, onConfirm, onIgnore, onSaveRule, loading }: TransactionRowProps) {
  const { categories, subcategories } = useApp();
  const [editing, setEditing] = useState(false);
  const [selectedCat, setSelectedCat] = useState(tx.suggestedCategoryId ?? '');
  const [selectedSub, setSelectedSub] = useState(tx.suggestedSubcategoryId ?? '');

  const cat = categories.find(c => c.id === (selectedCat || tx.suggestedCategoryId));
  const catSubs = subcategories.filter(s => s.categoryId === selectedCat);
  const expenseCategories = categories.filter(c => c.type === 'despesa');

  const dateStr = tx.transactionDate.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' });

  const handleConfirm = () => {
    onConfirm(tx, selectedCat || undefined, selectedSub || undefined);
  };

  return (
    <div className={cn(
      'glass-card rounded-lg p-3 transition-all',
      tx.existingMatchConfidence === 'doubtful' && 'border-l-2 border-l-yellow-500',
      tx.recurrenceMatchConfidence !== 'none' && tx.reviewStatus !== 'duplicate' && 'border-l-2 border-l-primary',
    )}>
      {!editing ? (
        <div className="flex items-start gap-3">
          {/* Date */}
          <span className="text-xs text-muted-foreground font-mono pt-0.5 w-10 shrink-0">{dateStr}</span>

          {/* Main info */}
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-1.5 flex-wrap mb-0.5">
              <TypeBadge type={tx.transactionType} />
              <MatchBadge confidence={tx.existingMatchConfidence} />
              {tx.recurrenceMatchConfidence !== 'none' && (
                <Badge variant="outline" className="text-xs bg-primary/10 text-primary border-primary/20">
                  <Repeat2 className="h-3 w-3 mr-1" />Recorrência
                </Badge>
              )}
              {tx.isInstallment && (
                <Badge variant="outline" className="text-xs">
                  {tx.installmentCurrent}/{tx.installmentTotal}
                </Badge>
              )}
              {cat && (
                <span className="text-xs text-muted-foreground">{cat.icon} {cat.name}</span>
              )}
            </div>
            <p className="text-sm font-medium truncate">{tx.descriptionOriginal}</p>
            <p className="text-xs text-muted-foreground truncate">
              {tx.merchantNormalized}
              {tx.cardLastFour && ` • **** ${tx.cardLastFour}`}
            </p>
          </div>

          {/* Amount */}
          <div className="flex items-center gap-2 shrink-0 ml-2">
            <span className={cn(
              'font-mono font-bold text-sm',
              tx.transactionType === 'estorno' ? 'text-success' : 'text-foreground',
            )}>
              {tx.transactionType === 'estorno' ? '+' : '-'}{formatCurrency(tx.amount)}
            </span>
            <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => setEditing(true)}>
              <Edit2 className="h-3.5 w-3.5" />
            </Button>
            <Button
              size="icon"
              variant="ghost"
              className="h-7 w-7 text-success hover:text-success"
              onClick={handleConfirm}
              disabled={loading}
            >
              <CheckCircle2 className="h-4 w-4" />
            </Button>
            <Button
              size="icon"
              variant="ghost"
              className="h-7 w-7 text-muted-foreground"
              onClick={() => onIgnore(tx)}
              disabled={loading}
            >
              <XCircle className="h-3.5 w-3.5" />
            </Button>
          </div>
        </div>
      ) : (
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <p className="text-sm font-medium">{tx.descriptionOriginal}</p>
            <span className="font-mono font-bold">{formatCurrency(tx.amount)}</span>
          </div>
          <div className="grid grid-cols-2 gap-2">
            <div>
              <p className="text-xs text-muted-foreground mb-1">Categoria</p>
              <Select value={selectedCat} onValueChange={(v) => { setSelectedCat(v); setSelectedSub(''); }}>
                <SelectTrigger className="h-8 text-xs">
                  <SelectValue placeholder="Selecione..." />
                </SelectTrigger>
                <SelectContent>
                  {expenseCategories.map(c => (
                    <SelectItem key={c.id} value={c.id} className="text-xs">
                      {c.icon} {c.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <p className="text-xs text-muted-foreground mb-1">Subcategoria</p>
              <Select
                value={selectedSub}
                onValueChange={setSelectedSub}
                disabled={catSubs.length === 0}
              >
                <SelectTrigger className="h-8 text-xs">
                  <SelectValue placeholder={catSubs.length === 0 ? 'Nenhuma' : 'Opcional'} />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="" className="text-xs">Nenhuma</SelectItem>
                  {catSubs.map(s => (
                    <SelectItem key={s.id} value={s.id} className="text-xs">{s.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <div className="flex gap-2 justify-end">
            {selectedCat && (
              <Button
                size="sm"
                variant="outline"
                className="text-xs h-7 gap-1"
                onClick={() => onSaveRule(tx, selectedCat)}
              >
                <BookOpen className="h-3 w-3" />
                Lembrar categoria
              </Button>
            )}
            <Button size="sm" variant="outline" className="h-7 text-xs" onClick={() => setEditing(false)}>
              Cancelar
            </Button>
            <Button size="sm" className="h-7 text-xs gap-1" onClick={handleConfirm} disabled={loading}>
              <CheckCircle2 className="h-3 w-3" />
              Confirmar
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Collapsible group ────────────────────────────────────────────────────────

interface GroupProps {
  title: string;
  icon: React.ReactNode;
  count: number;
  defaultOpen?: boolean;
  accent?: string;
  children: React.ReactNode;
}

function ReviewGroup({ title, icon, count, defaultOpen = true, accent, children }: GroupProps) {
  const [open, setOpen] = useState(defaultOpen);
  if (count === 0) return null;

  return (
    <div className="space-y-2">
      <button
        className="flex items-center gap-2 w-full text-left"
        onClick={() => setOpen(o => !o)}
      >
        {open ? <ChevronDown className="h-4 w-4 text-muted-foreground" /> : <ChevronRight className="h-4 w-4 text-muted-foreground" />}
        {icon}
        <span className={cn('font-semibold text-sm', accent)}>{title}</span>
        <Badge variant="secondary" className="ml-1 text-xs">{count}</Badge>
      </button>
      {open && <div className="space-y-2 pl-6">{children}</div>}
    </div>
  );
}

// ─── Main review screen ───────────────────────────────────────────────────────

interface C6ReviewScreenProps {
  groups: ReviewGroups;
  importId: string;
  logs?: string[];
  onAllConfirmed: () => void;
  onCancel: () => void;
}

export function C6ReviewScreen({
  groups,
  importId,
  logs = [],
  onAllConfirmed,
  onCancel,
}: C6ReviewScreenProps) {
  const { addTransaction, categories, recurrences } = useApp();
  const { toast } = useToast();
  const [localGroups, setLocalGroups] = useState(groups);
  const [loading, setLoading] = useState<string | null>(null);
  const [showLogs, setShowLogs] = useState(false);
  const [confirmedCount, setConfirmedCount] = useState(0);

  const allActionable = [
    ...localGroups.recurrenceRecognized,
    ...localGroups.newTransactions,
    ...localGroups.needsReview,
    ...localGroups.reversals,
  ];

  const removeFromGroups = useCallback((id: string) => {
    setLocalGroups(prev => ({
      alreadyLaunched: prev.alreadyLaunched.filter(t => t.id !== id),
      recurrenceRecognized: prev.recurrenceRecognized.filter(t => t.id !== id),
      newTransactions: prev.newTransactions.filter(t => t.id !== id),
      needsReview: prev.needsReview.filter(t => t.id !== id),
      reversals: prev.reversals.filter(t => t.id !== id),
      ignored: prev.ignored,
    }));
  }, []);

  const addToIgnored = useCallback((tx: InvoiceTransaction) => {
    setLocalGroups(prev => ({
      ...prev,
      ignored: [...prev.ignored, { ...tx, reviewStatus: 'ignored' }],
    }));
  }, []);

  const handleConfirm = useCallback(async (
    tx: InvoiceTransaction,
    categoryId?: string,
    subcategoryId?: string,
  ) => {
    setLoading(tx.id);
    try {
      const finalCategoryId = categoryId ?? tx.suggestedCategoryId;
      if (!finalCategoryId) {
        toast({
          title: 'Categoria necessária',
          description: 'Selecione uma categoria antes de confirmar.',
          variant: 'destructive',
        });
        return;
      }

      await addTransaction({
        date: tx.transactionDate,
        amount: tx.amount,
        type: tx.transactionType === 'estorno' ? 'receita' : 'despesa',
        categoryId: finalCategoryId,
        subcategoryId: subcategoryId ?? tx.suggestedSubcategoryId,
        description: tx.descriptionOriginal,
        origin: 'import',
        needsReview: false,
        recurrenceId: tx.suggestedRecurrenceId,
      });

      await updateInvoiceTransactionStatus(tx.id, 'confirmed');
      removeFromGroups(tx.id);
      setConfirmedCount(n => n + 1);

      toast({
        title: 'Lançado!',
        description: tx.descriptionOriginal.slice(0, 50),
      });
    } catch (err) {
      toast({ title: 'Erro ao lançar', variant: 'destructive' });
    } finally {
      setLoading(null);
    }
  }, [addTransaction, removeFromGroups, toast]);

  const handleIgnore = useCallback((tx: InvoiceTransaction) => {
    updateInvoiceTransactionStatus(tx.id, 'ignored').catch(() => {});
    removeFromGroups(tx.id);
    addToIgnored(tx);
  }, [removeFromGroups, addToIgnored]);

  const handleSaveRule = useCallback(async (tx: InvoiceTransaction, categoryId: string) => {
    try {
      await saveCategorizationRule(
        tx.merchantNormalized,
        categoryId,
        tx.suggestedSubcategoryId,
        tx.suggestedRecurrenceId,
        'manual',
        tx.descriptionOriginal,
      );
      toast({
        title: 'Regra salva!',
        description: `Próximas compras de "${tx.merchantNormalized}" serão categorizadas automaticamente.`,
      });
    } catch {
      toast({ title: 'Erro ao salvar regra', variant: 'destructive' });
    }
  }, [toast]);

  const handleConfirmAll = useCallback(async (txs: InvoiceTransaction[]) => {
    const missing = txs.filter(t => !t.suggestedCategoryId);
    if (missing.length > 0) {
      toast({
        title: `${missing.length} sem categoria`,
        description: 'Defina a categoria individualmente para os itens sem sugestão.',
        variant: 'destructive',
      });
      return;
    }

    setLoading('all');
    let count = 0;
    for (const tx of txs) {
      try {
        await handleConfirm(tx, tx.suggestedCategoryId, tx.suggestedSubcategoryId);
        count++;
      } catch {
        // continue
      }
    }
    setLoading(null);
    toast({ title: `${count} lançamentos confirmados!` });
  }, [handleConfirm, toast]);

  const pendingCount = allActionable.length;

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h2 className="text-lg font-semibold">Revisão da Fatura C6</h2>
          <p className="text-sm text-muted-foreground">
            {confirmedCount > 0 && `${confirmedCount} confirmados • `}
            {pendingCount} pendentes • {localGroups.alreadyLaunched.length} já lançados
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={onCancel}>
            Cancelar
          </Button>
          {pendingCount > 0 && (
            <Button
              size="sm"
              className="gap-1.5"
              disabled={loading === 'all'}
              onClick={() => handleConfirmAll(allActionable)}
            >
              <CheckCircle2 className="h-4 w-4" />
              Confirmar todos ({pendingCount})
            </Button>
          )}
          {pendingCount === 0 && confirmedCount > 0 && (
            <Button size="sm" className="gap-1.5" onClick={onAllConfirmed}>
              <CheckCircle2 className="h-4 w-4" />
              Concluir
            </Button>
          )}
        </div>
      </div>

      {/* Groups */}
      <div className="space-y-5">
        {/* Recurrence recognized */}
        <ReviewGroup
          title="Recorrências reconhecidas"
          icon={<Repeat2 className="h-4 w-4 text-primary" />}
          count={localGroups.recurrenceRecognized.length}
          accent="text-primary"
          defaultOpen
        >
          {localGroups.recurrenceRecognized.map(tx => (
            <TransactionRow
              key={tx.id}
              tx={tx}
              onConfirm={handleConfirm}
              onIgnore={handleIgnore}
              onSaveRule={handleSaveRule}
              loading={loading === tx.id || loading === 'all'}
            />
          ))}
        </ReviewGroup>

        {/* New transactions */}
        <ReviewGroup
          title="Novos lançamentos"
          icon={<Plus className="h-4 w-4 text-foreground" />}
          count={localGroups.newTransactions.length}
          defaultOpen
        >
          {localGroups.newTransactions.map(tx => (
            <TransactionRow
              key={tx.id}
              tx={tx}
              onConfirm={handleConfirm}
              onIgnore={handleIgnore}
              onSaveRule={handleSaveRule}
              loading={loading === tx.id || loading === 'all'}
            />
          ))}
        </ReviewGroup>

        {/* Reversals */}
        <ReviewGroup
          title="Estornos"
          icon={<RotateCcw className="h-4 w-4 text-success" />}
          count={localGroups.reversals.length}
          accent="text-success"
          defaultOpen
        >
          {localGroups.reversals.map(tx => (
            <TransactionRow
              key={tx.id}
              tx={tx}
              onConfirm={handleConfirm}
              onIgnore={handleIgnore}
              onSaveRule={handleSaveRule}
              loading={loading === tx.id || loading === 'all'}
            />
          ))}
        </ReviewGroup>

        {/* Needs review */}
        <ReviewGroup
          title="Verificar possível duplicidade"
          icon={<AlertCircle className="h-4 w-4 text-yellow-400" />}
          count={localGroups.needsReview.length}
          accent="text-yellow-400"
          defaultOpen
        >
          {localGroups.needsReview.map(tx => (
            <TransactionRow
              key={tx.id}
              tx={tx}
              onConfirm={handleConfirm}
              onIgnore={handleIgnore}
              onSaveRule={handleSaveRule}
              loading={loading === tx.id || loading === 'all'}
            />
          ))}
        </ReviewGroup>

        {/* Already launched */}
        <ReviewGroup
          title="Já lançados (ocultos)"
          icon={<Eye className="h-4 w-4 text-muted-foreground" />}
          count={localGroups.alreadyLaunched.length}
          defaultOpen={false}
        >
          {localGroups.alreadyLaunched.map(tx => (
            <div key={tx.id} className="glass-card rounded-lg p-3 opacity-50">
              <div className="flex items-center gap-3">
                <span className="text-xs text-muted-foreground font-mono w-10 shrink-0">
                  {tx.transactionDate.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' })}
                </span>
                <div className="flex-1 min-w-0">
                  <p className="text-sm truncate">{tx.descriptionOriginal}</p>
                </div>
                <span className="font-mono text-sm shrink-0">{formatCurrency(tx.amount)}</span>
                <Button
                  size="icon"
                  variant="ghost"
                  className="h-7 w-7"
                  onClick={() => handleConfirm(tx)}
                  title="Lançar mesmo assim"
                >
                  <Plus className="h-3.5 w-3.5" />
                </Button>
              </div>
            </div>
          ))}
        </ReviewGroup>

        {/* Ignored */}
        <ReviewGroup
          title="Ignorados"
          icon={<EyeOff className="h-4 w-4 text-muted-foreground" />}
          count={localGroups.ignored.length}
          defaultOpen={false}
        >
          {localGroups.ignored.map(tx => (
            <div key={tx.id} className="glass-card rounded-lg p-3 opacity-40">
              <div className="flex items-center gap-3">
                <span className="text-xs text-muted-foreground font-mono w-10 shrink-0">
                  {tx.transactionDate.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' })}
                </span>
                <p className="text-sm flex-1 truncate">{tx.descriptionOriginal}</p>
                <span className="font-mono text-sm shrink-0">{formatCurrency(tx.amount)}</span>
              </div>
            </div>
          ))}
        </ReviewGroup>
      </div>

      {/* Debug logs */}
      {logs.length > 0 && (
        <div className="mt-4">
          <button
            className="flex items-center gap-1 text-xs text-muted-foreground"
            onClick={() => setShowLogs(l => !l)}
          >
            {showLogs ? <ChevronDown className="h-3 w-3" /> : <ChevronRight className="h-3 w-3" />}
            Log de processamento ({logs.length} linhas)
          </button>
          {showLogs && (
            <div className="mt-2 glass-card rounded-lg p-3 max-h-48 overflow-y-auto">
              {logs.map((l, i) => (
                <p key={i} className="text-xs text-muted-foreground font-mono">{l}</p>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
