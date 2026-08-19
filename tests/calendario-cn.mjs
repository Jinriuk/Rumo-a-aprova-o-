// ============================================================
// CALENDÁRIO DA TRILHA DO CN — lido DO BANCO, nunca escrito à mão
// ------------------------------------------------------------
// O seed 02 ancora a semana 3 da trilha na semana corrente
// (America/Sao_Paulo), então as datas mudam a cada semana. Todo teste
// que precisa de "um dia da semana N" pergunta aqui. Data de trilha
// escrita à mão no teste é o que fazia a suíte vencer junto com o
// calendário do seed.
// ============================================================
import { pool } from "./identidades.mjs";

const DIA_MS = 86400000;

// Uma leitura só por processo de teste (o node --test roda um por arquivo).
const semanas = (async () => {
  const r = await pool.query(
    `select s.numero, s.inicio::text as inicio, s.fim::text as fim
       from trilha_semanas s join trilhas t on t.id = s.trilha_id
      where t.nicho = 'colegio-naval' order by s.numero`,
  );
  return new Map(r.rows.map((x) => [x.numero, x]));
})();

export async function semanaCN(numero) {
  const s = (await semanas).get(numero);
  if (!s) throw new Error(`semana ${numero} não existe na trilha do CN`);
  return s;
}

// Um dia SEGURO dentro da semana (não encosta nos limites, que têm
// teste próprio). Toda semana da trilha tem 6 dias ou mais.
export async function diaNaSemanaCN(numero) {
  return somarDias((await semanaCN(numero)).inicio, 2);
}

export function somarDias(iso, n) {
  return new Date(Date.parse(`${iso}T00:00:00Z`) + n * DIA_MS).toISOString().slice(0, 10);
}
