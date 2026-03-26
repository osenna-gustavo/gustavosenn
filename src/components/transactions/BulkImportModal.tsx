import { useState, useRef, useCallback } from 'react';
import {
  Upload, FileImage, FileText, Loader2, CheckCircle2,
  AlertCircle, Trash2, Edit2, Copy,
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
import type { SuggestedTransaction, TransactionType, Transaction } from '@/types/finance';
import { createWorker } from 'tesseract.js';
import * as pdfjsLib from 'pdfjs-dist';

pdfjsLib.GlobalWorkerOptions.workerSrc = `//cdnjs.cloudflare.com/ajax/libs/pdf.js/${pdfjsLib.version}/pdf.worker.min.js`;

const MAPPINGS_KEY = 'fluxocaixa_category_mappings';

interface CategoryMapping {
  categoryId: string;
  subcategoryId?: string;
  type: TransactionType;
  confidence: number;
}
type LearnedMappings = Record<string, CategoryMapping>;

interface EnhancedSuggestion extends SuggestedTransaction {
  isDuplicate: boolean;
  skipImport: boolean;
}

type ImportStatus = 'idle' | 'processing' | 'ready' | 'error';

function loadMappings(): LearnedMappings {
  try {
    return JSON.parse(localStorage.getItem(MAPPINGS_KEY) || '{}');
  } catch {
    return {};
  }
}

function saveMappings(mappings: LearnedMappings): void {
  localStorage.setItem(MAPPINGS_KEY, JSON.stringify(mappings));
}

function extractKeywords(description: string): string[] {
  return description
    .toLowerCase()
    .replace(/[^a-záéíóúàãõâêôüç0-9\s]/g, ' ')
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
      const keywords = extractKeywords(s.description);
      for (const kw of keywords) {
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
  const keywords = extractKeywords(description);
  const updated = { ...mappings };
  for (const kw of keywords) {
    const existing = updated[kw];
    updated[kw] = {
      categoryId,
      subcategoryId,
      type,
      confidence: (existing?.confidence ?? 0) + 1,
    };
  }
  return updated;
}

function isDuplicate(suggestion: SuggestedTransaction, existing: Transaction[]): boolean {
  if (!suggestion.amount || !suggestion.date) return false;
  const suggDate = new Date(suggestion.date);
  return existing.some(t => {
    if (Math.abs(t.amount - suggestion.amount!) > 0.01) return false;
    const tDate = new Date(t.date);
    const daysDiff = Math.abs((tDate.getTime() - suggDate.getTime()) / 86400000);
    return daysDiff <= 1;
  });
}

interface BulkImportModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export function BulkImportModal({ isOpen, onClose }: BulkImportModalProps) {
  const { categories, subcategories, addTransaction, transactions } = useApp();
  const { toast } = useToast();

  const [status, setStatus] = useState<ImportStatus>('idle');
  const [progress, setProgress] = useState(0);
  const [errorMessage, setErrorMessage] = useState('');
  const [suggestions, setSuggestions] = useState<EnhancedSuggestion[]>([]);
  const [editingId, setEditingId] = useState<string | null>(null);

  const fileInputRef = useRef<HTMLInputElement>(null);

  const processOCR = useCallback(async (imageData: string | ImageData): Promise<string> => {
    const worker = await createWorker('por', 1, {
      logger: (m) => {
        if (m.status === 'recognizing text') {
          setProgress(Math.round(m.progress * 100));
        }
      },
    });
    try {
      const { data: { text } } = await worker.recognize(imageData);
      return text;
    } finally {
      await worker.terminate();
    }
  }, []);

  const extractTextFromPDF = useCallback(async (arrayBuffer: ArrayBuffer): Promise<string> => {
    const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;
    let fullText = '';
    const numPages = Math.min(pdf.numPages, 10);
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
        const context = canvas.getContext('2d')!;
        canvas.height = viewport.height;
        canvas.width = viewport.width;
        await page.render({ canvasContext: context, viewport }).promise;
        const imageData = canvas.toDataURL('image/png');
        const ocrText = await processOCR(imageData);
        fullText += ocrText + '\n';
      }
    }
    return fullText;
  }, [processOCR]);

  const handleFileUpload = useCallback(async (file: File) => {
    setStatus('processing');
    setProgress(0);
    setErrorMessage('');
    setSuggestions([]);

    try {
      let extractedText = '';

      if (file.type.startsWith('image/')) {
        const imageUrl = URL.createObjectURL(file);
        extractedText = await processOCR(imageUrl);
        URL.revokeObjectURL(imageUrl);
      } else if (file.type === 'application/pdf') {
        const arrayBuffer = await file.arrayBuffer();
        extractedText = await extractTextFromPDF(arrayBuffer);
      } else {
        throw new Error('Formato não suportado. Use imagens (PNG/JPG) ou PDFs.');
      }

      if (!extractedText.trim()) {
        throw new Error('Não foi possível extrair texto do arquivo. Tente com uma imagem mais clara.');
      }

      let parsed = parseOCRText(extractedText, categories);

      if (parsed.length === 0) {
        throw new Error('Nenhum lançamento identificado. Verifique se o arquivo contém valores monetários.');
      }

      const mappings = loadMappings();
      parsed = applyLearnedMappings(parsed, mappings);

      const enhanced: EnhancedSuggestion[] = parsed.map(s => ({
        ...s,
        isDuplicate: isDuplicate(s, transactions),
        skipImport: isDuplicate(s, transactions),
      }));

      setSuggestions(enhanced);
      setStatus('ready');

      const dupCount = enhanced.filter(e => e.isDuplicate).length;
      const newCount = enhanced.length - dupCount;
      toast({
        title: 'Processamento concluído!',
        description: `${newCount} novo(s) lançamento(s) identificado(s).${dupCount > 0 ? ` ${dupCount} já existem e foram marcados para pular.` : ''}`,
      });
    } catch (error) {
      setStatus('error');
      setErrorMessage(error instanceof Error ? error.message : 'Erro ao processar arquivo.');
      toast({
        title: 'Erro no processamento',
        description: error instanceof Error ? error.message : 'Tente novamente.',
        variant: 'destructive',
      });
    }
  }, [categories, processOCR, extractTextFromPDF, transactions, toast]);

  const handleFileChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) handleFileUpload(file);
  }, [handleFileUpload]);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    const file = e.dataTransfer.files[0];
    if (file) handleFileUpload(file);
  }, [handleFileUpload]);

  const updateSuggestion = useCallback((id: string, updates: Partial<EnhancedSuggestion>) => {
    setSuggestions(prev => prev.map(s => s.id === id ? { ...s, ...updates } : s));
  }, []);

  const removeSuggestion = useCallback((id: string) => {
    setSuggestions(prev => prev.filter(s => s.id !== id));
  }, []);

  const toggleSkip = useCallback((id: string) => {
    setSuggestions(prev => prev.map(s => s.id === id ? { ...s, skipImport: !s.skipImport } : s));
  }, []);

  const handleConfirmAll = useCallback(async () => {
    const itemsToImport = suggestions.filter(s => !s.skipImport);

    if (itemsToImport.length === 0) {
      toast({ title: 'Nenhum item para confirmar', variant: 'destructive' });
      return;
    }

    let mappings = loadMappings();

    try {
      for (const item of itemsToImport) {
        await addTransaction({
          date: item.date || new Date(),
          amount: item.amount || 0,
          type: item.type,
          categoryId: item.suggestedCategoryId || '',
          subcategoryId: item.suggestedSubcategoryId,
          description: item.description,
          origin: 'import',
          needsReview: item.needsReview,
        });

        // Learn from confirmed items that have a category
        if (item.description && item.suggestedCategoryId) {
          mappings = learnFromItem(
            item.description,
            item.suggestedCategoryId,
            item.suggestedSubcategoryId,
            item.type,
            mappings,
          );
        }
      }

      saveMappings(mappings);

      toast({
        title: 'Lançamentos criados!',
        description: `${itemsToImport.length} lançamento(s) adicionado(s) com sucesso.`,
      });

      handleReset();
      onClose();
    } catch {
      toast({
        title: 'Erro ao criar lançamentos',
        description: 'Tente novamente.',
        variant: 'destructive',
      });
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

  const handleClose = useCallback(() => {
    handleReset();
    onClose();
  }, [handleReset, onClose]);

  const expenseCategories = categories.filter(c => c.type === 'despesa');
  const incomeCategories = categories.filter(c => c.type === 'receita');
  const itemsToImportCount = suggestions.filter(s => !s.skipImport).length;
  const dupCount = suggestions.filter(s => s.isDuplicate).length;

  return (
    <Dialog open={isOpen} onOpenChange={open => !open && handleClose()}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Lançamento em Massa</DialogTitle>
        </DialogHeader>

        {/* Upload Area */}
        {status === 'idle' && (
          <>
            <div
              className="rounded-xl p-8 border-2 border-dashed border-border hover:border-primary/50 transition-colors cursor-pointer"
              onDrop={handleDrop}
              onDragOver={e => e.preventDefault()}
              onClick={() => fileInputRef.current?.click()}
            >
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*,application/pdf"
                onChange={handleFileChange}
                className="hidden"
              />
              <div className="flex flex-col items-center text-center">
                <div className="h-14 w-14 rounded-full bg-primary/10 flex items-center justify-center mb-3">
                  <Upload className="h-7 w-7 text-primary" />
                </div>
                <h3 className="text-base font-semibold mb-1">Arraste o extrato aqui</h3>
                <p className="text-muted-foreground text-sm mb-4">ou clique para selecionar</p>
                <div className="flex gap-3">
                  <Button variant="outline" size="sm" className="gap-2 pointer-events-none">
                    <FileImage className="h-4 w-4" />
                    Imagem (PNG/JPG)
                  </Button>
                  <Button variant="outline" size="sm" className="gap-2 pointer-events-none">
                    <FileText className="h-4 w-4" />
                    PDF
                  </Button>
                </div>
              </div>
            </div>
            <p className="text-xs text-muted-foreground text-center">
              O sistema identifica automaticamente receitas, despesas, categorias e lançamentos duplicados.
              Quanto mais você usar, mais ele aprende a categorizar.
            </p>
          </>
        )}

        {/* Processing */}
        {status === 'processing' && (
          <div className="py-8 flex flex-col items-center text-center gap-4">
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
          <div className="py-8 flex flex-col items-center text-center gap-4">
            <AlertCircle className="h-10 w-10 text-destructive" />
            <p className="font-medium">Erro no processamento</p>
            <p className="text-sm text-muted-foreground">{errorMessage}</p>
            <Button onClick={handleReset}>Tentar novamente</Button>
          </div>
        )}

        {/* Review */}
        {status === 'ready' && suggestions.length > 0 && (
          <div className="space-y-4">
            {/* Summary bar */}
            <div className="flex items-center justify-between flex-wrap gap-2">
              <div className="flex gap-3 text-sm text-muted-foreground">
                <span>{suggestions.length} identificado(s)</span>
                {dupCount > 0 && (
                  <span className="text-warning">{dupCount} duplicado(s)</span>
                )}
                <span className="text-success font-medium">{itemsToImportCount} para importar</span>
              </div>
              <div className="flex gap-2">
                <Button variant="outline" size="sm" onClick={handleReset}>Cancelar</Button>
                <Button size="sm" onClick={handleConfirmAll} className="gap-2" disabled={itemsToImportCount === 0}>
                  <CheckCircle2 className="h-4 w-4" />
                  Confirmar {itemsToImportCount > 0 ? `(${itemsToImportCount})` : ''}
                </Button>
              </div>
            </div>

            <div className="space-y-2">
              {suggestions.map(item => {
                const isEditing = editingId === item.id;
                const selectedCategory = [...expenseCategories, ...incomeCategories].find(
                  c => c.id === item.suggestedCategoryId
                );
                const categorySubcategories = subcategories.filter(
                  s => s.categoryId === item.suggestedCategoryId
                );

                return (
                  <div
                    key={item.id}
                    className={cn(
                      'rounded-lg border p-3 transition-opacity',
                      item.skipImport && 'opacity-50',
                      item.isDuplicate && !item.skipImport && 'border-warning/50',
                      item.needsReview && !item.isDuplicate && 'border-l-4 border-l-warning',
                      !item.isDuplicate && !item.needsReview && 'border-border',
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
                              onChange={e => updateSuggestion(item.id, {
                                date: e.target.value ? new Date(e.target.value) : undefined,
                              })}
                            />
                          </div>
                          <div>
                            <Label className="text-xs">Valor (R$)</Label>
                            <CurrencyInput
                              value={item.amount || 0}
                              onChange={val => updateSuggestion(item.id, { amount: parseBRLToNumber(val) })}
                            />
                          </div>
                        </div>
                        <div>
                          <Label className="text-xs">Descrição</Label>
                          <Input
                            value={item.description || ''}
                            onChange={e => updateSuggestion(item.id, { description: e.target.value })}
                          />
                        </div>
                        <div className="grid grid-cols-3 gap-3">
                          <div>
                            <Label className="text-xs">Tipo</Label>
                            <Select
                              value={item.type}
                              onValueChange={val => updateSuggestion(item.id, {
                                type: val as TransactionType,
                                suggestedCategoryId: undefined,
                                suggestedSubcategoryId: undefined,
                              })}
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
                              onValueChange={val => updateSuggestion(item.id, {
                                suggestedCategoryId: val,
                                suggestedSubcategoryId: undefined,
                                needsReview: false,
                              })}
                            >
                              <SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger>
                              <SelectContent>
                                {(item.type === 'despesa' ? expenseCategories : incomeCategories).map(cat => (
                                  <SelectItem key={cat.id} value={cat.id}>
                                    {cat.icon} {cat.name}
                                  </SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                          </div>
                          <div>
                            <Label className="text-xs">Subcategoria</Label>
                            <Select
                              value={item.suggestedSubcategoryId || '__none__'}
                              onValueChange={val => updateSuggestion(item.id, {
                                suggestedSubcategoryId: val === '__none__' ? undefined : val,
                              })}
                              disabled={categorySubcategories.length === 0}
                            >
                              <SelectTrigger>
                                <SelectValue placeholder={categorySubcategories.length === 0 ? '(Sem subcategorias)' : 'Opcional'} />
                              </SelectTrigger>
                              <SelectContent>
                                <SelectItem value="__none__">Nenhuma</SelectItem>
                                {categorySubcategories.map(sub => (
                                  <SelectItem key={sub.id} value={sub.id}>{sub.name}</SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                          </div>
                        </div>
                        <div className="flex justify-end">
                          <Button size="sm" variant="outline" onClick={() => setEditingId(null)}>
                            Concluir edição
                          </Button>
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
                              <span className="text-xs text-muted-foreground">
                                {selectedCategory.icon} {selectedCategory.name}
                              </span>
                            )}
                            {item.isDuplicate && (
                              <span className="flex items-center gap-1 text-xs text-warning">
                                <Copy className="h-3 w-3" />
                                Duplicado
                              </span>
                            )}
                            {item.needsReview && !item.isDuplicate && (
                              <span className="text-xs text-warning">⚠ Revisar categoria</span>
                            )}
                          </div>
                          <p className="text-sm truncate mt-0.5">
                            {item.date && formatDateShort(item.date)}
                            {item.description ? ` • ${item.description}` : ''}
                          </p>
                        </div>
                        <div className="flex items-center gap-2 shrink-0">
                          <span className="font-mono text-sm font-semibold">
                            {formatCurrency(item.amount || 0)}
                          </span>
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
                            {item.skipImport ? (
                              <CheckCircle2 className="h-3.5 w-3.5 text-muted-foreground" />
                            ) : (
                              <Trash2 className="h-3.5 w-3.5 text-destructive" />
                            )}
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
