import { useState, useRef, useCallback } from 'react';
import { Upload, FileImage, FileText, Loader2, CheckCircle2, AlertCircle, Trash2, Edit2, ChevronLeft } from 'lucide-react';
import { Button } from '@/components/ui/button';
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
import type { SuggestedTransaction, TransactionType } from '@/types/finance';
import { createWorker } from 'tesseract.js';
import * as pdfjsLib from 'pdfjs-dist';

// Configure PDF.js worker (v4.x uses .mjs, use jsdelivr for reliability)
pdfjsLib.GlobalWorkerOptions.workerSrc = `https://cdn.jsdelivr.net/npm/pdfjs-dist@${pdfjsLib.version}/build/pdf.worker.min.mjs`;

type ImportStatus = 'idle' | 'uploading' | 'processing' | 'ready' | 'error';

type StatementType = 'nubank-fatura' | 'c6-fatura' | 'nubank-extrato' | 'c6-extrato';

const STATEMENT_TYPES: {
  id: StatementType;
  label: string;
  subtitle: string;
  description: string;
  icon: string;
  color: string;
}[] = [
  {
    id: 'nubank-fatura',
    label: 'Fatura Nubank',
    subtitle: 'Cartão de crédito',
    description: 'PDF da fatura mensal do cartão Nubank',
    icon: '💜',
    color: 'hover:border-purple-500/60 hover:bg-purple-500/5',
  },
  {
    id: 'c6-fatura',
    label: 'Fatura C6',
    subtitle: 'Cartão de crédito',
    description: 'PDF da fatura mensal do cartão C6 Bank',
    icon: '🖤',
    color: 'hover:border-zinc-400/60 hover:bg-zinc-400/5',
  },
  {
    id: 'nubank-extrato',
    label: 'Extrato Nubank',
    subtitle: 'Conta corrente',
    description: 'PDF do extrato da conta Nubank',
    icon: '💜',
    color: 'hover:border-purple-500/60 hover:bg-purple-500/5',
  },
  {
    id: 'c6-extrato',
    label: 'Extrato C6',
    subtitle: 'Conta corrente',
    description: 'PDF do extrato da conta C6 Bank',
    icon: '🖤',
    color: 'hover:border-zinc-400/60 hover:bg-zinc-400/5',
  },
];

const STATEMENT_LABELS: Record<StatementType, string> = {
  'nubank-fatura': 'Fatura Nubank',
  'c6-fatura': 'Fatura C6',
  'nubank-extrato': 'Extrato Nubank',
  'c6-extrato': 'Extrato C6',
};

