// ============================================================
// Etapa 7 / BLOCO B1-B5 — "código identifica, senha autentica"
// ------------------------------------------------------------
// Cobre o que os testes de fronteira/fonte (login-codigo-fronteira,
// est1-provisionar-hash-fonte) e os de UI (uxg1-experiencia,
// faixa-demo) não cobrem: schema/RLS reais (Postgres local), a lógica
// pura nova (senha.js), e o contrato das Edge Functions/seam que ainda
// não tinha teste nenhum.
//
// Sem runner de Deno no repo (mesma limitação de sempre): as Edge
// Functions são travadas por inspeção de fonte, padrão já estabelecido
// em est1-provisionar-hash-fonte/login-codigo-fronteira — não é
// preguiça, é a mesma técnica, mantida consistente.
// ============================================================
import { describe, it, before, after } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import pg from "pg";

const __dir = dirname(fileURLToPath(import.meta.url));
const root = resolve(__dir, "..");
const ler = (rel) => readFileSync(resolve(root, rel), "utf8");
const lerCodigo = (rel) => ler(rel)
  .replace(/\/\*[\s\S]*?\*\//g, "")
  .replace(/(^|[^:\\])\/\/.*$/gm, "$1");

const { Client } = pg;
const clientCfg = {
  host: process.env.PGHOST ?? "127.0.0.1",
  port: Number(process.env.PGPORT ?? 54322),
  user: process.env.PGUSER ?? "postgres",
  password: process.env.PGPASSWORD ?? "postgres",
  database: process.env.PGDATABASE ?? "rumo_teste",
};

describe("migration 0047 — colunas de credencial em usuarios (Postgres real)", () => {
  let db;
  before(async () => {
    db = new Client(clientCfg);
    await db.connect();
  });
  after(async () => { await db?.end(); });

  it("must_change_password: boolean, default false", async () => {
    const r = await db.query(
      `select data_type, column_default from information_schema.columns
       where table_name='usuarios' and column_name='must_change_password'`,
    );
    assert.equal(r.rowCount, 1, "coluna must_change_password não existe");
    assert.equal(r.rows[0].data_type, "boolean");
    assert.match(r.rows[0].column_default ?? "", /false/);
  });

  it("credencial_status: text, default 'ativa', check ativa/revogada", async () => {
    const r = await db.query(
      `select data_type, column_default from information_schema.columns
       where table_name='usuarios' and column_name='credencial_status'`,
    );
    assert.equal(r.rowCount, 1, "coluna credencial_status não existe");
    assert.equal(r.rows[0].data_type, "text");
    assert.match(r.rows[0].column_default ?? "", /ativa/);

    const c = await db.query(
      `select pg_get_constraintdef(oid) as def from pg_constraint
       where conrelid='usuarios'::regclass and conname='usuarios_credencial_status_check'`,
    );
    assert.equal(c.rowCount, 1, "constraint usuarios_credencial_status_check não existe");
    assert.match(c.rows[0].def, /ativa/);
    assert.match(c.rows[0].def, /revogada/);
  });

  it("credencial_status recusa valor fora de ativa/revogada", async () => {
    await assert.rejects(
      db.query(`update usuarios set credencial_status = 'banida' where false`).then(() =>
        db.query(`insert into usuarios (id, escola_id, papel, nome, credencial_status)
                   select gen_random_uuid(), id, 'aluno', 'teste 0047', 'banida' from escolas limit 1`)),
      /usuarios_credencial_status_check/,
    );
  });

  it("authenticated NÃO tem UPDATE em usuarios (nem grant, nem policy) — defesa em profundidade", async () => {
    const grant = await db.query(`select has_table_privilege('authenticated','usuarios','UPDATE') as tem`);
    assert.equal(grant.rows[0].tem, false, "grant de UPDATE em usuarios pra authenticated não deveria existir");

    const policies = await db.query(
      `select polname, polcmd from pg_policy where polrelid = 'usuarios'::regclass`,
    );
    const temUpdate = policies.rows.some((p) => p.polcmd === "w" || p.polcmd === "*");
    assert.equal(temUpdate, false, "não deveria existir policy de UPDATE (nem genérica) em usuarios");
  });

  it("migration é idempotente — reaplicar não falha", async () => {
    const sql = ler("supabase/migrations/0047_credencial_senha_temporaria.sql");
    await db.query(sql); // já rodou uma vez no reset-db.sh; rodar de novo não pode quebrar
  });
});

describe("shared/lib/senha.js — força de senha (lógica pura)", () => {
  let forcaSenha, NIVEL_MINIMO_ACEITAVEL;
  before(async () => {
    ({ forcaSenha, NIVEL_MINIMO_ACEITAVEL } = await import("../app/src/shared/lib/senha.js"));
  });

  it("curta demais (< 8) é sempre nível 0, mesmo com símbolos", () => {
    assert.equal(forcaSenha("Aa1!").nivel, 0);
  });

  it("só minúsculas, 8+ chars, é fraca (nível 1)", () => {
    assert.equal(forcaSenha("abcdefgh").nivel, 1);
  });

  it("duas classes (maiúscula+minúscula), 8+ chars, é razoável (nível 2) — libera o botão", () => {
    const f = forcaSenha("AbcdefGh");
    assert.equal(f.nivel, 2);
    assert.ok(f.nivel >= NIVEL_MINIMO_ACEITAVEL);
  });

  it("quatro classes é forte (nível 3)", () => {
    assert.equal(forcaSenha("Abc123!@").nivel, 3);
  });
});

describe("Edge Function trocar-senha — contrato (inspeção de fonte)", () => {
  let src;
  before(() => { src = ler("supabase/functions/trocar-senha/index.ts"); });

  it("existe e é auto-contida (sem import de _shared/)", () => {
    assert.ok(!src.includes('from "../_shared'), "deveria ser auto-contida, como as outras funções");
  });

  it("NÃO exige senha_atual — posse da sessão já autoriza (mesmo padrão do link de recovery)", () => {
    assert.ok(!/senha_atual/.test(src), "senha_atual apareceu — mudança de contrato não documentada aqui");
  });

  it("valida força mínima no SERVIDOR, não só confia no cliente (SEGURANCA-04)", () => {
    assert.match(src, /function senhaFraca/);
    assert.match(src, /length\s*<\s*8/);
    assert.match(src, /classes\s*<\s*2/);
  });

  it("recusa senha IGUAL ao código — sem isso o BLOCO B1 inteiro é decorativo", () => {
    assert.match(src, /function senhaEhOCodigo/);
    assert.match(src, /senha_igual_ao_codigo/);
    // compara normalizado dos dois lados, senão "ABCD-EFGH-1234" passaria
    assert.match(src, /normalizarCodigo\(senha\)\s*===\s*normalizarCodigo\(codigo\)/);
    // e a checagem tem que estar no CAMINHO da requisição, não só definida
    assert.match(src, /if \(senhaEhOCodigo\(senha_nova, codigoDoEmail\(quem\.email\)\)\)/);
  });

  it("o código vem do e-mail do PRÓPRIO chamador, nunca do payload", () => {
    assert.match(src, /function codigoDoEmail/);
    assert.match(src, /dominio === "codigo\.acesso\.local"/);
    // coordenação/super_admin (e-mail real) não tem código: devolve "" e a
    // regra acima vira no-op em vez de comparar com lixo
    assert.match(src, /if \(!codigo\) return false/);
  });

  it("chama admin.auth.updateUserById com a senha nova", () => {
    assert.match(src, /admin\.auth\.admin\.updateUserById\(quem\.id,\s*\{\s*password:\s*senha_nova\s*\}\)/);
  });

  it("zera must_change_password em usuarios, sempre (idempotente)", () => {
    assert.match(src, /update\(\{\s*must_change_password:\s*false\s*\}\)\.eq\("id", quem\.id\)/);
  });

  it("o alvo é sempre o PRÓPRIO chamador (quem.id) — nunca um id do payload", () => {
    // trava contra reintroduzir "trocar a senha de outra pessoa" aqui
    // (isso é resetar-senha em provisionar-aluno, ação da coordenação).
    // `usuario_id` aparece legitimamente como NOME DE COLUNA no insert
    // de logs_acesso — o que não pode existir é vir do corpo da requisição.
    const m = src.match(/const \{ senha_nova \} = await req\.json\(\)\.catch/);
    assert.ok(m, "payload deveria desestruturar só { senha_nova }, sem usuario_id");
  });
});

// Presença de código não prova comportamento: aqui EXTRAÍMOS as funções
// reais do .ts e as EXECUTAMOS (mesma técnica de login-codigo-fronteira —
// sem runner de Deno, é o mais perto de rodar a função de verdade).
describe("trocar-senha — a regra 'senha ≠ código' rodando de verdade", () => {
  let codigoDoEmail, senhaEhOCodigo;

  before(() => {
    const src = ler("supabase/functions/trocar-senha/index.ts");
    const pedaco = (re, nome) => {
      const m = src.match(re);
      assert.ok(m, `não encontrei ${nome} em trocar-senha/index.ts — extração desatualizada`);
      return m[0];
    };
    const fonte = [
      pedaco(/const normalizarCodigo = [\s\S]+?;\n/, "normalizarCodigo"),
      pedaco(/function codigoDoEmail\([\s\S]+?\n\}/, "codigoDoEmail"),
      pedaco(/function senhaEhOCodigo\([\s\S]+?\n\}/, "senhaEhOCodigo"),
    ].join("\n")
      // tira só as anotações de tipo — o corpo é JS puro
      .replace(/:\s*(string|boolean)\b/g, "");
    ({ codigoDoEmail, senhaEhOCodigo } = new Function(
      `${fonte}\nreturn { codigoDoEmail, senhaEhOCodigo };`,
    )());
  });

  it("extrai o código do e-mail sintético do aluno", () => {
    assert.equal(codigoDoEmail("lucasdemo2026@codigo.acesso.local"), "LUCASDEMO2026");
  });

  it("e-mail real (coordenação) não tem código", () => {
    assert.equal(codigoDoEmail("coordenacao@vitrine.demo"), "");
    assert.equal(codigoDoEmail(""), "");
  });

  it("RECUSA a senha que é o próprio código, em qualquer formatação", () => {
    const codigo = codigoDoEmail("wxyz23456789@codigo.acesso.local");
    for (const tentativa of ["WXYZ23456789", "wxyz23456789", "WXYZ-2345-6789", "wxyz 2345 6789"]) {
      assert.equal(senhaEhOCodigo(tentativa, codigo), true, `deveria recusar "${tentativa}"`);
    }
  });

  it("aceita senha de verdade, diferente do código", () => {
    const codigo = codigoDoEmail("wxyz23456789@codigo.acesso.local");
    for (const boa of ["MinhaSenha#123", "wxyz23456789a", "Outra-Coisa-9"]) {
      assert.equal(senhaEhOCodigo(boa, codigo), false, `não deveria recusar "${boa}"`);
    }
  });

  it("coordenação (sem código) nunca é barrada por esta regra", () => {
    assert.equal(senhaEhOCodigo("QualquerSenha1", ""), false);
  });

});

describe("provisionar-aluno — ciclo de vida da credencial (inspeção de fonte)", () => {
  let src, codigo;
  before(() => {
    src = ler("supabase/functions/provisionar-aluno/index.ts");
    codigo = lerCodigo("supabase/functions/provisionar-aluno/index.ts");
  });

  it("criação marca must_change_password:true", () => {
    assert.match(src, /must_change_password:\s*true/);
  });

  it("os três tipos de ação de credencial existem no dispatch", () => {
    for (const tipo of ["resetar-senha", "revogar-credencial", "reativar-credencial"]) {
      assert.ok(src.includes(`"${tipo}"`), `tipo "${tipo}" ausente do dispatch`);
    }
  });

  it("usuarioDaEscola nunca mira coordenação/super_admin — só aluno/responsavel", () => {
    assert.match(src, /in\("papel",\s*\["aluno",\s*"responsavel"\]\)/);
  });

  it("revogar-credencial bane no Auth E grava credencial_status='revogada' — os dois, nunca só um", () => {
    const m = src.match(/if \(tipo === "revogar-credencial"\) \{([\s\S]+?)\n  \}/);
    assert.ok(m, "bloco de revogar-credencial não encontrado");
    assert.match(m[1], /ban_duration:\s*BAN_LONGO/);
    assert.match(m[1], /credencial_status:\s*"revogada"/);
  });

  it("reativar-credencial remove o ban E emite senha nova E volta a exigir troca", () => {
    const m = src.match(/if \(tipo === "resetar-senha" \|\| tipo === "reativar-credencial"\) \{([\s\S]+?)\n  \}/);
    assert.ok(m, "bloco de resetar-senha/reativar-credencial não encontrado");
    assert.match(m[1], /ban_duration\s*=\s*"none"/);
    assert.match(m[1], /must_change_password:\s*true/);
  });

  it("ordem das escritas põe o lado RESTRITIVO primeiro (GoTrue e Postgres não têm transação comum)", () => {
    // Sem transação entre os dois sistemas, a ordem é a única coisa que
    // decide pra que lado o estado quebrado cai. Uniformizar as duas
    // ordens "por consistência" reabre um buraco real, então isto fica
    // travado nos dois sentidos.
    const reset = src.match(/if \(tipo === "resetar-senha" \|\| tipo === "reativar-credencial"\) \{([\s\S]+?)\n  \}/);
    assert.ok(reset, "bloco de resetar/reativar não encontrado");
    const iBancoReset = reset[1].indexOf('from("usuarios").update');
    const iAuthReset = reset[1].indexOf("auth.admin.updateUserById");
    assert.ok(iBancoReset > -1 && iAuthReset > -1, "âncoras não encontradas no bloco de reset");
    assert.ok(
      iBancoReset < iAuthReset,
      "resetar/reativar: o banco (must_change_password/ativa) tem que vir ANTES do Auth — " +
      "invertido, uma falha no banco reativa a conta SEM troca obrigatória",
    );

    const revoga = src.match(/if \(tipo === "revogar-credencial"\) \{([\s\S]+?)\n  \}/);
    assert.ok(revoga, "bloco de revogar não encontrado");
    const iAuthRevoga = revoga[1].indexOf("auth.admin.updateUserById");
    const iBancoRevoga = revoga[1].indexOf('from("usuarios").update');
    assert.ok(iAuthRevoga > -1 && iBancoRevoga > -1, "âncoras não encontradas no bloco de revogação");
    assert.ok(
      iAuthRevoga < iBancoRevoga,
      "revogar: o ban no Auth tem que vir ANTES do banco — invertido, o banco diria " +
      "'revogada' com a conta ainda entrando",
    );
  });

  it("nenhuma ação de credencial fica sem log em logs_coordenacao (rastreabilidade)", () => {
    const ocorrenciasTipo = (codigo.match(/registrarLogCoordenacao\(/g) ?? []).length;
    assert.ok(ocorrenciasTipo >= 3, `esperava pelo menos 3 chamadas a registrarLogCoordenacao (reset/revoga/reativa), achei ${ocorrenciasTipo}`);
  });
});

describe("shared/data/index.js — seam das novas ações de credencial", () => {
  let src;
  before(() => { src = ler("app/src/shared/data/index.js"); });

  it("os quatro wrappers novos existem e usam o tipo certo", () => {
    assert.match(src, /export const resetarSenhaCredencial = \(usuarioId\) =>\s*\n\s*invocar\("provisionar-aluno", \{ tipo: "resetar-senha", usuario_id: usuarioId \}\);/);
    assert.match(src, /export const revogarCredencial = \(usuarioId\) =>\s*\n\s*invocar\("provisionar-aluno", \{ tipo: "revogar-credencial", usuario_id: usuarioId \}\);/);
    assert.match(src, /export const reativarCredencial = \(usuarioId\) =>\s*\n\s*invocar\("provisionar-aluno", \{ tipo: "reativar-credencial", usuario_id: usuarioId \}\);/);
    assert.match(src, /export const trocarSenha = \(senhaNova\) => invocar\("trocar-senha", \{ senha_nova: senhaNova \}\);/);
  });

  it("meuPerfil seleciona must_change_password (é o que App.jsx lê pro gate B2)", () => {
    const m = src.match(/from\("usuarios"\)\.select\("([^"]+)"\)\.eq\("id", uid\)/);
    assert.ok(m, "SELECT de usuarios em meuPerfil não encontrado");
    assert.ok(m[1].split(",").map((c) => c.trim()).includes("must_change_password"), `must_change_password ausente do SELECT: ${m[1]}`);
  });

  it("listarAlunos e listarVinculos trazem credencial_status/must_change_password embutidos", () => {
    assert.match(src, /alunos_turmas\(turma_id, turmas\(nome\)\), usuarios\(credencial_status, must_change_password\)/);
    assert.match(src, /usuarios\(nome, papel, credencial_status, must_change_password\)/);
  });
});

describe("App.jsx — gate de troca obrigatória (B2)", () => {
  let codigo;
  before(() => { codigo = lerCodigo("app/src/App.jsx"); });

  it("bloqueia com must_change_password ANTES do gate de escola suspensa", () => {
    const iTroca = codigo.indexOf("perfil.usuario.must_change_password");
    const iSuspenso = codigo.indexOf("escolaOperacional(perfil.escola)");
    assert.ok(iTroca > -1 && iSuspenso > -1, "âncoras não encontradas");
    assert.ok(iTroca < iSuspenso, "gate de troca obrigatória deveria vir ANTES do de escola suspensa");
  });

  it("bloqueia ANTES de resolver a Área (aluno/responsável/coordenação)", () => {
    const iTroca = codigo.indexOf("perfil.usuario.must_change_password");
    const iArea = codigo.indexOf("AREAS[perfil.usuario.papel]");
    assert.ok(iTroca > -1 && iArea > -1 && iTroca < iArea);
  });

  it("passa recarregarPerfil pra tela — sem isso o gate nunca saberia que a troca terminou", () => {
    assert.match(codigo, /aoConcluir=\{recarregarPerfil\}/);
  });
});

describe("useSessao.js — recarregarPerfil não abre um segundo listener de auth", () => {
  let codigo;
  before(() => { codigo = lerCodigo("app/src/shared/hooks/useSessao.js"); });

  it("aoMudarSessao (onAuthStateChange) continua chamado uma única vez", () => {
    const ocorrencias = (codigo.match(/db\.aoMudarSessao\(/g) ?? []).length;
    assert.equal(ocorrencias, 1, `aoMudarSessao chamado ${ocorrencias}x — deveria ser 1`);
  });

  it("recarregarPerfil relê a sessão e reusa carregarPerfil (mesmo caminho, sem duplicar lógica)", () => {
    assert.match(codigo, /const recarregarPerfil = useCallback\(\(\) => \{/);
    assert.match(codigo, /return db\.sessaoAtual\(\)\.then\(carregarPerfil\)/);
  });

  it("o hook devolve recarregarPerfil junto do resto do estado", () => {
    assert.match(codigo, /return \{ \.\.\.estado, recarregarPerfil \};/);
  });
});

describe("Login.jsx — código no dispositivo (B4)", () => {
  let codigo;
  before(() => { codigo = lerCodigo("app/src/routes/publico/Login.jsx"); });

  it("só salva o código DEPOIS do login confirmado — nunca um código que falhou", () => {
    const iEntrar = codigo.indexOf("await db.entrarComCodigo(codigo, senha);");
    const iSalvar = codigo.indexOf("localStorage.setItem(CHAVE_CODIGO_DISPOSITIVO");
    assert.ok(iEntrar > -1 && iSalvar > -1 && iEntrar < iSalvar, "salvar precisa vir DEPOIS do await de login");
  });

  it("nunca salva a senha no localStorage", () => {
    assert.ok(!/localStorage\.setItem\([^)]*senha/i.test(codigo), "senha não pode ir pro localStorage");
  });

  it("pré-preenche o código a partir do localStorage na montagem", () => {
    assert.match(codigo, /localStorage\.getItem\(CHAVE_CODIGO_DISPOSITIVO\)/);
  });

  it("gate 'pronto' do modo código agora exige senha também", () => {
    assert.match(codigo, /codigoLimpo\.length >= CODIGO_MIN && senha/);
  });

  it("dispositivo compartilhado tem saída: 'Não é meu código' limpa o guardado", () => {
    // laboratório de escola é o ambiente real deste produto — sem isso o
    // próximo aluno herda o código do anterior e tem que adivinhar que
    // dá pra apagar
    assert.match(codigo, /function trocarDeCodigo\(\)/);
    assert.match(codigo, /esquecerCodigoDoDispositivo\(\)/);
    assert.match(codigo, /localStorage\.removeItem\(CHAVE_CODIGO_DISPOSITIVO\)/);
    assert.match(codigo, /Não é meu código/);
    // limpa os DOIS campos: deixar a senha do anterior pendurada seria pior
    const m = codigo.match(/function trocarDeCodigo\(\) \{([\s\S]+?)\n  \}/);
    assert.ok(m, "corpo de trocarDeCodigo não encontrado");
    assert.match(m[1], /setCodigo\(""\)/);
    assert.match(m[1], /setSenha\(""\)/);
  });

  it("a saída só aparece quando o código veio do dispositivo, não quando foi digitado", () => {
    assert.match(codigo, /\{codigoDoDispositivo && \(/);
    // digitar por cima desliga a oferta (o código passou a ser do usuário)
    assert.match(codigo, /onChange=\{\(e\) => \{ setCodigo\(e\.target\.value\.toUpperCase\(\)\); setCodigoDoDispositivo\(false\);/);
  });
});

describe("suíte E2E — acompanhou o login de dois campos", () => {
  // Esta fronteira quebrou de verdade ao virar o modelo: `_apoio.js`
  // preenchia SÓ o código e clicava Entrar, com o botão já desabilitado
  // pelo gate novo — 4 specs travariam no CI (aluno, auth, mobile,
  // motor-progresso) sem nada na suíte local acusar. `node --test` não
  // roda Playwright, então a trava tem que ser por fonte mesmo.
  let apoio;
  before(() => { apoio = ler("app/e2e/_apoio.js"); });

  it("loginPorCodigo preenche senha, não só o código", () => {
    const m = apoio.match(/async function loginPorCodigo\(page, conta\) \{([\s\S]+?)\n\}/);
    assert.ok(m, "loginPorCodigo(page, conta) não encontrada — assinatura mudou?");
    assert.match(m[1], /campo\(page, "Código de acesso"\)\.fill\(conta\.codigo\)/);
    assert.match(m[1], /input\[type="password"\][\s\S]{0,40}?\.fill\(conta\.senha\)/, "sem preencher a senha o botão fica desabilitado e o teste trava");
  });

  it("toda conta por código em CONTAS tem senha", () => {
    const bloco = apoio.match(/export const CONTAS = \{([\s\S]+?)\n\};/);
    assert.ok(bloco, "bloco CONTAS não encontrado");
    for (const linha of bloco[1].split("\n")) {
      if (!linha.includes("codigo:")) continue;
      assert.match(linha, /senha:/, `conta por código sem senha: ${linha.trim()}`);
    }
  });
});

describe("TrocarSenhaObrigatoria.jsx — tela do primeiro acesso", () => {
  let codigo;
  before(() => { codigo = lerCodigo("app/src/routes/publico/TrocarSenhaObrigatoria.jsx"); });

  it("usa a mesma força de senha compartilhada (não duplica a lógica)", () => {
    assert.match(codigo, /from ["']\.\.\/\.\.\/shared\/lib\/senha\.js["']/);
  });

  it("chama db.trocarSenha e avisa o pai via aoConcluir — não mexe na sessão sozinha", () => {
    assert.match(codigo, /await db\.trocarSenha\(senha\)/);
    assert.match(codigo, /aoConcluir\?\.\(\)/);
    assert.ok(!codigo.includes("setSession") && !codigo.includes("signIn"), "não deveria tocar sessão/login diretamente");
  });

  it("oferece Sair pra quem não reconhece a tela (não é uma armadilha sem saída)", () => {
    assert.match(codigo, /db\.sair\(\)/);
  });
});

describe("ListaAlunos.jsx / VinculosResponsavel.jsx — ações de credencial na UI", () => {
  it("resetar/revogar/reativar só aparecem quando fazem sentido pro estado atual", () => {
    const src = lerCodigo("app/src/modules/pessoas/ListaAlunos.jsx");
    assert.match(src, /temCred && !credRevogada.*resetarSenha/);
    assert.match(src, /temCred && !credRevogada.*revogarCredencial/);
    assert.match(src, /credRevogada.*reativarCredencial/);
  });

  it("revogar credencial pede confirmação (ação sensível e destrutiva pro acesso)", () => {
    const src = lerCodigo("app/src/modules/pessoas/ListaAlunos.jsx");
    const m = src.match(/const revogarCredencial = async \(a\) => \{([\s\S]+?)\n  \};/);
    assert.ok(m, "função revogarCredencial não encontrada");
    assert.match(m[1], /dialogo\.confirmar\(/);
    assert.match(m[1], /perigo:\s*true/);
    assert.match(m[1], /if \(!ok\) return;/, "sem checar a resposta do confirm, a ação rodaria sem esperar confirmação");
  });

  it("VinculosResponsavel recebeu aoGerarCredencial (senão resetar/reativar não têm como mostrar a senha)", () => {
    const src = ler("app/src/modules/pessoas/VinculosResponsavel.jsx");
    assert.match(src, /export function VinculosResponsavel\(\{[^}]*aoGerarCredencial/);
  });

  it("confirmação de revogar VÍNCULO e revogar CREDENCIAL não compartilham estado (não some uma pela outra)", () => {
    const src = lerCodigo("app/src/modules/pessoas/VinculosResponsavel.jsx");
    assert.match(src, /confirmando\?\.\s*id === v\.id && confirmando\?\.\s*tipo === "vinculo"/);
    assert.match(src, /confirmando\?\.\s*id === v\.id && confirmando\?\.\s*tipo === "credencial"/);
  });
});

describe("CredencialGerada — mostra código+senha na criação, só senha no reset/reativação", () => {
  let src;
  before(() => { src = ler("app/src/modules/pessoas/CadastroAlunos.jsx"); });

  it("nunca deixa a senha temporária sumir se ela existir na resposta", () => {
    assert.match(src, /temSenha = !!credencial\.senhaTemporaria/);
    assert.match(src, /\{temSenha && \(/);
  });

  it("o código só aparece quando a resposta tem código (criação) — reset não reexibe o código", () => {
    assert.match(src, /temCodigo = !!credencial\.codigo/);
    assert.match(src, /\{temCodigo && \(/);
  });
});
