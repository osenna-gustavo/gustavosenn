-- Tabela de categorias
CREATE TABLE public.categories (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  name TEXT NOT NULL,
  type TEXT NOT NULL CHECK (type IN ('receita', 'despesa')),
  icon TEXT,
  is_fixed BOOLEAN DEFAULT FALSE,
  parent_id UUID,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Tabela de subcategorias  
CREATE TABLE public.subcategories (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  category_id UUID REFERENCES public.categories(id) ON DELETE CASCADE NOT NULL,
  name TEXT NOT NULL,
  is_fixed BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Tabela de transações
CREATE TABLE public.transactions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  date TIMESTAMPTZ NOT NULL,
  amount DECIMAL(12,2) NOT NULL,
  type TEXT NOT NULL CHECK (type IN ('receita', 'despesa')),
  category_id UUID REFERENCES public.categories(id) ON DELETE SET NULL,
  subcategory_id UUID REFERENCES public.subcategories(id) ON DELETE SET NULL,
  description TEXT,
  origin TEXT DEFAULT 'manual',
  needs_review BOOLEAN DEFAULT FALSE,
  import_batch_id UUID,
  recurrence_id UUID,
  recurrence_instance_id UUID,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Tabela de orçamentos
CREATE TABLE public.budgets (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  month INTEGER NOT NULL,
  year INTEGER NOT NULL,
  planned_income DECIMAL(12,2) DEFAULT 0,
  planned_expenses DECIMAL(12,2) DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id, month, year)
);

-- Tabela de itens de orçamento por categoria
CREATE TABLE public.budget_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  budget_id UUID REFERENCES public.budgets(id) ON DELETE CASCADE NOT NULL,
  category_id UUID REFERENCES public.categories(id) ON DELETE CASCADE NOT NULL,
  subcategory_id UUID REFERENCES public.subcategories(id) ON DELETE SET NULL,
  planned_amount DECIMAL(12,2) DEFAULT 0
);

-- Tabela de recorrências
CREATE TABLE public.recurrences (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  name TEXT NOT NULL,
  type TEXT NOT NULL CHECK (type IN ('receita', 'despesa')),
  amount DECIMAL(12,2) NOT NULL,
  category_id UUID REFERENCES public.categories(id) ON DELETE SET NULL,
  subcategory_id UUID REFERENCES public.subcategories(id) ON DELETE SET NULL,
  frequency TEXT NOT NULL CHECK (frequency IN ('daily', 'weekly', 'monthly')),
  start_date DATE NOT NULL,
  end_date DATE,
  is_active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Tabela de instâncias de recorrência
CREATE TABLE public.recurrence_instances (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  recurrence_id UUID REFERENCES public.recurrences(id) ON DELETE CASCADE NOT NULL,
  month INTEGER NOT NULL,
  year INTEGER NOT NULL,
  status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'confirmed', 'ignored')),
  linked_transaction_id UUID REFERENCES public.transactions(id) ON DELETE SET NULL,
  amount DECIMAL(12,2) NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Tabela de cenários
CREATE TABLE public.scenarios (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  name TEXT NOT NULL,
  baseline_type TEXT NOT NULL,
  baseline_month INTEGER NOT NULL,
  baseline_year INTEGER NOT NULL,
  monthly_commitments JSONB DEFAULT '[]',
  one_time_costs JSONB DEFAULT '[]',
  category_adjustments JSONB DEFAULT '[]',
  minimum_balance DECIMAL(12,2) DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Tabela de lotes de importação
CREATE TABLE public.import_batches (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  name TEXT NOT NULL,
  type TEXT NOT NULL,
  status TEXT DEFAULT 'pending',
  suggested_transactions JSONB DEFAULT '[]',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Habilitar RLS em todas as tabelas
ALTER TABLE public.categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.subcategories ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.transactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.budgets ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.budget_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.recurrences ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.recurrence_instances ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.scenarios ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.import_batches ENABLE ROW LEVEL SECURITY;

-- Políticas RLS para categories
CREATE POLICY "Users can view own categories" ON public.categories
  FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can create own categories" ON public.categories
  FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own categories" ON public.categories
  FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can delete own categories" ON public.categories
  FOR DELETE USING (auth.uid() = user_id);

-- Políticas RLS para subcategories
CREATE POLICY "Users can view own subcategories" ON public.subcategories
  FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can create own subcategories" ON public.subcategories
  FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own subcategories" ON public.subcategories
  FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can delete own subcategories" ON public.subcategories
  FOR DELETE USING (auth.uid() = user_id);

-- Políticas RLS para transactions
CREATE POLICY "Users can view own transactions" ON public.transactions
  FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can create own transactions" ON public.transactions
  FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own transactions" ON public.transactions
  FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can delete own transactions" ON public.transactions
  FOR DELETE USING (auth.uid() = user_id);

-- Políticas RLS para budgets
CREATE POLICY "Users can view own budgets" ON public.budgets
  FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can create own budgets" ON public.budgets
  FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own budgets" ON public.budgets
  FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can delete own budgets" ON public.budgets
  FOR DELETE USING (auth.uid() = user_id);

-- Políticas RLS para budget_items (acesso via budget)
CREATE POLICY "Users can view own budget_items" ON public.budget_items
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.budgets 
      WHERE budgets.id = budget_items.budget_id 
      AND budgets.user_id = auth.uid()
    )
  );
CREATE POLICY "Users can create own budget_items" ON public.budget_items
  FOR INSERT WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.budgets 
      WHERE budgets.id = budget_items.budget_id 
      AND budgets.user_id = auth.uid()
    )
  );
CREATE POLICY "Users can update own budget_items" ON public.budget_items
  FOR UPDATE USING (
    EXISTS (
      SELECT 1 FROM public.budgets 
      WHERE budgets.id = budget_items.budget_id 
      AND budgets.user_id = auth.uid()
    )
  );
CREATE POLICY "Users can delete own budget_items" ON public.budget_items
  FOR DELETE USING (
    EXISTS (
      SELECT 1 FROM public.budgets 
      WHERE budgets.id = budget_items.budget_id 
      AND budgets.user_id = auth.uid()
    )
  );

-- Políticas RLS para recurrences
CREATE POLICY "Users can view own recurrences" ON public.recurrences
  FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can create own recurrences" ON public.recurrences
  FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own recurrences" ON public.recurrences
  FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can delete own recurrences" ON public.recurrences
  FOR DELETE USING (auth.uid() = user_id);

-- Políticas RLS para recurrence_instances
CREATE POLICY "Users can view own recurrence_instances" ON public.recurrence_instances
  FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can create own recurrence_instances" ON public.recurrence_instances
  FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own recurrence_instances" ON public.recurrence_instances
  FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can delete own recurrence_instances" ON public.recurrence_instances
  FOR DELETE USING (auth.uid() = user_id);

-- Políticas RLS para scenarios
CREATE POLICY "Users can view own scenarios" ON public.scenarios
  FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can create own scenarios" ON public.scenarios
  FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own scenarios" ON public.scenarios
  FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can delete own scenarios" ON public.scenarios
  FOR DELETE USING (auth.uid() = user_id);

-- Políticas RLS para import_batches
CREATE POLICY "Users can view own import_batches" ON public.import_batches
  FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can create own import_batches" ON public.import_batches
  FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own import_batches" ON public.import_batches
  FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can delete own import_batches" ON public.import_batches
  FOR DELETE USING (auth.uid() = user_id);