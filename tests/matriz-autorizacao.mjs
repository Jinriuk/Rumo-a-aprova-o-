// ============================================================
// ETAPA 2, FATIA 2 — MATRIZ DE AUTORIZAÇÃO (camada banco)
// ------------------------------------------------------------
// Fixture, casos e executor. Quem usa:
//   • tests/e2-matriz-autorizacao-db.test.mjs (roda no CI);
//   • `node tests/matriz-autorizacao.mjs --gerar` (grava a evidência
//     em docs/evidencias/e2-matriz-autorizacao.json).
//
// COMO PROVA
//   Tudo acontece numa transação só, REPEATABLE READ, que termina SEMPRE
//   em rollback: a fixture nunca é gravada. Para cada caso:
//     1. savepoint;
//     2. hash (md5 de todas as linhas) das tabelas envolvidas, como
//        postgres (sem RLS);
//     3. assume a persona: papel `authenticated` ou `anon` + claims no
//        request.jwt.claims, exatamente o que o PostgREST entrega;
//     4. executa a operação;
//     5. volta para postgres e recalcula o hash;
//     6. rollback ao savepoint.
//   Negação só conta com o hash igual antes e depois. Zero linhas ou
//   erro sem conferir a integridade não é prova.
//
// FIDELIDADE AO HOSPEDADO
//   Nos projetos hospedados, `anon` e `authenticated` têm SELECT,
//   INSERT, UPDATE e DELETE de TABELA em quase todo `public` (medido em
//   24/09, 48 de 50 objetos para `anon`); o que segura é só a RLS. O
//   Postgres vanilla do CI não dá esses grants, então negaria por falta
//   de privilégio, que é outra barreira. A fixture reproduz os grants do
//   hospedado dentro da transação: a matriz prova a MESMA barreira que
//   protege produção.
//
// TRAVA DE DESTINO
//   Recusa rodar fora de 127.0.0.1/localhost e fora de um banco cujo
//   nome comece por `rumo_teste`. A fixture cria escolas, usuários e
//   dados fictícios; jamais pode apontar para demo ou produção.
// ============================================================
import { fileURLToPath } from "node:url";
import { resolve, dirname } from "node:path";
import { writeFileSync, mkdirSync, readFileSync, existsSync } from "node:fs";
import { execFileSync } from "node:child_process";
import pg from "pg";

// ── identificadores da fixture (prefixo e2… para reconhecer) ──
const uuid = (grupo, n) => `e2${grupo}00000-0000-4000-8000-${String(n).padStart(12, "0")}`;

export const ESC = {
  A: uuid("0", 10), // ativa, trilha T1 (compartilhada com B)
  B: uuid("0", 11), // ativa, trilha T1
  C: uuid("0", 12), // ativa, trilha T2
  S: uuid("0", 13), // suspensa
  X: uuid("0", 14), // cancelada
  FANTASMA: uuid("0", 15), // não existe em `escolas`
};

export const TRILHA = { T1: uuid("3", 1), T2: uuid("3", 2) };
const NICHO_T1 = "e2-matriz-t1";
const NICHO_T2 = "e2-matriz-t2";

// usuarios.id = sub do JWT
export const U = {
  coordA: uuid("1", 1), coordB: uuid("1", 2), coordC: uuid("1", 3), coordS: uuid("1", 4), coordX: uuid("1", 5),
  coordFantasma: uuid("1", 6), coordRebaixada: uuid("1", 7),
  alunoA1: uuid("1", 11), alunoA2: uuid("1", 12), alunoB1: uuid("1", 13), alunoB2: uuid("1", 16), alunoC1: uuid("1", 14), alunoS1: uuid("1", 15), alunoX1: uuid("1", 17),
  respA1: uuid("1", 21), respSemVinculo: uuid("1", 22), respRevogado: uuid("1", 23), respB1: uuid("1", 24),
  superAdmin: uuid("1", 31), superAdminFalso: uuid("1", 32), superAdminInativo: uuid("1", 33),
};

// alunos.id
export const AL = {
  A1: uuid("2", 11), A2: uuid("2", 12), B1: uuid("2", 13), B2: uuid("2", 16), C1: uuid("2", 14), S1: uuid("2", 15), X1: uuid("2", 17),
};

// linhas de dado por escola (ids fixos para mirar)
export const R = {
  turmaA: uuid("4", 1), turmaB: uuid("4", 2), turmaS: uuid("4", 3),
  vincA1: uuid("5", 1), vincB1: uuid("5", 2),
  metaA1: uuid("6", 1), metaA2: uuid("6", 2), metaB1: uuid("6", 3), metaS1: uuid("6", 4),
  maA1: uuid("7", 1), maA2: uuid("7", 2), maB1: uuid("7", 3),
  regA1: uuid("8", 1), regA2: uuid("8", 2), regB1: uuid("8", 3), regS1: uuid("8", 4),
  simA1: uuid("9", 1), simA2: uuid("9", 2), simB1: uuid("9", 3),
  consA1: uuid("a", 1), consB1: uuid("a", 2),
  cfgA: uuid("b", 1), cfgB: uuid("b", 2),
  meA: uuid("c", 1), meB: uuid("c", 2),
  xpA1: uuid("d", 1), xpB1: uuid("d", 2),
  conqA1: uuid("e", 1), conqB1: uuid("e", 2),
  amA1: uuid("f", 1), amB1: uuid("f", 2),
  nivA1: uuid("0", 91), nivB1: uuid("0", 92),
  evA1: uuid("0", 93), evB1: uuid("0", 94),
  ativT1a: uuid("3", 11), ativT1b: uuid("3", 12), ativT2a: uuid("3", 21),
  semT1a: uuid("3", 31), semT1b: uuid("3", 32), semT2a: uuid("3", 41),
  discT1: uuid("3", 51), discT2: uuid("3", 52),
};

// ── personas (claims como o Auth emite: app_metadata.escola_id/papel) ──
export const PERSONAS = {
  anon: null,
  coordA: { sub: U.coordA, escola_id: ESC.A, papel: "coordenacao" },
  coordB: { sub: U.coordB, escola_id: ESC.B, papel: "coordenacao" },
  coordS: { sub: U.coordS, escola_id: ESC.S, papel: "coordenacao" },
  coordX: { sub: U.coordX, escola_id: ESC.X, papel: "coordenacao" },
  coordFantasma: { sub: U.coordFantasma, escola_id: ESC.FANTASMA, papel: "coordenacao" },
  coordSemEscola: { sub: U.coordA, escola_id: null, papel: "coordenacao" },
  coordRebaixada: { sub: U.coordRebaixada, escola_id: ESC.A, papel: "coordenacao" },
  alunoA1: { sub: U.alunoA1, escola_id: ESC.A, papel: "aluno" },
  alunoA2: { sub: U.alunoA2, escola_id: ESC.A, papel: "aluno" },
  alunoB1: { sub: U.alunoB1, escola_id: ESC.B, papel: "aluno" },
  alunoS1: { sub: U.alunoS1, escola_id: ESC.S, papel: "aluno" },
  alunoX1: { sub: U.alunoX1, escola_id: ESC.X, papel: "aluno" },
  respA1: { sub: U.respA1, escola_id: ESC.A, papel: "responsavel" },
  respSemVinculo: { sub: U.respSemVinculo, escola_id: ESC.A, papel: "responsavel" },
  respRevogado: { sub: U.respRevogado, escola_id: ESC.A, papel: "responsavel" },
  superAdmin: { sub: U.superAdmin, escola_id: null, papel: "super_admin" },
  superAdminFalso: { sub: U.superAdminFalso, escola_id: null, papel: "super_admin" },
  superAdminInativo: { sub: U.superAdminInativo, escola_id: null, papel: "super_admin" },
};

export const DESCRICAO_PERSONAS = {
  anon: "sem login (papel anon)",
  coordA: "coordenação da escola A",
  coordB: "coordenação da escola B",
  coordS: "coordenação da escola SUSPENSA, com sessão aberta",
  coordX: "coordenação da escola CANCELADA, com sessão aberta",
  coordFantasma: "coordenação com escola_id que não existe em escolas",
  coordSemEscola: "coordenação sem escola_id no token",
  coordRebaixada: "ex-coordenação: usuarios.papel já é 'aluno', claims antigas ainda dizem coordenacao",
  alunoA1: "aluno A1 (escola A)",
  alunoA2: "aluno A2 (escola A, colega do A1)",
  alunoB1: "aluno B1 (escola B)",
  alunoS1: "aluno da escola suspensa",
  alunoX1: "aluno da escola cancelada",
  respA1: "responsável vinculado ao A1",
  respSemVinculo: "responsável da escola A sem vínculo nenhum",
  respRevogado: "responsável da escola A cujo vínculo com o A1 foi apagado (revogar-responsavel)",
  superAdmin: "super admin com linha ativa em internal_admins",
  superAdminFalso: "conta que se apresenta como super admin sem linha em internal_admins",
  superAdminInativo: "super admin com internal_admins.ativo = false",
};

// ── trava de destino ──────────────────────────────────────────
export function conferirAlvoLocal({ host, database }) {
  const hostOk = ["127.0.0.1", "localhost", "::1"].includes(String(host));
  const dbOk = /^rumo_teste/.test(String(database));
  if (!hostOk || !dbOk) {
    throw new Error(`matriz recusada: só roda em Postgres local descartável (host ${host}, banco ${database}). Nunca contra demo ou produção.`);
  }
}

