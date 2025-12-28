import { QuickFilters } from './QuickFilters';
import { FilterChips } from './FilterChips';
import { FilterBuilder } from './FilterBuilder';
import type { FilterScreen } from '@/types/filters';
import type { Category, Subcategory } from '@/types/finance';

interface FilterPanelProps {
  screen: FilterScreen;
  categories: Category[];
  subcategories: Subcategory[];
  showTypeFilters?: boolean;
  showFixedFilters?: boolean;
  className?: string;
}

export function FilterPanel({
  screen,
  categories,
  subcategories,
  showTypeFilters = true,
  showFixedFilters = true,
  className = '',
}: FilterPanelProps) {
  return (
    <div className={`space-y-3 ${className}`}>
      {/* Quick filters row */}
      <div className="flex flex-wrap items-center gap-3">
        <QuickFilters 
          screen={screen} 
          showTypeFilters={showTypeFilters} 
          showFixedFilters={showFixedFilters} 
        />
        <FilterBuilder 
          screen={screen} 
          categories={categories} 
          subcategories={subcategories} 
        />
      </div>

      {/* Active filter chips */}
      <FilterChips 
        screen={screen} 
        categories={categories} 
        subcategories={subcategories} 
      />
    </div>
  );
}
