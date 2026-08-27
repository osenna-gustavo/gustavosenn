import { useState } from 'react';
import { DashboardKPIs } from '@/components/dashboard/DashboardKPIs';
import { CategoryProgress } from '@/components/dashboard/CategoryProgress';
import { RecentTransactions } from '@/components/dashboard/RecentTransactions';
import { DrillDownDrawer, type DrillDownFilter } from '@/components/dashboard/DrillDownDrawer';
import { PlannedVsRealizedDrawer } from '@/components/dashboard/PlannedVsRealizedDrawer';
import { FixedPendingDrawer } from '@/components/dashboard/FixedPendingDrawer';
import { useApp } from '@/contexts/AppContext';
import { formatDateShort, formatMonthYear } from '@/lib/formatters';

export function DashboardPage() {
  const { selectedMonth, selectedYear, billingDateRange } = useApp();
  
  const [drillDownFilter, setDrillDownFilter] = useState<DrillDownFilter | null>(null);
  const [isDrawerOpen, setIsDrawerOpen] = useState(false);
  const [isPlannedVsRealizedOpen, setIsPlannedVsRealizedOpen] = useState(false);
  const [isFixedPendingOpen, setIsFixedPendingOpen] = useState(false);

  const handleDrillDown = (filter: DrillDownFilter) => {
    // Handle special drawer types
    if (filter.type === 'planned-vs-realized') {
      setIsPlannedVsRealizedOpen(true);
      return;
    }
    if (filter.type === 'fixed-pending') {
      setIsFixedPendingOpen(true);
      return;
    }
    
    // Default drill-down drawer
    setDrillDownFilter(filter);
    setIsDrawerOpen(true);
  };

  const handleCloseDrawer = () => {
    setIsDrawerOpen(false);
  };
  
  return (
    <div className="space-y-6 animate-fade-in">
      {/* Header */}
      <div>
        <h1 className="text-2xl lg:text-3xl font-bold">Visão geral</h1>
        <p className="text-muted-foreground">
          Ciclo financeiro de {formatMonthYear(selectedMonth, selectedYear)}
          {billingDateRange && ` · ${formatDateShort(billingDateRange.start)} a ${formatDateShort(billingDateRange.end)}`}
        </p>
      </div>

      {/* KPIs */}
      <DashboardKPIs onDrillDown={handleDrillDown} />

      <CategoryProgress onDrillDown={handleDrillDown} />

      {/* Recent Transactions */}
      <RecentTransactions />

      {/* Standard Drill-Down Drawer */}
      <DrillDownDrawer 
        isOpen={isDrawerOpen}
        onClose={handleCloseDrawer}
        filter={drillDownFilter}
      />

      {/* Specialized Drawers */}
      <PlannedVsRealizedDrawer
        isOpen={isPlannedVsRealizedOpen}
        onClose={() => setIsPlannedVsRealizedOpen(false)}
      />
      
      <FixedPendingDrawer
        isOpen={isFixedPendingOpen}
        onClose={() => setIsFixedPendingOpen(false)}
      />
    </div>
  );
}
