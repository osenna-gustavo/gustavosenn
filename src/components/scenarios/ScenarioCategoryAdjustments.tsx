import { useEffect, useState } from 'react';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Slider } from '@/components/ui/slider';
import { Badge } from '@/components/ui/badge';
import { ScenarioCategoryAdjustment, Category } from '@/types/finance';
import { formatCurrency } from '@/lib/formatters';
import { ArrowDown, ArrowUp, Minus } from 'lucide-react';

interface ScenarioCategoryAdjustmentsProps {
  adjustments: ScenarioCategoryAdjustment[];
  onChange: (adjustments: ScenarioCategoryAdjustment[]) => void;
  categories: Category[];
  baselineData: { categoryId: string; amount: number }[];
}

interface LocalAdjustment {
  categoryId: string;
  originalAmount: number;
  adjustedAmount: number;
}

export function ScenarioCategoryAdjustments({
  adjustments,
  onChange,
  categories,
  baselineData
}: ScenarioCategoryAdjustmentsProps) {
  const [localAdjustments, setLocalAdjustments] = useState<LocalAdjustment[]>([]);

  const expenseCategories = categories.filter(c => c.type === 'despesa');

  useEffect(() => {
    const initialAdjustments = expenseCategories.map(cat => {
      const existing = adjustments.find(a => a.categoryId === cat.id);
      const baseline = baselineData.find(b => b.categoryId === cat.id);
      const originalAmount = baseline?.amount || 0;
      
      return {
        categoryId: cat.id,
        originalAmount,
        adjustedAmount: existing?.adjustedAmount ?? originalAmount
      };
    });
    setLocalAdjustments(initialAdjustments);
  }, [categories, baselineData]);

  const handleAdjustment = (categoryId: string, value: number) => {
    const updated = localAdjustments.map(adj =>
      adj.categoryId === categoryId
        ? { ...adj, adjustedAmount: Math.max(0, value) }
        : adj
    );
    setLocalAdjustments(updated);
    onChange(updated.map(a => ({
      categoryId: a.categoryId,
      adjustedAmount: a.adjustedAmount
    })));
  };

  const getDifference = (adj: LocalAdjustment) => {
    return adj.adjustedAmount - adj.originalAmount;
  };

  const getDifferenceIndicator = (diff: number) => {
    if (diff > 0) return <ArrowUp className="h-3 w-3 text-destructive" />;
    if (diff < 0) return <ArrowDown className="h-3 w-3 text-primary" />;
    return <Minus className="h-3 w-3 text-muted-foreground" />;
  };

  if (localAdjustments.length === 0) {
    return (
      <p className="text-sm text-muted-foreground text-center py-4">
        Configure o baseline para ver os ajustes por categoria.
      </p>
    );
  }

  return (
    <div className="space-y-4">
      {localAdjustments.map((adj) => {
        const category = expenseCategories.find(c => c.id === adj.categoryId);
        if (!category || adj.originalAmount === 0) return null;

        const diff = getDifference(adj);
        const maxValue = adj.originalAmount * 2;

        return (
          <div key={adj.categoryId} className="space-y-2 p-3 rounded-lg border bg-card">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Label className="font-medium">{category.name}</Label>
                {category.isFixed && (
                  <Badge variant="outline" className="text-xs">Fixo</Badge>
                )}
              </div>
              <div className="flex items-center gap-1 text-sm">
                {getDifferenceIndicator(diff)}
                <span className={
                  diff > 0 ? 'text-destructive' : 
                  diff < 0 ? 'text-primary' : 
                  'text-muted-foreground'
                }>
                  {diff !== 0 && (diff > 0 ? '+' : '')}
                  {formatCurrency(Math.abs(diff))}
                </span>
              </div>
            </div>

            <div className="flex items-center gap-4">
              <div className="flex-1">
                <Slider
                  value={[adj.adjustedAmount]}
                  onValueChange={([v]) => handleAdjustment(adj.categoryId, v)}
                  min={0}
                  max={maxValue}
                  step={10}
                />
              </div>
              <Input
                type="number"
                min={0}
                step={10}
                value={adj.adjustedAmount}
                onChange={(e) => handleAdjustment(adj.categoryId, parseFloat(e.target.value) || 0)}
                className="w-28 text-right"
              />
            </div>

            <div className="flex justify-between text-xs text-muted-foreground">
              <span>Original: {formatCurrency(adj.originalAmount)}</span>
              <span>Novo: {formatCurrency(adj.adjustedAmount)}</span>
            </div>
          </div>
        );
      })}
    </div>
  );
}
