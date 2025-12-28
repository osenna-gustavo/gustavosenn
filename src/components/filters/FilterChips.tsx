import { X } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { useFilters } from '@/contexts/FilterContext';
import type { FilterScreen } from '@/types/filters';
import type { Category, Subcategory } from '@/types/finance';

interface FilterChipsProps {
  screen: FilterScreen;
  categories: Category[];
  subcategories: Subcategory[];
}

export function FilterChips({ screen, categories, subcategories }: FilterChipsProps) {
  const { 
    filters, 
    setTypeFilter, 
    setFixedFilter, 
    setCategoryFilter,
    setSubcategoryFilter,
    removeCondition,
    resetFilters,
    hasActiveFilters,
  } = useFilters();

  const currentFilters = filters[screen];

  if (!hasActiveFilters(screen)) {
    return null;
  }

  const getCategoryName = (id: string) => categories.find(c => c.id === id)?.name || id;
  const getSubcategoryName = (id: string) => subcategories.find(s => s.id === id)?.name || id;

  return (
    <div className="flex flex-wrap gap-2 items-center">
      {/* Type chip */}
      {currentFilters.type && (
        <Badge variant="secondary" className="gap-1 pr-1">
          {currentFilters.type === 'receita' ? 'Receitas' : 'Despesas'}
          <Button
            variant="ghost"
            size="icon"
            className="h-4 w-4 p-0 hover:bg-transparent"
            onClick={() => setTypeFilter(screen, null)}
          >
            <X className="h-3 w-3" />
          </Button>
        </Badge>
      )}

      {/* Fixed/Variable chip */}
      {currentFilters.isFixed !== null && currentFilters.isFixed !== undefined && (
        <Badge variant="secondary" className="gap-1 pr-1">
          {currentFilters.isFixed ? 'Fixos' : 'Variáveis'}
          <Button
            variant="ghost"
            size="icon"
            className="h-4 w-4 p-0 hover:bg-transparent"
            onClick={() => setFixedFilter(screen, null)}
          >
            <X className="h-3 w-3" />
          </Button>
        </Badge>
      )}

      {/* Category chips */}
      {currentFilters.categoryIds?.map(catId => (
        <Badge key={catId} variant="secondary" className="gap-1 pr-1">
          {getCategoryName(catId)}
          <Button
            variant="ghost"
            size="icon"
            className="h-4 w-4 p-0 hover:bg-transparent"
            onClick={() => setCategoryFilter(
              screen, 
              currentFilters.categoryIds?.filter(id => id !== catId) || []
            )}
          >
            <X className="h-3 w-3" />
          </Button>
        </Badge>
      ))}

      {/* Subcategory chips */}
      {currentFilters.subcategoryIds?.map(subId => (
        <Badge key={subId} variant="outline" className="gap-1 pr-1">
          {getSubcategoryName(subId)}
          <Button
            variant="ghost"
            size="icon"
            className="h-4 w-4 p-0 hover:bg-transparent"
            onClick={() => setSubcategoryFilter(
              screen, 
              currentFilters.subcategoryIds?.filter(id => id !== subId) || []
            )}
          >
            <X className="h-3 w-3" />
          </Button>
        </Badge>
      ))}

      {/* Advanced condition chips */}
      {currentFilters.conditions.map(condition => (
        <Badge key={condition.id} variant="outline" className="gap-1 pr-1">
          {condition.field}: {String(condition.value)}
          <Button
            variant="ghost"
            size="icon"
            className="h-4 w-4 p-0 hover:bg-transparent"
            onClick={() => removeCondition(screen, condition.id)}
          >
            <X className="h-3 w-3" />
          </Button>
        </Badge>
      ))}

      {/* Clear all */}
      <Button
        variant="ghost"
        size="sm"
        className="h-6 text-xs text-muted-foreground"
        onClick={() => resetFilters(screen)}
      >
        Limpar tudo
      </Button>
    </div>
  );
}
