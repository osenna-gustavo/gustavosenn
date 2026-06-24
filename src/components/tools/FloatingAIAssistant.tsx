import { useState, useRef, useEffect, useCallback } from 'react';
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { ScrollArea } from '@/components/ui/scroll-area';
import { useApp } from '@/contexts/AppContext';
import { supabase } from '@/integrations/supabase/client';
import { findPotentialDuplicates } from '@/lib/duplicateDetection';
import { Sparkles, Send, Loader2, Trash2, Bot, User } from 'lucide-react';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';

interface FloatingAIAssistantProps {
  open: boolean;
  onClose: () => void;
}

interface ChatMessage {
  role: 'user' | 'assistant';
  content: string;
}

const SUGGESTIONS = [
  'Tem algum lançamento duplicado esse mês?',
  'Quanto eu já gastei e quanto ainda posso gastar esse mês?',
  'Em quais categorias estou acima do orçamento?',
];

export function FloatingAIAssistant({ open, onClose }: FloatingAIAssistantProps) {
  const { categories, transactions, monthSummary, selectedMonth, selectedYear } = useApp();
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    scrollRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, loading]);

  const buildContext = useCallback(() => {
    const categoryNameById = new Map(categories.map(c => [c.id, c.name]));
    return {
      mesReferencia: `${selectedMonth + 1}/${selectedYear}`,
      resumoDoMes: monthSummary,
      lancamentos: transactions.map(t => ({
        data: t.date.toISOString().slice(0, 10),
        descricao: t.description,
        valor: t.amount,
        tipo: t.type,
        categoria: categoryNameById.get(t.categoryId),
      })),
      possiveisDuplicidades: findPotentialDuplicates(transactions, categories),
    };
  }, [categories, transactions, monthSummary, selectedMonth, selectedYear]);

  const sendMessage = useCallback(async (text: string) => {
    const userMessage: ChatMessage = { role: 'user', content: text };
    const nextMessages = [...messages, userMessage];
    setMessages(nextMessages);
    setInput('');
    setLoading(true);

    try {
      const { data, error } = await supabase.functions.invoke('financial-assistant', {
        body: { messages: nextMessages, context: buildContext() },
      });

      if (error) throw error;
      if (data?.error) throw new Error(data.error);

      setMessages(prev => [...prev, { role: 'assistant', content: data.reply }]);
    } catch (error) {
      toast.error('Não foi possível obter resposta do assistente', {
        description: error instanceof Error ? error.message : 'Tente novamente.',
      });
      setMessages(prev => prev.slice(0, -1));
    } finally {
      setLoading(false);
    }
  }, [messages, buildContext]);

  const handleSubmit = () => {
    if (!input.trim() || loading) return;
    sendMessage(input.trim());
  };

  const handleClear = () => setMessages([]);

  return (
    <Sheet open={open} onOpenChange={(o) => !o && onClose()}>
      <SheetContent className="w-full sm:max-w-[460px] flex flex-col p-0">
        <SheetHeader className="p-4 pb-2">
          <SheetTitle className="flex items-center gap-2">
            <Sparkles className="h-4 w-4" />
            Assistente Financeiro
          </SheetTitle>
        </SheetHeader>

        <div className="flex flex-1 flex-col overflow-hidden">
          <ScrollArea className="flex-1 px-4">
            <div className="space-y-4 py-2">
              {messages.length === 0 && (
                <div className="space-y-3">
                  <p className="text-sm text-muted-foreground">
                    Pergunte sobre seus lançamentos, orçamento ou possíveis duplicidades neste mês.
                  </p>
                  <div className="flex flex-col gap-2">
                    {SUGGESTIONS.map(s => (
                      <button
                        key={s}
                        onClick={() => sendMessage(s)}
                        className="text-left text-sm px-3 py-2 rounded-md border border-border hover:bg-muted transition-colors"
                      >
                        {s}
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {messages.map((m, i) => (
                <div
                  key={i}
                  className={cn('flex gap-2 items-start', m.role === 'user' && 'justify-end')}
                >
                  {m.role === 'assistant' && (
                    <div className="h-7 w-7 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
                      <Bot className="h-4 w-4 text-primary" />
                    </div>
                  )}
                  <div
                    className={cn(
                      'rounded-lg px-3 py-2 text-sm max-w-[85%] whitespace-pre-wrap',
                      m.role === 'user'
                        ? 'bg-primary text-primary-foreground'
                        : 'bg-muted text-foreground',
                    )}
                  >
                    {m.content}
                  </div>
                  {m.role === 'user' && (
                    <div className="h-7 w-7 rounded-full bg-muted flex items-center justify-center shrink-0">
                      <User className="h-4 w-4 text-muted-foreground" />
                    </div>
                  )}
                </div>
              ))}

              {loading && (
                <div className="flex gap-2 items-start">
                  <div className="h-7 w-7 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
                    <Bot className="h-4 w-4 text-primary" />
                  </div>
                  <div className="rounded-lg px-3 py-2 text-sm bg-muted text-muted-foreground flex items-center gap-2">
                    <Loader2 className="h-3 w-3 animate-spin" /> Analisando...
                  </div>
                </div>
              )}

              <div ref={scrollRef} />
            </div>
          </ScrollArea>

          <div className="p-4 pt-2 border-t border-border space-y-2">
            <div className="flex gap-2">
              <Textarea
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && !e.shiftKey) {
                    e.preventDefault();
                    handleSubmit();
                  }
                }}
                placeholder="Pergunte algo sobre suas finanças..."
                className="min-h-[44px] max-h-[120px] resize-none text-sm"
              />
              <Button size="icon" onClick={handleSubmit} disabled={!input.trim() || loading} className="shrink-0">
                <Send className="h-4 w-4" />
              </Button>
            </div>
            {messages.length > 0 && (
              <Button variant="ghost" size="sm" onClick={handleClear} className="gap-1 text-muted-foreground">
                <Trash2 className="h-3 w-3" /> Limpar conversa
              </Button>
            )}
          </div>
        </div>
      </SheetContent>
    </Sheet>
  );
}
