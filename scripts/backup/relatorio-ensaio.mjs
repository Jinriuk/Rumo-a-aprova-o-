// ============================================================
// ETAPA 6 — relatório do ensaio de restore (JSON + Markdown)
// ------------------------------------------------------------
// Lê o que o ensaio.sh deixou em <dir> (restauro.json do restaurar.sh,
// conferencias.json, e o manifesto do backup sintético quando houver) e
// os tempos por fase (TEMPOS no ambiente), e escreve
// <dir>/ensaio-restauro.json e <dir>/ensaio-restauro.md. No modo real,
// nada de contagem nem de nome de linha (o restaurar.sh já redigiu).
// ============================================================
import { readFileSync, writeFileSync, existsSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

// O que o dump lógico NÃO leva. Fonte única: o doc e o relatório citam daqui.
export const NAO_COBERTO = [
  ["Storage", "arquivos dos buckets (o demo tem o bucket Logos-escolas com 2 objetos em 26/09) e a configuração dos buckets e das policies de storage.objects"],
  ["Secrets das Edge Functions", "ALLOWED_ORIGINS, PASSWORD_RESET_REDIRECT_URL, RESEND_API_KEY, RESEND_FROM_EMAIL, VERCEL_PREVIEW_PREFIX(ES); e o código publicado das 7 funções (vem do repositório, não do banco)"],
  ["Configuração do Auth", "Site URL, redirects, SMTP, limites de envio, expiração e chave de assinatura do JWT (ECC), cadastro público desligado, provedores; nada disso mora no Postgres"],
  ["Chaves de API do projeto", "publicável, secreta, anon e service_role legadas: um projeto novo tem chaves novas, e tudo que as usa muda (front, keepalive, scripts)"],
  ["Configuração do projeto e da Data API", "schemas expostos (só public), região, plano, pooler, senha do banco, Vault"],
  ["Sessões e tokens de uso único", "auth.sessions, refresh_tokens, one_time_tokens, flow_state e afins ficam de fora de propósito: depois do retorno, todos entram de novo; links de redefinição pendentes morrem"],
  ["Objetos de banco fora dos schemas copiados", "extensões (recriadas pelo restore só o pg_cron), roles e grants da plataforma, publicações do Realtime, schemas storage, realtime, vault, graphql, extensions, cron (os jobs são recriados a partir do manifesto)"],
  ["Vercel", "projetos, domínios, variáveis VITE_* e o histórico de deploys; o front é refeito do repositório e reapontado para o projeto novo"],
  ["GitHub", "secrets de repositório e do environment backup (PROD_SUPABASE_*, DEMO_SUPABASE_*, TRILIVA_CAPTURA_*), que apontam para o projeto antigo"],
  ["O que aconteceu depois do clique", "RPO: tudo que for gravado depois do backup se perde num retorno total; não há backup automático no plano free"],
];

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const dir = process.argv[2];
  const ler = (f) => (existsSync(join(dir, f)) ? JSON.parse(readFileSync(join(dir, f), "utf8")) : null);
  const restauro = ler("restauro.json");
  const conf = ler("conferencias.json");
  const manifesto = ler("manifesto-backup-sintetico.json");
  const tempos = Object.fromEntries((process.env.TEMPOS ?? "").trim().split("\n").filter(Boolean)
    .map((l) => l.split("=")).map(([k, v]) => [k, Number(v)]));
  const s = (ms) => (ms == null ? "—" : `${(ms / 1000).toFixed(1)} s`);

  const r = {
    modo: process.env.MODO,
    data: new Date().toISOString(),
    commit: process.env.GITHUB_SHA ?? null,
    backup: manifesto ? {
      arquivo: manifesto.arquivo, tamanho_bytes: manifesto.tamanho_bytes, sha256: manifesto.sha256,
      sha256_pacote_claro: manifesto.sha256_pacote_claro, postgres: manifesto.postgres, ultima_migration: manifesto.ultima_migration,
      data_local: manifesto.data_local,
    } : { sha256: restauro?.arquivo_sha256 ?? null },
    tempos_ms: { ...tempos, restauro: restauro?.restauro_ms ?? null, fases_restauro: restauro?.tempos_ms ?? null },
    restauro_ok: !!restauro?.conferencia_ok,
    estrutura: restauro?.comparacao?.estrutura ?? null,
    conferencias: conf?.checks ?? [],
    matriz: process.env.MATRIZ ?? null,
    rpcs: process.env.RPCS ?? null,
    nao_coberto: NAO_COBERTO.map(([item, detalhe]) => ({ item, detalhe })),
  };
  writeFileSync(join(dir, "ensaio-restauro.json"), JSON.stringify(r, null, 1) + "\n");

  const f = restauro?.tempos_ms ?? {};
  const md = [
    `## Ensaio de restore (${r.modo})`,
    "",
    r.backup.arquivo ? `Backup: \`${r.backup.arquivo}\`, ${r.backup.tamanho_bytes} bytes, SHA-256 \`${r.backup.sha256}\`, Postgres ${r.backup.postgres}, última migration ${r.backup.ultima_migration?.name ?? "—"}.` : `Backup: SHA-256 \`${r.backup.sha256}\`.`,
    "",
    "| Fase | Tempo |",
    "| --- | --- |",
    ...(tempos.origem != null ? [`| Origem sintética (stack + migrations + seeds + contas) | ${s(tempos.origem)} |`] : []),
    ...(tempos.backup != null ? [`| Backup (dump + cifra + prova de decifra) | ${s(tempos.backup)} |`] : []),
    `| Stack nova e vazia | ${s(tempos.stack_destino)} |`,
    `| Restore: trava ${s(f.trava)}, decifra ${s(f.decifrar)}, estrutura e dados ${s(f.estrutura)}, ACLs ${s(f.acl)}, Auth ${s(f.auth)}, cron e event triggers ${s(f.pos)} | **${s(r.tempos_ms.restauro)}** |`,
    `| Conferência origem × destino | ${s(f.conferencia)} |`,
    `| Conferências funcionais | ${s(tempos.conferencias)} |`,
    `| Contrato de RPCs | ${s(tempos.rpcs)} |`,
    `| Matriz de autorização | ${s(tempos.matriz)} |`,
    "",
    "**Origem × destino:** " + (r.estrutura ? Object.entries(r.estrutura).map(([k, v]) => `${k} ${v.igual ? "igual" : "DIFERENTE"} (${v.origem})`).join(", ") : "—")
      + (r.restauro_ok ? "; contagens de todas as tabelas, ledger, jobs do cron e event triggers iguais." : "; **a conferência reprovou** (ver restauro.json)."),
    "",
    "**Conferências:**",
    ...r.conferencias.map((c) => `- ${c.ok ? "✔" : c.ok === null ? "– NÃO VERIFICADO:" : "✘"} ${c.nome}${c.detalhe ? `: ${c.detalhe}` : ""}`),
    `- ✔ matriz de autorização: ${r.matriz}`,
    `- ✔ contrato de RPCs: ${(r.rpcs ?? "").replace(/^[✓✔]\s*/, "")}`,
    "",
    "**O que este backup NÃO cobre:**",
    ...NAO_COBERTO.map(([item, detalhe]) => `- **${item}:** ${detalhe}`),
    "",
  ].join("\n");
  writeFileSync(join(dir, "ensaio-restauro.md"), md);
  console.log(md);
}
