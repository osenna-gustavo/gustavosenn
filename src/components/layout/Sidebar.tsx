import { useApp } from '@/contexts/AppContext';
import { 
  LayoutDashboard, 
  Receipt, 
  Wallet, 
  Tags, 
  RefreshCw, 
  Upload, 
  BarChart3, 
  Lightbulb,
  Menu,
  X
} from 'lucide-react';
import type { AppScreen } from '@/types/finance';
import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

const navItems: { screen: AppScreen; label: string; icon: React.ReactNode }[] = [
  { screen: 'dashboard', label: 'Dashboard', icon: <LayoutDashboard className="h-5 w-5" /> },
  { screen: 'transactions', label: 'Lançamentos', icon: <Receipt className="h-5 w-5" /> },
  { screen: 'budget', label: 'Orçamento', icon: <Wallet className="h-5 w-5" /> },
  { screen: 'categories', label: 'Categorias', icon: <Tags className="h-5 w-5" /> },
  { screen: 'recurrences', label: 'Recorrências', icon: <RefreshCw className="h-5 w-5" /> },
  { screen: 'import', label: 'Importar', icon: <Upload className="h-5 w-5" /> },
  { screen: 'reports', label: 'Relatórios', icon: <BarChart3 className="h-5 w-5" /> },
  { screen: 'scenarios', label: 'Cenários', icon: <Lightbulb className="h-5 w-5" /> },
];

export function Sidebar() {
  const { currentScreen, setCurrentScreen } = useApp();
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

  const handleNavigation = (screen: AppScreen) => {
    setCurrentScreen(screen);
    setIsMobileMenuOpen(false);
  };

  return (
    <>
      {/* Mobile Header */}
      <header className="lg:hidden fixed top-0 left-0 right-0 z-50 h-14 bg-card border-b border-border flex items-center justify-between px-4">
        <div className="flex items-center gap-2">
          <div className="h-8 w-8 rounded-lg bg-primary flex items-center justify-center">
            <span className="text-primary-foreground font-bold text-sm">FC</span>
          </div>
          <span className="font-semibold text-foreground">FluxoCaixa</span>
        </div>
        <Button
          variant="ghost"
          size="icon"
          onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
        >
          {isMobileMenuOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
        </Button>
      </header>

      {/* Mobile Menu Overlay */}
      {isMobileMenuOpen && (
        <div 
          className="lg:hidden fixed inset-0 z-40 bg-background/80 backdrop-blur-sm"
          onClick={() => setIsMobileMenuOpen(false)}
        />
      )}

      {/* Mobile Menu */}
      <nav className={cn(
        "lg:hidden fixed top-14 right-0 z-50 h-[calc(100vh-3.5rem)] w-64 bg-card border-l border-border transform transition-transform duration-300 ease-in-out",
        isMobileMenuOpen ? "translate-x-0" : "translate-x-full"
      )}>
        <div className="p-4 space-y-1">
          {navItems.map((item) => (
            <button
              key={item.screen}
              onClick={() => handleNavigation(item.screen)}
              className={cn(
                "w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all duration-200",
                currentScreen === item.screen
                  ? "bg-primary text-primary-foreground"
                  : "text-muted-foreground hover:bg-muted hover:text-foreground"
              )}
            >
              {item.icon}
              {item.label}
            </button>
          ))}
        </div>
      </nav>

      {/* Desktop Sidebar */}
      <aside className="hidden lg:flex fixed left-0 top-0 z-40 h-screen w-64 flex-col bg-sidebar border-r border-sidebar-border">
        {/* Logo */}
        <div className="flex h-16 items-center gap-3 px-6 border-b border-sidebar-border">
          <div className="h-9 w-9 rounded-lg bg-primary flex items-center justify-center glow-primary">
            <span className="text-primary-foreground font-bold">FC</span>
          </div>
          <div className="flex flex-col">
            <span className="font-semibold text-sidebar-foreground">FluxoCaixa</span>
            <span className="text-xs text-muted-foreground">Gestão Financeira</span>
          </div>
        </div>

        {/* Navigation */}
        <nav className="flex-1 overflow-y-auto p-4 space-y-1 scrollbar-thin">
          {navItems.map((item) => (
            <button
              key={item.screen}
              onClick={() => handleNavigation(item.screen)}
              className={cn(
                "w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all duration-200",
                currentScreen === item.screen
                  ? "bg-sidebar-primary text-sidebar-primary-foreground glow-primary"
                  : "text-sidebar-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground"
              )}
            >
              {item.icon}
              {item.label}
            </button>
          ))}
        </nav>

        {/* Footer */}
        <div className="p-4 border-t border-sidebar-border">
          <p className="text-xs text-muted-foreground text-center">
            v1.0.0 • Dados locais
          </p>
        </div>
      </aside>
    </>
  );
}
