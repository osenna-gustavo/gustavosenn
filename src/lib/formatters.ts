export function formatCurrency(value: number): string {
  return new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL',
  }).format(value);
}

export function formatCurrencyCompact(value: number): string {
  if (Math.abs(value) >= 1000000) {
    return new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'BRL',
      maximumFractionDigits: 1,
    }).format(value / 1000000) + 'M';
  }
  if (Math.abs(value) >= 1000) {
    return new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'BRL',
      maximumFractionDigits: 1,
    }).format(value / 1000) + 'K';
  }
  return formatCurrency(value);
}

export function formatDate(date: Date | string): string {
  const d = typeof date === 'string' ? new Date(date) : date;
  return new Intl.DateTimeFormat('pt-BR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  }).format(d);
}

export function formatDateShort(date: Date | string): string {
  const d = typeof date === 'string' ? new Date(date) : date;
  return new Intl.DateTimeFormat('pt-BR', {
    day: '2-digit',
    month: '2-digit',
  }).format(d);
}

export function formatMonthYear(month: number, year: number): string {
  const date = new Date(year, month, 1);
  return new Intl.DateTimeFormat('pt-BR', {
    month: 'long',
    year: 'numeric',
  }).format(date);
}

export function formatMonthYearShort(month: number, year: number): string {
  const date = new Date(year, month, 1);
  return new Intl.DateTimeFormat('pt-BR', {
    month: 'short',
    year: 'numeric',
  }).format(date);
}

export function formatPercentage(value: number, decimals = 0): string {
  return `${value.toFixed(decimals)}%`;
}

export function parseMonthYear(monthYearStr: string): { month: number; year: number } {
  const [year, month] = monthYearStr.split('-').map(Number);
  return { month: month - 1, year };
}

export function toMonthYearString(month: number, year: number): string {
  return `${year}-${String(month + 1).padStart(2, '0')}`;
}

export function getCurrentMonthYear(): { month: number; year: number } {
  const now = new Date();
  return { month: now.getMonth(), year: now.getFullYear() };
}

export function getMonthDays(month: number, year: number): number {
  return new Date(year, month + 1, 0).getDate();
}

export function getBillingPeriod(
  month: number,
  year: number,
  closeDay: number
): { start: Date; end: Date } {
  // end: closeDay of selected month, clamped to last day of that month
  const lastDayOfMonth = new Date(year, month + 1, 0).getDate();
  const endDay = Math.min(closeDay, lastDayOfMonth);
  const end = new Date(year, month, endDay, 23, 59, 59, 999);

  // start: day after closeDay of previous month
  // JS Date overflow handles boundaries (e.g. Feb 29 → Mar 1)
  let prevMonth = month - 1;
  let prevYear = year;
  if (prevMonth < 0) { prevMonth = 11; prevYear = year - 1; }
  const start = new Date(prevYear, prevMonth, closeDay + 1, 0, 0, 0, 0);

  return { start, end };
}
