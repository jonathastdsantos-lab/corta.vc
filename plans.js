window.CORTA_PLANS = {
  free: {
    id: 'free', name: 'Gratuito', price_brl: 0,
    credits_monthly: 10, max_video_duration_min: 30,
    max_clips_per_video: 5, watermark: true,
    features: ["5 cortes por vídeo", "Legendas básicas", "Download com marca d'água"]
  },
  starter: {
    id: 'starter', name: 'Starter', price_brl: 4900,
    credits_monthly: 60, max_video_duration_min: 60,
    max_clips_per_video: 15, watermark: false,
    stripe_price_id: 'price_starter_monthly',
    mp_plan_id: 'corta_starter',
    features: ["15 cortes por vídeo", "Todos os estilos de legenda", "Sem marca d'água",
               "Agendamento básico (1 rede)"]
  },
  pro: {
    id: 'pro', name: 'Pro', price_brl: 14900,
    credits_monthly: -1,
    max_video_duration_min: 180, max_clips_per_video: 50, watermark: false,
    stripe_price_id: 'price_pro_monthly',
    mp_plan_id: 'corta_pro',
    features: ['Vídeos ilimitados', 'Todos os estilos + templates premium',
               'Agendamento em todas as redes', 'Analytics avançado',
               'Suporte prioritário', 'API access']
  },
  business: {
    id: 'business', name: 'Business', price_brl: 39900,
    credits_monthly: -1, max_video_duration_min: -1, max_clips_per_video: -1, watermark: false,
    features: ['Tudo do Pro', 'White-label', 'Até 5 usuários', 'SLA 99.9%',
               'Onboarding dedicado']
  }
};
