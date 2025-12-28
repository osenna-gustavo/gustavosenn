// Filter system types

export type FilterOperator = 
  | 'equals'
  | 'not_equals'
  | 'contains'
  | 'greater_than'
  | 'less_than'
  | 'between'
  | 'in'
  | 'not_in'
  | 'is_true'
  | 'is_false';

export type FilterField = 
  | 'type'           // receita / despesa
  | 'category_id'    
  | 'subcategory_id'
  | 'is_fixed'       // fixo / variável
  | 'amount'         // valor
  | 'date'           // data
  | 'origin'         // manual / import / recurrence
  | 'status'         // recurrence status: pending / confirmed / ignored
  | 'description'    // texto
  | 'needs_review'   // precisa revisar
  | 'has_subcategories' // for categories screen
  | 'used_in_month'; // for categories screen

export interface FilterCondition {
  id: string;
  field: FilterField;
  operator: FilterOperator;
  value: string | number | boolean | string[] | number[];
  value2?: string | number; // for 'between' operator
}

export interface FilterState {
  // Quick filters (single values)
  type?: 'receita' | 'despesa' | null;
  isFixed?: boolean | null;
  
  // Multi-select filters
  categoryIds?: string[];
  subcategoryIds?: string[];
  
  // Advanced filter conditions
  conditions: FilterCondition[];
  
  // Screen-specific filters
  showPlannedOnly?: boolean;
  showWithRecurrence?: boolean;
  hasSubcategories?: boolean | null;
  usedInMonth?: boolean | null;
}

export interface SavedFilter {
  id: string;
  userId: string;
  name: string;
  screen: 'dashboard' | 'transactions' | 'budget' | 'categories';
  filters: FilterState;
  createdAt: Date;
  updatedAt: Date;
}

export type FilterScreen = 'dashboard' | 'transactions' | 'budget' | 'categories';

// Default empty filter state
export const defaultFilterState: FilterState = {
  type: null,
  isFixed: null,
  categoryIds: [],
  subcategoryIds: [],
  conditions: [],
  showPlannedOnly: false,
  showWithRecurrence: false,
  hasSubcategories: null,
  usedInMonth: null,
};

// Filter field metadata for UI
export const filterFieldConfig: Record<FilterField, { 
  label: string; 
  operators: FilterOperator[];
  valueType: 'select' | 'multiselect' | 'number' | 'date' | 'text' | 'boolean';
}> = {
  type: {
    label: 'Tipo',
    operators: ['equals', 'not_equals'],
    valueType: 'select',
  },
  category_id: {
    label: 'Categoria',
    operators: ['equals', 'not_equals', 'in', 'not_in'],
    valueType: 'multiselect',
  },
  subcategory_id: {
    label: 'Subcategoria',
    operators: ['equals', 'not_equals', 'in', 'not_in'],
    valueType: 'multiselect',
  },
  is_fixed: {
    label: 'Tipo de Gasto',
    operators: ['is_true', 'is_false'],
    valueType: 'boolean',
  },
  amount: {
    label: 'Valor',
    operators: ['equals', 'greater_than', 'less_than', 'between'],
    valueType: 'number',
  },
  date: {
    label: 'Data',
    operators: ['equals', 'greater_than', 'less_than', 'between'],
    valueType: 'date',
  },
  origin: {
    label: 'Origem',
    operators: ['equals', 'not_equals', 'in'],
    valueType: 'select',
  },
  status: {
    label: 'Status',
    operators: ['equals', 'not_equals'],
    valueType: 'select',
  },
  description: {
    label: 'Descrição',
    operators: ['contains'],
    valueType: 'text',
  },
  needs_review: {
    label: 'Precisa Revisar',
    operators: ['is_true', 'is_false'],
    valueType: 'boolean',
  },
  has_subcategories: {
    label: 'Tem Subcategorias',
    operators: ['is_true', 'is_false'],
    valueType: 'boolean',
  },
  used_in_month: {
    label: 'Usada no Mês',
    operators: ['is_true', 'is_false'],
    valueType: 'boolean',
  },
};

export const operatorLabels: Record<FilterOperator, string> = {
  equals: 'é igual a',
  not_equals: 'não é igual a',
  contains: 'contém',
  greater_than: 'maior que',
  less_than: 'menor que',
  between: 'entre',
  in: 'está em',
  not_in: 'não está em',
  is_true: 'sim',
  is_false: 'não',
};
