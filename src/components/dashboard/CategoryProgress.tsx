import { useMemo, useState } from 'react';
import { useApp } from '@/contexts/AppContext';
import { formatCurrency, formatPercentage } from '@/lib/formatters';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { ChevronDown, ChevronRight, ChevronUp } from 'lucide-react';
import { computeCycleCommitments } from '@/lib/cycle-commitments';
import { computeRealized } from '@/lib/category-summary';
import type { DrillDownFilter } from './DrillDownDrawer';

const INITIAL_LIMIT = 8;

interface CategoryProgressProps {
  onDrillDown?: (filter: DrillDownFilter) => void;
}

interface SubcategoryRow {
  subcategoryId: string;
  name: string;
  planned: number;
  realized: number;
  committed: number;
  projected: number;
  available: number;
  percentage: number;
  status: 'ok' | 'warning' | 'exceeded';
}

export function CategoryProgress({ onDrillDown }: CategoryProgressProps) {
  const {
    monthSummary,
    categories,
    subcategories,
    transactions,
    budget,
    recurrences,
    recurrenceInstances,
    selectedMonth,
    selectedYear,
  } = useApp();
  const [showAll, setShowAll] = useState(false);
  const [expanded, setExpanded] = useState<Record<string, boolean>>({});

  const subcategoryRowsByCategory = useMemo(() => {
    const plannedMaps = buildPlannedBudgetMaps(
      budget,
      subcategories,
      recurrences,
      recurrenceInstances,
      transactions,
      selectedMonth,
      selectedYear,
    );
    const commitments = plannedMaps.commitments;

    const map: Record<string, SubcategoryRow[]> = {};

    for (const sub of subcategories) {
      const planned = plannedMaps.bySubcategory[sub.id] ?? 0;

      const realized = computeRealized(
        transactions,
        { categoryId: sub.categoryId, subcategoryId: sub.id, type: 'despesa' },
        categories,
        subcategories,
      );
      const committed = commitments.committedBySubcategory[sub.id] ?? 0;

      if (planned <= 0 && realized <= 0 && committed <= 0) continue;

      const projected = realized + committed;
      const percentage = planned > 0 ? (projected / planned) * 100 : (projected > 0 ? 100 : 0);

      let status: 'ok' | 'warning' | 'exceeded' = 'ok';
      if (percentage > 100) status = 'exceeded';
      else if (percentage >= 80) status = 'warning';

      const row: SubcategoryRow = {
        subcategoryId: sub.id,
        name: sub.name,
        planned,
        realized,
        committed,
        projected,
        available: planned - projected,
        percentage,
        status,
      };

      map[sub.categoryId] = [...(map[sub.categoryId] ?? []), row];
    }

    for (const key of Object.keys(map)) {
      map[key].sort((a, b) => b.projected - a.projected);
    }

    return map;
  }, [
    budget,
    categories,
    recurrenceInstances,
    recurrences,
    selectedMonth,
    selectedYear,
    subcategories,
    transactions,
  ]);

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
            const subRows = subcategoryRowsByCategory[row.categoryId] ?? [];
            const hasSubRows = subRows.length > 0;
            const isExpanded = !!expanded[row.categoryId];

            return (
              <div key={row.categoryId} className="rounded-lg border border-border">
                <div className="p-3">
                  <div className="flex items-center justify-between gap-4">
                    <div className="flex items-center gap-2 min-w-0">
                      {hasSubRows ? (
                        <button
                          type="button"
                          aria-label={isExpanded ? 'Recolher subcategorias' : 'Expandir subcategorias'}
                          aria-expanded={isExpanded}
                          onClick={() => setExpanded(prev => ({ ...prev, [row.categoryId]: !prev[row.categoryId] }))}
                          className="text-muted-foreground hover:text-foreground transition-colors"
                        >
                          {isExpanded ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
                        </button>
                      ) : (
                        <span className="h-4 w-4 shrink-0" />
                      )}
                      <span className="text-base">{category?.icon || '📦'}</span>
                      <button
                        type="button"
                        onClick={() => onDrillDown?.({
                          type: 'expenses',
                          categoryId: row.categoryId,
                          title: `Gastos: ${row.categoryName}`,
                        })}
                        className="font-medium text-sm truncate text-left hover:underline"
                      >
                        {row.categoryName}
                      </button>
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
                </div>

                {isExpanded && (
                  <div className="border-t border-border px-3 py-2 space-y-2">
                    {subRows.length === 0 ? (
                      <p className="text-[11px] text-muted-foreground py-1">
                        Sem lançamentos por subcategoria neste ciclo
                      </p>
                    ) : subRows.map(sub => {
                      const subRealizedWidth = sub.planned > 0
                        ? Math.min(100, (sub.realized / sub.planned) * 100)
                        : sub.realized > 0 ? 100 : 0;
                      const subCommittedWidth = sub.planned > 0
                        ? Math.min(Math.max(0, 100 - subRealizedWidth), (sub.committed / sub.planned) * 100)
                        : 0;

                      return (
                        <button
                          type="button"
                          key={sub.subcategoryId}
                          onClick={() => onDrillDown?.({
                            type: 'expenses',
                            categoryId: row.categoryId,
                            subcategoryId: sub.subcategoryId,
                            title: `Gastos: ${row.categoryName} · ${sub.name}`,
                          })}
                          className="w-full text-left rounded-md pl-6 pr-2 py-2 hover:bg-muted/30 transition-colors"
                        >
                          <div className="flex items-center justify-between gap-3">
                            <span className="text-xs truncate">{sub.name}</span>
                            <div className="text-right shrink-0">
                              <div className="font-mono text-xs">
                                {formatCurrency(sub.projected)}
                                <span className="text-muted-foreground"> / {formatCurrency(sub.planned)}</span>
                              </div>
                              <span className={cn(
                                'text-[10px] font-medium',
                                sub.status === 'ok' && 'text-success',
                                sub.status === 'warning' && 'text-warning',
                                sub.status === 'exceeded' && 'text-destructive',
                              )}>
                                {formatPercentage(sub.percentage)}
                              </span>
                            </div>
                          </div>

                          <div className="h-1.5 bg-muted rounded-full overflow-hidden flex mt-2">
                            <div className="h-full bg-primary transition-all" style={{ width: `${subRealizedWidth}%` }} />
                            <div className="h-full bg-warning transition-all" style={{ width: `${subCommittedWidth}%` }} />
                          </div>

                          <div className="grid grid-cols-3 gap-2 mt-1.5 text-[10px] text-muted-foreground">
                            <span>Gasto <strong className="text-foreground font-mono">{formatCurrency(sub.realized)}</strong></span>
                            <span>Reservado <strong className="text-foreground font-mono">{formatCurrency(sub.committed)}</strong></span>
                            <span className="text-right">Disponível <strong className={cn('font-mono', sub.available < 0 ? 'text-destructive' : 'text-success')}>{formatCurrency(sub.available)}</strong></span>
                          </div>
                        </button>
                      );
                    })}
                  </div>
                )}
              </div>
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
