import type { SuggestedTransaction, Category, TransactionType } from '@/types/finance';
import { v4 as uuid } from 'uuid';

// Keywords that identify category types
const CATEGORY_KEYWORDS: Record<string, string[]> = {
  'Alimentação': ['restaurante', 'lanchonete', 'mercado', 'supermercado', 'padaria', 'ifood', 'uber eats', 'rappi', 'açougue', 'hortifruti', 'pizzaria', 'hamburguer', 'sushi', 'delivery'],
  'Transporte': ['uber', '99app', '99pop', 'combustível', 'gasolina', 'etanol', 'estacionamento', 'pedágio', 'onibus', 'metro', 'taxi', 'posto', 'shell', 'petrobras', 'ipiranga', 'br mania'],
  'Moradia': ['aluguel', 'condomínio', 'iptu', 'energia', 'enel', 'cemig', 'copel', 'agua', 'sabesp', 'copasa', 'gas', 'internet', 'vivo', 'claro', 'tim', 'oi', 'net', 'sky'],
  'Saúde': ['farmácia', 'droga', 'medico', 'consulta', 'exame', 'hospital', 'clinica', 'laboratorio', 'plano de saude', 'unimed', 'amil', 'sulamerica', 'hapvida', 'drogasil', 'raia'],
  'Lazer': ['cinema', 'teatro', 'show', 'netflix', 'spotify', 'amazon prime', 'disney', 'hbo', 'bar', 'balada', 'parque', 'ingresso', 'globoplay', 'paramount'],
  'Educação': ['escola', 'faculdade', 'curso', 'livro', 'material escolar', 'mensalidade', 'colegio', 'universidade', 'udemy', 'alura'],
  'Compras': ['loja', 'shopping', 'roupa', 'calcado', 'eletronico', 'eletrodomestico', 'movel', 'magazine', 'renner', 'riachuelo', 'c&a', 'americanas', 'shoptime', 'amazon', 'mercado livre', 'shein'],
  'Assinaturas': ['assinatura', 'plano', 'netflix', 'spotify', 'amazon', 'disney', 'apple', 'microsoft', 'google', 'adobe', 'canva'],
  'Contas/Taxas': ['taxa', 'tarifa', 'anuidade', 'iof', 'juros', 'multa', 'imposto', 'ipva', 'licenciamento'],
  'Salário': ['salario', 'salário', 'pagamento salario', 'remuneracao', 'holerite', 'contracheque', 'clt'],
  'Renda Extra': ['freelance', 'bonus', 'bônus', 'comissao', 'dividendo', 'rendimento', 'transferencia recebida', 'pix recebido'],
};

// Keywords that identify non-transaction lines (header, summary, footer text)
const EXCLUSION_KEYWORDS = [
  'saldo', 'limite', 'disponív', 'disponivel',
  'pagamento mínimo', 'pagamento minimo', 'valor mínimo', 'valor minimo',
  'fatura de', 'sua fatura', 'emissão', 'emissao',
  'data de vencimento', 'vencimento:', 'data de emissão',
  'total de compras', 'total da fatura', 'total de lançamentos',
  'resumo da fatura', 'resumo do extrato',
  'olá,', 'ola,', 'prezado', 'prezada', 'titular',
  'lançamentos internacionais', 'lançamentos nacionais',
  'crédito rotativo', 'juros rotativos', 'encargos',
  'cdi +', 'taxa efetiva', 'taxa de juros',
  'pagar menos que', 'pagar o valor mínimo',
  'alternativas de pagamento', 'forma de pagamento',
  'código de barras', 'codigo de barras',
  'número da conta', 'agência', 'agencia',
  'período de', 'periodo de', 'competência',
  'extrato de conta', 'histórico', 'historico',
  'saldo anterior', 'saldo final', 'saldo em',
  'débitos', 'créditos', 'total débitos', 'total créditos',
];