export function ImportPage() {
  const { categories, subcategories, addTransaction, selectedMonth, selectedYear } = useApp();
  const { toast } = useToast();

  const [selectedType, setSelectedType] = useState<StatementType | null>(null);
  const [status, setStatus] = useState<ImportStatus>('idle');
  const [progress, setProgress] = useState(0);
  const [errorMessage, setErrorMessage] = useState('');
  const [suggestions, setSuggestions] = useState<SuggestedTransaction[]>([]);
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

    const numPages = Math.min(pdf.numPages, 5);

    for (let i = 1; i <= numPages; i++) {
      setProgress(Math.round((i / numPages) * 50));
      const page = await pdf.getPage(i);

      const textContent = await page.getTextContent();
      const pageText = textContent.items
        .map((item: any) => item.str)
        .join(' ');

      if (pageText.trim().length > 20) {
        fullText += pageText + '\n';
      } else {
        const viewport = page.getViewport({ scale: 2.0 });
        const canvas = document.createElement('canvas');
        const context = canvas.getContext('2d')!;
        canvas.height = viewport.height;
        canvas.width = viewport.width;

        await page.render({
          canvasContext: context,
          viewport: viewport,
        }).promise;

        const imageData = canvas.toDataURL('image/png');
        const ocrText = await processOCR(imageData);
        fullText += ocrText + '\n';
      }
    }

    return fullText;
  }, [processOCR]);

  const handleFileUpload = useCallback(async (file: File) => {
    setStatus('uploading');
    setProgress(0);
    setErrorMessage('');
    setSuggestions([]);

    try {
      setStatus('processing');
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

      const parsed = parseOCRText(extractedText, categories);

      if (parsed.length === 0) {
        throw new Error('Nenhum lançamento identificado. Verifique se o arquivo contém valores monetários.');
      }

      setSuggestions(parsed);
      setStatus('ready');

      toast({
        title: 'Processamento concluído!',
        description: `${parsed.length} lançamento(s) identificado(s) para revisão.`,
      });
    } catch (error) {
      console.error('OCR Error:', error);
      setStatus('error');
      setErrorMessage(error instanceof Error ? error.message : 'Erro ao processar arquivo.');
      toast({
        title: 'Erro no processamento',
        description: error instanceof Error ? error.message : 'Tente novamente.',
        variant: 'destructive',
      });
    }
  }, [categories, processOCR, extractTextFromPDF, toast]);

  const handleFileChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      handleFileUpload(file);
    }
  }, [handleFileUpload]);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    const file = e.dataTransfer.files[0];
    if (file) {
      handleFileUpload(file);
    }
  }, [handleFileUpload]);

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
  }, []);

  const updateSuggestion = useCallback((id: string, updates: Partial<SuggestedTransaction>) => {
    setSuggestions(prev => prev.map(s =>
      s.id === id ? { ...s, ...updates } : s
    ));
  }, []);

  const removeSuggestion = useCallback((id: string) => {
    setSuggestions(prev => prev.filter(s => s.id !== id));
  }, []);

  const handleConfirmAll = useCallback(async () => {
    const confirmedItems = suggestions.filter(s => !s.confirmed);

    if (confirmedItems.length === 0) {
      toast({ title: 'Nenhum item para confirmar', variant: 'destructive' });
      return;
    }

    try {
      for (const item of confirmedItems) {
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
      }

      toast({
        title: 'Lançamentos criados!',
        description: `${confirmedItems.length} lançamento(s) adicionado(s) com sucesso.`,
      });

      setSuggestions([]);
      setStatus('idle');
      setSelectedType(null);
    } catch (error) {
      toast({
        title: 'Erro ao criar lançamentos',
        description: 'Tente novamente.',
        variant: 'destructive',
      });
    }
  }, [suggestions, addTransaction, toast]);

  const handleReset = useCallback(() => {
    setSuggestions([]);
    setStatus('idle');
    setProgress(0);
    setErrorMessage('');
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  }, []);

  const handleBackToTypeSelection = useCallback(() => {
    handleReset();
    setSelectedType(null);
  }, [handleReset]);

  const expenseCategories = categories.filter(c => c.type === 'despesa');
  const incomeCategories = categories.filter(c => c.type === 'receita');

  // Step 1: type selection
  if (!selectedType) {
    return (
      <div className="space-y-8 animate-fade-in">
        <div>
          <h1 className="text-2xl lg:text-3xl font-bold">Importar</h1>
          <p className="text-muted-foreground">Selecione o tipo de documento para importar</p>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {STATEMENT_TYPES.map((type) => (
            <button
              key={type.id}
              onClick={() => setSelectedType(type.id)}
              className={cn(
                'glass-card rounded-xl p-6 text-left border border-border transition-all duration-200 cursor-pointer',
                type.color
              )}
            >
              <div className="flex items-start gap-4">
                <span className="text-3xl">{type.icon}</span>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <h3 className="text-base font-semibold">{type.label}</h3>
                    <span className="text-xs px-2 py-0.5 rounded-full bg-muted text-muted-foreground">
                      {type.subtitle}
                    </span>
                  </div>
                  <p className="text-sm text-muted-foreground">{type.description}</p>
                </div>
              </div>
            </button>
          ))}
        </div>
      </div>
    );
  }

  // Step 2: upload + review
  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex items-center gap-3">
        <Button
          variant="ghost"
          size="icon"
          onClick={handleBackToTypeSelection}
          className="shrink-0"
        >
          <ChevronLeft className="h-5 w-5" />
        </Button>
        <div>
          <h1 className="text-2xl lg:text-3xl font-bold">Importar</h1>
          <p className="text-muted-foreground">{STATEMENT_LABELS[selectedType]}</p>
        </div>
      </div>

      {/* Upload Area */}
      {status === 'idle' && (
        <div
          className="glass-card rounded-xl p-8 border-2 border-dashed border-border hover:border-primary/50 transition-colors cursor-pointer"
          onDrop={handleDrop}
          onDragOver={handleDragOver}
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
            <div className="h-16 w-16 rounded-full bg-primary/10 flex items-center justify-center mb-4">
              <Upload className="h-8 w-8 text-primary" />
            </div>
            <h3 className="text-lg font-semibold mb-2">Arraste arquivos aqui</h3>
            <p className="text-muted-foreground mb-4">ou clique para selecionar</p>
            <div className="flex gap-4">
              <Button variant="outline" className="gap-2" onClick={(e) => e.stopPropagation()}>
                <FileImage className="h-4 w-4" />
                Imagem (PNG/JPG)
              </Button>
              <Button variant="outline" className="gap-2" onClick={(e) => e.stopPropagation()}>
                <FileText className="h-4 w-4" />
                PDF
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Processing State */}
      {(status === 'uploading' || status === 'processing') && (
        <div className="glass-card rounded-xl p-8">
          <div className="flex flex-col items-center text-center">
            <Loader2 className="h-12 w-12 text-primary animate-spin mb-4" />
            <h3 className="text-lg font-semibold mb-2">
              {status === 'uploading' ? 'Enviando arquivo...' : 'Processando OCR...'}
            </h3>
            <div className="w-full max-w-xs bg-muted rounded-full h-2 mt-4">
              <div
                className="bg-primary h-2 rounded-full transition-all duration-300"
                style={{ width: `${progress}%` }}
              />
            </div>
            <p className="text-sm text-muted-foreground mt-2">{progress}%</p>
          </div>
        </div>
      )}

      {/* Error State */}
      {status === 'error' && (
        <div className="glass-card rounded-xl p-8 border-destructive/50">
          <div className="flex flex-col items-center text-center">
            <AlertCircle className="h-12 w-12 text-destructive mb-4" />
            <h3 className="text-lg font-semibold mb-2">Erro no processamento</h3>
            <p className="text-muted-foreground mb-4">{errorMessage}</p>
            <Button onClick={handleReset}>Tentar novamente</Button>
          </div>
        </div>
      )}

      {/* Review Suggestions */}
      {status === 'ready' && suggestions.length > 0 && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-semibold">
              Lançamentos Identificados ({suggestions.length})
            </h2>
            <div className="flex gap-2">
              <Button variant="outline" onClick={handleReset}>Cancelar</Button>
              <Button onClick={handleConfirmAll} className="gap-2">
                <CheckCircle2 className="h-4 w-4" />
                Confirmar e Efetivar
              </Button>
            </div>
          </div>

          <div className="space-y-3">
            {suggestions.map((item) => {
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
                    "glass-card rounded-lg p-4",
                    item.needsReview && "border-l-4 border-l-warning"
                  )}
                >
                  {isEditing ? (
                    <div className="space-y-4">
                      <div className="grid grid-cols-2 gap-4">
                        <div>
                          <Label className="text-xs">Data</Label>
                          <Input
                            type="date"
                            value={item.date ? new Date(item.date).toISOString().split('T')[0] : ''}
                            onChange={(e) => updateSuggestion(item.id, {
                              date: e.target.value ? new Date(e.target.value) : undefined
                            })}
                          />
                        </div>
                        <div>
                          <Label className="text-xs">Valor (R$)</Label>
                          <CurrencyInput
                            value={item.amount || 0}
                            onChange={(val) => updateSuggestion(item.id, {
                              amount: parseBRLToNumber(val)
                            })}
                          />
                        </div>
                      </div>

                      <div>
                        <Label className="text-xs">Descrição</Label>
                        <Input
                          value={item.description || ''}
                          onChange={(e) => updateSuggestion(item.id, { description: e.target.value })}
                        />
                      </div>

                      <div className="grid grid-cols-3 gap-4">
                        <div>
                          <Label className="text-xs">Tipo</Label>
                          <Select
                            value={item.type}
                            onValueChange={(val) => updateSuggestion(item.id, {
                              type: val as TransactionType,
                              suggestedCategoryId: undefined,
                              suggestedSubcategoryId: undefined,
                            })}
                          >
                            <SelectTrigger>
                              <SelectValue />
                            </SelectTrigger>
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
                            onValueChange={(val) => updateSuggestion(item.id, {
                              suggestedCategoryId: val,
                              suggestedSubcategoryId: undefined,
                            })}
                          >
                            <SelectTrigger>
                              <SelectValue placeholder="Selecione" />
                            </SelectTrigger>
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
                            value={item.suggestedSubcategoryId || "__none__"}
                            onValueChange={(val) => updateSuggestion(item.id, {
                              suggestedSubcategoryId: val === "__none__" ? undefined : val
                            })}
                            disabled={categorySubcategories.length === 0}
                          >
                            <SelectTrigger>
                              <SelectValue placeholder={categorySubcategories.length === 0 ? "(Sem subcategorias)" : "Opcional"} />
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

                      <div className="flex justify-end gap-2">
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => setEditingId(null)}
                        >
                          Concluir edição
                        </Button>
                      </div>
                    </div>
                  ) : (
                    <div className="flex items-center justify-between">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className={cn(
                            "px-2 py-0.5 rounded text-xs font-medium",
                            item.type === 'receita' ? "bg-success/10 text-success" : "bg-destructive/10 text-destructive"
                          )}>
                            {item.type === 'receita' ? 'Receita' : 'Despesa'}
                          </span>
                          {selectedCategory && (
                            <span className="text-sm">
                              {selectedCategory.icon} {selectedCategory.name}
                            </span>
                          )}
                          {item.needsReview && (
                            <span className="text-xs text-warning">⚠️ Revisar</span>
                          )}
                        </div>
                        <p className="text-sm text-muted-foreground truncate mt-1">
                          {item.date && formatDateShort(item.date)} • {item.description}
                        </p>
                      </div>
                      <div className="flex items-center gap-3 ml-4">
                        <span className="font-mono font-bold">
                          {formatCurrency(item.amount || 0)}
                        </span>
                        <Button
                          size="icon"
                          variant="ghost"
                          onClick={() => setEditingId(item.id)}
                        >
                          <Edit2 className="h-4 w-4" />
                        </Button>
                        <Button
                          size="icon"
                          variant="ghost"
                          onClick={() => removeSuggestion(item.id)}
                        >
                          <Trash2 className="h-4 w-4 text-destructive" />
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

      {/* Help Text */}
      {status === 'idle' && (
        <div className="glass-card rounded-xl p-6 text-center text-muted-foreground">
          <p>Envie o arquivo de <strong className="text-foreground">{STATEMENT_LABELS[selectedType]}</strong>.</p>
          <p className="text-sm mt-2">O sistema irá identificar os lançamentos automaticamente.</p>
        </div>
      )}
    </div>
  );
}
