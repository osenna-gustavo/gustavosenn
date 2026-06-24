const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const SYSTEM_PROMPT = `Você é um assistente financeiro objetivo dentro de um app de fluxo de caixa pessoal.
Responda sempre em português, de forma direta e curta — sem rodeios, sem disclaimers.
Use exclusivamente os dados em "Dados financeiros" abaixo. Nunca invente números.
Se perguntarem sobre duplicidade de lançamentos, baseie-se no campo "possiveisDuplicidades" (já calculado por código, não por você).
Se perguntarem sobre orçamento, saldo disponível ou gasto por categoria, baseie-se em "resumoDoMes" (campo "categoryBreakdown" tem planejado/realizado/percentual por categoria).
Se a informação pedida não estiver nos dados, diga isso claramente em vez de estimar.`;

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const ANTHROPIC_API_KEY = Deno.env.get('ANTHROPIC_API_KEY');
    if (!ANTHROPIC_API_KEY) {
      throw new Error('ANTHROPIC_API_KEY não configurada nos secrets do projeto.');
    }

    const { messages, context } = await req.json();
    if (!Array.isArray(messages) || messages.length === 0) {
      return new Response(JSON.stringify({ error: 'messages é obrigatório' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const system = `${SYSTEM_PROMPT}\n\nDados financeiros:\n${JSON.stringify(context ?? {})}`;

    const resp = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        'x-api-key': ANTHROPIC_API_KEY,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model: 'claude-haiku-4-5-20251001',
        max_tokens: 1024,
        system,
        messages,
      }),
    });

    if (!resp.ok) {
      const errText = await resp.text();
      throw new Error(`Anthropic API error (${resp.status}): ${errText}`);
    }

    const data = await resp.json();
    const reply = data.content?.[0]?.text ?? 'Não consegui gerar uma resposta.';

    return new Response(JSON.stringify({ reply }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (error) {
    console.error('[financial-assistant] Error:', error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : 'Erro desconhecido' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
    );
  }
});
