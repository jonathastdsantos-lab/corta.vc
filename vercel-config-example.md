# Configurando a Anon Key no Vercel

1. Acesse vercel.com → seu projeto → Settings → Environment Variables
2. Adicione: Name=`SUPABASE_ANON_KEY`, Value=<sua anon key>
3. Em `vercel.json`, já existente, adicione o bloco de headers para injetar a meta tag:

No `index.html` e `landing.html`, adicione dentro do `<head>`:
```html
<!-- Supabase anon key injetada via Vercel edge config -->
<meta name="sb-anon-key" content="">
```

Instrução para o build: configure um script de substituição no Vercel que
popule o `content=""` com `$SUPABASE_ANON_KEY` via edge middleware.

Alternativamente (mais simples): use `.env.local` localmente (não commitado)
e injete via `vercel env pull` antes do deploy.
