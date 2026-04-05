import { v4 as uuid } from 'uuid';
import type { C6Transaction, C6ParseResult, CardType, C6TransactionType } from '@/types/invoice';
import { normalizeMerchant } from './c6InvoiceParser';

// ─── Amount parser ────────────────────────────────────────────────────────────

function parseBRLAmount(s: string): number | null {
  const clean = s
    .trim()
    .replace(/["""'']/g, '')
    .replace(/R\$\s*/g, '')
    .replace(/\./g, '')        // thousand separator
    .replace(',', '.');        // decimal separator
  const n = parseFloat(clean);
  return isNaN(n) ? null : n;
}

// ─── Date parser ─────────────────────────────────────────────────────────────

function parseDate(s: string, defaultYear: number): Date | null {
  const clean = s.trim().replace(/["""'']/g, '');
  const m = clean.match(/^(\d{1,2})[\/\-](\d{1,2})(?:[\/\-](\d{2,4}))?$/);
  if (!m) return null;
  const day = parseInt(m[1]);
  const month = parseInt(m[2]) - 1;
  let year = defaultYear;
  if (m[3]) {
    year = parseInt(m[3]);
    if (year < 100) year += 2000;
  }
  if (day < 1 || day > 31 || month < 0 || month > 11) return null;
  return new Date(year, month, day);
}

// ─── Separator detection ──────────────────────────────────────────────────────

function detectSeparator(text: string): string {
  const sample = text.slice(0, 1000);
  const semis = (sample.match(/;/g) ?? []).length;
  const tabs  = (sample.match(/\t/g)  ?? []).length;
  return tabs > semis ? '\t' : ';';
}

// ─── Transaction type from description ───────────────────────────────────────

function classifyFromDesc(desc: string): C6TransactionType {
  const d = desc.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
  if (/\bestorno\b/.test(d))               return 'estorno';
  if (/\biof\b/.test(d))                   return 'iof';
  if (/pag(amento)?\s*(da\s*)?fatura/.test(d)) return 'pagamento_fatura';
  if (/anuidade|tarifa/.test(d))           return 'tarifa';
  return 'compra';
}

// ─── Main parser ──────────────────────────────────────────────────────────────

/**
 * Parses CSV text or free-form pasted text into C6ParseResult.
 *
 * Accepted formats (auto-detected separator: `;` or TAB):
 *
 *   DD/MM/AAAA; Descrição; Valor
 *   DD/MM/AAAA; Descrição; Valor
 *
 * Rules:
 * - One transaction per line
 * - Date in first column (DD/MM or DD/MM/AAAA)
 * - Description in middle column(s)
 * - Amount in last column — use positive for expenses, negative for estornos
 *   (C6 Bank CSV convention is inverted: negative = expense, positive = credit;
 *    both conventions work because we classify by description keywords)
 * - Lines that don't start with a date are silently skipped (headers, blanks)
 */
export function parseImportText(
  text: string,
  sourceName: string,
  defaultYear?: number,
): C6ParseResult {
  const year = defaultYear ?? new Date().getFullYear();
  const logs: string[] = [];
  const transactions: C6Transaction[] = [];

  const rawLines = text.replace(/\r\n/g, '\n').replace(/\r/g, '\n').split('\n');
  const sep = detectSeparator(text);
  logs.push(`[Import] Source: ${sourceName} | Lines: ${rawLines.length} | Sep: "${sep === '\t' ? 'TAB' : sep}"`);

  let processed = 0;
  let skipped = 0;

  for (const rawLine of rawLines) {
    const line = rawLine.trim();
    if (!line || line.length < 5) continue;

    const parts = line.split(sep).map(p => p.trim().replace(/^[""]|[""]$/g, ''));

    // Need at least 3 columns: date, description, amount
    if (parts.length < 3) { skipped++; continue; }

    // First column must be a date
    const date = parseDate(parts[0], year);
    if (!date) { skipped++; continue; }

    processed++;

    // Last column = amount
    const rawAmount = parseBRLAmount(parts[parts.length - 1]);
    if (rawAmount === null || rawAmount === 0) {
      logs.push(`[Import] Skipping (no amount): "${line.slice(0, 80)}"`);
      skipped++;
      processed--;
      continue;
    }

    // Middle columns = description (handles extra columns from C6 CSV gracefully)
    const desc = parts.slice(1, parts.length - 1).join(' ').trim();
    if (!desc) { skipped++; processed--; continue; }

    const amount = Math.abs(rawAmount);
    const transactionType = classifyFromDesc(desc);

    transactions.push({
      id: uuid(),
      transactionDate: date,
      descriptionOriginal: desc,
      merchantNormalized: normalizeMerchant(desc),
      amount,
      currency: 'BRL',
      transactionType,
      cardName: sourceName,
      cardLastFour: '',
      cardHolder: '',
      cardType: 'principal' as CardType,
      isInstallment: false,
      rawLine: line,
      parsedAt: new Date(),
    });
  }

  logs.push(`[Import] Parsed: ${transactions.length} | Skipped: ${skipped}`);

  return {
    transactions,
    cards: [],
    logs,
    totalLinesProcessed: processed,
    totalSectionsFound: 1,
  };
}
