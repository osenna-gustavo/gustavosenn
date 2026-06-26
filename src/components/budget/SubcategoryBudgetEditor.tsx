import { useState } from 'react';
import { formatCurrency } from '@/lib/formatters';
import { parseBRLToNumber } from '@/lib/currencyInput';
import { CurrencyInput } from '@/components/ui/currency-input';
import { ChevronDown, ChevronRight } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { Category, Subcategory } from '@/types/finance';

interface SubcategoryBudgetEditorProps {
  category: Category;
  subcategories: Subcategory[];
  categoryBudgets: Record<string, string>;
  subcategoryBudgets: Record<string, string>;
  onCategoryChange: (categoryId: string, value: string) => void;
  onSubcategoryChange: (subcategoryId: string, value: string) => void;
  realizedByCategory: Record<string, number>;
  realizedBySubcategory: Record<string, number>;
  autoByCategory?: Record<string, number>;
  autoBySubcategory?: Record<string, number>;
}

export function SubcategoryBudgetEditor({
  category,
  subcategories,
  categoryBudgets,
  subcategoryBudgets,
  onCategoryChange,
  onSubcategoryChange,
  realizedByCategory,
  realizedBySubcategory,
  autoByCategory = {},
  autoBySubcategory = {},
}: SubcategoryBudgetEditorProps) {
  const [isExpanded, setIsExpanded] = useState(false);

  const catSubcategories = subcategories.filter(s => s.categoryId === category.id);
  const hasSubcategories = catSubcategories.length > 0;

  // Manual + auto totals
  const manualCategory = parseBRLToNumber(categoryBudgets[category.id] || '0');
  const autoCategory = autoByCategory[category.id] || 0;

  const subcategoryManualTotal = catSubcategories.reduce(
    (sum, sub) => sum + parseBRLToNumber(subcategoryBudgets[sub.id] || '0'),
    0,
  );
  const subcategoryAutoTotal = catSubcategories.reduce(
    (sum, sub) => sum + (autoBySubcategory[sub.id] || 0),
    0,
  );

  // Total planned for this category = manual cat + auto cat + (manual + auto across subs)
  const totalPlanned =
    manualCategory + autoCategory + subcategoryManualTotal + subcategoryAutoTotal;

  const categoryRealized = realizedByCategory[category.id] || 0;
  const percentage = totalPlanned > 0 ? (categoryRealized / totalPlanned) * 100 : 0;
  const status = percentage > 100 ? 'exceeded' : percentage >= 80 ? 'warning' : 'ok';
  const displayPercentage = Math.round(percentage);

  return (
    <div className="border border-border rounded-lg overflow-hidden">
      {/* Category Header */}
      <div
        className={cn(
          "flex items-center justify-between p-3 hover:bg-muted/50 transition-colors",
          hasSubcategories && "cursor-pointer"
        )}
        onClick={() => hasSubcategories && setIsExpanded(!isExpanded)}
      >
        <div className="flex items-center gap-3 flex-1">
          {hasSubcategories ? (
            isExpanded ? (
              <ChevronDown className="h-4 w-4 text-muted-foreground" />
            ) : (
              <ChevronRight className="h-4 w-4 text-muted-foreground" />
            )
          ) : (
            <div className="w-4" />
          )}
          <span className="text-lg">{category.icon}</span>
          <div className="flex-1">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="font-medium">{category.name}</span>
              {category.isFixed && (
                <span className="text-[10px] uppercase px-1.5 py-0.5 rounded bg-primary/10 text-primary">
                  Fixo
                </span>
              )}
              {(autoCategory + subcategoryAutoTotal) > 0 && (
                <span
                  className="text-[10px] uppercase px-1.5 py-0.5 rounded bg-warning/10 text-warning"
                  title="Inclui valores de recorrências e/ou parcelamentos"
                >
                  Auto {formatCurrency(autoCategory + subcategoryAutoTotal)}
                </span>
              )}
            </div>
            <div className="text-xs text-muted-foreground mt-0.5">
              Realizado: {formatCurrency(categoryRealized)}
              {totalPlanned > 0 && (
                <span className={cn(
                  "ml-2",
                  status === 'exceeded' && "text-destructive",
                  status === 'warning' && "text-warning"
                )}>
                  ({displayPercentage}%)
                </span>
              )}
              <span className="ml-2">
                · Total planejado: <span className="font-mono">{formatCurrency(totalPlanned)}</span>
              </span>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2" onClick={(e) => e.stopPropagation()}>
          {/* Manual extra at category level (always editable) */}
          <div className="flex flex-col items-end">
            <CurrencyInput
              value={categoryBudgets[category.id] || ''}
              onChange={(value) => onCategoryChange(category.id, value)}
              className="w-28"
              placeholder={hasSubcategories ? 'extra' : '0,00'}
            />
            {autoCategory > 0 && (
              <span className="text-[10px] text-muted-foreground mt-0.5">
                + auto {formatCurrency(autoCategory)}
              </span>
            )}
          </div>
        </div>
      </div>

      {/* Subcategories */}
      {hasSubcategories && isExpanded && (
        <div className="border-t border-border bg-muted/30">
          {catSubcategories.map(sub => {
            const subRealized = realizedBySubcategory[sub.id] || 0;
            const subManual = parseBRLToNumber(subcategoryBudgets[sub.id] || '0');
            const subAuto = autoBySubcategory[sub.id] || 0;
            const subPlanned = subManual + subAuto;
            const subPercentage = subPlanned > 0 ? Math.round((subRealized / subPlanned) * 100) : 0;

            return (
              <div
                key={sub.id}
                className="flex items-center justify-between p-3 pl-12 border-t border-border/50"
              >
                <div>
                  <div className="flex items-center gap-2">
                    <span className="text-sm">{sub.name}</span>
                    {subAuto > 0 && (
                      <span
                        className="text-[10px] uppercase px-1.5 py-0.5 rounded bg-warning/10 text-warning"
                        title="Inclui valores de recorrências e/ou parcelamentos"
                      >
                        Auto {formatCurrency(subAuto)}
                      </span>
                    )}
                  </div>
                  <div className="text-xs text-muted-foreground">
                    Realizado: {formatCurrency(subRealized)}
                    {subPlanned > 0 && (
                      <span className={cn(
                        "ml-1",
                        subPercentage > 100 && "text-destructive"
                      )}>
                        ({subPercentage}%)
                      </span>
                    )}
                  </div>
                </div>
                <div className="flex flex-col items-end">
                  <CurrencyInput
                    value={subcategoryBudgets[sub.id] || ''}
                    onChange={(value) => onSubcategoryChange(sub.id, value)}
                    className="w-28"
                    placeholder="extra"
                  />
                  {subAuto > 0 && (
                    <span className="text-[10px] text-muted-foreground mt-0.5">
                      Total: {formatCurrency(subPlanned)}
                    </span>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Progress bar */}
      <div className="h-1 bg-muted">
        <div
          className={cn(
            "h-full transition-all",
            status === 'ok' && "bg-primary",
            status === 'warning' && "bg-warning",
            status === 'exceeded' && "bg-destructive"
          )}
          style={{ width: `${Math.min(percentage, 100)}%` }}
        />
      </div>
    </div>
  );
}
