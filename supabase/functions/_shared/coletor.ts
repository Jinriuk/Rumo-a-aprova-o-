// ============================================================
// Coletor de erros — a parte PURA (Etapa 4, alertas ao dono)
// ------------------------------------------------------------
// Higieniza o relato, calcula o fingerprint e a chave do limite por IP,
// e monta o e-mail. Sem import de rede de propósito: o teste roda este
// arquivo no Node (type stripping do Node 22), como o de escola.ts.
// Quem fala com o banco e com o Resend é coletor-servidor.ts.
//
// Regra do relato: o que não está na lista abaixo é descartado; o que
// está é cortado no limite e passa pela redação de dado pessoal ANTES
// de ir para o banco ou para o e-mail. A redação pega formato (e-mail,
// JWT, token, senha em chave=valor, código de acesso, CPF, telefone,
// uuid); nome de pessoa em texto livre não tem formato e não é pego.
// O front e as funções não colocam nome em mensagem de erro, e a
// mensagem é cortada em 500 caracteres.
// ============================================================

export const LIMITES = {
  corpoBytes: 16_384,
  mensagem: 500,
  pilha: 4000,
  componente: 2000,
  rota: 200,
  release: 64,
  origem: 60,
};

export const PAPEIS = new Set([
  "coordenacao", "aluno", "responsavel", "super_admin", "anonimo", "desconhecido", "servidor",
]);

