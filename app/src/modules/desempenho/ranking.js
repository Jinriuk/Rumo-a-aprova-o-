/* Ranking de estudo — FONTE ÚNICA para o pódio do Painel de gestão e
   para o Ranking da coordenação (D05, Bloco 3, 23/09/2026).

   Com o mesmo critério ("Melhor acerto") e a mesma janela (7 dias), as
   duas telas davam pódios diferentes: o painel aceitava quem tivesse
   qualquer questão no ciclo e desempatava pelo volume do ciclo; o
   Ranking cortava quem não chegou ao piso de volume na janela. Nas
   capturas de 19/09 o painel punha o Gustavo (18 questões) em 3º e o
   Ranking, o Rafael (69%, 59 questões). Agora as duas chamam isto.

   T34/T35 (preservados daqui): um aluno com 2 questões e 100% não é
   "melhor" que um com 80 e 85% — é só pouco dado. Quem não chega a
   LIMIAR.VOLUME_MINIMO questões na janela fica fora da lista numerada,
   ordenado por nome, nunca pelo critério. */
import { LIMIAR } from "../conteudo/niveisAluno.js";

export const CRITERIOS_ESTUDO = {
  questoes: { rotulo: "Questões", v: (r) => r.q },
  acerto: { rotulo: "% acerto", v: (r) => r.acc ?? -1 },
  tempo: { rotulo: "Tempo", v: (r) => r.minutos },
  dias: { rotulo: "Dias", v: (r) => r.dias },
};

// Uma linha do ranking na janela pedida ("semana" = últimos 7 dias,
// "geral" = ciclo). `r` é a linha de resumo_escola já adaptada
// (adaptarResumoEscola); sem resumo, o aluno entra zerado.
export function linhaDeEstudo(aluno, r, janela = "semana") {
  const geral = janela === "geral";
  return {
    aluno,
    q: r ? (geral ? r.q : r.qSem) : 0,
    minutos: r ? (geral ? r.minutos : r.minSem) : 0,
    dias: r ? (geral ? r.dias : r.diasSem) : 0,
    acc: r ? (geral ? r.acc : r.accSem) : null,
    metaPct: r?.metaPct ?? null,
    feitas: r?.feitas ?? 0,
    consideradas: r?.consideradas ?? 0,
  };
}

// Desempate: critério → volume → acerto → tempo → nome. O nome no fim
// torna a ordem total: duas telas com a mesma entrada em ordens
// diferentes dão o mesmo pódio.
export function classificarEstudo(linhas, criterio) {
  const c = CRITERIOS_ESTUDO[criterio] ?? CRITERIOS_ESTUDO.acerto;
  const comparaveis = linhas
    .filter((x) => x.q >= LIMIAR.VOLUME_MINIMO)
    .sort((x, y) => (c.v(y) - c.v(x)) || (y.q - x.q) || ((y.acc ?? -1) - (x.acc ?? -1))
      || (y.minutos - x.minutos) || x.aluno.nome.localeCompare(y.aluno.nome, "pt-BR"));
  const semDadosSuficientes = linhas
    .filter((x) => x.q < LIMIAR.VOLUME_MINIMO)
    .sort((x, y) => x.aluno.nome.localeCompare(y.aluno.nome, "pt-BR"));
  return { comparaveis, semDadosSuficientes };
}

// O pódio do painel: os 3 primeiros do Ranking na janela de 7 dias.
export function podioDaSemana(resumo, criterio) {
  const linhas = (resumo ?? []).map((x) => linhaDeEstudo(x.aluno, x, "semana"));
  return classificarEstudo(linhas, criterio).comparaveis.slice(0, 3);
}

// Quando ninguém chega ao piso na janela, o bloco não fica vazio: diz
// por quê (pedido de 23/09, vale para produção). "Chegou a" e não
// "passou de": o piso é inclusivo (q >= VOLUME_MINIMO).
export function semPodioNaJanela(janela = "semana") {
  const onde = janela === "geral" ? "no ciclo" : "nos últimos 7 dias";
  return `Ninguém chegou a ${LIMIAR.VOLUME_MINIMO} questões ${onde}.`;
}
