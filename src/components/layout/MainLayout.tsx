import { ReactNode, useState } from 'react';
import { Sidebar } from './Sidebar';
import { MonthSelector } from './MonthSelector';
import { useApp } from '@/contexts/AppContext';
import { Loader2, Calculator, StickyNote, Plus } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { FloatingCalculator } from '@/components/tools/FloatingCalculator';
import { FloatingNotepad } from '@/components/tools/FloatingNotepad';
import { TransactionForm } from '@/components/transactions/TransactionForm';
import { Tooltip, TooltipContent, TooltipTrigger, TooltipProvider } from '@/components/ui/tooltip';

interface MainLayoutProps {
  children: ReactNode;
}

export function MainLayout({ children }: MainLayoutProps) {
  const { isLoading, isInitialized } = useApp();
  const [calcOpen, setCalcOpen] = useState(false);
  const [notepadOpen, setNotepadOpen] = useState(false);
  const [isFormOpen, setIsFormOpen] = useState(false);

  if (!isInitialized) {
    return (
      <div className="flex h-screen items-center justify-center bg-background">
        <div className="flex flex-col items-center gap-4">
          <div className="h-12 w-12 rounded-xl bg-primary flex items-center justify-center animate-pulse-glow">
            <span className="text-primary-foreground font-bold text-xl">FC</span>
          </div>
          <div className="flex items-center gap-2 text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" />
            <span>Carregando...</span>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <Sidebar />

      {/* Main Content */}
      <main className="lg:pl-64 pt-14 lg:pt-0 min-h-screen">
        {/* Header */}
        <header className="sticky top-14 lg:top-0 z-30 h-16 bg-background/80 backdrop-blur-md border-b border-border">
          <div className="h-full px-4 lg:px-6 flex items-center justify-between">
            <MonthSelector />

            <div className="flex items-center gap-2">
              {isLoading && (
                <div className="flex items-center gap-2 text-muted-foreground text-sm">
                  <Loader2 className="h-4 w-4 animate-spin" />
                  <span className="hidden sm:inline">Atualizando...</span>
                </div>
              )}
              <TooltipProvider>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button
                      size="icon"
                      variant="outline"
                      className="h-9 w-9 rounded-full bg-background"
                      onClick={() => setNotepadOpen(true)}
                    >
                      <StickyNote className="h-4 w-4" />
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent side="bottom">Bloco de Notas</TooltipContent>
                </Tooltip>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button
                      size="icon"
                      className="h-9 w-9 rounded-full"
                      onClick={() => setCalcOpen(true)}
                    >
                      <Calculator className="h-4 w-4" />
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent side="bottom">Calculadora</TooltipContent>
                </Tooltip>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button
                      size="icon"
                      className="h-9 w-9 rounded-full glow-primary animate-pulse-glow"
                      onClick={() => setIsFormOpen(true)}
                    >
                      <Plus className="h-5 w-5" />
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent side="bottom">Novo Lançamento</TooltipContent>
                </Tooltip>
              </TooltipProvider>
            </div>
          </div>
        </header>

        {/* Page Content */}
        <div className="p-4 lg:p-6">
          {children}
        </div>
      </main>

      <FloatingCalculator open={calcOpen} onClose={() => setCalcOpen(false)} />
      <FloatingNotepad open={notepadOpen} onClose={() => setNotepadOpen(false)} />
      <TransactionForm isOpen={isFormOpen} onClose={() => setIsFormOpen(false)} />
    </div>
  );
}
