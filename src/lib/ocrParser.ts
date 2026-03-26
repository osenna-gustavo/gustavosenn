import type { SuggestedTransaction, Category, TransactionType } from '@/types/finance';
import { v4 as uuid } from 'uuid';

// ─── Category keyword map ────────────────────────────────────────────────────

const CATEGORY_KEYWORDS: Record<string, string[]> = {
  'Alimentação': [
    'restaurante', 'lanchonete', 'mercado', 'supermercado', 'padaria',
    'ifood', 'ifd*', 'uber eats', 'rappi', 'açougue', 'hortifruti',
    'pizzaria', 'hamburguer', 'sushi', 'delivery', 'acai', 'sorveteria',
  ],
  'Transporte': [
    'uber', '99app', '99pop', 'combustivel', 'gasolina', 'etanol',
    'estacionamento', 'pedagio', 'onibus', 'metro', 'taxi', 'posto',
    'shell', 'petrobras', 'ipiranga', 'br mania', 'automob',
  ],
  'Moradia': [
    'aluguel', 'condominio', 'iptu', 'energia', 'enel', 'cemig', 'copel',
    'agua', 'sabesp', 'copasa', 'gas', 'internet', 'vivo', 'claro',
    'tim', 'oi fixo', 'net combo',
  ],
  'Saúde': [
    'farmacia', 'drogaria', 'droga', 'medico', 'consulta', 'exame',
    'hospital', 'clinica', 'laboratorio', 'plano de saude', 'unimed',
    'amil', 'sulamerica', 'hapvida', 'drogasil', 'raia', 'pacheco',
  ],
  'Lazer': [
    'cinema', 'teatro', 'show', 'netflix', 'spotify', 'amazon prime',
    'disney', 'hbo', 'bar', 'balada', 'parque', 'ingresso',
    'globoplay', 'paramount', 'deezer', 'youtube premium',
  ],
  'Educação': [
    'escola', 'faculdade', 'curso', 'livro', 'material escolar',
    'colegio', 'universidade', 'udemy', 'alura', 'mensalidade escolar',
  ],
  'Compras': [
    'loja', 'shopping', 'roupa', 'calcado', 'eletronico', 'eletrodomestico',
    'movel', 'magazine', 'renner', 'riachuelo', 'cea', 'americanas',
    'shoptime', 'amazon', 'mercado livre', 'shein', 'zara', 'hm',
  ],
  'Assinaturas': [
    'assinatura', 'applecombill', 'apple.com', 'ebn *spotify', 'clube livelo',
    'microsoft', 'google storage', 'adobe', 'canva',
  ],
  'Contas/Taxas': [
    'taxa', 'tarifa', 'anuidade', 'iof', 'juros', 'multa', 'imposto',
    'ipva', 'licenciamento',
  ],
  'Salário': [
    'salario', 'salário', 'remuneracao', 'holerite', 'contracheque', 'clt',
  ],
  'Renda Extra': [
    'freelance', 'bonus', 'bônus', 'comissao', 'dividendo', 'rendimento',
    'transferencia recebida', 'pix recebido',
  ],
};

// ─── Exclusion keywords (non-transaction text) ───────────────────────────────

const EXCLUSION_KEYWORDS = [
  'saldo anterior', 'saldo final', 'saldo em', 'saldo disponivel',
  'limite total', 'limite disponivel', 'limite de credito',
  'saque no credito', 'saque no debito',
  'pix no credito', 'pix no debito',
  'total de compras', 'total da fatura', 'total de lancamentos',
  'total de todos', 'total dos cartoes',
  'resumo da fatura', 'resumo do extrato',
  'pagamento minimo', 'valor minimo', 'pagamento em ',
  'sua fatura', 'fatura de ', 'fatura do cartao',
  'emissao da fatura', 'data de vencimento', 'vencimento:',
  'alternativas de pagamento', 'formas de pagamento', 'codigo de barras',
  'olá,', 'ola,', 'prezado', 'prezada',
  'crédito rotativo', 'credito rotativo', 'juros rotativos',
  'encargos financeiros', 'taxa efetiva', 'taxa de juros',
  'de fev a ', 'de mar a ', 'de jan a ', 'de abr a ',
  'de mai a ', 'de jun a ', 'de jul a ', 'de ago a ',
  'de set a ', 'de out a ', 'de nov a ', 'de dez a ',
];

