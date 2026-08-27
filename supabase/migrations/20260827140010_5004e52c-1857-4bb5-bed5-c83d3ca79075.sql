-- 1) financial_cycles
CREATE TABLE IF NOT EXISTS public.financial_cycles (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  month integer NOT NULL CHECK (month >= 0 AND month <= 11),
  year integer NOT NULL CHECK (year >= 1970 AND year <= 3000),
  start_date date NOT NULL,
  end_date date NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT financial_cycles_user_month_year_key UNIQUE (user_id, month, year)
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.financial_cycles TO authenticated;
GRANT ALL ON public.financial_cycles TO service_role;

ALTER TABLE public.financial_cycles ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view own financial cycles" ON public.financial_cycles;
CREATE POLICY "Users can view own financial cycles" ON public.financial_cycles
  FOR SELECT TO authenticated USING (auth.uid() = user_id);
DROP POLICY IF EXISTS "Users can create own financial cycles" ON public.financial_cycles;
CREATE POLICY "Users can create own financial cycles" ON public.financial_cycles
  FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
DROP POLICY IF EXISTS "Users can update own financial cycles" ON public.financial_cycles;
CREATE POLICY "Users can update own financial cycles" ON public.financial_cycles
  FOR UPDATE TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
DROP POLICY IF EXISTS "Users can delete own financial cycles" ON public.financial_cycles;
CREATE POLICY "Users can delete own financial cycles" ON public.financial_cycles
  FOR DELETE TO authenticated USING (auth.uid() = user_id);

DROP TRIGGER IF EXISTS update_financial_cycles_updated_at ON public.financial_cycles;
CREATE TRIGGER update_financial_cycles_updated_at
  BEFORE UPDATE ON public.financial_cycles
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- 2) new transaction columns (additive, backfilled)
ALTER TABLE public.transactions
  ADD COLUMN IF NOT EXISTS payment_method text NOT NULL DEFAULT 'account',
  ADD COLUMN IF NOT EXISTS cash_date timestamptz,
  ADD COLUMN IF NOT EXISTS affects_budget boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS affects_cash boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS credit_card_label text;

UPDATE public.transactions SET cash_date = date WHERE cash_date IS NULL;

ALTER TABLE public.transactions DROP CONSTRAINT IF EXISTS transactions_payment_method_check;
ALTER TABLE public.transactions ADD CONSTRAINT transactions_payment_method_check
  CHECK (payment_method IN ('account','cash','debit_card','pix','credit_card','invoice_payment'));

CREATE INDEX IF NOT EXISTS transactions_user_cash_date_idx
  ON public.transactions (user_id, cash_date);
CREATE INDEX IF NOT EXISTS transactions_user_date_idx
  ON public.transactions (user_id, date);
CREATE INDEX IF NOT EXISTS financial_cycles_user_period_idx
  ON public.financial_cycles (user_id, year, month);