import { useState } from 'react';
import { DashboardKPIs } from '@/components/dashboard/DashboardKPIs';
import { CategoryProgress } from '@/components/dashboard/CategoryProgress';
import { RecentTransactions } from '@/components/dashboard/RecentTransactions';
import { ExpenseChart } from '@/components/dashboard/ExpenseChart';
import { DrillDownDrawer, type DrillDownFilter } from '@/components/dashboard/DrillDownDrawer';
import { PlannedVsRealizedDrawer } from '@/components/dashboard/PlannedVsRealizedDrawer';
import { FixedPendingDrawer } from '@/components/dashboard/FixedPendingDrawer';
import { useApp } from '@/contexts/AppContext';
import { formatMonthYear } from '@/lib/formatters';

export function DashboardPage() {
  const { selectedMonth, selectedYear } = useApp();
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
        <h1 className="text-2xl lg:text-3xl font-bold">Dashboard</h1>
        <p className="text-muted-foreground">
          Resumo financeiro de {formatMonthYear(selectedMonth, selectedYear)}
        </p>
      </div>

      {/* KPIs */}
      <DashboardKPIs onDrillDown={handleDrillDown} />

      {/* Charts and Lists */}
      <div className="grid lg:grid-cols-2 gap-6">
        <ExpenseChart onDrillDown={handleDrillDown} />
        <CategoryProgress onDrillDown={handleDrillDown} />
      </div>

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