// ============================================================
// provisionar-aluno — gera e administra credencial de acesso (Doc 6,
// 1.1 · Etapa 7 / BLOCO B1-B5: código identifica, senha autentica)
// Auto-contida: sem imports de _shared/ (compat. com MCP bundler)
// ------------------------------------------------------------
// Tipos suportados (payload por aluno_id — criação):
//   aluno                 — cria credencial para o aluno
//   responsavel            — cria credencial para novo responsável e vincula
//   vincular-responsavel   — vincula responsável JÁ EXISTENTE ao aluno
//                            (re-vincula responsável revogado sem duplicar conta)
//
// Tipos suportados (payload por usuario_id — ciclo de vida da credencial):
//   resetar-senha          — nova senha temporária; volta a exigir troca (B3)
//   revogar-credencial      — bane a conta no Auth, preserva histórico (B5)
//   reativar-credencial     — remove o ban + nova senha temporária (B5)
//
// O código é só IDENTIFICADOR (email sintético @codigo.acesso.local,
// nunca muda). A senha é um segredo PRÓPRIO, gerada aqui, temporária —
// o dono troca por uma pessoal no primeiro acesso (trocar-senha) e a
// coordenação nunca mais a vê depois de gerada/resetada.
// ============================================================
import { createClient } from "jsr:@supabase/supabase-js@2";

const admin = createClient(
  Deno.env.get("SUPABASE_URL")!,
  Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  { auth: { persistSession: false } },
);

// CORS com allowlist (SEG2 / E-1). Função auto-contida (sem imports de
// _shared/): a versão canônica do helper vive em _shared/cors.ts; aqui é
// uma cópia mínima de propósito, para não depender do bundler de _shared.
// ALLOWED_ORIGINS (CSV) no ambiente substitui a lista padrão.
const ENV_ORIGINS = (Deno.env.get("ALLOWED_ORIGINS") ?? "")
  .split(",").map((o) => o.trim()).filter(Boolean);
const DEFAULT_ORIGINS = [
  "https://rumo-a-aprova-o.vercel.app",
  "http://localhost:5173",
  "http://localhost:3000",
];
const ORIGINS = ENV_ORIGINS.length > 0 ? ENV_ORIGINS : DEFAULT_ORIGINS;
// Slugs do(s) projeto(s) na Vercel (previews): VERCEL_PREVIEW_PREFIXES
// (CSV, só [a-z0-9-] por item); sem ela cai no singular
// VERCEL_PREVIEW_PREFIX (compat) e por fim no default. Espelha _shared/cors.ts.
const PREVIEW_PREFIX_DEFAULTS = ["rumo-a-aprova-o"];
const PREVIEW_PREFIX_RE = /^[a-z0-9-]{1,63}$/i;
function previewPrefixes(): string[] {
  const csv = (Deno.env.get("VERCEL_PREVIEW_PREFIXES") ?? "")
    .split(",").map((p) => p.trim()).filter((p) => PREVIEW_PREFIX_RE.test(p));
  if (csv.length > 0) return csv;
  const single = (Deno.env.get("VERCEL_PREVIEW_PREFIX") ?? "").trim();
  if (PREVIEW_PREFIX_RE.test(single)) return [single];
  return PREVIEW_PREFIX_DEFAULTS;
}
const VERCEL_PREVIEW = new RegExp(
  `^https://(?:${previewPrefixes().join("|")})-[a-z0-9-]+\\.vercel\\.app$`, "i",
);

function origemPermitida(origin: string): boolean {
  if (!origin) return false;
  if (ORIGINS.includes(origin)) return true;
  return VERCEL_PREVIEW.test(origin);
}

function corsHeaders(req: Request): Record<string, string> {
  const origin = req.headers.get("origin") ?? "";
  const headers: Record<string, string> = {
    "Vary": "Origin",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
    "Access-Control-Max-Age": "86400",
  };
  if (origemPermitida(origin)) headers["Access-Control-Allow-Origin"] = origin;
  return headers;
}

// sem 0/O/1/I/L pra credencial ser ditável por telefone sem erro
const ALFABETO = "ABCDEFGHJKMNPQRSTUVWXYZ23456789";

