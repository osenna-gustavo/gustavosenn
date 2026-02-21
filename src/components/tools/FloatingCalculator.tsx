import { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Calculator } from 'lucide-react';

interface FloatingCalculatorProps {
  open: boolean;
  onClose: () => void;
}

export function FloatingCalculator({ open, onClose }: FloatingCalculatorProps) {
  const [display, setDisplay] = useState('0');
  const [previous, setPrevious] = useState<string | null>(null);
  const [operator, setOperator] = useState<string | null>(null);
  const [resetNext, setResetNext] = useState(false);

  const handleNumber = (num: string) => {
    if (resetNext) {
      setDisplay(num);
      setResetNext(false);
    } else {
      setDisplay(display === '0' ? num : display + num);
    }
  };

  const handleOperator = (op: string) => {
    if (previous && operator && !resetNext) {
      const result = calculate(parseFloat(previous), parseFloat(display), operator);
      setDisplay(String(result));
      setPrevious(String(result));
    } else {
      setPrevious(display);
    }
    setOperator(op);
    setResetNext(true);
  };

  const calculate = (a: number, b: number, op: string): number => {
    switch (op) {
      case '+': return a + b;
      case '-': return a - b;
      case '×': return a * b;
      case '÷': return b !== 0 ? a / b : 0;
      default: return b;
    }
  };

  const handleEquals = () => {
    if (previous && operator) {
      const result = calculate(parseFloat(previous), parseFloat(display), operator);
      setDisplay(String(Math.round(result * 100) / 100));
      setPrevious(null);
      setOperator(null);
      setResetNext(true);
    }
  };

  const handleClear = () => {
    setDisplay('0');
    setPrevious(null);
    setOperator(null);
    setResetNext(false);
  };

  const handleDecimal = () => {
    if (!display.includes('.')) {
      setDisplay(display + '.');
    }
  };

  const handlePercent = () => {
    setDisplay(String(parseFloat(display) / 100));
  };

  const handleToggleSign = () => {
    setDisplay(String(parseFloat(display) * -1));
  };

  const btnBase = "h-12 text-lg font-medium rounded-lg transition-colors";

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="sm:max-w-[320px] p-4">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-base">
            <Calculator className="h-4 w-4" />
            Calculadora
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-2">
          {/* Display */}
          <div className="bg-muted rounded-lg p-3 text-right">
            {previous && operator && (
              <p className="text-xs text-muted-foreground">{previous} {operator}</p>
            )}
            <p className="text-2xl font-bold text-foreground truncate">{display}</p>
          </div>

          {/* Buttons */}
          <div className="grid grid-cols-4 gap-1.5">
            <Button variant="secondary" className={btnBase} onClick={handleClear}>C</Button>
            <Button variant="secondary" className={btnBase} onClick={handleToggleSign}>±</Button>
            <Button variant="secondary" className={btnBase} onClick={handlePercent}>%</Button>
            <Button variant="default" className={btnBase} onClick={() => handleOperator('÷')}>÷</Button>

            <Button variant="outline" className={btnBase} onClick={() => handleNumber('7')}>7</Button>
            <Button variant="outline" className={btnBase} onClick={() => handleNumber('8')}>8</Button>
            <Button variant="outline" className={btnBase} onClick={() => handleNumber('9')}>9</Button>
            <Button variant="default" className={btnBase} onClick={() => handleOperator('×')}>×</Button>

            <Button variant="outline" className={btnBase} onClick={() => handleNumber('4')}>4</Button>
            <Button variant="outline" className={btnBase} onClick={() => handleNumber('5')}>5</Button>
            <Button variant="outline" className={btnBase} onClick={() => handleNumber('6')}>6</Button>
            <Button variant="default" className={btnBase} onClick={() => handleOperator('-')}>-</Button>

            <Button variant="outline" className={btnBase} onClick={() => handleNumber('1')}>1</Button>
            <Button variant="outline" className={btnBase} onClick={() => handleNumber('2')}>2</Button>
            <Button variant="outline" className={btnBase} onClick={() => handleNumber('3')}>3</Button>
            <Button variant="default" className={btnBase} onClick={() => handleOperator('+')}>+</Button>

            <Button variant="outline" className={`${btnBase} col-span-2`} onClick={() => handleNumber('0')}>0</Button>
            <Button variant="outline" className={btnBase} onClick={handleDecimal}>,</Button>
            <Button variant="default" className={btnBase} onClick={handleEquals}>=</Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
