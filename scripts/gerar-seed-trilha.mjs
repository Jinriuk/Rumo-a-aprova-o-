// Gera supabase/seed/02_trilha_cn.sql a partir do JSON da trilha.
// O JSON é a fonte; o SQL gerado é commitado para o seed rodar com
// psql puro. IDs determinísticos (hash do conteúdo lógico) tornam o
// seed idempotente: rodar duas vezes não duplica nada.
import { createHash } from "node:crypto";
import { readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const raiz = join(dirname(fileURLToPath(import.meta.url)), "..");
const trilha = JSON.parse(readFileSync(join(raiz, "supabase/seed/trilha-cn-v1.json"), "utf8"));

// uuid determinístico (estilo v5, via md5) a partir de um nome lógico
function uid(nome) {
  const h = createHash("md5").update(`rumo-aprovacao:${nome}`).digest("hex");
  return `${h.slice(0, 8)}-${h.slice(8, 12)}-4${h.slice(13, 16)}-8${h.slice(17, 20)}-${h.slice(20, 32)}`;
}
const q = (s) => (s == null ? "null" : `'${String(s).replace(/'/g, "''")}'`);

const trilhaId = uid(`trilha:${trilha.nicho}:v${trilha.versao}`);
const linhas = [];

linhas.push(`-- ============================================================
-- SEED — TRILHA DO COLÉGIO NAVAL (conteúdo global, versionado)
-- GERADO por scripts/gerar-seed-trilha.mjs a partir de
-- supabase/seed/trilha-cn-v1.json — NÃO editar à mão.
-- Idempotente: on conflict do nothing em tudo; as semanas, que são
-- as únicas linhas com data, fazem do update só das datas.
--
-- CALENDÁRIO ROLANTE: as datas NÃO são fixas. A semana ${trilha.semanaAncora}
-- da trilha é sempre a semana corrente em America/Sao_Paulo (a mesma
-- regra de app.hoje_local()), e as outras oito guardam o encaixe
-- original — semana 1 começa no sábado, 2 a 8 são de segunda a
-- domingo, 9 termina no sábado da prova. Sem isso o seed de
-- demonstração vence sozinho: passada a última semana não há meta
-- ativa, e o painel da vitrine amanhece vazio.
-- ============================================================
`);

linhas.push(`insert into trilhas (id, nicho, nome, versao, publicada) values
  (${q(trilhaId)}, ${q(trilha.nicho)}, ${q(trilha.nome)}, ${trilha.versao}, true)
  on conflict (nicho, versao) do nothing;
`);

linhas.push(`insert into disciplinas (id, trilha_id, codigo, nome, abrev, cor, ordem) values`);
linhas.push(
  trilha.disciplinas
    .map((d, i) => `  (${q(uid(`disc:${trilha.nicho}:v${trilha.versao}:${d.codigo}`))}, ${q(trilhaId)}, ${q(d.codigo)}, ${q(d.nome)}, ${q(d.abrev)}, ${q(d.cor)}, ${i})`)
    .join(",\n") + "\n  on conflict (trilha_id, codigo) do nothing;\n"
);

// A trilha vira DESLOCAMENTO em dias a partir da segunda-feira da
// semana âncora; o banco soma esse deslocamento à segunda-feira
// corrente na hora de aplicar o seed. O JSON continua guardando as
// datas autorais — elas é que definem a forma que se preserva.
const ancora = trilha.semanas.find((s) => s.n === trilha.semanaAncora);
if (!ancora) throw new Error(`semanaAncora ${trilha.semanaAncora} não existe na trilha`);
const DIA_MS = 86400000;
const dia = (iso) => Date.parse(`${iso}T00:00:00Z`);
const desloc = (iso) => Math.round((dia(iso) - dia(ancora.inicio)) / DIA_MS);
if (new Date(dia(ancora.inicio)).getUTCDay() !== 1) {
  throw new Error(`a semana âncora precisa começar numa segunda-feira (${ancora.inicio})`);
}

linhas.push(`with ancora as (
  -- date_trunc('week') devolve a SEGUNDA-feira; app.hoje_local() é a
  -- data local do Brasil (0003), a mesma que a virada usa.
  select date_trunc('week', app.hoje_local())::date as segunda
)
insert into trilha_semanas (id, trilha_id, numero, inicio, fim, foco, simulado, meta_questoes)
select v.id::uuid, ${q(trilhaId)}, v.numero, a.segunda + v.ini, a.segunda + v.fim, v.foco, v.simulado, ${trilha.metaQuestoesSemana}
  from ancora a, (values`);
linhas.push(
  trilha.semanas
    .map((s) => `    (${q(uid(`sem:${trilha.nicho}:v${trilha.versao}:${s.n}`))}, ${s.n}, ${desloc(s.inicio)}, ${desloc(s.fim)}, ${q(s.foco)}, ${q(s.simulado)}::text)`)
    .join(",\n") +
    `\n  ) as v(id, numero, ini, fim, foco, simulado)
  on conflict (trilha_id, numero) do update
     set inicio = excluded.inicio, fim = excluded.fim;\n`
);

linhas.push(`insert into atividades_modelo (id, trilha_id, semana_numero, disciplina_codigo, prioridade, texto, ordem) values`);
const ats = [];
for (const s of trilha.semanas) {
  s.tarefas.forEach((t, i) => {
    ats.push(`  (${q(uid(`atv:${trilha.nicho}:v${trilha.versao}:${s.n}:${i}`))}, ${q(trilhaId)}, ${s.n}, ${q(t.s)}, ${q(t.p)}, ${q(t.t)}, ${i})`);
  });
}
linhas.push(ats.join(",\n") + "\n  on conflict (id) do nothing;\n");

const saida = join(raiz, "supabase/seed/02_trilha_cn.sql");
writeFileSync(saida, linhas.join("\n"));
console.log(`gerado: ${saida} (trilha_id=${trilhaId}, ${ats.length} atividades)`);
