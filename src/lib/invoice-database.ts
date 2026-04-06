import { supabase } from '@/integrations/supabase/client';
import type {
  InvoiceImport,
  InvoiceTransaction,
  CategorizationRule,
  TransactionMatch,
  RuleOrigin,
} from '@/types/invoice';

// ─── Helpers ──────────────────────────────────────────────────────────────────

async function getUserId(): Promise<string> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error('Not authenticated');
  return user.id;
}

// ─── Invoice Imports ──────────────────────────────────────────────────────────

export async function createInvoiceImport(
  data: Omit<InvoiceImport, 'id' | 'createdAt'>,
): Promise<InvoiceImport> {
  const userId = await getUserId();
  const { data: row, error } = await supabase
    .from('invoice_imports' as any)
    .insert({
      user_id: userId,
      source: data.source,
      competencia: data.competencia,
      file_name: data.fileName,
      file_hash: data.fileHash,
      status: data.status,
      total_extracted: data.totalExtracted,
      total_new: data.totalNew,
      total_duplicates: data.totalDuplicates,
      total_confirmed: data.totalConfirmed,
      processing_log: data.processingLog,
    })
    .select()
    .single();

  if (error) throw error;
  return mapImport(row);
}

export async function updateInvoiceImport(
  id: string,
  updates: Partial<Omit<InvoiceImport, 'id' | 'createdAt'>>,
): Promise<void> {
  const { error } = await supabase
    .from('invoice_imports' as any)
    .update({
      status: updates.status,
      total_extracted: updates.totalExtracted,
      total_new: updates.totalNew,
      total_duplicates: updates.totalDuplicates,
      total_confirmed: updates.totalConfirmed,
      processing_log: updates.processingLog,
    })
    .eq('id', id);

  if (error) throw error;
}

export async function getInvoiceImports(): Promise<InvoiceImport[]> {
  const userId = await getUserId();
  const { data, error } = await supabase
    .from('invoice_imports' as any)
    .select('*')
    .eq('user_id', userId)
    .order('created_at', { ascending: false });

  if (error) throw error;
  return (data ?? []).map(mapImport);
}

function mapImport(row: any): InvoiceImport {
  return {
    id: row.id,
    source: row.source,
    competencia: row.competencia,
    fileName: row.file_name,
    fileHash: row.file_hash,
    status: row.status,
    totalExtracted: row.total_extracted ?? 0,
    totalNew: row.total_new ?? 0,
    totalDuplicates: row.total_duplicates ?? 0,
    totalConfirmed: row.total_confirmed ?? 0,
    processingLog: row.processing_log ?? [],
    createdAt: new Date(row.created_at),
  };
}

// ─── Invoice Transactions ─────────────────────────────────────────────────────

export async function saveInvoiceTransactions(
  txs: InvoiceTransaction[],
): Promise<void> {
  const userId = await getUserId();
  const rows = txs.map(t => ({
    id: t.id,
    user_id: userId,
    import_id: t.importId,
    transaction_date: t.transactionDate.toISOString().slice(0, 10),
    description_original: t.descriptionOriginal,
    merchant_normalized: t.merchantNormalized,
    amount: t.amount,
    currency: t.currency,
    transaction_type: t.transactionType,
    card_name: t.cardName,
    card_last_four: t.cardLastFour,
    card_holder: t.cardHolder,
    card_type: t.cardType,
    is_installment: t.isInstallment,
    installment_current: t.installmentCurrent,
    installment_total: t.installmentTotal,
    suggested_category_id: t.suggestedCategoryId,
    suggested_subcategory_id: t.suggestedSubcategoryId,
    suggested_recurrence_id: t.suggestedRecurrenceId,
    existing_match_id: t.existingMatchId,
    existing_match_confidence: t.existingMatchConfidence,
    recurrence_match_confidence: t.recurrenceMatchConfidence,
    knowledge_match_confidence: t.knowledgeMatchConfidence,
    review_status: t.reviewStatus,
    ignore_reason: t.ignoreReason,
    linked_transaction_id: t.linkedTransactionId,
  }));

  const { error } = await supabase
    .from('invoice_transactions' as any)
    .upsert(rows);

  if (error) throw error;
}

export async function updateInvoiceTransactionStatus(
  id: string,
  status: InvoiceTransaction['reviewStatus'],
  linkedTransactionId?: string,
): Promise<void> {
  const { error } = await supabase
    .from('invoice_transactions' as any)
    .update({
      review_status: status,
      linked_transaction_id: linkedTransactionId,
    })
    .eq('id', id);

  if (error) throw error;
}

export async function getInvoiceTransactions(
  importId: string,
): Promise<InvoiceTransaction[]> {
  const { data, error } = await supabase
    .from('invoice_transactions' as any)
    .select('*')
    .eq('import_id', importId)
    .order('transaction_date', { ascending: true });

  if (error) throw error;
  return (data ?? []).map(mapInvoiceTransaction);
}

