# Relatório Vercel — QA0 pós-D0

## O que foi possível verificar

- App em produção: rumo-a-aprova-o.vercel.app — online, responde, build servida.
- Bundle de produção só contém chaves públicas (VITE_SUPABASE_ANON_KEY / URL). Nenhum segredo de servidor no front.
- Front conversa com Supabase via PostgREST/RPC, dependendo de RLS (confirmado).

## Não verificável de forma independente

- Painel da Vercel (variáveis de ambiente, domínios, logs de deploy, proteção de preview) não foi acessado — requer operador.

## Achados

| ID | Achado | Área | Impacto | Prio | Sugestão | Esforço | Fase |
|----|--------|------|---------|------|----------|---------|------|
| VER-1 | Domínio de produção é vercel.app | Branding/Confiança | Médio para demo a escola/rede. URL genérica reduz percepção de produto pronto | P2 | Configurar domínio próprio (ex.: rumoaaprovacao.com.br) antes de reuniões de venda | Baixo | patch |
| VER-2 | Env vars / proteção de preview não auditadas | Infra | Não verificável aqui | P3 | Operador conferir que previews não expõem dados demo e que só chaves públicas estão no front | Baixo | S1 |