// A ordem importa: o JWT sai antes da regra genérica de segredo longo, a
// chave=valor antes do e-mail (senha=fulano@x vira [redigido] inteira).
const REDACOES: Array<[RegExp, string]> = [
  [/eyJ[A-Za-z0-9_-]{5,}\.[A-Za-z0-9_-]{5,}(?:\.[A-Za-z0-9_-]*)?/g, "[jwt]"],
  [/\bsb_(?:secret|publishable)_[A-Za-z0-9_-]{8,}/g, "[chave]"],
  [/\b(bearer)\s+[A-Za-z0-9._~+/=-]{8,}/gi, "$1 [token]"],
  [/\b((?:access|refresh|id|provider)_token|token|apikey|api_key|authorization|senha|password|passwd|pwd|secret|segredo)(["']?\s*[:=]\s*["']?)[^\s"'&,;}]+/gi, "$1$2[redigido]"],
  [/[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}/g, "[email]"],
  [/\b[A-Z0-9]{4}-[A-Z0-9]{4}-[A-Z0-9]{4}\b/g, "[codigo]"],
  [/\b[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\b/gi, "[id]"],
  [/\b\d{3}\.\d{3}\.\d{3}-\d{2}\b/g, "[numero]"],
  [/\b[A-Za-z0-9_-]{32,}\b/g, "[segredo]"],
  [/\+?\d[\d\s().-]{8,}\d/g, "[numero]"],
];

export function redigir(texto: string): string {
  let s = texto;
  for (const [re, troca] of REDACOES) s = s.replace(re, troca);
  return s;
}

function texto(valor: unknown, limite: number): string | null {
  if (typeof valor !== "string") return null;
  // corta antes (o corpo já tem teto de 16 KB) só para a regex não andar
  // à toa; o corte final é depois da redação, para um segredo cortado ao
  // meio não escapar do padrão
  const s = redigir(valor.slice(0, limite * 2)).trim();
  return s ? s.slice(0, limite) : null;
}

// Só o caminho: sem query nem fragmento (o link de recuperação de senha
// leva o token no fragmento), e segmentos que parecem id viram [id].
export function rotaSegura(valor: unknown): string | null {
  if (typeof valor !== "string") return null;
  let caminho = valor.split(/[?#]/)[0].trim();
  if (!caminho.startsWith("/")) return null;
  caminho = redigir(caminho).replace(/\/\d+(?=\/|$)/g, "/[n]");
  return caminho.slice(0, LIMITES.rota);
}

export type EventoErro = {
  origem: string;
  mensagem: string;
  pilha: string | null;
  componente: string | null;
  rota: string | null;
  release: string | null;
  papel: string;
  correlation_id: string | null;
};

/** Monta o evento a partir do JSON recebido. Aceita o que o
 *  observabilidade.js já mandava (mensagem, pilha, origem, rota, em) e os
 *  campos novos (release, papel, correlation_id, componente). */
export function normalizarEvento(bruto: Record<string, unknown>, padrao: { papel?: string } = {}): EventoErro {
  const origem = typeof bruto.origem === "string" && /^[A-Za-z0-9:._-]{1,60}$/.test(bruto.origem)
    ? bruto.origem.toLowerCase()
    : "desconhecida";
  const release = typeof bruto.release === "string" && /^[A-Za-z0-9._-]{1,64}$/.test(bruto.release)
    ? bruto.release
    : null;
  const papelBruto = typeof bruto.papel === "string" ? bruto.papel : padrao.papel;
  const papel = papelBruto && PAPEIS.has(papelBruto) ? papelBruto : "desconhecido";
  const correlation_id = typeof bruto.correlation_id === "string" && /^[A-Za-z0-9-]{8,64}$/.test(bruto.correlation_id)
    ? bruto.correlation_id
    : null;
  return {
    origem,
    mensagem: texto(bruto.mensagem, LIMITES.mensagem) ?? "(sem mensagem)",
    pilha: texto(bruto.pilha, LIMITES.pilha),
    componente: texto(bruto.componente, LIMITES.componente),
    rota: rotaSegura(bruto.rota),
    release,
    papel,
    correlation_id,
  };
}

/** Evento de uma resposta 5xx de Edge Function: só nome, status e o
 *  correlation_id. Nada do corpo nem do erro (pode carregar dado). */
export function eventoDeServidor(funcao: string, status: number, correlationId: string): EventoErro {
  return normalizarEvento({
    origem: `edge:${funcao}`,
    mensagem: `HTTP ${status} em ${funcao}`,
    rota: `/functions/v1/${funcao}`,
    correlation_id: correlationId,
  }, { papel: "servidor" });
}

const hex = (buf: ArrayBuffer) => [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, "0")).join("");

// O "mesmo erro": origem + mensagem sem números + rota. Release e pilha
// ficam de fora (a pilha minificada muda a cada deploy e quebraria o
// agrupamento; o release fica na ocorrência).
export async function fingerprint(e: Pick<EventoErro, "origem" | "mensagem" | "rota">): Promise<string> {
  const msg = e.mensagem.toLowerCase().replace(/\d+/g, "#").replace(/\s+/g, " ").trim();
  const base = `${e.origem}|${msg}|${e.rota ?? ""}`;
  return hex(await crypto.subtle.digest("SHA-256", new TextEncoder().encode(base))).slice(0, 32);
}

// IP do cliente. cf-connecting-ip é escrito pela Cloudflare na frente do
// Supabase hospedado (o cliente não o forja quando o tráfego passa por
// ela); os outros dois são o recurso. NÃO VERIFICADO no hospedado: o
// limite por IP é a primeira trava; as que valem sob abuso são os tetos
// globais da 0059 (500 ocorrências e 20 e-mails em 24 h).
export function ipDoCliente(h: Headers): string {
  const cf = h.get("cf-connecting-ip")?.trim();
  if (cf) return cf;
  const real = h.get("x-real-ip")?.trim();
  if (real) return real;
  const xff = h.get("x-forwarded-for")?.split(",")[0]?.trim();
  return xff || "desconhecido";
}

// O IP nunca vai para o banco: só um HMAC dele com o segredo da função e
// a data UTC (muda todo dia; não se reverte varrendo os 2^32 IPv4 sem o
// segredo). A linha do contador vive uma hora.
export async function chaveLimiteIp(ip: string, segredo: string, agora: Date): Promise<string> {
  const dia = agora.toISOString().slice(0, 10);
  const chave = await crypto.subtle.importKey(
    "raw", new TextEncoder().encode(`registrar-erro|${segredo}`), { name: "HMAC", hash: "SHA-256" }, false, ["sign"],
  );
  const assinatura = await crypto.subtle.sign("HMAC", chave, new TextEncoder().encode(`${dia}|${ip}`));
  return `ip:${hex(assinatura).slice(0, 32)}`;
}

/** Lê o corpo com teto: devolve null se passar de `max` bytes. */
export async function lerCorpoLimitado(req: Request, max: number): Promise<string | null> {
  const declarado = Number(req.headers.get("content-length") ?? "");
  if (Number.isFinite(declarado) && declarado > max) return null;
  if (!req.body) return "";
  const leitor = req.body.getReader();
  const partes: Uint8Array[] = [];
  let total = 0;
  for (;;) {
    const { done, value } = await leitor.read();
    if (done) break;
    total += value.byteLength;
    if (total > max) {
      await leitor.cancel().catch(() => {});
      return null;
    }
    partes.push(value);
  }
  const tudo = new Uint8Array(total);
  let pos = 0;
  for (const p of partes) { tudo.set(p, pos); pos += p.byteLength; }
  return new TextDecoder().decode(tudo);
}

// Nome legível do ambiente no assunto do e-mail (P e D mandam para o
// mesmo destinatário). Os refs não são segredo: estão nos docs e no
// .env.production versionado.
const AMBIENTES: Record<string, string> = {
  zckyhihxjjbnqjqilymn: "produção",
  bdjkgrzfzoamchdpobbl: "demo",
};

export function ambienteDoProjeto(supabaseUrl: string): string {
  try {
    const host = new URL(supabaseUrl).hostname;
    const ref = host.split(".")[0];
    if (AMBIENTES[ref]) return AMBIENTES[ref];
    return host.endsWith(".supabase.co") ? ref : "local";
  } catch {
    return "desconhecido";
  }
}

const escapar = (s: string) =>
  s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

export type ResumoGrupo = { fingerprint: string; ocorrencias: number; primeira_em: string; resultado: string };

export function montarEmail(e: EventoErro, g: ResumoGrupo, ambiente: string): { assunto: string; texto: string; html: string } {
  const teto = g.resultado === "teto";
  const titulo = teto ? "coletor no teto diário" : `${e.origem}: ${e.mensagem.slice(0, 80)}`;
  const linhas: Array<[string, string]> = teto
    ? [
        ["Ambiente", ambiente],
        ["O que houve", "500 ocorrências gravadas em 24 h; relatos acima disso só são contados."],
        ["Relatos no grupo", String(g.ocorrencias)],
      ]
    : [
        ["Ambiente", ambiente],
        ["Origem", e.origem],
        ["Mensagem", e.mensagem],
        ["Rota", e.rota ?? "-"],
        ["Release", e.release ?? "-"],
        ["Papel", e.papel],
        ["correlation_id", e.correlation_id ?? "-"],
        ["Ocorrências do grupo", String(g.ocorrencias)],
        ["Primeira vez", g.primeira_em],
        ["Fingerprint", g.fingerprint],
      ];
  const consulta = `select criado_em, release, papel, rota, correlation_id, mensagem, pilha\n  from app.erros_ocorrencias\n where fingerprint = '${g.fingerprint}'\n order by criado_em desc limit 20;`;
  const rodape = "No máximo 1 e-mail por erro por hora e 20 por dia. Sem dado pessoal: e-mail, token, senha e JWT são redigidos antes de gravar.";
  const texto = [
    ...linhas.map(([k, v]) => `${k}: ${v}`),
    "",
    "Detalhes (SQL editor do Supabase deste ambiente):",
    consulta,
    "",
    rodape,
  ].join("\n");
  const html = `<p><strong>Triliva · alerta de erro (${escapar(ambiente)})</strong></p>`
    + `<table>${linhas.map(([k, v]) => `<tr><td>${escapar(k)}</td><td><code>${escapar(v)}</code></td></tr>`).join("")}</table>`
    + `<p>Detalhes (SQL editor do Supabase deste ambiente):</p><pre>${escapar(consulta)}</pre>`
    + `<p>${escapar(rodape)}</p>`;
  return { assunto: `[Triliva ${ambiente}] ${titulo}`, texto, html };
}