function novoCodigo(): string {
  const bytes = crypto.getRandomValues(new Uint8Array(12));
  const s = [...bytes].map((b) => ALFABETO[b % ALFABETO.length]).join("");
  return `${s.slice(0, 4)}-${s.slice(4, 8)}-${s.slice(8, 12)}`;
}

// Etapa 7 / BLOCO B1: senha temporária CSPRNG, INDEPENDENTE do código —
// alfabeto maior e com minúsculas (56 símbolos) de propósito, pra nunca
// se confundir visualmente com o código (31 símbolos, só maiúsculas,
// formato XXXX-XXXX-XXXX). 16 posições ≈ 93 bits — bem acima do
// necessário pra um segredo que só vive até a primeira troca.
const ALFABETO_SENHA = "ABCDEFGHJKMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789";

function novaSenhaTemporaria(): string {
  const bytes = crypto.getRandomValues(new Uint8Array(16));
  return [...bytes].map((b) => ALFABETO_SENHA[b % ALFABETO_SENHA.length]).join("");
}

// Espelha normalizarCodigo() do frontend (shared/data/index.js): mesma
// canonicalização nos dois lados da fronteira login-por-código, pra
// e-mail e senha nunca divergirem de novo (0093 — bug de login raiz).
const normalizarCodigo = (codigo: string) =>
  codigo.replace(/[^a-zA-Z0-9]/g, "").toUpperCase();

const emailDoCodigo = (codigo: string) =>
  `${normalizarCodigo(codigo).toLowerCase()}@codigo.acesso.local`;

async function chamador(req: Request) {
  const auth = req.headers.get("authorization") ?? "";
  const token = auth.replace(/^Bearer\s+/i, "");
  if (!token) return null;
  const { data, error } = await admin.auth.getUser(token);
  if (error || !data.user) return null;
  const meta = (data.user.app_metadata ?? {}) as Record<string, string>;
  if (!meta.escola_id || !meta.papel) return null;
  return { id: data.user.id, escola_id: meta.escola_id, papel: meta.papel };
}

async function alunoDaEscola(alunoId: string, escolaId: string) {
  const { data, error } = await admin
    .from("alunos")
    .select("id, escola_id, nome, usuario_id, trilha_id, status_provisionamento")
    .eq("id", alunoId)
    .eq("escola_id", escolaId)
    .maybeSingle();
  if (error) throw error;
  return data;
}

// Etapa 7 / BLOCO B3/B5: alvo de resetar-senha/revogar-credencial/
// reativar-credencial é um USUARIO (aluno OU responsável), não um aluno
// — um aluno pode ter vários responsáveis vinculados, então a ação
// precisa mirar a conta certa direto pelo id, não inferir por aluno_id.
// `in("papel", ...)` é defesa em profundidade: nunca deixa a coordenação
// acionar isto contra outra conta de coordenação/super_admin por engano
// ou payload forjado — só aluno/responsável da PRÓPRIA escola.
async function usuarioDaEscola(usuarioId: string, escolaId: string) {
  const { data, error } = await admin
    .from("usuarios")
    .select("id, escola_id, papel, nome")
    .eq("id", usuarioId)
    .eq("escola_id", escolaId)
    .in("papel", ["aluno", "responsavel"])
    .maybeSingle();
  if (error) throw error;
  return data;
}

async function registrarLogAcesso(
  escolaId: string, alunoId: string, usuarioId: string, papel: string, acao: string,
) {
  const { error } = await admin.from("logs_acesso").insert({
    escola_id: escolaId, aluno_id: alunoId, usuario_id: usuarioId, papel, acao,
  });
  if (error) console.error("falha ao registrar log de acesso:", error.message);
}

function registrarLogCoordenacao(
  escolaId: string, usuarioId: string, papel: string, acao: string,
  detalhe: Record<string, unknown>, entidade = "responsavel",
) {
  return admin.from("logs_coordenacao").insert({
    escola_id: escolaId, usuario_id: usuarioId, papel, acao, entidade, detalhe,
  }).then(({ error }) => {
    if (error) console.error("falha ao registrar log de coordenação:", error.message);
  });
}

