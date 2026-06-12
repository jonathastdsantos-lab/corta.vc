# Corta.vc

Plataforma para transformar vídeos longos em **cortes virais** com IA — encontra os melhores momentos, gera legendas animadas, aplica templates e agenda a publicação nas redes.

Este repositório contém, hoje, o **protótipo de interface** (HTML + React via Babel, sem build) e a base para integração com Supabase.

---

## 🔐 Segurança — leia primeiro

As credenciais compartilhadas no chat devem ser **rotacionadas**:

| Credencial | Onde vive | Ação |
|---|---|---|
| Senha do banco | Só no servidor / Supabase | **Rotacionar** |
| `service_role` secret | **Só no servidor** (Edge Functions / backend). Nunca no front-end. | **Rotacionar** |
| `anon public` | Pode ir no front-end (protegida por RLS) | Rotacionar e colar em `config.js` |
| URL / Project ID | Público | OK |

> O `service_role` dá acesso total ignorando RLS. Se ele vazar, qualquer um controla seu banco. Mantenha-o apenas em variáveis de ambiente do servidor.

---

## 🗂 Estrutura

```
index.html            # entrada — carrega React, Babel, supabase-js e os módulos
styles.css            # design system (tema claro/escuro, tokens, componentes)
config.js             # SUPABASE_URL + ANON_KEY (placeholder => modo demo)
supa.jsx              # camada Supabase (auth + storage) com fallback demo
auth-screen.jsx       # tela de login / cadastro
data.jsx              # dados mock + i18n (PT/EN) + catálogos
ui.jsx                # ícones + primitivos (Botão, Thumb, Score, etc.)
ai.jsx                # assistente de IA (chat) + helpers de legenda/título
screens-main.jsx      # Dashboard · Importar (upload) · Processamento · Cortes
screen-editor.jsx     # Editor de corte (legendas, estilo, layout, marca, export)
screens-extra.jsx     # Templates · Agenda
app.jsx               # shell, navegação, gate de auth, Tweaks
supabase-schema.sql   # tabelas + RLS + Storage (rodar no SQL Editor)
```

## ▶️ Rodar local

É HTML estático. Sirva a pasta com qualquer servidor:

```bash
npx serve .
# ou
python3 -m http.server 8000
```

Abra `http://localhost:8000`.

---

## 🔌 Conectar à Supabase (client-side, só `anon key`)

**Já está implementado** — login/cadastro (`auth-screen.jsx`), camada `supa.jsx` e upload de vídeo. Enquanto a `config.js` tiver o placeholder, roda em **modo demo** (login e upload simulados, nada sai do navegador). Para ativar de verdade:

1. Rode `supabase-schema.sql` no SQL Editor do projeto.
2. Em `config.js`, troque o placeholder pela sua **nova** anon key:

```js
window.CORTA_CONFIG = {
  SUPABASE_URL: "https://shzjchiortfrnpsoirrb.supabase.co",
  SUPABASE_ANON_KEY: "<<sua NOVA anon key>>"
};
```

3. Pronto: `supa.jsx` detecta a chave, liga o `supabase-js` e passa a usar `auth.signUp/signInWithPassword` e Storage (bucket `videos/<uid>/`). Em deploy público, injete a anon key por variável de ambiente em vez de comitar.

## 🧠 IA

O protótipo já chama um modelo de IA para: sugerir/melhorar legendas, gerar título + hashtags e responder no chat assistente. Em produção, troque por uma **Edge Function** que chama seu provedor de IA com a chave guardada no servidor.

---

## 🛣 Próximos passos sugeridos

- [ ] Rotacionar credenciais
- [ ] Rodar o schema na Supabase
- [x] Tela de login/cadastro (Supabase Auth)
- [x] Upload real para o Storage + (criar `project` na sequência)
- [ ] Pipeline de processamento (transcrição + seleção de momentos + render) via worker/Edge Functions
- [ ] OAuth das redes para autopostagem
