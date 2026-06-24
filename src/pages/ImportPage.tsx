import { useState, useRef, useCallback } from 'react';
import {
  Upload, Loader2, AlertCircle,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { useApp } from '@/contexts/AppContext';
import { useToast } from '@/hooks/use-toast';
import { parseImportText } from '@/lib/csvImportParser';
import { enrichTransactions, buildReviewGroups } from '@/lib/invoiceMatching';
import {
  createInvoiceImport,
  updateInvoiceImport,
  saveInvoiceTransactions,
  saveTransactionMatches,
  getCategorizationRules,
} from '@/lib/invoice-database';
import { C6ReviewScreen } from '@/components/import/C6ReviewScreen';
import type { ReviewGroups } from '@/types/invoice';

// ─── Types ────────────────────────────────────────────────────────────────────

type ImportStatus = 'idle' | 'processing' | 'review' | 'error';

const IMPORT_SOURCE = 'Importação';

// ─── Paste format instructions ────────────────────────────────────────────────

const PASTE_EXAMPLE = `25/02/2026; Mercearia Luzitana; 43,76
01/03/2026; Mercado Livre; 130,00
02/03/2026; Shopee; 27,98
26/02/2026; Shopee Estorno; -56,01`;

// ─── Component ────────────────────────────────────────────────────────────────

export function ImportPage() {
  const {
    categories, transactions, recurrences,
    selectedMonth, selectedYear,
  } = useApp();
  const { toast } = useToast();

  const [status, setStatus] = useState<ImportStatus>('idle');
  const [progressLabel, setProgressLabel] = useState('');
  const [errorMessage, setErrorMessage] = useState('');
  const [pasteText, setPasteText] = useState('');
  const [importLogs, setImportLogs] = useState<string[]>([]);

  const [reviewGroups, setReviewGroups] = useState<ReviewGroups | null>(null);
  const [importId, setImportId] = useState<string | null>(null);

  const fileInputRef = useRef<HTMLInputElement>(null);

  // ── Core import processor ───────────────────────────────────────────────────

  const processText = useCallback(async (text: string, fileName: string) => {
    setStatus('processing');
    setProgressLabel('Identificando transações...');
    const logs: string[] = [];

    try {
      const sourceName = IMPORT_SOURCE;
      const parseResult = parseImportText(text, sourceName, selectedYear);
      logs.push(...parseResult.logs);

      if (parseResult.transactions.length === 0) {
        throw new Error(
          `Nenhuma transação identificada.\n` +
          `Verifique se o formato está correto:\n` +
          `DD/MM/AAAA; Descrição; Valor\n` +
          `(separador: ponto-e-vírgula ou TAB)`,
        );
      }

      logs.push(`[Import] Transactions parsed: ${parseResult.transactions.length}`);
      setProgressLabel('Verificando duplicatas e recorrências...');

      // Load knowledge base rules
      let rules: Awaited<ReturnType<typeof getCategorizationRules>> = [];
      try {
        rules = await getCategorizationRules();
        logs.push(`[Import] Knowledge base: ${rules.length} rules`);
      } catch {
        logs.push('[Import] Knowledge base unavailable (tables may not exist yet)');
      }

      // Detect competencia
      const competencia = `${selectedYear}-${String(selectedMonth + 1).padStart(2, '0')}`;

      // Create import session
      let sessionId = `local-${Date.now()}`;
      try {
        const importRecord = await createInvoiceImport({
          source: IMPORT_SOURCE,
          competencia,
          fileName,
          fileHash: `text-${Date.now()}`,
          status: 'processing',
          totalExtracted: parseResult.transactions.length,
          totalNew: 0,
          totalDuplicates: 0,
          totalConfirmed: 0,
          processingLog: logs,
        });
        sessionId = importRecord.id;
      } catch (e: any) {
        logs.push(`[Import] Warning: session not persisted (${e?.message ?? 'unknown'})`);
      }

      setImportId(sessionId);
      setProgressLabel('Aplicando base de conhecimento...');

      // Enrich: duplicate detection + recurrence matching + knowledge base
      const { enriched, matches, logs: enrichLogs } = enrichTransactions(
        parseResult.transactions,
        transactions,
        recurrences,
        rules,
        categories,
        sessionId,
      );
      logs.push(...enrichLogs);

      setProgressLabel('Salvando...');

      try {
        await saveInvoiceTransactions(enriched);
        await saveTransactionMatches(matches as any);
      } catch {
        logs.push('[Import] Warning: could not persist enriched transactions.');
      }

      const dupCount  = enriched.filter(t => t.reviewStatus === 'duplicate').length;
      const newCount  = enriched.filter(t => t.reviewStatus !== 'duplicate').length;

      try {
        await updateInvoiceImport(sessionId, {
          status: 'reviewed',
          totalNew: newCount,
          totalDuplicates: dupCount,
          processingLog: logs,
        });
      } catch { /* non-fatal */ }

      setImportLogs(logs);
      setReviewGroups(buildReviewGroups(enriched));
      setStatus('review');

      toast({
        title: 'Importação processada!',
        description: `${parseResult.transactions.length} transações • ${dupCount} já lançadas • ${newCount} para revisar`,
      });
    } catch (error) {
      setImportLogs(logs);
      setStatus('error');
      setErrorMessage(error instanceof Error ? error.message : 'Erro ao processar importação.');
      toast({
        title: 'Erro na importação',
        description: error instanceof Error ? error.message.split('\n')[0] : 'Tente novamente.',
        variant: 'destructive',
      });
    }
  }, [selectedYear, selectedMonth, transactions, recurrences, categories, toast]);

  // ── CSV file upload ─────────────────────────────────────────────────────────

  const handleFileChange = useCallback(async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setErrorMessage('');
    setReviewGroups(null);

    if (!file.name.toLowerCase().endsWith('.txt') && file.type !== 'text/plain') {
      toast({ title: 'Formato inválido', description: 'Selecione um arquivo .txt', variant: 'destructive' });
      return;
    }

    const text = await file.text();
    await processText(text, file.name);
  }, [processText, toast]);

  const handleDrop = useCallback(async (e: React.DragEvent) => {
    e.preventDefault();
    const file = e.dataTransfer.files[0];
    if (!file) return;
    const text = await file.text();
    await processText(text, file.name);
  }, [processText]);

  // ── Paste submit ────────────────────────────────────────────────────────────

  const handlePasteSubmit = useCallback(() => {
    if (!pasteText.trim()) {
      toast({ title: 'Nenhum texto colado', variant: 'destructive' });
      return;
    }
    setErrorMessage('');
    setReviewGroups(null);
    processText(pasteText, 'colagem-manual');
  }, [pasteText, processText, toast]);

  // ── Reset ───────────────────────────────────────────────────────────────────

  const handleReset = useCallback(() => {
    setReviewGroups(null);
    setImportLogs([]);
    setImportId(null);
    setStatus('idle');
    setProgressLabel('');
    setErrorMessage('');
    setPasteText('');
    if (fileInputRef.current) fileInputRef.current.value = '';
  }, []);

  // ── Import ───────────────────────────────────────────────────────────────────

  return (
    <div className="space-y-6 animate-fade-in">

      {/* Header */}
      <div>
        <h1 className="text-2xl lg:text-3xl font-bold">Importar</h1>
        <p className="text-muted-foreground">Cole ou envie o extrato/fatura em formato de texto (.txt)</p>
      </div>

      {/* Input area: single drop zone — arraste um .txt ou cole o texto */}
      {status === 'idle' && (
        <div
          className="glass-card rounded-xl p-6 border-2 border-dashed border-border hover:border-primary/50 transition-colors space-y-4"
          onDrop={handleDrop}
          onDragOver={(e) => e.preventDefault()}
        >
          <input
            ref={fileInputRef}
            type="file"
            accept=".txt,text/plain"
            onChange={handleFileChange}
            className="hidden"
          />

          <div className="flex flex-col items-center text-center">
            <div className="h-14 w-14 rounded-full bg-primary/10 flex items-center justify-center mb-3">
              <Upload className="h-7 w-7 text-primary" />
            </div>
            <h3 className="text-base font-semibold mb-1">Arraste um arquivo .txt aqui</h3>
            <p className="text-sm text-muted-foreground">
              ou{' '}
              <button
                type="button"
                className="text-primary underline underline-offset-2"
                onClick={() => fileInputRef.current?.click()}
              >
                selecione um arquivo
              </button>
              {' '}— ou cole o texto abaixo
            </p>
          </div>

          <div>
            <p className="text-xs text-muted-foreground mb-2">
              Uma transação por linha, separada por <code className="bg-muted px-1 rounded">;</code> ou TAB:
            </p>
            <pre className="text-xs bg-muted rounded-lg p-3 overflow-x-auto text-muted-foreground">
{`DD/MM/AAAA; Descrição; Valor
${PASTE_EXAMPLE}

→ Valor positivo = despesa
→ Valor negativo = estorno (ex: -56,01)
→ Data pode ser DD/MM ou DD/MM/AAAA`}
            </pre>
          </div>

          <div>
            <Textarea
              value={pasteText}
              onChange={(e) => setPasteText(e.target.value)}
              placeholder={PASTE_EXAMPLE}
              className="font-mono text-sm min-h-[200px] resize-y"
            />
          </div>

          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={() => setPasteText('')} disabled={!pasteText}>
              Limpar
            </Button>
            <Button onClick={handlePasteSubmit} disabled={!pasteText.trim()}>
              Processar transações
            </Button>
          </div>
        </div>
      )}

      {/* Processing */}
      {status === 'processing' && (
        <div className="glass-card rounded-xl p-8">
          <div className="flex flex-col items-center text-center">
            <Loader2 className="h-12 w-12 text-primary animate-spin mb-4" />
            <h3 className="text-lg font-semibold mb-2">Processando...</h3>
            {progressLabel && (
              <p className="text-sm text-muted-foreground">{progressLabel}</p>
            )}
          </div>
        </div>
      )}

      {/* Error */}
      {status === 'error' && (
        <div className="glass-card rounded-xl p-8 border-destructive/50">
          <div className="flex flex-col items-center text-center">
            <AlertCircle className="h-12 w-12 text-destructive mb-4" />
            <h3 className="text-lg font-semibold mb-2">Erro na importação</h3>
            <p className="text-muted-foreground mb-4 max-w-md whitespace-pre-wrap text-sm">{errorMessage}</p>
            {importLogs.length > 0 && (
              <details className="w-full max-w-md mb-4">
                <summary className="text-xs text-muted-foreground cursor-pointer">Ver log de debug</summary>
                <div className="mt-2 text-left space-y-0.5 max-h-40 overflow-y-auto">
                  {importLogs.map((l, i) => (
                    <p key={i} className="text-xs font-mono text-muted-foreground">{l}</p>
                  ))}
                </div>
              </details>
            )}
            <Button onClick={handleReset}>Tentar novamente</Button>
          </div>
        </div>
      )}

      {/* Review Screen */}
      {status === 'review' && reviewGroups && (
        <C6ReviewScreen
          groups={reviewGroups}
          importId={importId ?? ''}
          logs={importLogs}
          onAllConfirmed={handleReset}
          onCancel={handleReset}
        />
      )}
    </div>
  );
}
