import type { SuggestedTransaction, Category, TransactionType } from '@/types/finance';
import { v4 as uuid } from 'uuid';

// ─── Statement type ────────────────────────────────────────────────────────────

export type StatementType = 'fatura' | 'extrato' | 'auto';

// ─── Category keyword map ─────────────────────────────────────────────────────

const CATEGORY_KEYWORDS: Record<string, string[]> = {
  'Alimentação': [
    'restaurante', 'lanchonete', 'mercado', 'supermercado', 'padaria',
    'ifood', 'ifd*', 'uber eats', 'rappi', 'acougue', 'hortifruti',
    'pizzaria', 'hamburguer', 'sushi', 'delivery', 'acai', 'sorveteria',
    'spoleto', 'coco bambu', 'madero', 'churrascaria',
  ],
  'Transporte': [
    'uber', '99app', '99pop', 'combustivel', 'gasolina', 'etanol',
    'estacionamento', 'pedagio', 'onibus', 'metro', 'taxi', 'posto',
    'shell', 'petrobras', 'ipiranga', 'br mania', 'automob',
  ],
  'Moradia': [
    'aluguel', 'condominio', 'iptu', 'energia', 'enel', 'cemig', 'copel',
    'agua', 'sabesp', 'copasa', 'gas', 'internet', 'vivo', 'claro',
    'tim fixo', 'net combo', 'galante',
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
    'clube cultura', 'swarovski',
  ],
  'Educação': [
    'escola', 'faculdade', 'curso', 'livro', 'colegio', 'universidade',
    'udemy', 'alura', 'mensalidade escolar',
  ],
  'Compras': [
    'loja', 'shopping', 'roupa', 'calcado', 'eletronico', 'eletrodomestico',
    'movel', 'magazine', 'renner', 'riachuelo', 'c&a', 'americanas',
    'shoptime', 'amazon', 'mercado livre', 'shein', 'zara', 'hm',
    'shop center', 'iguatemi',
  ],
  'Assinaturas': [
    'applecombill', 'apple.com', 'apple ', 'ebn *spotify', 'ebn*spotify',
    'clube livelo', 'microsoft', 'google storage', 'adobe', 'canva',
    'assinatura', 'streaming', 'cooperativa',
  ],
  'Contas/Taxas': [
    'taxa', 'tarifa', 'anuidade', 'iof', 'juros', 'multa', 'imposto',
    'ipva', 'licenciamento', 'pagamento de boleto',
    'aplicacao rdb', 'debito em conta', 'resgate de emprestimo',
    'iof transacoes exterior',
  ],
  'Salário': ['salario', 'remuneracao', 'holerite', 'contracheque', 'clt'],
  'Renda Extra': [
    'freelance', 'bonus', 'comissao', 'dividendo', 'rendimento',
    'transferencia recebida', 'transferencia recebida pelo pix', 'pix recebido',
    'credito em conta', 'estorno', 'restituicao',
    'resgate rdb',
  ],
};

// ─── Exclusion keywords ───────────────────────────────────────────────────────
// Used to filter out non-transaction lines (section headers, summaries, etc.)
// Written WITHOUT accents — comparisons are done after stripping diacritics.
//
// IMPORTANT: These are checked at the DESCRIPTION level, not at window level,
// so we don't accidentally discard entire date sections.