// ── fixture ───────────────────────────────────────────────────
// Datas da trilha no passado (jan/2026): o ciclo está 'encerrado' para
// qualquer dia de execução, sem relógio congelado.
const FIXTURE_SQL = `
-- grants do hospedado (medido em 24/09): só a RLS segura
grant select, insert, update, delete on all tables in schema public to anon, authenticated;

insert into escolas (id, nome, slug, status) values
  ('${ESC.A}', 'E2 Escola A', 'e2-escola-a', 'ativa'),
  ('${ESC.B}', 'E2 Escola B', 'e2-escola-b', 'ativa'),
  ('${ESC.C}', 'E2 Escola C', 'e2-escola-c', 'ativa'),
  ('${ESC.S}', 'E2 Escola Suspensa', 'e2-escola-s', 'suspensa'),
  ('${ESC.X}', 'E2 Escola Cancelada', 'e2-escola-x', 'cancelada');
-- colunas do backoffice preenchidas na A: sem valor, a leitura delas não provaria nada
update escolas set observacao = 'E2 nota interna do operador', contato_nome = 'E2 Contato' where id = '${ESC.A}';

insert into trilhas (id, nicho, nome, versao, publicada) values
  ('${TRILHA.T1}', '${NICHO_T1}', 'E2 Trilha compartilhada (A e B)', 1, true),
  ('${TRILHA.T2}', '${NICHO_T2}', 'E2 Trilha da escola C', 1, true);
insert into disciplinas (id, trilha_id, codigo, nome, abrev, cor, ordem) values
  ('${R.discT1}', '${TRILHA.T1}', 'mat', 'Matemática', 'MAT', '#123456', 1),
  ('${R.discT2}', '${TRILHA.T2}', 'mat', 'Matemática', 'MAT', '#123456', 1);
insert into trilha_semanas (id, trilha_id, numero, inicio, fim, foco) values
  ('${R.semT1a}', '${TRILHA.T1}', 1, '2026-01-05', '2026-01-11', 'foco 1'),
  ('${R.semT1b}', '${TRILHA.T1}', 2, '2026-01-12', '2026-01-18', 'foco 2'),
  ('${R.semT2a}', '${TRILHA.T2}', 1, '2026-01-05', '2026-01-11', 'foco 1');
insert into atividades_modelo (id, trilha_id, semana_numero, disciplina_codigo, prioridade, texto, ordem) values
  ('${R.ativT1a}', '${TRILHA.T1}', 1, 'mat', 'F', 'atividade 1', 1),
  ('${R.ativT1b}', '${TRILHA.T1}', 2, 'mat', 'P', 'atividade 2', 1),
  ('${R.ativT2a}', '${TRILHA.T2}', 1, 'mat', 'F', 'atividade C', 1);

insert into concursos (codigo, nome, organizacao, nivel, mes_prova, dia_prova) values
  ('e2cat', 'E2 concurso', 'e2', 'e2', 1, 1), ('e2cat2', 'E2 concurso 2', 'e2', 'e2', 1, 1);
insert into materias (codigo, nome, abrev) values ('e2mat', 'E2 matéria', 'E2M'), ('e2mat2', 'E2 matéria 2', 'E2N');
insert into provas (exam_tag, nome) values ('e2cat', 'E2 prova');
insert into prova_materias (exam_tag, materia_codigo) values ('e2cat', 'e2mat');
insert into assuntos (exam_tag, materia_codigo, nome) values ('e2cat', 'e2mat', 'E2 assunto');

insert into usuarios (id, escola_id, papel, nome) values
  ('${U.coordA}', '${ESC.A}', 'coordenacao', 'E2 Coord A'),
  ('${U.coordB}', '${ESC.B}', 'coordenacao', 'E2 Coord B'),
  ('${U.alunoX1}', '${ESC.X}', 'aluno', 'E2 Aluno X1'),
  ('${U.coordC}', '${ESC.C}', 'coordenacao', 'E2 Coord C'),
  ('${U.coordS}', '${ESC.S}', 'coordenacao', 'E2 Coord S'),
  ('${U.coordX}', '${ESC.X}', 'coordenacao', 'E2 Coord X'),
  ('${U.coordRebaixada}', '${ESC.A}', 'aluno', 'E2 ex-coordenação A'),
  ('${U.alunoA1}', '${ESC.A}', 'aluno', 'E2 Aluno A1'),
  ('${U.alunoA2}', '${ESC.A}', 'aluno', 'E2 Aluno A2'),
  ('${U.alunoB1}', '${ESC.B}', 'aluno', 'E2 Aluno B1'),
  ('${U.alunoB2}', '${ESC.B}', 'aluno', 'E2 Aluno B2'),
  ('${U.alunoC1}', '${ESC.C}', 'aluno', 'E2 Aluno C1'),
  ('${U.alunoS1}', '${ESC.S}', 'aluno', 'E2 Aluno S1'),
  ('${U.respA1}', '${ESC.A}', 'responsavel', 'E2 Resp A1'),
  ('${U.respSemVinculo}', '${ESC.A}', 'responsavel', 'E2 Resp sem vínculo'),
  ('${U.respRevogado}', '${ESC.A}', 'responsavel', 'E2 Resp revogado'),
  ('${U.respB1}', '${ESC.B}', 'responsavel', 'E2 Resp B1');
update usuarios set credencial_status = 'revogada' where id = '${U.respRevogado}';

insert into alunos (id, escola_id, nome, usuario_id, trilha_id) values
  ('${AL.A1}', '${ESC.A}', 'E2 Aluno A1', '${U.alunoA1}', '${TRILHA.T1}'),
  ('${AL.A2}', '${ESC.A}', 'E2 Aluno A2', '${U.alunoA2}', '${TRILHA.T1}'),
  ('${AL.B1}', '${ESC.B}', 'E2 Aluno B1', '${U.alunoB1}', '${TRILHA.T1}'),
  ('${AL.B2}', '${ESC.B}', 'E2 Aluno B2', '${U.alunoB2}', '${TRILHA.T1}'),
  ('${AL.C1}', '${ESC.C}', 'E2 Aluno C1', '${U.alunoC1}', '${TRILHA.T2}'),
  ('${AL.S1}', '${ESC.S}', 'E2 Aluno S1', '${U.alunoS1}', '${TRILHA.T1}'),
  ('${AL.X1}', '${ESC.X}', 'E2 Aluno X1', '${U.alunoX1}', '${TRILHA.T1}');
update usuarios set email = 'e2-coord-b@teste.local' where id = '${U.coordB}';

insert into turmas (id, escola_id, nome) values
  ('${R.turmaA}', '${ESC.A}', 'E2 Turma A'), ('${R.turmaB}', '${ESC.B}', 'E2 Turma B'), ('${R.turmaS}', '${ESC.S}', 'E2 Turma S');
insert into alunos_turmas (escola_id, aluno_id, turma_id) values
  ('${ESC.A}', '${AL.A1}', '${R.turmaA}'), ('${ESC.B}', '${AL.B1}', '${R.turmaB}');

-- o vínculo do respRevogado com o A1 existiu e foi apagado, como faz o revogar-responsavel
insert into vinculos_responsaveis (id, escola_id, responsavel_id, aluno_id) values
  ('${R.vincA1}', '${ESC.A}', '${U.respA1}', '${AL.A1}'),
  ('${R.vincB1}', '${ESC.B}', '${U.respB1}', '${AL.B1}');

insert into metas (id, escola_id, aluno_id, trilha_id, semana_numero, inicio, fim, status) values
  ('${R.metaA1}', '${ESC.A}', '${AL.A1}', '${TRILHA.T1}', 1, '2026-01-05', '2026-01-11', 'ativa'),
  ('${R.metaA2}', '${ESC.A}', '${AL.A2}', '${TRILHA.T1}', 1, '2026-01-05', '2026-01-11', 'ativa'),
  ('${R.metaB1}', '${ESC.B}', '${AL.B1}', '${TRILHA.T1}', 1, '2026-01-05', '2026-01-11', 'ativa'),
  ('${R.metaS1}', '${ESC.S}', '${AL.S1}', '${TRILHA.T1}', 1, '2026-01-05', '2026-01-11', 'ativa');
insert into meta_atividades (id, escola_id, meta_id, atividade_modelo_id, estado) values
  ('${R.maA1}', '${ESC.A}', '${R.metaA1}', '${R.ativT1b}', 'pendente'),
  ('${R.maA2}', '${ESC.A}', '${R.metaA2}', '${R.ativT1a}', 'pendente'),
  ('${R.maB1}', '${ESC.B}', '${R.metaB1}', '${R.ativT1a}', 'pendente');

insert into registros_estudo (id, escola_id, aluno_id, data, disciplina_codigo, questoes, acertos, minutos) values
  ('${R.regA1}', '${ESC.A}', '${AL.A1}', '2026-01-06', 'mat', 10, 7, 30),
  ('${R.regA2}', '${ESC.A}', '${AL.A2}', '2026-01-06', 'mat', 10, 5, 30),
  ('${R.regB1}', '${ESC.B}', '${AL.B1}', '2026-01-06', 'mat', 10, 9, 30),
  ('${R.regS1}', '${ESC.S}', '${AL.S1}', '2026-01-06', 'mat', 10, 6, 30);
insert into simulados (id, escola_id, aluno_id, nome, data) values
  ('${R.simA1}', '${ESC.A}', '${AL.A1}', 'E2 simulado A1', '2026-01-10'),
  ('${R.simA2}', '${ESC.A}', '${AL.A2}', 'E2 simulado A2', '2026-01-10'),
  ('${R.simB1}', '${ESC.B}', '${AL.B1}', 'E2 simulado B1', '2026-01-10');

insert into consentimentos (id, escola_id, aluno_id, responsavel_nome, registrado_por) values
  ('${R.consA1}', '${ESC.A}', '${AL.A1}', 'Resp A1', '${U.coordA}'),
  ('${R.consB1}', '${ESC.B}', '${AL.B1}', 'Resp B1', '${U.coordB}');
insert into logs_acesso (escola_id, aluno_id, usuario_id, papel, acao) values
  ('${ESC.A}', '${AL.A1}', '${U.coordA}', 'coordenacao', 'e2-ver'),
  ('${ESC.B}', '${AL.B1}', '${U.coordB}', 'coordenacao', 'e2-ver');
insert into logs_coordenacao (escola_id, usuario_id, papel, acao) values
  ('${ESC.A}', '${U.coordA}', 'coordenacao', 'e2-acao'),
  ('${ESC.B}', '${U.coordB}', 'coordenacao', 'e2-acao');
insert into config_escola (id, escola_id, exam_tag, chave, valor) values
  ('${R.cfgA}', '${ESC.A}', 'cn', 'e2-chave', '{"v":1}'),
  ('${R.cfgB}', '${ESC.B}', 'cn', 'e2-chave', '{"v":1}');
insert into missoes_escola (id, escola_id, missao_id, ativa) values
  ('${R.meA}', '${ESC.A}', (select id from missoes where exam_tag = 'cn' order by id limit 1), true),
  ('${R.meB}', '${ESC.B}', (select id from missoes where exam_tag = 'cn' order by id offset 1 limit 1), true);
insert into aluno_xp_eventos (id, escola_id, aluno_id, exam_tag, origem, pontos) values
  ('${R.xpA1}', '${ESC.A}', '${AL.A1}', 'cn', 'ajuste_manual', 10),
  ('${R.xpB1}', '${ESC.B}', '${AL.B1}', 'cn', 'ajuste_manual', 10);
insert into aluno_conquistas (id, escola_id, aluno_id, conquista_id, exam_tag) values
  ('${R.conqA1}', '${ESC.A}', '${AL.A1}', (select id from conquistas order by id limit 1), 'cn'),
  ('${R.conqB1}', '${ESC.B}', '${AL.B1}', (select id from conquistas order by id limit 1), 'cn');
insert into aluno_missoes (id, escola_id, aluno_id, missao_id, exam_tag, estado) values
  ('${R.amA1}', '${ESC.A}', '${AL.A1}', (select id from missoes where exam_tag = 'cn' order by id limit 1), 'cn', 'em_andamento'),
  ('${R.amB1}', '${ESC.B}', '${AL.B1}', (select id from missoes where exam_tag = 'cn' order by id limit 1), 'cn', 'em_andamento');
insert into aluno_niveis (id, escola_id, aluno_id, escopo, nivel, origem) values
  ('${R.nivA1}', '${ESC.A}', '${AL.A1}', 'geral', 'base', 'manual'),
  ('${R.nivB1}', '${ESC.B}', '${AL.B1}', 'geral', 'base', 'manual');
insert into aluno_onboarding (aluno_id, escola_id, objetivo) values
  ('${AL.A2}', '${ESC.A}', 'e2 objetivo A2'), ('${AL.B2}', '${ESC.B}', 'e2 objetivo B2');
insert into aluno_eventos_progresso (id, escola_id, aluno_id, exam_tag, tipo_evento, origem, xp_delta, idempotency_key) values
  ('${R.evA1}', '${ESC.A}', '${AL.A1}', 'cn', 'ajuste_coordenacao', 'e2', 5, 'e2-ev-a1'),
  ('${R.evB1}', '${ESC.B}', '${AL.B1}', 'cn', 'ajuste_coordenacao', 'e2', 5, 'e2-ev-b1');

insert into internal_admins (auth_user_id, email, nome, ativo) values
  ('${U.superAdmin}', 'e2-sa@teste.local', 'E2 SA', true),
  ('${U.superAdminInativo}', 'e2-sa-inativo@teste.local', 'E2 SA inativo', false);
insert into admin_logs (super_admin_id, acao, escola_id) values ('${U.superAdmin}', 'e2-acao', '${ESC.B}');
insert into virada_execucoes (escola_id, data_referencia) values ('${ESC.B}', '2026-01-12');
`;

// Migrations que tiram privilégio POR CIMA do grant padrão do Supabase.
// O grant em bloco da fixture reproduz o padrão dos hospedados; estas,
// quando estão no repo, valem lá também depois de aplicadas, então são
// reaplicadas aqui por cima (são idempotentes).
const RESTRICOES_POS_GRANT = ["0058_escolas_colunas_por_papel"];
const RAIZ = resolve(dirname(fileURLToPath(import.meta.url)), "..");

export async function montarFixture(c) {
  await c.query(FIXTURE_SQL);
  for (const m of RESTRICOES_POS_GRANT) {
    const arq = resolve(RAIZ, "supabase/migrations", `${m}.sql`);
    if (existsSync(arq)) await c.query(readFileSync(arq, "utf8"));
  }
}

// ── hash das tabelas (como postgres, sem RLS) ─────────────────
async function hashTabelas(c, tabelas) {
  const out = {};
  for (const t of tabelas) {
    const r = await c.query(`select md5(coalesce(string_agg(x::text, '|' order by x::text), '')) as h, count(*)::int as n from ${t} x`);
    out[t] = `${r.rows[0].h}:${r.rows[0].n}`;
  }
  return out;
}
const mesmoHash = (a, b) => Object.keys(a).every((k) => a[k] === b[k]);

