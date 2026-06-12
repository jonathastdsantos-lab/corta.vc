/* ============================================================
   DATA — mock content, i18n, catalogs
   ============================================================ */

// Niche tints for placeholder thumbnails
const NICHES = {
  podcast:  { label: 'Podcast',   tint: 'linear-gradient(150deg,#3a2d4a,#1a1322)' },
  games:    { label: 'Games',     tint: 'linear-gradient(150deg,#143a3a,#0a1f22)' },
  noticias: { label: 'Notícias',  tint: 'linear-gradient(150deg,#3a2418,#1f1410)' },
  fe:       { label: 'Fé',        tint: 'linear-gradient(150deg,#2a3350,#141a2e)' },
  financas: { label: 'Finanças',  tint: 'linear-gradient(150deg,#173a2a,#0c1f17)' },
  educacao: { label: 'Educação',  tint: 'linear-gradient(150deg,#3a3418,#201d0e)' },
  fitness:  { label: 'Fitness',   tint: 'linear-gradient(150deg,#3a1830,#20101c)' },
};

// Caption style presets (used in editor + templates gallery)
const CAPTION_STYLES = [
  { id: 'hormozi',  name: 'Impacto',    font: "800 var(--cap-size) var(--font-ui)", color: '#fff', hl: '#ffe14d', stroke: true,  anim: 'pop',   uppercase: true,  pos: 'center' },
  { id: 'clean',    name: 'Clean',      font: "700 var(--cap-size) var(--font-ui)", color: '#fff', hl: '#7cf6c0', stroke: false, anim: 'fade',  uppercase: false, pos: 'bottom' },
  { id: 'karaoke',  name: 'Karaokê',    font: "800 var(--cap-size) var(--font-ui)", color: '#ffffff', hl: 'var(--accent)', stroke: true, anim: 'word', uppercase: true, pos: 'center' },
  { id: 'minimal',  name: 'Minimal',    font: "600 var(--cap-size) var(--font-ui)", color: '#fff', hl: '#fff', stroke: false, anim: 'fade', uppercase: false, pos: 'bottom', box: true },
  { id: 'neon',     name: 'Neon',       font: "800 var(--cap-size) var(--font-ui)", color: '#fff', hl: '#5ef1ff', stroke: false, anim: 'pop', uppercase: true, pos: 'center', glow: true },
  { id: 'bold-bar', name: 'Faixa',      font: "800 var(--cap-size) var(--font-ui)", color: '#111', hl: 'var(--accent)', stroke: false, anim: 'slide', uppercase: true, pos: 'bottom', bar: true },
];

// Layout / framing presets
const LAYOUTS = [
  { id: 'fill',  name: 'Tela cheia',  desc: 'Foco no rosto', glyph: 'fill' },
  { id: 'split', name: 'Split-screen', desc: '2 falantes',    glyph: 'split' },
  { id: 'square', name: 'Câmera + jogo', desc: 'Topo/baixo',  glyph: 'stack' },
  { id: 'blur',  name: 'Fundo blur',  desc: 'Vídeo flutuante', glyph: 'blur' },
];

const RATIOS = [
  { id: '9:16', name: 'Vertical', meta: 'Reels · Shorts · TikTok', w: 22, h: 38 },
  { id: '1:1',  name: 'Quadrado', meta: 'Feed Instagram',          w: 32, h: 32 },
  { id: '16:9', name: 'Horizontal', meta: 'YouTube',               w: 40, h: 23 },
];

const PLATFORMS = [
  { id: 'tiktok', name: 'TikTok' }, { id: 'youtube', name: 'YouTube Shorts' },
  { id: 'instagram', name: 'Reels' }, { id: 'x', name: 'X' },
  { id: 'linkedin', name: 'LinkedIn' }, { id: 'facebook', name: 'Facebook' }, { id: 'kwai', name: 'Kwai' },
];

