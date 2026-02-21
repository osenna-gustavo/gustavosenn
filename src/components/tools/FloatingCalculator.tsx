import { useState, useEffect, useCallback } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Calculator, Delete } from 'lucide-react';

interface FloatingCalculatorProps {
  open: boolean;
  onClose: () => void;
}

export function FloatingCalculator({ open, onClose }: FloatingCalculatorProps) {
  const [display, setDisplay] = useState('0');
  const [previous, setPrevious] = useState<string | null>(null);
  const [operator, setOperator] = useState<string | null>(null);
  const [resetNext, setResetNext] = useState(false);

  const handleNumber = useCallback((num: string) => {
    setDisplay(prev => {
      if (resetNext) {
        setResetNext(false);
        return num;
      }
      return prev === '0' ? num : prev + num;
    });
  }, [resetNext]);

  const calculate = useCallback((a: number, b: number, op: string): number => {
    switch (op) {
      case '+': return a + b;
      case '-': return a - b;
      case '×': return a * b;
      case '÷': return b !== 0 ? a / b : 0;
      case '^': return Math.pow(a, b);
      default: return b;
    }
  }, []);

  const handleOperator = useCallback((op: string) => {
    setPrevious(prev => {
      if (prev && operator && !resetNext) {
        const result = calculate(parseFloat(prev), parseFloat(display), operator);
        setDisplay(String(Math.round(result * 100000000) / 100000000));
        return String(result);
      }
      return display;
    });
    setOperator(op);
    setResetNext(true);
  }, [display, operator, resetNext, calculate]);

  const handleEquals = useCallback(() => {
    if (previous && operator) {
      const result = calculate(parseFloat(previous), parseFloat(display), operator);
      setDisplay(String(Math.round(result * 100000000) / 100000000));
      setPrevious(null);
      setOperator(null);
      setResetNext(true);
    }
  }, [previous, display, operator, calculate]);

  const handleClear = useCallback(() => {
    setDisplay('0');
    setPrevious(null);
    setOperator(null);
    setResetNext(false);
  }, []);

  const handleBackspace = useCallback(() => {
    setDisplay(prev => {
      if (prev.length === 1 || prev === 'Error') return '0';
      return prev.slice(0, -1);
    });
  }, []);

  const handleDecimal = useCallback(() => {
    setDisplay(prev => {
      if (resetNext) {
        setResetNext(false);
        return '0.';
      }
      return prev.includes('.') ? prev : prev + '.';
    });
  }, [resetNext]);

  const handlePercent = useCallback(() => {
    setDisplay(prev => String(parseFloat(prev) / 100));
  }, []);

  const handleToggleSign = useCallback(() => {
    setDisplay(prev => String(parseFloat(prev) * -1));
  }, []);

  const handleScientific = useCallback((type: 'sqrt' | 'sqr') => {
    setDisplay(prev => {
      const val = parseFloat(prev);
      let res = 0;
      if (type === 'sqrt') res = Math.sqrt(val);
      if (type === 'sqr') res = Math.pow(val, 2);
      setResetNext(true);
      return String(Math.round(res * 100000000) / 100000000);
    });
  }, []);

  // Keyboard Support
  useEffect(() => {
    if (!open) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key >= '0' && e.key <= '9') handleNumber(e.key);
      else if (e.key === '+') handleOperator('+');
      else if (e.key === '-') handleOperator('-');
      else if (e.key === '*') handleOperator('×');
      else if (e.key === '/') {
        e.preventDefault();
        handleOperator('÷');
      }
      else if (e.key === 'Enter' || e.key === '=') handleEquals();
      else if (e.key === 'Backspace') handleBackspace();
      else if (e.key === 'Escape' || e.key.toLowerCase() === 'c') handleClear();
      else if (e.key === '.' || e.key === ',') handleDecimal();
      else if (e.key === '%') handlePercent();
      else if (e.key === '^') handleOperator('^');
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [open, handleNumber, handleOperator, handleEquals, handleBackspace, handleClear, handleDecimal, handlePercent]);

  const btnBase = "h-11 text-base font-medium rounded-lg transition-colors";
  const sciBtn = "bg-secondary/50 hover:bg-secondary text-secondary-foreground text-sm";

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="sm:max-w-[340px] p-4 gap-4">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-base">
            <Calculator className="h-4 w-4" />
            Calculadora
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-3">
          {/* Display */}
          <div className="bg-muted/50 rounded-lg p-3 text-right border border-border/50">
            {previous && operator && (
              <p className="text-xs text-muted-foreground animate-in fade-in slide-in-from-top-1">
                {previous} {operator}
              </p>
            )}
            <p className="text-2xl font-bold text-foreground truncate">{display.replace('.', ',')}</p>
          </div>

          {/* Buttons Layout */}
          <div className="flex flex-col gap-1.5">
            {/* Scientific Row */}
            <div className="grid grid-cols-4 gap-1.5">
              <Button variant="ghost" className={`${btnBase} ${sciBtn}`} onClick={() => handleScientific('sqrt')}>√x</Button>
              <Button variant="ghost" className={`${btnBase} ${sciBtn}`} onClick={() => handleScientific('sqr')}>x²</Button>
              <Button variant="ghost" className={`${btnBase} ${sciBtn}`} onClick={() => handleOperator('^')}>x^y</Button>
              <Button variant="ghost" className={`${btnBase} ${sciBtn} text-destructive hover:text-destructive`} onClick={handleBackspace}>
                <Delete className="h-4 w-4" />
              </Button>
            </div>

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
        </div>
      </DialogContent>
    </Dialog>
  );
}