// ── casos ─────────────────────────────────────────────────────
// Cada caso: { id, superficie, alvo, persona, operacao, esperado,
//   sql, params?, tabelas, tipo: 'leitura' | 'escrita' | 'rpc',
//   efeito?: sql que devolve { ok: boolean } — prova adicional de efeito
//   medida depois da operação, como postgres }
// Para leitura: `sql` devolve as linhas-alvo que a persona conseguiu ver.
// Cenário (tipo 'cenario'): `passos` em sequência, cada um com persona
// ou 'servidor' (postgres, como a Edge Function com service_role), e
// `dano` — consulta como postgres que devolve { ok } = o dano aconteceu.
export function montarCasos() {
  const casos = [];
  const add = (c) => casos.push({ tipo: "escrita", ...c });
  const ler = (c) => casos.push({ tipo: "leitura", ...c });
  const rpc = (c) => casos.push({ tipo: "rpc", ...c });
  const cenario = (c) => casos.push({ tipo: "cenario", ...c });
  // FK cruzada: depois da 0055 quem barra é a FK composta (vale para
  // qualquer escritor), então "sem RLS" também falha — não é caso vazio.
  const FK_NOTA = "depois da 0055 quem barra é a FK composta (aluno/turma/conta da mesma escola), para qualquer escritor";

  // ═══ 1. TABELAS COM TENANT: A contra B ═══════════════════════
  // leitura: coordenação A (a persona que mais lê) tenta ver a linha de B
  const LEITURAS_B = [
    ["escolas", "id", ESC.B], ["usuarios", "id", U.coordB], ["turmas", "id", R.turmaB], ["alunos", "id", AL.B1],
    ["alunos_turmas", "aluno_id", AL.B1], ["vinculos_responsaveis", "id", R.vincB1], ["metas", "id", R.metaB1],
    ["meta_atividades", "id", R.maB1], ["registros_estudo", "id", R.regB1], ["simulados", "id", R.simB1],
    ["consentimentos", "id", R.consB1], ["logs_acesso", "escola_id", ESC.B], ["logs_coordenacao", "escola_id", ESC.B],
    ["config_escola", "id", R.cfgB], ["missoes_escola", "id", R.meB], ["aluno_xp_eventos", "id", R.xpB1],
    ["aluno_conquistas", "id", R.conqB1], ["aluno_missoes", "id", R.amB1], ["aluno_niveis", "id", R.nivB1],
    ["aluno_onboarding", "aluno_id", AL.B2], ["aluno_eventos_progresso", "id", R.evB1],
    ["aluno_nivel_historico", "escola_id", ESC.B], ["vw_aluno_xp_total", "escola_id", ESC.B],
  ];
  for (const [t, col, alvo] of LEITURAS_B) {
    ler({ id: `T.${t}.ler_B`, superficie: "tabela com tenant", alvo: t, persona: "coordA", operacao: `SELECT linha da escola B (${col} = B)`,
      esperado: "negado", sql: `select 1 from ${t} where ${col} = $1`, params: [alvo], tabelas: [t === "vw_aluno_xp_total" ? "aluno_eventos_progresso" : t] });
  }

  // o sentido inverso: a coordenação B contra a escola A
  for (const [t, col, alvo] of [["alunos", "id", AL.A1], ["registros_estudo", "id", R.regA1], ["metas", "id", R.metaA1], ["consentimentos", "id", R.consA1], ["aluno_onboarding", "aluno_id", AL.A2], ["vw_aluno_xp_total", "aluno_id", AL.A1]]) {
    ler({ id: `T.${t}.ler_A_pela_B`, superficie: "tabela com tenant", alvo: t, persona: "coordB", operacao: `SELECT linha da escola A pela coordenação B`,
      esperado: "negado", sql: `select 1 from ${t} where ${col} = $1`, params: [alvo], tabelas: [t === "vw_aluno_xp_total" ? "aluno_eventos_progresso" : t] });
  }
  ler({ id: "T.registros_estudo.aluno_B_le_A", superficie: "tabela com tenant", alvo: "registros_estudo", persona: "alunoB1", operacao: "SELECT do registro do A1 pelo aluno B1 (outra escola, mesma trilha)", esperado: "negado", sql: `select 1 from registros_estudo where id = $1`, params: [R.regA1], tabelas: ["registros_estudo"] });
  add({ id: "T.registros_estudo.aluno_B_insere_na_A", superficie: "tabela com tenant", alvo: "registros_estudo", persona: "alunoB1", operacao: "INSERT de registro com escola_id = A pelo aluno B1", esperado: "negado", sql: `insert into registros_estudo (escola_id, aluno_id, data, disciplina_codigo, questoes) values ($1, $2, '2026-01-07', 'mat', 5)`, params: [ESC.A, AL.B1], tabelas: ["registros_estudo"] });
  add({ id: "T.turmas.alterar_A_pela_B", superficie: "tabela com tenant", alvo: "turmas", persona: "coordB", operacao: "UPDATE turma da A pela coordenação B", esperado: "negado", sql: `update turmas set nome = 'invadida' where id = $1`, params: [R.turmaA], tabelas: ["turmas"] });

  // escrita: a persona que TEM escrita legítima na tabela tenta atingir B
  const esc = (t, persona, extra) => ({ superficie: "tabela com tenant", alvo: t, persona, tabelas: [t], ...extra });
  // turmas (coordenação)
  add(esc("turmas", "coordA", { id: "T.turmas.alterar_B", operacao: "UPDATE turma da B", esperado: "negado", sql: `update turmas set nome = 'invadida' where id = $1`, params: [R.turmaB] }));
  add(esc("turmas", "coordA", { id: "T.turmas.apagar_B", operacao: "DELETE turma da B", esperado: "negado", sql: `delete from turmas where id = $1`, params: [R.turmaB] }));
  add(esc("turmas", "coordA", { id: "T.turmas.inserir_escola_B", operacao: "INSERT com escola_id = B", esperado: "negado", sql: `insert into turmas (escola_id, nome) values ($1, 'e2 intrusa')`, params: [ESC.B] }));
  add(esc("turmas", "coordA", { id: "T.turmas.mover_para_B", operacao: "UPDATE da própria turma mudando escola_id para B (WITH CHECK)", esperado: "negado", sql: `update turmas set escola_id = $1 where id = $2`, params: [ESC.B, R.turmaA] }));
  add(esc("turmas", "coordA", { id: "T.turmas.upsert_id_B", operacao: "UPSERT com o id da turma da B", esperado: "negado", sql: `insert into turmas (id, escola_id, nome) values ($1, $2, 'e2 upsert') on conflict (id) do update set nome = 'invadida'`, params: [R.turmaB, ESC.A] }));
  add(esc("turmas", "coordA", { id: "T.turmas.controle_positivo", operacao: "UPDATE da própria turma (controle: tem que passar)", esperado: "permitido", sql: `update turmas set nome = 'E2 Turma A renomeada' where id = $1`, params: [R.turmaA] }));

  // alunos (coordenação)
  add(esc("alunos", "coordA", { id: "T.alunos.alterar_B", operacao: "UPDATE aluno da B", esperado: "negado", sql: `update alunos set nome = 'invadido' where id = $1`, params: [AL.B1] }));
  add(esc("alunos", "coordA", { id: "T.alunos.apagar_B", operacao: "DELETE aluno da B", esperado: "negado", sql: `delete from alunos where id = $1`, params: [AL.B1] }));
  add(esc("alunos", "coordA", { id: "T.alunos.inserir_escola_B", operacao: "INSERT com escola_id = B", esperado: "negado", sql: `insert into alunos (escola_id, nome) values ($1, 'e2 intruso')`, params: [ESC.B] }));
  add(esc("alunos", "coordA", { id: "T.alunos.mover_para_B", operacao: "UPDATE do próprio aluno mudando escola_id para B", esperado: "negado", sql: `update alunos set escola_id = $1 where id = $2`, params: [ESC.B, AL.A1] }));
  add(esc("alunos", "coordA", { id: "T.alunos.upsert_id_B", operacao: "UPSERT com o id do aluno da B", esperado: "negado", sql: `insert into alunos (id, escola_id, nome) values ($1, $2, 'e2 upsert') on conflict (id) do update set nome = 'invadido'`, params: [AL.B1, ESC.A] }));
  add(esc("alunos", "coordA", { id: "T.alunos.fk_usuario_B", vazioAceito: true, nota: FK_NOTA, operacao: "INSERT aluno na A com usuario_id de um usuário da B (FK cruzada)", esperado: "negado", sql: `insert into alunos (escola_id, nome, usuario_id) values ($1, 'e2 fk cruzada', $2)`, params: [ESC.A, U.alunoB1] }));
  add(esc("alunos", "coordA", { id: "T.alunos.controle_positivo", operacao: "UPDATE do próprio aluno (controle)", esperado: "permitido", sql: `update alunos set nome = 'E2 A1 renomeado' where id = $1`, params: [AL.A1] }));

  // alunos_turmas (coordenação)
  add(esc("alunos_turmas", "coordA", { id: "T.alunos_turmas.apagar_B", operacao: "DELETE matrícula da B", esperado: "negado", sql: `delete from alunos_turmas where aluno_id = $1`, params: [AL.B1] }));
  add(esc("alunos_turmas", "coordA", { id: "T.alunos_turmas.inserir_escola_B", operacao: "INSERT com escola_id = B", esperado: "negado", sql: `insert into alunos_turmas (escola_id, aluno_id, turma_id) values ($1, $2, $3)`, params: [ESC.B, AL.B2, R.turmaB] }));
  add(esc("alunos_turmas", "coordA", { id: "T.alunos_turmas.mover_para_B", operacao: "UPDATE da própria matrícula mudando escola_id para B", esperado: "negado", sql: `update alunos_turmas set escola_id = $1 where aluno_id = $2`, params: [ESC.B, AL.A1] }));
  add(esc("alunos_turmas", "coordA", { id: "T.alunos_turmas.fk_aluno_B", vazioAceito: true, nota: FK_NOTA, operacao: "INSERT na A matriculando o aluno B1 numa turma da A (FK cruzada)", esperado: "negado", sql: `insert into alunos_turmas (escola_id, aluno_id, turma_id) values ($1, $2, $3)`, params: [ESC.A, AL.B1, R.turmaA] }));
  add(esc("alunos_turmas", "coordA", { id: "T.alunos_turmas.fk_turma_B", vazioAceito: true, nota: FK_NOTA, operacao: "INSERT na A matriculando o A2 numa turma da B (FK cruzada)", esperado: "negado", sql: `insert into alunos_turmas (escola_id, aluno_id, turma_id) values ($1, $2, $3)`, params: [ESC.A, AL.A2, R.turmaB] }));

  // vinculos_responsaveis (coordenação)
  add(esc("vinculos_responsaveis", "coordA", { id: "T.vinculos.apagar_B", operacao: "DELETE vínculo da B", esperado: "negado", sql: `delete from vinculos_responsaveis where id = $1`, params: [R.vincB1] }));
  add(esc("vinculos_responsaveis", "coordA", { id: "T.vinculos.inserir_escola_B", operacao: "INSERT com escola_id = B", esperado: "negado", sql: `insert into vinculos_responsaveis (escola_id, responsavel_id, aluno_id) values ($1, $2, $3)`, params: [ESC.B, U.respB1, AL.B2] }));
  add(esc("vinculos_responsaveis", "coordA", { id: "T.vinculos.mover_para_B", operacao: "UPDATE do próprio vínculo mudando escola_id para B", esperado: "negado", sql: `update vinculos_responsaveis set escola_id = $1 where id = $2`, params: [ESC.B, R.vincA1] }));
  add(esc("vinculos_responsaveis", "coordA", { id: "T.vinculos.fk_aluno_B", vazioAceito: true, nota: FK_NOTA, operacao: "INSERT na A ligando responsável da A ao aluno B1 (FK cruzada)", esperado: "negado", sql: `insert into vinculos_responsaveis (escola_id, responsavel_id, aluno_id) values ($1, $2, $3)`, params: [ESC.A, U.respSemVinculo, AL.B1] }));
  add(esc("vinculos_responsaveis", "coordA", { id: "T.vinculos.fk_responsavel_B", vazioAceito: true, nota: FK_NOTA, operacao: "INSERT na A ligando o responsável da B ao A2 (FK cruzada)", esperado: "negado", sql: `insert into vinculos_responsaveis (escola_id, responsavel_id, aluno_id) values ($1, $2, $3)`, params: [ESC.A, U.respB1, AL.A2] }));

  // metas (ninguém escreve pela API)
  add(esc("metas", "coordA", { id: "T.metas.alterar_B", operacao: "UPDATE meta da B", esperado: "negado", sql: `update metas set status = 'fechada' where id = $1`, params: [R.metaB1] }));
  add(esc("metas", "coordA", { id: "T.metas.inserir_propria", operacao: "INSERT meta na própria escola (motor é quem gera)", esperado: "negado", sql: `insert into metas (escola_id, aluno_id, trilha_id, semana_numero, inicio, fim) values ($1, $2, $3, 2, '2026-01-12', '2026-01-18')`, params: [ESC.A, AL.A1, TRILHA.T1] }));

  // meta_atividades (aluno atualiza a própria)
  add(esc("meta_atividades", "alunoA1", { id: "T.meta_atividades.alterar_B", operacao: "UPDATE atividade da meta de B1", esperado: "negado", sql: `update meta_atividades set estado = 'concluida' where id = $1`, params: [R.maB1] }));
  add(esc("meta_atividades", "alunoA1", { id: "T.meta_atividades.mover_para_B", operacao: "UPDATE da própria atividade mudando escola_id para B", esperado: "negado", sql: `update meta_atividades set escola_id = $1 where id = $2`, params: [ESC.B, R.maA1] }));
  add(esc("meta_atividades", "alunoA1", { id: "T.meta_atividades.fk_meta_B", vazioAceito: true, nota: FK_NOTA, operacao: "UPDATE da própria atividade repontando meta_id para a meta de B1 (FK cruzada)", esperado: "negado", sql: `update meta_atividades set meta_id = $1 where id = $2`, params: [R.metaB1, R.maA1] }));
  add(esc("meta_atividades", "alunoA1", { id: "T.meta_atividades.controle_positivo", operacao: "UPDATE da própria atividade (controle)", esperado: "permitido", sql: `update meta_atividades set estado = 'concluida' where id = $1`, params: [R.maA1] }));

  // registros_estudo (aluno)
  add(esc("registros_estudo", "alunoA1", { id: "T.registros.alterar_B", operacao: "UPDATE registro de B1", esperado: "negado", sql: `update registros_estudo set questoes = 99 where id = $1`, params: [R.regB1] }));
  add(esc("registros_estudo", "alunoA1", { id: "T.registros.apagar_B", operacao: "DELETE registro de B1", esperado: "negado", sql: `delete from registros_estudo where id = $1`, params: [R.regB1] }));
  add(esc("registros_estudo", "alunoA1", { id: "T.registros.inserir_escola_B", operacao: "INSERT com escola_id = B", esperado: "negado", sql: `insert into registros_estudo (escola_id, aluno_id, data, disciplina_codigo, questoes) values ($1, $2, '2026-01-07', 'mat', 5)`, params: [ESC.B, AL.A1] }));
  add(esc("registros_estudo", "alunoA1", { id: "T.registros.mover_para_B", operacao: "UPDATE do próprio registro mudando escola_id para B", esperado: "negado", sql: `update registros_estudo set escola_id = $1 where id = $2`, params: [ESC.B, R.regA1] }));
  add(esc("registros_estudo", "alunoA1", { id: "T.registros.upsert_id_B", operacao: "UPSERT com o id do registro de B1", esperado: "negado", sql: `insert into registros_estudo (id, escola_id, aluno_id, data, disciplina_codigo, questoes) values ($1, $2, $3, '2026-01-07', 'mat', 5) on conflict (id) do update set questoes = 99`, params: [R.regB1, ESC.A, AL.A1] }));
  add(esc("registros_estudo", "alunoA1", { id: "T.registros.fk_aluno_B", vazioAceito: true, nota: FK_NOTA, operacao: "INSERT na A com aluno_id = B1 (FK cruzada)", esperado: "negado", sql: `insert into registros_estudo (escola_id, aluno_id, data, disciplina_codigo, questoes) values ($1, $2, '2026-01-07', 'mat', 5)`, params: [ESC.A, AL.B1] }));
  add({ ...esc("registros_estudo", "alunoA1", { id: "T.registros.controle_positivo", operacao: "INSERT do próprio registro (controle)", esperado: "permitido", sql: `insert into registros_estudo (escola_id, aluno_id, data, disciplina_codigo, questoes, acertos) values ($1, $2, '2026-01-07', 'mat', 5, 3)`, params: [ESC.A, AL.A1] }), tabelas: ["registros_estudo", "aluno_eventos_progresso"] });

  // simulados (aluno)
  add(esc("simulados", "alunoA1", { id: "T.simulados.apagar_B", operacao: "DELETE simulado de B1", esperado: "negado", sql: `delete from simulados where id = $1`, params: [R.simB1] }));
  add(esc("simulados", "alunoA1", { id: "T.simulados.inserir_escola_B", operacao: "INSERT com escola_id = B", esperado: "negado", sql: `insert into simulados (escola_id, aluno_id, nome, data) values ($1, $2, 'e2', '2026-01-10')`, params: [ESC.B, AL.A1] }));
  add(esc("simulados", "alunoA1", { id: "T.simulados.fk_aluno_B", vazioAceito: true, nota: FK_NOTA, operacao: "INSERT na A com aluno_id = B1 (FK cruzada)", esperado: "negado", sql: `insert into simulados (escola_id, aluno_id, nome, data) values ($1, $2, 'e2', '2026-01-10')`, params: [ESC.A, AL.B1] }));

  // consentimentos (coordenação)
  add(esc("consentimentos", "coordA", { id: "T.consentimentos.alterar_B", operacao: "UPDATE consentimento da B", esperado: "negado", sql: `update consentimentos set responsavel_nome = 'x' where id = $1`, params: [R.consB1] }));
  add(esc("consentimentos", "coordA", { id: "T.consentimentos.apagar_B", operacao: "DELETE consentimento da B", esperado: "negado", sql: `delete from consentimentos where id = $1`, params: [R.consB1] }));
  add(esc("consentimentos", "coordA", { id: "T.consentimentos.inserir_escola_B", operacao: "INSERT com escola_id = B", esperado: "negado", sql: `insert into consentimentos (escola_id, aluno_id, responsavel_nome, registrado_por) values ($1, $2, 'x', $3)`, params: [ESC.B, AL.B1, U.coordA] }));
  add(esc("consentimentos", "coordA", { id: "T.consentimentos.mover_para_B", operacao: "UPDATE do próprio consentimento mudando escola_id para B", esperado: "negado", sql: `update consentimentos set escola_id = $1 where id = $2`, params: [ESC.B, R.consA1] }));
  add(esc("consentimentos", "coordA", { id: "T.consentimentos.fk_aluno_B", vazioAceito: true, nota: FK_NOTA, operacao: "INSERT na A com aluno_id = B1 (FK cruzada)", esperado: "negado", sql: `insert into consentimentos (escola_id, aluno_id, responsavel_nome, registrado_por) values ($1, $2, 'x', $3)`, params: [ESC.A, AL.B1, U.coordA] }));

  // logs_acesso (qualquer papel insere o próprio acesso)
  add(esc("logs_acesso", "coordA", { id: "T.logs_acesso.inserir_escola_B", operacao: "INSERT com escola_id = B", esperado: "negado", sql: `insert into logs_acesso (escola_id, aluno_id, usuario_id, papel, acao) values ($1, $2, $3, 'coordenacao', 'e2')`, params: [ESC.B, AL.B1, U.coordA] }));
  add(esc("logs_acesso", "coordA", { id: "T.logs_acesso.fk_aluno_B", vazioAceito: true, nota: FK_NOTA, operacao: "INSERT na A registrando acesso ao aluno B1 (FK cruzada)", esperado: "negado", sql: `insert into logs_acesso (escola_id, aluno_id, usuario_id, papel, acao) values ($1, $2, $3, 'coordenacao', 'e2')`, params: [ESC.A, AL.B1, U.coordA] }));
  add(esc("logs_acesso", "coordA", { id: "T.logs_acesso.apagar_proprio", operacao: "DELETE de log (ninguém apaga log pela API)", esperado: "negado", sql: `delete from logs_acesso where escola_id = $1`, params: [ESC.A] }));

  // logs_coordenacao
  add(esc("logs_coordenacao", "coordA", { id: "T.logs_coordenacao.inserir_escola_B", operacao: "INSERT com escola_id = B", esperado: "negado", sql: `insert into logs_coordenacao (escola_id, usuario_id, papel, acao) values ($1, $2, 'coordenacao', 'e2')`, params: [ESC.B, U.coordA] }));
  add(esc("logs_coordenacao", "coordA", { id: "T.logs_coordenacao.apagar_proprio", operacao: "DELETE de log", esperado: "negado", sql: `delete from logs_coordenacao where escola_id = $1`, params: [ESC.A] }));

  // config_escola e missoes_escola (coordenação)
  add(esc("config_escola", "coordA", { id: "T.config_escola.alterar_B", operacao: "UPDATE config da B", esperado: "negado", sql: `update config_escola set valor = '{"v":2}' where id = $1`, params: [R.cfgB] }));
  add(esc("config_escola", "coordA", { id: "T.config_escola.inserir_escola_B", operacao: "INSERT com escola_id = B", esperado: "negado", sql: `insert into config_escola (escola_id, exam_tag, chave, valor) values ($1, 'cn', 'e2-outra', '{}')`, params: [ESC.B] }));
  add(esc("config_escola", "coordA", { id: "T.config_escola.upsert_chave_B", operacao: "UPSERT na chave única da B (escola, exam, chave)", esperado: "negado", sql: `insert into config_escola (escola_id, exam_tag, chave, valor) values ($1, 'cn', 'e2-chave', '{"v":9}') on conflict (escola_id, exam_tag, chave) do update set valor = excluded.valor`, params: [ESC.B] }));
  add(esc("missoes_escola", "coordA", { id: "T.missoes_escola.alterar_B", operacao: "UPDATE missão da B", esperado: "negado", sql: `update missoes_escola set ativa = false where id = $1`, params: [R.meB] }));
  add(esc("missoes_escola", "coordA", { id: "T.missoes_escola.mover_para_B", operacao: "UPDATE da própria missão mudando escola_id para B", esperado: "negado", sql: `update missoes_escola set escola_id = $1 where id = $2`, params: [ESC.B, R.meA] }));

  // gamificação escrita pela coordenação: todas com aluno_id → FK cruzada
  const GAMIF = [
    ["aluno_xp_eventos", R.xpB1, R.xpA1, `insert into aluno_xp_eventos (escola_id, aluno_id, exam_tag, origem, pontos) values ($1, $2, 'cn', 'ajuste_manual', 500)`, `update aluno_xp_eventos set pontos = 999 where id = $1`],
    ["aluno_conquistas", R.conqB1, R.conqA1, `insert into aluno_conquistas (escola_id, aluno_id, conquista_id, exam_tag) values ($1, $2, (select id from conquistas order by id offset 1 limit 1), 'cn')`, `update aluno_conquistas set desbloqueada_em = now() - interval '1 day' where id = $1`],
    ["aluno_missoes", R.amB1, R.amA1, `insert into aluno_missoes (escola_id, aluno_id, missao_id, exam_tag, estado) values ($1, $2, (select id from missoes where exam_tag = 'cn' order by id offset 1 limit 1), 'cn', 'concluida')`, `update aluno_missoes set estado = 'concluida' where id = $1`],
    ["aluno_niveis", R.nivB1, R.nivA1, `insert into aluno_niveis (escola_id, aluno_id, escopo, nivel, origem) values ($1, $2, 'e2-escopo', 'avancado', 'manual')`, `update aluno_niveis set nivel = 'avancado' where id = $1`],
  ];
  for (const [t, idB, idA, insertSql, updateSql] of GAMIF) {
    const tabelas = t === "aluno_niveis" ? [t, "aluno_nivel_historico"] : [t];
    add({ ...esc(t, "coordA", { id: `T.${t}.alterar_B`, operacao: "UPDATE linha da B", esperado: "negado", sql: updateSql, params: [idB] }), tabelas });
    add({ ...esc(t, "coordA", { id: `T.${t}.inserir_escola_B`, operacao: "INSERT com escola_id = B", esperado: "negado", sql: insertSql, params: [ESC.B, AL.B1] }), tabelas });
    add({ ...esc(t, "coordA", { id: `T.${t}.mover_para_B`, operacao: "UPDATE da própria linha mudando escola_id para B", esperado: "negado", sql: `update ${t} set escola_id = $1 where id = $2`, params: [ESC.B, idA] }), tabelas });
    add({ ...esc(t, "coordA", { id: `T.${t}.fk_aluno_B`, operacao: "INSERT na A com aluno_id = B1 (FK cruzada)", esperado: "negado", sql: insertSql, params: [ESC.A, AL.B1] }), tabelas, vazioAceito: true, nota: FK_NOTA });
  }
  add(esc("aluno_onboarding", "coordA", { id: "T.aluno_onboarding.alterar_B", operacao: "UPDATE onboarding de B2", esperado: "negado", sql: `update aluno_onboarding set objetivo = 'x' where aluno_id = $1`, params: [AL.B2] }));
  add(esc("aluno_onboarding", "coordA", { id: "T.aluno_onboarding.fk_aluno_B", vazioAceito: true, nota: FK_NOTA, operacao: "INSERT na A com aluno_id = B1 (FK cruzada)", esperado: "negado", sql: `insert into aluno_onboarding (aluno_id, escola_id, objetivo) values ($1, $2, 'x')`, params: [AL.B1, ESC.A] }));
  add(esc("aluno_eventos_progresso", "coordA", { id: "T.aluno_eventos_progresso.inserir_escola_B", operacao: "INSERT ajuste com escola_id = B", esperado: "negado", sql: `insert into aluno_eventos_progresso (escola_id, aluno_id, exam_tag, tipo_evento, origem, xp_delta, idempotency_key) values ($1, $2, 'cn', 'ajuste_coordenacao', 'e2', 500, 'e2-intruso-b')`, params: [ESC.B, AL.B1] }));
  add(esc("aluno_eventos_progresso", "coordA", { id: "T.aluno_eventos_progresso.fk_aluno_B", vazioAceito: true, nota: FK_NOTA, operacao: "INSERT ajuste na A com aluno_id = B1 (FK cruzada)", esperado: "negado", sql: `insert into aluno_eventos_progresso (escola_id, aluno_id, exam_tag, tipo_evento, origem, xp_delta, idempotency_key) values ($1, $2, 'cn', 'ajuste_coordenacao', 'e2', 500, 'e2-fk-b1')`, params: [ESC.A, AL.B1] }));
  add(esc("aluno_eventos_progresso", "coordA", { id: "T.aluno_eventos_progresso.alterar_B", operacao: "UPDATE evento da B", esperado: "negado", sql: `update aluno_eventos_progresso set xp_delta = 999 where id = $1`, params: [R.evB1] }));

  // escolas / usuarios / tabelas do backoffice
  add(esc("escolas", "coordA", { id: "T.escolas.alterar_B", operacao: "UPDATE escola B", esperado: "negado", sql: `update escolas set nome = 'invadida' where id = $1`, params: [ESC.B] }));
  add(esc("escolas", "coordA", { id: "T.escolas.upsert_id_B", operacao: "UPSERT com o id da escola B", esperado: "negado", sql: `insert into escolas (id, nome, slug) values ($1, 'x', 'e2-x') on conflict (id) do update set nome = 'invadida'`, params: [ESC.B] }));
  // Fatia 7: colunas do backoffice na PRÓPRIA escola (0058, #144)
  for (const [col, valor] of [["status", "'cancelada'"], ["plano", "'premium'"], ["limite_alunos", "999999"], ["slug", "'e2-outra'"], ["observacao", "'reescrita'"]]) {
    add(esc("escolas", "coordA", { id: `T.escolas.coluna_backoffice.${col}`, operacao: `UPDATE ${col} da própria escola (coluna do backoffice)`, esperado: "negado", sql: `update escolas set ${col} = ${valor} where id = $1`, params: [ESC.A] }));
  }
  add(esc("escolas", "coordA", { id: "T.escolas.marca_propria", operacao: "UPDATE nome e cor da própria escola (controle: a tela de marca)", esperado: "permitido", sql: `update escolas set nome = 'E2 Escola A marca', cor_acento = '#0b3d2e' where id = $1`, params: [ESC.A] }));
  for (const persona of ["alunoA1", "respA1", "coordA"]) {
    ler({ id: `A.escolas.colunas_internas.${persona}`, superficie: "colunas do backoffice", alvo: "escolas", persona, operacao: "SELECT da observação do operador e do contato da própria escola", esperado: "negado", sql: `select observacao, contato_nome from escolas where id = $1`, params: [ESC.A], tabelas: ["escolas"] });
  }
  ler({ id: "A.escolas.marca.alunoA1", superficie: "colunas do backoffice", alvo: "escolas", persona: "alunoA1", operacao: "SELECT das colunas do embed de meuPerfil (controle)", esperado: "permitido", sql: `select id, nome, slug, logo_url, cor_acento, status, plano from escolas where id = $1`, params: [ESC.A], tabelas: ["escolas"] });
  add(esc("usuarios", "coordA", { id: "T.usuarios.alterar_B", operacao: "UPDATE usuário da B", esperado: "negado", sql: `update usuarios set nome = 'x' where id = $1`, params: [U.coordB] }));
  add(esc("usuarios", "coordA", { id: "T.usuarios.promover_proprio", operacao: "UPDATE do próprio usuário (papel/escola)", esperado: "negado", sql: `update usuarios set escola_id = $1 where id = $2`, params: [ESC.B, U.coordA] }));
  for (const t of ["internal_admins", "admin_logs", "virada_execucoes"]) {
    ler({ id: `T.${t}.ler_coord`, superficie: "backoffice", alvo: t, persona: "coordA", operacao: "SELECT tabela do backoffice", esperado: "negado", sql: `select 1 from ${t}`, tabelas: [t] });
  }
  add({ superficie: "backoffice", alvo: "internal_admins", persona: "coordA", id: "T.internal_admins.autopromocao", operacao: "INSERT de si mesmo em internal_admins", esperado: "negado", sql: `insert into internal_admins (auth_user_id, email, nome) values ($1, 'x@y', 'x')`, params: [U.coordA], tabelas: ["internal_admins"] });
  add({ superficie: "backoffice", alvo: "internal_admins", persona: "superAdminInativo", id: "T.internal_admins.reativar_proprio", operacao: "UPDATE reativando a própria linha", esperado: "negado", sql: `update internal_admins set ativo = true where auth_user_id = $1`, params: [U.superAdminInativo], tabelas: ["internal_admins"] });
  add({ superficie: "backoffice", alvo: "admin_logs", persona: "superAdmin", id: "T.admin_logs.forjar_outro", operacao: "INSERT de log em nome de outro operador", esperado: "negado", sql: `insert into admin_logs (super_admin_id, acao) values ($1, 'e2-forjado')`, params: [U.superAdminInativo], tabelas: ["admin_logs"] });

  // ═══ 2. CATÁLOGO COMPARTILHADO (sem escola_id) ════════════════
  // O que segura hoje é só a AUSÊNCIA de policy de escrita. Estes casos
  // existem para pegar a policy permissiva que alguém ainda vai escrever.
  const CATALOGO = [
    ["trilhas", `insert into trilhas (nicho, nome, versao, publicada) values ('e2-intruso', 'x', 1, true)`, `update trilhas set nome = 'invadida' where id = '${TRILHA.T1}'`, `delete from trilhas where id = '${TRILHA.T2}'`],
    ["trilha_semanas", `insert into trilha_semanas (trilha_id, numero, inicio, fim, foco) values ('${TRILHA.T1}', 9, '2026-02-01', '2026-02-07', 'x')`, `update trilha_semanas set foco = 'invadido' where id = '${R.semT1a}'`, `delete from trilha_semanas where id = '${R.semT1b}'`],
    ["disciplinas", `insert into disciplinas (trilha_id, codigo, nome, abrev, cor, ordem) values ('${TRILHA.T1}', 'por', 'x', 'X', '#000000', 2)`, `update disciplinas set nome = 'invadida' where id = '${R.discT1}'`, `delete from disciplinas where id = '${R.discT2}'`],
    ["atividades_modelo", `insert into atividades_modelo (trilha_id, semana_numero, disciplina_codigo, prioridade, texto, ordem) values ('${TRILHA.T1}', 1, 'mat', 'F', 'x', 9)`, `update atividades_modelo set texto = 'invadida' where id = '${R.ativT1a}'`, `delete from atividades_modelo where id = '${R.ativT2a}'`],
    ["concursos", `insert into concursos (codigo, nome, organizacao, nivel, mes_prova, dia_prova) values ('e2x', 'x', 'x', 'x', 1, 1)`, `update concursos set nome = 'invadido' where codigo = 'e2cat'`, `delete from concursos where codigo = 'e2cat2'`],
    ["materias", `insert into materias (codigo, nome, abrev) values ('e2x', 'x', 'X')`, `update materias set nome = 'invadida' where codigo = 'e2mat'`, `delete from materias where codigo = 'e2mat2'`],
    ["provas", `insert into provas (exam_tag, nome) values ('e2cat2', 'x')`, `update provas set nome = 'invadida' where exam_tag = 'e2cat'`, `delete from provas where exam_tag = 'e2cat'`],
    ["prova_materias", `insert into prova_materias (exam_tag, materia_codigo) values ('e2cat', 'mat')`, `update prova_materias set peso = 99 where exam_tag = 'e2cat'`, `delete from prova_materias where exam_tag = 'e2cat'`],
    ["assuntos", `insert into assuntos (exam_tag, materia_codigo, nome) values ('e2cat', 'e2mat', 'x')`, `update assuntos set nome = 'invadido' where exam_tag = 'e2cat'`, `delete from assuntos where exam_tag = 'e2cat'`],
  ];
  for (const [t, ins, upd, del] of CATALOGO) {
    for (const [op, sql] of [["INSERT", ins], ["UPDATE", upd], ["DELETE", del]]) {
      add({ id: `C.${t}.${op.toLowerCase()}`, superficie: "catálogo compartilhado", alvo: t, persona: "coordA", operacao: `${op} no catálogo global (afetaria todas as escolas do nicho)`, esperado: "negado", sql, tabelas: [t] });
    }
  }
  add({ id: "C.trilhas.insert_aluno", superficie: "catálogo compartilhado", alvo: "trilhas", persona: "alunoA1", operacao: "INSERT no catálogo por aluno", esperado: "negado", sql: CATALOGO[0][1], tabelas: ["trilhas"] });

  // ═══ 3. ALUNO contra colega da mesma escola ═══════════════════
  const colega = [["alunos", "id", AL.A2], ["registros_estudo", "id", R.regA2], ["metas", "id", R.metaA2], ["meta_atividades", "id", R.maA2], ["simulados", "id", R.simA2], ["aluno_onboarding", "aluno_id", AL.A2], ["usuarios", "id", U.alunoA2], ["vinculos_responsaveis", "id", R.vincA1], ["consentimentos", "id", R.consA1], ["logs_acesso", "escola_id", ESC.A]];
  for (const [t, col, alvo] of colega) {
    ler({ id: `A.${t}.ler_colega`, superficie: "aluno", alvo: t, persona: "alunoA1", operacao: `SELECT de ${t} do colega A2 (ou da coordenação)`, esperado: "negado", sql: `select 1 from ${t} where ${col} = $1`, params: [alvo], tabelas: [t] });
  }
  ler({ id: "A.registros.colega_le_A1", superficie: "aluno", alvo: "registros_estudo", persona: "alunoA2", operacao: "SELECT do registro do A1 pelo colega A2 (sentido inverso)", esperado: "negado", sql: `select 1 from registros_estudo where id = $1`, params: [R.regA1], tabelas: ["registros_estudo"] });
  add({ id: "A.meta_atividades.colega_marca_A1", superficie: "aluno", alvo: "meta_atividades", persona: "alunoA2", operacao: "UPDATE da atividade da meta do A1 pelo colega A2", esperado: "negado", sql: `update meta_atividades set estado = 'concluida' where id = $1`, params: [R.maA1], tabelas: ["meta_atividades", "aluno_eventos_progresso"] });
  ler({ id: "A.registros.ler_proprio", superficie: "aluno", alvo: "registros_estudo", persona: "alunoA1", operacao: "SELECT do próprio registro (controle)", esperado: "permitido", sql: `select 1 from registros_estudo where id = $1`, params: [R.regA1], tabelas: ["registros_estudo"] });
  add({ id: "A.registros.alterar_colega", superficie: "aluno", alvo: "registros_estudo", persona: "alunoA1", operacao: "UPDATE registro do A2", esperado: "negado", sql: `update registros_estudo set questoes = 99 where id = $1`, params: [R.regA2], tabelas: ["registros_estudo"] });
  add({ id: "A.registros.apagar_colega", superficie: "aluno", alvo: "registros_estudo", persona: "alunoA1", operacao: "DELETE registro do A2", esperado: "negado", sql: `delete from registros_estudo where id = $1`, params: [R.regA2], tabelas: ["registros_estudo", "aluno_eventos_progresso"] });
  add({ id: "A.registros.inserir_para_colega", superficie: "aluno", alvo: "registros_estudo", persona: "alunoA1", operacao: "INSERT registro com aluno_id = A2", esperado: "negado", sql: `insert into registros_estudo (escola_id, aluno_id, data, disciplina_codigo, questoes) values ($1, $2, '2026-01-07', 'mat', 5)`, params: [ESC.A, AL.A2], tabelas: ["registros_estudo"] });
  add({ id: "A.registros.transferir_proprio_para_colega", superficie: "aluno", alvo: "registros_estudo", persona: "alunoA1", operacao: "UPDATE do próprio registro mudando aluno_id para A2", esperado: "negado", sql: `update registros_estudo set aluno_id = $1 where id = $2`, params: [AL.A2, R.regA1], tabelas: ["registros_estudo"] });
  add({ id: "A.meta_atividades.alterar_colega", superficie: "aluno", alvo: "meta_atividades", persona: "alunoA1", operacao: "UPDATE atividade da meta do A2", esperado: "negado", sql: `update meta_atividades set estado = 'concluida' where id = $1`, params: [R.maA2], tabelas: ["meta_atividades", "aluno_eventos_progresso"] });
  add({ id: "A.metas.alterar_propria", superficie: "aluno", alvo: "metas", persona: "alunoA1", operacao: "UPDATE da própria meta (aluno não escreve meta)", esperado: "negado", sql: `update metas set status = 'fechada' where id = $1`, params: [R.metaA1], tabelas: ["metas"] });
  add({ id: "A.simulados.apagar_colega", superficie: "aluno", alvo: "simulados", persona: "alunoA1", operacao: "DELETE simulado do A2", esperado: "negado", sql: `delete from simulados where id = $1`, params: [R.simA2], tabelas: ["simulados", "aluno_eventos_progresso"] });
  add({ id: "A.simulados.inserir_para_colega", superficie: "aluno", alvo: "simulados", persona: "alunoA1", operacao: "INSERT simulado com aluno_id = A2", esperado: "negado", sql: `insert into simulados (escola_id, aluno_id, nome, data) values ($1, $2, 'e2', '2026-01-10')`, params: [ESC.A, AL.A2], tabelas: ["simulados"] });
  add({ id: "A.alunos.trocar_trilha_propria", superficie: "aluno", alvo: "alunos", persona: "alunoA1", operacao: "UPDATE da própria linha de aluno (trilha)", esperado: "negado", sql: `update alunos set trilha_id = $1 where id = $2`, params: [TRILHA.T2, AL.A1], tabelas: ["alunos"] });
  add({ id: "A.aluno_xp_eventos.dar_xp_a_si", superficie: "aluno", alvo: "aluno_xp_eventos", persona: "alunoA1", operacao: "INSERT de XP para si mesmo", esperado: "negado", sql: `insert into aluno_xp_eventos (escola_id, aluno_id, exam_tag, origem, pontos) values ($1, $2, 'cn', 'ajuste_manual', 1000)`, params: [ESC.A, AL.A1], tabelas: ["aluno_xp_eventos"] });
  add({ id: "A.aluno_eventos_progresso.dar_xp_a_si", superficie: "aluno", alvo: "aluno_eventos_progresso", persona: "alunoA1", operacao: "INSERT de evento de XP para si mesmo", esperado: "negado", sql: `insert into aluno_eventos_progresso (escola_id, aluno_id, exam_tag, tipo_evento, origem, xp_delta, idempotency_key) values ($1, $2, 'cn', 'ajuste_coordenacao', 'e2', 1000, 'e2-auto')`, params: [ESC.A, AL.A1], tabelas: ["aluno_eventos_progresso"] });
  rpc({ id: "A.rpc.resumo_escola", superficie: "aluno", alvo: "resumo_escola", persona: "alunoA1", operacao: "resumo_escola() só devolve o próprio aluno", esperado: "negado", sql: `select 1 from public.resumo_escola() where aluno_id <> $1`, params: [AL.A1], tabelas: ["registros_estudo"], leitura: true, nota: "negado = nenhuma linha de outro aluno" });

  // ═══ 4. RESPONSÁVEL ═══════════════════════════════════════════
  for (const [t, col, alvo] of [["alunos", "id", AL.A1], ["registros_estudo", "id", R.regA1], ["metas", "id", R.metaA1], ["simulados", "id", R.simA1]]) {
    ler({ id: `R.${t}.ler_vinculado`, superficie: "responsável", alvo: t, persona: "respA1", operacao: `SELECT de ${t} do aluno vinculado (controle)`, esperado: "permitido", sql: `select 1 from ${t} where ${col} = $1`, params: [alvo], tabelas: [t] });
    ler({ id: `R.${t}.ler_nao_vinculado`, superficie: "responsável", alvo: t, persona: "respA1", operacao: `SELECT de ${t} do A2, que não é vinculado`, esperado: "negado", sql: `select 1 from ${t} where ${col} = $1`, params: [t === "alunos" ? AL.A2 : t === "registros_estudo" ? R.regA2 : t === "metas" ? R.metaA2 : R.simA2], tabelas: [t] });
    ler({ id: `R.${t}.sem_vinculo`, superficie: "responsável", alvo: t, persona: "respSemVinculo", operacao: `SELECT de ${t} do A1 sem ter vínculo`, esperado: "negado", sql: `select 1 from ${t} where ${col} = $1`, params: [alvo], tabelas: [t] });
    ler({ id: `R.${t}.vinculo_revogado`, superficie: "responsável", alvo: t, persona: "respRevogado", operacao: `SELECT de ${t} do A1 depois do vínculo apagado, com a sessão ainda aberta`, esperado: "negado", sql: `select 1 from ${t} where ${col} = $1`, params: [alvo], tabelas: [t] });
  }
  add({ id: "R.registros.editar_vinculado", superficie: "responsável", alvo: "registros_estudo", persona: "respA1", operacao: "UPDATE registro do aluno vinculado", esperado: "negado", sql: `update registros_estudo set questoes = 99 where id = $1`, params: [R.regA1], tabelas: ["registros_estudo"] });
  add({ id: "R.registros.inserir_para_vinculado", superficie: "responsável", alvo: "registros_estudo", persona: "respA1", operacao: "INSERT registro em nome do vinculado", esperado: "negado", sql: `insert into registros_estudo (escola_id, aluno_id, data, disciplina_codigo, questoes) values ($1, $2, '2026-01-07', 'mat', 5)`, params: [ESC.A, AL.A1], tabelas: ["registros_estudo"] });
  add({ id: "R.meta_atividades.marcar_vinculado", superficie: "responsável", alvo: "meta_atividades", persona: "respA1", operacao: "UPDATE atividade da meta do vinculado", esperado: "negado", sql: `update meta_atividades set estado = 'concluida' where id = $1`, params: [R.maA1], tabelas: ["meta_atividades"] });
  add({ id: "R.vinculos.criar_proprio", superficie: "responsável", alvo: "vinculos_responsaveis", persona: "respSemVinculo", operacao: "INSERT de vínculo para si mesmo", esperado: "negado", sql: `insert into vinculos_responsaveis (escola_id, responsavel_id, aluno_id) values ($1, $2, $3)`, params: [ESC.A, U.respSemVinculo, AL.A2], tabelas: ["vinculos_responsaveis"] });
  add({ id: "R.alunos.editar_vinculado", superficie: "responsável", alvo: "alunos", persona: "respA1", operacao: "UPDATE do aluno vinculado", esperado: "negado", sql: `update alunos set nome = 'x' where id = $1`, params: [AL.A1], tabelas: ["alunos"] });
  ler({ id: "R.config_escola.revogado_le", superficie: "responsável", alvo: "config_escola", persona: "respRevogado", operacao: "SELECT da configuração da escola com o vínculo já apagado", esperado: "permitido", sql: `select 1 from config_escola where id = $1`, params: [R.cfgA], tabelas: ["config_escola"], nota: "comportamento registrado: config_escola_select só exige escola_id = tenant, para qualquer papel; revogar o vínculo não desliga a conta" });

  // ═══ 5. COORDENAÇÃO chamando o que não é dela ═════════════════
  const BACKOFFICE = [
    ["backoffice_escolas", `select 1 from public.backoffice_escolas()`, [], []],
    ["backoffice_dashboard", `select public.backoffice_dashboard()`, [], []],
    ["backoffice_detalhe_escola", `select public.backoffice_detalhe_escola($1)`, [ESC.B], []],
    ["backoffice_definir_status", `select public.backoffice_definir_status($1, 'suspensa')`, [ESC.B], ["escolas", "admin_logs"]],
    ["backoffice_editar_escola", `select public.backoffice_editar_escola($1, 'invadida', null, null, null, null, null, null, null, null, null, null, null)`, [ESC.B], ["escolas", "admin_logs"]],
    ["backoffice_criar_escola", `select public.backoffice_criar_escola('E2 Nova', 'e2-nova', null, null, null, null, 'implantacao', null, null, null, null)`, [], ["escolas", "admin_logs"]],
    ["backoffice_registrar_reenvio", `select public.backoffice_registrar_reenvio($1, $2)`, [ESC.B, U.coordB], ["admin_logs"]],
    ["backoffice_virada_saude", `select public.backoffice_virada_saude(24)`, [], []],
  ];
  for (const persona of ["coordA", "superAdminFalso", "superAdminInativo", "anon"]) {
    for (const [fn, sql, params, tabelas] of BACKOFFICE) {
      rpc({ id: `B.${fn}.${persona}`, superficie: persona.startsWith("coord") ? "coordenação" : persona === "anon" ? "anônimo" : "super admin", alvo: fn, persona, operacao: `${fn} (operação de super admin)`, esperado: "negado", sql, params, tabelas: tabelas.length ? tabelas : ["escolas"] });
    }
  }
  for (const [fn, sql, params, tabelas] of BACKOFFICE) {
    rpc({ id: `B.${fn}.superAdmin`, superficie: "super admin", alvo: fn, persona: "superAdmin", operacao: `${fn} pelo super admin ativo (controle)`, esperado: "permitido", sql, params, tabelas: tabelas.length ? tabelas : ["escolas"] });
  }
  ler({ id: "B.internal_admins.superAdmin_le", superficie: "super admin", alvo: "internal_admins", persona: "superAdmin", operacao: "SELECT internal_admins pelo super admin ativo (controle)", esperado: "permitido", sql: `select 1 from internal_admins`, tabelas: ["internal_admins"] });
  ler({ id: "B.internal_admins.falso_le", superficie: "super admin", alvo: "internal_admins", persona: "superAdminFalso", operacao: "SELECT internal_admins sem linha ativa", esperado: "negado", sql: `select 1 from internal_admins`, tabelas: ["internal_admins"] });
  ler({ id: "B.internal_admins.inativo_le", superficie: "super admin", alvo: "internal_admins", persona: "superAdminInativo", operacao: "SELECT internal_admins com ativo = false", esperado: "negado", sql: `select 1 from internal_admins`, tabelas: ["internal_admins"] });
  rpc({ id: "B.sou_super_admin.falso", superficie: "super admin", alvo: "sou_super_admin", persona: "superAdminFalso", operacao: "sou_super_admin() sem linha", esperado: "negado", sql: `select 1 where public.sou_super_admin()`, tabelas: ["internal_admins"], leitura: true });

  // ═══ 6. RPCs expostas com ID de outro tenant ══════════════════
  rpc({ id: "P.abrir_proximo_ciclo.aluno_B_no_payload", superficie: "RPC com ID de outro tenant", alvo: "abrir_proximo_ciclo", persona: "coordA", operacao: "abre ciclo da trilha compartilhada passando o aluno B1 em p_alunos",
    esperado: "negado", sql: `select public.abrir_proximo_ciclo($1, '2026-06-28', array[$2]::uuid[])`, params: [TRILHA.T1, AL.B1], tabelas: ["alunos"],
    efeito: { sql: `select trilha_id = $1 as ok from alunos where id = $2`, params: [TRILHA.T1, AL.B1], descricao: "B1 continua na trilha de origem" },
    nota: "negado = B1 não é movido; a edição nova do catálogo nasce de qualquer jeito (ver P.abrir_proximo_ciclo.trilha_de_C)" });
  rpc({ id: "P.abrir_proximo_ciclo.controle", superficie: "RPC com ID de outro tenant", alvo: "abrir_proximo_ciclo", persona: "coordA", operacao: "abre ciclo e move o A1 (controle)",
    esperado: "permitido", sql: `select public.abrir_proximo_ciclo($1, '2026-06-28', array[$2]::uuid[])`, params: [TRILHA.T1, AL.A1], tabelas: ["alunos", "trilhas"],
    efeito: { sql: `select trilha_id <> $1 as ok from alunos where id = $2`, params: [TRILHA.T1, AL.A1], descricao: "A1 foi para a edição nova" } });
  rpc({ id: "P.abrir_proximo_ciclo.trilha_de_C", superficie: "RPC com ID de outro tenant", alvo: "abrir_proximo_ciclo", persona: "coordA", operacao: "abre ciclo numa trilha que só a escola C usa, sem aluno nenhum",
    esperado: "negado", sql: `select public.abrir_proximo_ciclo($1, '2026-06-28')`, params: [TRILHA.T2], tabelas: ["trilhas", "trilha_semanas", "atividades_modelo"] });
  rpc({ id: "P.salvar_onboarding_aluno.coordenacao", superficie: "RPC com ID de outro tenant", alvo: "salvar_onboarding_aluno", persona: "coordA", operacao: "salvar_onboarding_aluno pela coordenação (só aluno salva o próprio)", esperado: "negado", sql: `select public.salvar_onboarding_aluno('x', 1, 'x', 'x')`, tabelas: ["aluno_onboarding"] });
  rpc({ id: "P.resumo_escola.coordA_so_A", superficie: "RPC com ID de outro tenant", alvo: "resumo_escola", persona: "coordA", operacao: "resumo_escola() da coordenação A não traz aluno da B", esperado: "negado", sql: `select 1 from public.resumo_escola() where aluno_id = any($1::uuid[])`, params: [[AL.B1, AL.B2, AL.C1, AL.S1]], tabelas: ["registros_estudo"], leitura: true });
  // funções do schema app com EXECUTE para authenticated. Alcançáveis
  // pela API SÓ se `app` estiver entre os schemas expostos do PostgREST
  // (premissa, não fato: ver camada HTTP). Aqui se prova o privilégio.
  const APP_FUNCS = [
    ["backfill_progresso", `select app.backfill_progresso($1)`, [ESC.B], ["aluno_eventos_progresso"], "escreve eventos de progresso da escola informada"],
    ["motor_avaliar_aluno", `select app.motor_avaliar_aluno($1)`, [AL.B1], ["aluno_eventos_progresso", "aluno_conquistas"], "avalia o aluno informado"],
    ["motor_conquista_xp", `select app.motor_conquista_xp($1, $2, 'cn', 'primeiro_registro')`, [ESC.B, AL.B1], ["aluno_eventos_progresso", "aluno_conquistas"], "concede conquista e XP ao aluno informado"],
    ["desbloquear_conquista_basica", `select app.desbloquear_conquista_basica($1, $2, 'cn', 'primeiro_registro')`, [ESC.B, AL.B1], ["aluno_conquistas"], "no-op desde a 0037"],
    ["exam_tag_do_aluno", `select app.exam_tag_do_aluno($1)`, [AL.B1], ["alunos"], "lê o concurso do aluno informado"],
    ["motor_streak_dias", `select app.motor_streak_dias($1)`, [AL.B1], ["registros_estudo"], "lê a sequência de dias do aluno informado"],
  ];
  for (const [fn, sql, params, tabelas, desc] of APP_FUNCS) {
    rpc({ id: `P.app.${fn}`, superficie: "função app com EXECUTE amplo", alvo: `app.${fn}`, persona: "coordA", operacao: `chama app.${fn} com ID da escola B (${desc})`, esperado: "negado", sql, params, tabelas });
  }


  // ═══ 6b. CENÁRIOS: o efeito da FK cruzada em OUTRA escola ═════
  // Cada um refaz um ataque ponta a ponta. `dano` é medido como postgres.
  cenario({ id: "X.exclusao_lgpd_apaga_conta_de_B.usuario_id", superficie: "cenário entre escolas", alvo: "lgpd_excluir", persona: "coordA",
    operacao: "aponta usuario_id do próprio aluno para a conta da coordenação B e pede a exclusão LGPD desse aluno",
    esperado: "negado", tabelas: ["usuarios", "alunos"],
    passos: [
      { persona: "coordA", sql: `update alunos set usuario_id = $1 where id = $2`, params: [U.coordB, AL.A2] },
      { persona: "servidor", sql: `select app.lgpd_excluir($1)`, params: [AL.A2], nota: "é o que lgpd-titular faz com service_role, depois de conferir que o aluno é da escola do chamador" },
    ],
    dano: { sql: `select not exists (select 1 from usuarios where id = $1) as ok`, params: [U.coordB], descricao: "a conta da coordenação B foi apagada" } });
  cenario({ id: "X.exclusao_lgpd_apaga_conta_de_B.vinculo", superficie: "cenário entre escolas", alvo: "lgpd_excluir", persona: "coordA",
    operacao: "liga a conta da coordenação B como responsável de um aluno próprio e pede a exclusão LGPD desse aluno",
    esperado: "negado", tabelas: ["usuarios", "vinculos_responsaveis"],
    passos: [
      { persona: "coordA", sql: `insert into vinculos_responsaveis (escola_id, responsavel_id, aluno_id) values ($1, $2, $3)`, params: [ESC.A, U.coordB, AL.A2] },
      { persona: "servidor", sql: `select app.lgpd_excluir($1)`, params: [AL.A2] },
    ],
    dano: { sql: `select not exists (select 1 from usuarios where id = $1) as ok`, params: [U.coordB], descricao: "a conta da coordenação B foi apagada" } });
  cenario({ id: "X.onboarding_de_B_lido_por_A", superficie: "cenário entre escolas", alvo: "aluno_onboarding", persona: "coordA",
    operacao: "planta o onboarding do aluno B1 na escola A e espera o B1 responder",
    esperado: "negado", tabelas: ["aluno_onboarding"],
    passos: [
      { persona: "coordA", sql: `insert into aluno_onboarding (aluno_id, escola_id) values ($1, $2)`, params: [AL.B1, ESC.A] },
      { persona: "alunoB1", sql: `select public.salvar_onboarding_aluno('nunca estudei', 12, 'geometria', 'passar no CN')` },
    ],
    dano: { sql: `select exists (select 1 from aluno_onboarding where aluno_id = $1 and escola_id = $2 and objetivo is not null) as ok`, params: [AL.B1, ESC.A], descricao: "as respostas do B1 ficaram numa linha da escola A (A lê, B não)" } });
  cenario({ id: "X.exportacao_lgpd_de_A_traz_turma_de_B", superficie: "cenário entre escolas", alvo: "lgpd_exportar", persona: "coordA",
    operacao: "matricula aluno próprio numa turma da B e exporta o dossiê LGPD desse aluno",
    esperado: "negado", tabelas: ["alunos_turmas"],
    passos: [
      { persona: "coordA", sql: `insert into alunos_turmas (escola_id, aluno_id, turma_id) values ($1, $2, $3)`, params: [ESC.A, AL.A2, R.turmaB] },
    ],
    dano: { sql: `select (app.lgpd_exportar($1)->'turmas') ? 'E2 Turma B' as ok`, params: [AL.A2], descricao: "o nome da turma da B saiu na exportação de um aluno da A" } });
  cenario({ id: "X.exportacao_lgpd_de_B_contaminada_por_A", superficie: "cenário entre escolas", alvo: "lgpd_exportar", persona: "coordA",
    operacao: "grava consentimento e log de acesso na A apontando para o B1; a B exporta o dossiê do próprio aluno",
    esperado: "negado", tabelas: ["consentimentos", "logs_acesso"],
    passos: [
      { persona: "coordA", sql: `insert into consentimentos (escola_id, aluno_id, responsavel_nome, registrado_por) values ($1, $2, 'plantado por A', $3)`, params: [ESC.A, AL.B1, U.coordA] },
      { persona: "coordA", sql: `insert into logs_acesso (escola_id, aluno_id, usuario_id, papel, acao) values ($1, $2, $3, 'coordenacao', 'plantado-por-A')`, params: [ESC.A, AL.B1, U.coordA] },
    ],
    dano: { sql: `select (select count(*) from jsonb_array_elements(d->'consentimentos') e where e->>'escola_id' = $2) + (select count(*) from jsonb_array_elements(d->'logs_acesso') e where e->>'escola_id' = $2) > 0 as ok from (select app.lgpd_exportar($1) as d) x`, params: [AL.B1, ESC.A], descricao: "linha da escola A apareceu no dossiê LGPD que a B gera do próprio aluno" } });
  cenario({ id: "X.controle_exclusao_lgpd_propria", superficie: "cenário entre escolas", alvo: "lgpd_excluir", persona: "coordA",
    operacao: "exclusão LGPD de um aluno próprio leva a conta dele e a do responsável exclusivo (controle)",
    esperado: "permitido", tabelas: ["usuarios", "alunos"],
    passos: [{ persona: "servidor", sql: `select app.lgpd_excluir($1)`, params: [AL.A1] }],
    dano: { sql: `select not exists (select 1 from usuarios where id = any($1::uuid[])) and exists (select 1 from usuarios where id = $2) as ok`, params: [[U.alunoA1, U.respA1], U.coordA], descricao: "saíram a conta do A1 e a do responsável exclusivo; a coordenação ficou" } });

  // ═══ 7. CLAIMS ANTIGAS E ESCOLA NÃO OPERACIONAL ═══════════════
  ler({ id: "J.rebaixada.le_alunos", superficie: "claims antigas", alvo: "alunos", persona: "coordRebaixada", operacao: "ex-coordenação (usuarios.papel = aluno) lê os alunos da A com as claims antigas", esperado: "permitido", sql: `select 1 from alunos where id = $1`, params: [AL.A2], tabelas: ["alunos"], nota: "janela do token: as policies leem o papel do JWT, não de usuarios. Vale até o access token expirar (3600 s no banco) e, se o app_metadata não for trocado no Auth, também depois do refresh" });
  add({ id: "J.rebaixada.cria_turma", superficie: "claims antigas", alvo: "turmas", persona: "coordRebaixada", operacao: "ex-coordenação cria turma com as claims antigas", esperado: "permitido", sql: `insert into turmas (escola_id, nome) values ($1, 'e2 da ex-coordenação')`, params: [ESC.A], tabelas: ["turmas"], nota: "mesma janela do caso acima" });

  const SUSP = [
    ["coordS", ESC.S, AL.S1, "suspensa", U.coordS, "alunoS1", R.metaS1], ["coordX", ESC.X, AL.X1, "cancelada", U.coordX, "alunoX1", null],
  ];
  for (const [persona, escola, aluno, estado, usuario, personaAluno, metaAluno] of SUSP) {
    ler({ id: `S.${estado}.le_alunos`, superficie: "escola não operacional", alvo: "alunos", persona, operacao: `coordenação de escola ${estado} lê alunos`, esperado: "negado", sql: `select 1 from alunos where escola_id = $1`, params: [escola], tabelas: ["alunos"] });
    add({ id: `S.${estado}.cria_turma`, superficie: "escola não operacional", alvo: "turmas", persona, operacao: `coordenação de escola ${estado} cria turma`, esperado: "negado", sql: `insert into turmas (escola_id, nome) values ($1, 'e2 ${estado}')`, params: [escola], tabelas: ["turmas"] });
    add({ id: `S.${estado}.reativa_escola`, superficie: "escola não operacional", alvo: "escolas", persona, operacao: `coordenação de escola ${estado} tenta se reativar`, esperado: "negado", sql: `update escolas set status = 'ativa' where id = $1`, params: [escola], tabelas: ["escolas"] });
    add({ id: `S.${estado}.config_escola`, superficie: "escola não operacional", alvo: "config_escola", persona, operacao: `coordenação de escola ${estado} grava configuração`, esperado: "negado", sql: `insert into config_escola (escola_id, exam_tag, chave, valor) values ($1, 'cn', 'e2-${estado}', '{}')`, params: [escola], tabelas: ["config_escola"] });
    add({ id: `S.${estado}.missoes_escola`, superficie: "escola não operacional", alvo: "missoes_escola", persona, operacao: `coordenação de escola ${estado} ativa missão`, esperado: "negado", sql: `insert into missoes_escola (escola_id, missao_id, ativa) values ($1, (select id from missoes where exam_tag = 'cn' order by id offset 2 limit 1), true)`, params: [escola], tabelas: ["missoes_escola"] });
    add({ id: `S.${estado}.logs_coordenacao`, superficie: "escola não operacional", alvo: "logs_coordenacao", persona, operacao: `coordenação de escola ${estado} grava log de coordenação`, esperado: "negado", sql: `insert into logs_coordenacao (escola_id, usuario_id, papel, acao) values ($1, $2, 'coordenacao', 'e2')`, params: [escola, usuario], tabelas: ["logs_coordenacao"] });
    rpc({ id: `S.${estado}.abrir_proximo_ciclo`, superficie: "escola não operacional", alvo: "abrir_proximo_ciclo", persona, operacao: `coordenação de escola ${estado} abre ciclo`, esperado: "negado", sql: `select public.abrir_proximo_ciclo($1, '2026-07-05')`, params: [TRILHA.T1], tabelas: ["trilhas"] });
    rpc({ id: `S.${estado}.resumo_escola`, superficie: "escola não operacional", alvo: "resumo_escola", persona, operacao: `resumo_escola() de escola ${estado}`, esperado: "negado", sql: `select 1 from public.resumo_escola()`, tabelas: ["registros_estudo"], leitura: true });
    if (aluno) {
      const GAM_S = [
        ["aluno_xp_eventos", `insert into aluno_xp_eventos (escola_id, aluno_id, exam_tag, origem, pontos) values ($1, $2, 'cn', 'ajuste_manual', 50)`],
        ["aluno_conquistas", `insert into aluno_conquistas (escola_id, aluno_id, conquista_id, exam_tag) values ($1, $2, (select id from conquistas order by id limit 1), 'cn')`],
        ["aluno_missoes", `insert into aluno_missoes (escola_id, aluno_id, missao_id, exam_tag, estado) values ($1, $2, (select id from missoes where exam_tag = 'cn' order by id limit 1), 'cn', 'concluida')`],
        ["aluno_niveis", `insert into aluno_niveis (escola_id, aluno_id, escopo, nivel, origem) values ($1, $2, 'geral', 'avancado', 'manual')`],
        ["aluno_onboarding", `insert into aluno_onboarding (escola_id, aluno_id, objetivo) values ($1, $2, 'x')`],
        ["aluno_eventos_progresso", `insert into aluno_eventos_progresso (escola_id, aluno_id, exam_tag, tipo_evento, origem, xp_delta, idempotency_key) values ($1, $2, 'cn', 'ajuste_coordenacao', 'e2', 50, 'e2-susp')`],
        ["consentimentos", `insert into consentimentos (escola_id, aluno_id, responsavel_nome, registrado_por) values ($1, $2, 'x', '${usuario}')`],
        ["vinculos_responsaveis", `insert into vinculos_responsaveis (escola_id, responsavel_id, aluno_id) values ($1, '${usuario}', $2)`],
      ];
      for (const [t, sql] of GAM_S) {
        add({ id: `S.${estado}.${t}`, superficie: "escola não operacional", alvo: t, persona, operacao: `coordenação de escola ${estado} escreve em ${t}`, esperado: "negado", sql, params: [escola, aluno], tabelas: t === "aluno_niveis" ? [t, "aluno_nivel_historico"] : [t] });
      }
      add({ id: `S.${estado}.aluno_registra`, superficie: "escola não operacional", alvo: "registros_estudo", persona: personaAluno, operacao: `aluno de escola ${estado} registra estudo`, esperado: "negado", sql: `insert into registros_estudo (escola_id, aluno_id, data, disciplina_codigo, questoes) values ($1, $2, '2026-01-07', 'mat', 5)`, params: [escola, aluno], tabelas: ["registros_estudo"] });
      if (metaAluno) ler({ id: `S.${estado}.aluno_le_metas`, superficie: "escola não operacional", alvo: "metas", persona: personaAluno, operacao: `aluno de escola ${estado} lê a própria meta`, esperado: "negado", sql: `select 1 from metas where id = $1`, params: [metaAluno], tabelas: ["metas"] });
      rpc({ id: `S.${estado}.aluno_onboarding_rpc`, superficie: "escola não operacional", alvo: "salvar_onboarding_aluno", persona: personaAluno, operacao: `aluno de escola ${estado} salva onboarding`, esperado: "negado", sql: `select public.salvar_onboarding_aluno('x', 1, 'x', 'x')`, tabelas: ["aluno_onboarding"] });
    }
  }
  // token com escola que não existe / sem escola: o fallback do C-S04
  rpc({ id: "S.fantasma.tenant_operacional", superficie: "escola não operacional", alvo: "app.tenant_operacional", persona: "coordFantasma", operacao: "tenant_operacional() com escola_id inexistente no token", esperado: "negado", sql: `select 1 where app.tenant_operacional()`, tabelas: ["escolas"], leitura: true, nota: "negado = a função responde false" });
  rpc({ id: "S.sem_escola.tenant_operacional", superficie: "escola não operacional", alvo: "app.tenant_operacional", persona: "coordSemEscola", operacao: "tenant_operacional() sem escola_id no token", esperado: "negado", sql: `select 1 where app.tenant_operacional()`, tabelas: ["escolas"], leitura: true, nota: "negado = a função responde false" });
  rpc({ id: "S.suspensa.tenant_operacional", superficie: "escola não operacional", alvo: "app.tenant_operacional", persona: "coordS", operacao: "tenant_operacional() da escola suspensa (controle do caminho que já funciona)", esperado: "negado", sql: `select 1 where app.tenant_operacional()`, tabelas: ["escolas"], leitura: true });
  ler({ id: "S.fantasma.le_catalogo", superficie: "escola não operacional", alvo: "trilhas", persona: "coordFantasma", operacao: "token com escola inexistente lê o catálogo", esperado: "permitido", sql: `select 1 from trilhas where id = $1`, params: [TRILHA.T1], tabelas: ["trilhas"], nota: "decisão registrada: o catálogo é global e publicado, não é dado de escola; as policies de leitura do catálogo são using (true) para authenticated. Negar aqui exigiria mudar ~20 policies sem ganho de isolamento" });
  rpc({ id: "S.fantasma.abrir_proximo_ciclo", superficie: "escola não operacional", alvo: "abrir_proximo_ciclo", persona: "coordFantasma", operacao: "token com escola inexistente abre ciclo", esperado: "negado", sql: `select public.abrir_proximo_ciclo($1, '2026-07-05')`, params: [TRILHA.T1], tabelas: ["trilhas"] });
  add({ id: "S.fantasma.cria_turma", superficie: "escola não operacional", alvo: "turmas", persona: "coordFantasma", operacao: "token com escola inexistente cria turma", esperado: "negado", sql: `insert into turmas (escola_id, nome) values ($1, 'e2 fantasma')`, params: [ESC.FANTASMA], tabelas: ["turmas"], vazioAceito: true, nota: "quem barra é a FK para escolas, não a policy: com tenant_operacional() = true para escola inexistente, a RLS deixaria passar (C-S04)" });

  // ═══ 8. ANÔNIMO ═══════════════════════════════════════════════
  for (const t of ["escolas", "usuarios", "alunos", "registros_estudo", "metas", "consentimentos", "vinculos_responsaveis", "internal_admins", "concursos", "trilhas", "vw_aluno_xp_total"]) {
    ler({ id: `N.${t}.ler`, superficie: "anônimo", alvo: t, persona: "anon", operacao: `SELECT sem login em ${t}`, esperado: "negado", sql: `select 1 from ${t} limit 1`, tabelas: [t === "vw_aluno_xp_total" ? "aluno_eventos_progresso" : t] });
  }
  add({ id: "N.registros.inserir", superficie: "anônimo", alvo: "registros_estudo", persona: "anon", operacao: "INSERT sem login", esperado: "negado", sql: `insert into registros_estudo (escola_id, aluno_id, data, disciplina_codigo, questoes) values ($1, $2, '2026-01-07', 'mat', 5)`, params: [ESC.A, AL.A1], tabelas: ["registros_estudo"] });
  add({ id: "N.escolas.alterar", superficie: "anônimo", alvo: "escolas", persona: "anon", operacao: "UPDATE sem login", esperado: "negado", sql: `update escolas set nome = 'x' where id = $1`, params: [ESC.A], tabelas: ["escolas"] });
  add({ id: "N.trilhas.inserir", superficie: "anônimo", alvo: "trilhas", persona: "anon", operacao: "INSERT no catálogo sem login", esperado: "negado", sql: CATALOGO[0][1], tabelas: ["trilhas"] });
  for (const [fn, sql] of [["abrir_proximo_ciclo", `select public.abrir_proximo_ciclo('${TRILHA.T1}', '2026-06-28')`], ["resumo_escola", `select 1 from public.resumo_escola()`], ["salvar_onboarding_aluno", `select public.salvar_onboarding_aluno('x', 1, 'x', 'x')`], ["sou_super_admin", `select public.sou_super_admin()`], ["app.tenant_operacional", `select app.tenant_operacional()`], ["app.backfill_progresso", `select app.backfill_progresso('${ESC.B}')`]]) {
    rpc({ id: `N.${fn}`, superficie: "anônimo", alvo: fn, persona: "anon", operacao: `${fn} sem login`, esperado: "negado", sql, tabelas: ["trilhas", "aluno_eventos_progresso"] });
  }

  // ids únicos
  const vistos = new Set();
  for (const c of casos) { if (vistos.has(c.id)) throw new Error(`id de caso repetido: ${c.id}`); vistos.add(c.id); }
  return casos;
}

