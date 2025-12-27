import { DashboardKPIs } from '@/components/dashboard/DashboardKPIs';
import { CategoryProgress } from '@/components/dashboard/CategoryProgress';
import { RecentTransactions } from '@/components/dashboard/RecentTransactions';
import { ExpenseChart } from '@/components/dashboard/ExpenseChart';
import { useApp } from '@/contexts/AppContext';
import { formatMonthYear } from '@/lib/formatters';

export function DashboardPage() {
  const { selectedMonth, selectedYear } = useApp();
  
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
      <DashboardKPIs />

      {/* Charts and Lists */}
      <div className="grid lg:grid-cols-2 gap-6">
        <ExpenseChart />
        <CategoryProgress />
      </div>

      {/* Recent Transactions */}
      <RecentTransactions />
    </div>
  );
}
