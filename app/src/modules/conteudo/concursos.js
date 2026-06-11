/* Concursos do nicho: a contagem regressiva mira a PRÓXIMA
   ocorrência da data média histórica da prova, a partir da data
   local de hoje. Quando o aluno tem trilha com calendário real
   (ex.: CN 2026), a data real da trilha prevalece sobre a média. */
import { todayISO, daysBetween } from "../../shared/regras/regras.js";

const p2 = (n) => String(n).padStart(2, "0");

// próxima ocorrência (deste ano ou do que vem) da data média
export function proximaProva(concurso, hoje = todayISO()) {
  if (!concurso) return null;
  const ano = +hoje.slice(0, 4);
  let data = `${ano}-${p2(concurso.mes_prova)}-${p2(concurso.dia_prova)}`;
  if (data < hoje) data = `${ano + 1}-${p2(concurso.mes_prova)}-${p2(concurso.dia_prova)}`;
  return {
    dataIso: data,
    dias: Math.max(0, daysBetween(new Date(hoje), new Date(data))),
  };
}

// dias para a prova do aluno: data REAL da trilha quando existe;
// senão, a data média do concurso (rotulada como média)
export function diasParaProva({ semanasTrilha, concurso }, hoje = todayISO()) {
  if (semanasTrilha?.length) {
    const fim = String(semanasTrilha[semanasTrilha.length - 1].fim);
    return { dias: Math.max(0, daysBetween(new Date(hoje), new Date(fim))), dataIso: fim, media: false };
  }
  const prox = proximaProva(concurso, hoje);
  return prox ? { ...prox, media: true } : null;
}