// ── execução ──────────────────────────────────────────────────
function claimsDe(persona) {
  const p = PERSONAS[persona];
  if (p === undefined) throw new Error(`persona desconhecida: ${persona}`);
  if (p === null) return null;
  return JSON.stringify({ sub: p.sub, role: "authenticated", app_metadata: { escola_id: p.escola_id, papel: p.papel } });
}

async function assumir(c, persona) {
  const claims = claimsDe(persona);
  if (claims) {
    await c.query("select set_config('request.jwt.claims', $1, true)", [claims]);
    await c.query("set local role authenticated");
  } else {
    await c.query("select set_config('request.jwt.claims', '', true)");
    await c.query("set local role anon");
  }
}
async function soltar(c) {
  await c.query("reset role");
  await c.query("select set_config('request.jwt.claims', '', true)");
}

async function executarCenario(c, caso) {
  await c.query("savepoint caso");
  try {
    const tabelas = [...new Set(caso.tabelas)];
    const antes = await hashTabelas(c, tabelas);
    const passos = [];
    for (const p of caso.passos) {
      if (p.persona !== "servidor") await assumir(c, p.persona);
      await c.query("savepoint passo");
      try {
        const r = await c.query(p.sql, p.params ?? []);
        passos.push({ persona: p.persona, linhas: r.rowCount ?? r.rows.length });
      } catch (e) {
        await c.query("rollback to savepoint passo");
        passos.push({ persona: p.persona, erro: String(e.message ?? e).slice(0, 160) });
      }
      if (p.persona !== "servidor") await soltar(c);
    }
    const depois = await hashTabelas(c, tabelas);
    const dano = (await c.query(caso.dano.sql, caso.dano.params ?? [])).rows[0]?.ok === true;
    return {
      id: caso.id, camada: "banco", superficie: caso.superficie, alvo: caso.alvo, persona: caso.persona,
      operacao: caso.operacao, esperado: caso.esperado, observado: dano ? "permitido" : "negado",
      prova: { passos, dano: caso.dano.descricao, dano_confirmado: dano, tabelas_inalteradas: mesmoHash(antes, depois), integridade: "ok", hash_antes: antes, hash_depois: depois },
      ...(caso.nota ? { nota: caso.nota } : {}),
    };
  } finally {
    await c.query("rollback to savepoint caso");
  }
}

