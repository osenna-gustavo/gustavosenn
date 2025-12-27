import { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { formatCurrency } from '@/lib/formatters';
import { Calculator, CheckCircle2, XCircle, AlertTriangle } from 'lucide-react';

interface PaymentCapacityCalculatorProps {
  open: boolean;
  onClose: () => void;
  currentIncome: number;
  currentExpenses: number;
}

export function PaymentCapacityCalculator({
  open,
  onClose,
  currentIncome,
  currentExpenses
}: PaymentCapacityCalculatorProps) {
  const [targetBalance, setTargetBalance] = useState('0');
  const [intendedPayment, setIntendedPayment] = useState('');

  const targetBalanceNum = parseFloat(targetBalance) || 0;
  const intendedPaymentNum = parseFloat(intendedPayment) || 0;
  
  const currentBalance = currentIncome - currentExpenses;
  const maxRecommended = Math.max(0, currentBalance - targetBalanceNum);
  const canAfford = intendedPaymentNum <= maxRecommended;
  const deficit = intendedPaymentNum - maxRecommended;

  const hasIntendedPayment = intendedPayment !== '' && intendedPaymentNum > 0;

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Calculator className="h-5 w-5" />
            Quanto Posso Pagar Por Mês?
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-6 py-4">
          {/* Current Situation */}
          <Card>
            <CardContent className="pt-4">
              <h4 className="text-sm font-medium text-muted-foreground mb-3">Situação Atual</h4>
              <div className="grid grid-cols-3 gap-4 text-center">
                <div>
                  <p className="text-xs text-muted-foreground">Receita</p>
                  <p className="font-semibold text-primary">{formatCurrency(currentIncome)}</p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Despesas</p>
                  <p className="font-semibold text-destructive">{formatCurrency(currentExpenses)}</p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Saldo</p>
                  <p className="font-semibold text-foreground">{formatCurrency(currentBalance)}</p>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Inputs */}
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="targetBalance">Meta de Saldo Mínimo (R$)</Label>
              <Input
                id="targetBalance"
                type="number"
                min="0"
                step="0.01"
                value={targetBalance}
                onChange={(e) => setTargetBalance(e.target.value)}
                placeholder="0,00"
              />
              <p className="text-xs text-muted-foreground">
                Quanto você quer que sobre no final do mês
              </p>
            </div>

            <div className="space-y-2">
              <Label htmlFor="intendedPayment">Valor Pretendido (R$) - Opcional</Label>
              <Input
                id="intendedPayment"
                type="number"
                min="0"
                step="0.01"
                value={intendedPayment}
                onChange={(e) => setIntendedPayment(e.target.value)}
                placeholder="Ex: 1.500,00"
              />
              <p className="text-xs text-muted-foreground">
                Deixe em branco para ver o máximo recomendado
              </p>
            </div>
          </div>

          {/* Results */}
          <div className="space-y-4">
            <Card className="border-primary/50">
              <CardContent className="pt-4 text-center">
                <p className="text-sm text-muted-foreground mb-1">Máximo Recomendado</p>
                <p className="text-3xl font-bold text-primary">
                  {formatCurrency(maxRecommended)}
                </p>
                <p className="text-xs text-muted-foreground mt-1">
                  por mês, mantendo saldo de {formatCurrency(targetBalanceNum)}
                </p>
              </CardContent>
            </Card>

            {hasIntendedPayment && (
              <Card className={canAfford ? 'border-primary/50' : 'border-destructive/50'}>
                <CardContent className="pt-4">
                  <div className="flex items-center justify-center gap-3">
                    {canAfford ? (
                      <>
                        <CheckCircle2 className="h-8 w-8 text-primary" />
                        <div>
                          <p className="font-semibold text-primary">Cabe no orçamento!</p>
                          <p className="text-sm text-muted-foreground">
                            Sobra de {formatCurrency(maxRecommended - intendedPaymentNum)} além do pretendido
                          </p>
                        </div>
                      </>
                    ) : (
                      <>
                        <XCircle className="h-8 w-8 text-destructive" />
                        <div>
                          <p className="font-semibold text-destructive">Não cabe no orçamento</p>
                          <p className="text-sm text-muted-foreground">
                            Falta cortar {formatCurrency(deficit)} de despesas
                          </p>
                        </div>
                      </>
                    )}
                  </div>
                </CardContent>
              </Card>
            )}

            {maxRecommended === 0 && (
              <div className="flex items-center gap-2 p-3 rounded-lg bg-destructive/10 text-destructive">
                <AlertTriangle className="h-5 w-5 shrink-0" />
                <p className="text-sm">
                  Suas despesas atuais já consomem toda a receita. 
                  Reduza despesas antes de assumir novos compromissos.
                </p>
              </div>
            )}
          </div>
        </div>

        <div className="flex justify-end">
          <Button variant="outline" onClick={onClose}>
            Fechar
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
