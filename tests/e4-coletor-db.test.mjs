// ============================================================
// ETAPA 4 — coletor de erros no banco (0059)
// ------------------------------------------------------------
// As decisões que precisam valer entre instâncias da Edge Function
// ficam na RPC public.coletor_registrar_erro: limite por chave, teto de
// 24 h, agrupamento por fingerprint, 1 e-mail por grupo por hora e 20 em
// 24 h. Aqui elas rodam de verdade, no Postgres, como service_role.
// Cada teste roda numa transação com rollback; `now()` é fixo dentro da
// transação, então "a hora passou" é simulado recuando os carimbos.
// ============================================================
import test from "node:test";
import assert from "node:assert/strict";
import { pool } from "./identidades.mjs";

test.after(async () => { await pool.end(); });

const FP = "a".repeat(32);
const evento = (extra = {}) => ({
  origem: "react-error-boundary", mensagem: "TypeError: x is undefined", pilha: "at A (index.js:1:2)",
  rota: "/escola", release: "abc123", papel: "coordenacao", correlation_id: "11111111-2222-4333-8444-555555555555", ...extra,
});

async function emTransacao(fn) {
  const c = await pool.connect();
  try {
    await c.query("begin");
    await c.query("set local role service_role");
    return await fn(c);
  } finally {
    await c.query("rollback").catch(() => {});
    c.release();
  }
}

const registrar = (c, { chave = "ip:teste", fp = FP, ev = evento(), pode = true } = {}) =>
  c.query("select public.coletor_registrar_erro($1, $2, $3::jsonb, $4) as r", [chave, fp, JSON.stringify(ev), pode])
    .then((x) => x.rows[0].r);

test("E4/0059: primeiro relato grava a ocorrência, abre o grupo e pede e-mail", async () => {
  await emTransacao(async (c) => {
    const r = await registrar(c);
    assert.equal(r.resultado, "registrado");
    assert.equal(r.enviar_email, true);
    assert.ok(r.email_id);
    assert.equal(r.ocorrencias, 1);
    const o = (await c.query("select * from app.erros_ocorrencias where fingerprint = $1", [FP])).rows;
    assert.equal(o.length, 1);
    assert.equal(o[0].release, "abc123");
    assert.equal(o[0].papel, "coordenacao");
    assert.equal(o[0].correlation_id, "11111111-2222-4333-8444-555555555555");
    const e = (await c.query("select situacao from app.erros_emails where fingerprint = $1", [FP])).rows;
    assert.deepEqual(e.map((x) => x.situacao), ["reservado"]);
  });
});

test("E4/0059: 50 relatos iguais (chaves diferentes) viram 1 grupo com 50 ocorrências e 1 e-mail", async () => {
  await emTransacao(async (c) => {
    let pedidos = 0;
    for (let i = 0; i < 50; i++) {
      const r = await registrar(c, { chave: `ip:${i}` });
      assert.equal(r.resultado, "registrado");
      if (r.enviar_email) pedidos++;
    }
    assert.equal(pedidos, 1, "mais de um e-mail para o mesmo erro na mesma hora");
    const g = (await c.query("select ocorrencias from app.erros_grupos where fingerprint = $1", [FP])).rows[0];
    assert.equal(Number(g.ocorrencias), 50);
    const n = (await c.query("select count(*)::int n from app.erros_ocorrencias where fingerprint = $1", [FP])).rows[0].n;
    assert.equal(n, 50);
  });
});

test("E4/0059: a mesma chave passa de 20 por minuto e é limitada, sem gravar nada", async () => {
  await emTransacao(async (c) => {
    const res = [];
    for (let i = 0; i < 25; i++) res.push((await registrar(c, { chave: "ip:mesmo" })).resultado);
    assert.equal(res.filter((x) => x === "registrado").length, 20);
    assert.equal(res.filter((x) => x === "limitado").length, 5);
    const n = (await c.query("select count(*)::int n from app.erros_ocorrencias")).rows[0].n;
    assert.equal(n, 20, "relato limitado não pode virar ocorrência");
  });
});