async function executarCaso(c, caso) {
  if (caso.tipo === "cenario") return executarCenario(c, caso);
  await c.query("savepoint caso");
  try {
    const tabelas = [...new Set(caso.tabelas)];
    const antes = await hashTabelas(c, tabelas);
    // Controle sem RLS: o MESMO comando, como postgres, afetaria linhas?
    // Se nem sem RLS ele faz nada, a negação da persona não prova
    // autorização: seria um caso vazio (alvo inexistente, dado inválido).
    let semRls = null;
    if (caso.tipo !== "rpc") {
      await c.query("savepoint ctl");
      try { const r = await c.query(caso.sql, caso.params ?? []); semRls = { linhas: r.rowCount ?? r.rows.length }; }
      catch (e) { semRls = { erro: String(e.message ?? e).slice(0, 160) }; }
      await c.query("rollback to savepoint ctl");
    }
    const claims = claimsDe(caso.persona);
    if (claims) {
      await c.query("select set_config('request.jwt.claims', $1, true)", [claims]);
      await c.query("set local role authenticated");
    } else {
      await c.query("select set_config('request.jwt.claims', '', true)");
      await c.query("set local role anon");
    }
    await c.query("savepoint op");
    let res = null; let erro = null;
    try { res = await c.query(caso.sql, caso.params ?? []); }
    catch (e) { erro = String(e.message ?? e); await c.query("rollback to savepoint op"); }
    await c.query("reset role");
    await c.query("select set_config('request.jwt.claims', '', true)");
    const depois = await hashTabelas(c, tabelas);
    let efeito = null;
    if (caso.efeito) {
      const r = await c.query(caso.efeito.sql, caso.efeito.params ?? []);
      efeito = r.rows[0]?.ok === true;
    }
    return classificar(caso, { res, erro, antes, depois, efeito, semRls });
  } finally {
    await c.query("rollback to savepoint caso");
  }
}

