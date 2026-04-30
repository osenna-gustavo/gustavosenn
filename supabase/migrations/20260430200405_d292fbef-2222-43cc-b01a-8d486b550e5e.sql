-- Remove duplicate recurrence instances, keeping the "best" one per (recurrence_id, year, month)
-- Priority: confirmed > ignored > pending; tie-break: oldest created_at
WITH ranked AS (
  SELECT id,
         recurrence_id, year, month,
         ROW_NUMBER() OVER (
           PARTITION BY recurrence_id, year, month
           ORDER BY 
             CASE status WHEN 'confirmed' THEN 0 WHEN 'ignored' THEN 1 ELSE 2 END,
             created_at ASC
         ) AS rn
  FROM public.recurrence_instances
)
DELETE FROM public.recurrence_instances ri
USING ranked r
WHERE ri.id = r.id AND r.rn > 1;

-- Prevent duplicates going forward
ALTER TABLE public.recurrence_instances
  ADD CONSTRAINT recurrence_instances_unique_per_month
  UNIQUE (recurrence_id, year, month);