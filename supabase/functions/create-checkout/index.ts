import { serve } from "https://deno.land/std@0.177.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const { plan_id, user_id, success_url, cancel_url } = await req.json();

    if (!plan_id || !user_id) throw new Error("Missing parameters");

    // Simulando chamada ao Mercado Pago
    // Em produção, isso bateria na API do MP /checkout/preferences para gerar a URL
    
    const checkout_url = `https://sandbox.mercadopago.com.br/checkout/v1/redirect?pref_id=mock_${plan_id}_${user_id}_${Date.now()}`;

    return new Response(JSON.stringify({ checkout_url }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 200,
    });
  } catch (err) {
    return new Response(JSON.stringify({ error: err.message }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 400,
    });
  }
});
