import { v4 as uuid } from 'uuid';
import type {
  C6Transaction,
  C6CardInfo,
  C6ParseResult,
  C6TransactionType,
  CardType,
} from '@/types/invoice';

// ─── Portuguese month abbreviations ──────────────────────────────────────────

const PT_MONTHS: Record<string, number> = {
  jan: 0, fev: 1, mar: 2, abr: 3, mai: 4, jun: 5,
  jul: 6, ago: 7, set: 8, out: 9, nov: 10, dez: 11,
};
const PT_MONTH_KEYS = Object.keys(PT_MONTHS).join('|');

// ─── Transaction date pattern: "04 jan" or "18 fev" or "17 mar" ──────────────
// Also handles "DD/MM" as fallback
const DATE_PT_RE = new RegExp(
  `^(\\d{1,2})\\s+(${PT_MONTH_KEYS})\\b`,
  'i',
);
const DATE_SLASH_RE = /^(\d{2})\/(\d{2})(?:\/(\d{2,4}))?\s+/;

// ─── Amount pattern: 92,36 or 1.234,56 at end of line ────────────────────────
const BRL_TRAILING_RE = /(\d{1,3}(?:\.\d{3})*,\d{2})\s*$/;

// ─── BRL amount anywhere in line ─────────────────────────────────────────────
const BRL_ANYWHERE_RE = /(\d{1,3}(?:\.\d{3})*,\d{2})/g;

// ─── Card header: "Final XXXX" or "final XXXX" ───────────────────────────────
// Matches: "C6 Black Final 5013", "Cartão C6 Virtual Final 6404", "C6 Final 0295"
const CARD_FINAL_RE = /Final\s+(\d{4})/i;

// ─── Card type indicators ─────────────────────────────────────────────────────
const VIRTUAL_RE = /virtual/i;
const ADICIONAL_RE = /adicional/i;

// ─── Section triggers (lines that start a transaction block) ─────────────────
const SECTION_TRIGGERS: RegExp[] = [
  /transa[cç][oõ]es?\s+do\s+cart[aã]o/i,   // "Transações do cartão principal"
  /compras?\s+e\s+encargos/i,
  /compras?\s+realizadas/i,
  /lan[cç]amentos?\s+do\s+(m[eê]s|cart)/i,
];

// ─── Section enders ───────────────────────────────────────────────────────────
const SECTION_ENDERS: RegExp[] = [
  /subtotal\s+deste\s+cart/i,
  /^total\s+(a\s+pagar|da\s+fatura|do\s+cart)/i,
  /^pagamento\s+(m.nimo|da\s+fatura)/i,
  /^parcelamento\s+(da\s+fatura|em)/i,
  /^encargos\s+financeiros/i,
  /^resumo\s+d[ao]\s+fatura/i,
  /formas\s+de\s+pagamento/i,
  /^confira\s+as\s+op/i,
];

// ─── Lines to always skip as transactions ────────────────────────────────────
const SKIP_LINES: RegExp[] = [
  /pag\s+fatura\s+boleto/i,
  /inclusao\s+de\s+pagamento/i,
  /^pagamento\s+(da\s+fatura|m.nimo|boleto)/i,
  /subtotal\s+deste\s+cart/i,
  /valores\s+em\s+reais/i,
  /cartao\s+virtual/i,              // section label, not a transaction
  /^cart[aã]o\s+virtual$/i,
  /^d[eé]bito\s+autom/i,
  /\bvencimento\b.*\d{2}\/\d{2}/i,
  /\blimite\b.*R\$/i,
  /IOF\s+consolidado/i,
  /^[0-9]{5}\.[0-9]{5}/,            // barcode
];

// ─── Merchant normalization ───────────────────────────────────────────────────

