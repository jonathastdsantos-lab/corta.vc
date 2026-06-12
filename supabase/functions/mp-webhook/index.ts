import { serve } from "https://deno.land/std@0.177.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

serve(async (req) => {
  try {
    const body = await req.json();
    
    // Validar assinatura do webhook do MP (x-signature) em prod
    
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    // Se payment.created
    if (body.action === 'payment.created' && body.data) {
      // 1. Puxaria os dados do pagamento via API do MP usando o ID
      // 2. Extrai o plan e user_id
      // 3. Atualiza na base de dados
      // await supabase.from('profiles').update({ plan: 'pro', credits: -1 }).eq('id', user_id);
      console.log('Webhook MP recebido e processado');
    }

    return new Response('ok', { status: 200 });
  } catch (err) {
    return new Response('error', { status: 400 });
  }
});
