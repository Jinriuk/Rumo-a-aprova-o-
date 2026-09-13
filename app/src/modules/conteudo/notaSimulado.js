/* ============================================================
   MOTOR ÚNICO DE NOTA DE SIMULADO (Onda 2 / I6)
   ------------------------------------------------------------
   Existiam DOIS motores independentes pontuando o MESMO simulado, e
   por isso pai, filho e coordenação viam números diferentes:

     provas.js/totalAcertos      → estrutura legada hardcoded, COM
                                   rateio da chave agregada 'soc'
     simuladoConcurso.js/notaPorMateria → estrutura vinda do banco,
                                   SEM conhecer 'soc' (descartava)

   Medido no dado real do demo (simulados do Lucas, CN):

     simulado      JSON cru   motor antigo 1   motor antigo 2
     Junho/1          65            57               45
     Diagnóstico      62            61               55
     Junho/2          74            64               52

   A perda do motor 2 era 'soc' descartado inteiro MAIS o capping por
   matéria — em Junho/1, 20 = 18 (soc) + 2 (qui 8→6). Era por isso que
   "nenhum subconjunto de matérias somava 20": não era remoção de
   matéria, era descarte + capping.

   Três regras que este motor fixa, e que nenhum dos dois tinha:

   1. CHAVE LEGADA EXPANDIDA UMA VEZ SÓ, explicitamente. 'soc' (Estudos
      Sociais somado) vira his/geo antes de qualquer conta. Quem lê
      depois não precisa saber que 'soc' existiu.

   2. "NÃO RESPONDIDA" ≠ "RESPONDEU E ZEROU" (I5). Matéria ausente do
      JSON devolve pct null, não 0. O motor antigo devolvia 0, e a
      avaliação de eliminação lia 0% como "abaixo do piso" — por isso o
      sistema anunciava eliminação em Biologia, História e Geografia
      para um aluno que nunca fez essas provas, em 100% dos simulados.

   3. CAPPING NUNCA É SILENCIOSO. Informar mais acertos que o total de
      questões da matéria é dado impossível, e some do total sem
      avisar. Aqui vira `violacoes`, para a tela poder mostrar.
      No dado do demo isto NÃO é hipotético: 'soc' = 18 não cabe em
      his(6) + geo(6) = 12. O seed é impossível sob a estrutura oficial
      do CN — nenhum motor consegue exibir 74 honestamente, e 64 é o
      máximo defensável.
   ============================================================ */

// Chaves agregadas de dado legado → matérias oficiais que elas somam.
// Simulado antigo gravava 'soc' (Estudos Sociais) em vez de his/geo.
export const LEGADO_PADRAO = { soc: ["his", "geo"] };

const num = (v) => (Number.isFinite(+v) ? +v : 0);
const informado = (v) => v != null && v !== "";

/* Expande as chaves agregadas legadas nas matérias que elas somam,
   rateando igualmente. Devolve o mapa de acertos JÁ NORMALIZADO mais
   a lista de expansões feitas (para a tela poder explicar o número).

   O rateio usa divisão inteira e devolve o RESTO na primeira matéria
   do bucket, para a soma da expansão bater exatamente com o agregado
   (o motor antigo usava Math.floor nas duas e perdia o ímpar). */
export function expandirLegado(acertos = {}, mapa = LEGADO_PADRAO) {
  const saida = { ...acertos };
  const expansoes = [];
  for (const [agregada, destinos] of Object.entries(mapa)) {
    if (!informado(acertos[agregada]) || destinos.length === 0) continue;
    const total = num(acertos[agregada]);
    const base = Math.floor(total / destinos.length);
    const resto = total - base * destinos.length;
    const partes = {};
    destinos.forEach((d, i) => {
      // só preenche quem NÃO veio explícito: dado explícito manda.
      if (informado(acertos[d])) return;
      partes[d] = base + (i === 0 ? resto : 0);
      saida[d] = partes[d];
    });
    delete saida[agregada];
    expansoes.push({ de: agregada, total, partes });
  }
  return { acertos: saida, expansoes };
}

/* Avalia os acertos contra a estrutura de matérias do concurso.

   `materias` é a estrutura do BANCO (prova_materias): cada item tem
   materia_codigo, num_questoes, dia_numero, eh_redacao, e opcionalmente
   peso/valor_questao. É a fonte única — a tabela hardcoded de provas.js
   passou a ser só fallback para quando o banco não respondeu.

   Devolve, por matéria:
     respondida  false quando a matéria não veio no simulado
     acertos     já capado no máximo da matéria
     pct         null quando não respondida (NUNCA 0 — ver regra 2)
     capado      true quando o informado passou do máximo */
export function avaliarAcertos(materias = [], acertosBrutos = {}, { legado = LEGADO_PADRAO } = {}) {
  const objetivas = materias.filter((m) => !m.eh_redacao);
  const { acertos, expansoes } = expandirLegado(acertosBrutos, legado);

  const violacoes = [];
  const linhas = objetivas.map((m) => {
    const k = m.materia_codigo ?? m.k;
    const max = num(m.num_questoes ?? m.max);
    const respondida = informado(acertos[k]);
    const bruto = num(acertos[k]);
    const capadoEm = Math.max(0, Math.min(bruto, max));
    if (respondida && bruto > max) {
      violacoes.push({ materia: k, informado: bruto, max, perdido: bruto - max });
    }
    const valor = m.valor_questao != null ? num(m.valor_questao) : null;
    const peso = m.peso != null ? num(m.peso) : null;
    const pct = respondida && max > 0 ? Math.round((capadoEm / max) * 100) : null;
    return {
      materia: k,
      dia: m.dia_numero ?? null,
      respondida,
      acertos: respondida ? capadoEm : 0,
      max,
      pct,
      capado: respondida && bruto > max,
      peso,
      valor,
      pontos: Math.round((valor != null ? capadoEm * valor
        : peso != null && max > 0 ? (capadoEm / max) * peso * max
        : capadoEm) * 100) / 100,
    };
  });

  // Uma expansão legada também pode estourar o teto do BUCKET inteiro
  // (ex.: soc=18 contra his 6 + geo 6). O capping por matéria já
  // aparece acima, mas a violação precisa nomear a chave que o usuário
  // realmente informou, senão a tela culpa 'his' por um dado 'soc'.
  for (const e of expansoes) {
    const tetoBucket = Object.keys(e.partes)
      .map((d) => linhas.find((l) => l.materia === d)?.max ?? 0)
      .reduce((a, b) => a + b, 0);
    if (e.total > tetoBucket) {
      violacoes.push({ materia: e.de, informado: e.total, max: tetoBucket, perdido: e.total - tetoBucket, legado: true });
    }
  }

  const respondidas = linhas.filter((l) => l.respondida);
  const totalAcertos = respondidas.reduce((s, l) => s + l.acertos, 0);
  const totalQuestoes = linhas.reduce((s, l) => s + l.max, 0);
  const maxRespondido = respondidas.reduce((s, l) => s + l.max, 0);

  return {
    linhas,
    expansoes,
    violacoes,
    totalAcertos,
    totalQuestoes,
    // denominador só do que foi respondido — para a tela poder dizer
    // "64 de 90" sem fingir que as não respondidas foram zeradas.
    maxRespondido,
    naoRespondidas: linhas.filter((l) => !l.respondida).map((l) => l.materia),
    pctGeral: totalQuestoes > 0 ? Math.round((totalAcertos / totalQuestoes) * 100) : 0,
  };
}
