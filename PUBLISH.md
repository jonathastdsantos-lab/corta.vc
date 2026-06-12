# Publicar o Corta.vc

> Estes comandos rodam **na sua máquina**. Use sempre as credenciais **rotacionadas**.

## 1. GitHub

```bash
cd corta.vc
git init
git add .
git commit -m "Corta.vc — protótipo + auth Supabase + schema"
git branch -M main
git remote add origin https://github.com/jonathastdsantos-lab/corta.vc.git
git push -u origin main
```

Se o remote já existir: `git remote set-url origin https://github.com/jonathastdsantos-lab/corta.vc.git`

> ⚠️ Antes do push, confira que `config.js` **não** contém uma chave real se o repo for público. Prefira injetar a anon key por variável de ambiente no deploy.

## 2. Supabase — banco de dados

```bash
# instala a CLI (uma vez)
npm i -g supabase            # ou: brew install supabase/tap/supabase

supabase login
supabase link --project-ref shzjchiortfrnpsoirrb
#   pede a senha do banco (a NOVA, rotacionada)

supabase db push             # aplica supabase/migrations/*.sql no banco remoto
```

### Sem CLI
SQL Editor do projeto → cole `supabase-schema.sql` → **Run**.

## 3. Ativar o login real no app

Em `config.js`, troque o placeholder pela anon key nova:

```js
window.CORTA_CONFIG = {
  SUPABASE_URL: "https://shzjchiortfrnpsoirrb.supabase.co",
  SUPABASE_ANON_KEY: "<<sua NOVA anon key>>"
};
```

O `supa.jsx` detecta a chave e sai do modo demo automaticamente.

## ✅ Checklist de segurança
- [ ] Senha do banco rotacionada
- [ ] `service_role` rotacionado (nunca vai no front-end)
- [ ] `anon key` rotacionada e colada no `config.js`
