import { serve } from "https://deno.land/std@0.177.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

type EmailType = 'payment_receipt' | 'weekly_summary' | 'credits_low' | 'welcome';

interface EmailPayload {
  type: EmailType;
  to: string;
  data: Record<string, any>;
}

const TEMPLATES: Record<EmailType, (d: Record<string, any>) => { subject: string; html: string }> = {
  payment_receipt: (d) => ({
    subject: `Pagamento confirmado — Corta.vc ${d.plan}`,
    html: `<h2>Pagamento confirmado! 🎉</h2>
<p>Seu plano <strong>${d.plan}</strong> está ativo.</p>
<p>Valor: R$ ${(d.amount / 100).toFixed(2)}</p>
<p>Próxima renovação: ${new Date(d.expires_at).toLocaleDateString('pt-BR')}</p>
<p>Acesse a plataforma em <a href="https://corta.vc">corta.vc</a></p>`
  }),
  weekly_summary: (d) => ({
    subject: `Seu resumo semanal — ${d.clips_created} cortes criados`,
    html: `<h2>Resumo da semana 📊</h2>
<ul>
<li>Cortes criados: <strong>${d.clips_created}</strong></li>
<li>Posts publicados: <strong>${d.posts_published}</strong></li>
<li>Views totais: <strong>${d.total_views?.toLocaleString('pt-BR')}</strong></li>
<li>Créditos restantes: <strong>${d.credits_left}</strong></li>
</ul>
<p><a href="https://corta.vc">Ver meus cortes →</a></p>`
  }),
  credits_low: (d) => ({
    subject: `Seus créditos estão acabando — ${d.credits} restantes`,
    html: `<h2>Créditos baixos ⚠️</h2>
<p>Você tem apenas <strong>${d.credits} créditos</strong> restantes.</p>
<p>Faça upgrade para continuar criando cortes.</p>
<p><a href="https://corta.vc?upgrade=1">Ver planos →</a></p>`
  }),
  welcome: (d) => ({
    subject: 'Bem-vindo ao Corta.vc! 🎬',
    html: `<h2>Olá, ${d.name}! 👋</h2>
<p>Bem-vindo ao Corta.vc — a plataforma brasileira de cortes virais com IA.</p>
<p>Você tem <strong>${d.credits} créditos</strong> para começar.</p>
<p>Para criar seu primeiro corte, cole um link do YouTube ou faça upload de um vídeo.</p>
<p><a href="https://corta.vc">Começar agora →</a></p>`
  })
};

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });

  try {
    const { type, to, data }: EmailPayload = await req.json();
    if (!type || !to) throw new Error('type e to são obrigatórios');

    const template = TEMPLATES[type];
    if (!template) throw new Error(`Tipo de e-mail inválido: ${type}`);

    const { subject, html } = template(data);
    const resendKey = Deno.env.get('RESEND_API_KEY');
    if (!resendKey) throw new Error('RESEND_API_KEY não configurado');

    const res = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${resendKey}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        from: 'Corta.vc <noreply@corta.vc>',
        to: [to],
        subject,
        html
      })
    });

    if (!res.ok) {
      const err = await res.text();
      throw new Error(`Resend API erro: ${err}`);
    }

    const result = await res.json();
    return new Response(JSON.stringify({ id: result.id }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });

  } catch (err) {
    return new Response(
      JSON.stringify({ error: err instanceof Error ? err.message : String(err) }),
      { status: 500, headers: corsHeaders }
    );
  }
});
