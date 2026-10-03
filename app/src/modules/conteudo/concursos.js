/* ============================================================
   DATA DA PROVA — quando o aluno presta, e quanto falta.
   ------------------------------------------------------------
   ISTO NÃO É O CICLO DE ESTUDO. A trilha é o plano; a prova é a
   data. São duas coisas, e confundi-las foi o defeito T27.

   O QUE ESTAVA ERRADO (medido no demo, 13/09/2026): esta função
   preferia o FIM DA ÚLTIMA SEMANA DA TRILHA como data de prova, e
   ainda a rotulava `media: false` — ou seja, "data exata". Mas os
   63 alunos do demo dividem UMA trilha, que acaba em 01/08, e
   prestam CINCO provas diferentes:

     Colégio Naval  01/08  → coincide (a trilha foi feita pra ele)
     EPCAR          28/06  → 34 dias ANTES do fim da trilha
     EsPCEx         28/09  → 58 dias DEPOIS
     EsSA           01/10  → 61 dias DEPOIS
     EEAr           16/11  → 107 dias DEPOIS

   Só os 23 alunos do CN viam um número correto. Os outros 40 viam
   a data de fim de um plano de estudo apresentada como a data da
   prova deles — e, passado 01/08, o `Math.max(0, …)` esmagava isso
   em "0 dias p/ prova" para todo mundo.

   A REGRA AGORA, em ordem de precedência:
     1. aluno.data_prova_alvo — a data DESTE aluno. É a única fonte
        que pode afirmar "prova realizada", porque é a única que se
        refere a uma ocorrência específica.
     2. a data média do concurso — recorrente, rola sozinha para o
        ano seguinte. Rotulada `media: true` (a UI mostra "≈").
        NUNCA diz "realizada": para uma data anual, o que existe é
        sempre a PRÓXIMA ocorrência.
     3. concurso SEM data (mes_prova e dia_prova vazios, migration
        0062: pré-edital, data não publicada) → `aguardandoEdital:
        true`, sem `dataIso` nem `dias`. A UI escreve "Data da prova
        aguardando edital" e não conta nada. Não há data média a usar:
        inventar uma recriaria a contagem anual falsa (P0.2, docs/
        conteudo/pmerj-cfo/, seção 4.2).
     4. nada disso → null, e a UI omite a contagem.

   A trilha não entra mais nesta conta em lugar nenhum.
   ============================================================ */
import { todayISO, daysBetween } from "../../shared/regras/regras.js";

const p2 = (n) => String(n).padStart(2, "0");

export const ROTULO_AGUARDANDO_EDITAL = "Data da prova aguardando edital";

// O concurso tem data média? O banco só aceita o par inteiro ou vazio
// (0062); aqui qualquer metade vazia conta como "sem data", para nunca
// montar "2026-null-null" e devolver NaN dias.
export function dataProvaConhecida(concurso) {
  return Boolean(concurso) && concurso.mes_prova != null && concurso.dia_prova != null;
}

// próxima ocorrência (deste ano ou do que vem) da data média.
// Concurso sem data → null: não existe "próxima" de uma data que não há.
export function proximaProva(concurso, hoje = todayISO()) {
  if (!dataProvaConhecida(concurso)) return null;
  const ano = +hoje.slice(0, 4);
  let data = `${ano}-${p2(concurso.mes_prova)}-${p2(concurso.dia_prova)}`;
  if (data < hoje) data = `${ano + 1}-${p2(concurso.mes_prova)}-${p2(concurso.dia_prova)}`;
  return {
    dataIso: data,
    dias: Math.max(0, daysBetween(new Date(hoje), new Date(data))),
  };
}

/* Data da prova do aluno.

   Devolve, quando há data:
     { dataIso, dias, media, realizada }
   `realizada: true` só acontece pelo caminho 1 (data_prova_alvo no
   passado). Nesse caso `dias` é null — e é null de propósito: não
   existe número certo para "faltam quantos dias para uma prova que
   já aconteceu", e foi exatamente inventar um zero ali que produziu
   o T27. Ausência é mais honesta que um zero falso.

   Concurso sem data e aluno sem data_prova_alvo:
     { dataIso: null, dias: null, media: false, realizada: false,
       aguardandoEdital: true }
   A data do aluno, quando existe, continua tendo precedência: é a
   ocorrência específica que a escola cadastrou para ele.

   Sem nenhuma data (aluno sem concurso e sem data_prova_alvo),
   devolve null e a UI simplesmente não mostra contagem. */
export function diasParaProva({ dataProvaAlvo = null, concurso = null } = {}, hoje = todayISO()) {
  if (dataProvaAlvo) {
    const alvo = String(dataProvaAlvo).slice(0, 10);
    if (alvo < hoje) {
      return { dataIso: alvo, dias: null, media: false, realizada: true };
    }
    return {
      dataIso: alvo,
      dias: daysBetween(new Date(hoje), new Date(alvo)),
      media: false,
      realizada: false,
    };
  }
  if (concurso && !dataProvaConhecida(concurso)) {
    return { dataIso: null, dias: null, media: false, realizada: false, aguardandoEdital: true };
  }
  const prox = proximaProva(concurso, hoje);
  return prox ? { ...prox, media: true, realizada: false } : null;
}
