import { useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Category, ScenarioCommitment, ScenarioOneTimeCost, ScenarioCategoryAdjustment } from '@/types/finance';
import { formatCurrency } from '@/lib/formatters';
import { 
  TrendingDown, 
  TrendingUp, 
  AlertTriangle, 
  CheckCircle2,
  Lightbulb,
  ArrowRight
} from 'lucide-react';

interface ScenarioData {
  name: string;
  baselineType: 'planned' | 'realized' | 'average';
  referenceMonth: number;
  referenceYear: number;
  minimumBalance: number;
  commitments: ScenarioCommitment[];
  oneTimeCosts: ScenarioOneTimeCost[];
  categoryAdjustments: ScenarioCategoryAdjustment[];
}

interface BaselineData {
  income: number;
  expenses: number;
  categoryBreakdown: {
    categoryId: string;
    amount: number;
    isFixed: boolean;
  }[];
}

interface ScenarioResults {
  before: { income: number; expenses: number; fixed: number; variable: number; balance: number };
  after: { income: number; expenses: number; fixed: number; variable: number; balance: number };
  exceededCategories: { categoryId: string; categoryName: string; amount: number }[];
  amountToCut: number;
  suggestions: { categoryId: string; categoryName: string; currentAmount: number; suggestedCut: number }[];
}

interface ScenarioSimulatorProps {
  scenarioData: ScenarioData;
  baselineData: BaselineData;
  categories: Category[];
}