export function normalizeMerchant(raw: string): string {
  return raw
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')   // strip diacritics
    .toUpperCase()
    // Remove parcela suffix
    .replace(/\s*-\s*PARCELA\s+\d+\/\d+/gi, '')
    // Remove IFD* prefix
    .replace(/^IFD\s*[*']\s*/i, 'IFD ')
    // Remove EC * prefix (acquirer code)
    .replace(/^EC\s+\*/i, '')
    // Remove USD exchange rate info
    .replace(/USD\s+[\d.,]+\s*\|\s*COTACAO\s+USD:\s*R\$[\d.,]+/gi, '')
    .replace(/\bUSD\b\s+[\d.,]+/gi, '')
    // Remove corporate suffixes
    .replace(/\s+(SA|S\.A\.?|LTDA|ME|EPP|EIRELI)\b\.?/gi, '')
    // Remove special chars, collapse spaces
    .replace(/[^\w\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

// ─── Transaction type classifier ─────────────────────────────────────────────

function classifyType(description: string): C6TransactionType {
  const n = description.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();

  if (/iof\s*(transacoes?|exterior|internacional|de\s+compra)/i.test(n)) return 'iof';
  if (/\bestorno\b/.test(n)) return 'estorno';
  if (/(pag\s*fat|pag.*fatura|inclusao\s+de\s+pagamento)/i.test(n)) return 'pagamento_fatura';
  if (/(anuidade|tarifa\s+(de\s+saque|cobrada|de\s+servico))/i.test(n)) return 'tarifa';
  if (/(ajuste|credito\s+de)/i.test(n)) return 'ajuste';

  return 'compra';
}

// ─── Date parsing ─────────────────────────────────────────────────────────────

interface DateResult {
  date: Date;
  consumed: number;
}

function extractLeadingDate(line: string, year: number): DateResult | null {
  // Format: "04 jan" or "18 fev"
  const ptMatch = line.match(DATE_PT_RE);
  if (ptMatch) {
    const day = parseInt(ptMatch[1]);
    const month = PT_MONTHS[ptMatch[2].toLowerCase()];
    if (day >= 1 && day <= 31 && month !== undefined) {
      return { date: new Date(year, month, day), consumed: ptMatch[0].length };
    }
  }

  // Fallback: "DD/MM" or "DD/MM/YYYY"
  const slashMatch = line.match(DATE_SLASH_RE);
  if (slashMatch) {
    const day = parseInt(slashMatch[1]);
    const month = parseInt(slashMatch[2]) - 1;
    let y = year;
    if (slashMatch[3]) {
      y = parseInt(slashMatch[3]);
      if (y < 100) y += 2000;
    }
    if (day >= 1 && day <= 31 && month >= 0 && month <= 11) {
      return { date: new Date(y, month, day), consumed: slashMatch[0].length };
    }
  }

  return null;
}

// ─── Single line parser ───────────────────────────────────────────────────────

interface ParsedLine {
  date: Date;
  descriptionOriginal: string;
  merchantNormalized: string;
  amount: number;
  transactionType: C6TransactionType;
  isInstallment: boolean;
  installmentCurrent?: number;
  installmentTotal?: number;
  isIOF: boolean;
  isInternational: boolean;
  rawLine: string;
}

function parseLine(line: string, year: number): ParsedLine | null {
  // Date required
  const dateResult = extractLeadingDate(line, year);
  if (!dateResult) return null;

  let rest = line.slice(dateResult.consumed).trim();
  if (!rest) return null;

  // ── Handle international: "... USD X,XX | Cotação USD: R$X,XX   141,17" ──
  // Strip the USD sub-info and keep the BRL amount at the end
  const isInternational = /USD\s+[\d.,]+\s*\|\s*Cota/i.test(rest) ||
                          /USD\s+[\d.,]+/i.test(rest);
  rest = rest.replace(/USD\s+[\d.,]+\s*\|\s*Cota[çc][aã]o\s+USD:\s*R\$[\d.,]+/gi, '').trim();
  rest = rest.replace(/\bUSD\b\s+[\d.,]+/gi, '').trim();

  // ── Handle IOF line: "... IOF Transações Exterior   4,94" ──
  const isIOF = /IOF\s+Transa[cç][oõ]es?\s+Exterior/i.test(rest);

  // ── Extract amount (last BRL value on the line) ──
  const amtMatch = rest.match(BRL_TRAILING_RE);
  if (!amtMatch) return null;

  const amountStr = amtMatch[1].replace(/\./g, '').replace(',', '.');
  const amount = parseFloat(amountStr);
  if (isNaN(amount) || amount <= 0 || amount >= 500_000) return null;

  // ── Description: everything before the amount ──
  let desc = rest.slice(0, rest.lastIndexOf(amtMatch[1])).trim();

  // Clean IOF label from description
  desc = desc.replace(/\s*-?\s*IOF\s+Transa[cç][oõ]es?\s+Exterior\s*/gi, '').trim();

  // ── Extract parcela: "- Parcela 3/3" or "Parcela 2/3" ──
  let installmentCurrent: number | undefined;
  let installmentTotal: number | undefined;
  let isInstallment = false;

  const parcelaMatch = desc.match(/-?\s*Parcela\s+(\d{1,2})\/(\d{1,2})\s*$/i);
  if (parcelaMatch) {
    installmentCurrent = parseInt(parcelaMatch[1]);
    installmentTotal = parseInt(parcelaMatch[2]);
    if (
      installmentCurrent >= 1 && installmentCurrent <= 36 &&
      installmentTotal >= 1 && installmentTotal <= 36 &&
      installmentCurrent <= installmentTotal
    ) {
      isInstallment = true;
      desc = desc.slice(0, desc.lastIndexOf(parcelaMatch[0])).trim();
    } else {
      installmentCurrent = undefined;
      installmentTotal = undefined;
    }
  }

  // Clean trailing dash, spaces, - CP suffixes
  desc = desc.replace(/\s*-\s*CP\s*$/i, '').replace(/[-–—\s]+$/, '').trim();

  if (!desc || desc.length < 2) return null;

  // Skip known boilerplate descriptions
  if (SKIP_LINES.some(re => re.test(desc))) return null;

  const transactionType = isIOF ? 'iof' : classifyType(desc);
  const merchantNormalized = normalizeMerchant(desc);

  return {
    date: dateResult.date,
    descriptionOriginal: desc,
    merchantNormalized,
    amount,
    transactionType,
    isInstallment,
    installmentCurrent,
    installmentTotal,
    isIOF,
    isInternational,
    rawLine: line,
  };
}

// ─── Card header detection ────────────────────────────────────────────────────

function detectCardFromLine(line: string): C6CardInfo | null {
  const finalMatch = line.match(CARD_FINAL_RE);
  if (!finalMatch) return null;

  const lastFour = finalMatch[1];
  const type: CardType = VIRTUAL_RE.test(line) ? 'virtual' :
                         ADICIONAL_RE.test(line) ? 'adicional' : 'principal';

  // Extract name: everything before " – NOME" or just the line up to holder
  const dashIdx = line.indexOf('–');
  const name = (dashIdx > 0 ? line.slice(0, dashIdx) : line)
    .replace(/Final\s+\d{4}/i, '').trim() || `Cartão C6 **** ${lastFour}`;

  const holder = dashIdx > 0 ? line.slice(dashIdx + 1).trim() : 'GUSTAVO SENNA';

  return { name: name.trim(), lastFour, holder, type };
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
    // Strip leading PDF artifacts: ||, □, ☐, §, ·, |, non-printable chars
    .map(l => l.replace(/^[\s|□☐§·\u0000-\u001f\u007f]+/, '').trim())
    .filter(l => l.length > 1);

  logs.push(`[Parser] Total lines: ${lines.length}`);

  // ── Pass 1: detect all card headers ─────────────────────────────────────────
  for (let i = 0; i < lines.length; i++) {
    const card = detectCardFromLine(lines[i]);
    if (card && !cards.find(c => c.lastFour === card.lastFour)) {
      cards.push(card);
      logs.push(`[Parser] Card: ${card.name} (${card.type}) **** ${card.lastFour}`);
    }
  }
  logs.push(`[Parser] Cards found: ${cards.length}`);

  // ── Pass 2: section-aware extraction ────────────────────────────────────────
  let currentCard: C6CardInfo | null = null;
  let inSection = false;
  let sectionCount = 0;
  let lineCount = 0;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];

    // Check for card header — update current card context
    const cardHit = detectCardFromLine(line);
    if (cardHit) {
      currentCard = cards.find(c => c.lastFour === cardHit.lastFour) ?? cardHit;
      // Card headers also end the previous section
      inSection = false;
      continue;
    }

    // Check for section start
    if (SECTION_TRIGGERS.some(re => re.test(line))) {
      inSection = true;
      sectionCount++;
      logs.push(`[Parser] Section started at line ${i}: "${line.slice(0, 60)}"`);
      continue;
    }

    // Check for section end
    if (inSection && SECTION_ENDERS.some(re => re.test(line))) {
      inSection = false;
      logs.push(`[Parser] Section ended at line ${i}: "${line.slice(0, 60)}"`);
      continue;
    }

    if (!inSection) continue;

    // Skip boilerplate
    if (SKIP_LINES.some(re => re.test(line))) {
      logs.push(`[Parser] Skipped: "${line.slice(0, 60)}"`);
      continue;
    }

    lineCount++;

    // Log first 60 lines inside sections for debugging
    if (lineCount <= 60) {
      logs.push(`[Section line ${lineCount}] "${line.slice(0, 100)}"`);
    }

    const parsed = parseLine(line, year);
    if (!parsed) {
      if (lineCount <= 60) logs.push(`  → no match (date or amount not found)`);
      continue;
    }
    if (parsed.transactionType === 'pagamento_fatura') {
      logs.push(`  → skipped (pagamento_fatura)`);
      continue;
    }

    const card = currentCard ?? cards[0] ?? {
      name: 'Cartão C6', lastFour: '????', holder: '', type: 'principal' as CardType,
    };

    transactions.push(buildTransaction(parsed, card));
  }

  logs.push(`[Parser] Section pass: ${transactions.length} from ${lineCount} lines in ${sectionCount} sections`);

  // ── Fallback: no section found → scan all lines with date ───────────────────
  if (transactions.length === 0) {
    logs.push('[Parser] Fallback: scanning all lines for date patterns');

    let fallbackCard = cards[0] ?? {
      name: 'Cartão C6', lastFour: '????', holder: '', type: 'principal' as CardType,
    };

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];

      // Update card context
      const cardHit = detectCardFromLine(line);
      if (cardHit) {
        fallbackCard = cards.find(c => c.lastFour === cardHit.lastFour) ?? cardHit;
        continue;
      }

      // Must start with a date
      if (!DATE_PT_RE.test(line) && !DATE_SLASH_RE.test(line)) continue;

      // Skip hard boilerplate
      if (SKIP_LINES.some(re => re.test(line))) continue;

      // Skip section headers / card summary lines
      if (SECTION_TRIGGERS.some(re => re.test(line))) continue;
      if (SECTION_ENDERS.some(re => re.test(line))) continue;
      if (CARD_FINAL_RE.test(line)) continue;

      const parsed = parseLine(line, year);
      if (!parsed) continue;
      if (parsed.transactionType === 'pagamento_fatura') continue;

      transactions.push(buildTransaction(parsed, fallbackCard));
    }

    logs.push(`[Parser] Fallback extracted: ${transactions.length} transactions`);
  }

  // ── Deduplication ────────────────────────────────────────────────────────────
  const seen = new Set<string>();
  const deduped = transactions.filter(t => {
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

  if (deduped.length < transactions.length) {
    logs.push(`[Parser] Removed ${transactions.length - deduped.length} internal duplicates`);
  }

  return {
    transactions: deduped,
    cards,
    logs,
    totalLinesProcessed: lineCount || lines.filter(l => DATE_PT_RE.test(l) || DATE_SLASH_RE.test(l)).length,
    totalSectionsFound: sectionCount,
  };
}

function buildTransaction(parsed: ParsedLine, card: C6CardInfo): C6Transaction {
  return {
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
  };
}

// ─── Helpers (used by ImportPage) ─────────────────────────────────────────────

export function detectCompetencia(text: string): string | undefined {
  // "Período DD/MM/YYYY a DD/MM/YYYY"
  const periodMatch = text.match(/[Pp]er[ií]odo[:\s]+\d{2}\/\d{2}\/(\d{4})\s+a\s+\d{2}\/(\d{2})\/(\d{4})/);
  if (periodMatch) return `${periodMatch[3]}-${periodMatch[2].padStart(2, '0')}`;

  // "vencimento: 25 de Março" or "vencimento: 25/03/2026"
  const vencMatch = text.match(/[Vv]encimento[:\s]+\d{2}\s+de\s+(\w+)/i);
  if (vencMatch) {
    const monthName = vencMatch[1].toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
    const monthMap: Record<string, number> = {
      janeiro: 1, fevereiro: 2, marco: 3, abril: 4, maio: 5, junho: 6,
      julho: 7, agosto: 8, setembro: 9, outubro: 10, novembro: 11, dezembro: 12,
    };
    const monthNum = monthMap[monthName];
    if (monthNum) {
      const year = new Date().getFullYear();
      const prevMonth = monthNum === 1 ? 12 : monthNum - 1;
      const prevYear = monthNum === 1 ? year - 1 : year;
      return `${prevYear}-${String(prevMonth).padStart(2, '0')}`;
    }
  }

  return undefined;
}

export async function hashFile(arrayBuffer: ArrayBuffer): Promise<string> {
  const hashBuffer = await crypto.subtle.digest('SHA-256', arrayBuffer);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map(b => b.toString(16).padStart(2, '0')).join('').slice(0, 16);
}
