import { useState } from 'react';
import { useApp } from '@/contexts/AppContext';
import { formatCurrency, formatPercentage } from '@/lib/formatters';
import { cn } from '@/lib/utils';
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group';
import { List, Layers, ChevronDown, ChevronRight } from 'lucide-react';
import type { DrillDownFilter } from './DrillDownDrawer';

interface CategoryProgressProps {
  onDrillDown?: (filter: DrillDownFilter) => void;
}

type ViewMode = 'simple' | 'grouped';

interface SubcategoryData {
  subcategoryId: string;
  subcategoryName: string;
  planned: number;
  realized: number;
  percentage: number;
  status: 'ok' | 'warning' | 'exceeded';
}

interface GroupedCategoryData {
  categoryId: string;
  categoryName: string;
  icon?: string;
  isFixed: boolean;
  planned: number;
  realized: number;
  percentage: number;
  status: 'ok' | 'warning' | 'exceeded';
  subcategories: SubcategoryData[];
  isExpanded: boolean;
}

export function CategoryProgress({ onDrillDown }: CategoryProgressProps) {
  const { monthSummary, categories, subcategories: allSubcategories, transactions, budget } = useApp();
  const [viewMode, setViewMode] = useState<ViewMode>('simple');
  const [expandedCategories, setExpandedCategories] = useState<Set<string>>(new Set());

  if (!monthSummary || categories.length === 0) {
    return (
      <div className="glass-card rounded-xl p-4 lg:p-6">
        <h3 className="text-lg font-semibold mb-4">Categorias</h3>
        <div className="space-y-4">
          {[...Array(5)].map((_, i) => (
            <div key={i} className="animate-pulse">
              <div className="h-4 bg-muted rounded w-32 mb-2" />
              <div className="h-2 bg-muted rounded" />
            </div>
          ))}
        </div>
      </div>
    );
  }

  const monthTransactions = transactions;

  // Build grouped data with subcategories
  const groupedCategories: GroupedCategoryData[] = categories
    .filter(c => c.type === 'despesa')
    .map(cat => {
      const catBudgets = budget?.categoryBudgets.filter(cb => cb.categoryId === cat.id) ?? [];
      const planned = catBudgets.reduce((sum, cb) => sum + cb.plannedAmount, 0);
      const realized = monthTransactions
        .filter(t => t.type === 'despesa' && t.categoryId === cat.id)
        .reduce((sum, t) => sum + t.amount, 0);
      
      const percentage = planned > 0 ? (realized / planned) * 100 : (realized > 0 ? 100 : 0);
      let status: 'ok' | 'warning' | 'exceeded' = 'ok';
      if (percentage > 100) status = 'exceeded';
      else if (percentage >= 80) status = 'warning';

      // Get subcategories with data
      const catSubcategories = allSubcategories.filter(s => s.categoryId === cat.id);
      const subcategoriesData: SubcategoryData[] = catSubcategories
        .map(sub => {
          const subPlanned = catBudgets
            .filter(cb => cb.subcategoryId === sub.id)
            .reduce((sum, cb) => sum + cb.plannedAmount, 0);
          const subRealized = monthTransactions
            .filter(t => t.type === 'despesa' && t.subcategoryId === sub.id)
            .reduce((sum, t) => sum + t.amount, 0);
          
          const subPercentage = subPlanned > 0 ? (subRealized / subPlanned) * 100 : (subRealized > 0 ? 100 : 0);
          let subStatus: 'ok' | 'warning' | 'exceeded' = 'ok';
          if (subPercentage > 100) subStatus = 'exceeded';
          else if (subPercentage >= 80) subStatus = 'warning';

          return {
            subcategoryId: sub.id,
            subcategoryName: sub.name,
            planned: subPlanned,
            realized: subRealized,
            percentage: subPercentage,
            status: subStatus,
          };
        })
        .filter(s => s.planned > 0 || s.realized > 0);

      return {
        categoryId: cat.id,
        categoryName: cat.name,
        icon: cat.icon,
        isFixed: cat.isFixed,
        planned,
        realized,
        percentage,
        status,
        subcategories: subcategoriesData,
        isExpanded: expandedCategories.has(cat.id),
      };
    })
    .filter(c => c.planned > 0 || c.realized > 0)
    .sort((a, b) => b.realized - a.realized);

  const topCategories = groupedCategories.slice(0, 8);

  const handleCategoryClick = (categoryId: string, categoryName: string) => {
    if (onDrillDown) {
      onDrillDown({
        type: 'expenses',
        categoryId,
        title: `Despesas: ${categoryName}`,
      });
    }
  };

  const handleSubcategoryClick = (categoryId: string, subcategoryId: string, subcategoryName: string) => {
    if (onDrillDown) {
      onDrillDown({
        type: 'expenses',
        categoryId,
        subcategoryId,
        title: `Despesas: ${subcategoryName}`,
      });
    }
  };

  const toggleCategoryExpansion = (categoryId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    setExpandedCategories(prev => {
      const next = new Set(prev);
      if (next.has(categoryId)) {
        next.delete(categoryId);
      } else {
        next.add(categoryId);
      }
      return next;
    });
  };

  return (
    <div className="glass-card rounded-xl p-4 lg:p-6">
      <div className="flex items-center justify-between mb-4 flex-wrap gap-2">
        <h3 className="text-lg font-semibold">Categorias do Mês</h3>
        <div className="flex items-center gap-3">
          <ToggleGroup 
            type="single" 
            value={viewMode} 
            onValueChange={(v) => v && setViewMode(v as ViewMode)}
            className="bg-muted rounded-lg p-0.5"
          >
            <ToggleGroupItem value="simple" aria-label="Lista simples" className="px-2 py-1 text-xs gap-1 data-[state=on]:bg-background">
              <List className="h-3 w-3" />
              Simples
            </ToggleGroupItem>
            <ToggleGroupItem value="grouped" aria-label="Agrupar por categoria" className="px-2 py-1 text-xs gap-1 data-[state=on]:bg-background">
              <Layers className="h-3 w-3" />
              Agrupado
            </ToggleGroupItem>
          </ToggleGroup>
        </div>
      </div>

      <div className="flex gap-3 text-xs mb-4">
        <span className="flex items-center gap-1">
          <span className="h-2 w-2 rounded-full bg-success" />
          OK
        </span>
        <span className="flex items-center gap-1">
          <span className="h-2 w-2 rounded-full bg-warning" />
          Atenção
        </span>
        <span className="flex items-center gap-1">
          <span className="h-2 w-2 rounded-full bg-destructive" />
          Estourou
        </span>
      </div>

      {topCategories.length === 0 ? (
        <p className="text-muted-foreground text-sm text-center py-8">
          Nenhum lançamento ou orçamento definido para este mês.
        </p>
      ) : viewMode === 'simple' ? (
        // Simple view - flat list
        <div className="space-y-4">
          {topCategories.map((cat) => (
            <div 
              key={cat.categoryId}
              className="cursor-pointer hover:bg-muted/50 rounded-lg p-2 -mx-2 transition-colors"
              onClick={() => handleCategoryClick(cat.categoryId, cat.categoryName)}
            >
              <div className="flex items-center justify-between mb-1.5">
                <div className="flex items-center gap-2">
                  <span className="text-base">{cat.icon || '📦'}</span>
                  <span className="font-medium text-sm">{cat.categoryName}</span>
                  {cat.isFixed && (
                    <span className="text-[10px] uppercase px-1.5 py-0.5 rounded bg-muted text-muted-foreground">
                      Fixo
                    </span>
                  )}
                </div>
                <div className="flex items-center gap-2 text-sm">
                  <span className="font-mono font-medium">
                    {formatCurrency(cat.realized)}
                  </span>
                  {cat.planned > 0 && (
                    <span className="text-muted-foreground">
                      / {formatCurrency(cat.planned)}
                    </span>
                  )}
                </div>
              </div>
              
              <div className="flex items-center gap-2">
                <div className="flex-1 h-2 bg-muted rounded-full overflow-hidden">
                  <div
                    className={cn(
                      "h-full rounded-full transition-all duration-500",
                      cat.status === 'ok' && "bg-success",
                      cat.status === 'warning' && "bg-warning",
                      cat.status === 'exceeded' && "bg-destructive"
                    )}
                    style={{ width: `${Math.min(cat.percentage, 100)}%` }}
                  />
                </div>
                <span className={cn(
                  "text-xs font-medium w-12 text-right",
                  cat.status === 'ok' && "text-success",
                  cat.status === 'warning' && "text-warning",
                  cat.status === 'exceeded' && "text-destructive"
                )}>
                  {formatPercentage(Math.round(cat.percentage))}
                </span>
              </div>
            </div>
          ))}
        </div>
      ) : (
        // Grouped view - with expandable subcategories
        <div className="space-y-2">
          {topCategories.map((cat) => (
            <div key={cat.categoryId} className="rounded-lg border border-border overflow-hidden">
              {/* Category header */}
              <div 
                className="flex items-center justify-between p-3 bg-muted/30 hover:bg-muted/50 cursor-pointer transition-colors"
                onClick={() => handleCategoryClick(cat.categoryId, cat.categoryName)}
              >
                <div className="flex items-center gap-2 flex-1">
                  {cat.subcategories.length > 0 && (
                    <button
                      onClick={(e) => toggleCategoryExpansion(cat.categoryId, e)}
                      className="p-0.5 hover:bg-muted rounded"
                    >
                      {expandedCategories.has(cat.categoryId) ? (
                        <ChevronDown className="h-4 w-4 text-muted-foreground" />
                      ) : (
                        <ChevronRight className="h-4 w-4 text-muted-foreground" />
                      )}
                    </button>
                  )}
                  <span className="text-base">{cat.icon || '📦'}</span>
                  <span className="font-medium text-sm">{cat.categoryName}</span>
                  {cat.isFixed && (
                    <span className="text-[10px] uppercase px-1.5 py-0.5 rounded bg-muted text-muted-foreground">
                      Fixo
                    </span>
                  )}
                  {cat.subcategories.length > 0 && (
                    <span className="text-[10px] text-muted-foreground">
                      ({cat.subcategories.length})
                    </span>
                  )}
                </div>
                <div className="flex items-center gap-3">
                  <div className="text-right">
                    <div className="flex items-center gap-2 text-sm">
                      <span className="font-mono font-medium">
                        {formatCurrency(cat.realized)}
                      </span>
                      {cat.planned > 0 && (
                        <span className="text-muted-foreground text-xs">
                          / {formatCurrency(cat.planned)}
                        </span>
                      )}
                    </div>
                  </div>
                  <span className={cn(
                    "text-xs font-medium w-12 text-right",
                    cat.status === 'ok' && "text-success",
                    cat.status === 'warning' && "text-warning",
                    cat.status === 'exceeded' && "text-destructive"
                  )}>
                    {formatPercentage(Math.round(cat.percentage))}
                  </span>
                </div>
              </div>

              {/* Subcategories */}
              {expandedCategories.has(cat.categoryId) && cat.subcategories.length > 0 && (
                <div className="border-t border-border">
                  {cat.subcategories.map((sub) => (
                    <div
                      key={sub.subcategoryId}
                      className="flex items-center justify-between py-2 px-3 pl-10 hover:bg-muted/30 cursor-pointer transition-colors border-b border-border last:border-b-0"
                      onClick={(e) => {
                        e.stopPropagation();
                        handleSubcategoryClick(cat.categoryId, sub.subcategoryId, sub.subcategoryName);
                      }}
                    >
                      <span className="text-sm text-muted-foreground">{sub.subcategoryName}</span>
                      <div className="flex items-center gap-3">
                        <div className="flex items-center gap-2 text-sm">
                          <span className="font-mono">{formatCurrency(sub.realized)}</span>
                          {sub.planned > 0 && (
                            <span className="text-muted-foreground text-xs">
                              / {formatCurrency(sub.planned)}
                            </span>
                          )}
                        </div>
                        <span className={cn(
                          "text-xs font-medium w-10 text-right",
                          sub.status === 'ok' && "text-success",
                          sub.status === 'warning' && "text-warning",
                          sub.status === 'exceeded' && "text-destructive"
                        )}>
                          {formatPercentage(Math.round(sub.percentage))}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
