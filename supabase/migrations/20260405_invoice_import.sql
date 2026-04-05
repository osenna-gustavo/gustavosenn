-- ═══════════════════════════════════════════════════════════════════════════
-- Invoice Import Feature
-- Apply in: Supabase Dashboard > SQL Editor > Run
-- ═══════════════════════════════════════════════════════════════════════════

-- 1. Extend recurrences with merchant matching fields
ALTER TABLE recurrences
  ADD COLUMN IF NOT EXISTS merchant_normalized_base TEXT,
  ADD COLUMN IF NOT EXISTS value_tolerance         DECIMAL(5,2) DEFAULT 0.05,
  ADD COLUMN IF NOT EXISTS last_match_at           TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS match_count             INTEGER DEFAULT 0;

-- 2. Invoice import sessions
CREATE TABLE IF NOT EXISTS invoice_imports (
  id                UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id           UUID        REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  source            TEXT        NOT NULL,          -- 'c6-fatura' | 'nubank-fatura' etc.
  competencia       TEXT,                          -- '2026-03'
  file_name         TEXT,
  file_hash         TEXT,
  status            TEXT        NOT NULL DEFAULT 'pending',
  total_extracted   INTEGER     DEFAULT 0,
  total_new         INTEGER     DEFAULT 0,
  total_duplicates  INTEGER     DEFAULT 0,
  total_confirmed   INTEGER     DEFAULT 0,
  processing_log    JSONB       DEFAULT '[]',
  created_at        TIMESTAMPTZ DEFAULT now()
);

-- 3. Individual transactions extracted from a C6 invoice
CREATE TABLE IF NOT EXISTS invoice_transactions (
  id                          UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id                     UUID        REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  import_id                   UUID        REFERENCES invoice_imports(id) ON DELETE CASCADE NOT NULL,
  transaction_date            DATE        NOT NULL,
  description_original        TEXT        NOT NULL,
  merchant_normalized         TEXT,
  amount                      DECIMAL(12,2) NOT NULL,
  currency                    TEXT        DEFAULT 'BRL',
  transaction_type            TEXT        NOT NULL DEFAULT 'compra',
  card_name                   TEXT,
  card_last_four              TEXT,
  card_holder                 TEXT,
  card_type                   TEXT        DEFAULT 'principal',
  is_installment              BOOLEAN     DEFAULT false,
  installment_current         INTEGER,
  installment_total           INTEGER,
  suggested_category_id       UUID        REFERENCES categories(id) ON DELETE SET NULL,
  suggested_subcategory_id    UUID        REFERENCES subcategories(id) ON DELETE SET NULL,
  suggested_recurrence_id     UUID        REFERENCES recurrences(id) ON DELETE SET NULL,
  existing_match_id           UUID        REFERENCES transactions(id) ON DELETE SET NULL,
  existing_match_confidence   TEXT        DEFAULT 'none',
  recurrence_match_confidence TEXT        DEFAULT 'none',
  knowledge_match_confidence  TEXT        DEFAULT 'none',
  review_status               TEXT        DEFAULT 'pending',
  ignore_reason               TEXT,
  linked_transaction_id       UUID        REFERENCES transactions(id) ON DELETE SET NULL,
  created_at                  TIMESTAMPTZ DEFAULT now()
);

-- 4. Categorization knowledge base
CREATE TABLE IF NOT EXISTS categorization_rules (
  id                   UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id              UUID        REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  merchant_normalized  TEXT        NOT NULL,
  description_example  TEXT,
  category_id          UUID        REFERENCES categories(id) ON DELETE SET NULL,
  subcategory_id       UUID        REFERENCES subcategories(id) ON DELETE SET NULL,
  recurrence_id        UUID        REFERENCES recurrences(id) ON DELETE SET NULL,
  confidence           DECIMAL(3,2) DEFAULT 0.80,
  origin               TEXT        DEFAULT 'manual',
  usage_count          INTEGER     DEFAULT 0,
  last_used_at         TIMESTAMPTZ,
  is_active            BOOLEAN     DEFAULT true,
  created_at           TIMESTAMPTZ DEFAULT now()
);

-- 5. Match audit trail
CREATE TABLE IF NOT EXISTS transaction_matches (
  id                       UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id                  UUID        REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  invoice_transaction_id   UUID        REFERENCES invoice_transactions(id) ON DELETE CASCADE NOT NULL,
  existing_transaction_id  UUID        REFERENCES transactions(id) ON DELETE CASCADE NOT NULL,
  match_type               TEXT        NOT NULL,
  confidence               DECIMAL(3,2),
  compared_fields          JSONB,
  created_at               TIMESTAMPTZ DEFAULT now()
);

-- ── RLS ──────────────────────────────────────────────────────────────────────
ALTER TABLE invoice_imports      ENABLE ROW LEVEL SECURITY;
ALTER TABLE invoice_transactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE categorization_rules ENABLE ROW LEVEL SECURITY;
ALTER TABLE transaction_matches  ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users manage own invoice imports"
  ON invoice_imports FOR ALL
  USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users manage own invoice transactions"
  ON invoice_transactions FOR ALL
  USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users manage own categorization rules"
  ON categorization_rules FOR ALL
  USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users manage own transaction matches"
  ON transaction_matches FOR ALL
  USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

-- ── Indexes ───────────────────────────────────────────────────────────────────
CREATE INDEX IF NOT EXISTS idx_inv_tx_import_id   ON invoice_transactions(import_id);
CREATE INDEX IF NOT EXISTS idx_inv_tx_merchant    ON invoice_transactions(merchant_normalized);
CREATE INDEX IF NOT EXISTS idx_inv_tx_status      ON invoice_transactions(review_status);
CREATE INDEX IF NOT EXISTS idx_cat_rules_merchant ON categorization_rules(merchant_normalized);
CREATE INDEX IF NOT EXISTS idx_tx_matches_inv     ON transaction_matches(invoice_transaction_id);