const EXCLUSION_KEYWORDS = [
  // Section totals (Itaú/bank extratos)
  'total de entradas', 'total de saidas',
  // C6 bank fatura boilerplate / payment entries
  'pag fatura boleto', 'inclusao de pagamento',
  'iof transacoes exterior',
  // Credit card statement boilerplate
  'saldo anterior', 'saldo final', 'saldo em ', 'saldo disponivel',
  'limite total', 'limite disponivel', 'limite de credito',
  'saque no credito', 'saque no debito',
  'pix no credito', 'pix no debito',
  'total de compras', 'total da fatura', 'total de lancamentos',
  'total de todos', 'total dos cartoes',
  'total a pagar',
  'resumo da fatura', 'resumo do extrato',
  'pagamento minimo', 'valor minimo', 'pagamento em ',
  'minimo para nao ficar', 'nao ficar em atraso',
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

function norm(s: string): string {
  return s.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
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

export function parseOCRText(
  text: string,
  categories: Category[],
  statementType: StatementType = 'auto',
): SuggestedTransaction[] {
  const currentYear = new Date().getFullYear();

  const byLines = text
    .replace(/\r\n/g, '\n').replace(/\r/g, '\n')
    .split('\n')
    .map(l => l.trim())
    .filter(l => l.length > 0);

  const flatText = byLines.join(' ');

  let raw: ParsedItem[] = [];

  if (statementType === 'fatura') {
    // Credit card bills: each line/chunk starts with a date
    // Use chunk strategy (best for Nubank, C6 faturas)
    const lineResults = parseLineByLine(byLines, currentYear);
    const chunkResults = parseChunks(flatText, currentYear);
    raw = chunkResults.length > lineResults.length ? chunkResults : lineResults;

  } else if (statementType === 'extrato') {
    // Bank account statements: transactions grouped under date headers
    // Use grouped strategies (lines + flat text)
    const groupedLineResults = parseGroupedLines(byLines, currentYear);
    const groupedChunkResults = parseGroupedChunks(flatText, currentYear);
    raw = groupedChunkResults.length > groupedLineResults.length ? groupedChunkResults : groupedLineResults;

  } else {
    // Auto: run all 4 strategies, pick the one with most results
    const lineResults = parseLineByLine(byLines, currentYear);
    const chunkResults = parseChunks(flatText, currentYear);
    const groupedLineResults = parseGroupedLines(byLines, currentYear);
    const groupedChunkResults = parseGroupedChunks(flatText, currentYear);
    const all = [lineResults, chunkResults, groupedLineResults, groupedChunkResults];
    raw = all.reduce((best, cur) => cur.length > best.length ? cur : best);
  }

  const seen = new Set<string>();
  const results: SuggestedTransaction[] = [];

  for (const item of raw) {
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

// ─── Strategy A: line-by-line (each line starts with date) ───────────────────
// Works for: PDFs where each row is preserved as a line (some bank exports)

function lineStartsWithDate(line: string): boolean {
  if (/^\d{2}[\/\-]\d{2}([\/\-]\d{2,4})?/.test(line)) return true;
  if (new RegExp(`^\\d{2}\\s+(${MONTH_KEYS})\\b`, 'i').test(line)) return true;
  return false;
}

function parseLineByLine(lines: string[], currentYear: number): ParsedItem[] {
  const results: ParsedItem[] = [];
  for (const line of lines) {
    if (!lineStartsWithDate(line)) continue;
    const item = parseTransactionLine(line, currentYear);
    if (item && !containsExclusionKeyword(item.description)) results.push(item);
  }
  return results;
}

function parseTransactionLine(line: string, currentYear: number): ParsedItem | null {
  const dateResult = extractLeadingDate(line, currentYear);
  if (!dateResult) return null;

  const rest = line.slice(dateResult.consumed).trim();
  const amtResult = extractAmount(rest, false); // LAST amount (right-aligned)
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

// ─── Strategy B: chunk-based (flat text, one date per chunk) ─────────────────
// Works for: Nubank fatura PDF (PDF.js flattens all text, dates like "19 MAR")

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
    const windowEnd = Math.min(nextIndex, a.end + 150);
    const window = flatText.slice(a.end, windowEnd);

    // Remove USD exchange-rate sub-amounts before extracting BRL value
    // e.g. "LOVABLE DO USD 26,75 | Cotação USD: R$5,54 141,17" → "LOVABLE DO 141,17"
    const cleanWindow = window.replace(/USD\s+[\d.,]+\s*\|\s*Cota[çc][aã]o\s+USD:\s*R\$[\d.,]+/gi, '');

    // Pick FIRST amount in window (the transaction value)
    const amtResult = extractAmount(cleanWindow, true);
    if (!amtResult) continue;

    // Detect C6 estorno (refund/chargeback) — mark as income
    const isEstorno = norm(amtResult.descriptionRaw).includes('estorno');

    const description = cleanDescription(amtResult.descriptionRaw);
    if (!description || description.length < 3 || description.length > 70) continue;

    // Check exclusion at description level only (not the whole window)
    if (containsExclusionKeyword(description)) continue;

    results.push({
      amount: amtResult.amount,
      date: a.date,
      description,
      rawLine: flatText.slice(a.index, windowEnd),
      isIncome: amtResult.isIncome || isEstorno,
    });
  }

  return results;
}

// ─── Strategy C: grouped lines (date headers, per-line) ──────────────────────
// Works for: Itaú extrato screenshots/OCR where each visual row is one line
//
// Format:
//   01/03/2026   Total de saídas   -3.693,42          ← date header (sets context)
//   Transferência enviada pelo Pix   FULANO   60,00   ← transaction (inherits date)
//   Pagamento de boleto   GALANTE CONDOMÍNIOS   1.283,04

function parseGroupedLines(lines: string[], currentYear: number): ParsedItem[] {
  const results: ParsedItem[] = [];
  let currentDate: Date | null = null;
  let currentIsIncome = false;

  for (const line of lines) {
    const normLine = norm(line);

    // Line starts with date + "total de" → it's a section header
    if (lineStartsWithDate(line) && normLine.includes('total de')) {
      const dateResult = extractLeadingDate(line, currentYear);
      if (dateResult) {
        currentDate = dateResult.date;
        currentIsIncome = normLine.includes('total de entradas');
      }
      continue; // Skip the header line itself
    }

    // Line starts with a date but is NOT a section header → different format, reset
    if (lineStartsWithDate(line)) {
      currentDate = null;
      continue;
    }

    if (!currentDate) continue;
    if (containsExclusionKeyword(line)) continue;

    // Must have a BRL amount (LAST = right-aligned column)
    const amtResult = extractAmount(line, false);
    if (!amtResult) continue;

    const description = cleanDescription(amtResult.descriptionRaw);
    if (!description || description.length < 3 || description.length > 100) continue;

    results.push({
      amount: amtResult.amount,
      date: currentDate,
      description,
      rawLine: line,
      isIncome: currentIsIncome,
    });
  }

  return results;
}

// ─── Strategy D: grouped chunks (date headers, flat text) ────────────────────
// Works for: Itaú extrato PDF (PDF.js flattens entire page to one string)
//
// Each date anchor is followed by "Total de saídas/entradas" (section header).
// All amounts between consecutive date anchors are individual transactions.

function parseGroupedChunks(flatText: string, currentYear: number): ParsedItem[] {
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
    const nextStart = anchors[i + 1]?.index ?? flatText.length;

    // Check if this anchor is a section header (followed by "total de")
    const headerWindow = norm(flatText.slice(a.end, a.end + 100));
    const isGroupedHeader =
      headerWindow.includes('total de saidas') ||
      headerWindow.includes('total de entradas');
    if (!isGroupedHeader) continue;

    // currentIsIncome tracks direction and may flip mid-section when a date has
    // both "Total de entradas" AND "Total de saídas" sub-headers
    let currentIsIncome = headerWindow.includes('total de entradas');

    // Parse ALL amounts in the section between this anchor and the next
    const sectionText = flatText.slice(a.end, nextStart);
    const AMT_RE = /([+\-]?\s*|[CD]\s+)?(?:R\$\s*)?([\d]{1,3}(?:\.[\d]{3})*,[\d]{2}|[\d]{1,6},[\d]{2})(?:\s*[+\-CDcd])?/gi;

    const amtMatches: Array<{ index: number; end: number; amount: number }> = [];
    let am: RegExpExecArray | null;
    AMT_RE.lastIndex = 0;
    while ((am = AMT_RE.exec(sectionText)) !== null) {
      const rawVal = am[2].replace(/\./g, '').replace(',', '.');
      const amount = parseFloat(rawVal);
      if (!isNaN(amount) && amount > 0 && amount < 500_000) {
        amtMatches.push({ index: am.index, end: am.index + am[0].length, amount });
      }
    }

    // For each amount, description = text between previous amount end and this amount
    let prevEnd = 0;
    for (const amt of amtMatches) {
      const descRaw = sectionText.slice(prevEnd, amt.index).trim();
      prevEnd = amt.end;

      const descNorm = norm(descRaw);
      // Update income direction when a sub-section header is encountered mid-section
      if (descNorm.includes('total de entradas')) { currentIsIncome = true; continue; }
      if (descNorm.includes('total de saidas')) { currentIsIncome = false; continue; }

      if (containsExclusionKeyword(descRaw)) continue;
      const description = cleanDescription(descRaw);
      if (!description || description.length < 3 || description.length > 100) continue;

      results.push({
        amount: amt.amount,
        date: a.date,
        description,
        rawLine: `${flatText.slice(a.index, a.end)} ${descRaw}`.slice(0, 200),
        isIncome: currentIsIncome,
      });
    }
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

function dateIsInRange(text: string, index: number): boolean {
  const before = norm(text.slice(Math.max(0, index - 25), index));
  if (/\b(?:de|a|ate)\s+$/.test(before)) return true;
  if (/(?:vencimento|emissao|data|periodo|competencia|fechamento)\s*[:\-]?\s*$/.test(before)) return true;
  return false;
}

// ─── Amount extractor ─────────────────────────────────────────────────────────

interface AmountResult {
  amount: number;
  isIncome: boolean;
  descriptionRaw: string;
}

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

  const matchStart = text.indexOf(chosen[0]);
  const descriptionRaw = matchStart >= 0 ? text.slice(0, matchStart) : text;

  return { amount, isIncome, descriptionRaw };
}

// ─── Description cleanup ──────────────────────────────────────────────────────

function cleanDescription(raw: string): string {
  return raw
    .replace(/\.\.\.\.\s*\d{4}/g, '')          // card fragment ".... 0799"
    .replace(/\*{4}\s*\d{4}/g, '')             // masked card "**** 1234"
    .replace(/[•*]{2,}[\d•*.\/\-]+/g, '')      // masked CPF/CNPJ "•••.110.598.••"
    .replace(/R\$\s*[\d.,]+/gi, '')            // residual R$ amounts
    .replace(/\s*USD\s+[\d.,]+\s*\|\s*Cota[çc][aã]o\s+USD:\s*R\$[\d.,]+/gi, '') // C6 international "USD 26,75 | Cotação USD: R$5,54"
    .replace(/\s*-\s*[Ee]storno\b/g, '')       // C6 refund suffix "- Estorno" (income captured separately)
    .replace(/\d{2}\.\d{3}\.\d{3}\/\d{4}-?\d{0,2}/g, '')  // CNPJ "14.226.756/0001-68"
    .replace(/Agência:\s*\d+\s*Conta:\s*[\d\-]+/gi, '')     // routing "Agência: 1234 Conta: 5678-9"
    .replace(/\s*-\s*(NU PAGAMENTOS|ITAÚ UNIBANCO|BCO C6|NUBANK|ADYEN)[^,\n]*/gi, '') // bank suffixes
    .replace(/\d{8,}/g, '')                    // long account/document numbers
    .replace(/[\[\]{}()]/g, '')
    .replace(/\s+/g, ' ')
    .replace(/^[\s•\-–—|:,;.\d]+/, '')         // leading punct / lone digits
    .replace(/[\s•\-–—|:,;.]+$/, '')           // trailing punct
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
