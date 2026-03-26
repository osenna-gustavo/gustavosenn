import type { SuggestedTransaction, Category, TransactionType } from '@/types/finance';
import { v4 as uuid } from 'uuid';

// ─── Category keyword map ─────────────────────────────────────────────────────

const CATEGORY_KEYWORDS: Record<string, string[]> = {
  'Alimentação': [
    'restaurante', 'lanchonete', 'mercado', 'supermercado', 'padaria',
    'ifood', 'ifd*', 'uber eats', 'rappi', 'acougue', 'hortifruti',
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
    'tim fixo', 'net combo',
  ],
  'Saúde': [
    'farmacia', 'drogaria', 'droga', 'medico', 'consulta', 'exame',
    'hospital', 'clinica', 'laboratorio', 'plano de saude', 'unimed',
    'amil', 'sulamerica', 'hapvida', 'drogasil', 'raia', 'pacheco',
  ],
  'Lazer': [
    'cinema', 'teatro', 'show', 'netflix', 'spotify', 'amazon prime',
    'disney', 'hbo', 'bar ', 'balada', 'parque', 'ingresso',
    'globoplay', 'paramount', 'deezer', 'youtube premium',
  ],
  'Educação': [
    'escola', 'faculdade', 'curso', 'livro', 'colegio', 'universidade',
    'udemy', 'alura', 'mensalidade escolar',
  ],
  'Compras': [
    'loja', 'shopping', 'roupa', 'calcado', 'eletronico', 'eletrodomestico',
    'movel', 'magazine', 'renner', 'riachuelo', 'c&a', 'americanas',
    'shoptime', 'amazon', 'mercado livre', 'shein', 'zara', 'hm',
  ],
  'Assinaturas': [
    'applecombill', 'apple.com', 'apple ', 'ebn *spotify', 'ebn*spotify',
    'clube livelo', 'microsoft', 'google storage', 'adobe', 'canva',
    'assinatura', 'streaming',
  ],
  'Contas/Taxas': [
    'taxa', 'tarifa', 'anuidade', 'iof', 'juros', 'multa', 'imposto',
    'ipva', 'licenciamento',
  ],
  'Salário': ['salario', 'remuneracao', 'holerite', 'contracheque', 'clt'],
  'Renda Extra': [
    'freelance', 'bonus', 'comissao', 'dividendo', 'rendimento',
    'transferencia recebida', 'pix recebido',
  ],
};

// ─── Exclusion keywords (non-transaction text) ────────────────────────────────
// NOTE: written WITHOUT accents — comparison is done after stripping diacritics

const EXCLUSION_KEYWORDS = [
  'saldo anterior', 'saldo final', 'saldo em ', 'saldo disponivel',
  'limite total', 'limite disponivel', 'limite de credito',
  'saque no credito', 'saque no debito',
  'pix no credito', 'pix no debito',
  'total de compras', 'total da fatura', 'total de lancamentos',
  'total de todos', 'total dos cartoes',
  'total a pagar',
  'resumo da fatura', 'resumo do extrato',
  'pagamento minimo', 'valor minimo', 'pagamento em ',
  'minimo para nao ficar',
  'nao ficar em atraso',
  'sua fatura', 'fatura de ', 'fatura do cartao',
  'emissao da fatura', 'data de vencimento', 'vencimento:',
  'alternativas de pagamento', 'formas de pagamento', 'codigo de barras',
  'ola,', 'prezado', 'prezada',
  'credito rotativo', 'juros rotativos',
  'encargos financeiros', 'taxa efetiva', 'taxa de juros',
  'periodo de ', 'competencia',
  'de fev a ', 'de mar a ', 'de jan a ', 'de abr a ',
  'de mai a ', 'de jun a ', 'de jul a ', 'de ago a ',
  'de set a ', 'de out a ', 'de nov a ', 'de dez a ',
  'transacoes de ', 'transações de ',
];

// ─── Helpers ──────────────────────────────────────────────────────────────────

/** Strip Portuguese/Spanish diacritics and lowercase. */
function norm(s: string): string {
  return s
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase();
}

function containsExclusionKeyword(text: string): boolean {
  const n = norm(text);
  return EXCLUSION_KEYWORDS.some(kw => n.includes(kw));
}

