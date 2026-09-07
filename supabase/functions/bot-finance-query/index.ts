import { createClient } from 'npm:@supabase/supabase-js@2';
import { corsHeaders } from 'npm:@supabase/supabase-js@2/cors';

const USER_ID = 'b1eee72b-9814-461e-bde7-3b8ff8a47004';

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });

const ok = (data: unknown) => json({ ok: true, data });
const fail = (error: string, status = 400) => json({ ok: false, error }, status);

const supabase = createClient(
  Deno.env.get('SUPABASE_URL')!,
  Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
  { auth: { persistSession: false } },
);

function pad(n: number) {
  return String(n).padStart(2, '0');
}

/** Janela de competência: usa financial_cycles se existir, senão o billing_close_day do usuário (fallback 20). */
async function getPeriod(month: number, year: number) {
  const { data: cycle } = await supabase
    .from('financial_cycles')
    .select('start_date, end_date')
    .eq('user_id', USER_ID)
    .eq('month', month)
    .eq('year', year)
    .maybeSingle();

  if (cycle?.start_date && cycle?.end_date) {
    return { start: `${cycle.start_date}T00:00:00.000Z`, end: `${cycle.end_date}T23:59:59.999Z` };
  }

  const { data: settings } = await supabase
    .from('user_settings')
    .select('billing_close_day')
    .eq('user_id', USER_ID)
    .maybeSingle();

  const closeDay = settings?.billing_close_day ?? 20;
  const lastDay = new Date(Date.UTC(year, month + 1, 0)).getUTCDate();
  const endDay = Math.min(closeDay, lastDay);
  const end = `${year}-${pad(month + 1)}-${pad(endDay)}T23:59:59.999Z`;

  const startDate = new Date(Date.UTC(year, month - 1, closeDay + 1));
  const start = `${startDate.getUTCFullYear()}-${pad(startDate.getUTCMonth() + 1)}-${pad(startDate.getUTCDate())}T00:00:00.000Z`;

  return { start, end };
}

function validMonthYear(params: Record<string, unknown>) {
  const mes = Number(params.mes);
  const ano = Number(params.ano);
  if (!Number.isInteger(mes) || mes < 1 || mes > 12) return { error: 'Parâmetro "mes" inválido (1-12).' };
  if (!Number.isInteger(ano) || ano < 2000 || ano > 2100) return { error: 'Parâmetro "ano" inválido.' };
  return { month: mes - 1, year: ano };
}

async function loadCategories() {
  const { data: cats } = await supabase
    .from('categories')
    .select('id, name, type')
    .eq('user_id', USER_ID);
  const { data: subs } = await supabase
    .from('subcategories')
    .select('id, name, category_id')
    .eq('user_id', USER_ID);
  return {
    catById: new Map((cats ?? []).map((c) => [c.id, c])),
    subById: new Map((subs ?? []).map((s) => [s.id, s])),
    cats: cats ?? [],
    subs: subs ?? [],
  };
}

async function loadTransactions(month: number, year: number) {
  const { start, end } = await getPeriod(month, year);
  const { data, error } = await supabase
    .from('transactions')
    .select('id, date, amount, type, category_id, subcategory_id, description, payment_method, affects_budget')
    .eq('user_id', USER_ID)
    .gte('date', start)
    .lte('date', end)
    .order('date', { ascending: true });
  if (error) throw new Error(error.message);
  return data ?? [];
}

async function loadPlanned(month: number, year: number) {
  const { data: budget } = await supabase
    .from('budgets')
    .select('id, planned_income, planned_expenses')
    .eq('user_id', USER_ID)
    .eq('month', month)
    .eq('year', year)
    .maybeSingle();

  let items: { category_id: string; subcategory_id: string | null; planned_amount: number }[] = [];
  if (budget?.id) {
    const { data } = await supabase
      .from('budget_items')
      .select('category_id, subcategory_id, planned_amount')
      .eq('budget_id', budget.id);
    items = (data ?? []) as typeof items;
  }
  return { budget, items };
}

