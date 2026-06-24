import { useEffect, useRef } from 'react';

/**
 * Persiste automaticamente um rascunho de formulário no localStorage,
 * para que o usuário não perca dados se a página recarregar antes de salvar.
 *
 * - Salva sempre que `values` muda (debounced) enquanto `enabled` for true.
 * - Restaura via `load()` quando o componente quer reabrir o rascunho.
 * - `clear()` deve ser chamado após salvar de verdade ou descartar.
 */
export function useDraft<T>(key: string, values: T, enabled: boolean) {
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (!enabled) return;
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => {
      try {
        localStorage.setItem(key, JSON.stringify(values));
      } catch {
        // ignora quota / serialização
      }
    }, 300);
    return () => {
      if (timer.current) clearTimeout(timer.current);
    };
  }, [key, values, enabled]);

  const load = (): T | null => {
    try {
      const raw = localStorage.getItem(key);
      if (!raw) return null;
      return JSON.parse(raw) as T;
    } catch {
      return null;
    }
  };

  const clear = () => {
    try {
      localStorage.removeItem(key);
    } catch {
      // ignora
    }
  };

  return { load, clear };
}