function classificar(caso, { res, erro, antes, depois, efeito, semRls }) {
  const inalterado = mesmoHash(antes, depois);
  const linhas = res ? (res.rowCount ?? res.rows.length) : 0;
  const leitura = caso.tipo === "leitura" || caso.leitura;
  let observado;
  let integridade = "ok";
  if (caso.efeito) {
    // o efeito descreve o estado que o caso quer ver no fim:
    // esperado negado → "o alvo protegido não mudou"; permitido → "a operação aconteceu"
    const aconteceu = caso.esperado === "negado" ? !efeito : efeito;
    observado = aconteceu && !erro ? "permitido" : "negado";
    if (erro && !inalterado) integridade = "EFEITO PARCIAL COM ERRO";
  } else if (leitura) {
    observado = !erro && res.rows.length > 0 ? "permitido" : "negado";
    if (!inalterado) integridade = "LEITURA ALTEROU DADO";
  } else if (caso.tipo === "escrita") {
    if (erro || linhas === 0) {
      observado = "negado";
      if (!inalterado) integridade = "EFEITO PARCIAL SEM RETORNO";
    } else {
      observado = "permitido";
      if (inalterado) integridade = "aceito sem mudar dado";
    }
  } else {
    observado = erro ? "negado" : "permitido";
    if (erro && !inalterado) integridade = "EFEITO PARCIAL COM ERRO";
  }
  // negação que não prova nada: sem RLS o comando também não faria nada.
  // Exceção legítima: sem RLS quem barra é a FK composta de escola (0055).
  // Aí são duas barreiras (RLS para a persona, FK para qualquer escritor).
  const barreiraFk = semRls?.erro && /mesma_escola_fkey/.test(semRls.erro);
  if (observado === "negado" && semRls && (semRls.erro || semRls.linhas === 0) && !caso.vazioAceito && !barreiraFk) {
    integridade = "CASO VAZIO: sem RLS o comando também não afetaria linha";
  }
  return {
    id: caso.id, camada: "banco", superficie: caso.superficie, alvo: caso.alvo, persona: caso.persona,
    operacao: caso.operacao, esperado: caso.esperado, observado,
    prova: {
      ...(erro ? { erro: erro.slice(0, 200) } : { linhas }),
      ...(semRls ? { sem_rls: semRls } : {}),
      ...(barreiraFk ? { barreira: "RLS para a persona e FK composta de escola para qualquer escritor" } : {}),
      ...(caso.efeito ? { efeito: caso.efeito.descricao, efeito_confirmado: efeito } : {}),
      tabelas_inalteradas: inalterado, integridade,
      hash_antes: antes, hash_depois: depois,
    },
    ...(caso.nota ? { nota: caso.nota } : {}),
  };
}

