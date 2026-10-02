/* Observabilidade mínima do front (Fase A.4; coletor na Etapa 4).
   Sem VITE_ERROR_REPORT_URL, só loga no console. Com ela (a Edge Function
   registrar-erro do MESMO ambiente, docs/operacao/alertas-dono.md), faz um
   POST best-effort do erro técnico: nunca bloqueia, nunca lança, nunca
   derruba a tela se o coletor estiver fora do ar, lento ou recusando.

   O relato leva: mensagem, pilha, origem, rota (só o caminho, ids
   trocados por [id]), release (SHA do build), papel de quem está logado
   e um correlation_id. Nunca inclua dado pessoal de aluno/responsável:
   o coletor ainda redige e-mail, token, senha e JWT, mas o front não
   manda nome, e-mail nem id de pessoa por conta própria.

   `text/plain` de propósito: é pedido "simples" para o navegador (sem
   preflight), e o coletor lê o corpo como JSON do mesmo jeito. */
const ENDPOINT = import.meta.env?.VITE_ERROR_REPORT_URL;
// gravado no build pelo vite.config.js (SHA do commit); fora do Vite, "dev"
const RELEASE = import.meta.env?.VITE_RELEASE || "dev";

export const LIMITES = { mensagem: 500, pilha: 4000, componente: 2000, porPagina: 10, repetidoMs: 10_000 };

const PAPEIS = new Set(["coordenacao", "aluno", "responsavel", "super_admin", "anonimo", "desconhecido"]);
let papelAtual = "anonimo";
let enviados = 0;
const recentes = new Map();

/** Papel de quem está na tela, a partir do estado da sessão (App.jsx). */
export function papelDaSessao({ sessao, perfil, superAdmin } = {}) {
  if (!sessao) return "anonimo";
  if (superAdmin) return "super_admin";
  const p = perfil?.usuario?.papel;
  return PAPEIS.has(p) ? p : "desconhecido";
}

export function definirPapel(papel) {
  papelAtual = PAPEIS.has(papel) ? papel : "desconhecido";
}

export function novoCorrelationId() {
  try {
    if (globalThis.crypto?.randomUUID) return globalThis.crypto.randomUUID();
  } catch { /* contexto sem crypto seguro: cai no aleatório abaixo */ }
  return `${Date.now().toString(16)}-${Math.random().toString(16).slice(2, 10)}-${Math.random().toString(16).slice(2, 10)}`;
}

const UUID = /[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/gi;
export function rotaAtual() {
  if (typeof location === "undefined") return null;
  return String(location.pathname || "/").replace(UUID, "[id]").slice(0, 200);
}

const cortar = (v, n) => (v == null ? null : String(v).slice(0, n));

/** Monta o corpo do relato (puro, testável). */
export function montarRelato(erro, contexto = {}, correlationId = novoCorrelationId()) {
  return {
    mensagem: cortar(erro?.message ?? erro ?? "erro desconhecido", LIMITES.mensagem),
    pilha: cortar(erro?.stack, LIMITES.pilha),
    componente: cortar(contexto.componente, LIMITES.componente),
    origem: contexto.origem ?? null,
    em: new Date().toISOString(),
    rota: rotaAtual(),
    release: RELEASE,
    papel: papelAtual,
    correlation_id: correlationId,
  };
}

// Um laço de erro (efeito que relança a cada render) não pode virar
// enxurrada: no máximo 10 relatos por carregamento de página, e o mesmo
// erro só uma vez a cada 10 s. O coletor tem os próprios limites; estes
// poupam a rede do usuário. O repetido devolve o id do relato que saiu,
// para a tela mostrar um código que existe no coletor.
function decidirEnvio(relato, agora) {
  const chave = `${relato.origem}|${relato.mensagem}`;
  const ultimo = recentes.get(chave);
  if (ultimo !== undefined && agora - ultimo.em < LIMITES.repetidoMs) return { enviar: false, idAnterior: ultimo.id };
  if (enviados >= LIMITES.porPagina) return { enviar: false, idAnterior: null };
  recentes.set(chave, { em: agora, id: relato.correlation_id });
  enviados++;
  return { enviar: true, idAnterior: null };
}

// `fetch` solto (sem o window como this) dá "Illegal invocation" no
// navegador: a chamada passa pela função, nunca pela referência.
const fetchGlobal = (...args) => globalThis.fetch(...args);

/** Registra o erro e devolve um correlation_id que dá para procurar no
 *  coletor, ou null quando nada foi registrado (sem coletor, limite da
 *  página): a tela não mostra código que ninguém consegue achar. O id do
 *  erro de Edge Function (cabeçalho x-correlation-id, anexado em
 *  shared/data) já existe do lado do servidor e tem precedência: liga as
 *  duas pontas. */
export function capturarErro(erro, contexto = {}, { endpoint = ENDPOINT, enviar = fetchGlobal } = {}) {
  let idServidor = null;
  try {
    if (typeof erro?.correlation_id === "string") idServidor = erro.correlation_id;
  } catch { /* getter que lança não derruba a captura */ }
  try {
    console.error(`[observabilidade${contexto.origem ? ":" + contexto.origem : ""}]`, erro);
  } catch { /* console sequestrado não pode derrubar nada */ }
  try {
    if (!endpoint || (enviar === fetchGlobal && typeof globalThis.fetch !== "function")) return idServidor;
    const relato = montarRelato(erro, contexto, idServidor ?? novoCorrelationId());
    const decisao = decidirEnvio(relato, Date.now());
    if (!decisao.enviar) return idServidor ?? decisao.idAnterior;
    const pendente = enviar(endpoint, {
      method: "POST",
      headers: { "Content-Type": "text/plain;charset=UTF-8" },
      body: JSON.stringify(relato),
      keepalive: true,
      credentials: "omit",
    });
    if (pendente && typeof pendente.catch === "function") pendente.catch(() => {});
    return relato.correlation_id;
  } catch {
    // observabilidade nunca pode ser a causa de uma falha
    return idServidor;
  }
}

export function instalarCapturaGlobal() {
  if (typeof window === "undefined") return;
  window.addEventListener("error", (ev) => capturarErro(ev.error ?? ev.message, { origem: "window.onerror" }));
  window.addEventListener("unhandledrejection", (ev) => capturarErro(ev.reason, { origem: "unhandledrejection" }));
}

/** Só para teste: zera o contador por página. */
export function _reiniciarLimites() {
  enviados = 0;
  recentes.clear();
}
