/* Espelho PURO de app.tenant_operacional() do banco (migration 0027).
   Sem dependência de cliente/rede — testável isolado. A fonte da
   verdade do bloqueio é a RLS; isto só existe para o FRONT explicar
   "acesso suspenso" em vez de mostrar painel vazio (D1A). Uma escola
   opera enquanto NÃO está suspensa nem cancelada; estados de pré-
   ativação (implantacao/demo/piloto/ativa) operam normalmente.
   Tolerante: status ausente = opera (não derruba fluxos sem escola). */
export function escolaOperacional(escola) {
  const s = escola?.status;
  return s !== "suspensa" && s !== "cancelada";
}
