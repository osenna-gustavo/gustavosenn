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
  const { user } = useAuth();
  const [isMigrating, setIsMigrating] = useState(false);
  const [migrationStatus, setMigrationStatus] = useState('');

  useEffect(() => {
    const checkAndMigrate = async () => {
      // Check if already migrated
      const alreadyMigrated = localStorage.getItem('fluxocaixa_migrated') === 'true';
      
      if (alreadyMigrated || !user) {
        return;
      }

      // Check if there's local data to migrate
      try {
        const localCategories = await localDb.getCategories();
        
        if (localCategories.length === 0) {
          // No local data, mark as migrated
          localStorage.setItem('fluxocaixa_migrated', 'true');
          return;
        }

        // Auto-migrate local data
        setIsMigrating(true);
        setMigrationStatus('Migrando dados locais para a nuvem...');

        // Import migration logic
        const localSubcategories = await localDb.getSubcategories();
        const localTransactions = await localDb.getAllTransactions();
        const localBudgets = await localDb.getAllBudgets();
        const localRecurrences = await localDb.getRecurrences();
        const localScenarios = await localDb.getScenarios();

        // Import supabase database functions
        const supabaseDb = await import('@/lib/supabase-database');

        const categoryIdMap: Record<string, string> = {};
        const subcategoryIdMap: Record<string, string> = {};

        // Migrate categories
        for (const cat of localCategories) {
          try {
            const newCat = await supabaseDb.addCategory({
              name: cat.name,
              type: cat.type,
              icon: cat.icon,
              isFixed: cat.isFixed,
              parentId: cat.parentId,
            });
            categoryIdMap[cat.id] = newCat.id;
          } catch (error) {
            console.warn('Error migrating category:', cat.name, error);
          }
        }

        // Migrate subcategories
        for (const sub of localSubcategories) {
          const newCategoryId = categoryIdMap[sub.categoryId];
          if (newCategoryId) {
            try {
              const newSub = await supabaseDb.addSubcategory({
                categoryId: newCategoryId,
                name: sub.name,
                isFixed: sub.isFixed,
              });
              subcategoryIdMap[sub.id] = newSub.id;
            } catch (error) {
              console.warn('Error migrating subcategory:', sub.name, error);
            }
          }
        }

        // Migrate transactions
        for (const trans of localTransactions) {
          const newCategoryId = categoryIdMap[trans.categoryId];
          const newSubcategoryId = trans.subcategoryId ? subcategoryIdMap[trans.subcategoryId] : undefined;
          
          if (newCategoryId) {
            try {
              await supabaseDb.addTransaction({
                date: new Date(trans.date),
                amount: trans.amount,
                type: trans.type,
                categoryId: newCategoryId,
                subcategoryId: newSubcategoryId,
                description: trans.description,
                origin: trans.origin,
                needsReview: trans.needsReview,
              });
            } catch (error) {
              console.warn('Error migrating transaction:', trans.description, error);
            }
          }
        }

        // Migrate budgets
        for (const budget of localBudgets) {
          const categoryBudgets = budget.categoryBudgets.map(cb => ({
            categoryId: categoryIdMap[cb.categoryId] || cb.categoryId,
            subcategoryId: cb.subcategoryId ? subcategoryIdMap[cb.subcategoryId] : undefined,
            plannedAmount: cb.plannedAmount,
          })).filter(cb => cb.categoryId);
          
          try {
            await supabaseDb.saveBudget({
              month: budget.month,
              year: budget.year,
              plannedIncome: budget.plannedIncome,
              plannedExpenses: budget.plannedExpenses,
              categoryBudgets,
            });
          } catch (error) {
            console.warn('Error migrating budget:', budget.month, budget.year, error);
          }
        }

        // Migrate recurrences
        for (const rec of localRecurrences) {
          const newCategoryId = categoryIdMap[rec.categoryId];
          const newSubcategoryId = rec.subcategoryId ? subcategoryIdMap[rec.subcategoryId] : undefined;
          
          if (newCategoryId) {
            try {
              await supabaseDb.addRecurrence({
                name: rec.name,
                type: rec.type,
                amount: rec.amount,
                categoryId: newCategoryId,
                subcategoryId: newSubcategoryId,
                frequency: rec.frequency,
                startDate: new Date(rec.startDate),
                endDate: rec.endDate ? new Date(rec.endDate) : undefined,
                isActive: rec.isActive,
              });
            } catch (error) {
              console.warn('Error migrating recurrence:', rec.name, error);
            }
          }
        }

        // Migrate scenarios
        for (const scenario of localScenarios) {
          try {
            await supabaseDb.addScenario({
              name: scenario.name,
              baselineType: scenario.baselineType,
              baselineMonth: scenario.baselineMonth,
              baselineYear: scenario.baselineYear,
              monthlyCommitments: scenario.monthlyCommitments.map(c => ({
                ...c,
                categoryId: categoryIdMap[c.categoryId] || c.categoryId,
                subcategoryId: c.subcategoryId ? subcategoryIdMap[c.subcategoryId] : undefined,
              })),
              oneTimeCosts: scenario.oneTimeCosts.map(c => ({
                ...c,
                categoryId: categoryIdMap[c.categoryId] || c.categoryId,
                subcategoryId: c.subcategoryId ? subcategoryIdMap[c.subcategoryId] : undefined,
              })),
              categoryAdjustments: scenario.categoryAdjustments.map(a => ({
                ...a,
                categoryId: categoryIdMap[a.categoryId] || a.categoryId,
                subcategoryId: a.subcategoryId ? subcategoryIdMap[a.subcategoryId] : undefined,
              })),
              minimumBalance: scenario.minimumBalance,
            });
          } catch (error) {
            console.warn('Error migrating scenario:', scenario.name, error);
          }
        }

        // Mark migration as complete
        localStorage.setItem('fluxocaixa_migrated', 'true');
        setIsMigrating(false);
        
      } catch (error) {
        console.error('Migration error:', error);
        // Mark as migrated to avoid retrying on error
        localStorage.setItem('fluxocaixa_migrated', 'true');
        setIsMigrating(false);
      }
    };

    checkAndMigrate();
  }, [user]);

  if (isMigrating) {
    return (
      <div className="min-h-screen bg-background flex flex-col items-center justify-center gap-4">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
        <p className="text-sm text-muted-foreground">{migrationStatus}</p>
      </div>
    );
  }

  return (
    <AppProvider>
      <AppContent />
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
