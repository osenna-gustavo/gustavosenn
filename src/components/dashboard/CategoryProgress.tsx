import { useApp } from '@/contexts/AppContext';
import { formatCurrency, formatPercentage } from '@/lib/formatters';
import { cn } from '@/lib/utils';
import type { DrillDownFilter } from './DrillDownDrawer';

interface CategoryProgressProps {
  onDrillDown?: (filter: DrillDownFilter) => void;
}

export function CategoryProgress({ onDrillDown }: CategoryProgressProps) {
  const { monthSummary, categories } = useApp();

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

  const sortedCategories = [...monthSummary.categoryBreakdown]
    .filter(c => c.planned > 0 || c.realized > 0)
    .sort((a, b) => b.realized - a.realized);

  const topCategories = sortedCategories.slice(0, 8);

  const handleCategoryClick = (categoryId: string, categoryName: string) => {
    if (onDrillDown) {
      onDrillDown({
        type: 'expenses',
        categoryId,
        title: `Despesas: ${categoryName}`,
      });
    }
  };

  return (
    <div className="glass-card rounded-xl p-4 lg:p-6">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-lg font-semibold">Categorias do Mês</h3>
        <div className="flex gap-3 text-xs">
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
      </div>

      {topCategories.length === 0 ? (
        <p className="text-muted-foreground text-sm text-center py-8">
          Nenhum lançamento ou orçamento definido para este mês.
        </p>
      ) : (
        <div className="space-y-4">
          {topCategories.map((cat) => {
            const category = categories.find(c => c.id === cat.categoryId);
            return (
              <div 
                key={cat.categoryId}
                className="cursor-pointer hover:bg-muted/50 rounded-lg p-2 -mx-2 transition-colors"
                onClick={() => handleCategoryClick(cat.categoryId, cat.categoryName)}
              >
                <div className="flex items-center justify-between mb-1.5">
                  <div className="flex items-center gap-2">
                    <span className="text-base">{category?.icon || '📦'}</span>
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
            );
          })}
        </div>
      )}
    </div>
  );
}
