ALTER TABLE public.rental_properties ADD COLUMN IF NOT EXISTS visit_at timestamptz;
ALTER TABLE public.rental_properties DROP CONSTRAINT rental_properties_status_check;
UPDATE public.rental_properties SET status = 'agendar_visita' WHERE status = 'visitar';
ALTER TABLE public.rental_properties ALTER COLUMN status SET DEFAULT 'agendar_visita';
ALTER TABLE public.rental_properties ADD CONSTRAINT rental_properties_status_check CHECK (status IN ('agendar_visita', 'visita_agendada', 'visitado', 'descartado'));