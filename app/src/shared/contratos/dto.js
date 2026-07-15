/* ============================================================
   DTOs — contrato estável entre o schema cru (PostgREST) e as telas
   (FE1, tarefa 79).
   ------------------------------------------------------------
   O seam de dados (shared/data) devolve as linhas como o PostgREST as
   monta, com os JOINs aninhados crus: `vinculo.usuarios?.nome`,
   `aluno.alunos_turmas[0]?.turma_id`. Cada tela que lê isso fica
   ACOPLADA ao nome da tabela e ao formato do embed — se o select muda
   (ex.: renomear a FK, trocar `usuarios` por uma view), a tela quebra
   em silêncio (vira `undefined`).

   Estes mapeadores PUROS escondem esse detalhe: recebem a linha crua e
   devolvem um objeto com nomes de domínio estáveis. A tela passa a
   depender do DTO, não do schema. Adoção INCREMENTAL — começamos pelos
   embeds aninhados (os mais frágeis); leituras planas seguem cruas até
   fazer sentido migrar (sem big bang).

   Sem React, sem efeito colateral: testável e reusável.
   ============================================================ */

// Vínculo responsável↔aluno. Crua: { id, responsavel_id, criado_em,
// usuarios: { nome, papel } }. O acesso `?.usuarios?.nome` aparecia
// solto na tela; aqui vira um campo estável com fallback.
export function vinculoDTO(linha) {
  if (!linha) return null;
  return {
    id: linha.id,
    responsavelId: linha.responsavel_id,
    responsavelNome: linha.usuarios?.nome ?? "Responsável",
    papel: linha.usuarios?.papel ?? "responsavel",
    desde: linha.criado_em ?? null,
  };
}

export function vinculosDTO(linhas) {
  return (linhas ?? []).map(vinculoDTO).filter(Boolean);
}

// Responsável disponível para re-vínculo. Crua: { id, nome }.
export function responsavelDTO(linha) {
  if (!linha) return null;
  return { id: linha.id, nome: linha.nome ?? "Responsável" };
}

export function responsaveisDTO(linhas) {
  return (linhas ?? []).map(responsavelDTO).filter(Boolean);
}

// EST1-A3: whitelist de escrita do aluno (cadastro). O seam NÃO repassa
// campo arbitrário ao banco — atualizarAluno aceita só o que a tela de
// coordenação realmente edita. Campo fora da lista é ERRO (não filtro
// silencioso): esconder o campo mascararia bug de chamada. Espelha o
// padrão de atualizarAlvoPedagogico (que tem a própria lista).
export const CAMPOS_ALUNO_EDITAVEIS = ["nome", "trilha_id", "concurso_id"];

export function patchAluno(campos) {
  const entradas = Object.entries(campos ?? {});
  if (!entradas.length) throw new Error("atualizar aluno: nada para atualizar");
  const invalidos = entradas.filter(([k]) => !CAMPOS_ALUNO_EDITAVEIS.includes(k)).map(([k]) => k);
  if (invalidos.length) {
    throw new Error(`atualizar aluno: campo(s) não permitido(s): ${invalidos.join(", ")}`);
  }
  return Object.fromEntries(entradas);
}

// Formata uma data ISO para pt-BR de forma defensiva — não lança se a
// data vier malformada (devolve o original). Centraliza o try/catch
// que estava repetido nas telas.
export function dataCurtaBR(iso) {
  if (!iso) return "";
  try {
    return new Date(iso).toLocaleDateString("pt-BR");
  } catch {
    return String(iso);
  }
}