test("E4/0059: acima de 600 relatos no minuto, recusa ANTES de criar linha para a chave nova", async () => {
  await emTransacao(async (c) => {
    // quem gira a chave a cada pedido não pode encher app.erros_limite
    await c.query("insert into app.erros_limite (chave, janela, contagem) values ('global', date_trunc('minute', now()), 600)");
    const r = await registrar(c, { chave: "ip:nunca-visto" });
    assert.equal(r.resultado, "limitado");
    const linhas = (await c.query("select count(*)::int n from app.erros_limite where chave = 'ip:nunca-visto'")).rows[0].n;
    assert.equal(linhas, 0, "o pedido recusado pelo teto global criou linha para a chave");
    assert.equal((await c.query("select count(*)::int n from app.erros_ocorrencias")).rows[0].n, 0);
  });
});

test("E4/0059: contar e gravar o teto de 24 h é serializado entre relatos simultâneos", async () => {
  // dois relatos de chaves e fingerprints diferentes, em transações
  // paralelas: o segundo espera o primeiro terminar (não lê a mesma
  // contagem abaixo do teto ao mesmo tempo)
  const a = await pool.connect();
  const b = await pool.connect();
  try {
    await a.query("begin");
    await b.query("begin");
    await a.query("set local role service_role");
    await b.query("set local role service_role");
    await registrar(a, { chave: "ip:a", fp: "c".repeat(32) });
    await b.query("set local statement_timeout = 300");
    await assert.rejects(registrar(b, { chave: "ip:b", fp: "d".repeat(32) }), /statement timeout/);
  } finally {
    await a.query("rollback").catch(() => {});
    await b.query("rollback").catch(() => {});
    a.release();
    b.release();
  }
});

test("E4/0059: depois de 1 hora o mesmo grupo pode mandar outro e-mail", async () => {
  await emTransacao(async (c) => {
    assert.equal((await registrar(c)).enviar_email, true);
    assert.equal((await registrar(c, { chave: "ip:2" })).enviar_email, false);
    await c.query("update app.erros_grupos set ultimo_email_em = now() - interval '61 minutes'");
    await c.query("update app.erros_emails set enviado_em = now() - interval '61 minutes'");
    assert.equal((await registrar(c, { chave: "ip:3" })).enviar_email, true);
  });
});

test("E4/0059: no máximo 20 e-mails em 24 h, somando todos os grupos", async () => {
  await emTransacao(async (c) => {
    let pedidos = 0;
    for (let i = 0; i < 30; i++) {
      const fp = i.toString(16).padStart(32, "0");
      if ((await registrar(c, { chave: `ip:${i}`, fp, ev: evento({ mensagem: `erro ${i}` }) })).enviar_email) pedidos++;
    }
    assert.equal(pedidos, 20);
    const n = (await c.query("select count(*)::int n from app.erros_emails")).rows[0].n;
    assert.equal(n, 20);
  });
});

test("E4/0059: sem configuração de e-mail (p_pode_enviar falso) grava e não reserva e-mail", async () => {
  await emTransacao(async (c) => {
    const r = await registrar(c, { pode: false });
    assert.equal(r.resultado, "registrado");
    assert.equal(r.enviar_email, false);
    const n = (await c.query("select count(*)::int n from app.erros_emails")).rows[0].n;
    assert.equal(n, 0);
  });
});

test("E4/0059: Resend recusou → o grupo é liberado e o próximo relato tenta de novo", async () => {
  await emTransacao(async (c) => {
    const r1 = await registrar(c);
    await c.query("select public.coletor_marcar_email($1, false)", [r1.email_id]);
    const g = (await c.query("select ultimo_email_em from app.erros_grupos where fingerprint = $1", [FP])).rows[0];
    assert.equal(g.ultimo_email_em, null);
    const r2 = await registrar(c, { chave: "ip:2" });
    assert.equal(r2.enviar_email, true);
    await c.query("select public.coletor_marcar_email($1, true)", [r2.email_id]);
    const sit = (await c.query("select situacao from app.erros_emails order by id")).rows.map((x) => x.situacao);
    assert.deepEqual(sit, ["falhou", "enviado"]);
    assert.equal((await registrar(c, { chave: "ip:3" })).enviar_email, false);
  });
});

