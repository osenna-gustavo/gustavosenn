import { useState } from 'react';
import { Plus, Trash2, Filter } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from '@/components/ui/sheet';
import { useFilters } from '@/contexts/FilterContext';
import type { FilterScreen, FilterField, FilterOperator, FilterCondition } from '@/types/filters';
import { filterFieldConfig, operatorLabels } from '@/types/filters';
import type { Category, Subcategory } from '@/types/finance';
import { v4 as uuidv4 } from 'uuid';

interface FilterBuilderProps {
  screen: FilterScreen;
  categories: Category[];
  subcategories: Subcategory[];
  availableFields?: FilterField[];
}

const defaultFields: FilterField[] = [
  'type', 'category_id', 'subcategory_id', 'is_fixed', 
  'amount', 'origin', 'description', 'needs_review'
];

export function FilterBuilder({ 
  screen, 
  categories, 
  subcategories,
  availableFields = defaultFields 
}: FilterBuilderProps) {
  const { filters, addCondition, removeCondition, updateCondition, getActiveFilterCount } = useFilters();
  const [isOpen, setIsOpen] = useState(false);
  const [newCondition, setNewCondition] = useState<Partial<FilterCondition>>({
    field: undefined,
    operator: undefined,
    value: '',
  });

  const currentFilters = filters[screen];
  const filterCount = getActiveFilterCount(screen);

  const handleAddCondition = () => {
    if (!newCondition.field || !newCondition.operator || newCondition.value === undefined) {
      return;
    }

    const condition: FilterCondition = {
      id: uuidv4(),
      field: newCondition.field,
      operator: newCondition.operator,
      value: newCondition.value,
      value2: newCondition.value2,
    };

    addCondition(screen, condition);
    setNewCondition({ field: undefined, operator: undefined, value: '' });
  };

  const getValueOptions = (field: FilterField) => {
    switch (field) {
      case 'type':
        return [
          { value: 'receita', label: 'Receita' },
          { value: 'despesa', label: 'Despesa' },
        ];
      case 'origin':
        return [
          { value: 'manual', label: 'Manual' },
          { value: 'import', label: 'Importação' },
          { value: 'recurrence', label: 'Recorrência' },
        ];
      case 'status':
        return [
          { value: 'pending', label: 'Pendente' },
          { value: 'confirmed', label: 'Confirmado' },
          { value: 'ignored', label: 'Ignorado' },
        ];
      case 'category_id':
        return categories.map(c => ({ value: c.id, label: `${c.icon || ''} ${c.name}` }));
      case 'subcategory_id':
        return subcategories.map(s => ({ value: s.id, label: s.name }));
      default:
        return [];
    }
  };

  const renderValueInput = (field: FilterField, operator: FilterOperator) => {
    const config = filterFieldConfig[field];
    
    if (operator === 'is_true' || operator === 'is_false') {
      return null; // No value needed for boolean operators
    }

    if (config.valueType === 'select' || config.valueType === 'multiselect') {
      const options = getValueOptions(field);
      return (
        <Select
          value={String(newCondition.value)}
          onValueChange={(val) => setNewCondition(prev => ({ ...prev, value: val }))}
        >
          <SelectTrigger className="w-full">
            <SelectValue placeholder="Valor..." />
          </SelectTrigger>
          <SelectContent>
            {options.map(opt => (
              <SelectItem key={opt.value} value={opt.value}>
                {opt.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      );
    }

    if (config.valueType === 'number') {
      return (
        <div className="flex gap-2">
          <Input
            type="number"
            placeholder="Valor"
            value={String(newCondition.value)}
            onChange={(e) => setNewCondition(prev => ({ ...prev, value: parseFloat(e.target.value) || 0 }))}
          />
          {operator === 'between' && (
            <Input
              type="number"
              placeholder="Até"
              value={String(newCondition.value2 || '')}
              onChange={(e) => setNewCondition(prev => ({ ...prev, value2: parseFloat(e.target.value) || 0 }))}
            />
          )}
        </div>
      );
    }

    if (config.valueType === 'date') {
      return (
        <div className="flex gap-2">
          <Input
            type="date"
            value={String(newCondition.value)}
            onChange={(e) => setNewCondition(prev => ({ ...prev, value: e.target.value }))}
          />
          {operator === 'between' && (
            <Input
              type="date"
              value={String(newCondition.value2 || '')}
              onChange={(e) => setNewCondition(prev => ({ ...prev, value2: e.target.value }))}
            />
          )}
        </div>
      );
    }

    return (
      <Input
        type="text"
        placeholder="Valor..."
        value={String(newCondition.value)}
        onChange={(e) => setNewCondition(prev => ({ ...prev, value: e.target.value }))}
      />
    );
  };

  return (
    <Sheet open={isOpen} onOpenChange={setIsOpen}>
      <SheetTrigger asChild>
        <Button variant="outline" size="sm" className="gap-2">
          <Filter className="h-4 w-4" />
          Filtros
          {filterCount > 0 && (
            <span className="ml-1 rounded-full bg-primary px-2 py-0.5 text-xs text-primary-foreground">
              {filterCount}
            </span>
          )}
        </Button>
      </SheetTrigger>
      <SheetContent className="w-full sm:max-w-lg overflow-y-auto">
        <SheetHeader>
          <SheetTitle>Filtros Avançados</SheetTitle>
          <SheetDescription>
            Construa filtros personalizados para refinar os dados exibidos.
          </SheetDescription>
        </SheetHeader>

        <div className="space-y-6 py-6">
          {/* Existing conditions */}
          {currentFilters.conditions.length > 0 && (
            <div className="space-y-3">
              <Label className="text-sm font-medium">Condições ativas</Label>
              {currentFilters.conditions.map((condition) => (
                <div 
                  key={condition.id}
                  className="flex items-center gap-2 p-3 rounded-lg border border-border bg-muted/30"
                >
                  <div className="flex-1 text-sm">
                    <span className="font-medium">{filterFieldConfig[condition.field]?.label}</span>
                    {' '}
                    <span className="text-muted-foreground">{operatorLabels[condition.operator]}</span>
                    {' '}
                    {condition.value !== undefined && condition.value !== '' && (
                      <span className="font-mono">{String(condition.value)}</span>
                    )}
                    {condition.value2 !== undefined && (
                      <span className="text-muted-foreground"> e <span className="font-mono">{String(condition.value2)}</span></span>
                    )}
                  </div>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8 text-muted-foreground hover:text-destructive"
                    onClick={() => removeCondition(screen, condition.id)}
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              ))}
            </div>
          )}

          {/* Add new condition */}
          <div className="space-y-4 p-4 rounded-lg border border-dashed border-border">
            <Label className="text-sm font-medium">Adicionar condição</Label>
            
            {/* Field select */}
            <div className="space-y-2">
              <Label className="text-xs text-muted-foreground">Campo</Label>
              <Select
                value={newCondition.field}
                onValueChange={(val) => setNewCondition(prev => ({ 
                  ...prev, 
                  field: val as FilterField,
                  operator: undefined,
                  value: '',
                }))}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Selecione o campo..." />
                </SelectTrigger>
                <SelectContent>
                  {availableFields.map(field => (
                    <SelectItem key={field} value={field}>
                      {filterFieldConfig[field]?.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Operator select */}
            {newCondition.field && (
              <div className="space-y-2">
                <Label className="text-xs text-muted-foreground">Operador</Label>
                <Select
                  value={newCondition.operator}
                  onValueChange={(val) => setNewCondition(prev => ({ 
                    ...prev, 
                    operator: val as FilterOperator,
                  }))}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Selecione o operador..." />
                  </SelectTrigger>
                  <SelectContent>
                    {filterFieldConfig[newCondition.field].operators.map(op => (
                      <SelectItem key={op} value={op}>
                        {operatorLabels[op]}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}

            {/* Value input */}
            {newCondition.field && newCondition.operator && (
              <div className="space-y-2">
                <Label className="text-xs text-muted-foreground">Valor</Label>
                {renderValueInput(newCondition.field, newCondition.operator)}
              </div>
            )}

            {/* Add button */}
            <Button
              variant="secondary"
              size="sm"
              className="w-full gap-2"
              onClick={handleAddCondition}
              disabled={!newCondition.field || !newCondition.operator}
            >
              <Plus className="h-4 w-4" />
              Adicionar Condição
            </Button>
          </div>
        </div>

        <SheetFooter>
          <Button variant="outline" onClick={() => setIsOpen(false)}>
            Fechar
          </Button>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  );
}
