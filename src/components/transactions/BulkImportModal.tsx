import { useState, useRef, useCallback } from 'react';
import {
  Upload, FileImage, FileText, Loader2, CheckCircle2,
  AlertCircle, Trash2, Edit2, Copy, RefreshCw,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useApp } from '@/contexts/AppContext';
import { useToast } from '@/hooks/use-toast';
import { formatCurrency, formatDateShort } from '@/lib/formatters';
import { parseOCRText } from '@/lib/ocrParser';
import { CurrencyInput } from '@/components/ui/currency-input';
import { parseBRLToNumber } from '@/lib/currencyInput';
import { cn } from '@/lib/utils';
import type { SuggestedTransaction, TransactionType, Transaction, Recurrence, RecurrenceInstance } from '@/types/finance';
import { updateRecurrenceInstance } from '@/lib/supabase-database';
import { createWorker } from 'tesseract.js';
import * as pdfjsLib from 'pdfjs-dist';

pdfjsLib.GlobalWorkerOptions.workerSrc = `https://cdn.jsdelivr.net/npm/pdfjs-dist@${pdfjsLib.version}/build/pdf.worker.min.mjs`;

// ─── Category learning (localStorage) ─────────────────────────────────────────

const MAPPINGS_KEY = 'fluxocaixa_category_mappings';

interface CategoryMapping {
  categoryId: string;
  subcategoryId?: string;
  type: TransactionType;
  confidence: number;
}
type LearnedMappings = Record<string, CategoryMapping>;

function loadMappings(): LearnedMappings {
  try { return JSON.parse(localStorage.getItem(MAPPINGS_KEY) || '{}'); } catch { return {}; }
}
function saveMappings(m: LearnedMappings): void {
  localStorage.setItem(MAPPINGS_KEY, JSON.stringify(m));
}
function extractKeywords(description: string): string[] {
  return description
    .toLowerCase()
    .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9\s]/g, ' ')
    .split(/\s+/)
    .filter(w => w.length > 3)
    .slice(0, 6);
}
function applyLearnedMappings(
  suggestions: SuggestedTransaction[],
  mappings: LearnedMappings,
): SuggestedTransaction[] {
  return suggestions.map(s => {
    if (s.description) {
      for (const kw of extractKeywords(s.description)) {
        if (mappings[kw]) {
          return {
            ...s,
            suggestedCategoryId: mappings[kw].categoryId,
            suggestedSubcategoryId: mappings[kw].subcategoryId,
            type: mappings[kw].type,
            needsReview: false,
          };
        }
      }
    }
    return s;
  });
}
function learnFromItem(
  description: string,
  categoryId: string,
  subcategoryId: string | undefined,
  type: TransactionType,
  mappings: LearnedMappings,
): LearnedMappings {
  const updated = { ...mappings };
  for (const kw of extractKeywords(description)) {
    updated[kw] = {
      categoryId, subcategoryId, type,
      confidence: (updated[kw]?.confidence ?? 0) + 1,
    };
  }
  return updated;
}

// ─── Recurrence learning (localStorage) ───────────────────────────────────────

const RECURRENCE_MAPPINGS_KEY = 'fluxocaixa_recurrence_mappings';
type RecurrenceMappings = Record<string, string>; // keyword → recurrenceId

function loadRecurrenceMappings(): RecurrenceMappings {
  try { return JSON.parse(localStorage.getItem(RECURRENCE_MAPPINGS_KEY) || '{}'); } catch { return {}; }
}
function saveRecurrenceMappings(m: RecurrenceMappings): void {
  localStorage.setItem(RECURRENCE_MAPPINGS_KEY, JSON.stringify(m));
}
function learnRecurrenceMapping(
  description: string,
  recurrenceId: string,
  mappings: RecurrenceMappings,
): RecurrenceMappings {
  const updated = { ...mappings };
  for (const kw of extractKeywords(description)) {
    updated[kw] = recurrenceId;
  }
  return updated;
}
function applyLearnedRecurrenceMappings(
  suggestion: SuggestedTransaction,
  recurrenceMappings: RecurrenceMappings,
  recurrences: Recurrence[],
  instances: RecurrenceInstance[],
  month: number,
  year: number,
): { recurrence: Recurrence; instance: RecurrenceInstance } | null {
  if (!suggestion.description) return null;
  for (const kw of extractKeywords(suggestion.description)) {
    const recurrenceId = recurrenceMappings[kw];
    if (recurrenceId) {
      const rec = recurrences.find(r => r.id === recurrenceId && r.isActive);
      if (rec) {
        const instance = instances.find(
          i => i.recurrenceId === rec.id && i.month === month && i.year === year && i.status === 'pending',
        );
        if (instance) return { recurrence: rec, instance };
      }
    }
  }
  return null;
}