export async function executarMatriz(pool) {
  const cfg = pool.options;
  conferirAlvoLocal({ host: cfg.host, database: cfg.database });
  const c = await pool.connect();
  try {
    await c.query("begin isolation level repeatable read");
    await montarFixture(c);
    const casos = montarCasos();
    const resultados = [];
    for (const caso of casos) resultados.push(await executarCaso(c, caso));
    const versao = (await c.query("select current_setting('server_version') as v")).rows[0].v;
    return { resultados, postgres: versao };
  } finally {
    await c.query("rollback").catch(() => {});
    c.release();
  }
}

// ── camada HTTP: especificação para a Etapa 3 ────────────────
// Esta sessão não tem stack Supabase (Docker) nem rede para *.supabase.co.
// Cada caso abaixo é PENDENTE-E3: token real do Auth local, PostgREST e
// Edge Functions de verdade. PENDENTE não é seguro.
export const CASOS_HTTP = [
  { id: "H.postgrest.accept_profile_app", alvo: "PostgREST", persona: "anon", operacao: "GET /rest/v1/concursos com Accept-Profile: app", esperado: "406 PGRST106 listando só os schemas expostos (sem app)", motivo: "prova que as funções app.* com EXECUTE para authenticated não são alcançáveis pela API" },
  { id: "H.postgrest.rpc_app_backfill", alvo: "PostgREST", persona: "coordA", operacao: "POST /rest/v1/rpc/backfill_progresso com Content-Profile: app", esperado: "406 (schema não exposto)", motivo: "mesmo ponto, pelo caminho de escrita" },
  { id: "H.auth.login_por_persona", alvo: "Auth", persona: "todas", operacao: "login real de cada persona da matriz; claims app_metadata.escola_id/papel no token", esperado: "token com as claims da fixture", motivo: "a camada banco simula as claims; aqui elas precisam vir do Auth" },
  { id: "H.postgrest.matriz_tabelas", alvo: "PostgREST", persona: "coordA, alunoA1, respA1", operacao: "repetir por HTTP os casos T.*, A.*, R.* (GET/POST/PATCH/DELETE com Prefer: return=representation)", esperado: "mesmo esperado da camada banco; hash das tabelas conferido depois", motivo: "a RLS é a mesma, mas o corpo da requisição e o filtro vêm do cliente" },
  { id: "H.postgrest.upsert_on_conflict", alvo: "PostgREST", persona: "coordA", operacao: "POST com Prefer: resolution=merge-duplicates usando id da B", esperado: "401/403 ou 0 linhas, sem mudar a linha da B", motivo: "UPSERT pela API usa o mesmo caminho do caso T.*.upsert_id_B" },
  { id: "H.edge.escola_parada", alvo: "gerar-meta, lgpd-titular, provisionar-aluno, revogar-responsavel", persona: "coordS, coordX", operacao: "POST com sessão válida da coordenação de escola suspensa e cancelada", esperado: "403 escola_nao_operacional, sem efeito (depois do redeploy do #145)", motivo: "a chave de serviço ignora a RLS: sem o porteiro, a suspensão não valia nas Edge Functions (Fatia 7)" },
  { id: "H.edge.sem_bearer", alvo: "Edge Functions (7)", persona: "anon", operacao: "POST sem Authorization em cada função de produto", esperado: "401, sem efeito", motivo: "verify_jwt=false nas 7: a checagem é do código" },
  { id: "H.edge.bearer_malformado", alvo: "Edge Functions (7)", persona: "anon", operacao: "POST com Authorization: Bearer abc", esperado: "401, sem efeito e sem detalhe interno", motivo: "idem" },
  { id: "H.edge.token_expirado", alvo: "Edge Functions (7)", persona: "coordA", operacao: "POST com access token expirado", esperado: "401", motivo: "idem" },
  { id: "H.edge.outro_tenant", alvo: "provisionar-aluno, gerar-meta, lgpd-titular, revogar-responsavel, backoffice-coordenador", persona: "coordA", operacao: "payload com aluno/vínculo/escola da B", esperado: "403/404 sem efeito", motivo: "identidade tem que vir do token, não do payload" },
  { id: "H.edge.metodo_errado", alvo: "Edge Functions (7)", persona: "anon", operacao: "GET/PUT/DELETE", esperado: "405", motivo: "idem" },
  { id: "H.edge.options_cors", alvo: "Edge Functions (7)", persona: "anon", operacao: "OPTIONS com Origin permitida, localhost e origem arbitrária", esperado: "cabeçalhos CORS só para a permitida", motivo: "C-S02" },
  { id: "H.auth.sessao_revogada", alvo: "Auth + PostgREST", persona: "respRevogado", operacao: "usar o access token de antes da revogação e depois o refresh", esperado: "leitura do aluno negada já (vínculo); refresh: comportamento a registrar", motivo: "claims antigas: a camada banco mostra só a parte que depende do vínculo" },
  { id: "H.auth.refresh_reemite_claims", alvo: "Auth", persona: "coordRebaixada", operacao: "trocar usuarios.papel e fazer refresh do token", esperado: "registrar se o token novo ainda diz coordenacao (app_metadata não muda com usuarios)", motivo: "decide se a janela é 3600 s ou indefinida" },
  { id: "H.auth.login_codigo_limite", alvo: "login por código", persona: "anon", operacao: "tentativas repetidas e código inexistente no fluxo real", esperado: "limite e resposta anti-enumeração", motivo: "complemento G, fatia 7" },
];

