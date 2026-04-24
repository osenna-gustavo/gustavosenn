-- Add total_installments column to recurrences table
-- A recurrence with total_installments set is treated as an installment plan (parcelamento)
ALTER TABLE public.recurrences ADD COLUMN IF NOT EXISTS total_installments INTEGER;
