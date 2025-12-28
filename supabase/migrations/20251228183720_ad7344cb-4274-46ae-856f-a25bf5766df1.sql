-- 1) Create budget_allocations table for idempotent budget management
CREATE TABLE public.budget_allocations (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id uuid NOT NULL,
    month integer NOT NULL CHECK (month >= 1 AND month <= 12),
    year integer NOT NULL,
    direction text NOT NULL CHECK (direction IN ('expense', 'income')),
    category_id uuid NOT NULL REFERENCES public.categories(id) ON DELETE CASCADE,
    subcategory_id uuid REFERENCES public.subcategories(id) ON DELETE CASCADE,
    source text NOT NULL CHECK (source IN ('manual', 'recurrence')),
    source_id uuid, -- recurrence_instance_id when source = 'recurrence'
    rule_id uuid REFERENCES public.recurrences(id) ON DELETE CASCADE, -- recurrence rule for reporting
    amount numeric NOT NULL DEFAULT 0,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now(),
    
    -- Unique constraint for idempotent upserts
    CONSTRAINT unique_allocation UNIQUE (user_id, year, month, direction, category_id, subcategory_id, source, source_id)
);

-- Enable RLS
ALTER TABLE public.budget_allocations ENABLE ROW LEVEL SECURITY;

-- RLS Policies
CREATE POLICY "Users can view own allocations"
ON public.budget_allocations
FOR SELECT
USING (auth.uid() = user_id);

CREATE POLICY "Users can create own allocations"
ON public.budget_allocations
FOR INSERT
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own allocations"
ON public.budget_allocations
FOR UPDATE
USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own allocations"
ON public.budget_allocations
FOR DELETE
USING (auth.uid() = user_id);

-- Create index for common queries
CREATE INDEX idx_budget_allocations_user_month ON public.budget_allocations(user_id, year, month);
CREATE INDEX idx_budget_allocations_category ON public.budget_allocations(category_id);
CREATE INDEX idx_budget_allocations_source ON public.budget_allocations(source);

-- 2) Create saved_filters table for persistent filter views
CREATE TABLE public.saved_filters (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id uuid NOT NULL,
    name text NOT NULL,
    screen text NOT NULL CHECK (screen IN ('dashboard', 'transactions', 'budget', 'categories')),
    filters jsonb NOT NULL DEFAULT '{}',
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.saved_filters ENABLE ROW LEVEL SECURITY;

-- RLS Policies
CREATE POLICY "Users can view own saved_filters"
ON public.saved_filters
FOR SELECT
USING (auth.uid() = user_id);

CREATE POLICY "Users can create own saved_filters"
ON public.saved_filters
FOR INSERT
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own saved_filters"
ON public.saved_filters
FOR UPDATE
USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own saved_filters"
ON public.saved_filters
FOR DELETE
USING (auth.uid() = user_id);

-- Create index
CREATE INDEX idx_saved_filters_user_screen ON public.saved_filters(user_id, screen);

-- 3) Function to update updated_at timestamp
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = public;

-- Trigger for budget_allocations
CREATE TRIGGER update_budget_allocations_updated_at
    BEFORE UPDATE ON public.budget_allocations
    FOR EACH ROW
    EXECUTE FUNCTION public.update_updated_at_column();

-- Trigger for saved_filters
CREATE TRIGGER update_saved_filters_updated_at
    BEFORE UPDATE ON public.saved_filters
    FOR EACH ROW
    EXECUTE FUNCTION public.update_updated_at_column();