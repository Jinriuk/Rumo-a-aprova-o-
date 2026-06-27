/* ============================================================
   MATURIDADE DE CONTEÚDO POR CONCURSO (PED2)
   ------------------------------------------------------------
   FONTE ÚNICA da matriz de maturidade. Leem ESTE arquivo:
     • a UI (selo, gating de trilha incompleta),
     • o validador de conteúdo (scripts/validar-conteudo.mjs),
     • o gerador do seed (scripts/gerar-seed-maturidade.mjs),
     • os testes de integridade (tests/conteudo-maturidade.test.mjs).

   Mudou a maturidade de um concurso? Edite AQUI, rode o gerador
   (`node scripts/gerar-seed-maturidade.mjs`) e o validador
   (`node scripts/validar-conteudo.mjs`). Nunca marque "completa"
   direto no banco — o banco é espelho auditável desta matriz.

   Níveis (do mais pronto ao menos), regra de produto:
     completa     → trilha SEMANAL real (calendário) + estrutura de
                    prova oficial. PODE ser exibida/vendida como pronta.
     beta         → estrutura de prova oficial + assuntos/missões, mas
                    SEM calendário semanal fechado. Usável COM aviso;
                    nunca anunciada como pronta.
     esqueleto    → só a estrutura da prova (matérias/pesos) e poucas
                    missões; sem assuntos catalogados nem calendário.
                    NÃO exibir como pronta — aceita aluno, mas avisa.
     indisponivel → sem conteúdo suficiente; NÃO oferecer ao aluno.

   `requisitos` documenta o que cada nível exige — o validador usa
   isso para impedir que a matriz minta sobre o conteúdo real.
   ============================================================ */

export const NIVEIS_MATURIDADE = ["completa", "beta", "esqueleto", "indisponivel"];

// Apresentação por nível: rótulo, tom (reusa StatusBadge) e regra de UI.
export const APRESENTACAO_MATURIDADE = {
  completa: {
    rotulo: "Completa",
    tom: "ok",
    podeExibirComoPronta: true,
    aceitaAluno: true,
    temTrilhaSemanal: true,
    descricao: "Trilha semanal e estrutura de prova prontas e testadas.",
  },
  beta: {
    rotulo: "Beta",
    tom: "alerta",
    podeExibirComoPronta: false,
    aceitaAluno: true,
    temTrilhaSemanal: false,
    descricao: "Estrutura e missões prontas; calendário semanal ainda em construção.",
  },
  esqueleto: {
    rotulo: "Esqueleto",
    tom: "risco",
    podeExibirComoPronta: false,
    aceitaAluno: true,
    temTrilhaSemanal: false,
    descricao: "Só a estrutura da prova. Conteúdo de estudo ainda não montado.",
  },
  indisponivel: {
    rotulo: "Indisponível",
    tom: "neutro",
    podeExibirComoPronta: false,
    aceitaAluno: false,
    temTrilhaSemanal: false,
    descricao: "Sem conteúdo suficiente para receber alunos.",
  },
};

// Requisitos MÍNIMOS de cada nível (checados pelo validador contra os
// seeds reais). Subir um concurso de nível exige cumprir o requisito.
export const REQUISITOS_MATURIDADE = {
  completa:     { provaOficial: true, assuntos: true, trilhaSemanal: true },
  beta:         { provaOficial: true, assuntos: true, trilhaSemanal: false },
  esqueleto:    { provaOficial: true, assuntos: false, trilhaSemanal: false },
  indisponivel: { provaOficial: false, assuntos: false, trilhaSemanal: false },
};

// ------------------------------------------------------------
// A MATRIZ. `versao` é a versão do conteúdo daquele concurso (sobe
// quando o conteúdo muda de forma relevante). `nota` justifica o
// nível para auditoria. `trilhaSemanalRef` aponta o seed da trilha
// semanal quando há uma (hoje, só o CN).
// ------------------------------------------------------------
export const MATURIDADE_CONCURSOS = {
  cn: {
    codigo: "cn",
    maturidade: "completa",
    versao: 1,
    trilhaSemanalRef: "supabase/seed/02_trilha_cn.sql",
    nota: "9 semanas, 33 atividades-modelo, estrutura de prova oficial e missões. Testado de ponta a ponta.",
  },
  espcex: {
    codigo: "espcex",
    maturidade: "beta",
    versao: 1,
    trilhaSemanalRef: null,
    nota: "Estrutura de prova oficial (2 dias, pesos), assuntos de Matemática/Português/Química e missões. Falta calendário semanal.",
  },
  epcar: {
    codigo: "epcar",
    maturidade: "esqueleto",
    versao: 1,
    trilhaSemanalRef: null,
    nota: "Estrutura de prova oficial e 1 missão de redação. Sem assuntos catalogados nem calendário.",
  },
  esa: {
    codigo: "esa",
    maturidade: "esqueleto",
    versao: 1,
    trilhaSemanalRef: null,
    nota: "Estrutura de prova oficial (4 partes) e 1 missão de inglês. Sem assuntos catalogados nem calendário.",
  },
  eear: {
    codigo: "eear",
    maturidade: "esqueleto",
    versao: 1,
    trilhaSemanalRef: null,
    nota: "Estrutura de prova oficial (96 questões) e 1 missão de física. Sem assuntos catalogados nem calendário.",
  },
  cm: {
    codigo: "cm",
    maturidade: "indisponivel",
    versao: 0,
    trilhaSemanalRef: null,
    nota: "Apenas cadastrado em concursos. Sem prova, assuntos, missões ou trilha. Não receber alunos.",
  },
};

// ------------------------------------------------------------
// Helpers (puros — sem React, sem DB).
// ------------------------------------------------------------

// Maturidade de um concurso pelo código. Default conservador:
// concurso desconhecido → 'indisponivel' (nunca finge estar pronto).
export function maturidadeDe(codigo) {
  return MATURIDADE_CONCURSOS[codigo]?.maturidade ?? "indisponivel";
}

export function infoMaturidade(codigo) {
  const nivel = maturidadeDe(codigo);
  return { ...APRESENTACAO_MATURIDADE[nivel], maturidade: nivel, ...MATURIDADE_CONCURSOS[codigo] };
}

export function rotuloMaturidade(codigo) {
  return APRESENTACAO_MATURIDADE[maturidadeDe(codigo)].rotulo;
}

// Só concurso COMPLETO pode ser exibido/vendido como pronto.
export function podeExibirComoPronto(codigo) {
  return APRESENTACAO_MATURIDADE[maturidadeDe(codigo)].podeExibirComoPronta;
}

// Concurso aceita aluno? 'indisponivel' não.
export function aceitaAluno(codigo) {
  return APRESENTACAO_MATURIDADE[maturidadeDe(codigo)].aceitaAluno;
}

// A trilha semanal (calendário real, ex.: CN) só deve ser atribuída a
// um aluno quando o concurso dele é COMPLETO. Caso contrário o aluno
// herdaria, por engano, o calendário de OUTRO concurso (o do CN).
export function podeAtribuirTrilhaSemanal(codigo) {
  return APRESENTACAO_MATURIDADE[maturidadeDe(codigo)].temTrilhaSemanal;
}
