import { serve } from "https://deno.land/std@0.177.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { createHmac } from "node:crypto";

const PLAN_CREDITS: Record<string, number> = {
  starter: 60,
  pro: -1,      // -1 = ilimitado
  business: -1
};

serve(async (req) => {
  const supabase = createClient(
    Deno.env.get('SUPABASE_URL') ?? '',
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
  );

  try {
    // 1. Validar assinatura HMAC do Mercado Pago
    const secret = Deno.env.get('MERCADOPAGO_WEBHOOK_SECRET');
    if (secret) {
      const xSignature = req.headers.get('x-signature') ?? '';
      const xRequestId = req.headers.get('x-request-id') ?? '';
      const url = new URL(req.url);
      const dataId = url.searchParams.get('data.id') ?? '';

      const signedTemplate = `id:${dataId};request-id:${xRequestId};ts:${xSignature.split(';').find(p => p.startsWith('ts='))?.split('=')[1] ?? ''}`;
      const parts = xSignature.split(';');
      const ts = parts.find(p => p.startsWith('ts='))?.split('=')[1];
      const v1 = parts.find(p => p.startsWith('v1='))?.split('=')[1];

      if (ts && v1) {
        const expected = createHmac('sha256', secret)
          .update(`${ts}:${signedTemplate}`)
          .digest('hex');
        if (expected !== v1) {
          console.error('Assinatura inválida do webhook MP');
          return new Response('Unauthorized', { status: 401 });
        }
      }
    }

    const body = await req.json();
    console.log('MP Webhook:', JSON.stringify(body));

    // 2. Só processar payment.created ou payment.updated
    if (!['payment.created', 'payment.updated'].includes(body.action)) {
      return new Response('ok', { status: 200 });
    }

    const paymentId = body.data?.id;
    if (!paymentId) return new Response('ok', { status: 200 });

    // 3. Buscar detalhes do pagamento na API do MP
    const mpToken = Deno.env.get('MERCADOPAGO_ACCESS_TOKEN');
    if (!mpToken) throw new Error('MERCADOPAGO_ACCESS_TOKEN não configurado');

    const mpRes = await fetch(`https://api.mercadopago.com/v1/payments/${paymentId}`, {
      headers: { 'Authorization': `Bearer ${mpToken}` }
    });

    if (!mpRes.ok) throw new Error(`MP API erro: ${mpRes.status}`);
    const payment = await mpRes.json();

    const { external_reference, status: paymentStatus } = payment;
    if (!external_reference) return new Response('ok', { status: 200 });

    // Format: userId:planId:timestamp
    const [userId, planId] = external_reference.split(':');
    if (!userId || !planId) throw new Error(`external_reference inválido: ${external_reference}`);

    // 4. Atualizar pagamento no banco
    await supabase.from('payments').update({
      status: paymentStatus,
      mp_payment_id: String(paymentId),
      paid_at: paymentStatus === 'approved' ? new Date().toISOString() : null
    }).eq('external_ref', external_reference);

    // 5. Se aprovado: atualizar plano e créditos
    if (paymentStatus === 'approved') {
      const newMonthlyCredits = PLAN_CREDITS[planId] ?? 60;
      const planExpiresAt = new Date();
      planExpiresAt.setMonth(planExpiresAt.getMonth() + 1);

      // Para planos ilimitados (-1), seta -1 diretamente
      // Para planos com créditos, SOMA os créditos restantes + novos créditos do plano
      // (evita perda de créditos não usados no upgrade)
      let creditsUpdate: number;
      if (newMonthlyCredits === -1) {
        creditsUpdate = -1; // ilimitado
      } else {
        // Busca créditos atuais
        const { data: currentProfile } = await supabase
          .from('profiles').select('credits, plan').eq('id', userId).single();
        const currentCredits = currentProfile?.credits ?? 0;
        // Se estava em plano pago (não free), soma os créditos restantes
        // Se era free, começa do zero com os créditos do novo plano
        creditsUpdate = currentProfile?.plan === 'free'
          ? newMonthlyCredits
          : Math.max(currentCredits, 0) + newMonthlyCredits;
      }

      const { error: updateErr } = await supabase.from('profiles').update({
        plan: planId,
        credits: creditsUpdate,
        subscription_id: String(paymentId),
        plan_expires_at: planExpiresAt.toISOString()
      }).eq('id', userId);

      if (updateErr) throw new Error(`Falha ao atualizar perfil: ${updateErr.message}`);

      // 6. Notificar o usuário
      await supabase.from('notifications').insert({
        user_id: userId,
        type: 'new_feature',
        title: `Plano ${planId} ativado! 🚀`,
        body: `Seu pagamento foi aprovado. Aproveite todos os recursos do plano ${planId}.`
      });

      // Enviar e-mail de recibo
      try {
        const { data: userProfile } = await supabase
          .from('profiles').select('name').eq('id', userId).single();

        await supabase.functions.invoke('send-email', {
          body: {
            type: 'payment_receipt',
            to: payment.payer?.email || '',
            data: {
              name: userProfile?.name || 'Cliente',
              plan: planId,
              amount: payment.transaction_amount * 100,
              expires_at: planExpiresAt.toISOString()
            }
          }
        });
      } catch (emailErr) {
        console.warn('Falha ao enviar e-mail de recibo:', emailErr);
        // Não falha o webhook por causa do e-mail
      }

      console.log(`Plano ${planId} ativado para ${userId}`);
    }

    return new Response('ok', { status: 200 });

  } catch (err) {
    console.error('mp-webhook error:', err);
    return new Response(
      JSON.stringify({ error: err instanceof Error ? err.message : String(err) }),
      { status: 500 }
    );
  }
});