// Month abbreviations in Portuguese
const MONTH_ABBR: Record<string, number> = {
  jan: 0, fev: 1, mar: 2, abr: 3, mai: 4, jun: 5,
  jul: 6, ago: 7, set: 8, out: 9, nov: 10, dez: 11,
};

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

  // Normalise: collapse excessive whitespace within lines, keep line breaks
  const normalised = text
    .replace(/\r\n/g, '\n')
    .replace(/\r/g, '\n')
    .replace(/[ \t]{2,}/g, ' ') // collapse multiple spaces/tabs to one
    .split('\n')
    .map(l => l.trim())
    .filter(l => l.length > 0);

  const suggestions: SuggestedTransaction[] = [];

  for (const line of normalised) {
    // Hard gate: line must start with a date token
    if (!lineStartsWithDate(line)) continue;

    // Hard gate: must not contain exclusion keywords
    if (containsExclusionKeyword(line)) continue;

    const parsed = parseTransactionLine(line, currentYear);
    if (!parsed) continue;

    const { categoryId, type } = suggestCategory(
      parsed.description,
      categories,
      parsed.isIncome,
    );

    suggestions.push({
      id: uuid(),
      date: parsed.date,
      amount: parsed.amount,
      type,
      description: parsed.description.slice(0, 100),
      suggestedCategoryId: categoryId,
      confirmed: false,
      needsReview: !categoryId,
      rawText: parsed.rawLine,
    });
  }

  // Deduplicate: same amount + same description (case-insensitive)
  const seen = new Set<string>();
  return suggestions.filter(s => {
    const key = `${s.amount?.toFixed(2)}|${s.description?.toLowerCase()}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

// ─── Date detection ──────────────────────────────────────────────────────────

/**
 * Returns true when the line begins with a date token.
 * Accepted formats:
 *   DD/MM     25/12
 *   DD/MM/YY  25/12/24
 *   DD/MM/YYYY 25/12/2024
 *   DD-MM-YYYY 25-12-2024
 *   DD MMM    25 MAR  (with optional year after)
 */
function lineStartsWithDate(line: string): boolean {
  // DD/MM or DD/MM/YY or DD/MM/YYYY
  if (/^\d{2}[\/\-]\d{2}([\/\-]\d{2,4})?/.test(line)) return true;
  // DD MMM (Portuguese month abbreviation)
  const monthAbbrs = Object.keys(MONTH_ABBR).join('|');
  if (new RegExp(`^\\d{2}\\s+(${monthAbbrs})`, 'i').test(line)) return true;
  return false;
}

// ─── Exclusion filter ────────────────────────────────────────────────────────

function containsExclusionKeyword(line: string): boolean {
  const lower = line.toLowerCase();
  return EXCLUSION_KEYWORDS.some(kw => lower.includes(kw));
}

// ─── Transaction line parser ──────────────────────────────────────────────────

function parseTransactionLine(line: string, currentYear: number): ParsedItem | null {
  // ── 1. Extract date from the start of the line ──
  const dateResult = extractLeadingDate(line, currentYear);
  if (!dateResult) return null;
  const { date, consumed: dateConsumed } = dateResult;

  const rest = line.slice(dateConsumed).trim();

  // ── 2. Extract amount ──
  // We prefer the LAST BRL value on the line (right-aligned as in most extratos)
  const amountResult = extractAmount(rest);
  if (!amountResult) return null;
  const { amount, isIncome, descriptionRaw } = amountResult;

  // Sanity: amount must be > 0 and < 500,000
  if (amount <= 0 || amount >= 500_000) return null;

  // ── 3. Clean description ──
  let description = descriptionRaw
    .replace(/\s+/g, ' ')
    .trim();

  // Hard limit: description must not be absurdly long
  if (description.length > 70) return null;

  // Hard limit: description must have at least 2 chars
  if (description.length < 2) return null;

  // Remove leading punctuation / separators
  description = description.replace(/^[•\-–—|:,;.]+\s*/, '').trim();

  return {
    amount,
    date,
    description: description || 'Lançamento importado',
    rawLine: line,
    isIncome,
  };
}

// ─── Date extractor ───────────────────────────────────────────────────────────

function extractLeadingDate(
  line: string,
  currentYear: number,
): { date: Date; consumed: number } | null {
  // DD/MM/YYYY or DD/MM/YY or DD/MM
  const slashMatch = line.match(/^(\d{2})[\/\-](\d{2})(?:[\/\-](\d{2,4}))?/);
  if (slashMatch) {
    const day = parseInt(slashMatch[1]);
    const month = parseInt(slashMatch[2]) - 1;
    let year = currentYear;
    if (slashMatch[3]) {
      year = parseInt(slashMatch[3]);
      if (year < 100) year += 2000;
    }
    if (day < 1 || day > 31 || month < 0 || month > 11) return null;
    return { date: new Date(year, month, day), consumed: slashMatch[0].length };
  }

  // DD MMM [YYYY]
  const monthAbbrs = Object.keys(MONTH_ABBR).join('|');
  const monthMatch = line.match(
    new RegExp(`^(\\d{2})\\s+(${monthAbbrs})(?:\\s+(\\d{4}))?`, 'i'),
  );
  if (monthMatch) {
    const day = parseInt(monthMatch[1]);
    const month = MONTH_ABBR[monthMatch[2].toLowerCase()];
    const year = monthMatch[3] ? parseInt(monthMatch[3]) : currentYear;
    if (day < 1 || day > 31) return null;
    return { date: new Date(year, month, day), consumed: monthMatch[0].length };
  }

  return null;
}

// ─── Amount extractor ─────────────────────────────────────────────────────────

interface AmountResult {
  amount: number;
  isIncome: boolean;
  descriptionRaw: string;
}

/**
 * Finds the rightmost BRL currency value in `text`.
 * Returns the amount, whether it's income (preceded by + or "C"), and the
 * description text that precedes it.
 */
function extractAmount(text: string): AmountResult | null {
  // Pattern: optional sign (+/-/C/D) + optional R$ + digits with BRL format
  const pattern = /([+\-CD]?\s*)?(?:R\$\s*)?([\d]{1,3}(?:\.[\d]{3})*,[\d]{2}|[\d]+,[\d]{2})\s*([+\-CD]?)\s*$/i;
  const match = text.match(pattern);
  if (!match) return null;

  const fullMatch = match[0];
  const prefix = (match[1] || '').trim().toUpperCase();
  const suffix = (match[3] || '').trim().toUpperCase();
  const rawValue = match[2]
    .replace(/\./g, '')  // remove thousand separator
    .replace(',', '.');  // decimal

  const amount = parseFloat(rawValue);
  if (isNaN(amount) || amount <= 0) return null;

  // Determine income vs expense
  // '+' or 'C' (crédito) = income; '-' or 'D' (débito) = expense (default)
  const signToken = prefix || suffix;
  const isIncome = signToken === '+' || signToken === 'C';

  const descriptionRaw = text.slice(0, text.length - fullMatch.length);

  return { amount, isIncome, descriptionRaw };
}

// ─── Category suggestion ──────────────────────────────────────────────────────

function suggestCategory(
  description: string,
  categories: Category[],
  isIncome: boolean,
): { categoryId: string | undefined; type: TransactionType } {
  const lower = description.toLowerCase();

  if (isIncome) {
    const incomeCategory = categories.find(c => c.type === 'receita');
    return { categoryId: incomeCategory?.id, type: 'receita' };
  }

  // Check income keywords even for unsigned transactions
  const incomeKws = [...(CATEGORY_KEYWORDS['Salário'] ?? []), ...(CATEGORY_KEYWORDS['Renda Extra'] ?? [])];
  if (incomeKws.some(kw => lower.includes(kw))) {
    const incomeCategory = categories.find(c => c.type === 'receita');
    return { categoryId: incomeCategory?.id, type: 'receita' };
  }

  // Match expense keywords
  for (const [categoryName, keywords] of Object.entries(CATEGORY_KEYWORDS)) {
    if (keywords.some(kw => lower.includes(kw))) {
      const category = categories.find(
        c => c.name.toLowerCase() === categoryName.toLowerCase() && c.type === 'despesa',
      );
      if (category) return { categoryId: category.id, type: 'despesa' };
    }
  }

  const defaultCategory = categories.find(c => c.type === 'despesa');
  return { categoryId: defaultCategory?.id, type: 'despesa' };
}

export function extractTextFromPDF(arrayBuffer: ArrayBuffer): Promise<string> {
  // Handled in component via pdfjs-dist
  return Promise.resolve('');
}
