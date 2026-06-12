import { serve } from "https://deno.land/std@0.177.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const PLANS: Record<string, any> = {
  starter:  { name: 'Corta.vc Starter',  price_brl: 49.00,  credits: 60  },
  pro:      { name: 'Corta.vc Pro',       price_brl: 149.00, credits: -1  },
  business: { name: 'Corta.vc Business',  price_brl: 399.00, credits: -1  },
};

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });

  const supabase = createClient(
    Deno.env.get('SUPABASE_URL') ?? '',
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
  );

  try {
    // Autenticar usuário
    const authHeader = req.headers.get('Authorization') ?? '';
    const { data: { user }, error: authErr } = await supabase.auth.getUser(
      authHeader.replace('Bearer ', '')
    );
    if (authErr || !user) return new Response(
      JSON.stringify({ error: 'Não autorizado' }),
      { status: 401, headers: corsHeaders }
    );

    const { plan_id, success_url, cancel_url } = await req.json();
    const plan = PLANS[plan_id];
    if (!plan) return new Response(
      JSON.stringify({ error: `Plano inválido: ${plan_id}` }),
      { status: 400, headers: corsHeaders }
    );

    const mpToken = Deno.env.get('MERCADOPAGO_ACCESS_TOKEN');
    if (!mpToken) throw new Error('MERCADOPAGO_ACCESS_TOKEN não configurado');

    const externalRef = `${user.id}:${plan_id}:${Date.now()}`;

    // Salva o pagamento pendente
    await supabase.from('payments').insert({
      user_id: user.id,
      plan_id,
      amount_brl: Math.round(plan.price_brl * 100),
      status: 'pending',
      external_ref: externalRef
    });

    // Criar preferência no Mercado Pago
    const mpRes = await fetch('https://api.mercadopago.com/checkout/preferences', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${mpToken}`,
        'X-Idempotency-Key': externalRef
      },
      body: JSON.stringify({
        items: [{
          title: plan.name,
          description: `Assinatura mensal ${plan.name}`,
          quantity: 1,
          unit_price: plan.price_brl,
          currency_id: 'BRL'
        }],
        payer: { email: user.email },
        back_urls: {
          success: success_url || `${Deno.env.get('APP_URL')}/index.html?payment=success`,
          failure: cancel_url  || `${Deno.env.get('APP_URL')}/index.html?payment=cancel`,
          pending: `${Deno.env.get('APP_URL')}/index.html?payment=pending`
        },
        auto_return: 'approved',
        external_reference: externalRef,
        notification_url: `${Deno.env.get('SUPABASE_URL')}/functions/v1/mp-webhook`,
        payment_methods: {
          excluded_payment_types: [],
          installments: 1
        },
        expires: false
      })
    });

    if (!mpRes.ok) {
      const err = await mpRes.text();
      throw new Error(`Mercado Pago erro: ${err}`);
    }

    const mpData = await mpRes.json();

    return new Response(JSON.stringify({
      checkout_url: mpData.init_point,
      preference_id: mpData.id,
      external_ref: externalRef
    }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });

  } catch (err) {
    console.error('create-checkout error:', err);
    return new Response(
      JSON.stringify({ error: err instanceof Error ? err.message : String(err) }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
