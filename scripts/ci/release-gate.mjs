// ============================================================
// ETAPA 5 — release-gate: o único check que diz "pode ir para a main"
// ------------------------------------------------------------
// Roda no job `release-gate` do CI, com `if: always()`, depois de todos
// os jobs obrigatórios. REPROVA quando:
//   • um job obrigatório está ausente do `needs`, ou terminou em
//     failure, cancelled ou skipped (só `success` passa);
//   • o ci.yml tem `continue-on-error` (job com essa chave aparece como
//     sucesso para quem depende dele) ou perdeu um job obrigatório;
//   • o relatório de jornadas do e2e-local está ausente, ilegível, em
//     formato desconhecido, é de outro commit (SHA) ou de outro run;
//   • o relatório tem zero testes executados, jornada crítica abaixo do
//     mínimo, teste crítico pulado, falho ou instável, ou chamada do
//     navegador a projeto hospedado. A avaliação é refeita aqui, com o
//     jornadas.mjs deste checkout: o veredito do e2e-local não basta.
// Lista TODOS os problemas, não só o primeiro.
//
// Entradas (ambiente): NEEDS = toJSON(needs), GITHUB_SHA, GITHUB_RUN_ID.
// Uso: node scripts/ci/release-gate.mjs
// ============================================================
import { readFileSync, appendFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { JORNADAS } from "../e2e/jornadas.mjs";
import { avaliarTestes, VERSAO_RELATORIO } from "../e2e/relatorio-jornadas.mjs";

/** Os jobs sem os quais nada vai para a main. */
export const OBRIGATORIOS = ["build-e-unitarios", "e2e-local", "matriz-autorizacao"];
/** Quem produz o relatório de jornadas (saída `relatorio`). */
export const JOB_RELATORIO = "e2e-local";

const NOME_RESULTADO = { failure: "falhou", cancelled: "cancelado", skipped: "pulado" };

/** Resultado de cada job obrigatório, a partir de toJSON(needs). */
export function conferirJobs(needs, obrigatorios = OBRIGATORIOS) {
  const problemas = [];
  for (const job of obrigatorios) {
    const n = needs?.[job];
    if (!n) problemas.push(`job ${job} ausente do needs do release-gate`);
    else if (n.result !== "success") problemas.push(`job ${job} ${NOME_RESULTADO[n.result] ?? `terminou em "${n.result}"`}`);
  }
  return problemas;
}

/** O ci.yml lido como texto: nada de continue-on-error, e os obrigatórios existem. */
export function conferirWorkflow(texto, obrigatorios = OBRIGATORIOS) {
  const problemas = [];
  texto.split("\n").forEach((linha, i) => {
    if (!/^\s*#/.test(linha) && /continue-on-error/.test(linha)) problemas.push(`ci.yml:${i + 1} usa continue-on-error`);
  });
  for (const job of obrigatorios) {
    if (!new RegExp(`^  ${job}:\\s*$`, "m").test(texto)) problemas.push(`ci.yml não define o job ${job}`);
  }
  return problemas;
}

/** O relatório de jornadas (saída do e2e-local), revalidado do zero. */
export function conferirRelatorio(bruto, { sha, runId }, jornadas = JORNADAS) {
  if (bruto === undefined || bruto === null || String(bruto).trim() === "") {
    return { problemas: ["relatório de jornadas ausente (o e2e-local não publicou a saída `relatorio`; se o passo rodou, procure \"Skip output 'relatorio'\" no fim do log do e2e-local)"], resumo: null };
  }
  let r;
  try { r = JSON.parse(bruto); } catch { return { problemas: ["relatório de jornadas ilegível (não é JSON)"], resumo: null }; }
  if (r?.versao !== VERSAO_RELATORIO || !Array.isArray(r.testes)) {
    return { problemas: [`relatório de jornadas em formato desconhecido (versão ${r?.versao ?? "ausente"}, esperado ${VERSAO_RELATORIO})`], resumo: null };
  }
  const problemas = [];
  if (!sha) problemas.push("GITHUB_SHA ausente: não dá para ligar o relatório ao commit");
  else if (r.sha !== sha) problemas.push(`relatório de outro commit: SHA ${r.sha ?? "ausente"}, este run é ${sha}`);
  if (runId && String(r.run_id) !== String(runId)) problemas.push(`relatório de outro run: ${r.run_id ?? "ausente"}, este é ${runId}`);
  if (r.total !== r.testes.length) problemas.push(`relatório incoerente: total ${r.total}, ${r.testes.length} testes listados`);

  const rede = r.rede?.testes ? [{ api: r.rede.chamadasLocais ?? 0, hospedado: r.rede.hospedados ?? [] }] : [];
  // o título não viaja (ver relatorio-jornadas.mjs): arquivo:linha no lugar
  const testes = r.testes.map((t) => ({ ...t, titulo: t.ref }));
  const refeito = avaliarTestes(testes, rede, jornadas);
  problemas.push(...refeito.problemas);
  // o e2e-local também se reprovou: o gate não contradiz, mesmo sem repetir o motivo
  if (typeof r.problemas !== "number") problemas.push("relatório incoerente: contagem de problemas do e2e-local ausente");
  else if (r.problemas > 0 && !refeito.problemas.length) {
    problemas.push(`o e2e-local acusou ${r.problemas} problema(s) que a reavaliação não repetiu; ver o resumo do job e2e-local`);
  }
  return { problemas, resumo: { ...refeito, sha: r.sha } };
}

/** Tudo junto. */
export function avaliarGate({ needs, workflow, sha, runId, jornadas = JORNADAS }) {
  const rel = conferirRelatorio(needs?.[JOB_RELATORIO]?.outputs?.relatorio, { sha, runId }, jornadas);
  return {
    jobs: Object.fromEntries(OBRIGATORIOS.map((j) => [j, needs?.[j]?.result ?? "ausente"])),
    relatorio: rel.resumo,
    problemas: [...conferirJobs(needs), ...conferirWorkflow(workflow), ...rel.problemas],
  };
}

export function markdown({ jobs, relatorio, problemas }, sha) {
  const l = ["## release-gate", "", `Commit: \`${sha ?? "?"}\``, "", "| Job obrigatório | Resultado |", "| --- | --- |"];
  for (const [j, res] of Object.entries(jobs)) l.push(`| ${j} | ${res === "success" ? "success" : `**${res}**`} |`);
  if (relatorio) {
    l.push("", "| Jornada | Mínimo | Executados | Falharam | Pulados | Situação |", "| --- | --- | --- | --- | --- | --- |");
    for (const j of relatorio.tabela) l.push(`| ${j.id} | ${j.minimo} | ${j.executados} | ${j.falharam} | ${j.pulados} | ${j.ok ? "ok" : "**REPROVA**"} |`);
    l.push("", `Testes no relatório: ${relatorio.testes.length}.`);
  }
  l.push("", problemas.length ? "### Reprovado" : "### Aprovado", "");
  if (problemas.length) l.push(...problemas.map((p) => `- ${p}`), "");
  return l.join("\n");
}

// ── linha de comando ──────────────────────────────────────────
if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const raiz = resolve(dirname(fileURLToPath(import.meta.url)), "../..");
  let needs;
  try { needs = JSON.parse(process.env.NEEDS ?? ""); } catch { needs = null; }
  if (!needs || typeof needs !== "object") {
    console.error("::error::release-gate: NEEDS ausente ou ilegível (esperado toJSON(needs))");
    process.exit(1);
  }
  const workflow = readFileSync(resolve(raiz, ".github/workflows/ci.yml"), "utf8");
  const sha = process.env.GITHUB_SHA;
  const r = avaliarGate({ needs, workflow, sha, runId: process.env.GITHUB_RUN_ID });
  const md = markdown(r, sha);
  if (process.env.GITHUB_STEP_SUMMARY) appendFileSync(process.env.GITHUB_STEP_SUMMARY, md);
  console.log(md);
  if (r.problemas.length) {
    for (const p of r.problemas) console.error(`::error::release-gate: ${p}`);
    process.exit(1);
  }
}
