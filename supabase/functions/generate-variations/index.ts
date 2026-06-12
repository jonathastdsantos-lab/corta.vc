import { serve } from "https://deno.land/std@0.177.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import Anthropic from "npm:@anthropic-ai/sdk";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });

  const supabase = createClient(
    Deno.env.get('SUPABASE_URL') ?? '',
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
  );

  try {
    const authHeader = req.headers.get('Authorization') ?? '';
    const { data: { user }, error: authErr } = await supabase.auth.getUser(
      authHeader.replace('Bearer ', '')
    );
    if (authErr || !user) return new Response(
      JSON.stringify({ error: 'Não autorizado' }),
      { status: 401, headers: corsHeaders }
    );

    const { caption, niche, lang = 'pt' } = await req.json();
    if (!caption) return new Response(
      JSON.stringify({ error: 'caption é obrigatório' }),
      { status: 400, headers: corsHeaders }
    );

    const anthropic = new Anthropic({ apiKey: Deno.env.get('ANTHROPIC_API_KEY') });

    const prompt = `Gere 3 variações da legenda abaixo para um corte de vídeo viral (${niche || 'geral'}).
Cada variação deve ter uma abordagem diferente.
A palavra mais impactante deve estar entre {chaves}.
${lang === 'en' ? 'Respond in English.' : 'Responda em português do Brasil.'}

Legenda original: "${caption.replace(/[{}]/g, '')}"

Responda SOMENTE com JSON válido, sem texto adicional:
[
  {"style": "emocional", "caption": "...", "hook": "Por que funciona: ..."},
  {"style": "intrigante", "caption": "...", "hook": "Por que funciona: ..."},
  {"style": "didático", "caption": "...", "hook": "Por que funciona: ..."}
]`;

    const res = await anthropic.messages.create({
      model: 'claude-sonnet-4-6',
      max_tokens: 1024,
      messages: [{ role: 'user', content: prompt }]
    });

    const raw = res.content[0].type === 'text' ? res.content[0].text : '';
    const jsonStart = raw.indexOf('[');
    const jsonEnd = raw.lastIndexOf(']');
    if (jsonStart === -1) throw new Error('Resposta inválida da IA');

    const variations = JSON.parse(raw.substring(jsonStart, jsonEnd + 1));

    return new Response(JSON.stringify({ variations }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });

  } catch (err) {
    return new Response(
      JSON.stringify({ error: err instanceof Error ? err.message : String(err) }),
      { status: 500, headers: corsHeaders }
    );
  }
});
