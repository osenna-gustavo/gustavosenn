import type { Transaction, Category, Subcategory, Recurrence } from '@/types/finance';
import type {
  C6Transaction,
  InvoiceTransaction,
  CategorizationRule,
  MatchConfidence,
  TransactionMatch,
  ReviewGroups,
} from '@/types/invoice';
import { v4 as uuid } from 'uuid';

// ─── String similarity ────────────────────────────────────────────────────────

/**
 * Simple Dice coefficient for string similarity (0–1).
 * Fast and good enough for merchant name comparison.
 */
function diceSimilarity(a: string, b: string): number {
  if (a === b) return 1;
  if (a.length < 2 || b.length < 2) return 0;

  const bigrams = (s: string): Map<string, number> => {
    const m = new Map<string, number>();
    for (let i = 0; i < s.length - 1; i++) {
      const bg = s.slice(i, i + 2);
      m.set(bg, (m.get(bg) ?? 0) + 1);
    }
    return m;
  };

  const mapA = bigrams(a);
  const mapB = bigrams(b);
  let intersection = 0;

  for (const [bg, countA] of mapA) {
    const countB = mapB.get(bg) ?? 0;
    intersection += Math.min(countA, countB);
  }

  return (2 * intersection) / (a.length - 1 + b.length - 1);
}

function norm(s: string): string {
  return s.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toUpperCase().trim();
}

// ─── Existing transaction description normalizer ──────────────────────────────