test("E4/0059: acima de 500 ocorrências em 24 h só conta, e o teto alerta uma vez", async () => {
  await emTransacao(async (c) => {
    await c.query(`insert into app.erros_grupos (fingerprint, origem, mensagem) values ($1, 'x', 'x')`, ["b".repeat(32)]);
    await c.query(`insert into app.erros_ocorrencias (fingerprint, origem, mensagem)
                   select $1, 'x', 'x' from generate_series(1, 500)`, ["b".repeat(32)]);
    const r = await registrar(c, { chave: "ip:novo" });
    assert.equal(r.resultado, "teto");
    assert.equal(r.fingerprint, "teto-diario");
    assert.equal(r.enviar_email, true);
    const r2 = await registrar(c, { chave: "ip:outro" });
    assert.equal(r2.resultado, "teto");
    assert.equal(r2.enviar_email, false);
    const n = (await c.query("select count(*)::int n from app.erros_ocorrencias")).rows[0].n;
    assert.equal(n, 500, "acima do teto nada é gravado como ocorrência");
    const g = (await c.query("select ocorrencias from app.erros_grupos where fingerprint = 'teto-diario'")).rows[0];
    assert.equal(Number(g.ocorrencias), 2);
  });
});

test("E4/0059: papel fora da lista vira 'desconhecido'; campos longos são cortados", async () => {
  await emTransacao(async (c) => {
    await registrar(c, { ev: evento({ papel: "hacker", pilha: "p".repeat(9000), rota: "/" + "r".repeat(400) }) });
    const o = (await c.query("select papel, length(pilha) lp, length(rota) lr from app.erros_ocorrencias")).rows[0];
    assert.equal(o.papel, "desconhecido");
    assert.equal(o.lp, 4000);
    assert.equal(o.lr, 200);
  });
});

test("E4/0059: anon e authenticated não leem, não escrevem e não executam nada do coletor", async () => {
  const c = await pool.connect();
  try {
    for (const papel of ["anon", "authenticated"]) {
      for (const t of ["app.erros_grupos", "app.erros_ocorrencias", "app.erros_emails", "app.erros_limite"]) {
        for (const p of ["SELECT", "INSERT", "UPDATE", "DELETE"]) {
          const r = await c.query("select has_table_privilege($1, $2, $3) as tem", [papel, t, p]);
          assert.equal(r.rows[0].tem, false, `${papel} tem ${p} em ${t}`);
        }
      }
      for (const f of ["public.coletor_registrar_erro(text, text, jsonb, boolean)", "public.coletor_marcar_email(bigint, boolean)"]) {
        const r = await c.query("select has_function_privilege($1, $2, 'EXECUTE') as tem", [papel, f]);
        assert.equal(r.rows[0].tem, false, `${papel} executa ${f}`);
      }
    }
    const rls = await c.query(`select c.relname, c.relrowsecurity from pg_class c join pg_namespace n on n.oid = c.relnamespace
                               where n.nspname = 'app' and c.relname like 'erros_%' and c.relkind = 'r' order by 1`);
    assert.equal(rls.rows.length, 4);
    assert.ok(rls.rows.every((x) => x.relrowsecurity), "RLS desligada em tabela do coletor");
  } finally { c.release(); }
});

test("E4/0059: como authenticated, chamar a RPC dá permission denied", async () => {
  const c = await pool.connect();
  try {
    await c.query("begin");
    await c.query("set local role authenticated");
    await assert.rejects(
      c.query("select public.coletor_registrar_erro('k', $1, '{}'::jsonb, true)", [FP]),
      /permission denied for function/,
    );
  } finally {
    await c.query("rollback").catch(() => {});
    c.release();
  }
});
