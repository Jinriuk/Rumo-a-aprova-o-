// ============================================================
// Coletor de erros — a parte que fala com o banco e com o Resend
// ------------------------------------------------------------
// Usado pela função registrar-erro (relatos do front) e por
// comRelato5xx (respostas 5xx das outras funções). As decisões que
// precisam ser atômicas entre instâncias (limite por chave, teto diário,
// 1 e-mail por fingerprint por hora, 20 por dia) estão na RPC
// public.coletor_registrar_erro (0059), executável só pela chave de
// serviço.
//
// Configuração (Edge Functions › Secrets):
//   ALERTA_EMAIL       destinatário dos alertas (novo, Etapa 4)
//   RESEND_API_KEY     já existe (backoffice-coordenador)
//   RESEND_FROM_EMAIL  já existe; remetente verificado no Resend
// Sem qualquer um dos três, o relato é gravado e o e-mail não sai (o log
// da função diz o que falta). RESEND_API_URL só é lido se apontar para
// host local ou privado: existe para a prova na stack local (Resend
// simulado) e não redireciona alerta para fora em ambiente hospedado.
// ============================================================
import { createClient, SupabaseClient } from "jsr:@supabase/supabase-js@2";
import { buildCorsHeaders } from "./cors.ts";
import { ambienteDoProjeto, fingerprint, montarEmail, type EventoErro, type ResumoGrupo } from "./coletor.ts";
import { envolverCom5xx } from "./relato5xx.ts";

let cliente: SupabaseClient | null = null;
function admin(): SupabaseClient {
  // preguiçoso: as funções que importam isto só criam o cliente no
  // primeiro 5xx, e as que já têm cliente próprio não mudam de forma
  cliente ??= createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    { auth: { persistSession: false } },
  );
  return cliente;
}

const HOST_LOCAL = /^(localhost|127\.\d+\.\d+\.\d+|host\.docker\.internal|10\.\d+\.\d+\.\d+|192\.168\.\d+\.\d+|172\.(1[6-9]|2\d|3[01])\.\d+\.\d+)$/;

function urlResend(): string {
  const sobrescrita = (Deno.env.get("RESEND_API_URL") ?? "").trim();
  if (sobrescrita) {
    try {
      const u = new URL(sobrescrita);
      if (HOST_LOCAL.test(u.hostname)) return `${sobrescrita.replace(/\/$/, "")}/emails`;
      console.error("coletor: RESEND_API_URL ignorada (só vale para host local, prova da stack local)");
    } catch {
      console.error("coletor: RESEND_API_URL inválida, ignorada");
    }
  }
  return "https://api.resend.com/emails";
}

function configEmail() {
  const destino = (Deno.env.get("ALERTA_EMAIL") ?? "").trim();
  const chave = Deno.env.get("RESEND_API_KEY") ?? "";
  const remetente = (Deno.env.get("RESEND_FROM_EMAIL") ?? "").trim();
  const faltando = [
    !destino && "ALERTA_EMAIL", !chave && "RESEND_API_KEY", !remetente && "RESEND_FROM_EMAIL",
  ].filter(Boolean);
  return { destino, chave, remetente, faltando };
}

// Só devolve true quando o Resend confirma (2xx). Nunca lança.
async function enviarAlerta(e: EventoErro, g: ResumoGrupo): Promise<boolean> {
  const { destino, chave, remetente } = configEmail();
  const { assunto, texto, html } = montarEmail(e, g, ambienteDoProjeto(Deno.env.get("SUPABASE_URL") ?? ""));
  try {
    const resp = await fetch(urlResend(), {
      method: "POST",
      headers: { "authorization": `Bearer ${chave}`, "content-type": "application/json" },
      body: JSON.stringify({ from: remetente, to: destino, subject: assunto, text: texto, html }),
      signal: AbortSignal.timeout(8000),
    });
    if (!resp.ok) {
      console.error("coletor: Resend recusou o alerta", resp.status);
      return false;
    }
    return true;
  } catch (err) {
    console.error("coletor: falha de rede ao chamar o Resend", (err as Error)?.message);
    return false;
  }
}

export type ResultadoColeta = { resultado: "registrado" | "teto" | "limitado"; enviar_email?: boolean; email_enviado?: boolean };

export async function registrarEvento(e: EventoErro, chaveLimite: string): Promise<ResultadoColeta> {
  const cfg = configEmail();
  if (cfg.faltando.length) {
    console.error(`coletor: alerta por e-mail desligado, falta ${cfg.faltando.join(", ")} (o relato é gravado mesmo assim)`);
  }
  const fp = await fingerprint(e);
  const { data, error } = await admin().rpc("coletor_registrar_erro", {
    p_chave_limite: chaveLimite,
    p_fingerprint: fp,
    p_evento: e,
    p_pode_enviar: cfg.faltando.length === 0,
  });
  if (error) throw new Error(`coletor_registrar_erro: ${error.message}`);
  const r = data as ResumoGrupo & { enviar_email: boolean; email_id: number | null };
  if (!r?.enviar_email || r.email_id == null) return { resultado: r.resultado as ResultadoColeta["resultado"] };

  const ok = await enviarAlerta(e, r);
  const { error: erroMarca } = await admin().rpc("coletor_marcar_email", { p_email_id: r.email_id, p_ok: ok });
  if (erroMarca) console.error("coletor: falha ao marcar o envio", erroMarca.message);
  return { resultado: r.resultado as ResultadoColeta["resultado"], enviar_email: true, email_enviado: ok };
}

// E-mails que o BANCO reservou (falha do motor de missões, 0061): ficam
// com fila = true até alguém despachar. Quem despacha é esta função,
// chamada pelo pg_net com ?despachar=1 logo depois da falha, e também a
// cada relato do front (rede de segurança, se o pg_net ou o project_url
// faltarem). Só envia o que o banco já decidiu e reservou (tetos da
// 0059): uma chamada à toa no máximo adianta um envio.
export async function despacharPendentes(): Promise<number> {
  const cfg = configEmail();
  const { data, error } = await admin().rpc("coletor_despachar_pendentes", { p_limite: 10 });
  if (error) throw new Error(`coletor_despachar_pendentes: ${error.message}`);
  let enviados = 0;
  for (const item of (data ?? []) as Array<ResumoGrupo & { email_id: number; evento: EventoErro }>) {
    const ok = cfg.faltando.length === 0 && await enviarAlerta(item.evento, item);
    const { error: erroMarca } = await admin().rpc("coletor_marcar_email", { p_email_id: item.email_id, p_ok: ok });
    if (erroMarca) console.error("coletor: falha ao marcar o envio", erroMarca.message);
    if (ok) enviados++;
  }
  return enviados;
}

/** Envolve o handler de uma Edge Function: 5xx vira relato no coletor. */
export function comRelato5xx(funcao: string, handler: (req: Request) => Response | Promise<Response>) {
  return envolverCom5xx(funcao, handler, registrarEvento, { cors: buildCorsHeaders });
}
