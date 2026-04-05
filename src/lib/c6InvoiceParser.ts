import { v4 as uuid } from 'uuid';
import type {
  C6Transaction,
  C6CardInfo,
  C6ParseResult,
  C6TransactionType,
  CardType,
} from '@/types/invoice';

// ─── Constants ────────────────────────────────────────────────────────────────

/** Lines matching these patterns are boilerplate — never parsed as transactions */
const BOILERPLATE_PATTERNS: RegExp[] = [
  /^total\s+(a\s+pagar|da\s+fatura|do\s+cart|cart.o)/i,
  /^pagamento\s+(da\s+fatura|m.nimo|boleto)/i,
  /^pag\s+fatura/i,
  /^inclusao\s+de\s+pagamento/i,
  /^limite\s+(total|dispon)/i,
  /^saldo\s+(anterior|final)/i,
  /^encargos\s+financeiros/i,
  /^parcelamento\s+da\s+fatura/i,
  /^resumo\s+d[ao]\s+fatura/i,
  /^fatura\s+(anterior|atual|do\s+cart)/i,
  /^emiss.o|vencimento|per.odo/i,
  /^c.digo\s+de\s+barras/i,
  /^[0-9]{5}\.[0-9]{5}\s/,               // Barcode lines
  /^IOF\s+consolidado/i,
  /^subtotal\s+cart/i,
  /^taxa\s+(efetiva|de\s+juros)/i,
  /^rotativo/i,
  /^credito\s+rotativo/i,
  /^detal(he|hes)\s+da\s+cobran/i,
];

/** These section titles signal the START of a transaction block */
const TRANSACTION_SECTION_TRIGGERS: RegExp[] = [
  /compras?\s+e\s+encargos/i,
  /compras?\s+no\s+(brasil|exterior)/i,
  /lan[cç]amentos?/i,
  /transa[cç][oõ]es?\s+do\s+m[eê]s/i,
  // C6 variations
  /compras\s+realizadas/i,
  /lista\s+de\s+(compras|transa)/i,
  /suas\s+compras/i,
  /extrato\s+de\s+compras/i,
  /movimenta[çc][aã]o/i,
];

/** These lines signal the END of a transaction block */
const TRANSACTION_SECTION_ENDERS: RegExp[] = [
  /^total\s+cart/i,
  /^total\s+de\s+compras/i,
  /^subtotal/i,
  /^pagamento\s+m.nimo/i,
  /^parcelamento/i,
  /^encargos/i,
  /^IOF\s+consolidado/i,
  /^resumo/i,
  /^detal(he|hes)/i,
  /formas\s+de\s+pagamento/i,
];

/** Line starts with a transaction date: DD/MM or DD/MM/YYYY */
const DATE_LEADING_RE = /^(\d{2})\/(\d{2})(?:\/(\d{2,4}))?\s+/;

/** Brazilian currency at end of line: 1.234,56 or 234,56 */
const BRL_TRAILING_RE = /(\d{1,3}(?:\.\d{3})*,\d{2})\s*$/;

/** Installment pattern inside description: "01/06" or "1/6" */
const INSTALLMENT_RE = /\b(\d{1,2})\/(\d{1,2})\b(?=\s*$|\s+\d)/;

/** Card section header: CARTÃO ... **** XXXX or •••• XXXX */
const CARD_HEADER_RE = /CART[ÃA]O\b/i;

/** Card number pattern (last 4 digits) */
const CARD_NUMBER_RE = /(?:\*{4}|•{4}|x{4})\s*(\d{4})\b/i;

// ─── Normalization ────────────────────────────────────────────────────────────

