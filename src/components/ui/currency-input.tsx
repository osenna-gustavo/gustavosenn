import * as React from "react";
import { Input } from "@/components/ui/input";
import { formatBRLInput, parseBRLToNumber, formatNumberToBRL } from "@/lib/currencyInput";
import { cn } from "@/lib/utils";

interface CurrencyInputProps extends Omit<React.InputHTMLAttributes<HTMLInputElement>, 'onChange' | 'value'> {
  value: number | string;
  onChange: (value: string) => void;
  onBlur?: () => void;
}

export const CurrencyInput = React.forwardRef<HTMLInputElement, CurrencyInputProps>(
  ({ value, onChange, onBlur, className, ...props }, ref) => {
    const [displayValue, setDisplayValue] = React.useState('');

    React.useEffect(() => {
      if (typeof value === 'number') {
        setDisplayValue(value > 0 ? formatNumberToBRL(value) : '');
      } else if (typeof value === 'string') {
        setDisplayValue(value);
      }
    }, [value]);

    const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
      const formatted = formatBRLInput(e.target.value);
      setDisplayValue(formatted);
      onChange(formatted);
    };

    const handleBlur = () => {
      // Format to 2 decimal places on blur
      const numValue = parseBRLToNumber(displayValue);
      if (numValue > 0) {
        const formatted = formatNumberToBRL(numValue);
        setDisplayValue(formatted);
        onChange(formatted);
      }
      onBlur?.();
    };

    return (
      <Input
        ref={ref}
        type="text"
        inputMode="decimal"
        placeholder="0,00"
        value={displayValue}
        onChange={handleChange}
        onBlur={handleBlur}
        className={cn("font-mono text-right", className)}
        {...props}
      />
    );
  }
);

CurrencyInput.displayName = "CurrencyInput";
