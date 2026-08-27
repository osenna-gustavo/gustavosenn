import { useState } from 'react';
import { useApp } from '@/contexts/AppContext';
import { formatCurrency, formatPercentage } from '@/lib/formatters';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { ChevronDown, ChevronUp } from 'lucide-react';
import type { DrillDownFilter } from './DrillDownDrawer';

const INITIAL_LIMIT = 8;

interface CategoryProgressProps {
  onDrillDown?: (filter: DrillDownFilter) => void;
}

export function CategoryProgress({ onDrillDown }: CategoryProgressProps) {
  const { monthSummary, categories } = useApp();
  const [showAll, setShowAll] = useState(false);

  if (!monthSummary || categories.length === 0) {
    return (
      <div className="glass-card rounded-xl p-4 lg:p-6">
        <div className="h-5 bg-muted rounded w-48 mb-5 animate-pulse" />
        <div className="space-y-4">
          {[...Array(5)].map((_, index) => (
            <div key={index} className="h-16 bg-muted/60 rounded-lg animate-pulse" />
          ))}
        </div>
      </div>
    );
  }

  const categoryRows = monthSummary.categoryBreakdown
    .filter(summary => {
      const category = categories.find(item => item.id === summary.categoryId);
      return category?.type === 'despesa' && (summary.planned > 0 || summary.projected > 0);
    })
    .sort((a, b) => b.projected - a.projected);

  const displayedRows = showAll ? categoryRows : categoryRows.slice(0, INITIAL_LIMIT);
  const hiddenCount = Math.max(0, categoryRows.length - INITIAL_LIMIT);

  return (
    <div className="glass-card rounded-xl p-4 lg:p-6">
      <div className="flex items-start justify-between gap-4 mb-5">
        <div>
          <h3 className="text-lg font-semibold">Orçamento por categoria</h3>
          <p className="text-xs text-muted-foreground mt-1">
            Gasto + comprometido mostram quanto do ciclo já está reservado.
          </p>
        </div>
        <div className="hidden sm:flex items-center gap-3 text-[11px] text-muted-foreground">
          <span className="flex items-center gap-1"><span className="h-2 w-2 rounded-full bg-primary" /> Gasto</span>
          <span className="flex items-center gap-1"><span className="h-2 w-2 rounded-full bg-warning" /> Comprometido</span>
        </div>
      </div>

      {displayedRows.length === 0 ? (
        <p className="text-muted-foreground text-sm text-center py-8">
          Defina um orçamento ou adicione lançamentos para acompanhar o ciclo.
        </p>
      ) : (
        <div className="space-y-3">
          {displayedRows.map(row => {
            const category = categories.find(item => item.id === row.categoryId);
            const realizedWidth = row.planned > 0
              ? Math.min(100, (row.realized / row.planned) * 100)
              : row.realized > 0 ? 100 : 0;
            const committedWidth = row.planned > 0
              ? Math.min(Math.max(0, 100 - realizedWidth), (row.committed / row.planned) * 100)
              : 0;

            return (
              <button
                type="button"
                key={row.categoryId}
                onClick={() => onDrillDown?.({
                  type: 'expenses',
                  categoryId: row.categoryId,
                  title: `Gastos: ${row.categoryName}`,
                })}
                className="w-full rounded-lg border border-border p-3 text-left hover:bg-muted/30 transition-colors"
              >
                <div className="flex items-center justify-between gap-4">
                  <div className="flex items-center gap-2 min-w-0">
                    <span className="text-base">{category?.icon || '📦'}</span>
                    <span className="font-medium text-sm truncate">{row.categoryName}</span>
                    {row.isFixed && (
                      <span className="text-[10px] uppercase px-1.5 py-0.5 rounded bg-muted text-muted-foreground">
                        Fixo
                      </span>
                    )}
                  </div>
                  <div className="text-right shrink-0">
                    <div className="font-mono text-sm font-medium">
                      {formatCurrency(row.projected)}
                      <span className="text-muted-foreground font-normal"> / {formatCurrency(row.planned)}</span>
                    </div>
                    <span className={cn(
                      'text-xs font-medium',
                      row.status === 'ok' && 'text-success',
                      row.status === 'warning' && 'text-warning',
                      row.status === 'exceeded' && 'text-destructive',
                    )}>
                      {formatPercentage(row.percentage)}
                    </span>
                  </div>
                </div>

                <div className="h-2 bg-muted rounded-full overflow-hidden flex mt-3">
                  <div className="h-full bg-primary transition-all" style={{ width: `${realizedWidth}%` }} />
                  <div className="h-full bg-warning transition-all" style={{ width: `${committedWidth}%` }} />
                </div>

                <div className="grid grid-cols-3 gap-2 mt-2 text-[11px] text-muted-foreground">
                  <span>Gasto <strong className="text-foreground font-mono">{formatCurrency(row.realized)}</strong></span>
                  <span>Reservado <strong className="text-foreground font-mono">{formatCurrency(row.committed)}</strong></span>
                  <span className="text-right">Disponível <strong className={cn('font-mono', row.available < 0 ? 'text-destructive' : 'text-success')}>{formatCurrency(row.available)}</strong></span>
                </div>
              </button>
            );
          })}

          {hiddenCount > 0 && (
            <Button
              variant="ghost"
              size="sm"
              className="w-full text-muted-foreground hover:text-foreground"
              onClick={() => setShowAll(value => !value)}
            >
              {showAll ? <ChevronUp className="h-4 w-4 mr-1" /> : <ChevronDown className="h-4 w-4 mr-1" />}
              {showAll ? 'Ver menos' : `Ver mais ${hiddenCount} ${hiddenCount === 1 ? 'categoria' : 'categorias'}`}
            </Button>
          )}
        </div>
      )}
    </div>
  );
}
