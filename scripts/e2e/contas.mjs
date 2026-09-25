// ============================================================
// ETAPA 3 — contas da fixture do E2E local (fonte única)
// ------------------------------------------------------------
// Quem usa: scripts/e2e/semear.mjs (cria no Auth local) e os specs
// (app/e2e). Nada aqui vale fora da stack local: a senha abaixo só
// existe no Auth descartável que sobe no runner (a trava recusa
// qualquer destino que não seja local). Não é segredo e não é senha
// de ninguém.
//
// Dois grupos:
//   • UI: as contas do seed 01 (Vitrine = escola A, Beta = escola B),
//     com os MESMOS ids, mais contas dedicadas às jornadas que mudam
//     senha (troca obrigatória, recuperação), para uma jornada não
//     quebrar a outra;
//   • MATRIZ: as personas de tests/matriz-autorizacao.mjs (os 15 casos
//     da camada_http), com os ids da fixture da matriz.
// ============================================================
import { U, ESC, PERSONAS } from "../../tests/matriz-autorizacao.mjs";

export const SENHA_E2E = "e2e-local-Triliva-2026";
export const SENHA_NOVA_E2E = "e2e-local-Nova-2026";

const VITRINE = "11111111-1111-4111-8111-111111111111";
const BETA = "22222222-2222-4222-8222-222222222222";
const emailCodigo = (codigo) => `${codigo.toLowerCase()}@codigo.acesso.local`;

export const CONTAS = {
  coordVitrine: { id: "aaaaaaaa-0000-4000-8000-000000000001", email: "coordenacao@vitrine.demo", escola: VITRINE, papel: "coordenacao", nome: "Coordenação Vitrine" },
  coordBeta: { id: "bbbbbbbb-0000-4000-8000-000000000001", email: "coordenacao@beta.demo", escola: BETA, papel: "coordenacao", nome: "Coordenação Beta" },
  lucas: { id: "aaaaaaaa-0000-4000-8000-000000000002", codigo: "LUCASDEMO2026", escola: VITRINE, papel: "aluno", nome: "Lucas", alunoId: "a0000000-0000-4000-8000-000000000001" },
  respLucas: { id: "aaaaaaaa-0000-4000-8000-000000000003", codigo: "RESPDEMO2026X", escola: VITRINE, papel: "responsavel", nome: "Responsável do Lucas" },
  bruno: { id: "bbbbbbbb-0000-4000-8000-000000000002", codigo: "BRUNODEMO2026", escola: BETA, papel: "aluno", nome: "Bruno", alunoId: "b0000000-0000-4000-8000-000000000001" },
  respBruno: { id: "bbbbbbbb-0000-4000-8000-000000000003", codigo: "RESPBETA2026XX", escola: BETA, papel: "responsavel", nome: "Responsável do Bruno" },
  // aluna da vitrine (seed 13) que entra exigindo troca de senha
  alunaTroca: { id: "aaaaaaaa-1111-4111-8111-000000000002", codigo: "E2ETROCA2026X", escola: VITRINE, papel: "aluno", nome: "Maria Eduarda Santana", trocaObrigatoria: true },
  // coordenação extra da vitrine só para a recuperação por e-mail
  coordRecuperacao: { id: "e3000000-0000-4000-8000-000000000001", email: "recuperacao@vitrine.e2e.local", escola: VITRINE, papel: "coordenacao", nome: "E2E Coordenação Recuperação", criarUsuario: true },
  // super admin do backoffice (linha em internal_admins vem da fixture da matriz)
  superAdmin: { id: U.superAdmin, email: "e2-sa@teste.local", escola: null, papel: "super_admin", nome: "E2 SA" },
};
for (const c of Object.values(CONTAS)) if (c.codigo) c.email = emailCodigo(c.codigo);

// Personas da matriz com login real (H.auth.login_por_persona). coordSemEscola
// é o coordA com claim nula (só existe simulada na camada banco).
export const PERSONAS_HTTP = Object.fromEntries(
  Object.entries(PERSONAS)
    .filter(([nome, p]) => p && nome !== "coordSemEscola" && nome !== "superAdmin")
    .map(([nome, p]) => [nome, {
      id: p.sub, email: `e2-${nome.toLowerCase()}@teste.local`, escola: p.escola_id, papel: p.papel, nome: `E2 ${nome}`,
    }]),
);
PERSONAS_HTTP.superAdmin = CONTAS.superAdmin;

export { ESC, U };
