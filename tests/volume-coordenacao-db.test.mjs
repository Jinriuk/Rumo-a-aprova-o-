// ============================================================
// VOLUME DA COORDENAÇÃO (Fase B-min, B.7/B.8) — cria uma escola
// descartável com ~150 alunos sintéticos e prova que: (a) a
// agregação por escola continua íntegra e isolada nesse volume,
// (b) os índices de escala (migration 0023) existem, e (c) a
// consulta mais pesada da Área da Escola não trava (latência
// dentro de um teto generoso). Limpa tudo no final.
// ============================================================
import test from "node:test";
import assert from "node:assert/strict";
import { pool, como, comoServidor, ESCOLA_A } from "./identidades.mjs";

const ESCOLA_VOL = "99999999-9999-4999-8999-000000000001";
const COORD_VOL  = { sub: "99999999-9999-4999-8999-000000000002", escola_id: ESCOLA_VOL, papel: "coordenacao" };
const N_ALUNOS = 150;

test.before(async () => {
  await comoServidor((c) => c.query(`
    do $$
    declare
      v_escola constant uuid := '${ESCOLA_VOL}';
      v_coord  constant uuid := '${COORD_VOL.sub}';
      v_aluno  uuid;
      i        int;
    begin
      insert into escolas (id, nome, slug) values (v_escola, 'Escola Teste Volume', 'teste-volume-bmin')
        on conflict (id) do nothing;
      insert into usuarios (id, escola_id, papel, nome) values (v_coord, v_escola, 'coordenacao', 'Coord Teste Volume')
        on conflict (id) do nothing;

      for i in 1..${N_ALUNOS} loop
        v_aluno := ('99999999-9999-4999-8999-' || lpad((1000 + i)::text, 12, '0'))::uuid;
        insert into alunos (id, escola_id, nome) values (v_aluno, v_escola, 'Aluno Teste Volume ' || i)
          on conflict (id) do nothing;
        insert into registros_estudo (id, escola_id, aluno_id, data, disciplina_codigo, questoes, acertos)
          values (('98989898-9898-4898-8898-' || lpad(i::text, 12, '0'))::uuid,
                  v_escola, v_aluno, app.hoje_local(), 'mat', 10 + (i % 10), 8)
          on conflict (id) do nothing;
      end loop;
    end $$;
  `));
});

test.after(async () => {
  // cascade: alunos/usuarios -> alunos_turmas/registros_estudo/metas/... -> escolas
  await comoServidor((c) => c.query("delete from escolas where id = $1", [ESCOLA_VOL]));
  await pool.end();
});

test("resumo_escola: agrega os ~150 alunos sintéticos sem vazar para outra escola", async () => {
  const obtido = await como(COORD_VOL, (c) => c.query("select * from public.resumo_escola()"));
  assert.equal(obtido.rows.length, N_ALUNOS, "deveria devolver uma linha por aluno sintético");
  for (const row of obtido.rows) {
    assert.notEqual(row.aluno_id, undefined);
  }
});

test("resumo_escola: isolamento se mantém com a escola de volume e com a escola A coexistindo", async () => {
  const idsVol = new Set((await comoServidor((c) =>
    c.query("select id from alunos where escola_id = $1", [ESCOLA_VOL]))).rows.map((r) => r.id));
  const obtidoVol = await como(COORD_VOL, (c) => c.query("select aluno_id from public.resumo_escola()"));
  for (const row of obtidoVol.rows) {
    assert.ok(idsVol.has(row.aluno_id), `coordenação de volume viu aluno fora da própria escola: ${row.aluno_id}`);
  }

  const idsA = new Set((await comoServidor((c) =>
    c.query("select id from alunos where escola_id = $1", [ESCOLA_A]))).rows.map((r) => r.id));
  const semInterseccao = [...idsVol].every((id) => !idsA.has(id));
  assert.ok(semInterseccao, "ids sintéticos colidiram com ids da escola A — risco de teste falso-positivo");
});

test("migration 0023: índices de escala em escola_id existem para registros_estudo/metas/simulados/consentimentos", async () => {
  const r = await comoServidor((c) => c.query(`
    select indexname from pg_indexes
    where schemaname = 'public'
      and indexname in ('idx_registros_escola', 'idx_metas_escola_status', 'idx_simulados_escola', 'idx_consentimentos_escola')
  `));
  const achados = new Set(r.rows.map((x) => x.indexname));
  for (const nome of ["idx_registros_escola", "idx_metas_escola_status", "idx_simulados_escola", "idx_consentimentos_escola"]) {
    assert.ok(achados.has(nome), `índice ${nome} (migration 0023) não existe`);
  }
});

test("resumo_escola: latência com ~150 alunos fica num teto generoso (não trava o piloto)", async () => {
  const inicio = Date.now();
  await como(COORD_VOL, (c) => c.query("select * from public.resumo_escola()"));
  const ms = Date.now() - inicio;
  assert.ok(ms < 3000, `resumo_escola() levou ${ms}ms com ${N_ALUNOS} alunos — acima do teto de 3000ms`);
});