// Recent projects
const PROJECTS = [
  { id: 'p1', title: 'EP #142 — Mentalidade de alta performance com Dra. Helena', niche: 'podcast', clips: 12, dur: '1:48:20', when: 'há 2 h', src: 'youtube' },
  { id: 'p2', title: 'Live de finanças: como sair das dívidas em 2026', niche: 'financas', clips: 9, dur: '52:10', when: 'ontem', src: 'upload' },
  { id: 'p3', title: 'Culto de domingo — A coragem de recomeçar', niche: 'fe', clips: 7, dur: '1:12:44', when: 'há 2 dias', src: 'youtube' },
  { id: 'p4', title: 'Gameplay ranqueado — clutch insano no último round', niche: 'games', clips: 15, dur: '2:31:05', when: 'há 3 dias', src: 'twitch' },
  { id: 'p5', title: 'Aula aberta: o cérebro e o hábito de estudar', niche: 'educacao', clips: 6, dur: '44:18', when: 'há 5 dias', src: 'upload' },
  { id: 'p6', title: 'Treino de mobilidade para quem senta o dia todo', niche: 'fitness', clips: 8, dur: '38:52', when: 'há 1 semana', src: 'upload' },
];

// Generated clips (for the clips list + editor)
const CLIPS = [
  { id: 'c1', title: 'O segredo de quem nunca desiste', cap: 'O segredo não é talento — é {aparecer} todos os dias', niche: 'podcast', dur: 38, score: 94, hook: 'Alta retenção', words: 'segredo,talento,aparecer,todos,dias' },
  { id: 'c2', title: 'Pare de fazer isso com seu dinheiro', cap: 'Se você ainda faz {isso}, está perdendo dinheiro', niche: 'financas', dur: 51, score: 91, hook: 'Gancho forte', words: 'pare,fazer,isso,perdendo,dinheiro' },
  { id: 'c3', title: 'A virada que ninguém te conta', cap: 'A {virada} aconteceu quando eu parei de esperar', niche: 'podcast', dur: 44, score: 88, hook: 'Emocional', words: 'virada,ninguem,conta,parei,esperar' },
  { id: 'c4', title: 'Coragem de recomeçar do zero', cap: 'Recomeçar não é fraqueza, é {coragem}', niche: 'fe', dur: 29, score: 86, hook: 'Inspiracional', words: 'coragem,recomecar,zero,fraqueza' },
  { id: 'c5', title: 'O clutch mais insano do campeonato', cap: 'Ninguém esperava esse {clutch} no 1v4', niche: 'games', dur: 22, score: 84, hook: 'Adrenalina', words: 'clutch,insano,1v4,ninguem' },
  { id: 'c6', title: 'Como o cérebro cria um hábito', cap: 'Seu cérebro precisa de {21 dias} pra mudar', niche: 'educacao', dur: 47, score: 79, hook: 'Didático', words: 'cerebro,habito,21,dias,mudar' },
  { id: 'c7', title: '3 erros que travam seu progresso', cap: 'O {erro #1} que quase todo mundo comete', niche: 'fitness', dur: 35, score: 76, hook: 'Listicle', words: 'erros,travam,progresso,erro' },
  { id: 'c8', title: 'A pergunta que mudou tudo', cap: 'E se a pergunta certa fosse {outra}?', niche: 'podcast', dur: 41, score: 72, hook: 'Reflexivo', words: 'pergunta,mudou,tudo,outra' },
  { id: 'c9', title: 'Investir com pouco também funciona', cap: 'Dá pra começar com {R$ 30} por mês', niche: 'financas', dur: 33, score: 68, hook: 'Prático', words: 'investir,pouco,funciona,começar' },
];

// Full transcript lines for the editor caption list
const TRANSCRIPT = [
  { t: '00:00', text: 'O segredo não é talento.' },
  { t: '00:02', text: 'É **aparecer** todos os dias, mesmo sem vontade.' },
  { t: '00:05', text: 'A maioria das pessoas para na primeira dificuldade.' },
  { t: '00:09', text: 'E quem fica, colhe o que os outros desistiram.' },
  { t: '00:13', text: 'Consistência vence intensidade **toda vez**.' },
  { t: '00:17', text: 'Comece pequeno, mas comece hoje.' },
];