// ─── Month abbr → index ──────────────────────────────────────────────────────

const MONTH_ABBR: Record<string, number> = {
  jan: 0, fev: 1, mar: 2, abr: 3, mai: 4, jun: 5,
  jul: 6, ago: 7, set: 8, out: 9, nov: 10, dez: 11,
};

const MONTH_KEYS = Object.keys(MONTH_ABBR).join('|'); // "jan|fev|mar|..."

interface ParsedItem {
  amount: number;
  date: Date;
  description: string;
  rawLine: string;
  isIncome: boolean;
}

// ─── Main entry point ────────────────────────────────────────────────────────

export function parseOCRText(text: string, categories: Category[]): SuggestedTransaction[] {
  const currentYear = new Date().getFullYear();

  // Normalise: standardise line endings + trim each line
  const byLines = text
    .replace(/\r\n/g, '\n').replace(/\r/g, '\n')
    .split('\n')
    .map(l => l.trim())
    .filter(l => l.length > 0);

  // ── Strategy 1: line-by-line (works when PDF preserves per-row text) ──
  const lineResults: ParsedItem[] = [];
  for (const line of byLines) {
    if (!lineStartsWithDate(line)) continue;
    if (containsExclusionKeyword(line)) continue;
    const item = parseTransactionLine(line, currentYear);
    if (item) lineResults.push(item);
  }

  // ── Strategy 2: chunk-based (works when PDF extracts one big flat string) ──
  // Flatten all lines into one string, then scan for date anchors
  const flatText = byLines.join(' ');
  const chunkResults: ParsedItem[] = parseChunks(flatText, currentYear);

  // Pick the strategy that found more results
  const raw = chunkResults.length > lineResults.length ? chunkResults : lineResults;

  // Filter + map to SuggestedTransaction
  const seen = new Set<string>();
  const results: SuggestedTransaction[] = [];

  for (const item of raw) {
    if (containsExclusionKeyword(item.rawLine.toLowerCase())) continue;
    if (containsExclusionKeyword(item.description.toLowerCase())) continue;

    // Deduplicate: same amount + same normalised description
    const key = `${item.amount.toFixed(2)}|${item.description.toLowerCase().trim()}`;
    if (seen.has(key)) continue;
    seen.add(key);

    const { categoryId, type } = suggestCategory(item.description, categories, item.isIncome);

    results.push({
      id: uuid(),
      date: item.date,
      amount: item.amount,
      type,
      description: item.description.slice(0, 100),
      suggestedCategoryId: categoryId,
      confirmed: false,
      needsReview: !categoryId,
      rawText: item.rawLine,
    });
  }

  return results;
}

// ─── Strategy 1: line-by-line ────────────────────────────────────────────────

function lineStartsWithDate(line: string): boolean {
  if (/^\d{2}[\/\-]\d{2}([\/\-]\d{2,4})?/.test(line)) return true;
  if (new RegExp(`^\\d{2}\\s+(${MONTH_KEYS})\\b`, 'i').test(line)) return true;
  return false;
}

function parseTransactionLine(line: string, currentYear: number): ParsedItem | null {
  const dateResult = extractLeadingDate(line, currentYear);
  if (!dateResult) return null;

  const rest = line.slice(dateResult.consumed).trim();
  const amtResult = extractAmount(rest);
  if (!amtResult) return null;

  const description = cleanDescription(amtResult.descriptionRaw);
  if (!description || description.length < 2 || description.length > 70) return null;

  return {
    amount: amtResult.amount,
    date: dateResult.date,
    description,
    rawLine: line,
    isIncome: amtResult.isIncome,
  };
}

// ─── Strategy 2: chunk-based ─────────────────────────────────────────────────

