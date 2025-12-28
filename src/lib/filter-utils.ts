import type { Transaction, Category, Subcategory } from '@/types/finance';
import type { FilterState, FilterCondition } from '@/types/filters';

// Apply filters to transactions array
export function applyTransactionFilters(
  transactions: Transaction[],
  filters: FilterState,
  categories: Category[],
  subcategories: Subcategory[]
): Transaction[] {
  let result = [...transactions];

  // Apply type filter
  if (filters.type) {
    result = result.filter(t => t.type === filters.type);
  }

  // Apply fixed filter
  if (filters.isFixed !== null && filters.isFixed !== undefined) {
    result = result.filter(t => {
      const category = categories.find(c => c.id === t.categoryId);
      const subcategory = t.subcategoryId 
        ? subcategories.find(s => s.id === t.subcategoryId)
        : null;
      
      // Check subcategory first, then category
      const isFixed = subcategory?.isFixed ?? category?.isFixed ?? false;
      return isFixed === filters.isFixed;
    });
  }

  // Apply category filter
  if (filters.categoryIds && filters.categoryIds.length > 0) {
    result = result.filter(t => filters.categoryIds!.includes(t.categoryId));
  }

  // Apply subcategory filter
  if (filters.subcategoryIds && filters.subcategoryIds.length > 0) {
    result = result.filter(t => 
      t.subcategoryId && filters.subcategoryIds!.includes(t.subcategoryId)
    );
  }

  // Apply advanced conditions
  for (const condition of filters.conditions) {
    result = applyCondition(result, condition, categories, subcategories);
  }

  return result;
}

function applyCondition(
  transactions: Transaction[],
  condition: FilterCondition,
  categories: Category[],
  subcategories: Subcategory[]
): Transaction[] {
  const { field, operator, value, value2 } = condition;

  return transactions.filter(t => {
    switch (field) {
      case 'type':
        return applyOperator(t.type, operator, value);
      
      case 'category_id':
        return applyOperator(t.categoryId, operator, value);
      
      case 'subcategory_id':
        return applyOperator(t.subcategoryId || '', operator, value);
      
      case 'is_fixed': {
        const category = categories.find(c => c.id === t.categoryId);
        const subcategory = t.subcategoryId 
          ? subcategories.find(s => s.id === t.subcategoryId)
          : null;
        const isFixed = subcategory?.isFixed ?? category?.isFixed ?? false;
        
        if (operator === 'is_true') return isFixed === true;
        if (operator === 'is_false') return isFixed === false;
        return true;
      }
      
      case 'amount':
        return applyNumericOperator(t.amount, operator, Number(value), value2 ? Number(value2) : undefined);
      
      case 'date': {
        const transactionDate = new Date(t.date).getTime();
        const filterDate = new Date(String(value)).getTime();
        const filterDate2 = value2 ? new Date(String(value2)).getTime() : undefined;
        return applyNumericOperator(transactionDate, operator, filterDate, filterDate2);
      }
      
      case 'origin':
        return applyOperator(t.origin, operator, value);
      
      case 'description':
        if (operator === 'contains') {
          return (t.description || '').toLowerCase().includes(String(value).toLowerCase());
        }
        return true;
      
      case 'needs_review':
        if (operator === 'is_true') return t.needsReview === true;
        if (operator === 'is_false') return t.needsReview === false;
        return true;
      
      default:
        return true;
    }
  });
}

function applyOperator(
  fieldValue: string | number | boolean | undefined,
  operator: string,
  filterValue: string | number | boolean | string[] | number[]
): boolean {
  switch (operator) {
    case 'equals':
      return fieldValue === filterValue;
    case 'not_equals':
      return fieldValue !== filterValue;
    case 'in':
      if (Array.isArray(filterValue)) {
        return (filterValue as (string | number)[]).includes(fieldValue as string | number);
      }
      return false;
    case 'not_in':
      if (Array.isArray(filterValue)) {
        return !(filterValue as (string | number)[]).includes(fieldValue as string | number);
      }
      return true;
    case 'is_true':
      return fieldValue === true;
    case 'is_false':
      return fieldValue === false;
    default:
      return true;
  }
}

function applyNumericOperator(
  fieldValue: number,
  operator: string,
  filterValue: number,
  filterValue2?: number
): boolean {
  switch (operator) {
    case 'equals':
      return fieldValue === filterValue;
    case 'greater_than':
      return fieldValue > filterValue;
    case 'less_than':
      return fieldValue < filterValue;
    case 'between':
      return filterValue2 !== undefined && fieldValue >= filterValue && fieldValue <= filterValue2;
    default:
      return true;
  }
}

// Apply filters to categories array
export function applyCategoryFilters(
  cats: Category[],
  filters: FilterState,
  subcategories: Subcategory[],
  transactions: Transaction[],
  budgetCategories: Set<string>
): Category[] {
  let result = [...cats];

  // Apply type filter
  if (filters.type) {
    result = result.filter(c => c.type === filters.type);
  }

  // Apply fixed filter
  if (filters.isFixed !== null && filters.isFixed !== undefined) {
    result = result.filter(c => c.isFixed === filters.isFixed);
  }

  // Apply hasSubcategories filter
  if (filters.hasSubcategories !== null && filters.hasSubcategories !== undefined) {
    result = result.filter(c => {
      const hasSubs = subcategories.some(s => s.categoryId === c.id);
      return hasSubs === filters.hasSubcategories;
    });
  }

  // Apply usedInMonth filter
  if (filters.usedInMonth !== null && filters.usedInMonth !== undefined) {
    result = result.filter(c => {
      const hasTransactions = transactions.some(t => t.categoryId === c.id);
      const hasBudget = budgetCategories.has(c.id);
      const isUsed = hasTransactions || hasBudget;
      return isUsed === filters.usedInMonth;
    });
  }

  // Apply text search in conditions
  for (const condition of filters.conditions) {
    if (condition.field === 'description' && condition.operator === 'contains') {
      result = result.filter(c => 
        c.name.toLowerCase().includes(String(condition.value).toLowerCase())
      );
    }
  }

  return result;
}