// ── CLI: gera a evidência ─────────────────────────────────────
const souPrincipal = process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (souPrincipal && process.argv.includes("--gerar")) {
  const raiz = resolve(dirname(fileURLToPath(import.meta.url)), "..");
  const pool = new pg.Pool({
    host: process.env.PGHOST || "127.0.0.1", port: +(process.env.PGPORT || 54322),
    user: process.env.PGUSER || "postgres", database: process.env.PGDATABASE || "rumo_teste",
    password: process.env.PGPASSWORD || undefined,
  });
  const { ACHADOS_ABERTOS } = await import("./matriz-autorizacao-achados.mjs");
  const { resultados, postgres } = await executarMatriz(pool);
  await pool.end();
  const sha = (() => { try { return execFileSync("git", ["rev-parse", "HEAD"], { cwd: raiz }).toString().trim(); } catch { return null; } })();
  const comAchado = resultados.map((r) => (ACHADOS_ABERTOS[r.id] ? { ...r, achado: ACHADOS_ABERTOS[r.id].achado } : r));
  const divergentes = comAchado.filter((r) => r.esperado !== r.observado);
  const placar = {
    camada_banco: { casos: resultados.length, conforme: resultados.length - divergentes.length, divergentes: divergentes.length, divergentes_registrados: divergentes.filter((r) => r.achado).length },
    camada_http: { casos: CASOS_HTTP.length, provados: 0, pendente_e3: CASOS_HTTP.length },
  };
  const saida = {
    gerado_em: new Date().toISOString(), sha, postgres_local: postgres, postgres_hospedado: "17.6 (demo e produção)",
    nota_versao: "a camada banco roda no Postgres local; os projetos hospedados estão no 17.6. RLS, SECURITY DEFINER e grants usados aqui não mudaram entre 16 e 17.",
    placar, personas: DESCRICAO_PERSONAS, achados: ACHADOS_ABERTOS,
    casos: comAchado,
    camada_http: CASOS_HTTP.map((h) => ({ ...h, camada: "http", observado: "PENDENTE-E3" })),
  };
  const destino = resolve(raiz, "docs/evidencias/e2-matriz-autorizacao.json");
  mkdirSync(dirname(destino), { recursive: true });
  writeFileSync(destino, `${JSON.stringify(saida, null, 2)}\n`);
  console.log(`matriz: ${resultados.length} casos na camada banco (${placar.camada_banco.conforme} conformes, ${divergentes.length} divergentes), ${CASOS_HTTP.length} PENDENTE-E3 → ${destino}`);
}