function parseChunks(flatText: string, currentYear: number): ParsedItem[] {
  // Combined date regex that captures both DD/MM[/YYYY] and DD MMM [YYYY]
  const DATE_RE = new RegExp(
    `(?<![\\d])` + // not preceded by digit (avoid matching inside amounts)
    `(\\d{2})[\\s\\/\\-](${MONTH_KEYS}|\\d{2})(?:[\\s\\/\\-](\\d{2,4}))?` +
    `(?![\\d])`, // not followed by digit
    'gi',
  );

  // Collect all date match positions
  interface DateAnchor { index: number; end: number; date: Date }
  const anchors: DateAnchor[] = [];
  let m: RegExpExecArray | null;
  DATE_RE.lastIndex = 0;

  while ((m = DATE_RE.exec(flatText)) !== null) {
    const date = parseDateFromGroups(m[1], m[2], m[3], currentYear);
    if (!date) continue;

    // Skip dates that are part of a range expression ("de DD MAR a", "a 20 FEV")
    if (dateIsInRange(flatText, m.index)) continue;

    anchors.push({ index: m.index, end: m.index + m[0].length, date });
  }

  const results: ParsedItem[] = [];

  for (let i = 0; i < anchors.length; i++) {
    const a = anchors[i];
    const nextIndex = anchors[i + 1]?.index ?? flatText.length;

    // Window: from end of date token up to next date anchor (max 180 chars)
    const windowEnd = Math.min(nextIndex, a.end + 180);
    const window = flatText.slice(a.end, windowEnd);

    if (containsExclusionKeyword(window.toLowerCase())) continue;

    const amtResult = extractAmount(window);
    if (!amtResult) continue;

    const description = cleanDescription(amtResult.descriptionRaw);
    if (!description || description.length < 3 || description.length > 70) continue;

    results.push({
      amount: amtResult.amount,
      date: a.date,
      description,
      rawLine: flatText.slice(a.index, windowEnd),
      isIncome: amtResult.isIncome,
    });
  }

  return results;
}

// ─── Date helpers ─────────────────────────────────────────────────────────────

function extractLeadingDate(
  line: string,
  currentYear: number,
): { date: Date; consumed: number } | null {
  // DD/MM or DD/MM/YY or DD/MM/YYYY
  const slashM = line.match(/^(\d{2})[\/\-](\d{2})(?:[\/\-](\d{2,4}))?/);
  if (slashM) {
    const date = parseDateFromGroups(slashM[1], slashM[2], slashM[3], currentYear);
    if (date) return { date, consumed: slashM[0].length };
  }
  // DD MMM [YYYY]
  const monthM = line.match(new RegExp(`^(\\d{2})\\s+(${MONTH_KEYS})(?:\\s+(\\d{4}))?`, 'i'));
  if (monthM) {
    const date = parseDateFromGroups(monthM[1], monthM[2], monthM[3], currentYear);
    if (date) return { date, consumed: monthM[0].length };
  }
  return null;
}

function parseDateFromGroups(
  dayStr: string,
  monthStr: string,
  yearStr: string | undefined,
  currentYear: number,
): Date | null {
  const day = parseInt(dayStr);
  if (day < 1 || day > 31) return null;

  let month: number;
  const monthLower = monthStr.toLowerCase();
  if (MONTH_ABBR[monthLower] !== undefined) {
    month = MONTH_ABBR[monthLower];
  } else {
    month = parseInt(monthStr) - 1;
    if (month < 0 || month > 11) return null;
  }

  let year = currentYear;
  if (yearStr) {
    year = parseInt(yearStr);
    if (year < 100) year += 2000;
  }

  return new Date(year, month, day);
}

/**
 * Returns true if the date at `index` in `text` appears to be part of a
 * period-range expression like "de 20 FEV a 20 MAR" or "20/FEV a 20/MAR".
 */
function dateIsInRange(text: string, index: number): boolean {
  const before = text.slice(Math.max(0, index - 8), index).toLowerCase();
  // Preceded by " de ", " a " or just "de" / "a" at start
  return /\bde\s+$/.test(before) || /\ba\s+$/.test(before);
}

