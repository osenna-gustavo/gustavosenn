// ─── C6 Transaction Types ─────────────────────────────────────────────────────

export type C6TransactionType =
  | 'compra'
  | 'estorno'
  | 'pagamento_fatura'
  | 'ajuste'
  | 'tarifa'
  | 'iof'
  | 'outro';

export type CardType = 'principal' | 'virtual' | 'adicional';

export type MatchConfidence = 'exact' | 'very_likely' | 'doubtful' | 'none';

export type ReviewStatus =
  | 'pending'
  | 'confirmed'
  | 'ignored'
  | 'duplicate'
  | 'needs_review';

export type RuleOrigin = 'manual' | 'learned' | 'inherited' | 'system';

// ─── C6 Card info parsed from invoice ────────────────────────────────────────

export interface C6CardInfo {
  name: string;
  lastFour: string;
  holder: string;
  type: CardType;
}

// ─── C6 Transaction (raw parser output) ──────────────────────────────────────

export interface C6Transaction {
  id: string;

  // Date
  transactionDate: Date;

  // Description
  descriptionOriginal: string;
  merchantNormalized: string;

  // Value
  amount: number;
  currency: string;

  // Classification
  transactionType: C6TransactionType;

  // Card info
  cardName: string;
  cardLastFour: string;
  cardHolder: string;
  cardType: CardType;

  // Installments
  isInstallment: boolean;
  installmentCurrent?: number;
  installmentTotal?: number;

  // Parser metadata
  rawLine: string;
  parsedAt: Date;
}

// ─── Enriched invoice transaction (after matching) ───────────────────────────

export interface InvoiceTransaction extends C6Transaction {
  importId: string;

  // Category suggestion
  suggestedCategoryId?: string;
  suggestedSubcategoryId?: string;

  // Matching results
  existingMatchId?: string;
  existingMatchConfidence: MatchConfidence;

  suggestedRecurrenceId?: string;
  recurrenceMatchConfidence: MatchConfidence;

  knowledgeMatchConfidence: MatchConfidence;

  // Review
  reviewStatus: ReviewStatus;
  ignoreReason?: string;
  linkedTransactionId?: string;
}

// ─── Invoice Import session ───────────────────────────────────────────────────

export interface InvoiceImport {
  id: string;
  source: string;
  competencia?: string;
  fileName?: string;
  fileHash?: string;
  status: 'pending' | 'processing' | 'reviewed' | 'confirmed';
  totalExtracted: number;
  totalNew: number;
  totalDuplicates: number;
  totalConfirmed: number;
  processingLog: string[];
  createdAt: Date;
}

// ─── Categorization rule (knowledge base) ────────────────────────────────────

export interface CategorizationRule {
  id: string;
  merchantNormalized: string;
  descriptionExample?: string;
  categoryId?: string;
  subcategoryId?: string;
  recurrenceId?: string;
  confidence: number;
  origin: RuleOrigin;
  usageCount: number;
  lastUsedAt?: Date;
  isActive: boolean;
  createdAt: Date;
}

// ─── Transaction match record ─────────────────────────────────────────────────

export interface TransactionMatch {
  id: string;
  invoiceTransactionId: string;
  existingTransactionId: string;
  matchType: MatchConfidence;
  confidence: number;
  comparedFields: {
    amount?: { inv: number; ex: number; score: number };
    date?: { inv: string; ex: string; diffDays: number; score: number };
    merchant?: { inv: string; ex: string; score: number };
    installment?: { inv: string; ex: string; score: number };
  };
  createdAt: Date;
}

// ─── Review groups for the UI ─────────────────────────────────────────────────

export interface ReviewGroups {
  alreadyLaunched: InvoiceTransaction[];    // exact + very_likely duplicates
  recurrenceRecognized: InvoiceTransaction[]; // matched a recurrence
  newTransactions: InvoiceTransaction[];    // no match, ready to launch
  needsReview: InvoiceTransaction[];        // doubtful matches
  reversals: InvoiceTransaction[];          // estornos
  ignored: InvoiceTransaction[];            // manually ignored
}

// ─── C6 parse result ─────────────────────────────────────────────────────────

export interface C6ParseResult {
  transactions: C6Transaction[];
  cards: C6CardInfo[];
  logs: string[];
  totalLinesProcessed: number;
  totalSectionsFound: number;
}

// ─── Recurrence with matching fields (extended) ───────────────────────────────

export interface RecurrenceMatchingRule {
  recurrenceId: string;
  merchantNormalizedBase: string;
  valueTolerance: number;
  name: string;
  categoryId: string;
  subcategoryId?: string;
}
