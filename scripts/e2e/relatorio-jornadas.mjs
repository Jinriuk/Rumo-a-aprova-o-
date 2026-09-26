// ============================================================
// ETAPA 3 — relatório jornada → testes, e o portão do job
// ------------------------------------------------------------
// Lê o JSON do Playwright (app/e2e-resultados/resultados.json) e a prova
// de rede (app/e2e-resultados/rede.jsonl) e REPROVA quando:
//   • nenhum teste rodou;
//   • uma jornada obrigatória rodou menos testes críticos que o mínimo
//     (scripts/e2e/jornadas.mjs), inclusive zero;
//   • algum teste crítico foi pulado, falhou ou só passou na repetição;
//   • o navegador tentou falar com projeto hospedado, ou nenhum teste de
//     navegador chamou a API local.
// Escreve a tabela em app/e2e-resultados/jornadas.md e, no Actions, no
// resumo do job ($GITHUB_STEP_SUMMARY).
// Uso: node scripts/e2e/relatorio-jornadas.mjs [resultados.json] [rede.jsonl]
// ============================================================
import { readFileSync, writeFileSync, appendFileSync, existsSync, mkdirSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { JORNADAS } from "./jornadas.mjs";

/** Achata o JSON do Playwright em uma linha por (teste, projeto). */
export function achatar(relatorio) {
  const linhas = [];
  const andar = (suite, caminho) => {
    for (const spec of suite.specs ?? []) {
      for (const t of spec.tests ?? []) {
        const tags = (spec.tags ?? []).map((x) => String(x).replace(/^@/, ""));
        linhas.push({
          titulo: [...caminho, spec.title].filter(Boolean).join(" › "),
          arquivo: spec.file,
          projeto: t.projectName,
          tags,
          // expected | unexpected | flaky | skipped
          status: t.status,
          execucoes: (t.results ?? []).map((r) => r.status),
        });
      }
    }
    for (const filho of suite.suites ?? []) andar(filho, [...caminho, filho.title]);
  };
  for (const s of relatorio.suites ?? []) andar(s, []);
  return linhas;
}

/** Avalia as jornadas; devolve { linhas, problemas, tabela }. */
export function avaliar(relatorio, rede = [], jornadas = JORNADAS) {
  const testes = achatar(relatorio);
  const problemas = [];
  const executado = (t) => t.status !== "skipped" && t.execucoes.length > 0;
  if (!testes.some(executado)) problemas.push("nenhum teste foi executado");

  const tabela = jornadas.map((j) => {
    const daJornada = testes.filter((t) => t.tags.includes(`j:${j.id}`));
    const criticos = daJornada.filter((t) => t.tags.includes("critica"));
    const rodaram = criticos.filter(executado);
    const passaram = criticos.filter((t) => t.status === "expected");
    const falharam = criticos.filter((t) => t.status === "unexpected");
    const instaveis = criticos.filter((t) => t.status === "flaky");
    const pulados = criticos.filter((t) => t.status === "skipped");
    if (rodaram.length < j.minimo) problemas.push(`${j.id}: ${rodaram.length} teste(s) crítico(s) executado(s), mínimo ${j.minimo}`);
    for (const t of pulados) problemas.push(`${j.id}: teste crítico PULADO: ${t.titulo}`);
    for (const t of falharam) problemas.push(`${j.id}: teste crítico FALHOU: ${t.titulo}`);
    for (const t of instaveis) problemas.push(`${j.id}: teste crítico só passou na repetição: ${t.titulo}`);
    return {
      id: j.id, nome: j.nome, minimo: j.minimo, executados: rodaram.length, passaram: passaram.length,
      falharam: falharam.length + instaveis.length, pulados: pulados.length, extras: daJornada.length - criticos.length,
      testes: criticos.map((t) => `${t.titulo} [${t.projeto}]`),
      ok: rodaram.length >= j.minimo && !pulados.length && !falharam.length && !instaveis.length,
    };
  });

  const hospedado = rede.flatMap((r) => r.hospedado ?? []);
  const chamadasLocais = rede.reduce((n, r) => n + (r.api ?? 0), 0);
  if (hospedado.length) problemas.push(`o navegador tentou falar com projeto hospedado: ${[...new Set(hospedado)].join(", ")}`);
  if (rede.length && !chamadasLocais) problemas.push("nenhum teste de navegador chamou a API local");

  return { testes, problemas, tabela, rede: { testes: rede.length, chamadasLocais, hospedado: hospedado.length } };
}

export function markdown({ testes, problemas, tabela, rede }) {
  const l = [];
  l.push("## E2E local — jornadas obrigatórias", "");
  l.push("| Jornada | Mínimo | Executados | Passaram | Falharam | Pulados | Situação |", "| --- | --- | --- | --- | --- | --- | --- |");
  for (const j of tabela) l.push(`| ${j.id} | ${j.minimo} | ${j.executados} | ${j.passaram} | ${j.falharam} | ${j.pulados} | ${j.ok ? "ok" : "**REPROVA**"} |`);
  const total = testes.length;
  const porStatus = testes.reduce((m, t) => ({ ...m, [t.status]: (m[t.status] ?? 0) + 1 }), {});
  l.push("", `Testes na execução: ${total} (${Object.entries(porStatus).map(([k, v]) => `${k}: ${v}`).join(", ") || "nenhum"}).`);
  l.push(`Rede do navegador: ${rede.testes} testes, ${rede.chamadasLocais} chamadas à API local, ${rede.hospedado} a projeto hospedado.`);
  if (problemas.length) l.push("", "### Reprovado", "", ...problemas.map((p) => `- ${p}`));
  l.push("", "<details><summary>Testes por jornada</summary>", "");
  for (const j of tabela) l.push(`**${j.id}** (${j.nome})`, "", ...j.testes.map((t) => `- ${t}`), "");
  l.push("</details>", "");
  return l.join("\n");
}

// ── linha de comando ──────────────────────────────────────────
if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const raiz = resolve(dirname(fileURLToPath(import.meta.url)), "../..");
  const arqResultados = resolve(process.argv[2] ?? `${raiz}/app/e2e-resultados/resultados.json`);
  const arqRede = resolve(process.argv[3] ?? `${raiz}/app/e2e-resultados/rede.jsonl`);
  if (!existsSync(arqResultados)) {
    console.error(`::error::relatório do E2E ausente (${arqResultados}): a suíte não rodou`);
    process.exit(1);
  }
  const relatorio = JSON.parse(readFileSync(arqResultados, "utf8"));
  const rede = existsSync(arqRede)
    ? readFileSync(arqRede, "utf8").split("\n").filter(Boolean).map((x) => JSON.parse(x))
    : [];
  const r = avaliar(relatorio, rede);
  const md = markdown(r);
  mkdirSync(dirname(arqResultados), { recursive: true });
  writeFileSync(resolve(dirname(arqResultados), "jornadas.md"), md);
  if (process.env.GITHUB_STEP_SUMMARY) appendFileSync(process.env.GITHUB_STEP_SUMMARY, md);
  console.log(md);
  if (r.problemas.length) {
    for (const p of r.problemas) console.error(`::error::E2E: ${p}`);
    process.exit(1);
  }
}