/** Remove accents, uppercase, collapse spaces */
export function normalizeMerchant(raw: string): string {
  return raw
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')   // strip diacritics
    .toUpperCase()
    // Remove C6 international sub-values: "USD 26,75 | Cotação USD: R$5,54"
    .replace(/USD\s+[\d.,]+\s*\|\s*COTACAO\s+USD:\s*R\$[\d.,]+/gi, '')
    // Remove masked card segments
    .replace(/[*•]{2,}[\d*•./\-]+/g, '')
    // Remove CNPJ / CPF
    .replace(/\d{2}\.\d{3}\.\d{3}\/\d{4}-?\d{0,2}/g, '')
    .replace(/\d{3}\.\d{3}\.\d{3}-\d{2}/g, '')
    // Remove trailing installment that may remain
    .replace(/\s+\d{2}\/\d{2}\s*$/, '')
    // Remove trailing country code (2-letter)
    .replace(/\s+[A-Z]{2}\s*$/, '')
    // Remove IFD* prefix (iFood transactions)
    .replace(/^IFD\s*\*/i, 'IFD ')
    // Remove common suffixes added by acquirer/card network
    .replace(/\s+(SA|S\.A\.?|LTDA|ME|EPP|EIRELI)\b\.?/gi, '')
    // Collapse whitespace and special chars
    .replace(/[^\w\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

// ─── Transaction type classifier ─────────────────────────────────────────────

function classifyType(description: string): C6TransactionType {
  const n = description.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();

  if (/iof\s*(transacoes?|exterior|internacional|de\s+compra)/i.test(n)) return 'iof';
  if (/\bestorno\b/.test(n)) return 'estorno';
  if (/\b(pag\s+fat|pag.*fatura|pagamento\s+fat|inclusao\s+de\s+pagamento)\b/.test(n)) return 'pagamento_fatura';
  if (/\b(anuidade|tarifa|taxa\s+(de\s+saque|cobrada|de\s+servico))\b/.test(n)) return 'tarifa';
  if (/\b(ajuste|estorno\s+de\s+anuidade|credito\s+de)\b/.test(n)) return 'ajuste';

  return 'compra';
}

// ─── Line parser ──────────────────────────────────────────────────────────────

interface ParsedLine {
  date: Date;
  descriptionOriginal: string;
  merchantNormalized: string;
  amount: number;
  transactionType: C6TransactionType;
  isInstallment: boolean;
  installmentCurrent?: number;
  installmentTotal?: number;
  rawLine: string;
}

function parseLine(line: string, defaultYear: number): ParsedLine | null {
  const dateMatch = line.match(DATE_LEADING_RE);
  if (!dateMatch) return null;

  const day = parseInt(dateMatch[1]);
  const month = parseInt(dateMatch[2]) - 1;
  let year = defaultYear;
  if (dateMatch[3]) {
    year = parseInt(dateMatch[3]);
    if (year < 100) year += 2000;
  }

  if (day < 1 || day > 31 || month < 0 || month > 11) return null;

  const rest = line.slice(dateMatch[0].length).trim();
  const amtMatch = rest.match(BRL_TRAILING_RE);
  if (!amtMatch) return null;

  const amountStr = amtMatch[1].replace(/\./g, '').replace(',', '.');
  const amount = parseFloat(amountStr);
  if (isNaN(amount) || amount <= 0 || amount >= 500_000) return null;

  // Description is everything before the amount
  let desc = rest.slice(0, rest.lastIndexOf(amtMatch[1])).trim();

  // Extract installment from end of description
  let installmentCurrent: number | undefined;
  let installmentTotal: number | undefined;
  let isInstallment = false;

  const instMatch = desc.match(/\s+(\d{1,2})\/(\d{1,2})\s*$/);
  if (instMatch) {
    installmentCurrent = parseInt(instMatch[1]);
    installmentTotal = parseInt(instMatch[2]);
    // Only treat as installment if both numbers are plausible (1-36)
    if (
      installmentCurrent >= 1 && installmentCurrent <= 36 &&
      installmentTotal >= 1 && installmentTotal <= 36 &&
      installmentCurrent <= installmentTotal
    ) {
      isInstallment = true;
      desc = desc.slice(0, desc.lastIndexOf(instMatch[0])).trim();
    } else {
      // Reset — it was part of the description, not an installment
      installmentCurrent = undefined;
      installmentTotal = undefined;
    }
  }

  if (!desc || desc.length < 2) return null;

  // Skip boilerplate descriptions
  if (BOILERPLATE_PATTERNS.some(re => re.test(desc))) return null;

  const transactionType = classifyType(desc);
  const merchantNormalized = normalizeMerchant(desc);

  return {
    date: new Date(year, month, day),
    descriptionOriginal: desc,
    merchantNormalized,
    amount,
    transactionType,
    isInstallment,
    installmentCurrent,
    installmentTotal,
    rawLine: line,
  };
}

// ─── Card section detector ────────────────────────────────────────────────────

interface CardContext {
  info: C6CardInfo;
  sectionActive: boolean;
}

function detectCardHeader(lines: string[], startIdx: number): C6CardInfo | null {
  const window = lines.slice(startIdx, startIdx + 4).join(' ');
  if (!CARD_HEADER_RE.test(window)) return null;

  const numMatch = window.match(CARD_NUMBER_RE);
  if (!numMatch) return null;
  const lastFour = numMatch[1];

  // Determine card type
  let type: CardType = 'principal';
  const wl = window.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
  if (wl.includes('virtual')) type = 'virtual';
  else if (wl.includes('adicional')) type = 'adicional';

  // Extract card name (line containing CARTÃO)
  const nameLine = lines.slice(startIdx, startIdx + 3).find(l => CARD_HEADER_RE.test(l)) ?? '';
  const name = nameLine
    .replace(CARD_NUMBER_RE, '')
    .replace(CARD_HEADER_RE, 'CARTÃO')
    .replace(/[*•]+/g, '')
    .replace(/\s+/g, ' ')
    .trim() || `Cartão **** ${lastFour}`;

  // Holder is typically the line after the card number line
  const cardLineIdx = lines.slice(startIdx, startIdx + 4).findIndex(l => CARD_NUMBER_RE.test(l));
  const holder = (cardLineIdx >= 0 && lines[startIdx + cardLineIdx + 1])
    ? lines[startIdx + cardLineIdx + 1].trim()
    : '';

  return { name, lastFour, holder, type };
}

// ─── Main parser ──────────────────────────────────────────────────────────────

export function parseC6Invoice(
  rawText: string,
  defaultYear?: number,
): C6ParseResult {
  const year = defaultYear ?? new Date().getFullYear();
  const logs: string[] = [];
  const cards: C6CardInfo[] = [];
  const transactions: C6Transaction[] = [];

  const lines = rawText
    .replace(/\r\n/g, '\n')
    .replace(/\r/g, '\n')
    .split('\n')
    .map(l => l.trim())
    .filter(l => l.length > 1);

  logs.push(`[Parser] Total lines: ${lines.length}`);

  // ── Pass 1: identify card boundaries ────────────────────────────────────────
  // We detect card headers and build a list of (lineIndex → C6CardInfo)
  const cardAtLine: Map<number, C6CardInfo> = new Map();

  for (let i = 0; i < lines.length; i++) {
    const info = detectCardHeader(lines, i);
    if (info && !cardAtLine.has(i)) {
      cardAtLine.set(i, info);
      const existing = cards.find(c => c.lastFour === info.lastFour);
      if (!existing) {
        cards.push(info);
        logs.push(`[Parser] Card detected: ${info.name} **** ${info.lastFour} (${info.type})`);
      }
    }
  }

  logs.push(`[Parser] Cards found: ${cards.length}`);

  // ── Pass 2: section-aware transaction extraction ─────────────────────────────
  let currentCard: C6CardInfo | null = null;
  let inTransactionSection = false;
  let sectionCount = 0;
  let lineCount = 0;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];

    // Check for card header
    if (cardAtLine.has(i)) {
      currentCard = cardAtLine.get(i)!;
      inTransactionSection = false;
      continue;
    }

    // Check for transaction section start
    if (TRANSACTION_SECTION_TRIGGERS.some(re => re.test(line))) {
      inTransactionSection = true;
      sectionCount++;
      logs.push(`[Parser] Transaction section started at line ${i}: "${line.slice(0, 50)}"`);
      continue;
    }

    // Check for section end
    if (inTransactionSection && TRANSACTION_SECTION_ENDERS.some(re => re.test(line))) {
      inTransactionSection = false;
      logs.push(`[Parser] Transaction section ended at line ${i}: "${line.slice(0, 50)}"`);
      continue;
    }

    if (!inTransactionSection) continue;
    lineCount++;

    // Try to parse as transaction
    const parsed = parseLine(line, year);
    if (!parsed) continue;

    // Skip payment-type transactions (pagamento_fatura) — they're not real expenses
    if (parsed.transactionType === 'pagamento_fatura') {
      logs.push(`[Parser] Skipped payment line: "${line.slice(0, 60)}"`);
      continue;
    }

    const card = currentCard ?? cards[0] ?? {
      name: 'Cartão Principal',
      lastFour: '????',
      holder: '',
      type: 'principal' as CardType,
    };

    transactions.push({
      id: uuid(),
      transactionDate: parsed.date,
      descriptionOriginal: parsed.descriptionOriginal,
      merchantNormalized: parsed.merchantNormalized,
      amount: parsed.amount,
      currency: 'BRL',
      transactionType: parsed.transactionType,
      cardName: card.name,
      cardLastFour: card.lastFour,
      cardHolder: card.holder,
      cardType: card.type,
      isInstallment: parsed.isInstallment,
      installmentCurrent: parsed.installmentCurrent,
      installmentTotal: parsed.installmentTotal,
      rawLine: parsed.rawLine,
      parsedAt: new Date(),
    });
  }

  logs.push(`[Parser] Transactions extracted: ${transactions.length} from ${lineCount} lines in ${sectionCount} sections`);

  // ── Fallback: section-agnostic scan ─────────────────────────────────────────
  // If the section-aware pass found nothing, scan ALL non-boilerplate lines
  // that look like "DD/MM description amount". This handles C6 PDFs where the
  // section headers don't match any known trigger.
  if (transactions.length === 0) {
    logs.push('[Parser] No sections found — activating fallback (direct date scan)');

    // Build a strong boilerplate set for the fallback
    const STRONG_BOILERPLATE = [
      ...BOILERPLATE_PATTERNS,
      /^\d{5}\.\d{5}/,             // barcode numbers
      /cart[aã]o\s+(c6|mastercard|visa|elo)/i,
      /titular/i,
      /compras?\s+e\s+encargos/i,
      /vencimento/i,
      /limite/i,
      /pagamento/i,
      /fatura/i,
      /^c6\s+bank/i,
    ];

    const fallbackCard = cards[0] ?? {
      name: 'Cartão C6',
      lastFour: '????',
      holder: '',
      type: 'principal' as CardType,
    };

    for (const line of lines) {
      // Must start with a date
      if (!DATE_LEADING_RE.test(line)) continue;

      // Must not be boilerplate
      if (STRONG_BOILERPLATE.some(re => re.test(line))) continue;

      const parsed = parseLine(line, year);
      if (!parsed) continue;
      if (parsed.transactionType === 'pagamento_fatura') continue;

      // Use current card or default
      const card = cards.find(c =>
        line.includes(c.lastFour) || line.toLowerCase().includes(c.cardHolder?.toLowerCase())
      ) ?? fallbackCard;

      transactions.push({
        id: uuid(),
        transactionDate: parsed.date,
        descriptionOriginal: parsed.descriptionOriginal,
        merchantNormalized: parsed.merchantNormalized,
        amount: parsed.amount,
        currency: 'BRL',
        transactionType: parsed.transactionType,
        cardName: (card as any).name ?? fallbackCard.name,
        cardLastFour: (card as any).lastFour ?? fallbackCard.lastFour,
        cardHolder: (card as any).holder ?? fallbackCard.holder,
        cardType: (card as any).type ?? fallbackCard.type,
        isInstallment: parsed.isInstallment,
        installmentCurrent: parsed.installmentCurrent,
        installmentTotal: parsed.installmentTotal,
        rawLine: parsed.rawLine,
        parsedAt: new Date(),
      });
    }

    logs.push(`[Parser] Fallback extracted: ${transactions.length} transactions`);
  }
  const seen = new Set<string>();
  const deduplicated = transactions.filter(t => {
    const key = [
      t.transactionDate.toISOString().slice(0, 10),
      t.merchantNormalized,
      t.amount.toFixed(2),
      t.isInstallment ? `${t.installmentCurrent}/${t.installmentTotal}` : '',
    ].join('|');
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });

  if (deduplicated.length < transactions.length) {
    logs.push(`[Parser] Removed ${transactions.length - deduplicated.length} internal duplicates`);
  }

  return {
    transactions: deduplicated,
    cards,
    logs,
    totalLinesProcessed: lineCount,
    totalSectionsFound: sectionCount,
  };
}

// ─── Text extraction helper (used by ImportPage) ─────────────────────────────

/**
 * Attempts to detect invoice competencia (month/year) from extracted text.
 * Returns 'YYYY-MM' or undefined.
 */
export function detectCompetencia(text: string): string | undefined {
  // "Período DD/MM/YYYY a DD/MM/YYYY" — use the end date
  const periodMatch = text.match(/[Pp]er[ií]odo[:\s]+\d{2}\/\d{2}\/(\d{4})\s+a\s+\d{2}\/(\d{2})\/(\d{4})/);
  if (periodMatch) {
    return `${periodMatch[3]}-${periodMatch[2].padStart(2, '0')}`;
  }

  // "Vencimento DD/MM/YYYY"
  const vencMatch = text.match(/[Vv]encimento[:\s]+\d{2}\/(\d{2})\/(\d{4})/);
  if (vencMatch) {
    const month = parseInt(vencMatch[1]);
    const year = parseInt(vencMatch[2]);
    // Due date is typically the month after the transactions; subtract 1
    const prevMonth = month === 1 ? 12 : month - 1;
    const prevYear = month === 1 ? year - 1 : year;
    return `${prevYear}-${String(prevMonth).padStart(2, '0')}`;
  }

  return undefined;
}

/**
 * Simple hash of file content for deduplication.
 */
export async function hashFile(arrayBuffer: ArrayBuffer): Promise<string> {
  const hashBuffer = await crypto.subtle.digest('SHA-256', arrayBuffer);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map(b => b.toString(16).padStart(2, '0')).join('').slice(0, 16);
}