// Schedule events
const SCHEDULE = [
  { day: 9,  clip: 'c1', plat: 'tiktok',    time: '18:00' },
  { day: 9,  clip: 'c2', plat: 'instagram', time: '20:30' },
  { day: 11, clip: 'c3', plat: 'youtube',   time: '12:00' },
  { day: 12, clip: 'c5', plat: 'tiktok',    time: '19:15' },
  { day: 15, clip: 'c4', plat: 'instagram', time: '09:00' },
  { day: 15, clip: 'c7', plat: 'kwai',      time: '21:00' },
  { day: 18, clip: 'c6', plat: 'youtube',   time: '17:30' },
  { day: 22, clip: 'c8', plat: 'linkedin',  time: '08:30' },
];

const STATS = [
  { key: 'views',  label: { pt: 'Visualizações (30d)', en: 'Views (30d)' }, num: '2,4M', delta: '+38%', dir: 'up', icon: 'eye' },
  { key: 'clips',  label: { pt: 'Cortes criados',      en: 'Clips made' },   num: '184',  delta: '+22',  dir: 'up', icon: 'scissors' },
  { key: 'posted', label: { pt: 'Publicados',          en: 'Published' },    num: '96',   delta: '+12',  dir: 'up', icon: 'send' },
  { key: 'time',   label: { pt: 'Horas economizadas',  en: 'Hours saved' },  num: '47h',  delta: '+9h',  dir: 'up', icon: 'clock' },
];

const PROMPT_IDEAS_PT = [
  'Faça cortes sobre os melhores conselhos de carreira',
  'Encontre os momentos mais engraçados',
  'Cortes com ganchos polêmicos para gerar debate',
  'Só os trechos com dados e estatísticas',
];
const PROMPT_IDEAS_EN = [
  'Make clips about the best career advice',
  'Find the funniest moments',
  'Clips with bold hooks to spark debate',
  'Only the parts with data and stats',
];