export function ScenarioSimulator({ scenarioData, baselineData, categories }: ScenarioSimulatorProps) {
  const results = useMemo((): ScenarioResults => {
    const beforeFixed = baselineData.categoryBreakdown.filter(c => c.isFixed).reduce((sum, c) => sum + c.amount, 0);
    const beforeVariable = baselineData.categoryBreakdown.filter(c => !c.isFixed).reduce((sum, c) => sum + c.amount, 0);

    const before = {
      income: baselineData.income,
      expenses: baselineData.expenses,
      fixed: beforeFixed,
      variable: beforeVariable,
      balance: baselineData.income - baselineData.expenses
    };

    let afterExpenses = 0;
    let afterFixed = 0;
    let afterVariable = 0;

    const categoryAmounts = new Map<string, number>();

    for (const adj of scenarioData.categoryAdjustments) {
      categoryAmounts.set(adj.categoryId, adj.adjustedAmount);
    }

    for (const baseline of baselineData.categoryBreakdown) {
      if (!categoryAmounts.has(baseline.categoryId)) {
        categoryAmounts.set(baseline.categoryId, baseline.amount);
      }
    }

    for (const commitment of scenarioData.commitments) {
      const current = categoryAmounts.get(commitment.categoryId) || 0;
      categoryAmounts.set(commitment.categoryId, current + commitment.amount);
    }

    for (const cost of scenarioData.oneTimeCosts) {
      if (cost.impactMonth === scenarioData.referenceMonth && cost.impactYear === scenarioData.referenceYear) {
        const current = categoryAmounts.get(cost.categoryId) || 0;
        categoryAmounts.set(cost.categoryId, current + cost.amount);
      }
    }

    for (const [catId, amount] of categoryAmounts) {
      afterExpenses += amount;
      const cat = categories.find(c => c.id === catId);
      if (cat?.isFixed) {
        afterFixed += amount;
      } else {
        afterVariable += amount;
      }
    }

    const after = {
      income: baselineData.income,
      expenses: afterExpenses,
      fixed: afterFixed,
      variable: afterVariable,
      balance: baselineData.income - afterExpenses
    };

    const exceededCategories: ScenarioResults['exceededCategories'] = [];
    for (const [catId, amount] of categoryAmounts) {
      const baseline = baselineData.categoryBreakdown.find(c => c.categoryId === catId);
      if (baseline && amount > baseline.amount) {
        const cat = categories.find(c => c.id === catId);
        exceededCategories.push({ categoryId: catId, categoryName: cat?.name || 'Categoria', amount: amount - baseline.amount });
      }
    }

    const amountToCut = Math.max(0, scenarioData.minimumBalance - after.balance);

    const suggestions: ScenarioResults['suggestions'] = [];
    if (amountToCut > 0) {
      let remainingCut = amountToCut;
      const sortedCategories = Array.from(categoryAmounts.entries())
        .map(([catId, amount]) => ({ categoryId: catId, amount, isFixed: categories.find(c => c.id === catId)?.isFixed || false }))
        .filter(c => !c.isFixed && c.amount > 0)
        .sort((a, b) => b.amount - a.amount);

      for (const cat of sortedCategories) {
        if (remainingCut <= 0) break;
        const maxCut = Math.min(cat.amount * 0.3, remainingCut);
        const category = categories.find(c => c.id === cat.categoryId);
        suggestions.push({ categoryId: cat.categoryId, categoryName: category?.name || 'Categoria', currentAmount: cat.amount, suggestedCut: Math.round(maxCut * 100) / 100 });
        remainingCut -= maxCut;
      }
    }

    return { before, after, exceededCategories, amountToCut, suggestions };
  }, [scenarioData, baselineData, categories]);

  const balanceDiff = results.after.balance - results.before.balance;
  const isPositive = results.after.balance >= scenarioData.minimumBalance;

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-lg flex items-center gap-2">
            Comparativo
            {isPositive ? <CheckCircle2 className="h-5 w-5 text-primary" /> : <AlertTriangle className="h-5 w-5 text-destructive" />}
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b">
                  <th className="text-left py-2 font-medium text-muted-foreground"></th>
                  <th className="text-right py-2 font-medium text-muted-foreground">Antes</th>
                  <th className="text-right py-2 font-medium text-muted-foreground">Depois</th>
                  <th className="text-right py-2 font-medium text-muted-foreground">Diferença</th>
                </tr>
              </thead>
              <tbody>
                <tr className="border-b"><td className="py-2 text-foreground">Receita</td><td className="py-2 text-right">{formatCurrency(results.before.income)}</td><td className="py-2 text-right">{formatCurrency(results.after.income)}</td><td className="py-2 text-right text-muted-foreground">-</td></tr>
                <tr className="border-b"><td className="py-2 text-foreground">Despesas</td><td className="py-2 text-right">{formatCurrency(results.before.expenses)}</td><td className="py-2 text-right">{formatCurrency(results.after.expenses)}</td><td className="py-2 text-right"><DiffBadge value={results.after.expenses - results.before.expenses} inverted /></td></tr>
                <tr className="border-b"><td className="py-2 text-foreground">Fixos</td><td className="py-2 text-right">{formatCurrency(results.before.fixed)}</td><td className="py-2 text-right">{formatCurrency(results.after.fixed)}</td><td className="py-2 text-right"><DiffBadge value={results.after.fixed - results.before.fixed} inverted /></td></tr>
                <tr className="border-b"><td className="py-2 text-foreground">Variáveis</td><td className="py-2 text-right">{formatCurrency(results.before.variable)}</td><td className="py-2 text-right">{formatCurrency(results.after.variable)}</td><td className="py-2 text-right"><DiffBadge value={results.after.variable - results.before.variable} inverted /></td></tr>
                <tr className="font-semibold"><td className="py-2 text-foreground">Saldo</td><td className="py-2 text-right">{formatCurrency(results.before.balance)}</td><td className="py-2 text-right">{formatCurrency(results.after.balance)}</td><td className="py-2 text-right"><DiffBadge value={balanceDiff} /></td></tr>
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>

      {results.exceededCategories.length > 0 && (
        <Card className="border-destructive/50">
          <CardHeader className="pb-3"><CardTitle className="text-lg flex items-center gap-2 text-destructive"><AlertTriangle className="h-5 w-5" />Categorias que Estourariam</CardTitle></CardHeader>
          <CardContent>
            <div className="space-y-2">
              {results.exceededCategories.map(cat => (
                <div key={cat.categoryId} className="flex justify-between items-center p-2 rounded bg-destructive/10">
                  <span className="text-foreground">{cat.categoryName}</span>
                  <span className="text-destructive font-medium">+{formatCurrency(cat.amount)}</span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      <Card className={results.amountToCut > 0 ? 'border-warning/50' : 'border-primary/50'}>
        <CardContent className="pt-6">
          <div className="text-center">
            {results.amountToCut > 0 ? (
              <>
                <p className="text-muted-foreground mb-1">Para atingir meta de {formatCurrency(scenarioData.minimumBalance)}, precisa cortar:</p>
                <p className="text-3xl font-bold text-destructive">{formatCurrency(results.amountToCut)}</p>
              </>
            ) : (
              <>
                <CheckCircle2 className="h-8 w-8 text-primary mx-auto mb-2" />
                <p className="text-lg font-semibold text-primary">O cenário atinge a meta!</p>
                <p className="text-sm text-muted-foreground">Saldo projetado: {formatCurrency(results.after.balance)}</p>
              </>
            )}
          </div>
        </CardContent>
      </Card>

      {results.suggestions.length > 0 && (
        <Card>
          <CardHeader className="pb-3"><CardTitle className="text-lg flex items-center gap-2"><Lightbulb className="h-5 w-5 text-primary" />Sugestões de Realocação</CardTitle></CardHeader>
          <CardContent>
            <div className="space-y-3">
              {results.suggestions.map(sug => (
                <div key={sug.categoryId} className="flex items-center justify-between p-2 rounded bg-muted/50">
                  <div>
                    <span className="text-foreground font-medium">{sug.categoryName}</span>
                    <div className="flex items-center gap-2 text-sm text-muted-foreground">
                      <span>{formatCurrency(sug.currentAmount)}</span>
                      <ArrowRight className="h-3 w-3" />
                      <span>{formatCurrency(sug.currentAmount - sug.suggestedCut)}</span>
                    </div>
                  </div>
                  <Badge variant="secondary">-{formatCurrency(sug.suggestedCut)}</Badge>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

function DiffBadge({ value, inverted = false }: { value: number; inverted?: boolean }) {
  if (value === 0) return <span className="text-muted-foreground">-</span>;
  const isPositive = inverted ? value < 0 : value > 0;
  return (
    <span className={`inline-flex items-center gap-1 ${isPositive ? 'text-primary' : 'text-destructive'}`}>
      {value > 0 ? <TrendingUp className="h-3 w-3" /> : <TrendingDown className="h-3 w-3" />}
      {value > 0 ? '+' : ''}{formatCurrency(value)}
    </span>
  );
}
