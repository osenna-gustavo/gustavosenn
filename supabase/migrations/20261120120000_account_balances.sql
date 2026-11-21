-- Saldo informado manualmente por conta (painel "Dinheiro na conta x comprometido", 20/11/2026).
-- Aditiva: não altera nenhuma tabela existente. Reverter: DROP TABLE public.account_balances;
CREATE TABLE IF NOT EXISTS public.account_balances (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  account_id uuid NOT NULL REFERENCES public.accounts(id) ON DELETE CASCADE,
  balance numeric(14,2) NOT NULL,
  reference_date date NOT NULL DEFAULT current_date,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS account_balances_user_ref_idx
  ON public.account_balances (user_id, reference_date DESC, created_at DESC);

ALTER TABLE public.account_balances ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users manage own account balances" ON public.account_balances;
CREATE POLICY "Users manage own account balances"
  ON public.account_balances
  FOR ALL
  USING (auth.uid() = user_id)
  WITH CHECK (
    auth.uid() = user_id
    AND EXISTS (SELECT 1 FROM public.accounts a WHERE a.id = account_id AND a.user_id = auth.uid())
  );
