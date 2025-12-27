// Utility functions for BRL currency input handling

export function formatBRLInput(value: string): string {
  // Remove non-numeric characters except comma and dot
  let cleaned = value.replace(/[^\d,\.]/g, '');
  
  // Replace dot with comma for Brazilian format
  cleaned = cleaned.replace(/\./g, ',');
  
  // Keep only one comma
  const parts = cleaned.split(',');
  if (parts.length > 2) {
    cleaned = parts[0] + ',' + parts.slice(1).join('');
  }
  
  return cleaned;
}

export function parseBRLToNumber(value: string): number {
  if (!value) return 0;
  // Remove thousand separators (dots) and convert comma to dot for parsing
  const normalized = value.replace(/\./g, '').replace(',', '.');
  const parsed = parseFloat(normalized);
  return isNaN(parsed) ? 0 : Math.round(parsed * 100) / 100; // Round to 2 decimals
}

export function formatNumberToBRL(value: number): string {
  // Format with 2 decimal places and comma separator
  return value.toFixed(2).replace('.', ',');
}

export function formatDisplayBRL(value: number): string {
  return new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(value);
}
