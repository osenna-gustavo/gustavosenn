import { Button } from '@/components/ui/button';
import { useFilters } from '@/contexts/FilterContext';
import type { FilterScreen } from '@/types/filters';
import { cn } from '@/lib/utils';
import { TrendingDown, TrendingUp, Lock, Unlock } from 'lucide-react';

interface QuickFiltersProps {
  screen: FilterScreen;
  showTypeFilters?: boolean;
  showFixedFilters?: boolean;
}

export function QuickFilters({ 
  screen, 
  showTypeFilters = true, 
  showFixedFilters = true 
}: QuickFiltersProps) {
  const { filters, setTypeFilter, setFixedFilter } = useFilters();
  const currentFilters = filters[screen];

  return (
    <div className="flex flex-wrap gap-2">
      {showTypeFilters && (
        <>
          <Button
            variant="outline"
            size="sm"
            className={cn(
              "gap-1.5",
              currentFilters.type === 'despesa' && "bg-destructive/10 border-destructive text-destructive"
            )}
            onClick={() => setTypeFilter(screen, currentFilters.type === 'despesa' ? null : 'despesa')}
          >
            <TrendingDown className="h-3.5 w-3.5" />
            Despesas
          </Button>
          <Button
            variant="outline"
            size="sm"
            className={cn(
              "gap-1.5",
              currentFilters.type === 'receita' && "bg-success/10 border-success text-success"
            )}
            onClick={() => setTypeFilter(screen, currentFilters.type === 'receita' ? null : 'receita')}
          >
            <TrendingUp className="h-3.5 w-3.5" />
            Receitas
          </Button>
        </>
      )}
      
      {showFixedFilters && (
        <>
          <Button
            variant="outline"
            size="sm"
            className={cn(
              "gap-1.5",
              currentFilters.isFixed === true && "bg-primary/10 border-primary text-primary"
            )}
            onClick={() => setFixedFilter(screen, currentFilters.isFixed === true ? null : true)}
          >
            <Lock className="h-3.5 w-3.5" />
            Fixos
          </Button>
          <Button
            variant="outline"
            size="sm"
            className={cn(
              "gap-1.5",
              currentFilters.isFixed === false && "bg-primary/10 border-primary text-primary"
            )}
            onClick={() => setFixedFilter(screen, currentFilters.isFixed === false ? null : false)}
          >
            <Unlock className="h-3.5 w-3.5" />
            Variáveis
          </Button>
        </>
      )}
    </div>
  );
}
