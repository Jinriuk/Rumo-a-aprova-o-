/* ============================================================
   PRÓXIMO CICLO — quem pode ser renovado, e para qual data
   ------------------------------------------------------------
   A migration 0051 criou o MOTOR (clonar a trilha numa edição nova e
   mover os alunos). Faltava a porta: a tela do responsável promete
   desde a Onda 3 que "a coordenação abre o próximo ciclo quando ele
   estiver pronto", e não existia lugar nenhum onde a coordenação
   fizesse isso. Este módulo é a regra pura dessa tela — separada do
   JSX de propósito, para poder ser exercida por teste de verdade e
   não só por inspeção de fonte.

   O que ele responde: dado o resumo da escola, QUAIS trilhas têm
   alunos com o ciclo encerrado, e qual data faz sentido propor como
   âncora (o fim da próxima edição).

   A âncora proposta é a prova MAIS PRÓXIMA entre os alunos daquela
   trilha. Quando a turma mistura concursos com datas diferentes, um
   plano só não serve para todos: terminar na prova mais próxima faz o
   aluno da prova mais distante ter tempo sobrando, enquanto o
   contrário o faria chegar despreparado. O sobrando é recuperável; o
   atraso não. A divergência é devolvida em `concursos` para a tela
   mostrar, porque a decisão continua sendo da escola — aqui só se
   propõe uma data, e a coordenação pode trocá-la.
   ============================================================ */
import { proximaProva } from "../conteudo/concursos.js";
import { todayISO } from "../../shared/regras/regras.js";

/* Agrupa os alunos de ciclo encerrado por trilha.

   `resumo` é a saída de adaptarResumoEscola (tem `aluno` e
   `cicloEncerrado`); `trilhasPorId` e `concursosPorId` são os mapas
   que a Área da Escola já monta.

   Devolve uma lista de grupos prontos para a tela:
     { trilhaId, trilha, fimAtual, alunos, concursos, ancoraSugerida } */
export function gruposParaRenovar({ resumo = [], trilhasPorId = {}, concursosPorId = {} } = {}, hoje = todayISO()) {
  const porTrilha = new Map();

  for (const linha of resumo ?? []) {
    if (!linha?.cicloEncerrado) continue;
    const trilhaId = linha.aluno?.trilha_id;
    // sem trilha não há o que clonar: o aluno precisa primeiro de um
    // plano. Ele aparece em "sem trilha" nas outras telas, não aqui.
    if (!trilhaId) continue;
    if (!porTrilha.has(trilhaId)) porTrilha.set(trilhaId, []);
    porTrilha.get(trilhaId).push(linha);
  }

  const grupos = [];
  for (const [trilhaId, alunos] of porTrilha) {
    const trilha = trilhasPorId[trilhaId] ?? null;
    const semanas = trilha?.trilha_semanas ?? [];
    const fimAtual = semanas.length
      ? semanas.map((s) => String(s.fim)).sort().slice(-1)[0]
      : null;

    // concursos distintos representados neste grupo, com a próxima
    // ocorrência de cada um.
    const vistos = new Map();
    for (const l of alunos) {
      const c = concursosPorId[l.aluno?.concurso_id];
      if (!c || vistos.has(c.id)) continue;
      const prox = proximaProva(c, hoje);
      vistos.set(c.id, { concurso: c, proxima: prox?.dataIso ?? null, alunos: 0 });
    }
    for (const l of alunos) {
      const entrada = vistos.get(l.aluno?.concurso_id);
      if (entrada) entrada.alunos += 1;
    }
    const concursos = [...vistos.values()].sort((a, b) =>
      String(a.proxima ?? "9999").localeCompare(String(b.proxima ?? "9999")));

    // a prova mais próxima entre os alunos do grupo.
    const ancoraSugerida = concursos.find((c) => c.proxima)?.proxima ?? null;

    grupos.push({
      trilhaId,
      trilha,
      fimAtual,
      alunos: [...alunos].sort((a, b) => String(a.aluno?.nome ?? "").localeCompare(String(b.aluno?.nome ?? ""), "pt-BR")),
      concursos,
      ancoraSugerida,
      // a tela avisa quando um plano só vai servir a provas diferentes.
      concursosDivergentes: concursos.length > 1,
    });
  }

  return grupos.sort((a, b) =>
    String(a.trilha?.nome ?? "").localeCompare(String(b.trilha?.nome ?? ""), "pt-BR"));
}

/* A âncora é válida? Espelha a checagem que app.abrir_proximo_ciclo faz
   no banco, para a tela recusar ANTES de chamar o RPC e poder explicar
   o motivo — em vez de deixar o erro do Postgres vazar para o usuário.
   O banco continua sendo a autoridade; isto é só a mesma regra dita
   antes, e as duas precisam concordar. */
export function validarAncora(ancora, fimAtual) {
  if (!ancora) return "Escolha a data da próxima prova.";
  if (!fimAtual) return "Esta trilha não tem semanas — não há plano a deslocar.";
  if (String(ancora) <= String(fimAtual)) {
    return `A nova edição precisa terminar depois do ciclo atual (que acabou em ${String(fimAtual).split("-").reverse().join("/")}).`;
  }
  return null;
}

/* D09 (Bloco 4, 24/09/2026): a edição nova é refeita em semanas de
   segunda a domingo, e a última é a semana da âncora — termina no
   domingo dessa semana (no próprio dia, se a prova for num domingo).
   Espelha o cálculo de app.abrir_proximo_ciclo (0053) para a tela dizer
   a data certa antes de chamar o RPC. `iso` é YYYY-MM-DD. */
export function domingoDaSemana(iso) {
  if (!iso) return null;
  const d = new Date(`${iso}T00:00:00Z`);
  if (Number.isNaN(d.getTime())) return null;
  const dow = d.getUTCDay();                  // 0 = domingo … 6 = sábado
  d.setUTCDate(d.getUTCDate() + ((7 - dow) % 7));
  return d.toISOString().slice(0, 10);
}
