// ============================================================
// ETAPA 6 — origem × destino depois do restore
// ------------------------------------------------------------
// Compara o manifesto interno do backup (retrato da origem no instante
// do dump) com o retrato do destino restaurado (metadados.mjs):
//   • schemas, ledger e última migration;
//   • contagem de linhas de CADA tabela;
//   • estrutura item a item: tabelas e RLS, colunas, índices,
//     constraints, policies, funções (corpo, search_path, security
//     definer), triggers, views, sequências e ACLs (tabela, coluna,
//     sequência, função, schema);
//   • jobs do cron (nome, agenda, comando; e o estado ativo esperado
//     para o modo do restore) e event triggers da aplicação.
// Qualquer diferença reprova. Com --redigir, a saída não traz contagem
// nem nome de linha (para o ensaio com dado real num log público):
// só categoria, igual/diferente e o nome dos objetos de schema.
//
// Uso: node scripts/backup/comparar.mjs <origem.json> <destino.json> [--cron inativo|ativo] [--redigir] [--saida arq.json]
// ============================================================
import { readFileSync, writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { CHAMADA_EXTERNA } from "./pos-restauro.mjs";

const diffLista = (a, b) => {
  const sa = new Set(a), sb = new Set(b);
  return { faltam: a.filter((x) => !sb.has(x)), sobram: b.filter((x) => !sa.has(x)) };
};

export function comparar(origem, destino, { cron = "inativo" } = {}) {
  const div = [];
  const add = (categoria, detalhe) => div.push({ categoria, detalhe });

  if (destino.postgres.major < origem.postgres.major) add("postgres", `destino ${destino.postgres.versao} < origem ${origem.postgres.versao}`);
  const ds = diffLista(origem.schemas, destino.schemas);
  if (ds.faltam.length || ds.sobram.length) add("schemas", ds);
  if (JSON.stringify(origem.ultima_migration) !== JSON.stringify(destino.ultima_migration)) {
    add("ultima_migration", { origem: origem.ultima_migration, destino: destino.ultima_migration });
  }
  if (origem.ledger_linhas !== destino.ledger_linhas) add("ledger_linhas", { origem: origem.ledger_linhas, destino: destino.ledger_linhas });

  const contagens = {};
  for (const [t, n] of Object.entries(origem.contagens)) {
    const m = destino.contagens[t];
    contagens[t] = { origem: n, destino: m ?? null, igual: m === n };
    if (m !== n) add("contagens", { tabela: t, origem: n, destino: m ?? "ausente" });
  }
  for (const [t, m] of Object.entries(destino.contagens)) {
    if (t in origem.contagens) continue;
    // o GoTrue do destino pode ser mais novo e ter tabela que a origem
    // não tinha; vazia, não é perda
    if (t.startsWith("auth.") && m === 0) continue;
    add("contagens", { tabela: t, origem: "ausente", destino: m });
  }

  const estrutura = {};
  for (const [cat, o] of Object.entries(origem.estrutura)) {
    const d = destino.estrutura[cat] ?? { n: 0, hash: null, itens: [] };
    const igual = o.hash === d.hash;
    estrutura[cat] = { origem: o.n, destino: d.n, igual };
    if (!igual) {
      const { faltam, sobram } = diffLista(o.itens, d.itens);
      add(`estrutura.${cat}`, { faltam: faltam.slice(0, 10), sobram: sobram.slice(0, 10), total_faltam: faltam.length, total_sobram: sobram.length });
    }
  }

  const chaveJob = (j) => `${j.jobname}|${j.schedule}|${j.command}`;
  const jobsDestino = new Map(destino.cron.map((j) => [j.jobname, j]));
  for (const j of origem.cron) {
    const d = jobsDestino.get(j.jobname);
    if (!d) { add("cron", `job ${j.jobname} ausente no destino`); continue; }
    if (chaveJob(d) !== chaveJob(j)) add("cron", `job ${j.jobname}: agenda ou comando diferente`);
    // pos-restauro.mjs cria desligado o job com chamada externa, em qualquer modo
    const ativoEsperado = cron === "ativo" && !CHAMADA_EXTERNA.test(j.command) ? j.active : false;
    if (d.active !== ativoEsperado) add("cron", `job ${j.jobname}: active=${d.active}, esperado ${ativoEsperado} (modo ${cron})`);
  }
  for (const d of destino.cron) if (!origem.cron.some((j) => j.jobname === d.jobname)) add("cron", `job ${d.jobname} sobrando no destino`);

  const et = (e) => `${e.nome} ${e.evento} ${JSON.stringify(e.tags)} ${e.habilitado} ${e.funcao_schema}.${e.funcao}`;
  const de = diffLista(origem.event_triggers.map(et), destino.event_triggers.map(et));
  if (de.faltam.length || de.sobram.length) add("event_triggers", de);

  return { ok: div.length === 0, divergencias: div, estrutura, contagens };
}

/** Versão para log público: sem contagem e sem nome de linha. */
export function redigir(r) {
  return {
    ok: r.ok,
    estrutura: r.estrutura,
    contagens: { tabelas: Object.keys(r.contagens).length, iguais: Object.values(r.contagens).filter((c) => c.igual).length },
    divergencias: r.divergencias.map((d) => {
      if (d.categoria === "contagens") return { categoria: d.categoria, detalhe: { tabela: d.detalhe.tabela } };
      // o valor da sequência diz quantas linhas a tabela já teve
      if (d.categoria === "estrutura.sequencias") {
        const tira = (l) => l.map((x) => x.replace(/ last=\S+/, ""));
        return { categoria: d.categoria, detalhe: { ...d.detalhe, faltam: tira(d.detalhe.faltam), sobram: tira(d.detalhe.sobram) } };
      }
      return d;
    }),
  };
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const args = process.argv.slice(2);
  const opc = (n) => { const i = args.indexOf(n); return i >= 0 ? args[i + 1] : undefined; };
  const [arqOrigem, arqDestino] = args.filter((a, i) => !a.startsWith("--") && !["--cron", "--saida"].includes(args[i - 1]));
  if (!arqOrigem || !arqDestino) {
    console.error("uso: node scripts/backup/comparar.mjs <origem.json> <destino.json> [--cron inativo|ativo] [--redigir] [--saida arq.json]");
    process.exit(2);
  }
  const r = comparar(JSON.parse(readFileSync(arqOrigem, "utf8")), JSON.parse(readFileSync(arqDestino, "utf8")),
    { cron: opc("--cron") ?? "inativo" });
  const saida = args.includes("--redigir") ? redigir(r) : r;
  if (opc("--saida")) writeFileSync(opc("--saida"), JSON.stringify(saida, null, 1) + "\n");
  for (const [cat, e] of Object.entries(r.estrutura)) console.log(`${e.igual ? "✔" : "✘"} estrutura.${cat}: origem ${e.origem}, destino ${e.destino}`);
  const cont = Object.values(r.contagens);
  console.log(`${cont.every((c) => c.igual) ? "✔" : "✘"} contagens: ${cont.filter((c) => c.igual).length}/${cont.length} tabelas iguais`);
  if (!r.ok) {
    for (const d of saida.divergencias) console.error(`::error::restore diverge da origem em ${d.categoria}: ${JSON.stringify(d.detalhe).slice(0, 600)}`);
    process.exit(1);
  }
  console.log("✔ destino igual à origem (estrutura, ACLs, contagens, ledger, cron, event triggers)");
}
