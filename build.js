const fs = require('fs');
const path = require('path');

const key = process.env.SUPABASE_ANON_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || process.env.VERCEL_SUPABASE_ANON_KEY || '';

if (key) {
  const configPath = path.join(__dirname, 'config.js');
  let config = fs.readFileSync(configPath, 'utf8');
  
  // Substitui o retorno vazio pelo valor da variável de ambiente no build da Vercel
  config = config.replace(
    /return '';\s*\/\/ Fallback: modo demo/g,
    `return '${key}';`
  );
  
  fs.writeFileSync(configPath, config);
  console.log('✅ Supabase Anon Key injetada com sucesso no config.js durante o build!');
} else {
  console.warn('⚠️ Nenhuma SUPABASE_ANON_KEY encontrada nas variáveis de ambiente. O site rodará em modo demo.');
}
