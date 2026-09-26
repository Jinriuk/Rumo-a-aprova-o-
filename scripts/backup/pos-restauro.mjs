// ============================================================
// ETAPA 6 — o que o dump por schema NÃO carrega e o restore refaz
// ------------------------------------------------------------
// Gera o SQL, a partir do manifesto interno do backup, de:
//   • event triggers cujas funções são da aplicação. Hoje é o
//     `ensure_rls` (0045): sem ele, tabela criada no public depois do
//     retorno nasce SEM RLS, em silêncio. Ensaiado em 26/09: o restore
//     por schema devolve a função public.rls_auto_enable e perde o
//     gatilho;
//   • os jobs do pg_cron (a virada da 0004 e, no demo, os dois da
//     vitrine). Com --cron inativo (padrão) nascem DESLIGADOS: o
//     ensaio confere agenda e comando sem nada disparar. Com --cron
//     ativo (retorno de verdade, projeto novo) nascem como estavam.
//     Comando com cara de chamada externa (pg_net, http, URL) nasce
//     desligado em qualquer modo e é listado para ligar à mão.
// Uso: node scripts/backup/pos-restauro.mjs <manifesto-interno.json> [--cron inativo|ativo]
// ============================================================
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

const lit = (s) => `'${String(s).replace(/'/g, "''")}'`;
const ident = (s) => `"${String(s).replace(/"/g, '""')}"`;
export const CHAMADA_EXTERNA = /\bnet\.|\bhttp_|https?:\/\/|supabase\.(co|com|in)\b|\bdblink/i;

const ESTADO = { O: "enable", D: "disable", R: "enable replica", A: "enable always" };

export function sqlPosRestauro(manifesto, { cron = "inativo" } = {}) {
  const partes = [];
  const externos = [];
  for (const e of manifesto.event_triggers ?? []) {
    const tags = e.tags?.length ? ` when tag in (${e.tags.map(lit).join(", ")})` : "";
    partes.push(`drop event trigger if exists ${ident(e.nome)};`);
    partes.push(`create event trigger ${ident(e.nome)} on ${ident(e.evento)}${tags} execute function ${ident(e.funcao_schema)}.${ident(e.funcao)}();`);
    if (e.habilitado !== "O") partes.push(`alter event trigger ${ident(e.nome)} ${ESTADO[e.habilitado] ?? "disable"};`);
  }
  if (manifesto.cron?.length) {
    partes.push("create extension if not exists pg_cron;");
    for (const j of manifesto.cron) {
      const externo = CHAMADA_EXTERNA.test(j.command);
      if (externo) externos.push(j.jobname);
      const ativo = cron === "ativo" && j.active && !externo;
      partes.push(`select cron.schedule(${lit(j.jobname)}, ${lit(j.schedule)}, ${lit(j.command)});`);
      if (!ativo) partes.push(`select cron.alter_job(job_id := (select jobid from cron.job where jobname = ${lit(j.jobname)}), active := false);`);
    }
  }
  return { sql: partes.join("\n") + "\n", externos };
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const [arq, , modo] = process.argv.slice(2);
  const { sql, externos } = sqlPosRestauro(JSON.parse(readFileSync(arq, "utf8")), { cron: modo ?? "inativo" });
  process.stdout.write(sql);
  for (const j of externos) console.error(`::warning::job ${j} tem chamada externa no comando: criado DESLIGADO; ligue à mão depois de conferir o destino`);
}
