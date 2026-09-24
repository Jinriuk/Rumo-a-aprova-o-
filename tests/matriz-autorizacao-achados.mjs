// ============================================================
// Achados abertos da matriz de autorização (Etapa 2)
// ------------------------------------------------------------
// Todo caso cujo observado difere do esperado PRECISA estar aqui, com o
// achado e a migration que o corrige. O teste
// (e2-matriz-autorizacao-db.test.mjs) exige, para cada entrada:
//   • se `corrigidoPor` é null, ou o arquivo
//     supabase/migrations/<corrigidoPor>.sql ainda NÃO existe no repo:
//     o caso tem que continuar divergindo (o furo segue aberto e
//     nomeado; se parar de divergir, o registro está velho);
//   • se o arquivo existe: o caso tem que bater com o esperado.
// Assim a ordem de merge entre o PR da matriz e os PRs de correção não
// importa, e nenhum achado sai daqui sem a correção junto.
//
// Não é lista de exceção para ficar verde: é o placar do que está
// aberto, lido também pelo gerador da evidência.
// ============================================================

const XT = {
  achado: "E2-XT-FK",
  descricao: "FK cruzada: a linha é da escola do chamador, o pai (aluno, turma, meta, conta) é de outra escola. Leva à exclusão de conta e à leitura entre escolas (cenários X.*).",
  corrigidoPor: "0055_coerencia_tenant",
  pr: "#138",
};
const CS04_FALLBACK = {
  achado: "C-S04",
  descricao: "app.tenant_operacional() responde operacional quando a escola do token não existe ou está ausente.",
  corrigidoPor: "0056_tenant_operacional_nega_por_padrao",
};
const CS04_COBERTURA = {
  achado: "C-S04b",
  descricao: "A 0027 bloqueou escola suspensa/cancelada só em parte das policies: a coordenação ainda escreve em configuração, missões, gamificação, onboarding e log.",
  corrigidoPor: "0056_tenant_operacional_nega_por_padrao",
};
const CS06_APP = {
  achado: "C-S06",
  descricao: "Função interna do schema app, SECURITY DEFINER, com EXECUTE para authenticated (e PUBLIC) e parâmetro de escola/aluno. Só é alcançável pela API se `app` estiver entre os schemas expostos (não verificado por HTTP nesta sessão).",
  corrigidoPor: "0057_revoga_execute_funcoes_internas",
};
const E1_ACHADO_2 = {
  achado: "E1-ACHADO-2",
  descricao: "abrir_proximo_ciclo cria edição no catálogo global mesmo sem aluno a mover; aqui, para uma trilha que só outra escola usa. Já registrado em docs/e1-migrations.md como aberto; trava correta depende de decisão de produto (dono por escola no catálogo).",
  corrigidoPor: null,
};

export const ACHADOS_ABERTOS = {
  // FK cruzada (linha) e os cenários que ela abre
  "T.alunos.fk_usuario_B": XT,
  "T.alunos_turmas.fk_aluno_B": XT,
  "T.alunos_turmas.fk_turma_B": XT,
  "T.vinculos.fk_aluno_B": XT,
  "T.vinculos.fk_responsavel_B": XT,
  "T.consentimentos.fk_aluno_B": XT,
  "T.logs_acesso.fk_aluno_B": XT,
  "T.aluno_xp_eventos.fk_aluno_B": XT,
  "T.aluno_conquistas.fk_aluno_B": XT,
  "T.aluno_missoes.fk_aluno_B": XT,
  "T.aluno_niveis.fk_aluno_B": XT,
  "T.aluno_onboarding.fk_aluno_B": XT,
  "T.aluno_eventos_progresso.fk_aluno_B": XT,
  "X.exclusao_lgpd_apaga_conta_de_B.usuario_id": XT,
  "X.exclusao_lgpd_apaga_conta_de_B.vinculo": XT,
  "X.onboarding_de_B_lido_por_A": XT,
  "X.exportacao_lgpd_de_A_traz_turma_de_B": XT,
  "X.exportacao_lgpd_de_B_contaminada_por_A": XT,

  // C-S04: fallback e cobertura da suspensão
  "S.fantasma.tenant_operacional": CS04_FALLBACK,
  "S.sem_escola.tenant_operacional": CS04_FALLBACK,
  "S.suspensa.config_escola": CS04_COBERTURA,
  "S.suspensa.missoes_escola": CS04_COBERTURA,
  "S.suspensa.logs_coordenacao": CS04_COBERTURA,
  "S.suspensa.aluno_xp_eventos": CS04_COBERTURA,
  "S.suspensa.aluno_conquistas": CS04_COBERTURA,
  "S.suspensa.aluno_missoes": CS04_COBERTURA,
  "S.suspensa.aluno_niveis": CS04_COBERTURA,
  "S.suspensa.aluno_onboarding": CS04_COBERTURA,
  "S.suspensa.aluno_eventos_progresso": CS04_COBERTURA,
  "S.cancelada.config_escola": CS04_COBERTURA,
  "S.cancelada.missoes_escola": CS04_COBERTURA,
  "S.cancelada.logs_coordenacao": CS04_COBERTURA,
  "S.cancelada.aluno_xp_eventos": CS04_COBERTURA,
  "S.cancelada.aluno_conquistas": CS04_COBERTURA,
  "S.cancelada.aluno_missoes": CS04_COBERTURA,
  "S.cancelada.aluno_niveis": CS04_COBERTURA,
  "S.cancelada.aluno_onboarding": CS04_COBERTURA,
  "S.cancelada.aluno_eventos_progresso": CS04_COBERTURA,

  // C-S06: funções internas com EXECUTE amplo
  "P.app.backfill_progresso": CS06_APP,
  "P.app.motor_avaliar_aluno": CS06_APP,
  "P.app.motor_conquista_xp": CS06_APP,
  "P.app.desbloquear_conquista_basica": CS06_APP,
  "P.app.exam_tag_do_aluno": CS06_APP,
  "P.app.motor_streak_dias": CS06_APP,

  // edição órfã no catálogo compartilhado (já aberto desde a E1)
  "P.abrir_proximo_ciclo.trilha_de_C": E1_ACHADO_2,
};
