-- Competência x caixa e ciclos familiares com datas reais por mês.

CREATE TABLE public.financial_cycles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  month INTEGER NOT NULL CHECK (month BETWEEN 0 AND 11),
  year INTEGER NOT NULL,
  start_date DATE NOT NULL,
  end_date DATE NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT financial_cycles_valid_range CHECK (end_date >= start_date),
  CONSTRAINT financial_cycles_unique_month UNIQUE (user_id, month, year)
);

ALTER TABLE public.financial_cycles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage own financial cycles"
  ON public.financial_cycles
  FOR ALL
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE INDEX financial_cycles_user_month_idx
  ON public.financial_cycles (user_id, year, month);

CREATE TRIGGER update_financial_cycles_updated_at
  BEFORE UPDATE ON public.financial_cycles
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

ALTER TABLE public.transactions
  ADD COLUMN payment_method TEXT NOT NULL DEFAULT 'account',
  ADD COLUMN cash_date TIMESTAMPTZ,
  ADD COLUMN affects_budget BOOLEAN NOT NULL DEFAULT TRUE,
  ADD COLUMN affects_cash BOOLEAN NOT NULL DEFAULT TRUE,
  ADD COLUMN credit_card_label TEXT;

ALTER TABLE public.transactions
  ADD CONSTRAINT transactions_payment_method_check
  CHECK (payment_method IN ('account', 'cash', 'debit_card', 'pix', 'credit_card', 'invoice_payment'));

-- Lançamentos antigos representavam despesas/receitas já realizadas e, por
-- compatibilidade, passam a afetar competência e caixa na mesma data.
UPDATE public.transactions
SET cash_date = date
WHERE cash_date IS NULL;

CREATE INDEX transactions_user_cash_date_idx
  ON public.transactions (user_id, cash_date)
  WHERE affects_cash = TRUE;

CREATE INDEX transactions_user_competence_date_idx
  ON public.transactions (user_id, date)
  WHERE affects_budget = TRUE;
