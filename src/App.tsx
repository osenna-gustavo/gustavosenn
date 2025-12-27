import { AppProvider, useApp } from '@/contexts/AppContext';
import { MainLayout } from '@/components/layout/MainLayout';
import { FAB } from '@/components/transactions/FAB';
import { DashboardPage } from '@/pages/DashboardPage';
import { TransactionsPage } from '@/pages/TransactionsPage';
import { BudgetPage } from '@/pages/BudgetPage';
import { CategoriesPage } from '@/pages/CategoriesPage';
import { RecurrencesPage } from '@/pages/RecurrencesPage';
import { ImportPage } from '@/pages/ImportPage';
import { ReportsPage } from '@/pages/ReportsPage';
import { ScenariosPage } from '@/pages/ScenariosPage';
import { Toaster } from '@/components/ui/toaster';

function AppContent() {
  const { currentScreen } = useApp();

  const renderScreen = () => {
    switch (currentScreen) {
      case 'dashboard': return <DashboardPage />;
      case 'transactions': return <TransactionsPage />;
      case 'budget': return <BudgetPage />;
      case 'categories': return <CategoriesPage />;
      case 'recurrences': return <RecurrencesPage />;
      case 'import': return <ImportPage />;
      case 'reports': return <ReportsPage />;
      case 'scenarios': return <ScenariosPage />;
      default: return <DashboardPage />;
    }
  };

  return (
    <MainLayout>
      {renderScreen()}
      <FAB />
    </MainLayout>
  );
}

function App() {
  return (
    <div className="dark">
      <AppProvider>
        <AppContent />
        <Toaster />
      </AppProvider>
    </div>
  );
}

export default App;
