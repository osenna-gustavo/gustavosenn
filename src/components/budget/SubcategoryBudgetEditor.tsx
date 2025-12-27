import { useState } from 'react';
import { formatCurrency } from '@/lib/formatters';
import { parseBRLToNumber, formatNumberToBRL } from '@/lib/currencyInput';
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
}: SubcategoryBudgetEditorProps) {
  const [isExpanded, setIsExpanded] = useState(false);
  
  const catSubcategories = subcategories.filter(s => s.categoryId === category.id);
  const hasSubcategories = catSubcategories.length > 0;
  
  // Calculate totals using proper BRL parsing
  const subcategoryTotal = catSubcategories.reduce((sum, sub) => {
    return sum + parseBRLToNumber(subcategoryBudgets[sub.id] || '0');
  }, 0);
  
  const categoryPlanned = parseBRLToNumber(categoryBudgets[category.id] || '0');
  const categoryRealized = realizedByCategory[category.id] || 0;
  
  // If has subcategories with values, show sum of subcategories
  const displayedPlanned = hasSubcategories && subcategoryTotal > 0 ? subcategoryTotal : categoryPlanned;
  
  const percentage = displayedPlanned > 0 ? (categoryRealized / displayedPlanned) * 100 : 0;
  const status = percentage > 100 ? 'exceeded' : percentage >= 80 ? 'warning' : 'ok';

  // Round percentage to avoid floating point display issues
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
            <div className="flex items-center gap-2">
              <span className="font-medium">{category.name}</span>
              {category.isFixed && (
                <span className="text-[10px] uppercase px-1.5 py-0.5 rounded bg-primary/10 text-primary">
                  Fixo
                </span>
              )}
            </div>
            <div className="text-xs text-muted-foreground mt-0.5">
              Realizado: {formatCurrency(categoryRealized)}
              <span className={cn(
                "ml-2",
                status === 'exceeded' && "text-destructive",
                status === 'warning' && "text-warning"
              )}>
                ({displayPercentage}%)
              </span>
            </div>
          </div>
        </div>
        
        <div className="flex items-center gap-2" onClick={(e) => e.stopPropagation()}>
          {!hasSubcategories ? (
            // No subcategories - editable input
            <CurrencyInput
              value={categoryBudgets[category.id] || ''}
              onChange={(value) => onCategoryChange(category.id, value)}
              className="w-28"
            />
          ) : subcategoryTotal > 0 ? (
            // Has subcategories with values - show read-only total
            <div className="w-28 text-right font-mono text-muted-foreground" title="Total calculado das subcategorias">
              {formatCurrency(subcategoryTotal)}
            </div>
          ) : (
            // Has subcategories but no values - allow direct entry or expand
            <CurrencyInput
              value={categoryBudgets[category.id] || ''}
              onChange={(value) => onCategoryChange(category.id, value)}
              className="w-28"
            />
          )}
        </div>
      </div>
      
      {/* Subcategories */}
      {hasSubcategories && isExpanded && (
        <div className="border-t border-border bg-muted/30">
          {catSubcategories.map(sub => {
            const subRealized = realizedBySubcategory[sub.id] || 0;
            const subPlanned = parseBRLToNumber(subcategoryBudgets[sub.id] || '0');
            const subPercentage = subPlanned > 0 ? Math.round((subRealized / subPlanned) * 100) : 0;
            
            return (
              <div 
                key={sub.id} 
                className="flex items-center justify-between p-3 pl-12 border-t border-border/50"
              >
                <div>
                  <span className="text-sm">{sub.name}</span>
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
                <CurrencyInput
                  value={subcategoryBudgets[sub.id] || ''}
                  onChange={(value) => onSubcategoryChange(sub.id, value)}
                  className="w-28"
                />
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