// Etapa 7 / BLOCO B1: 100 anos — idioma padrão do GoTrue pra "banido até
// segunda ordem" (não existe ban permanente de verdade na API, só uma
// duration bem longa). Reativar limpa com ban_duration:"none".
const BAN_LONGO = "876000h";

// Etapa 7 / BLOCO B3 (caminho 2) / B5: reset, revogação e reativação de
// credencial — sempre por USUARIO (usuarioDaEscola acima), nunca por
// aluno_id. As três reaproveitam o MESMO gerador de senha do
// provisionamento (novaSenhaTemporaria) — nenhuma delas passa perto do
// código do aluno, que continua só identificador.
async function lidarComCredencial(
  tipo: string, usuarioId: string | undefined,
  quem: { id: string; escola_id: string; papel: string },
  json: (body: unknown, status?: number) => Response,
): Promise<Response> {
  if (!usuarioId) {
    return json({ error: "informe usuario_id", estado: "erro_validacao" }, 400);
  }
  const alvo = await usuarioDaEscola(usuarioId, quem.escola_id);
  if (!alvo) return json({ error: "credencial não encontrada nesta escola", estado: "erro_validacao" }, 404);

  if (tipo === "resetar-senha" || tipo === "reativar-credencial") {
    const senhaTemporaria = novaSenhaTemporaria();
    // ORDEM IMPORTA. São dois sistemas (Postgres + GoTrue) sem transação
    // comum, então uma das duas escritas pode falhar sozinha — a ordem
    // decide para que lado o estado quebrado cai. O banco vem PRIMEIRO
    // porque ele é o lado RESTRITIVO: `must_change_password` (e, na
    // reativação, sair de 'revogada') só ampliam a exigência. Se o Auth
    // falhar depois, o pior caso é uma conta que ainda não destravou mas
    // já está marcada pra trocar senha — inofensivo e auto-corrigível
    // repetindo a ação. Na ordem inversa, uma falha no banco deixaria a
    // conta REATIVADA com senha temporária e SEM troca obrigatória: o
    // exato buraco que o BLOCO B2 existe pra fechar.
    const patchUsuario: Record<string, unknown> = { must_change_password: true };
    if (tipo === "reativar-credencial") patchUsuario.credencial_status = "ativa";
    const { error: e1 } = await admin.from("usuarios").update(patchUsuario).eq("id", usuarioId);
    if (e1) throw e1;
    // reativar-credencial SEMPRE emite senha nova (nunca reaproveita a
    // que estava ativa quando a conta foi revogada — pode ter sido
    // exatamente o motivo da revogação).
    const patchAuth: Record<string, unknown> = { password: senhaTemporaria };
    if (tipo === "reativar-credencial") patchAuth.ban_duration = "none";
    const { error: e2 } = await admin.auth.admin.updateUserById(usuarioId, patchAuth);
    if (e2) throw e2;
    const acao = tipo === "resetar-senha" ? "resetou-senha" : "reativou-credencial";
    await registrarLogCoordenacao(quem.escola_id, quem.id, quem.papel, acao,
      { usuario_id: usuarioId, nome_alvo: alvo.nome, papel_alvo: alvo.papel }, alvo.papel);
    const estado = tipo === "resetar-senha" ? "senha_resetada" : "credencial_reativada";
    return json({ senhaTemporaria, papel: alvo.papel, nome: alvo.nome, estado });
  }

  if (tipo === "revogar-credencial") {
    // ORDEM INVERTIDA em relação ao bloco acima, de propósito — não
    // uniformize. A regra é sempre "o lado restritivo primeiro", e aqui
    // quem restringe é o BAN (o banco só guarda o rótulo que a tela lê).
    // Banindo antes: se o banco falhar, a conta já não entra e a tela
    // fica dizendo 'ativa' — desconfortável, mas seguro. Na ordem do
    // outro bloco, o banco diria 'revogada' com a conta ainda entrando.
    const { error: e1 } = await admin.auth.admin.updateUserById(usuarioId, { ban_duration: BAN_LONGO });
    if (e1) throw e1;
    const { error: e2 } = await admin.from("usuarios").update({ credencial_status: "revogada" }).eq("id", usuarioId);
    if (e2) throw e2;
    await registrarLogCoordenacao(quem.escola_id, quem.id, quem.papel, "revogou-credencial",
      { usuario_id: usuarioId, nome_alvo: alvo.nome, papel_alvo: alvo.papel }, alvo.papel);
    return json({ papel: alvo.papel, nome: alvo.nome, estado: "credencial_revogada" });
  }

  return json({ error: "tipo de ação de credencial desconhecido", estado: "erro_validacao" }, 400);
}

