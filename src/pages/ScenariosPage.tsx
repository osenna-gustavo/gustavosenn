import { Lightbulb, Plus } from 'lucide-react';
import { Button } from '@/components/ui/button';

export function ScenariosPage() {
  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl lg:text-3xl font-bold">Cenários</h1>
          <p className="text-muted-foreground">Simule decisões financeiras</p>
        </div>
        <Button className="gap-2">
          <Plus className="h-4 w-4" />
          Novo Cenário
        </Button>
      </div>

      <div className="glass-card rounded-xl p-8 text-center">
        <div className="h-16 w-16 rounded-full bg-primary/10 flex items-center justify-center mx-auto mb-4">
          <Lightbulb className="h-8 w-8 text-primary" />
        </div>
        <h3 className="text-lg font-semibold mb-2">Simulador de Cenários</h3>
        <p className="text-muted-foreground max-w-md mx-auto">
          Crie cenários para simular decisões como trocar de carro, mudar de moradia, 
          ou avaliar quanto pode gastar por mês em um novo compromisso.
        </p>
        <p className="text-sm text-muted-foreground mt-4">
          Funcionalidade completa em desenvolvimento.
        </p>
      </div>
    </div>
  );
}