// ─── Month abbr → index ───────────────────────────────────────────────────────

const MONTH_ABBR: Record<string, number> = {
  jan: 0, fev: 1, mar: 2, abr: 3, mai: 4, jun: 5,
  jul: 6, ago: 7, set: 8, out: 9, nov: 10, dez: 11,
};
const MONTH_KEYS = Object.keys(MONTH_ABBR).join('|');

// ─── Types ────────────────────────────────────────────────────────────────────

interface ParsedItem {
  amount: number;
  date: Date;
  description: string;
  rawLine: string;
  isIncome: boolean;
}

// ─── Main entry point ─────────────────────────────────────────────────────────

export function parseOCRText(text: string, categories: Category[]): SuggestedTransaction[] {
  const currentYear = new Date().getFullYear();

  const byLines = text
    .replace(/\r\n/g, '\n').replace(/\r/g, '\n')
    .split('\n')
    .map(l => l.trim())
    .filter(l => l.length > 0);

  // Strategy 1: line-by-line (PDF preserves row structure)
  const lineResults: ParsedItem[] = [];
  for (const line of byLines) {
    if (!lineStartsWithDate(line)) continue;
    if (containsExclusionKeyword(line)) continue;
    const item = parseTransactionLine(line, currentYear);
    if (item) lineResults.push(item);
  }

  // Strategy 2: chunk-based (PDF text is one big flat string per page)
  const flatText = byLines.join(' ');
  const chunkResults: ParsedItem[] = parseChunks(flatText, currentYear);

  const raw = chunkResults.length > lineResults.length ? chunkResults : lineResults;

  const seen = new Set<string>();
  const results: SuggestedTransaction[] = [];

  for (const item of raw) {
    if (containsExclusionKeyword(item.rawLine)) continue;
    if (containsExclusionKeyword(item.description)) continue;

    const key = `${item.amount.toFixed(2)}|${norm(item.description)}`;
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

// ─── Strategy 1: line-by-line ─────────────────────────────────────────────────

function lineStartsWithDate(line: string): boolean {
  if (/^\d{2}[\/\-]\d{2}([\/\-]\d{2,4})?/.test(line)) return true;
  if (new RegExp(`^\\d{2}\\s+(${MONTH_KEYS})\\b`, 'i').test(line)) return true;
  return false;
}

function parseTransactionLine(line: string, currentYear: number): ParsedItem | null {
  const dateResult = extractLeadingDate(line, currentYear);
  if (!dateResult) return null;

  const rest = line.slice(dateResult.consumed).trim();
  // For line-by-line, pick the LAST amount (right-aligned columns)
  const amtResult = extractAmount(rest, false);
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

// ─── Strategy 2: chunk-based ──────────────────────────────────────────────────

function parseChunks(flatText: string, currentYear: number): ParsedItem[] {
  const DATE_RE = new RegExp(
    `(?<![\\d])(\\d{2})[\\s\\/\\-](${MONTH_KEYS}|\\d{2})(?:[\\s\\/\\-](\\d{2,4}))?(?![\\d])`,
    'gi',
  );

  interface Anchor { index: number; end: number; date: Date }
  const anchors: Anchor[] = [];
  let m: RegExpExecArray | null;
  DATE_RE.lastIndex = 0;

  while ((m = DATE_RE.exec(flatText)) !== null) {
    const date = parseDateFromGroups(m[1], m[2], m[3], currentYear);
    if (!date) continue;
    if (dateIsInRange(flatText, m.index)) continue;
    anchors.push({ index: m.index, end: m.index + m[0].length, date });
  }

  const results: ParsedItem[] = [];

  for (let i = 0; i < anchors.length; i++) {
    const a = anchors[i];
    const nextIndex = anchors[i + 1]?.index ?? flatText.length;

    // Cap window at 150 chars to avoid crossing into the next section
    const windowEnd = Math.min(nextIndex, a.end + 150);
    const window = flatText.slice(a.end, windowEnd);

    if (containsExclusionKeyword(window)) continue;

    // For chunk-based, pick the FIRST amount (transaction value, not section totals)
    const amtResult = extractAmount(window, true);
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
  const slashM = line.match(/^(\d{2})[\/\-](\d{2})(?:[\/\-](\d{2,4}))?/);
  if (slashM) {
    const date = parseDateFromGroups(slashM[1], slashM[2], slashM[3], currentYear);
    if (date) return { date, consumed: slashM[0].length };
  }
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
  const ml = monthStr.toLowerCase();
  if (MONTH_ABBR[ml] !== undefined) {
    month = MONTH_ABBR[ml];
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
 * Returns true if the date at `index` is part of a range expression
 * ("de 20 FEV a 20 MAR") or follows a date-label ("Vencimento: 20/03").
 */
function dateIsInRange(text: string, index: number): boolean {
  const before = norm(text.slice(Math.max(0, index - 25), index));

  // Range expressions: "de " or " a " immediately before date
  if (/\bde\s+$/.test(before) || /\ba\s+$/.test(before)) return true;

  // Date labels: vencimento, emissao, data, periodo, competencia
  if (/(?:vencimento|emissao|emissão|data|periodo|competencia|emissao)\s*[:\-]?\s*$/.test(before)) return true;

  return false;
}

// ─── Amount extractor ─────────────────────────────────────────────────────────

interface AmountResult {
  amount: number;
  isIncome: boolean;
  descriptionRaw: string;
}

/**
 * Finds a BRL-formatted value in `text`.
 * @param useFirst  true → return the FIRST match (chunk mode)
 *                  false → return the LAST match (line mode, right-aligned)
 */
function extractAmount(text: string, useFirst: boolean): AmountResult | null {
  const pattern = /([+\-]?\s*|[CD]\s+)?(?:R\$\s*)?([\d]{1,3}(?:\.[\d]{3})*,[\d]{2}|[\d]{1,6},[\d]{2})(?:\s*[+\-CDcd])?/gi;

  const matches: RegExpExecArray[] = [];
  let m: RegExpExecArray | null;
  pattern.lastIndex = 0;
  while ((m = pattern.exec(text)) !== null) matches.push(m);
  if (matches.length === 0) return null;

  const chosen = useFirst ? matches[0] : matches[matches.length - 1];

  const prefix = (chosen[1] ?? '').trim().toUpperCase();
  const rawVal = chosen[2].replace(/\./g, '').replace(',', '.');
  const amount = parseFloat(rawVal);

  if (isNaN(amount) || amount <= 0 || amount >= 500_000) return null;

  const isIncome = prefix === '+' || prefix === 'C';

  // Description: everything BEFORE this match in the original text
  const matchStart = text.indexOf(chosen[0]);
  const descriptionRaw = matchStart >= 0 ? text.slice(0, matchStart) : text;

  return { amount, isIncome, descriptionRaw };
}

// ─── Description cleanup ──────────────────────────────────────────────────────

function cleanDescription(raw: string): string {
  return raw
    .replace(/\.\.\.\.\s*\d{4}/g, '')     // card fragment ".... 0799"
    .replace(/\*{4}\s*\d{4}/g, '')        // masked card "**** 1234"
    .replace(/R\$\s*[\d.,]+/gi, '')       // residual R$ amounts
    .replace(/\d{8,}/g, '')               // long digit sequences
    .replace(/[\[\]{}()]/g, '')
    .replace(/\s+/g, ' ')
    .replace(/^[\s•\-–—|:,;.\d]+/, '')    // leading punct / lone digits
    .replace(/[\s•\-–—|:,;.]+$/, '')      // trailing punct
    .trim();
}

// ─── Category suggestion ──────────────────────────────────────────────────────

function suggestCategory(
  description: string,
  categories: Category[],
  isIncome: boolean,
): { categoryId: string | undefined; type: TransactionType } {
  const lower = norm(description);

  if (isIncome) {
    return { categoryId: categories.find(c => c.type === 'receita')?.id, type: 'receita' };
  }

  const incomeKws = [
    ...(CATEGORY_KEYWORDS['Salário'] ?? []),
    ...(CATEGORY_KEYWORDS['Renda Extra'] ?? []),
  ];
  if (incomeKws.some(kw => lower.includes(kw))) {
    return { categoryId: categories.find(c => c.type === 'receita')?.id, type: 'receita' };
  }

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