// ─── Amount extractor ─────────────────────────────────────────────────────────

interface AmountResult {
  amount: number;
  isIncome: boolean;
  descriptionRaw: string;
}

/**
 * Finds the LAST BRL-formatted value in `text`.
 * Handles optional R$ prefix, +/- or C/D suffix/prefix.
 */
function extractAmount(text: string): AmountResult | null {
  // Matches: optional sign + optional R$ + digits with BRL decimal format
  const pattern = /([+\-]?\s*|[CD]\s+)?(?:R\$\s*)?([\d]{1,3}(?:\.[\d]{3})*,[\d]{2}|[\d]{1,6},[\d]{2})(?:\s*[+\-CDcd])?/gi;

  let last: RegExpExecArray | null = null;
  let m: RegExpExecArray | null;
  pattern.lastIndex = 0;
  while ((m = pattern.exec(text)) !== null) last = m;

  if (!last) return null;

  const fullMatch = last[0];
  const prefix = (last[1] ?? '').trim().toUpperCase();
  const rawVal = last[2].replace(/\./g, '').replace(',', '.');
  const amount = parseFloat(rawVal);

  if (isNaN(amount) || amount <= 0 || amount >= 500_000) return null;

  // Determine income: '+' or 'C' (crédito) prefix/suffix means income
  const isIncome = prefix === '+' || prefix === 'C';

  // descriptionRaw: everything BEFORE the last match occurrence
  const matchStart = text.lastIndexOf(fullMatch);
  const descriptionRaw = matchStart >= 0 ? text.slice(0, matchStart) : text;

  return { amount, isIncome, descriptionRaw };
}

// ─── Description cleanup ──────────────────────────────────────────────────────

function cleanDescription(raw: string): string {
  return raw
    .replace(/\.\.\.\.\s*\d{4}/g, '')     // card fragment ".... 0799"
    .replace(/\*{4}\s*\d{4}/g, '')        // masked card "**** 1234"
    .replace(/R\$\s*[\d.,]+/gi, '')       // residual R$ amounts
    .replace(/\d{10,}/g, '')              // long digit sequences (barcodes etc.)
    .replace(/[\[\]{}()]/g, '')
    .replace(/\s+/g, ' ')
    .replace(/^[\s•\-–—|:,;.\d]+/, '')   // leading punct / lone digits
    .replace(/[\s•\-–—|:,;.]+$/, '')      // trailing punct
    .trim();
}

// ─── Exclusion filter ─────────────────────────────────────────────────────────

function containsExclusionKeyword(text: string): boolean {
  const lower = text.toLowerCase();
  return EXCLUSION_KEYWORDS.some(kw => lower.includes(kw));
}

// ─── Category suggestion ──────────────────────────────────────────────────────

function suggestCategory(
  description: string,
  categories: Category[],
  isIncome: boolean,
): { categoryId: string | undefined; type: TransactionType } {
  const lower = description.toLowerCase();

  if (isIncome) {
    return { categoryId: categories.find(c => c.type === 'receita')?.id, type: 'receita' };
  }

  // Check income keywords
  const incomeKws = [
    ...(CATEGORY_KEYWORDS['Salário'] ?? []),
    ...(CATEGORY_KEYWORDS['Renda Extra'] ?? []),
  ];
  if (incomeKws.some(kw => lower.includes(kw))) {
    return { categoryId: categories.find(c => c.type === 'receita')?.id, type: 'receita' };
  }

  // Match expense keywords
  for (const [name, keywords] of Object.entries(CATEGORY_KEYWORDS)) {
    if (keywords.some(kw => lower.includes(kw))) {
      const cat = categories.find(
        c => c.name.toLowerCase() === name.toLowerCase() && c.type === 'despesa',
      );
      if (cat) return { categoryId: cat.id, type: 'despesa' };
    }
  }

  return { categoryId: categories.find(c => c.type === 'despesa')?.id, type: 'despesa' };
}

export function extractTextFromPDF(arrayBuffer: ArrayBuffer): Promise<string> {
  return Promise.resolve('');
}