Deno.serve(async (req) => {
  const cors = corsHeaders(req);
  const json = (body: unknown, status = 200) =>
    new Response(JSON.stringify(body), {
      status,
      headers: { ...cors, "content-type": "application/json" },
    });

  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  if (req.method !== "POST") return json({ error: "método não suportado" }, 405);

  try {
    const quem = await chamador(req);
    if (!quem) return json({ error: "não autenticado" }, 401);
    if (quem.papel !== "coordenacao") return json({ error: "só a coordenação provisiona acesso" }, 403);

    const { tipo, aluno_id, nome, responsavel_id, usuario_id } = await req.json().catch(() => ({}));

    // Ações de credencial (B3/B5) miram um USUARIO direto — shape de
    // payload diferente das ações de aluno_id abaixo, então saem daqui
    // antes de cair no gate que exige aluno_id.
    const TIPOS_CREDENCIAL = ["resetar-senha", "revogar-credencial", "reativar-credencial"];
    if (TIPOS_CREDENCIAL.includes(tipo)) {
      return await lidarComCredencial(tipo, usuario_id, quem, json);
    }

    const tiposValidos = ["aluno", "responsavel", "vincular-responsavel"];
    if (!aluno_id || !tiposValidos.includes(tipo)) {
      return json({
        error: "informe tipo ('aluno' | 'responsavel' | 'vincular-responsavel' | 'resetar-senha' | "
          + "'revogar-credencial' | 'reativar-credencial') e o id correspondente (aluno_id ou usuario_id)",
        estado: "erro_validacao",
      }, 400);
    }

    const aluno = await alunoDaEscola(aluno_id, quem.escola_id);
    if (!aluno) return json({ error: "aluno não encontrado nesta escola", estado: "erro_validacao" }, 404);

    // ── Vincular responsável existente (re-vinculação sem duplicar conta) ───
    if (tipo === "vincular-responsavel") {
      if (!responsavel_id) {
        return json({ error: "informe responsavel_id", estado: "erro_validacao" }, 400);
      }

      const { data: resp } = await admin
        .from("usuarios")
        .select("id, nome, papel")
        .eq("id", responsavel_id)
        .eq("escola_id", quem.escola_id)
        .eq("papel", "responsavel")
        .maybeSingle();
      if (!resp) {
        return json({ error: "responsável não encontrado nesta escola", estado: "erro_validacao" }, 404);
      }

      const { data: existente } = await admin
        .from("vinculos_responsaveis")
        .select("id")
        .eq("aluno_id", aluno_id)
        .eq("responsavel_id", responsavel_id)
        .maybeSingle();

      if (existente) {
        return json({
          estado: "vinculo_ja_existente",
          responsavel_nome: resp.nome,
          aluno_nome: aluno.nome,
        });
      }

      const { error: errV } = await admin.from("vinculos_responsaveis").insert({
        escola_id: quem.escola_id, responsavel_id, aluno_id,
      });
      if (errV) throw errV;

      await registrarLogCoordenacao(quem.escola_id, quem.id, quem.papel, "revinculou-responsavel", {
        responsavel_id,
        aluno_id,
        nome_responsavel: resp.nome,
        nome_aluno: aluno.nome,
      });

      return json({
        estado: "vinculo_reativado",
        responsavel_nome: resp.nome,
        aluno_nome: aluno.nome,
      });
    }

    // ── Gerar credencial de aluno ────────────────────────────────────────────
    if (tipo === "aluno" && aluno.usuario_id) {
      return json({
        error: "este aluno já tem credencial; revogue antes de gerar outra",
        estado: "erro_validacao",
      }, 409);
    }
    // Tarefa 2: aluno sem meta (gerar-meta falhou) não recebe login — a
    // credencial destrava a trilha, e sem meta o aluno cairia numa trilha
    // vazia. Reprocessar (chamar gerar-meta de novo) limpa o pendente
    // (0046) e libera a geração de credencial normalmente.
    if (tipo === "aluno" && aluno.status_provisionamento === "pendente_configuracao") {
      return json({
        error: "aluno com configuração pendente (meta não gerada) — reprocesse a meta antes de gerar a credencial",
        estado: "pendente_configuracao",
      }, 409);
    }
    if (tipo === "responsavel" && !nome) {
      return json({ error: "informe o nome do responsável", estado: "erro_validacao" }, 400);
    }

    const codigo = novoCodigo();
    // Etapa 7 / BLOCO B1: senha do Auth é um segredo PRÓPRIO, independente
    // do código — não mais `normalizarCodigo(codigo)`. Quem vê o código
    // (bilhete, foto, ombro) não autentica mais sozinho: falta a senha,
    // que muda no primeiro acesso (must_change_password, B2) e nunca é
    // vista pela coordenação depois de gerada.
    const senhaTemporaria = novaSenhaTemporaria();
    const papel = tipo === "aluno" ? "aluno" : "responsavel";
    const nomeUsuario = tipo === "aluno" ? aluno.nome : String(nome);

    const { data: criado, error: errAuth } = await admin.auth.admin.createUser({
      email: emailDoCodigo(codigo),
      password: senhaTemporaria,
      email_confirm: true,
      app_metadata: { escola_id: quem.escola_id, papel },
      user_metadata: { nome: nomeUsuario, provisionado_por: quem.id },
    });
    if (errAuth) throw errAuth;
    const usuarioId = criado.user.id;

    // desfazer manual de cada passo evita conta órfã se algo falhar
    try {
      const { error: e1 } = await admin.from("usuarios").insert({
        id: usuarioId, escola_id: quem.escola_id, papel, nome: nomeUsuario,
        must_change_password: true,
      });
      if (e1) throw e1;

      if (tipo === "aluno") {
        const { error: e2 } = await admin.from("alunos")
          .update({ usuario_id: usuarioId }).eq("id", aluno_id);
        if (e2) throw e2;
      } else {
        const { error: e2 } = await admin.from("vinculos_responsaveis").insert({
          escola_id: quem.escola_id, responsavel_id: usuarioId, aluno_id,
        });
        if (e2) throw e2;
      }
    } catch (e) {
      await admin.auth.admin.deleteUser(usuarioId).catch(() => {});
      await admin.from("usuarios").delete().eq("id", usuarioId);
      throw e;
    }

    const estado = tipo === "aluno" ? "aluno_criado" : "responsavel_criado";
    await registrarLogAcesso(quem.escola_id, aluno_id, quem.id, quem.papel, `provisionou-${tipo}`);

    // EST1-C (SEC3b): grava ADITIVAMENTE o HASH do código na fundação da
    // credencial opaca (migration 0044). É best-effort: NUNCA aborta o
    // provisionamento. Continua dormente — o corte do BLOCO B (Etapa 7)
    // usa senha nativa do Auth, não este proxy de hash; a tabela fica
    // preparada para uma direção futura, sem os dois fluxos disputando
    // o mesmo login (só este INSERT best-effort acontece hoje).
    const { error: errHash } = await admin.rpc("registrar_codigo_acesso", {
      p_usuario: usuarioId, p_escola: quem.escola_id, p_codigo: codigo,
    });
    if (errHash) console.error("registrar_codigo_acesso (não-fatal):", errHash.message);

    // senhaTemporaria some daqui pra frente — não fica em log, não é
    // relida em lugar nenhum do servidor (só o hash de sessão do Auth
    // guarda o que ela virou). A tela mostra as duas UMA vez só.
    return json({ codigo, senhaTemporaria, papel, nome: nomeUsuario, estado });
  } catch (e) {
    console.error("provisionar-aluno:", e);
    return json({ error: "falha ao provisionar acesso", estado: "erro_interno" }, 500);
  }
});