async function handle(action: string, params: Record<string, unknown>) {
  switch (action) {
    case 'resumo_mes': {
      const mv = validMonthYear(params);
      if ('error' in mv) return fail(mv.error);
      const txs = await loadTransactions(mv.month, mv.year);
      const receitas = txs.filter((t) => t.type === 'receita').reduce((s, t) => s + Number(t.amount), 0);
      const despesas = txs
        .filter((t) => t.type === 'despesa' && t.affects_budget !== false)
        .reduce((s, t) => s + Number(t.amount), 0);
      const periodo = await getPeriod(mv.month, mv.year);
      return ok({
        mes: mv.month + 1,
        ano: mv.year,
        periodo,
        total_receitas: receitas,
        total_despesas: despesas,
        saldo: receitas - despesas,
        quantidade_lancamentos: txs.length,
      });
    }

    case 'gastos_por_categoria': {
      const mv = validMonthYear(params);
      if ('error' in mv) return fail(mv.error);
      const [txs, { catById, subById }, planned] = await Promise.all([
        loadTransactions(mv.month, mv.year),
        loadCategories(),
        loadPlanned(mv.month, mv.year),
      ]);

      const map = new Map<string, {
        categoria: string; subcategoria: string | null; gasto: number; planejado: number;
      }>();
      const keyOf = (c: string | null, s: string | null) => `${c ?? '-'}|${s ?? '-'}`;
      const ensure = (c: string | null, s: string | null) => {
        const k = keyOf(c, s);
        if (!map.has(k)) {
          map.set(k, {
            categoria: (c && catById.get(c)?.name) || 'Sem categoria',
            subcategoria: (s && subById.get(s)?.name) || null,
            gasto: 0,
            planejado: 0,
          });
        }
        return map.get(k)!;
      };

      for (const t of txs) {
        if (t.type !== 'despesa' || t.affects_budget === false) continue;
        ensure(t.category_id, t.subcategory_id).gasto += Number(t.amount);
      }
      for (const i of planned.items) {
        ensure(i.category_id, i.subcategory_id).planejado += Number(i.planned_amount ?? 0);
      }

      return ok(
        [...map.values()]
          .map((r) => ({ ...r, saldo: r.planejado - r.gasto }))
          .sort((a, b) => b.gasto - a.gasto),
      );
    }

    case 'transacoes': {
      const mv = validMonthYear(params);
      if ('error' in mv) return fail(mv.error);
      const [txs, { catById, subById }] = await Promise.all([
        loadTransactions(mv.month, mv.year),
        loadCategories(),
      ]);

      const categoria = typeof params.categoria === 'string' ? params.categoria.toLowerCase() : null;
      const subcategoria = typeof params.subcategoria === 'string' ? params.subcategoria.toLowerCase() : null;
      const busca = typeof params.busca === 'string' ? params.busca.toLowerCase() : null;

      const result = txs
        .map((t) => ({
          data: t.date,
          descricao: t.description ?? '',
          categoria: (t.category_id && catById.get(t.category_id)?.name) || null,
          subcategoria: (t.subcategory_id && subById.get(t.subcategory_id)?.name) || null,
          valor: Number(t.amount),
          tipo: t.type,
          forma_pagamento: t.payment_method,
        }))
        .filter((t) => {
          if (categoria && !(t.categoria ?? '').toLowerCase().includes(categoria)) return false;
          if (subcategoria && !(t.subcategoria ?? '').toLowerCase().includes(subcategoria)) return false;
          if (busca && !t.descricao.toLowerCase().includes(busca)) return false;
          return true;
        });

      return ok(result);
    }

    case 'recorrencias_pendentes': {
      const mv = validMonthYear(params);
      if ('error' in mv) return fail(mv.error);
      const { catById } = await loadCategories();

      const { data: instances, error } = await supabase
        .from('recurrence_instances')
        .select('id, recurrence_id, amount, status')
        .eq('user_id', USER_ID)
        .eq('month', mv.month)
        .eq('year', mv.year)
        .eq('status', 'pending');
      if (error) throw new Error(error.message);

      const ids = [...new Set((instances ?? []).map((i) => i.recurrence_id))];
      const { data: recs } = ids.length
        ? await supabase
            .from('recurrences')
            .select('id, name, type, amount, category_id, is_active')
            .eq('user_id', USER_ID)
            .in('id', ids)
        : { data: [] as never[] };
      const recById = new Map((recs ?? []).map((r) => [r.id, r]));

      return ok(
        (instances ?? []).map((i) => {
          const r = recById.get(i.recurrence_id);
          return {
            nome: r?.name ?? 'Recorrência',
            tipo: r?.type ?? null,
            categoria: (r?.category_id && catById.get(r.category_id)?.name) || null,
            valor_esperado: Number(i.amount ?? r?.amount ?? 0),
            status: i.status,
          };
        }),
      );
    }

    case 'parcelamentos_ativos': {
      const { catById } = await loadCategories();
      const { data: plans, error } = await supabase
        .from('installments')
        .select('id, name, installment_amount, total_installments, first_payment_date, category_id, is_active')
        .eq('user_id', USER_ID)
        .eq('is_active', true);
      if (error) throw new Error(error.message);

      const { data: paid } = await supabase
        .from('transactions')
        .select('installment_id')
        .eq('user_id', USER_ID)
        .not('installment_id', 'is', null);

      const paidCount = new Map<string, number>();
      for (const p of paid ?? []) {
        if (!p.installment_id) continue;
        paidCount.set(p.installment_id, (paidCount.get(p.installment_id) ?? 0) + 1);
      }

      return ok(
        (plans ?? [])
          .map((p) => {
            const pagas = paidCount.get(p.id) ?? 0;
            return {
              nome: p.name,
              parcela_atual: Math.min(pagas + 1, p.total_installments),
              parcelas_pagas: pagas,
              total_parcelas: p.total_installments,
              valor_parcela: Number(p.installment_amount),
              categoria: (p.category_id && catById.get(p.category_id)?.name) || null,
              primeira_parcela: p.first_payment_date,
              quitado: pagas >= p.total_installments,
            };
          })
          .filter((p) => !p.quitado),
      );
    }

    case 'orcamento_vs_realizado': {
      const mv = validMonthYear(params);
      if ('error' in mv) return fail(mv.error);
      const [txs, { catById }, planned] = await Promise.all([
        loadTransactions(mv.month, mv.year),
        loadCategories(),
        loadPlanned(mv.month, mv.year),
      ]);

      const realizadoPorCat = new Map<string, number>();
      for (const t of txs) {
        if (t.type !== 'despesa' || t.affects_budget === false) continue;
        const k = t.category_id ?? '-';
        realizadoPorCat.set(k, (realizadoPorCat.get(k) ?? 0) + Number(t.amount));
      }

      const planejadoPorCat = new Map<string, number>();
      for (const i of planned.items) {
        const k = i.category_id ?? '-';
        planejadoPorCat.set(k, (planejadoPorCat.get(k) ?? 0) + Number(i.planned_amount ?? 0));
      }

      const keys = new Set([...realizadoPorCat.keys(), ...planejadoPorCat.keys()]);
      const porCategoria = [...keys].map((k) => {
        const planejado = planejadoPorCat.get(k) ?? 0;
        const realizado = realizadoPorCat.get(k) ?? 0;
        return {
          categoria: catById.get(k)?.name ?? 'Sem categoria',
          planejado,
          realizado,
          diferenca: planejado - realizado,
          percentual: planejado > 0 ? Math.round((realizado / planejado) * 100) : null,
        };
      }).sort((a, b) => b.realizado - a.realizado);

      const totalPlanejado = porCategoria.reduce((s, c) => s + c.planejado, 0);
      const totalRealizado = porCategoria.reduce((s, c) => s + c.realizado, 0);
      const receitasRealizadas = txs
        .filter((t) => t.type === 'receita')
        .reduce((s, t) => s + Number(t.amount), 0);

      return ok({
        mes: mv.month + 1,
        ano: mv.year,
        total: {
          receita_planejada: Number(planned.budget?.planned_income ?? 0),
          receita_realizada: receitasRealizadas,
          despesa_planejada: Number(planned.budget?.planned_expenses ?? 0) || totalPlanejado,
          despesa_realizada: totalRealizado,
          diferenca: (Number(planned.budget?.planned_expenses ?? 0) || totalPlanejado) - totalRealizado,
        },
        por_categoria: porCategoria,
      });
    }

    default:
      return fail(`Action desconhecida: "${action}".`, 400);
  }
}

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const expected = Deno.env.get('BOT_SHARED_SECRET');
    if (!expected) return fail('BOT_SHARED_SECRET não configurado.', 500);

    const auth = req.headers.get('Authorization') ?? '';
    if (auth !== `Bearer ${expected}`) {
      return fail('Não autorizado.', 401);
    }

    let body: Record<string, unknown>;
    try {
      body = await req.json();
    } catch {
      return fail('Corpo da requisição deve ser JSON válido.');
    }

    const action = typeof body.action === 'string' ? body.action : '';
    if (!action) return fail('Parâmetro "action" é obrigatório.');

    return await handle(action, body);
  } catch (error) {
    console.error('[bot-finance-query] Error:', error);
    return fail(error instanceof Error ? error.message : 'Erro desconhecido.', 500);
  }
});
