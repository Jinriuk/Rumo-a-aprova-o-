// Lista versionada: pares de tabelas ligados por MAIS DE UMA FK.
// ------------------------------------------------------------------------
// Em par assim, embed do PostgREST sem hint volta HTTP 300 (PGRST201,
// "more than one relationship was found"). Foi o que derrubou painel da
// coordenação, ficha do aluno, tela do aluno e área do responsável em
// 25/09/2026, depois da 0055.
//
// Quem mantém: `embeds-ambiguos-db.test.mjs` compara esta lista com o
// pg_constraint do banco que as migrations produzem e reprova qualquer
// diferença. `embeds-ambiguos.test.mjs` reprova embed sem hint (ou com hint
// que não é uma destas FKs) em qualquer par daqui.
//
// Migração nova que duplicar FK: o teste de banco reprova, você acrescenta
// o par aqui, e o teste estático aponta cada embed que precisa de hint.
//
// Formato: par sem ordem (as duas tabelas em ordem alfabética, como em
// `chavePar`), com os nomes das FKs em ordem alfabética. O PostgREST
// enxerga a relação nos dois sentidos, então a direção não importa aqui.

export const PARES_COM_FKS_MULTIPLAS = [
  // 0055: FK simples (pai_id) + FK composta (pai_id, escola_id) "_mesma_escola_".
  { par: ["aluno_conquistas", "alunos"], fks: ["aluno_conquistas_aluno_id_fkey", "aluno_conquistas_aluno_mesma_escola_fkey"] },
  { par: ["aluno_eventos_progresso", "alunos"], fks: ["aluno_eventos_progresso_aluno_id_fkey", "aluno_eventos_progresso_aluno_mesma_escola_fkey"] },
  { par: ["aluno_missoes", "alunos"], fks: ["aluno_missoes_aluno_id_fkey", "aluno_missoes_aluno_mesma_escola_fkey"] },
  { par: ["aluno_niveis", "alunos"], fks: ["aluno_niveis_aluno_id_fkey", "aluno_niveis_aluno_mesma_escola_fkey"] },
  { par: ["aluno_onboarding", "alunos"], fks: ["aluno_onboarding_aluno_id_fkey", "aluno_onboarding_aluno_mesma_escola_fkey"] },
  { par: ["aluno_xp_eventos", "alunos"], fks: ["aluno_xp_eventos_aluno_id_fkey", "aluno_xp_eventos_aluno_mesma_escola_fkey"] },
  { par: ["alunos", "alunos_turmas"], fks: ["alunos_turmas_aluno_id_fkey", "alunos_turmas_aluno_mesma_escola_fkey"] },
  { par: ["alunos", "consentimentos"], fks: ["consentimentos_aluno_id_fkey", "consentimentos_aluno_mesma_escola_fkey"] },
  { par: ["alunos", "metas"], fks: ["metas_aluno_id_fkey", "metas_aluno_mesma_escola_fkey"] },
  { par: ["alunos", "registros_estudo"], fks: ["registros_estudo_aluno_id_fkey", "registros_estudo_aluno_mesma_escola_fkey"] },
  { par: ["alunos", "simulados"], fks: ["simulados_aluno_id_fkey", "simulados_aluno_mesma_escola_fkey"] },
  { par: ["alunos", "usuarios"], fks: ["alunos_usuario_id_fkey", "alunos_usuario_mesma_escola_fkey"] },
  { par: ["alunos", "vinculos_responsaveis"], fks: ["vinculos_aluno_mesma_escola_fkey", "vinculos_responsaveis_aluno_id_fkey"] },
  { par: ["alunos_turmas", "turmas"], fks: ["alunos_turmas_turma_id_fkey", "alunos_turmas_turma_mesma_escola_fkey"] },
  { par: ["meta_atividades", "metas"], fks: ["meta_atividades_meta_id_fkey", "meta_atividades_meta_mesma_escola_fkey"] },
  { par: ["usuarios", "vinculos_responsaveis"], fks: ["vinculos_responsaveis_responsavel_id_fkey", "vinculos_responsavel_mesma_escola_fkey"] },

  // concurso principal (0007) e secundário (0011). São DUAS relações de verdade,
  // não redundância: embed de concursos a partir de alunos sempre precisa
  // dizer qual das duas quer.
  { par: ["alunos", "concursos"], fks: ["alunos_concurso_id_fkey", "alunos_concurso_secundario_id_fkey"] },
];
