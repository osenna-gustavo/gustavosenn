import React, { createContext, useContext, useState, useCallback, useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import type { FilterState, FilterCondition, FilterScreen, SavedFilter } from '@/types/filters';
import { defaultFilterState } from '@/types/filters';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';

interface FilterContextType {
  // Current filters per screen
  filters: Record<FilterScreen, FilterState>;
  
  // Actions
  setFilter: (screen: FilterScreen, filter: Partial<FilterState>) => void;
  resetFilters: (screen: FilterScreen) => void;
  addCondition: (screen: FilterScreen, condition: FilterCondition) => void;
  removeCondition: (screen: FilterScreen, conditionId: string) => void;
  updateCondition: (screen: FilterScreen, conditionId: string, updates: Partial<FilterCondition>) => void;
  
  // Quick filters
  setTypeFilter: (screen: FilterScreen, type: 'receita' | 'despesa' | null) => void;
  setFixedFilter: (screen: FilterScreen, isFixed: boolean | null) => void;
  setCategoryFilter: (screen: FilterScreen, categoryIds: string[]) => void;
  setSubcategoryFilter: (screen: FilterScreen, subcategoryIds: string[]) => void;
  
  // Saved filters
  savedFilters: SavedFilter[];
  saveFilter: (screen: FilterScreen, name: string) => Promise<void>;
  loadFilter: (filterId: string) => void;
  deleteFilter: (filterId: string) => Promise<void>;
  
  // Check if has active filters
  hasActiveFilters: (screen: FilterScreen) => boolean;
  
  // Get active filter count
  getActiveFilterCount: (screen: FilterScreen) => number;
}

const FilterContext = createContext<FilterContextType | undefined>(undefined);

export function FilterProvider({ children }: { children: React.ReactNode }) {
  const { user } = useAuth();
  const [searchParams, setSearchParams] = useSearchParams();
  
  const [filters, setFilters] = useState<Record<FilterScreen, FilterState>>({
    dashboard: { ...defaultFilterState },
    transactions: { ...defaultFilterState },
    budget: { ...defaultFilterState },
    categories: { ...defaultFilterState },
  });
  
  const [savedFilters, setSavedFilters] = useState<SavedFilter[]>([]);

  // Load saved filters from Supabase
  useEffect(() => {
    if (user) {
      loadSavedFilters();
    }
  }, [user]);

  // Sync filters with URL params
  useEffect(() => {
    const urlType = searchParams.get('type') as 'receita' | 'despesa' | null;
    const urlFixed = searchParams.get('fixed');
    const urlCategories = searchParams.get('categories');
    
    // Determine current screen from pathname
    const pathname = window.location.pathname;
    let screen: FilterScreen = 'dashboard';
    if (pathname.includes('/transactions') || pathname.includes('/lancamentos')) {
      screen = 'transactions';
    } else if (pathname.includes('/budget') || pathname.includes('/orcamento')) {
      screen = 'budget';
    } else if (pathname.includes('/categories') || pathname.includes('/categorias')) {
      screen = 'categories';
    }
    
    // Apply URL params to current screen
    if (urlType || urlFixed || urlCategories) {
      setFilters(prev => ({
        ...prev,
        [screen]: {
          ...prev[screen],
          type: urlType || prev[screen].type,
          isFixed: urlFixed === 'true' ? true : urlFixed === 'false' ? false : prev[screen].isFixed,
          categoryIds: urlCategories ? urlCategories.split(',') : prev[screen].categoryIds,
        },
      }));
    }
  }, [searchParams]);

  const loadSavedFilters = async () => {
    try {
      const { data, error } = await supabase
        .from('saved_filters')
        .select('*')
        .order('name');
        
      if (error) throw error;
      
      setSavedFilters((data || []).map(f => ({
        id: f.id,
        userId: f.user_id,
        name: f.name,
        screen: f.screen as FilterScreen,
        filters: f.filters as unknown as FilterState,
        createdAt: new Date(f.created_at!),
        updatedAt: new Date(f.updated_at!),
      })));
    } catch (error) {
      console.error('Error loading saved filters:', error);
    }
  };

  const updateURLParams = useCallback((screen: FilterScreen, newFilters: FilterState) => {
    const params = new URLSearchParams(searchParams);
    
    if (newFilters.type) {
      params.set('type', newFilters.type);
    } else {
      params.delete('type');
    }
    
    if (newFilters.isFixed !== null && newFilters.isFixed !== undefined) {
      params.set('fixed', String(newFilters.isFixed));
    } else {
      params.delete('fixed');
    }
    
    if (newFilters.categoryIds && newFilters.categoryIds.length > 0) {
      params.set('categories', newFilters.categoryIds.join(','));
    } else {
      params.delete('categories');
    }
    
    setSearchParams(params, { replace: true });
  }, [searchParams, setSearchParams]);

  const setFilter = useCallback((screen: FilterScreen, filter: Partial<FilterState>) => {
    setFilters(prev => {
      const newFilters = {
        ...prev,
        [screen]: { ...prev[screen], ...filter },
      };
      updateURLParams(screen, newFilters[screen]);
      return newFilters;
    });
  }, [updateURLParams]);

  const resetFilters = useCallback((screen: FilterScreen) => {
    setFilters(prev => {
      const newFilters = {
        ...prev,
        [screen]: { ...defaultFilterState },
      };
      updateURLParams(screen, newFilters[screen]);
      return newFilters;
    });
  }, [updateURLParams]);

  const addCondition = useCallback((screen: FilterScreen, condition: FilterCondition) => {
    setFilters(prev => ({
      ...prev,
      [screen]: {
        ...prev[screen],
        conditions: [...prev[screen].conditions, condition],
      },
    }));
  }, []);

  const removeCondition = useCallback((screen: FilterScreen, conditionId: string) => {
    setFilters(prev => ({
      ...prev,
      [screen]: {
        ...prev[screen],
        conditions: prev[screen].conditions.filter(c => c.id !== conditionId),
      },
    }));
  }, []);

  const updateCondition = useCallback((screen: FilterScreen, conditionId: string, updates: Partial<FilterCondition>) => {
    setFilters(prev => ({
      ...prev,
      [screen]: {
        ...prev[screen],
        conditions: prev[screen].conditions.map(c => 
          c.id === conditionId ? { ...c, ...updates } : c
        ),
      },
    }));
  }, []);

  const setTypeFilter = useCallback((screen: FilterScreen, type: 'receita' | 'despesa' | null) => {
    setFilter(screen, { type });
  }, [setFilter]);

  const setFixedFilter = useCallback((screen: FilterScreen, isFixed: boolean | null) => {
    setFilter(screen, { isFixed });
  }, [setFilter]);

  const setCategoryFilter = useCallback((screen: FilterScreen, categoryIds: string[]) => {
    setFilter(screen, { categoryIds });
  }, [setFilter]);

  const setSubcategoryFilter = useCallback((screen: FilterScreen, subcategoryIds: string[]) => {
    setFilter(screen, { subcategoryIds });
  }, [setFilter]);

  const saveFilter = useCallback(async (screen: FilterScreen, name: string) => {
    if (!user) return;
    
    try {
      const { error } = await supabase
        .from('saved_filters')
        .insert([{
          user_id: user.id,
          name,
          screen,
          filters: JSON.parse(JSON.stringify(filters[screen])),
        }]);
        
      if (error) throw error;
      
      await loadSavedFilters();
    } catch (error) {
      console.error('Error saving filter:', error);
      throw error;
    }
  }, [user, filters]);

  const loadFilter = useCallback((filterId: string) => {
    const saved = savedFilters.find(f => f.id === filterId);
    if (saved) {
      setFilter(saved.screen, saved.filters);
    }
  }, [savedFilters, setFilter]);

  const deleteFilter = useCallback(async (filterId: string) => {
    try {
      const { error } = await supabase
        .from('saved_filters')
        .delete()
        .eq('id', filterId);
        
      if (error) throw error;
      
      setSavedFilters(prev => prev.filter(f => f.id !== filterId));
    } catch (error) {
      console.error('Error deleting filter:', error);
      throw error;
    }
  }, []);

  const hasActiveFilters = useCallback((screen: FilterScreen) => {
    const f = filters[screen];
    return !!(
      f.type ||
      f.isFixed !== null ||
      (f.categoryIds && f.categoryIds.length > 0) ||
      (f.subcategoryIds && f.subcategoryIds.length > 0) ||
      f.conditions.length > 0 ||
      f.showPlannedOnly ||
      f.showWithRecurrence ||
      f.hasSubcategories !== null ||
      f.usedInMonth !== null
    );
  }, [filters]);

  const getActiveFilterCount = useCallback((screen: FilterScreen) => {
    const f = filters[screen];
    let count = 0;
    if (f.type) count++;
    if (f.isFixed !== null) count++;
    if (f.categoryIds && f.categoryIds.length > 0) count++;
    if (f.subcategoryIds && f.subcategoryIds.length > 0) count++;
    count += f.conditions.length;
    if (f.showPlannedOnly) count++;
    if (f.showWithRecurrence) count++;
    if (f.hasSubcategories !== null) count++;
    if (f.usedInMonth !== null) count++;
    return count;
  }, [filters]);

  return (
    <FilterContext.Provider value={{
      filters,
      setFilter,
      resetFilters,
      addCondition,
      removeCondition,
      updateCondition,
      setTypeFilter,
      setFixedFilter,
      setCategoryFilter,
      setSubcategoryFilter,
      savedFilters,
      saveFilter,
      loadFilter,
      deleteFilter,
      hasActiveFilters,
      getActiveFilterCount,
    }}>
      {children}
    </FilterContext.Provider>
  );
}

export function useFilters() {
  const context = useContext(FilterContext);
  if (!context) {
    throw new Error('useFilters must be used within FilterProvider');
  }
  return context;
}
