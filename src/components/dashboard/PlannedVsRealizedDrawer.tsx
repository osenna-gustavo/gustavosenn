import { useState } from 'react';
import { useApp } from '@/contexts/AppContext';
import { formatCurrency, formatPercentage, formatMonthYear, formatDateShort } from '@/lib/formatters';
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import { ArrowUpRight, ArrowDownRight, TrendingDown, TrendingUp, Target, ChevronRight } from 'lucide-react';
import { cn } from '@/lib/utils';

interface PlannedVsRealizedDrawerProps {
  isOpen: boolean;
  onClose: () => void;
}

interface CategoryBreakdownItem {
  categoryId: string;
  categoryName: string;
  icon?: string;
  planned: number;
  realized: number;
  difference: number;
  status: 'ok' | 'warning' | 'exceeded';
  subcategories: SubcategoryBreakdownItem[];
}

interface SubcategoryBreakdownItem {
  subcategoryId: string;
  subcategoryName: string;
  planned: number;
  realized: number;
}

export function PlannedVsRealizedDrawer({ isOpen, onClose }: PlannedVsRealizedDrawerProps) {
  const { 
    transactions, 
    categories, 
    subcategories: allSubcategories,
    budget,
    recurrences,
    recurrenceInstances,
    selectedMonth, 
    selectedYear 
  } = useApp();

  const [selectedCategoryId, setSelectedCategoryId] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<'realizado' | 'planejado'>('realizado');

  // Calculate totals
  const plannedExpenses = budget?.plannedExpenses ?? 0;
  
  // Realized = transactions + confirmed recurrence instances
  const monthTransactions = transactions.filter(t => t.type === 'despesa');
  const realizedExpenses = monthTransactions.reduce((sum, t) => sum + t.amount, 0);
  
  const difference = realizedExpenses - plannedExpenses;
  const percentRealized = plannedExpenses > 0 ? (realizedExpenses / plannedExpenses) * 100 : 0;

  // Build category breakdown
  const expenseCategories = categories.filter(c => c.type === 'despesa');
  
  const categoryBreakdown: CategoryBreakdownItem[] = expenseCategories.map(cat => {
    // Planned from budget
    const catBudgets = budget?.categoryBudgets.filter(cb => cb.categoryId === cat.id) ?? [];
    const planned = catBudgets.reduce((sum, cb) => sum + cb.plannedAmount, 0);
    
    // Realized from transactions
    const realized = monthTransactions
      .filter(t => t.categoryId === cat.id)
      .reduce((sum, t) => sum + t.amount, 0);
    
    const diff = realized - planned;
    let status: 'ok' | 'warning' | 'exceeded' = 'ok';
    if (planned > 0) {
      const pct = (realized / planned) * 100;
      if (pct > 100) status = 'exceeded';
      else if (pct >= 80) status = 'warning';
    } else if (realized > 0) {
      status = 'exceeded';
    }

    // Subcategories breakdown
    const catSubcategories = allSubcategories.filter(s => s.categoryId === cat.id);
    const subcategoriesBreakdown: SubcategoryBreakdownItem[] = catSubcategories.map(sub => {
      const subPlanned = catBudgets
        .filter(cb => cb.subcategoryId === sub.id)
        .reduce((sum, cb) => sum + cb.plannedAmount, 0);
      const subRealized = monthTransactions
        .filter(t => t.subcategoryId === sub.id)
        .reduce((sum, t) => sum + t.amount, 0);
      
      return {
        subcategoryId: sub.id,
        subcategoryName: sub.name,
        planned: subPlanned,
        realized: subRealized,
      };
    }).filter(s => s.planned > 0 || s.realized > 0);

    return {
      categoryId: cat.id,
      categoryName: cat.name,
      icon: cat.icon,
      planned,
      realized,
      difference: diff,
      status,
      subcategories: subcategoriesBreakdown,
    };
  }).filter(c => c.planned > 0 || c.realized > 0)
    .sort((a, b) => b.realized - a.realized);

  const selectedCategory = selectedCategoryId 
    ? categoryBreakdown.find(c => c.categoryId === selectedCategoryId) 
    : null;

  const categoryTransactions = selectedCategoryId 
    ? monthTransactions.filter(t => t.categoryId === selectedCategoryId)
    : [];

  const handleCategoryClick = (categoryId: string) => {
    setSelectedCategoryId(categoryId);
  };

  const handleBack = () => {
    setSelectedCategoryId(null);
  };

  return (
    <Sheet open={isOpen} onOpenChange={onClose}>
      <SheetContent className="w-full sm:max-w-lg overflow-y-auto">
        <SheetHeader className="space-y-4 pb-4 border-b border-border">
          <div className="flex items-center gap-2">
            <Target className="h-5 w-5 text-primary" />
            <SheetTitle>
              {selectedCategory ? selectedCategory.categoryName : 'Planejado vs Realizado'}
            </SheetTitle>
          </div>
          
          {selectedCategory && (
            <button 
              onClick={handleBack}
              className="text-xs text-primary hover:underline text-left"
            >
              ← Voltar para resumo
            </button>
          )}
          
          <div className="text-xs text-muted-foreground">
            {formatMonthYear(selectedMonth, selectedYear)}
          </div>
        </SheetHeader>

        {!selectedCategory ? (
          // Main summary view
          <div className="py-4 space-y-6">
            {/* Summary KPIs */}
            <div className="grid grid-cols-2 gap-3">
              <div className="bg-muted/50 rounded-lg p-3">
                <span className="text-xs text-muted-foreground">Planejado (Despesas)</span>
                <p className="text-lg font-mono font-bold text-foreground">
                  {formatCurrency(plannedExpenses)}
                </p>
              </div>
              <div className="bg-destructive/10 rounded-lg p-3">
                <span className="text-xs text-muted-foreground">Realizado (Despesas)</span>
                <p className="text-lg font-mono font-bold text-destructive">
                  {formatCurrency(realizedExpenses)}
                </p>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className={cn(
                "rounded-lg p-3",
                difference <= 0 ? "bg-success/10" : "bg-destructive/10"
              )}>
                <span className="text-xs text-muted-foreground">Diferença</span>
                <p className={cn(
                  "text-lg font-mono font-bold flex items-center gap-1",
                  difference <= 0 ? "text-success" : "text-destructive"
                )}>
                  {difference <= 0 ? <TrendingDown className="h-4 w-4" /> : <TrendingUp className="h-4 w-4" />}
                  {formatCurrency(Math.abs(difference))}
                </p>
              </div>
              <div className={cn(
                "rounded-lg p-3",
                percentRealized <= 100 ? "bg-success/10" : "bg-destructive/10"
              )}>
                <span className="text-xs text-muted-foreground">% Realizado</span>
                <p className={cn(
                  "text-lg font-mono font-bold",
                  percentRealized <= 80 ? "text-success" : percentRealized <= 100 ? "text-warning" : "text-destructive"
                )}>
                  {formatPercentage(percentRealized)}
                </p>
              </div>
            </div>

            {/* Category breakdown */}
            <div>
              <h4 className="text-sm font-semibold mb-3">Quebra por Categoria</h4>
              <div className="space-y-2">
                {categoryBreakdown.map(cat => (
                  <div
                    key={cat.categoryId}
                    className="flex items-center justify-between py-3 px-3 rounded-lg bg-muted/30 hover:bg-muted/50 cursor-pointer transition-colors"
                    onClick={() => handleCategoryClick(cat.categoryId)}
                  >
                    <div className="flex items-center gap-2 flex-1 min-w-0">
                      <span className="text-lg">{cat.icon || '📦'}</span>
                      <div className="min-w-0 flex-1">
                        <span className="font-medium text-sm truncate block">{cat.categoryName}</span>
                        <div className="flex items-center gap-2 text-xs text-muted-foreground">
                          <span>Plan: {formatCurrency(cat.planned)}</span>
                          <span>|</span>
                          <span>Real: {formatCurrency(cat.realized)}</span>
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <Badge variant={cat.status === 'ok' ? 'default' : cat.status === 'warning' ? 'secondary' : 'destructive'}>
                        {cat.status === 'ok' ? 'OK' : cat.status === 'warning' ? 'Atenção' : 'Estourou'}
                      </Badge>
                      <ChevronRight className="h-4 w-4 text-muted-foreground" />
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        ) : (
          // Category detail view with tabs
          <div className="py-4">
            <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as any)}>
              <TabsList className="grid w-full grid-cols-2">
                <TabsTrigger value="realizado">Realizado</TabsTrigger>
                <TabsTrigger value="planejado">Planejado</TabsTrigger>
              </TabsList>
              
              <TabsContent value="realizado" className="mt-4 space-y-2">
                {categoryTransactions.length === 0 ? (
                  <p className="text-center text-muted-foreground py-8">
                    Nenhum lançamento nesta categoria.
                  </p>
                ) : (
                  categoryTransactions.map(transaction => {
                    const subcategory = allSubcategories.find(s => s.id === transaction.subcategoryId);
                    
                    return (
                      <div 
                        key={transaction.id}
                        className="flex items-center justify-between py-3 px-2 rounded-lg hover:bg-muted/50 transition-colors"
                      >
                        <div className="flex items-center gap-3">
                          <div className="h-8 w-8 rounded-lg flex items-center justify-center bg-destructive/10">
                            <ArrowDownRight className="h-4 w-4 text-destructive" />
                          </div>
                          <div className="min-w-0">
                            <div className="flex items-center gap-2 flex-wrap">
                              <span className="font-medium text-sm truncate">
                                {transaction.description || selectedCategory.categoryName}
                              </span>
                              {subcategory && (
                                <Badge variant="outline" className="text-[10px] px-1.5">
                                  {subcategory.name}
                                </Badge>
                              )}
                            </div>
                            <p className="text-xs text-muted-foreground">
                              {formatDateShort(transaction.date)}
                            </p>
                          </div>
                        </div>
                        <span className="font-mono font-medium text-sm">
                          -{formatCurrency(transaction.amount)}
                        </span>
                      </div>
                    );
                  })
                )}
                
                <div className="border-t border-border pt-3 mt-4">
                  <div className="flex justify-between items-center">
                    <span className="font-medium">Total Realizado</span>
                    <span className="font-mono font-bold text-destructive">
                      {formatCurrency(selectedCategory.realized)}
                    </span>
                  </div>
                </div>
              </TabsContent>
              
              <TabsContent value="planejado" className="mt-4 space-y-4">
                <div className="bg-muted/30 rounded-lg p-4">
                  <div className="flex justify-between items-center">
                    <span className="text-sm text-muted-foreground">Valor Planejado</span>
                    <span className="font-mono font-bold text-lg">
                      {formatCurrency(selectedCategory.planned)}
                    </span>
                  </div>
                </div>

                {selectedCategory.subcategories.length > 0 && (
                  <div>
                    <h5 className="text-sm font-semibold mb-2">Detalhamento por Subcategoria</h5>
                    <div className="space-y-2">
                      {selectedCategory.subcategories.map(sub => (
                        <div 
                          key={sub.subcategoryId}
                          className="flex items-center justify-between py-2 px-3 rounded-lg bg-muted/20"
                        >
                          <span className="text-sm">{sub.subcategoryName}</span>
                          <span className="font-mono text-sm">
                            {formatCurrency(sub.planned)}
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </TabsContent>
            </Tabs>
          </div>
        )}
      </SheetContent>
    </Sheet>
  );
}