function normalizeExistingDescription(desc: string | undefined): string {
  if (!desc) return '';
  return desc
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toUpperCase()
    .replace(/[^\w\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

// ─── Date comparison ──────────────────────────────────────────────────────────

function daysDiff(a: Date, b: Date): number {
  return Math.abs(Math.round((a.getTime() - b.getTime()) / 86_400_000));
}

// ─── Duplicate detection ──────────────────────────────────────────────────────

export interface DuplicateResult {
  matchId?: string;
  confidence: MatchConfidence;
  matchedTransaction?: Transaction;
  details: TransactionMatch['comparedFields'];
}

export function findBestMatch(
  inv: C6Transaction,
  existing: Transaction[],
): DuplicateResult {
  let bestScore = 0;
  let bestTx: Transaction | undefined;
  let bestDetails: TransactionMatch['comparedFields'] = {};

  const invMerchant = inv.merchantNormalized;

  for (const tx of existing) {
    // Skip income transactions when comparing to an expense invoice item
    // (estornos can be income, but compras are expenses)
    if (inv.transactionType === 'compra' && tx.type === 'receita') continue;

    // ── Amount score (0–1) ──────────────────────────────────────────────────
    const amountDiff = Math.abs(tx.amount - inv.amount);
    const amountRelDiff = inv.amount > 0 ? amountDiff / inv.amount : 1;
    const amountScore =
      amountDiff === 0 ? 1.0 :
      amountRelDiff <= 0.001 ? 0.95 :
      amountRelDiff <= 0.01 ? 0.8 :
      amountRelDiff <= 0.05 ? 0.4 : 0;

    if (amountScore === 0) continue; // Completely different amount → skip

    // ── Date score (0–1) ────────────────────────────────────────────────────
    const txDate = new Date(tx.date);
    const diff = daysDiff(inv.transactionDate, txDate);
    const dateScore =
      diff === 0 ? 1.0 :
      diff <= 1 ? 0.9 :
      diff <= 3 ? 0.7 :
      diff <= 7 ? 0.4 : 0.1;

    // ── Merchant score (0–1) ────────────────────────────────────────────────
    const exDesc = normalizeExistingDescription(tx.description);
    const merchantScore = diceSimilarity(invMerchant, exDesc);

    // ── Combined weighted score ─────────────────────────────────────────────
    const score = amountScore * 0.5 + dateScore * 0.25 + merchantScore * 0.25;

    if (score > bestScore) {
      bestScore = score;
      bestTx = tx;
      bestDetails = {
        amount: { inv: inv.amount, ex: tx.amount, score: amountScore },
        date: {
          inv: inv.transactionDate.toISOString().slice(0, 10),
          ex: txDate.toISOString().slice(0, 10),
          diffDays: diff,
          score: dateScore,
        },
        merchant: { inv: invMerchant, ex: exDesc, score: merchantScore },
      };
    }
  }

  if (!bestTx || bestScore < 0.35) {
    return { confidence: 'none', details: {} };
  }

  const confidence: MatchConfidence =
    bestScore >= 0.9 ? 'exact' :
    bestScore >= 0.72 ? 'very_likely' :
    bestScore >= 0.45 ? 'doubtful' : 'none';

  return {
    matchId: bestTx.id,
    confidence,
    matchedTransaction: bestTx,
    details: bestDetails,
  };
}

// ─── Recurrence matching ──────────────────────────────────────────────────────

export interface RecurrenceMatchResult {
  recurrenceId?: string;
  confidence: MatchConfidence;
  recurrence?: Recurrence;
}

export function matchRecurrence(
  inv: C6Transaction,
  recurrences: Recurrence[],
): RecurrenceMatchResult {
  let bestScore = 0;
  let bestRec: Recurrence | undefined;

  const invMerchant = norm(inv.merchantNormalized);

  for (const rec of recurrences) {
    if (!rec.isActive) continue;

    const recBase = norm((rec as any).merchantNormalizedBase ?? rec.name);
    const recName = norm(rec.name);

    // Dice similarity against both base and display name
    const sim1 = diceSimilarity(invMerchant, recBase);
    const sim2 = diceSimilarity(invMerchant, recName);
    let merchantScore = Math.max(sim1, sim2);

    // Prefix match boost: "SHOPEE GUSTAVO COSTA M" starts with "SHOPEE"
    const prefixMatch =
      invMerchant.startsWith(recBase) ||
      recBase.startsWith(invMerchant) ||
      invMerchant.startsWith(recName) ||
      recName.startsWith(invMerchant);
    if (prefixMatch) merchantScore = Math.max(merchantScore, 0.85);

    // Lower threshold: 0.3 so partial names still qualify
    if (merchantScore < 0.3) continue;

    // Amount check
    const tolerance = (rec as any).valueTolerance ?? 0.1;
    let valueScore = 0.5; // neutral when recurrence has no fixed amount
    if (rec.amount > 0) {
      const relDiff = Math.abs(inv.amount - rec.amount) / rec.amount;
      valueScore = relDiff <= tolerance ? 1.0 : relDiff <= 0.2 ? 0.5 : 0.1;
    }

    const score = merchantScore * 0.7 + valueScore * 0.3;

    if (score > bestScore) {
      bestScore = score;
      bestRec = rec;
    }
  }

  if (!bestRec || bestScore < 0.3) {
    return { confidence: 'none' };
  }

  const confidence: MatchConfidence =
    bestScore >= 0.85 ? 'exact' :
    bestScore >= 0.65 ? 'very_likely' :
    bestScore >= 0.45 ? 'doubtful' : 'none';

  return {
    recurrenceId: bestRec.id,
    confidence,
    recurrence: bestRec,
  };
}

// ─── Knowledge base matching ──────────────────────────────────────────────────

export interface KnowledgeMatchResult {
  categoryId?: string;
  subcategoryId?: string;
  recurrenceId?: string;
  confidence: MatchConfidence;
  rule?: CategorizationRule;
}

export function applyKnowledgeBase(
  inv: C6Transaction,
  rules: CategorizationRule[],
): KnowledgeMatchResult {
  let bestScore = 0;
  let bestRule: CategorizationRule | undefined;

  const invMerchant = norm(inv.merchantNormalized);

  for (const rule of rules) {
    if (!rule.isActive) continue;

    const ruleBase = norm(rule.merchantNormalized);
    const similarity = diceSimilarity(invMerchant, ruleBase);

    // Also check for exact prefix match
    const exactPrefix = invMerchant.startsWith(ruleBase) || ruleBase.startsWith(invMerchant);
    const score = exactPrefix ? Math.max(similarity, 0.9) : similarity;

    if (score > bestScore) {
      bestScore = score;
      bestRule = rule;
    }
  }

  if (!bestRule || bestScore < 0.6) {
    return { confidence: 'none' };
  }

  const confidence: MatchConfidence =
    bestScore >= 0.9 ? 'exact' :
    bestScore >= 0.75 ? 'very_likely' :
    bestScore >= 0.6 ? 'doubtful' : 'none';

  return {
    categoryId: bestRule.categoryId,
    subcategoryId: bestRule.subcategoryId,
    recurrenceId: bestRule.recurrenceId,
    confidence,
    rule: bestRule,
  };
}

// ─── Category keyword fallback ────────────────────────────────────────────────

const CATEGORY_KEYWORDS: Record<string, string[]> = {
  'Alimentação': [
    'hortifruti', 'mercado', 'supermercado', 'restaurante', 'ifood', 'ifd',
    'padaria', 'lanchonete', 'pizzaria', 'hamburguer', 'sushi', 'delivery',
    'acai', 'sorveteria', 'churrascaria', 'rappi', 'uber eats', 'acougue',
    'spoleto', 'coco bambu', 'madero',
  ],
  'Transporte': [
    'uber', '99app', '99pop', 'combustivel', 'gasolina', 'estacionamento',
    'pedagio', 'onibus', 'metro', 'taxi', 'posto', 'shell', 'petrobras',
    'ipiranga', 'automob',
  ],
  'Moradia': [
    'aluguel', 'condominio', 'iptu', 'energia', 'enel', 'cemig', 'agua',
    'sabesp', 'gas', 'internet', 'vivo', 'claro', 'tim', 'net',
  ],
  'Saúde': [
    'farmacia', 'drogaria', 'droga', 'medico', 'consulta', 'exame', 'hospital',
    'clinica', 'laboratorio', 'plano de saude', 'unimed', 'drogasil', 'raia',
    'pacheco', 'ultrafarma',
  ],
  'Lazer': [
    'cinema', 'teatro', 'show', 'netflix', 'spotify', 'amazon prime', 'disney',
    'hbo', 'bar', 'parque', 'ingresso', 'globoplay', 'deezer',
  ],
  'Educação': [
    'escola', 'faculdade', 'curso', 'livro', 'colegio', 'universidade',
    'udemy', 'alura',
  ],
  'Compras': [
    'amazon', 'shopee', 'mercado livre', 'shein', 'zara', 'renner',
    'riachuelo', 'americanas', 'magazine', 'hm',
  ],
  'Assinaturas': [
    'openai', 'chatgpt', 'lovable', 'microsoft', 'google', 'adobe', 'canva',
    'apple', 'icloud', 'notion', 'figma', 'github', 'vercel',
  ],
  'Contas/Taxas': [
    'iof', 'juros', 'taxa', 'tarifa', 'multa', 'imposto', 'anuidade',
  ],
};

export function suggestCategoryFromKeywords(
  merchant: string,
  categories: Category[],
): { categoryId?: string } {
  const lower = merchant.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();

  for (const [name, kws] of Object.entries(CATEGORY_KEYWORDS)) {
    if (kws.some(kw => lower.includes(kw))) {
      const cat = categories.find(
        c => c.name.toLowerCase() === name.toLowerCase() && c.type === 'despesa',
      );
      if (cat) return { categoryId: cat.id };
    }
  }

  return {};
}

// ─── Full enrichment pipeline ─────────────────────────────────────────────────

export function enrichTransactions(
  raw: C6Transaction[],
  existing: Transaction[],
  recurrences: Recurrence[],
  rules: CategorizationRule[],
  categories: Category[],
  importId: string,
): {
  enriched: InvoiceTransaction[];
  matches: Omit<TransactionMatch, 'id' | 'createdAt'>[];
  logs: string[];
} {
  const logs: string[] = [];
  const enriched: InvoiceTransaction[] = [];
  const matches: Omit<TransactionMatch, 'id' | 'createdAt'>[] = [];

  // Only consider transactions from last 90 days for duplicate check
  const cutoff = new Date();
  cutoff.setDate(cutoff.getDate() - 90);
  const recentExisting = existing.filter(t => new Date(t.date) >= cutoff);

  logs.push(`[Enrichment] Processing ${raw.length} transactions`);
  logs.push(`[Enrichment] Comparing against ${recentExisting.length} recent transactions`);

  for (const tx of raw) {
    // 1. Duplicate detection
    const dupResult = findBestMatch(tx, recentExisting);

    // 2. Recurrence matching
    const recResult = matchRecurrence(tx, recurrences);

    // 3. Knowledge base
    const kwResult = applyKnowledgeBase(tx, rules);

    // 4. Category suggestion (knowledge base → keywords → default)
    let suggestedCategoryId = kwResult.categoryId;
    if (!suggestedCategoryId) {
      suggestedCategoryId = suggestCategoryFromKeywords(tx.merchantNormalized, categories);
    }

    // Determine review status
    let reviewStatus: InvoiceTransaction['reviewStatus'] = 'pending';
    if (dupResult.confidence === 'exact' || dupResult.confidence === 'very_likely') {
      reviewStatus = 'duplicate';
    } else if (dupResult.confidence === 'doubtful') {
      reviewStatus = 'needs_review';
    }

    const enrichedTx: InvoiceTransaction = {
      ...tx,
      importId,
      suggestedCategoryId: typeof suggestedCategoryId === 'string' ? suggestedCategoryId : (suggestedCategoryId as any)?.categoryId,
      suggestedSubcategoryId: kwResult.subcategoryId,
      existingMatchId: dupResult.matchId,
      existingMatchConfidence: dupResult.confidence,
      suggestedRecurrenceId: recResult.recurrenceId ?? kwResult.recurrenceId,
      recurrenceMatchConfidence: recResult.confidence,
      knowledgeMatchConfidence: kwResult.confidence,
      reviewStatus,
    };

    enriched.push(enrichedTx);

    // Record the match if found
    if (dupResult.matchId) {
      matches.push({
        invoiceTransactionId: tx.id,
        existingTransactionId: dupResult.matchId,
        matchType: dupResult.confidence,
        confidence: dupResult.confidence === 'exact' ? 1.0 :
                   dupResult.confidence === 'very_likely' ? 0.85 :
                   dupResult.confidence === 'doubtful' ? 0.6 : 0.3,
        comparedFields: dupResult.details,
      } as any);
    }

    if (dupResult.confidence !== 'none') {
      logs.push(`[Match] ${tx.merchantNormalized} ${tx.amount} → ${dupResult.confidence}`);
    }
    if (recResult.confidence !== 'none') {
      logs.push(`[Recurrence] ${tx.merchantNormalized} → ${recResult.recurrence?.name} (${recResult.confidence})`);
    }
  }

  const dupCount = enriched.filter(t => t.reviewStatus === 'duplicate').length;
  const recCount = enriched.filter(t => t.suggestedRecurrenceId && t.reviewStatus !== 'duplicate').length;
  logs.push(`[Enrichment] Duplicates: ${dupCount}, Recurrences matched: ${recCount}`);

  return { enriched, matches, logs };
}

// ─── Build review groups ──────────────────────────────────────────────────────

export function buildReviewGroups(transactions: InvoiceTransaction[]): ReviewGroups {
  return {
    alreadyLaunched: transactions.filter(
      t => t.reviewStatus === 'duplicate',
    ),
    recurrenceRecognized: transactions.filter(
      t => t.reviewStatus !== 'duplicate' &&
           t.reviewStatus !== 'ignored' &&
           (t.recurrenceMatchConfidence === 'exact' || t.recurrenceMatchConfidence === 'very_likely'),
    ),
    reversals: transactions.filter(
      t => t.transactionType === 'estorno' &&
           t.reviewStatus !== 'duplicate' &&
           t.reviewStatus !== 'ignored',
    ),
    needsReview: transactions.filter(
      t => t.reviewStatus === 'needs_review' &&
           t.transactionType !== 'estorno',
    ),
    newTransactions: transactions.filter(
      t => t.reviewStatus === 'pending' &&
           t.transactionType !== 'estorno' &&
           t.recurrenceMatchConfidence !== 'exact' &&
           t.recurrenceMatchConfidence !== 'very_likely',
    ),
    ignored: transactions.filter(t => t.reviewStatus === 'ignored'),
  };
}
