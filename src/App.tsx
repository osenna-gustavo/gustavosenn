import { useState, useEffect } from 'react';
import { ThemeProvider } from '@/contexts/ThemeContext';
import { AuthProvider, useAuth } from '@/contexts/AuthContext';
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
import { AuthPage } from '@/pages/AuthPage';
import { MigrationModal } from '@/components/auth/MigrationModal';
import { Toaster } from '@/components/ui/toaster';
import { Loader2 } from 'lucide-react';
import * as localDb from '@/lib/database';

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

function AuthenticatedApp() {
  const { user, hasMigratedData, setHasMigratedData } = useAuth();
  const [showMigrationModal, setShowMigrationModal] = useState(false);
  const [checkingMigration, setCheckingMigration] = useState(true);

  useEffect(() => {
    const checkLocalData = async () => {
      // Check if already migrated
      const alreadyMigrated = localStorage.getItem('fluxocaixa_migrated') === 'true';
      
      if (!alreadyMigrated && user) {
        // Check if there's local data to migrate
        try {
          const localCategories = await localDb.getCategories();
          if (localCategories.length > 0) {
            setShowMigrationModal(true);
          } else {
            localStorage.setItem('fluxocaixa_migrated', 'true');
          }
        } catch (error) {
          console.error('Error checking local data:', error);
          localStorage.setItem('fluxocaixa_migrated', 'true');
        }
      }
      setCheckingMigration(false);
    };

    checkLocalData();
  }, [user]);

  const handleMigrationComplete = () => {
    setShowMigrationModal(false);
    setHasMigratedData(true);
    window.location.reload(); // Reload to refresh data from cloud
  };

  if (checkingMigration) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <AppProvider>
      <AppContent />
      <MigrationModal
        isOpen={showMigrationModal}
        onClose={() => {
          localStorage.setItem('fluxocaixa_migrated', 'true');
          setShowMigrationModal(false);
        }}
        onMigrationComplete={handleMigrationComplete}
      />
    </AppProvider>
  );
}

function AppRouter() {
  const { user, isLoading } = useAuth();

  if (isLoading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!user) {
    return <AuthPage />;
  }

  return <AuthenticatedApp />;
}

function App() {
  return (
    <ThemeProvider>
      <AuthProvider>
        <AppRouter />
        <Toaster />
      </AuthProvider>
    </ThemeProvider>
  );
}

export default App;
