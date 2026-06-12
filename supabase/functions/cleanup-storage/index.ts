import { serve } from "https://deno.land/std@0.177.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

serve(async (_req) => {
  const supabase = createClient(
    Deno.env.get('SUPABASE_URL') ?? '',
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
  );

  const cutoff = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString(); // 30 dias
  let deleted = 0;

  // 1. Deletar vídeos brutos de projetos já processados há +30 dias
  const { data: oldProjects } = await supabase
    .from('projects')
    .select('storage_path, user_id')
    .eq('status', 'ready')
    .not('storage_path', 'is', null)
    .lt('created_at', cutoff);

  for (const project of oldProjects ?? []) {
    try {
      await supabase.storage.from('videos').remove([project.storage_path]);
      await supabase.from('projects').update({ storage_path: null }).eq('storage_path', project.storage_path);
      deleted++;
    } catch (e) { console.warn('Falha ao deletar vídeo:', e); }
  }

  // 2. Deletar shared_clips expirados
  const { data: expiredShares } = await supabase
    .from('shared_clips')
    .select('id')
    .lt('expires_at', new Date().toISOString());

  if (expiredShares?.length) {
    await supabase.from('shared_clips').delete().lt('expires_at', new Date().toISOString());
    deleted += expiredShares.length;
  }

  // 3. Deletar oauth_states expirados
  await supabase.from('oauth_states').delete().lt('expires_at', new Date().toISOString()).catch(() => {});

  // 4. Deletar payments pendentes com +7 dias (abandonados)
  await supabase.from('payments')
    .delete()
    .eq('status', 'pending')
    .lt('created_at', new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString())
    .catch(() => {});

  console.log(`Cleanup concluído: ${deleted} itens deletados`);
  return new Response(JSON.stringify({ deleted }), { status: 200 });
});
