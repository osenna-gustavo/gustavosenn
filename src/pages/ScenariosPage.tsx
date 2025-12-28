import { useState, useEffect, useMemo } from 'react';
import { Lightbulb, Plus, ArrowLeft, Save, CheckCircle2, Calculator } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { toast } from 'sonner';
import { useApp } from '@/contexts/AppContext';
import { Scenario, ScenarioCommitment, ScenarioOneTimeCost, ScenarioCategoryAdjustment } from '@/types/finance';
import * as db from '@/lib/supabase-database';
import { ScenarioCard } from '@/components/scenarios/ScenarioCard';
import { ScenarioFormModal } from '@/components/scenarios/ScenarioFormModal';
import { ScenarioCommitmentForm } from '@/components/scenarios/ScenarioCommitmentForm';
import { ScenarioOneTimeCostForm } from '@/components/scenarios/ScenarioOneTimeCostForm';
import { ScenarioCategoryAdjustments } from '@/components/scenarios/ScenarioCategoryAdjustments';
import { ScenarioSimulator } from '@/components/scenarios/ScenarioSimulator';
import { PaymentCapacityCalculator } from '@/components/scenarios/PaymentCapacityCalculator';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";

export function ScenariosPage() {
  const { 
    categories, 
    subcategories, 
    selectedMonth, 
    selectedYear, 
    monthSummary,
    budget,
    saveBudget,
    refreshData
  } = useApp();

  const [scenarios, setScenarios] = useState<Scenario[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [activeScenario, setActiveScenario] = useState<Scenario | null>(null);
  const [showFormModal, setShowFormModal] = useState(false);
  const [editingScenario, setEditingScenario] = useState<Scenario | null>(null);
  const [showCalculator, setShowCalculator] = useState(false);
  const [deleteId, setDeleteId] = useState<string | null>(null);

  // Local state for editing
  const [commitments, setCommitments] = useState<ScenarioCommitment[]>([]);
  const [oneTimeCosts, setOneTimeCosts] = useState<ScenarioOneTimeCost[]>([]);
  const [categoryAdjustments, setCategoryAdjustments] = useState<ScenarioCategoryAdjustment[]>([]);

  useEffect(() => {
    const loadScenarios = async () => {
      try {
        const loaded = await db.getScenarios();
        setScenarios(loaded);
      } catch (error) {
        console.error('Error loading scenarios:', error);
      } finally {
        setIsLoading(false);
      }
    };
    loadScenarios();
  }, []);

  // Calculate baseline data based on scenario settings
  const baselineData = useMemo(() => {
    if (!activeScenario) {
      return {
        income: monthSummary?.realizedIncome || 0,
        expenses: monthSummary?.realizedExpenses || 0,
        categoryBreakdown: []
      };
    }

    const { baselineType } = activeScenario;

    if (baselineType === 'planned') {
      return {
        income: budget?.plannedIncome || 0,
        expenses: budget?.plannedExpenses || 0,
        categoryBreakdown: (budget?.categoryBudgets || []).map(cb => ({
          categoryId: cb.categoryId,
          amount: cb.plannedAmount,
          isFixed: categories.find(c => c.id === cb.categoryId)?.isFixed || false
        }))
      };
    }

    return {
      income: monthSummary?.realizedIncome || 0,
      expenses: monthSummary?.realizedExpenses || 0,
      categoryBreakdown: (monthSummary?.categoryBreakdown || []).map(cb => ({
        categoryId: cb.categoryId,
        amount: cb.realized,
        isFixed: cb.isFixed
      }))
    };
  }, [activeScenario, budget, monthSummary, categories]);

  const handleCreateScenario = async (data: Omit<Scenario, 'id' | 'createdAt'>) => {
    try {
      const newScenario = await db.addScenario(data);
      setScenarios(prev => [...prev, newScenario]);
      setShowFormModal(false);
      handleOpenScenario(newScenario);
      toast.success('Cenário criado!');
    } catch (error) {
      toast.error('Erro ao criar cenário');
    }
  };

  const handleDeleteScenario = async () => {
    if (!deleteId) return;
    try {
      await db.deleteScenario(deleteId);
      setScenarios(prev => prev.filter(s => s.id !== deleteId));
      if (activeScenario?.id === deleteId) {
        setActiveScenario(null);
      }
      toast.success('Cenário excluído!');
    } catch (error) {
      toast.error('Erro ao excluir cenário');
    } finally {
      setDeleteId(null);
    }
  };

  const handleDuplicateScenario = async (scenario: Scenario) => {
    try {
      const { id, createdAt, ...rest } = scenario;
      const newScenario = await db.addScenario({
        ...rest,
        name: `${scenario.name} (cópia)`
      });
      setScenarios(prev => [...prev, newScenario]);
      toast.success('Cenário duplicado!');
    } catch (error) {
      toast.error('Erro ao duplicar cenário');
    }
  };

  const handleOpenScenario = (scenario: Scenario) => {
    setActiveScenario(scenario);
    setCommitments(scenario.monthlyCommitments || []);
    setOneTimeCosts(scenario.oneTimeCosts || []);
    setCategoryAdjustments(scenario.categoryAdjustments || []);
  };

  const handleSaveScenarioData = async () => {
    if (!activeScenario) return;

    try {
      const updated: Scenario = {
        ...activeScenario,
        monthlyCommitments: commitments,
        oneTimeCosts: oneTimeCosts,
        categoryAdjustments: categoryAdjustments
      };
      await db.updateScenario(updated);
      setScenarios(prev => prev.map(s => s.id === updated.id ? updated : s));
      setActiveScenario(updated);
      toast.success('Cenário salvo!');
    } catch (error) {
      toast.error('Erro ao salvar cenário');
    }
  };

  const handleApplyToBudget = async () => {
    if (!activeScenario || !budget) {
      toast.error('Configure o baseline primeiro');
      return;
    }

    try {
      const newCategoryBudgets = [...(budget.categoryBudgets || [])];

      for (const adj of categoryAdjustments) {
        const existing = newCategoryBudgets.findIndex(cb => cb.categoryId === adj.categoryId);
        if (existing >= 0) {
          newCategoryBudgets[existing] = {
            ...newCategoryBudgets[existing],
            plannedAmount: adj.adjustedAmount
          };
        } else {
          newCategoryBudgets.push({
            categoryId: adj.categoryId,
            plannedAmount: adj.adjustedAmount
          });
        }
      }

      for (const commitment of commitments) {
        const existing = newCategoryBudgets.findIndex(cb => cb.categoryId === commitment.categoryId);
        if (existing >= 0) {
          newCategoryBudgets[existing] = {
            ...newCategoryBudgets[existing],
            plannedAmount: newCategoryBudgets[existing].plannedAmount + commitment.amount
          };
        } else {
          newCategoryBudgets.push({
            categoryId: commitment.categoryId,
            plannedAmount: commitment.amount
          });
        }
      }

      const newPlannedExpenses = newCategoryBudgets.reduce((sum, cb) => sum + cb.plannedAmount, 0);

      await saveBudget({
        month: activeScenario.baselineMonth,
        year: activeScenario.baselineYear,
        plannedIncome: budget.plannedIncome,
        plannedExpenses: newPlannedExpenses,
        categoryBudgets: newCategoryBudgets
      });

      await refreshData();
      toast.success('Cenário aplicado ao orçamento!');
    } catch (error) {
      toast.error('Erro ao aplicar cenário');
    }
  };

  // Build scenarioData for simulator
  const scenarioDataForSimulator = activeScenario ? {
    name: activeScenario.name,
    baselineType: activeScenario.baselineType,
    referenceMonth: activeScenario.baselineMonth,
    referenceYear: activeScenario.baselineYear,
    minimumBalance: activeScenario.minimumBalance,
    commitments,
    oneTimeCosts,
    categoryAdjustments
  } : null;

  if (activeScenario && scenarioDataForSimulator) {
    return (
      <div className="space-y-6 animate-fade-in">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Button
              variant="ghost"
              size="icon"
              onClick={() => setActiveScenario(null)}
            >
              <ArrowLeft className="h-5 w-5" />
            </Button>
            <div>
              <h1 className="text-2xl lg:text-3xl font-bold">{activeScenario.name}</h1>
              <p className="text-muted-foreground">Simulador de cenário</p>
            </div>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" onClick={handleSaveScenarioData} className="gap-2">
              <Save className="h-4 w-4" />
              Salvar
            </Button>
            <Button onClick={handleApplyToBudget} className="gap-2">
              <CheckCircle2 className="h-4 w-4" />
              Aplicar ao Orçamento
            </Button>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <div className="space-y-6">
            <Tabs defaultValue="commitments">
              <TabsList className="w-full">
                <TabsTrigger value="commitments" className="flex-1">Compromissos</TabsTrigger>
                <TabsTrigger value="costs" className="flex-1">Custos Pontuais</TabsTrigger>
                <TabsTrigger value="adjustments" className="flex-1">Ajustes</TabsTrigger>
              </TabsList>

              <TabsContent value="commitments" className="mt-4">
                <Card>
                  <CardHeader className="pb-3">
                    <CardTitle className="text-base">Compromissos Mensais</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <ScenarioCommitmentForm
                      commitments={commitments}
                      onChange={setCommitments}
                      categories={categories}
                      subcategories={subcategories}
                    />
                  </CardContent>
                </Card>
              </TabsContent>

              <TabsContent value="costs" className="mt-4">
                <Card>
                  <CardHeader className="pb-3">
                    <CardTitle className="text-base">Custos Pontuais</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <ScenarioOneTimeCostForm
                      costs={oneTimeCosts}
                      onChange={setOneTimeCosts}
                      categories={categories}
                      subcategories={subcategories}
                      referenceMonth={activeScenario.baselineMonth}
                      referenceYear={activeScenario.baselineYear}
                    />
                  </CardContent>
                </Card>
              </TabsContent>

              <TabsContent value="adjustments" className="mt-4">
                <Card>
                  <CardHeader className="pb-3">
                    <CardTitle className="text-base">Ajustes por Categoria</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <ScenarioCategoryAdjustments
                      adjustments={categoryAdjustments}
                      onChange={setCategoryAdjustments}
                      categories={categories}
                      baselineData={baselineData.categoryBreakdown}
                    />
                  </CardContent>
                </Card>
              </TabsContent>
            </Tabs>
          </div>

          <div>
            <ScenarioSimulator
              scenarioData={scenarioDataForSimulator}
              baselineData={baselineData}
              categories={categories}
            />
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl lg:text-3xl font-bold">Cenários</h1>
          <p className="text-muted-foreground">Simule decisões financeiras</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={() => setShowCalculator(true)} className="gap-2">
            <Calculator className="h-4 w-4" />
            Calculadora
          </Button>
          <Button onClick={() => setShowFormModal(true)} className="gap-2">
            <Plus className="h-4 w-4" />
            Novo Cenário
          </Button>
        </div>
      </div>

      {isLoading ? (
        <div className="flex items-center justify-center py-12">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
        </div>
      ) : scenarios.length === 0 ? (
        <Card className="p-8 text-center">
          <div className="h-16 w-16 rounded-full bg-primary/10 flex items-center justify-center mx-auto mb-4">
            <Lightbulb className="h-8 w-8 text-primary" />
          </div>
          <h3 className="text-lg font-semibold mb-2">Simulador de Cenários</h3>
          <p className="text-muted-foreground max-w-md mx-auto mb-4">
            Crie cenários para simular decisões como trocar de carro, mudar de moradia, 
            ou avaliar quanto pode gastar por mês em um novo compromisso.
          </p>
          <Button onClick={() => setShowFormModal(true)} className="gap-2">
            <Plus className="h-4 w-4" />
            Criar Primeiro Cenário
          </Button>
        </Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {scenarios.map(scenario => (
            <ScenarioCard
              key={scenario.id}
              scenario={scenario}
              onOpen={() => handleOpenScenario(scenario)}
              onDuplicate={() => handleDuplicateScenario(scenario)}
              onDelete={() => setDeleteId(scenario.id)}
            />
          ))}
          <Card 
            className="border-dashed cursor-pointer hover:border-primary/50 transition-colors"
            onClick={() => setShowFormModal(true)}
          >
            <CardContent className="flex flex-col items-center justify-center py-8">
              <div className="h-12 w-12 rounded-full bg-muted flex items-center justify-center mb-3">
                <Plus className="h-6 w-6 text-muted-foreground" />
              </div>
              <p className="text-sm text-muted-foreground">Novo Cenário</p>
            </CardContent>
          </Card>
        </div>
      )}

      <ScenarioFormModal
        open={showFormModal}
        onClose={() => {
          setShowFormModal(false);
          setEditingScenario(null);
        }}
        onSave={handleCreateScenario}
        scenario={editingScenario}
        selectedMonth={selectedMonth}
        selectedYear={selectedYear}
      />

      <PaymentCapacityCalculator
        open={showCalculator}
        onClose={() => setShowCalculator(false)}
        currentIncome={monthSummary?.realizedIncome || budget?.plannedIncome || 0}
        currentExpenses={monthSummary?.realizedExpenses || budget?.plannedExpenses || 0}
      />

      <AlertDialog open={!!deleteId} onOpenChange={(o) => !o && setDeleteId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir cenário?</AlertDialogTitle>
            <AlertDialogDescription>
              Esta ação não pode ser desfeita. O cenário será removido permanentemente.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={handleDeleteScenario} className="bg-destructive text-destructive-foreground">
              Excluir
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