function mapInvoiceTransaction(row: any): InvoiceTransaction {
  return {
    id: row.id,
    importId: row.import_id,
    transactionDate: new Date(row.transaction_date),
    descriptionOriginal: row.description_original,
    merchantNormalized: row.merchant_normalized ?? '',
    amount: parseFloat(row.amount),
    currency: row.currency ?? 'BRL',
    transactionType: row.transaction_type,
    cardName: row.card_name ?? '',
    cardLastFour: row.card_last_four ?? '',
    cardHolder: row.card_holder ?? '',
    cardType: row.card_type ?? 'principal',
    isInstallment: row.is_installment ?? false,
    installmentCurrent: row.installment_current,
    installmentTotal: row.installment_total,
    suggestedCategoryId: row.suggested_category_id,
    suggestedSubcategoryId: row.suggested_subcategory_id,
    suggestedRecurrenceId: row.suggested_recurrence_id,
    existingMatchId: row.existing_match_id,
    existingMatchConfidence: row.existing_match_confidence ?? 'none',
    recurrenceMatchConfidence: row.recurrence_match_confidence ?? 'none',
    knowledgeMatchConfidence: row.knowledge_match_confidence ?? 'none',
    reviewStatus: row.review_status ?? 'pending',
    ignoreReason: row.ignore_reason,
    linkedTransactionId: row.linked_transaction_id,
    rawLine: '',
    parsedAt: new Date(row.created_at),
  };
}

// ─── Categorization Rules ─────────────────────────────────────────────────────

export async function getCategorizationRules(): Promise<CategorizationRule[]> {
  const userId = await getUserId();
  const { data, error } = await supabase
    .from('categorization_rules' as any)
    .select('*')
    .eq('user_id', userId)
    .eq('is_active', true)
    .order('usage_count', { ascending: false });

  if (error) throw error;
  return (data ?? []).map(mapRule);
}

export async function saveCategorizationRule(
  merchantNormalized: string,
  categoryId: string | undefined,
  subcategoryId: string | undefined,
  recurrenceId: string | undefined,
  origin: RuleOrigin,
  descriptionExample?: string,
): Promise<CategorizationRule> {
  const userId = await getUserId();

  // Check if rule exists for this merchant
  const { data: existing } = await (supabase
    .from('categorization_rules' as any)
    .select('id, usage_count')
    .eq('user_id', userId)
    .eq('merchant_normalized', merchantNormalized)
    .eq('is_active', true)
    .maybeSingle() as any);

  if (existing) {
    const { data, error } = await supabase
      .from('categorization_rules' as any)
      .update({
        category_id: categoryId,
        subcategory_id: subcategoryId,
        recurrence_id: recurrenceId,
        origin,
        usage_count: (existing.usage_count ?? 0) + 1,
        last_used_at: new Date().toISOString(),
        confidence: origin === 'manual' ? 0.95 : 0.80,
      })
      .eq('id', existing.id)
      .select()
      .single();

    if (error) throw error;
    return mapRule(data);
  }

  const { data, error } = await supabase
    .from('categorization_rules' as any)
    .insert({
      user_id: userId,
      merchant_normalized: merchantNormalized,
      description_example: descriptionExample,
      category_id: categoryId,
      subcategory_id: subcategoryId,
      recurrence_id: recurrenceId,
      confidence: origin === 'manual' ? 0.95 : 0.80,
      origin,
      usage_count: 1,
      last_used_at: new Date().toISOString(),
      is_active: true,
    })
    .select()
    .single();

  if (error) throw error;
  return mapRule(data);
}

export async function incrementRuleUsage(ruleId: string): Promise<void> {
  const { error } = await supabase
    .from('categorization_rules' as any)
    .update({
      usage_count: supabase.rpc('increment' as any, { row_id: ruleId }),
      last_used_at: new Date().toISOString(),
    })
    .eq('id', ruleId);

  if (error) {
    // Fallback: manual increment
    const { data } = await supabase
      .from('categorization_rules' as any)
      .select('usage_count')
      .eq('id', ruleId)
      .single();
    if (data) {
      await supabase
        .from('categorization_rules' as any)
        .update({ usage_count: (data.usage_count ?? 0) + 1, last_used_at: new Date().toISOString() })
        .eq('id', ruleId);
    }
  }
}

function mapRule(row: any): CategorizationRule {
  return {
    id: row.id,
    merchantNormalized: row.merchant_normalized,
    descriptionExample: row.description_example,
    categoryId: row.category_id,
    subcategoryId: row.subcategory_id,
    recurrenceId: row.recurrence_id,
    confidence: parseFloat(row.confidence ?? '0.8'),
    origin: row.origin ?? 'manual',
    usageCount: row.usage_count ?? 0,
    lastUsedAt: row.last_used_at ? new Date(row.last_used_at) : undefined,
    isActive: row.is_active ?? true,
    createdAt: new Date(row.created_at),
  };
}

// ─── Transaction Matches ──────────────────────────────────────────────────────

export async function saveTransactionMatches(
  matches: Omit<TransactionMatch, 'id' | 'createdAt'>[],
): Promise<void> {
  if (matches.length === 0) return;
  const userId = await getUserId();

  const rows = matches.map(m => ({
    user_id: userId,
    invoice_transaction_id: m.invoiceTransactionId,
    existing_transaction_id: m.existingTransactionId,
    match_type: m.matchType,
    confidence: m.confidence,
    compared_fields: m.comparedFields,
  }));

  const { error } = await supabase
    .from('transaction_matches' as any)
    .insert(rows);

  if (error) {
    console.warn('[Invoice] Could not save match records:', error.message);
  }
}
