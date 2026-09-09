// Cliente Supabase do FRONT. Só a chave pública (anon) entra aqui.
// A chave de serviço NUNCA chega perto deste arquivo: ela vive nas
// Edge Functions (supabase/functions), e só lá.
import { createClient } from "@supabase/supabase-js";

const url = import.meta.env.VITE_SUPABASE_URL;
const anon = import.meta.env.VITE_SUPABASE_ANON_KEY;

if (!url || !anon) {
  // sem falha silenciosa: melhor quebrar com mensagem do que rodar sem banco
  throw new Error("Configure VITE_SUPABASE_URL e VITE_SUPABASE_ANON_KEY (.env — ver .env.example).");
}

// Expostas para o ÚNICO caminho que precisa falar com o GoTrue por fora
// do cliente: a redefinição de senha (ver `redefinirSenha` em
// shared/data/index.js). Nenhuma tela importa isto direto.
export const SUPABASE_URL = url;
export const SUPABASE_ANON_KEY = anon;

// `detectSessionInUrl: false` — a correção do bug de sessão trocada.
//
// No padrão (`true`), o SDK varre o hash da URL em QUALQUER rota e, se
// achar um `#access_token=...`, grava aquela sessão na MESMA chave de
// localStorage que guarda a sessão normal do app. Como o cliente é um
// singleton por origem, abrir o link de recuperação de um coordenador
// num navegador onde o SuperADM já estava logado SOBRESCREVIA a sessão
// do SuperADM — sem aviso, e em todas as abas da mesma origem.
//
// O app não perde nada com isso desligado: o login é por senha
// (`signInWithPassword`, e-mail ou código). Não há magic link, OAuth
// nem PKCE — nenhum fluxo que dependa de token vindo pela URL. O único
// que vinha era o de recuperação, e ele agora é tratado à mão, sem
// nunca escrever na sessão compartilhada.
export const supabase = createClient(url, anon, {
  auth: {
    detectSessionInUrl: false,
    // `flowType` fixado no que HOJE já é o padrão do SDK. Não muda nada
    // agora; trava o formato do link de recuperação. No fluxo implícito o
    // GoTrue devolve `#access_token=...` no fragmento, que é o que
    // shared/lib/recuperacao.js lê. Se o SDK um dia virar PKCE por
    // padrão, o link passaria a vir como `?code=...` e a redefinição
    // quebraria em silêncio — com o pino, ela continua funcionando e a
    // troca vira uma decisão explícita.
    flowType: "implicit",
  },
});
