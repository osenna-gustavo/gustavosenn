import { useApp } from '@/contexts/AppContext';
import { formatMonthYear, formatDateShort } from '@/lib/formatters';
import { ChevronLeft, ChevronRight, Calendar } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';

export function MonthSelector() {
  const { selectedMonth, selectedYear, setSelectedMonth, billingDateRange } = useApp();

  const handlePrevMonth = () => {
    if (selectedMonth === 0) {
      setSelectedMonth(11, selectedYear - 1);
    } else {
      setSelectedMonth(selectedMonth - 1, selectedYear);
    }
  };

  const handleNextMonth = () => {
    if (selectedMonth === 11) {
      setSelectedMonth(0, selectedYear + 1);
    } else {
      setSelectedMonth(selectedMonth + 1, selectedYear);
    }
  };

  const months = [
    'Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho',
    'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro'
  ];

  const currentYear = new Date().getFullYear();
  const years = Array.from({ length: 5 }, (_, i) => currentYear - 2 + i);

  return (
    <div className="flex flex-col items-center gap-0.5">
      <div className="flex items-center gap-2">
        <Button variant="ghost" size="icon" onClick={handlePrevMonth} className="h-8 w-8">
          <ChevronLeft className="h-4 w-4" />
        </Button>

        <div className="flex items-center gap-1 min-w-[180px]">
          <Calendar className="h-4 w-4 text-primary" />
          <Select
            value={String(selectedMonth)}
            onValueChange={(value) => setSelectedMonth(Number(value), selectedYear)}
          >
            <SelectTrigger className="w-[110px] h-8 border-0 bg-transparent font-medium">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {months.map((month, index) => (
                <SelectItem key={index} value={String(index)}>
                  {month}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          <Select
            value={String(selectedYear)}
            onValueChange={(value) => setSelectedMonth(selectedMonth, Number(value))}
          >
            <SelectTrigger className="w-[80px] h-8 border-0 bg-transparent font-medium">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {years.map((year) => (
                <SelectItem key={year} value={String(year)}>
                  {year}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <Button variant="ghost" size="icon" onClick={handleNextMonth} className="h-8 w-8">
          <ChevronRight className="h-4 w-4" />
        </Button>
      </div>

      {billingDateRange && (
        <p className="text-[10px] text-primary/70 font-medium">
          {formatDateShort(billingDateRange.start)} → {formatDateShort(billingDateRange.end)}
        </p>
      )}
    </div>
  );
}
