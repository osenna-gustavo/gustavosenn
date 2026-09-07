import { corsHeaders } from 'npm:@supabase/supabase-js@2/cors';

const SYSTEM_PROMPT = `Você é um assistente financeiro objetivo dentro de um app de fluxo de caixa pessoal.
Responda sempre em português, de forma direta e curta — sem rodeios, sem disclaimers.
Use exclusivamente os dados em "Dados financeiros" abaixo. Nunca invente números.
Formate valores em reais (R$ 1.234,56).
Se perguntarem sobre duplicidade de lançamentos, baseie-se no campo "possiveisDuplicidades" (já calculado por código, não por você).
Se perguntarem sobre orçamento, saldo disponível ou gasto por categoria, baseie-se em "resumoDoMes" (campo "categoryBreakdown" tem planejado/realizado/percentual por categoria).
Se a informação pedida não estiver nos dados, diga isso claramente em vez de estimar.`;

const jsonResponse = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const LOVABLE_API_KEY = Deno.env.get('LOVABLE_API_KEY');
    if (!LOVABLE_API_KEY) {
      return jsonResponse({ error: 'Assistente indisponível: chave de IA não configurada.' }, 500);
    }

    const { messages, context } = await req.json().catch(() => ({}));
    if (!Array.isArray(messages) || messages.length === 0) {
      return jsonResponse({ error: 'messages é obrigatório' }, 400);
    }

    const safeMessages = messages
      .filter((m: unknown): m is { role: string; content: string } =>
        !!m && typeof (m as { content?: unknown }).content === 'string')
      .slice(-12)
      .map((m) => ({
        role: m.role === 'assistant' ? 'assistant' : 'user',
        content: m.content.slice(0, 4000),
      }));

    const system = `${SYSTEM_PROMPT}\n\nDados financeiros:\n${JSON.stringify(context ?? {}).slice(0, 120000)}`;

    const resp = await fetch('https://ai.gateway.lovable.dev/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
      },
      body: JSON.stringify({
        model: 'google/gemini-3-flash-preview',
        messages: [{ role: 'system', content: system }, ...safeMessages],
      }),
    });

    if (resp.status === 429) {
      return jsonResponse({ error: 'Muitas perguntas em sequência. Aguarde alguns instantes.' }, 429);
    }
    if (resp.status === 402) {
      return jsonResponse({ error: 'Créditos de IA esgotados no workspace.' }, 402);
    }
    if (!resp.ok) {
      const errText = await resp.text();
      console.error('[financial-assistant] gateway error', resp.status, errText);
      return jsonResponse({ error: 'Não foi possível consultar a IA agora.' }, 500);
    }

    const data = await resp.json();
    const reply = data?.choices?.[0]?.message?.content ?? 'Não consegui gerar uma resposta.';

    return jsonResponse({ reply });
  } catch (error) {
    console.error('[financial-assistant] Error:', error);
    return jsonResponse(
      { error: error instanceof Error ? error.message : 'Erro desconhecido' },
      500,
    );
  }
});
