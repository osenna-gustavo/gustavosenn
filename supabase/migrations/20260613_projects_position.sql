-- Adiciona coluna de posição para permitir reordenar projetos via drag-and-drop
ALTER TABLE public.projects ADD COLUMN IF NOT EXISTS position INTEGER NOT NULL DEFAULT 0;
