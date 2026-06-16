/* Observabilidade mínima do front (Fase A.4).
   Sem dependência obrigatória de serviço externo: por padrão só loga no
   console. Se VITE_ERROR_REPORT_URL estiver definida, também tenta um
   POST best-effort (nunca bloqueia, nunca derruba o app se falhar) — é o
   ponto de extensão para um Sentry (ou equivalente) mais adiante, sem
   acoplar o sistema a ele agora.
   Nunca inclua dado pessoal de aluno/responsável no relato — só o erro
   técnico (mensagem, pilha, rota). */
const ENDPOINT = import.meta.env?.VITE_ERROR_REPORT_URL;

export function capturarErro(erro, contexto = {}) {
  console.error(`[observabilidade${contexto.origem ? ":" + contexto.origem : ""}]`, erro);
  if (!ENDPOINT) return;
  try {
    fetch(ENDPOINT, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        mensagem: String(erro?.message ?? erro ?? "erro desconhecido"),
        pilha: erro?.stack ?? null,
        origem: contexto.origem ?? null,
        em: new Date().toISOString(),
        rota: typeof location !== "undefined" ? location.pathname : null,
      }),
      keepalive: true,
    }).catch(() => {});
  } catch {
    // observabilidade nunca pode ser a causa de uma falha
  }
}

export function instalarCapturaGlobal() {
  if (typeof window === "undefined") return;
  window.addEventListener("error", (ev) => capturarErro(ev.error ?? ev.message, { origem: "window.onerror" }));
  window.addEventListener("unhandledrejection", (ev) => capturarErro(ev.reason, { origem: "unhandledrejection" }));
}
