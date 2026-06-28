/* ============================================================
   CONTRATO: registro de estudo (FE1, tarefas 78 e 80).
   ------------------------------------------------------------
   Lógica de negócio que estava DENTRO do componente Registrar:
   interpretar o tempo digitado e decidir se o formulário pode ser
   gravado. Extraída para um módulo PURO (sem React) — testável sem
   renderizar e reusável. A tela só liga input → estado e mostra erro.

   `validarRegistroEstudo` é a fronteira de validação de payload: o
   componente NUNCA monta o objeto que vai ao banco na mão; pede aqui
   um payload já limpo e validado. A segurança continua na RLS/checks
   do banco — isto é higiene de UX e contrato estável de escrita.
   ============================================================ */

// Tempo AMIGÁVEL (Fase 4 do doc original): aceita "45min", "1h",
// "1h30", "90". Devolve minutos (int), null se vazio, NaN se não
// entendido. Movido de Registrar.jsx sem mudar o comportamento.
export function parseTempo(txt) {
  const s = String(txt ?? "").trim().toLowerCase().replace(",", ".").replace(/\s+/g, "");
  if (!s) return null;
  let m = s.match(/^(\d+)h(\d{1,2})m?$/); // 1h30
  if (m) return +m[1] * 60 + +m[2];
  m = s.match(/^(\d+(?:\.\d+)?)h$/); // 1h, 1.5h
  if (m) return Math.round(+m[1] * 60);
  m = s.match(/^(\d+)(m|min|mins|minutos)?$/); // 45, 45min
  if (m) return +m[1];
  return NaN; // formato não entendido
}

/* Valida o formulário de registro e, se válido, devolve o payload
   pronto para db.adicionarRegistro (sem escola_id/aluno_id — quem os
   conhece é o componente, que tem o `aluno`).

   Entrada: o estado do formulário { data, disciplina_codigo, topico,
   questoes, acertos, tempo, obs }.
   Saída: { ok, erros, campos } — `campos` é o payload limpo quando ok.
   `erros` é um objeto por campo (tela mostra perto do input) e nunca
   é vazio quando ok === false. */
export function validarRegistroEstudo(form) {
  const erros = {};
  const topico = String(form?.topico ?? "").trim();
  const questoesNum = form?.questoes === "" || form?.questoes == null ? NaN : Number(form.questoes);
  const temAcerto = form?.acertos !== "" && form?.acertos != null;
  const acertosNum = temAcerto ? Number(form.acertos) : null;
  const minutos = parseTempo(form?.tempo);

  if (!Number.isFinite(questoesNum) || questoesNum <= 0) {
    erros.questoes = "Informe quantas questões você fez (maior que zero).";
  }
  if (topico === "") {
    erros.topico = "Falta o tópico — ele alimenta seu histórico e o radar de desempenho.";
  }
  if (Number.isNaN(minutos)) {
    erros.tempo = "Tempo não entendido — use formatos como “45min”, “1h” ou “1h30”.";
  }
  if (temAcerto && Number.isFinite(questoesNum) && Number.isFinite(acertosNum) && acertosNum > questoesNum) {
    erros.acertos = "Acertos não podem passar do número de questões.";
  }

  if (Object.keys(erros).length > 0) return { ok: false, erros, campos: null };

  // payload limpo: acertos nunca passa de questões; tempo já em minutos.
  const campos = {
    data: form.data,
    disciplina_codigo: form.disciplina_codigo,
    topico,
    questoes: questoesNum,
    acertos: temAcerto ? Math.min(acertosNum, questoesNum) : null,
    minutos,
    obs: form.obs ? String(form.obs) : null,
  };
  return { ok: true, erros: {}, campos };
}
