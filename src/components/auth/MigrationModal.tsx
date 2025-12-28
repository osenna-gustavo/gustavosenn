import { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { useToast } from '@/hooks/use-toast';
import { Upload, X, Database, Loader2 } from 'lucide-react';
import * as localDb from '@/lib/database';
import * as supabaseDb from '@/lib/supabase-database';

interface MigrationModalProps {
  isOpen: boolean;
  onClose: () => void;
  onMigrationComplete: () => void;
}

export function MigrationModal({ isOpen, onClose, onMigrationComplete }: MigrationModalProps) {
  const { toast } = useToast();
  const [isMigrating, setIsMigrating] = useState(false);
  const [progress, setProgress] = useState(0);
  const [status, setStatus] = useState('');

  const handleMigrate = async () => {
    setIsMigrating(true);
    setProgress(0);
    
    try {
      // 1. Get all local data
      setStatus('Lendo categorias locais...');
      setProgress(5);
      const localCategories = await localDb.getCategories();
      
      setStatus('Lendo subcategorias locais...');
      setProgress(10);
      const localSubcategories = await localDb.getSubcategories();
      
      setStatus('Lendo transações locais...');
      setProgress(15);
      const localTransactions = await localDb.getAllTransactions();
      
      setStatus('Lendo orçamentos locais...');
      setProgress(20);
      const localBudgets = await localDb.getAllBudgets();
      
      setStatus('Lendo recorrências locais...');
      setProgress(25);
      const localRecurrences = await localDb.getRecurrences();
      
      setStatus('Lendo cenários locais...');
      setProgress(30);
      const localScenarios = await localDb.getScenarios();

      // Maps from old ID to new ID
      const categoryIdMap: Record<string, string> = {};
      const subcategoryIdMap: Record<string, string> = {};

      // 2. Migrate categories
      setStatus('Migrando categorias...');
      setProgress(35);
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
      setProgress(45);

      // 3. Migrate subcategories
      setStatus('Migrando subcategorias...');
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
      setProgress(55);

      // 4. Migrate transactions
      setStatus('Migrando transações...');
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
      setProgress(70);

      // 5. Migrate budgets
      setStatus('Migrando orçamentos...');
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
      setProgress(80);

      // 6. Migrate recurrences
      setStatus('Migrando recorrências...');
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
      setProgress(90);

      // 7. Migrate scenarios
      setStatus('Migrando cenários...');
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
      setProgress(100);

      setStatus('Migração concluída!');
      
      // Mark migration as complete
      localStorage.setItem('fluxocaixa_migrated', 'true');
      
      toast({
        title: 'Migração concluída!',
        description: `${localCategories.length} categorias, ${localTransactions.length} transações e ${localBudgets.length} orçamentos migrados.`,
      });

      setTimeout(() => {
        onMigrationComplete();
      }, 1000);
      
    } catch (error) {
      console.error('Migration error:', error);
      toast({
        title: 'Erro na migração',
        description: 'Ocorreu um erro durante a migração. Tente novamente.',
        variant: 'destructive',
      });
      setIsMigrating(false);
    }
  };

  const handleIgnore = () => {
    localStorage.setItem('fluxocaixa_migrated', 'true');
    onClose();
  };

  return (
    <Dialog open={isOpen} onOpenChange={() => !isMigrating && onClose()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Database className="h-5 w-5 text-primary" />
            Dados Locais Encontrados
          </DialogTitle>
          <DialogDescription>
            Encontramos dados salvos localmente no seu navegador. Deseja importá-los para a nuvem?
          </DialogDescription>
        </DialogHeader>

        {isMigrating ? (
          <div className="space-y-4 py-4">
            <div className="flex items-center gap-3">
              <Loader2 className="h-5 w-5 animate-spin text-primary" />
              <span className="text-sm">{status}</span>
            </div>
            <Progress value={progress} className="h-2" />
            <p className="text-xs text-muted-foreground text-center">
              {progress}% concluído
            </p>
          </div>
        ) : (
          <div className="py-4 space-y-3">
            <p className="text-sm text-muted-foreground">
              Ao importar, seus dados serão transferidos para a nuvem e você poderá acessá-los de qualquer dispositivo.
            </p>
            <p className="text-sm text-muted-foreground">
              Se ignorar, os dados locais permanecerão apenas neste navegador e você começará com uma conta vazia na nuvem.
            </p>
          </div>
        )}

        <DialogFooter className="gap-2 sm:gap-0">
          {!isMigrating && (
            <>
              <Button variant="outline" onClick={handleIgnore} className="gap-2">
                <X className="h-4 w-4" />
                Ignorar
              </Button>
              <Button onClick={handleMigrate} className="gap-2">
                <Upload className="h-4 w-4" />
                Importar para Nuvem
              </Button>
            </>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
