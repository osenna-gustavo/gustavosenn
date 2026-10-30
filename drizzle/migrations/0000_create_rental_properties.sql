CREATE TABLE public.rental_properties (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL DEFAULT auth.uid(),
  address text NOT NULL,
  rent_amount numeric NOT NULL DEFAULT 0,
  condo_amount numeric NOT NULL DEFAULT 0,
  photo_url text,
  listing_url text,
  pros text,
  cons text,
  status text NOT NULL DEFAULT 'visitar' CHECK (status IN ('visitar','visitado','descartado')),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.rental_properties TO authenticated;
GRANT ALL ON public.rental_properties TO service_role;
ALTER TABLE public.rental_properties ENABLE ROW LEVEL SECURITY;
CREATE POLICY "rental_select_own" ON public.rental_properties FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "rental_insert_own" ON public.rental_properties FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "rental_update_own" ON public.rental_properties FOR UPDATE TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY "rental_delete_own" ON public.rental_properties FOR DELETE TO authenticated USING (auth.uid() = user_id);
CREATE INDEX rental_properties_user_idx ON public.rental_properties(user_id);
CREATE TRIGGER rental_properties_updated_at BEFORE UPDATE ON public.rental_properties FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();