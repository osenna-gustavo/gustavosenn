import { Scenario } from '@/types/finance';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Play, Copy, Trash2, Calendar, Target } from 'lucide-react';
import { formatCurrency } from '@/lib/formatters';

const BASELINE_LABELS = {
  planned: 'Planejado',
  realized: 'Realizado',
  average: 'Média 3 meses'
};

const MONTHS = [
  'Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho',
  'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro'
];

interface ScenarioCardProps {
  scenario: Scenario;
  onOpen: () => void;
  onDuplicate: () => void;
  onDelete: () => void;
}

export function ScenarioCard({ scenario, onOpen, onDuplicate, onDelete }: ScenarioCardProps) {
  return (
    <Card className="hover:border-primary/50 transition-colors">
      <CardContent className="p-4">
        <div className="flex items-start justify-between mb-3">
          <div>
            <h3 className="font-semibold text-foreground">{scenario.name}</h3>
            <p className="text-sm text-muted-foreground">
              {BASELINE_LABELS[scenario.baselineType]}
            </p>
          </div>
          <div className="flex gap-1">
            <Button variant="ghost" size="icon" onClick={onDuplicate} title="Duplicar">
              <Copy className="h-4 w-4" />
            </Button>
            <Button variant="ghost" size="icon" onClick={onDelete} title="Excluir">
              <Trash2 className="h-4 w-4 text-destructive" />
            </Button>
          </div>
        </div>
        
        <div className="space-y-2 mb-4 text-sm">
          <div className="flex items-center gap-2 text-muted-foreground">
            <Calendar className="h-4 w-4" />
            <span>
              {MONTHS[scenario.baselineMonth]} {scenario.baselineYear}
            </span>
          </div>
          {scenario.minimumBalance > 0 && (
            <div className="flex items-center gap-2 text-muted-foreground">
              <Target className="h-4 w-4" />
              <span>Meta: {formatCurrency(scenario.minimumBalance)}</span>
            </div>
          )}
        </div>
        
        <Button onClick={onOpen} className="w-full gap-2">
          <Play className="h-4 w-4" />
          Abrir Simulador
        </Button>
      </CardContent>
    </Card>
  );
}
