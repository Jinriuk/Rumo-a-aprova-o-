// ============================================================
// ETAPA 3 — jornadas obrigatórias do E2E e o mínimo de cada uma
// ------------------------------------------------------------
// Fonte única do relatório (scripts/e2e/relatorio-jornadas.mjs). Cada
// teste de uma jornada leva a tag @j:<id>; os que contam para o mínimo
// levam também @critica. O mínimo é o número de testes críticos que a
// jornada tem hoje: se um spec some, é renomeado sem a tag, ou passa a
// ser pulado, a execução fica abaixo do mínimo e o job reprova.
// Subir o mínimo é parte de acrescentar teste; baixar exige dizer por quê
// no PR.
// ============================================================
export const JORNADAS = [
  { id: "auth", nome: "Autenticação (login válido/inválido, troca obrigatória, recuperação, logout, refresh, sessão expirada)", minimo: 8 },
  { id: "aluno", nome: "Aluno (Hoje, trilha, metas, registro, simulado, persistência)", minimo: 8 },
  { id: "coordenacao", nome: "Coordenação (turma, aluno, credencial, vínculo, meta, progresso)", minimo: 6 },
  { id: "responsavel", nome: "Responsável (só o vinculado, sem edição, revogação)", minimo: 3 },
  { id: "super_admin", nome: "Super admin (cria escola, provisiona coordenação, status, usuário comum negado)", minimo: 4 },
  { id: "ciclo", nome: "Motor de ciclo (virada, encerramento, próximo ciclo; datas e fuso controlados)", minimo: 5 },
  { id: "concorrencia", nome: "Duplo clique, duas abas e falha de API", minimo: 4 },
  { id: "mobile", nome: "Mobile", minimo: 4 },
  { id: "privacidade", nome: "Privacidade (exportar e apagar dados sintéticos)", minimo: 2 },
  { id: "limites_acesso", nome: "Limites de acesso (15 casos da camada_http)", minimo: 16 },
];