// ─── Duplicate detection ──────────────────────────────────────────────────────

function isDuplicate(suggestion: SuggestedTransaction, existing: Transaction[]): boolean {
  if (!suggestion.amount || !suggestion.date) return false;
  const suggDate = new Date(suggestion.date);
  return existing.some(t => {
    if (Math.abs(t.amount - suggestion.amount!) > 0.01) return false;
    const daysDiff = Math.abs((new Date(t.date).getTime() - suggDate.getTime()) / 86400000);
    return daysDiff <= 1;
  });
}

// ─── Recurrence auto-matching ─────────────────────────────────────────────────

function norm(s: string): string {
  return s.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
}

function matchRecurrence(
  suggestion: SuggestedTransaction,
  recurrences: Recurrence[],
  instances: RecurrenceInstance[],
  month: number,
  year: number,
): { recurrence: Recurrence; instance: RecurrenceInstance } | null {
  if (!suggestion.amount || !suggestion.description) return null;
  const descNorm = norm(suggestion.description);

  for (const rec of recurrences) {
    if (!rec.isActive) continue;

    const amtMatch = Math.abs(rec.amount - suggestion.amount) / rec.amount <= 0.05;
    if (!amtMatch) continue;

    const recWords = norm(rec.name).split(/\s+/).filter(w => w.length > 3);
    const descWords = descNorm.split(/\s+/).filter(w => w.length > 3);
    const overlap = recWords.some(rw => descWords.some(dw => dw.includes(rw) || rw.includes(dw)));
    if (!overlap) continue;

    const instance = instances.find(
      i => i.recurrenceId === rec.id && i.month === month && i.year === year && i.status === 'pending',
    );
    if (instance) return { recurrence: rec, instance };
  }
  return null;
}

// ─── Types ────────────────────────────────────────────────────────────────────

interface EnhancedSuggestion extends SuggestedTransaction {
  isDuplicate: boolean;
  skipImport: boolean;
  matchedRecurrence?: Recurrence;
  matchedInstance?: RecurrenceInstance;
}

type ImportStatus = 'idle' | 'processing' | 'ready' | 'error';

interface BulkImportModalProps {
  isOpen: boolean;
  onClose: () => void;
}

// ─── Component ────────────────────────────────────────────────────────────────