// ---------- i18n ----------
const STR = {
  pt: {
    new_clip: 'Novo corte', search: 'Buscar projetos, cortes…',
    nav_home: 'Início', nav_projects: 'Projetos', nav_clips: 'Cortes', nav_templates: 'Templates', nav_schedule: 'Agenda', nav_analytics: 'Análises',
    create: 'Criar', publish: 'Publicar',
    greeting: 'Bom te ver, Rafa', greeting_sub: 'Cole um link ou suba um vídeo — a IA acha os melhores momentos.',
    paste_ph: 'Cole o link do YouTube, Drive, Twitch, Zoom…',
    or_upload: 'ou arraste um arquivo', accepts: 'MP4, MOV, links — até 3 h',
    recent: 'Projetos recentes', see_all: 'Ver todos',
    clips_from: 'cortes', generate: 'Gerar cortes',
    import_title: 'Novo corte', import_sub: 'A IA analisa seu vídeo e cria dezenas de cortes prontos pra postar.',
    ai_prompt_label: 'Direcione a IA (opcional)', ai_prompt_ph: 'Ex: faça cortes sobre liderança e motivação, com ganchos fortes…',
    duration: 'Duração dos cortes', language: 'Idioma da legenda', ratio: 'Formato', captions_on: 'Legendas automáticas',
    auto: 'Automático', processing: 'Analisando seu vídeo', processing_sub: 'Isso leva alguns minutos. A IA está caçando seus melhores momentos.',
    clips_ready: 'cortes prontos', sort_score: 'Nota de viralização', sort_recent: 'Mais recentes', sort_dur: 'Duração',
    edit: 'Editar', schedule_btn: 'Agendar', download: 'Baixar', filter_all: 'Todos',
    ed_captions: 'Legendas', ed_style: 'Estilo', ed_layout: 'Layout', ed_brand: 'Marca', ed_export: 'Exportar',
    virality: 'Viralização', ai_caption: 'Melhorar com IA', regenerate: 'Refazer com IA',
    title_hashtags: 'Título & hashtags', generate_meta: 'Gerar com IA',
    tpl_title: 'Templates', tpl_sub: 'Comece de um estilo pronto ou crie o seu. Tudo é editável.',
    tab_captions: 'Estilos de legenda', tab_layouts: 'Enquadramentos', tab_niches: 'Por nicho', tab_formats: 'Formatos',
    sched_title: 'Agenda de publicação', sched_sub: 'Programe seus cortes nas redes — a IA adapta cada formato.',
    queue: 'Fila de publicação', ai_assistant: 'Assistente', ai_greeting: 'Oi! Sou seu assistente de cortes. Posso sugerir ganchos, escrever legendas, criar títulos e hashtags ou achar momentos no seu vídeo. O que vamos fazer?',
    ai_ph: 'Peça algo à IA…', ask_ai: 'Perguntar à IA',
    plan: 'Plano Pro', credits: 'créditos restantes', upgrade: 'Fazer upgrade',
    you: 'Você', save: 'Salvar', done: 'Pronto', use_template: 'Usar template',
    score_help: 'Probabilidade do corte viralizar, calculada pela IA com base em gancho, ritmo e tendências.',
    posts_scheduled: 'posts agendados', best_time: 'Melhor horário (IA)',
  },
  en: {
    new_clip: 'New clip', search: 'Search projects, clips…',
    nav_home: 'Home', nav_projects: 'Projects', nav_clips: 'Clips', nav_templates: 'Templates', nav_schedule: 'Schedule', nav_analytics: 'Analytics',
    create: 'Create', publish: 'Publish',
    greeting: 'Good to see you, Rafa', greeting_sub: 'Paste a link or upload a video — AI finds the best moments.',
    paste_ph: 'Paste a YouTube, Drive, Twitch, Zoom link…',
    or_upload: 'or drag a file', accepts: 'MP4, MOV, links — up to 3 h',
    recent: 'Recent projects', see_all: 'See all',
    clips_from: 'clips', generate: 'Generate clips',
    import_title: 'New clip', import_sub: 'AI analyzes your video and creates dozens of ready-to-post clips.',
    ai_prompt_label: 'Steer the AI (optional)', ai_prompt_ph: 'e.g. make clips about leadership and motivation, with strong hooks…',
    duration: 'Clip length', language: 'Caption language', ratio: 'Format', captions_on: 'Auto captions',
    auto: 'Automatic', processing: 'Analyzing your video', processing_sub: 'This takes a few minutes. AI is hunting your best moments.',
    clips_ready: 'clips ready', sort_score: 'Virality score', sort_recent: 'Most recent', sort_dur: 'Duration',
    edit: 'Edit', schedule_btn: 'Schedule', download: 'Download', filter_all: 'All',
    ed_captions: 'Captions', ed_style: 'Style', ed_layout: 'Layout', ed_brand: 'Brand', ed_export: 'Export',
    virality: 'Virality', ai_caption: 'Improve with AI', regenerate: 'Redo with AI',
    title_hashtags: 'Title & hashtags', generate_meta: 'Generate with AI',
    tpl_title: 'Templates', tpl_sub: 'Start from a preset or build your own. Everything is editable.',
    tab_captions: 'Caption styles', tab_layouts: 'Framing', tab_niches: 'By niche', tab_formats: 'Formats',
    sched_title: 'Publishing schedule', sched_sub: 'Schedule clips across networks — AI adapts each format.',
    queue: 'Publish queue', ai_assistant: 'Assistant', ai_greeting: "Hi! I'm your clip assistant. I can suggest hooks, write captions, create titles & hashtags or find moments in your video. What are we making?",
    ai_ph: 'Ask the AI…', ask_ai: 'Ask AI',
    plan: 'Pro plan', credits: 'credits left', upgrade: 'Upgrade',
    you: 'You', save: 'Save', done: 'Done', use_template: 'Use template',
    score_help: 'Likelihood the clip goes viral, scored by AI from hook, pacing and trends.',
    posts_scheduled: 'scheduled posts', best_time: 'Best time (AI)',
  },
};

function scoreColor(s) {
  if (s >= 90) return '#1f9d6b';
  if (s >= 80) return '#86b81f';
  if (s >= 70) return '#e0992b';
  return '#b4afa3';
}

Object.assign(window, {
  NICHES, CAPTION_STYLES, LAYOUTS, RATIOS, PLATFORMS, PROJECTS, CLIPS,
  TRANSCRIPT, SCHEDULE, STATS, PROMPT_IDEAS_PT, PROMPT_IDEAS_EN, STR, scoreColor,
});
