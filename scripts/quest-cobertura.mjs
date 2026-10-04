// ============================================================
// QUEST — cobertura das missões antes de ligar o botão (P1.1, seção 9.3)
// ------------------------------------------------------------
// A chave da Quest NÃO passa por aqui: ela vive só no secret
// QUEST_API_KEY das Edge Functions. Este script entra como super_admin
// (e-mail e senha do operador, no ambiente da máquina dele) e pede à
// função `questoes-integradas` a ação `cobertura`, que consulta a Quest
// lá dentro e devolve só contagens.
//
// MEDIR (imprime a tabela em Markdown; --saida grava o JSON bruto):
//   SUPABASE_URL=https://<ref>.supabase.co SUPABASE_ANON_KEY=<publishable> \
//   OPERADOR_EMAIL=... OPERADOR_SENHA=... \
//     node scripts/quest-cobertura.mjs --medir [--saida cobertura.json]
//
// REIMPRIMIR uma medição salva:
//   node scripts/quest-cobertura.mjs --tabela cobertura.json
//
// SQL dos filtros (app.quest_filtros_missao), todos DESLIGADOS; liga só
// as chaves listadas em --ativar (depois de olhar a tabela):
//   node scripts/quest-cobertura.mjs --sql [--ativar PMERJ-M01-ADM,PMERJ-M01-PEN]
//   Rodar só depois que as missões do CFO PMERJ existirem no banco (P0.6).
//
// Fonte dos filtros: supabase/seed/quest-filtros-pmerj-cfo-v1.json.
// ============================================================
import { readFileSync, writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { carregarFonte, uid } from "./gerar-seed-trilha-pmerj-cfo.mjs";

const RAIZ = join(dirname(fileURLToPath(import.meta.url)), "..");
export const MAPA_REL = "supabase/seed/quest-filtros-pmerj-cfo-v1.json";

export function carregarMapa() {
  return JSON.parse(readFileSync(join(RAIZ, MAPA_REL), "utf8"));
}

// Mapa × manifesto: toda missão escrita tem filtro, e vice-versa.
export function validarMapa(mapa, manifesto) {
  const erros = [];
  const chaves = new Set(manifesto.missoes.map((m) => m.chave));
  const vistas = new Set();
  for (const f of mapa.missoes) {
    if (!chaves.has(f.chave)) erros.push(`${f.chave}: não é missão do manifesto`);
    if (vistas.has(f.chave)) erros.push(`${f.chave}: repetida`);
    vistas.add(f.chave);
    if (!f.materia || !String(f.materia).trim()) erros.push(`${f.chave}: sem matéria`);
    if (!f.assunto && !f.assunto_id) erros.push(`${f.chave}: sem assunto nem assunto_id`);
    const m = manifesto.missoes.find((x) => x.chave === f.chave);
    if (m && m.materia !== f.materia_codigo) erros.push(`${f.chave}: matéria ${f.materia_codigo} ≠ ${m.materia}`);
  }
  for (const c of chaves) if (!vistas.has(c)) erros.push(`${c}: missão sem filtro`);
  return erros;
}

const num = (v) => (v === null || v === undefined ? "—" : String(v));

// Situação de uma linha frente à meta da missão (questões que o aluno
// precisa responder para fechá-la). "zero" pode ser nome de assunto
// diferente na Quest: conferir o filtro antes de concluir que falta.
export function situacao(linha, meta) {
  if (linha.erro) return `erro: ${linha.erro}`;
  if (linha.total === null) return "sem total na resposta";
  if (linha.total === 0) return "zero: conferir filtro";
  if (linha.amostra > 0 && linha.utilizaveis_amostra === 0) return "amostra sem questão utilizável";
  if (linha.total < meta) return `abaixo da meta (${meta})`;
  return "ok";
}

export function montarTabela(resultado, manifesto) {
  const bancas = resultado.bancas ?? [];
  const meta = Object.fromEntries(manifesto.missoes.map((m) => [m.chave, m.metaQuestoes]));
  const cab = ["Missão", "Matéria", "Assunto (filtro)", "Meta", "Total", ...bancas.map((b) => b[0] + b.slice(1).toLowerCase()), "Outras", "Utilizáveis na amostra", "Situação"];
  const linhas = [`| ${cab.join(" | ")} |`, `|${cab.map(() => "---").join("|")}|`];
  const somaMat = {};
  for (const l of resultado.linhas) {
    const m = meta[l.chave];
    linhas.push(`| ${[
      l.chave, l.materia_codigo ?? "", l.filtro?.assunto_id ? `id ${l.filtro.assunto_id}` : (l.filtro?.assunto ?? ""), num(m),
      num(l.total), ...bancas.map((b) => num(l.por_banca?.[b])), num(l.outras),
      l.amostra ? `${l.utilizaveis_amostra}/${l.amostra}` : "—", situacao(l, m),
    ].join(" | ")} |`);
    const s = (somaMat[l.materia_codigo ?? "?"] ??= { total: 0, outras: 0, ...Object.fromEntries(bancas.map((b) => [b, 0])), lacunas: 0 });
    if (l.total === null) s.lacunas++;
    s.total += l.total ?? 0;
    s.outras += l.outras ?? 0;
    for (const b of bancas) s[b] += l.por_banca?.[b] ?? 0;
  }
  const res = ["", "Por matéria (soma das missões; uma questão pode servir a duas missões):", "",
    `| Matéria | Total | ${bancas.join(" | ")} | Outras | Missões sem medida |`,
    `|---|---|${bancas.map(() => "---").join("|")}|---|---|`];
  for (const [mat, s] of Object.entries(somaMat)) {
    res.push(`| ${mat} | ${s.total} | ${bancas.map((b) => s[b]).join(" | ")} | ${s.outras} | ${s.lacunas} |`);
  }
  const ok = resultado.linhas.filter((l) => situacao(l, meta[l.chave]) === "ok").length;
  return [...linhas, ...res, "", `Missões prontas para ligar: ${ok} de ${resultado.linhas.length}. Medido em ${resultado.medido_em ?? "?"}.`].join("\n");
}

const sqlTexto = (v) => (v == null ? "null" : `'${String(v).replaceAll("'", "''")}'`);

export function gerarSqlFiltros(mapa, { ativar = [] } = {}) {
  const ligar = new Set(ativar);
  for (const c of ligar) {
    if (!mapa.missoes.some((f) => f.chave === c)) throw new Error(`--ativar: ${c} não está no mapa`);
  }
  const linhas = mapa.missoes.map((f) =>
    `  (${sqlTexto(uid(`missao:${f.chave}`))}::uuid, ${sqlTexto(f.materia)}, ${sqlTexto(f.assunto)}, ${sqlTexto(f.assunto_id)}, ${ligar.has(f.chave)}, ${sqlTexto(`${f.chave}${f.conferido ? "" : " · filtro não conferido"}`)})`);
  return `-- Gerado por scripts/quest-cobertura.mjs --sql a partir de ${MAPA_REL}.
-- Exige a 0065 e as missões do CFO PMERJ publicadas (P0.6).
-- Ligadas: ${ligar.size ? [...ligar].join(", ") : "nenhuma"}.
begin;
insert into app.quest_filtros_missao (missao_id, materia, assunto, assunto_id_fornecedor, ativo, observacao)
select d.missao_id, d.materia, d.assunto, d.assunto_id, d.ativo, d.observacao
  from (values
${linhas.join(",\n")}
  ) as d(missao_id, materia, assunto, assunto_id, ativo, observacao)
  join public.missoes m on m.id = d.missao_id
on conflict (missao_id) do update set
  materia = excluded.materia,
  assunto = excluded.assunto,
  assunto_id_fornecedor = excluded.assunto_id_fornecedor,
  ativo = excluded.ativo,
  observacao = excluded.observacao,
  -- filtro mudou: a paginação recomeça
  proxima_pagina = case when app.quest_filtros_missao.materia is distinct from excluded.materia
                          or app.quest_filtros_missao.assunto is distinct from excluded.assunto
                          or app.quest_filtros_missao.assunto_id_fornecedor is distinct from excluded.assunto_id_fornecedor
                        then 1 else app.quest_filtros_missao.proxima_pagina end,
  esgotada_em = null,
  atualizado_em = now();
do $$ begin
  if (select count(*) from app.quest_filtros_missao f join public.missoes m on m.id = f.missao_id
       where m.exam_tag = 'pmerj_cfo') <> ${mapa.missoes.length} then
    raise exception 'quest: nem todas as ${mapa.missoes.length} missões do CFO PMERJ estão no banco (rodar depois da P0.6)';
  end if;
end $$;
commit;
`;
}

async function medir({ saida }) {
  const url = process.env.SUPABASE_URL?.replace(/\/+$/, "");
  const anon = process.env.SUPABASE_ANON_KEY;
  const email = process.env.OPERADOR_EMAIL;
  const senha = process.env.OPERADOR_SENHA;
  if (!url || !anon || !email || !senha) {
    throw new Error("defina SUPABASE_URL, SUPABASE_ANON_KEY, OPERADOR_EMAIL e OPERADOR_SENHA no ambiente (nunca no repositório)");
  }
  const mapa = carregarMapa();
  const login = await fetch(`${url}/auth/v1/token?grant_type=password`, {
    method: "POST", headers: { apikey: anon, "content-type": "application/json" },
    body: JSON.stringify({ email, password: senha }),
  });
  if (!login.ok) throw new Error(`login do operador falhou (HTTP ${login.status})`);
  const { access_token } = await login.json();
  const resp = await fetch(`${url}/functions/v1/questoes-integradas`, {
    method: "POST",
    headers: { apikey: anon, authorization: `Bearer ${access_token}`, "content-type": "application/json" },
    body: JSON.stringify({
      acao: "cobertura", bancas: mapa.bancas,
      missoes: mapa.missoes.map(({ chave, nome, materia_codigo, materia, assunto, assunto_id }) =>
        ({ chave, nome, materia_codigo, materia, assunto, assunto_id })),
    }),
  });
  const corpo = await resp.json().catch(() => ({}));
  if (!resp.ok) throw new Error(`função respondeu HTTP ${resp.status}: ${JSON.stringify(corpo)}`);
  if (saida) writeFileSync(saida, JSON.stringify(corpo, null, 2) + "\n");
  return corpo;
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  const args = process.argv.slice(2);
  const valor = (k) => { const i = args.indexOf(k); return i >= 0 ? args[i + 1] : undefined; };
  try {
    const manifesto = carregarFonte();
    const mapa = carregarMapa();
    const erros = validarMapa(mapa, manifesto);
    if (erros.length) throw new Error(`mapa de filtros inválido:\n- ${erros.join("\n- ")}`);
    if (args.includes("--sql")) {
      process.stdout.write(gerarSqlFiltros(mapa, { ativar: (valor("--ativar") ?? "").split(",").filter(Boolean) }));
    } else if (args.includes("--tabela")) {
      console.log(montarTabela(JSON.parse(readFileSync(valor("--tabela"), "utf8")), manifesto));
    } else if (args.includes("--medir")) {
      console.log(montarTabela(await medir({ saida: valor("--saida") }), manifesto));
    } else {
      console.error("uso: --medir [--saida arq.json] | --tabela arq.json | --sql [--ativar CHAVE,...]");
      process.exit(2);
    }
  } catch (e) {
    console.error(e.message);
    process.exit(1);
  }
}