export function BulkImportModal({ isOpen, onClose }: BulkImportModalProps) {
  const {
    categories, subcategories, addTransaction, transactions,
    recurrences, recurrenceInstances, selectedMonth, selectedYear,
  } = useApp();
  const { toast } = useToast();

  const [status, setStatus] = useState<ImportStatus>('idle');
  const [progress, setProgress] = useState(0);
  const [errorMessage, setErrorMessage] = useState('');
  const [suggestions, setSuggestions] = useState<EnhancedSuggestion[]>([]);
  const [editingId, setEditingId] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // ── OCR & PDF ──

  const processOCR = useCallback(async (imageData: string | ImageData): Promise<string> => {
    const worker = await createWorker('por', 1, {
      logger: (m) => { if (m.status === 'recognizing text') setProgress(Math.round(m.progress * 100)); },
    });
    try {
      const { data: { text } } = await worker.recognize(imageData);
      return text;
    } finally { await worker.terminate(); }
  }, []);

  const extractTextFromPDF = useCallback(async (arrayBuffer: ArrayBuffer): Promise<string> => {
    const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;
    let fullText = '';
    const numPages = Math.min(pdf.numPages, 15);
    for (let i = 1; i <= numPages; i++) {
      setProgress(Math.round((i / numPages) * 50));
      const page = await pdf.getPage(i);
      const textContent = await page.getTextContent();
      const pageText = textContent.items.map((item: any) => item.str).join(' ');
      if (pageText.trim().length > 20) {
        fullText += pageText + '\n';
      } else {
        const viewport = page.getViewport({ scale: 2.0 });
        const canvas = document.createElement('canvas');
        const ctx = canvas.getContext('2d')!;
        canvas.height = viewport.height;
        canvas.width = viewport.width;
        await page.render({ canvasContext: ctx, viewport }).promise;
        fullText += (await processOCR(canvas.toDataURL('image/png'))) + '\n';
      }
    }
    return fullText;
  }, [processOCR]);

  // ── File handling ──

  const handleFileUpload = useCallback(async (file: File) => {
    setStatus('processing');
    setProgress(0);
    setErrorMessage('');
    setSuggestions([]);

    try {
      let extractedText = '';
      if (file.type.startsWith('image/')) {
        const url = URL.createObjectURL(file);
        extractedText = await processOCR(url);
        URL.revokeObjectURL(url);
      } else if (file.type === 'application/pdf') {
        extractedText = await extractTextFromPDF(await file.arrayBuffer());
      } else {
        throw new Error('Formato não suportado. Use imagens (PNG/JPG) ou PDFs.');
      }

      if (!extractedText.trim()) throw new Error('Não foi possível extrair texto do arquivo.');

      let parsed = parseOCRText(extractedText, categories);
      if (parsed.length === 0) throw new Error('Nenhum lançamento identificado. Verifique se o arquivo contém valores monetários.');

      // Apply learned category mappings
      const mappings = loadMappings();
      parsed = applyLearnedMappings(parsed, mappings);

      // Apply recurrence matching: auto-match first, then learned keyword fallback
      const recMappings = loadRecurrenceMappings();
      const enhanced: EnhancedSuggestion[] = parsed.map(s => {
        const dup = isDuplicate(s, transactions);
        const match = matchRecurrence(s, recurrences, recurrenceInstances, selectedMonth, selectedYear)
          ?? applyLearnedRecurrenceMappings(s, recMappings, recurrences, recurrenceInstances, selectedMonth, selectedYear);
        return {
          ...s,
          isDuplicate: dup,
          skipImport: dup,
          matchedRecurrence: match?.recurrence,
          matchedInstance: match?.instance,
        };
      });

      setSuggestions(enhanced);
      setStatus('ready');

      const dupCount = enhanced.filter(e => e.isDuplicate).length;
      const recCount = enhanced.filter(e => e.matchedRecurrence).length;
      const newCount = enhanced.length - dupCount;
      toast({
        title: 'Processamento concluído!',
        description: [
          `${newCount} lançamento(s) identificado(s).`,
          dupCount > 0 ? `${dupCount} duplicado(s).` : '',
          recCount > 0 ? `${recCount} vinculado(s) a recorrências.` : '',
        ].filter(Boolean).join(' '),
      });
    } catch (error) {
      setStatus('error');
      const msg = error instanceof Error ? error.message : 'Erro ao processar arquivo.';
      setErrorMessage(msg);
      toast({ title: 'Erro no processamento', description: msg, variant: 'destructive' });
    }
  }, [categories, processOCR, extractTextFromPDF, transactions, recurrences, recurrenceInstances, selectedMonth, selectedYear, toast]);

  const handleFileChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) handleFileUpload(file);
  }, [handleFileUpload]);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    const file = e.dataTransfer.files[0];
    if (file) handleFileUpload(file);
  }, [handleFileUpload]);

  // ── CRUD on suggestions ──

  const updateSuggestion = useCallback((id: string, updates: Partial<EnhancedSuggestion>) => {
    setSuggestions(prev => prev.map(s => s.id === id ? { ...s, ...updates } : s));
  }, []);

  const toggleSkip = useCallback((id: string) => {
    setSuggestions(prev => prev.map(s => s.id === id ? { ...s, skipImport: !s.skipImport } : s));
  }, []);

  // ── Confirm ──

  const handleConfirmAll = useCallback(async () => {
    const toImport = suggestions.filter(s => !s.skipImport);
    if (toImport.length === 0) {
      toast({ title: 'Nenhum item para confirmar', variant: 'destructive' });
      return;
    }

    let mappings = loadMappings();
    let recMappings = loadRecurrenceMappings();

    try {
      for (const item of toImport) {
        const newTx = await addTransaction({
          date: item.date || new Date(),
          amount: item.amount || 0,
          type: item.type,
          categoryId: item.suggestedCategoryId || '',
          subcategoryId: item.suggestedSubcategoryId,
          description: item.description,
          origin: 'import',
          needsReview: item.needsReview,
        });

        // Mark recurrence instance as confirmed + learn the keyword mapping
        if (item.matchedInstance) {
          try {
            await updateRecurrenceInstance({
              ...item.matchedInstance,
              status: 'confirmed',
              linkedTransactionId: newTx.id,
            });
          } catch {
            // non-fatal: transaction was added, just the recurrence link failed
          }
          if (item.description) {
            recMappings = learnRecurrenceMapping(item.description, item.matchedInstance.recurrenceId, recMappings);
          }
        }

        // Learn category mapping
        if (item.description && item.suggestedCategoryId) {
          mappings = learnFromItem(item.description, item.suggestedCategoryId, item.suggestedSubcategoryId, item.type, mappings);
        }
      }

      saveMappings(mappings);
      saveRecurrenceMappings(recMappings);

      const linkedCount = toImport.filter(i => i.matchedInstance).length;
      toast({
        title: 'Lançamentos criados!',
        description: [
          `${toImport.length} lançamento(s) adicionado(s).`,
          linkedCount > 0 ? `${linkedCount} recorrência(s) marcada(s) como confirmada(s).` : '',
        ].filter(Boolean).join(' '),
      });

      handleReset();
      onClose();
    } catch {
      toast({ title: 'Erro ao criar lançamentos', description: 'Tente novamente.', variant: 'destructive' });
    }
  }, [suggestions, addTransaction, onClose, toast]);

  const handleReset = useCallback(() => {
    setSuggestions([]);
    setStatus('idle');
    setProgress(0);
    setErrorMessage('');
    setEditingId(null);
    if (fileInputRef.current) fileInputRef.current.value = '';
  }, []);

  const handleClose = useCallback(() => { handleReset(); onClose(); }, [handleReset, onClose]);

  // ── Derived ──

  const expenseCategories = categories.filter(c => c.type === 'despesa');
  const incomeCategories = categories.filter(c => c.type === 'receita');
  const activeRecurrences = recurrences.filter(r => r.isActive);
  const toImportCount = suggestions.filter(s => !s.skipImport).length;
  const dupCount = suggestions.filter(s => s.isDuplicate).length;
  const recCount = suggestions.filter(s => s.matchedRecurrence && !s.skipImport).length;

  // ── Render ──

  return (
    <Dialog open={isOpen} onOpenChange={open => !open && handleClose()}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Lançamento em Massa</DialogTitle>
        </DialogHeader>

        {/* Upload */}
        {status === 'idle' && (
          <>
            <div
              className="rounded-xl p-8 border-2 border-dashed border-border hover:border-primary/50 transition-colors cursor-pointer"
              onDrop={handleDrop}
              onDragOver={e => e.preventDefault()}
              onClick={() => fileInputRef.current?.click()}
            >
              <input ref={fileInputRef} type="file" accept="image/*,application/pdf" onChange={handleFileChange} className="hidden" />
              <div className="flex flex-col items-center text-center">
                <div className="h-14 w-14 rounded-full bg-primary/10 flex items-center justify-center mb-3">
                  <Upload className="h-7 w-7 text-primary" />
                </div>
                <h3 className="text-base font-semibold mb-1">Arraste o extrato aqui</h3>
                <p className="text-muted-foreground text-sm mb-4">ou clique para selecionar</p>
                <div className="flex gap-3">
                  <Button variant="outline" size="sm" className="gap-2 pointer-events-none"><FileImage className="h-4 w-4" />Imagem</Button>
                  <Button variant="outline" size="sm" className="gap-2 pointer-events-none"><FileText className="h-4 w-4" />PDF</Button>
                </div>
              </div>
            </div>
            <p className="text-xs text-muted-foreground text-center">
              Identifica automaticamente receitas, despesas, categorias, duplicatas e recorrências. Aprende com cada confirmação.
            </p>
          </>
        )}

        {/* Processing */}
        {status === 'processing' && (
          <div className="py-8 flex flex-col items-center gap-4">
            <Loader2 className="h-10 w-10 text-primary animate-spin" />
            <p className="font-medium">Processando extrato...</p>
            <div className="w-full max-w-xs bg-muted rounded-full h-2">
              <div className="bg-primary h-2 rounded-full transition-all duration-300" style={{ width: `${progress}%` }} />
            </div>
            <p className="text-sm text-muted-foreground">{progress}%</p>
          </div>
        )}

        {/* Error */}
        {status === 'error' && (
          <div className="py-8 flex flex-col items-center gap-4">
            <AlertCircle className="h-10 w-10 text-destructive" />
            <p className="font-medium">Erro no processamento</p>
            <p className="text-sm text-muted-foreground text-center">{errorMessage}</p>
            <Button onClick={handleReset}>Tentar novamente</Button>
          </div>
        )}

        {/* Review */}
        {status === 'ready' && suggestions.length > 0 && (
          <div className="space-y-4">
            {/* Summary bar */}
            <div className="flex items-center justify-between flex-wrap gap-2">
              <div className="flex gap-3 text-sm text-muted-foreground flex-wrap">
                <span>{suggestions.length} identificado(s)</span>
                {dupCount > 0 && <span className="text-warning">{dupCount} duplicado(s)</span>}
                {recCount > 0 && <span className="text-info">🔄 {recCount} recorrência(s)</span>}
                <span className="text-success font-medium">{toImportCount} para importar</span>
              </div>
              <div className="flex gap-2">
                <Button variant="outline" size="sm" onClick={handleReset}>Cancelar</Button>
                <Button size="sm" onClick={handleConfirmAll} className="gap-2" disabled={toImportCount === 0}>
                  <CheckCircle2 className="h-4 w-4" />
                  Confirmar {toImportCount > 0 ? `(${toImportCount})` : ''}
                </Button>
              </div>
            </div>

            <div className="space-y-2">
              {suggestions.map(item => {
                const isEditing = editingId === item.id;
                const selectedCategory = [...expenseCategories, ...incomeCategories].find(c => c.id === item.suggestedCategoryId);
                const catSubs = subcategories.filter(s => s.categoryId === item.suggestedCategoryId);

                return (
                  <div
                    key={item.id}
                    className={cn(
                      'rounded-lg border p-3 transition-opacity',
                      item.skipImport && 'opacity-40',
                      item.isDuplicate && !item.skipImport && 'border-warning/50',
                      item.matchedRecurrence && !item.isDuplicate && 'border-info/50',
                      item.needsReview && !item.isDuplicate && !item.matchedRecurrence && 'border-l-4 border-l-warning',
                    )}
                  >
                    {isEditing ? (
                      <div className="space-y-3">
                        <div className="grid grid-cols-2 gap-3">
                          <div>
                            <Label className="text-xs">Data</Label>
                            <Input
                              type="date"
                              value={item.date ? new Date(item.date).toISOString().split('T')[0] : ''}
                              onChange={e => updateSuggestion(item.id, { date: e.target.value ? new Date(e.target.value) : undefined })}
                            />
                          </div>
                          <div>
                            <Label className="text-xs">Valor (R$)</Label>
                            <CurrencyInput value={item.amount || 0} onChange={val => updateSuggestion(item.id, { amount: parseBRLToNumber(val) })} />
                          </div>
                        </div>
                        <div>
                          <Label className="text-xs">Descrição</Label>
                          <Input value={item.description || ''} onChange={e => updateSuggestion(item.id, { description: e.target.value })} />
                        </div>
                        <div className="grid grid-cols-3 gap-3">
                          <div>
                            <Label className="text-xs">Tipo</Label>
                            <Select
                              value={item.type}
                              onValueChange={val => updateSuggestion(item.id, { type: val as TransactionType, suggestedCategoryId: undefined, suggestedSubcategoryId: undefined })}
                            >
                              <SelectTrigger><SelectValue /></SelectTrigger>
                              <SelectContent>
                                <SelectItem value="despesa">Despesa</SelectItem>
                                <SelectItem value="receita">Receita</SelectItem>
                              </SelectContent>
                            </Select>
                          </div>
                          <div>
                            <Label className="text-xs">Categoria</Label>
                            <Select
                              value={item.suggestedCategoryId || ''}
                              onValueChange={val => updateSuggestion(item.id, { suggestedCategoryId: val, suggestedSubcategoryId: undefined, needsReview: false })}
                            >
                              <SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger>
                              <SelectContent>
                                {(item.type === 'despesa' ? expenseCategories : incomeCategories).map(cat => (
                                  <SelectItem key={cat.id} value={cat.id}>{cat.icon} {cat.name}</SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                          </div>
                          <div>
                            <Label className="text-xs">Subcategoria</Label>
                            <Select
                              value={item.suggestedSubcategoryId || '__none__'}
                              onValueChange={val => updateSuggestion(item.id, { suggestedSubcategoryId: val === '__none__' ? undefined : val })}
                              disabled={catSubs.length === 0}
                            >
                              <SelectTrigger><SelectValue placeholder={catSubs.length === 0 ? '(Sem subcategorias)' : 'Opcional'} /></SelectTrigger>
                              <SelectContent>
                                <SelectItem value="__none__">Nenhuma</SelectItem>
                                {catSubs.map(sub => <SelectItem key={sub.id} value={sub.id}>{sub.name}</SelectItem>)}
                              </SelectContent>
                            </Select>
                          </div>
                        </div>

                        {/* Recurrence linking */}
                        <div>
                          <Label className="text-xs flex items-center gap-1">
                            <RefreshCw className="h-3 w-3" />
                            Vincular Recorrência
                          </Label>
                          <Select
                            value={item.matchedRecurrence?.id || '__none__'}
                            onValueChange={val => {
                              if (val === '__none__') {
                                updateSuggestion(item.id, { matchedRecurrence: undefined, matchedInstance: undefined });
                              } else {
                                const rec = activeRecurrences.find(r => r.id === val);
                                const inst = recurrenceInstances.find(
                                  i => i.recurrenceId === val && i.month === selectedMonth && i.year === selectedYear && i.status === 'pending',
                                );
                                updateSuggestion(item.id, { matchedRecurrence: rec, matchedInstance: inst });
                              }
                            }}
                          >
                            <SelectTrigger>
                              <SelectValue placeholder="Nenhuma recorrência vinculada" />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="__none__">Nenhuma</SelectItem>
                              {activeRecurrences.map(rec => (
                                <SelectItem key={rec.id} value={rec.id}>
                                  {rec.name} — {formatCurrency(rec.amount)}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                          {item.matchedRecurrence && !item.matchedInstance && (
                            <p className="text-xs text-warning mt-1">
                              ⚠ Sem instância pendente para {selectedMonth}/{selectedYear}. O vínculo não será marcado como confirmado.
                            </p>
                          )}
                          {item.matchedRecurrence && item.matchedInstance && (
                            <p className="text-xs text-info mt-1">
                              ✓ A recorrência será marcada como confirmada ao importar.
                            </p>
                          )}
                        </div>

                        <div className="flex justify-end">
                          <Button size="sm" variant="outline" onClick={() => setEditingId(null)}>Concluir edição</Button>
                        </div>
                      </div>
                    ) : (
                      <div className="flex items-center justify-between gap-3">
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className={cn(
                              'px-1.5 py-0.5 rounded text-xs font-medium',
                              item.type === 'receita' ? 'bg-success/10 text-success' : 'bg-destructive/10 text-destructive',
                            )}>
                              {item.type === 'receita' ? 'Receita' : 'Despesa'}
                            </span>
                            {selectedCategory && (
                              <span className="text-xs text-muted-foreground">{selectedCategory.icon} {selectedCategory.name}</span>
                            )}
                            {item.matchedRecurrence && (
                              <span className="flex items-center gap-1 text-xs text-info font-medium">
                                <RefreshCw className="h-3 w-3" />
                                {item.matchedRecurrence.name}
                              </span>
                            )}
                            {item.isDuplicate && (
                              <span className="flex items-center gap-1 text-xs text-warning">
                                <Copy className="h-3 w-3" />Duplicado
                              </span>
                            )}
                            {item.needsReview && !item.isDuplicate && !item.matchedRecurrence && (
                              <span className="text-xs text-warning">⚠ Revisar categoria</span>
                            )}
                          </div>
                          <p className="text-sm truncate mt-0.5">
                            {item.date && formatDateShort(item.date)}
                            {item.description ? ` • ${item.description}` : ''}
                          </p>
                        </div>
                        <div className="flex items-center gap-2 shrink-0">
                          <span className="font-mono text-sm font-semibold">{formatCurrency(item.amount || 0)}</span>
                          <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => setEditingId(item.id)}>
                            <Edit2 className="h-3.5 w-3.5" />
                          </Button>
                          <Button
                            size="icon"
                            variant={item.skipImport ? 'outline' : 'ghost'}
                            className="h-7 w-7"
                            title={item.skipImport ? 'Incluir na importação' : 'Pular este item'}
                            onClick={() => toggleSkip(item.id)}
                          >
                            {item.skipImport
                              ? <CheckCircle2 className="h-3.5 w-3.5 text-muted-foreground" />
                              : <Trash2 className="h-3.5 w-3.5 text-destructive" />}
                          </Button>
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
