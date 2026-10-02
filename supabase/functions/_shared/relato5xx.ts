// ============================================================
// Relato de 5xx das Edge Functions (Etapa 4, alertas ao dono)
// ------------------------------------------------------------
// Envolve o handler de uma função: toda resposta 5xx (ou exceção que
// escape do handler) vira um evento no mesmo coletor do front, com nome
// da função, status e um correlation_id. Nada do corpo, do erro nem de
// quem chamou: a mensagem do Postgres pode carregar dado de aluno.
//
// O correlation_id volta no cabeçalho x-correlation-id da resposta
// (exposto ao navegador), e o front o anexa ao relato do erro que a
// falha causar: as duas pontas se acham pela mesma chave. O detalhe do
// erro continua só no log da função (console.error), procurável pelo id.
//
// Puro de propósito (sem import de rede): o teste roda no Node com um
// `registrar` falso. A ligação com o banco está em coletor-servidor.ts.
// O relato espera no máximo `esperaMs`: coletor lento ou fora do ar
// atrasa a resposta 5xx em até esse tempo e nunca muda o status dela.
// ============================================================
import { eventoDeServidor, type EventoErro } from "./coletor.ts";

type Handler = (req: Request) => Response | Promise<Response>;
export type Registrar = (evento: EventoErro, chaveLimite: string) => Promise<unknown>;

const ID_VALIDO = /^[A-Za-z0-9-]{8,64}$/;

function comPrazo<T>(p: Promise<T>, ms: number): Promise<T | undefined> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  const prazo = new Promise<undefined>((ok) => { timer = setTimeout(() => ok(undefined), ms); });
  return Promise.race([p, prazo]).finally(() => clearTimeout(timer));
}

export function envolverCom5xx(
  funcao: string,
  handler: Handler,
  registrar: Registrar,
  opcoes: { esperaMs?: number; cors?: (req: Request) => Record<string, string> } = {},
): Handler {
  const esperaMs = opcoes.esperaMs ?? 1500;
  return async (req: Request) => {
    let resp: Response;
    try {
      resp = await handler(req);
    } catch (e) {
      console.error(`${funcao}: exceção fora do handler`, (e as Error)?.message ?? e);
      resp = new Response(JSON.stringify({ error: "falha interna" }), {
        status: 500,
        headers: { ...(opcoes.cors?.(req) ?? {}), "content-type": "application/json" },
      });
    }
    if (resp.status < 500) return resp;

    const recebido = req.headers.get("x-correlation-id") ?? "";
    const cid = ID_VALIDO.test(recebido) ? recebido : crypto.randomUUID();
    console.error(`${funcao}: HTTP ${resp.status} correlation_id=${cid}`);
    try {
      await comPrazo(registrar(eventoDeServidor(funcao, resp.status, cid), `edge:${funcao}`), esperaMs);
    } catch (e) {
      console.error(`${funcao}: relato do 5xx ao coletor falhou`, (e as Error)?.message ?? e);
    }

    const headers = new Headers(resp.headers);
    headers.set("x-correlation-id", cid);
    const expostos = headers.get("access-control-expose-headers");
    headers.set("access-control-expose-headers", expostos ? `${expostos}, x-correlation-id` : "x-correlation-id");
    return new Response(resp.body, { status: resp.status, statusText: resp.statusText, headers });
  };
}
