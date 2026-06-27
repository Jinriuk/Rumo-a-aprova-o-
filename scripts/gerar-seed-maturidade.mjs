// Gera supabase/seed/18_maturidade_concursos.sql a partir da FONTE
// ÚNICA app/src/modules/conteudo/maturidade.js. O SQL gerado é
// commitado para o seed rodar com psql puro. Idempotente: usa UPDATE
// por código (não cria concurso — só carimba a maturidade do que já
// existe pelo 05_concursos.sql / migration 0007).
//
// Uso:  node scripts/gerar-seed-maturidade.mjs
// Depois rode o validador:  node scripts/validar-conteudo.mjs
import { writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { MATURIDADE_CONCURSOS } from "../app/src/modules/conteudo/maturidade.js";

const raiz = join(dirname(fileURLToPath(import.meta.url)), "..");
const q = (s) => `'${String(s).replace(/'/g, "''")}'`;

const linhas = [];
linhas.push(`-- ============================================================
-- SEED — MATURIDADE DE CONTEÚDO POR CONCURSO (PED2)
-- GERADO por scripts/gerar-seed-maturidade.mjs a partir de
-- app/src/modules/conteudo/maturidade.js — NÃO editar à mão.
-- Carimba concursos.maturidade / conteudo_versao (migration 0034).
-- Idempotente: UPDATE por código; roda depois de 05_concursos.sql.
-- ============================================================
`);

for (const c of Object.values(MATURIDADE_CONCURSOS)) {
  linhas.push(
    `update concursos set maturidade = ${q(c.maturidade)}, conteudo_versao = ${c.versao}\n` +
      `  where codigo = ${q(c.codigo)};  -- ${c.nota}`,
  );
}
linhas.push("");

const destino = join(raiz, "supabase/seed/18_maturidade_concursos.sql");
writeFileSync(destino, linhas.join("\n"), "utf8");
console.log(`✓ gerado ${destino} (${Object.keys(MATURIDADE_CONCURSOS).length} concursos)`);
