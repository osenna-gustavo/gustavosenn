import { ReactNode, useState } from 'react';
import { Sidebar } from './Sidebar';
import { MonthSelector } from './MonthSelector';
import { useApp } from '@/contexts/AppContext';
import { Loader2, Plus } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { TransactionForm } from '@/components/transactions/TransactionForm';

interface MainLayoutProps {
  children: ReactNode;
}

export function MainLayout({ children }: MainLayoutProps) {
  const { isLoading, isInitialized } = useApp();
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
              <Button
                className="h-9 gap-2 rounded-full px-3 sm:px-4 glow-primary"
                onClick={() => setIsFormOpen(true)}
              >
                <Plus className="h-4 w-4" />
                <span className="hidden sm:inline">Novo lançamento</span>
              </Button>
            </div>
          </div>
        </header>

        {/* Page Content */}
        <div className="p-4 lg:p-6">
          {children}
        </div>
      </main>

      <TransactionForm isOpen={isFormOpen} onClose={() => setIsFormOpen(false)} />
    </div>
  );
}
