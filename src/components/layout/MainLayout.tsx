import { ReactNode, useState } from 'react';
import { Sidebar } from './Sidebar';
import { MonthSelector } from './MonthSelector';
import { useApp } from '@/contexts/AppContext';
import { Loader2, Calculator, StickyNote } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { FloatingCalculator } from '@/components/tools/FloatingCalculator';
import { FloatingNotepad } from '@/components/tools/FloatingNotepad';
import { Tooltip, TooltipContent, TooltipTrigger, TooltipProvider } from '@/components/ui/tooltip';

interface MainLayoutProps {
  children: ReactNode;
}

export function MainLayout({ children }: MainLayoutProps) {
  const { isLoading, isInitialized } = useApp();
  const [calcOpen, setCalcOpen] = useState(false);
  const [notepadOpen, setNotepadOpen] = useState(false);

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
            
            {isLoading && (
              <div className="flex items-center gap-2 text-muted-foreground text-sm">
                <Loader2 className="h-4 w-4 animate-spin" />
                <span className="hidden sm:inline">Atualizando...</span>
              </div>
            )}
          </div>
        </header>

        {/* Page Content */}
        <div className="p-4 lg:p-6">
          {children}
        </div>
      </main>

      {/* Floating Tools */}
      <TooltipProvider>
        <div className="fixed bottom-24 right-6 z-50 flex flex-col gap-2">
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                size="icon"
                variant="outline"
                className="h-11 w-11 rounded-full shadow-lg bg-background"
                onClick={() => setNotepadOpen(true)}
              >
                <StickyNote className="h-5 w-5" />
              </Button>
            </TooltipTrigger>
            <TooltipContent side="left">Bloco de Notas</TooltipContent>
          </Tooltip>
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                size="icon"
                className="h-11 w-11 rounded-full shadow-lg"
                onClick={() => setCalcOpen(true)}
              >
                <Calculator className="h-5 w-5" />
              </Button>
            </TooltipTrigger>
            <TooltipContent side="left">Calculadora</TooltipContent>
          </Tooltip>
        </div>
      </TooltipProvider>

      <FloatingCalculator open={calcOpen} onClose={() => setCalcOpen(false)} />
      <FloatingNotepad open={notepadOpen} onClose={() => setNotepadOpen(false)} />
    </div>
  );
}
