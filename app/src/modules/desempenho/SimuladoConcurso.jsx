/* ============================================================
   SIMULADO NO FORMATO DO CONCURSO (Fase 15.6 ligada à tela)
   ------------------------------------------------------------
   Quando o concurso-alvo tem modelo de eliminação e/ou papel de
   redação (concursos militares: CN, EPCAR, EsPCEx, ESA, EEAr), o
   aluno registra acertos por matéria/dia + nota da redação e vê o
   diagnóstico no formato REAL da prova: nota por dia, alerta de
   eliminação (absoluto × mediana sem corte inventado), avaliação da
   redação no papel certo e objetivo sugerido. Toda a regra vem de
   conteudo/simuladoConcurso.js (lógica pura); aqui só apresenta e
   persiste (via seam, colunas exam_tag/redacao_nota da migration 0014).
   Sem formato de concurso, a VisaoEstudo mantém o simulado genérico.
   ============================================================ */
import React, { useId, useMemo, useState } from "react";
import { Card, Empty, StatusBadge } from "../../shared/ui/componentes.jsx";
import { useTema } from "../../shared/branding/BrandingContext.jsx";
import { todayISO, fmtBR } from "../../shared/regras/regras.js";
import { mensagemAmigavel } from "../../shared/lib/erros.js";
import { materiasObjetivas, materiasPorDia } from "../conteudo/estruturaProva.js";
import { avaliarSimulado } from "../conteudo/simuladoConcurso.js";
import { rotuloRedacao, rotuloEliminacao } from "../conteudo/pedagogia.js";
import * as db from "../../shared/data/index.js";

const NOME_MATERIA = {
  mat: "Matemática", por: "Português", ing: "Inglês", red: "Redação", fis: "Física",
  qui: "Química", bio: "Biologia", his: "História", geo: "Geografia", soc: "Estudos Sociais",
};
const nomeMateria = (cod) => NOME_MATERIA[cod] ?? (cod ? cod.toUpperCase() : "—");

// próximo "Simulado N" livre, sem duplicar o default.
function proximoNome(simulados) {
  let max = 0;
  for (const s of simulados ?? []) {
    const mt = String(s?.nome ?? "").match(/^Simulado\s+(\d+)$/i);
    if (mt) max = Math.max(max, +mt[1]);
  }
  return `Simulado ${max + 1}`;
}

export function SimuladoConcurso({ aluno, simulados, podeEditar, semanaAtiva, concurso, estrutura, cfg, aoMudar }) {
  const T = useTema();
  const materias = estrutura?.materias ?? [];
  const dias = estrutura?.dias ?? [];
  const objetivas = materiasObjetivas(materias);
  const temRedacao = cfg?.redacao_role && cfg.redacao_role !== "ausente";
  const grupos = materiasPorDia(objetivas, dias);

  // só os simulados deste concurso entram no diagnóstico por formato.
  const meus = useMemo(
    () => (simulados ?? []).filter((s) => !s.exam_tag || s.exam_tag === concurso?.codigo),
    [simulados, concurso?.codigo],
  );

  const blank = {
    nome: semanaAtiva?.simulado || proximoNome(meus),
    data: todayISO(),
    redacao: "",
    ...Object.fromEntries(objetivas.map((m) => [m.materia_codigo, ""])),
  };
  const [f, setF] = useState(blank);
  const [erro, setErro] = useState(null);
  const set = (k, v) => setF((p) => ({ ...p, [k]: v }));
  const uid = useId();
  const id = (k) => `${uid}-${k}`;

  const inputS = { background: T.bg, border: `1px solid ${T.line}`, color: T.ink, borderRadius: 8, padding: "12px 12px", fontSize: 16, width: "100%", minHeight: 46 };
  const lbl = { fontSize: 11, color: T.sub, marginBottom: 4, display: "block" };

  // validação crítica: acertos não passam do máximo da matéria.
  const estouros = objetivas.filter((m) => f[m.materia_codigo] !== "" && +f[m.materia_codigo] > (m.num_questoes ?? 0));

  async function adicionar() {
    if (estouros.length) return;
    setErro(null);
    try {
      await db.adicionarSimulado({
        escola_id: aluno.escola_id, aluno_id: aluno.id, nome: f.nome, data: f.data,
        exam_tag: concurso?.codigo ?? null,
        redacao_nota: temRedacao && f.redacao !== "" ? +f.redacao : null,
        acertos: Object.fromEntries(objetivas.map((m) => [m.materia_codigo, Math.min(+f[m.materia_codigo] || 0, m.num_questoes ?? 0)])),
      });
      setF({ ...blank, nome: semanaAtiva?.simulado || proximoNome([...meus, { nome: f.nome }]) });
      aoMudar?.();
    } catch (e) { setErro(mensagemAmigavel(e, "salvar")); }
  }

  async function apagar(simId) {
    setErro(null);
    try { await db.removerSimulado(simId); aoMudar?.(); }
    catch (e) { setErro(mensagemAmigavel(e, "acao")); }
  }

  // diagnóstico do ÚLTIMO simulado do concurso, no formato real.
  const ultimo = meus.length
    ? [...meus].sort((a, b) => String(a.data).localeCompare(String(b.data)))[meus.length - 1]
    : null;
  const aval = useMemo(() => {
    if (!ultimo) return null;
    return avaliarSimulado({
      materias,
      acertos: ultimo.acertos ?? {},
      redacaoNota: ultimo.redacao_nota != null ? Number(ultimo.redacao_nota) : null,
      concurso: { elimination_model: cfg?.elimination_model, redacao_role: cfg?.redacao_role },
    });
  }, [ultimo, materias, cfg?.elimination_model, cfg?.redacao_role]);

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
      <div style={{ fontSize: 11.5, color: T.sub, lineHeight: 1.5 }}>
        Formato {concurso?.nome?.split(" (")[0] ?? concurso?.codigo?.toUpperCase()} ·
        eliminação: <b style={{ color: T.ink }}>{rotuloEliminacao(cfg?.elimination_model)}</b>
        {cfg?.redacao_role && <> · redação: <b style={{ color: T.ink }}>{rotuloRedacao(cfg.redacao_role)}</b></>}
      </div>

      {/* DIAGNÓSTICO do último simulado no formato do concurso */}
      {aval && ultimo && (
        <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          {/* objetivo + nota por dia */}
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(220px,1fr))", gap: 10 }}>
            <div style={{ background: T.card, border: `1px solid ${T.line}`, borderLeft: `4px solid ${T.green}`, borderRadius: 10, padding: "11px 13px" }}>
              <div style={{ fontSize: 10.5, color: T.sub, textTransform: "uppercase", letterSpacing: 0.4, fontWeight: 700 }}>🎯 Objetivo sugerido</div>
              <div style={{ fontSize: 13.5, fontWeight: 600, marginTop: 4, lineHeight: 1.45 }}>{aval.objetivo}</div>
              <div style={{ fontSize: 11, color: T.sub, marginTop: 6 }}>com base em {ultimo.nome} · {fmtBR(String(ultimo.data))}</div>
            </div>
            <div style={{ background: T.card, border: `1px solid ${T.line}`, borderLeft: `4px solid ${T.gold}`, borderRadius: 10, padding: "11px 13px" }}>
              <div style={{ fontSize: 10.5, color: T.sub, textTransform: "uppercase", letterSpacing: 0.4, fontWeight: 700 }}>Nota por dia</div>
              <div style={{ display: "flex", flexWrap: "wrap", gap: 10, marginTop: 6 }}>
                {aval.porDia.map((d) => (
                  <div key={d.dia ?? "u"} className="num" style={{ fontSize: 12.5 }}>
                    <span style={{ color: T.sub }}>{d.dia ? `Dia ${d.dia}` : "Prova"}: </span>
                    <b className="disp" style={{ color: T.gold }}>{d.acertos}/{d.max}</b>
                    {d.pontos ? <span style={{ color: T.sub }}> · {d.pontos} pts</span> : null}
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* alertas de eliminação / redação */}
          {aval.alertas.length > 0 ? (
            <div style={{ background: `${T.red}10`, border: `1px solid ${T.red}55`, borderRadius: 10, padding: "11px 13px" }}>
              <div style={{ fontSize: 11, color: T.red, fontWeight: 700, textTransform: "uppercase", letterSpacing: 0.4 }}>⚠ Risco no formato do concurso</div>
              <ul style={{ margin: "8px 0 0", paddingLeft: 18, fontSize: 12.5, color: T.ink, lineHeight: 1.55 }}>
                {aval.alertas.map((a, i) => (
                  <li key={i}>
                    {a.tipo === "eliminacao"
                      ? <>Eliminação em <b>{nomeMateria(a.materia)}</b> ({a.pct}%){a.critico ? " — abaixo do piso oficial" : " — abaixo do proxy de mediana"}.</>
                      : <>Redação <b>inapta</b> — abaixo do mínimo eliminatório.</>}
                  </li>
                ))}
              </ul>
              {aval.eliminacao?.tipo === "relativo" && (
                <div style={{ fontSize: 11, color: T.sub, marginTop: 8, lineHeight: 1.5 }}>{aval.eliminacao.aviso}</div>
              )}
            </div>
          ) : (
            <div style={{ background: `${T.green}10`, border: `1px solid ${T.green}55`, borderRadius: 10, padding: "11px 13px", fontSize: 12.5, color: T.ink }}>
              ✓ Sem risco de eliminação no último simulado{temRedacao ? " (redação inclusa)" : ""}.
            </div>
          )}

          {/* avaliação da redação (quando o concurso tem) */}
          {temRedacao && (
            <div style={{ background: T.card, border: `1px solid ${T.line}`, borderRadius: 10, padding: "11px 13px" }}>
              <div style={{ fontSize: 10.5, color: T.sub, textTransform: "uppercase", letterSpacing: 0.4, fontWeight: 700 }}>Redação — {rotuloRedacao(aval.redacao.papel)}</div>
              <div style={{ fontSize: 13, marginTop: 5 }}>
                {aval.redacao.presente
                  ? <>Nota <b className="num" style={{ color: aval.redacao.apto ? T.green : T.red }}>{aval.redacao.nota}</b> · {aval.redacao.apto ? "apta" : "inapta"}{aval.redacao.pontosClassificatorios ? ` · +${aval.redacao.pontosClassificatorios} classificatórios` : ""}</>
                  : <span style={{ color: T.sub }}>Sem nota de redação registrada neste simulado.</span>}
              </div>
            </div>
          )}
        </div>
      )}

      {/* REGISTRO no formato do concurso */}
      {podeEditar && objetivas.length > 0 && (
        <Card>
          <div className="disp" style={{ fontSize: 15, fontWeight: 700, marginBottom: 4 }}>Registrar simulado — formato {concurso?.codigo?.toUpperCase()}</div>
          <div style={{ fontSize: 11.5, color: T.sub, marginBottom: 12 }}>
            Acertos por matéria, com o máximo de cada prova. {temRedacao ? "Inclua a nota da redação." : ""}
          </div>
          <div style={{ display: "flex", gap: 10, flexWrap: "wrap", marginBottom: 12 }}>
            <div style={{ flex: 2, minWidth: 160 }}><label htmlFor={id("nome")} style={lbl}>Nome</label><input id={id("nome")} value={f.nome} onChange={(e) => set("nome", e.target.value)} style={inputS} /></div>
            <div style={{ flex: 1, minWidth: 130 }}><label htmlFor={id("data")} style={lbl}>Data</label><input id={id("data")} type="date" value={f.data} onChange={(e) => set("data", e.target.value)} style={inputS} /></div>
          </div>
          {grupos.map((g) => (
            <div key={g.numero ?? "u"} style={{ marginBottom: 12 }}>
              <div style={{ fontSize: 11, color: T.gold, fontWeight: 700, textTransform: "uppercase", letterSpacing: 0.5, marginBottom: 8 }}>{g.nome ?? (g.numero ? `Dia ${g.numero}` : "Prova")}</div>
              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(120px,1fr))", gap: 10 }}>
                {g.materias.map((m) => {
                  const max = m.num_questoes ?? 0;
                  const estourou = f[m.materia_codigo] !== "" && +f[m.materia_codigo] > max;
                  return (
                    <div key={m.materia_codigo}>
                      <label htmlFor={id(m.materia_codigo)} style={lbl}>{nomeMateria(m.materia_codigo)} <b style={{ color: T.sub }}>/{max}</b></label>
                      <input id={id(m.materia_codigo)} type="number" inputMode="numeric" min="0" max={max} value={f[m.materia_codigo]} onChange={(e) => set(m.materia_codigo, e.target.value)} placeholder="0"
                        aria-invalid={estourou ? true : undefined}
                        style={{ ...inputS, borderColor: estourou ? T.red : T.line }} />
                    </div>
                  );
                })}
              </div>
            </div>
          ))}
          {temRedacao && (
            <div style={{ marginBottom: 12 }}>
              <div style={{ fontSize: 11, color: T.gold, fontWeight: 700, textTransform: "uppercase", letterSpacing: 0.5, marginBottom: 8 }}>Redação ({rotuloRedacao(cfg.redacao_role)})</div>
              <div style={{ maxWidth: 180 }}>
                <label htmlFor={id("redacao")} style={lbl}>Nota da redação</label>
                <input id={id("redacao")} type="number" inputMode="decimal" min="0" step="0.5" value={f.redacao} onChange={(e) => set("redacao", e.target.value)} placeholder="—" style={inputS} />
              </div>
            </div>
          )}
          {estouros.length > 0 && (
            <div style={{ color: T.red, fontSize: 12.5, marginBottom: 10 }}>
              ⚠ {estouros.map((m) => `${nomeMateria(m.materia_codigo)} tem no máximo ${m.num_questoes} questões`).join(" · ")}
            </div>
          )}
          <button onClick={adicionar} disabled={estouros.length > 0}
            style={{ background: estouros.length ? T.line : T.gold, color: estouros.length ? T.sub : "#0A1622", border: "none", borderRadius: 8, padding: "13px 20px", minHeight: 48, fontWeight: 700, fontSize: 15, width: "100%" }}>
            + Salvar simulado
          </button>
          {erro && <div style={{ color: T.red, fontSize: 13, marginTop: 10 }}>{erro}</div>}
        </Card>
      )}

      {/* HISTÓRICO */}
      <Card>
        <div className="disp" style={{ fontSize: 15, fontWeight: 700, marginBottom: 10 }}>Histórico</div>
        {meus.length === 0 ? <Empty txt="Nenhum simulado registrado ainda. Registre o primeiro acima." /> : (
          <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
            {[...meus].reverse().map((s) => {
              const r = avaliarSimulado({
                materias, acertos: s.acertos ?? {},
                redacaoNota: s.redacao_nota != null ? Number(s.redacao_nota) : null,
                concurso: { elimination_model: cfg?.elimination_model, redacao_role: cfg?.redacao_role },
              });
              const totMax = r.porMateria.reduce((a, l) => a + l.max, 0);
              const totAc = r.porMateria.reduce((a, l) => a + l.acertos, 0);
              const emRisco = r.alertas.length;
              return (
                <div key={s.id} className="row" style={{ display: "flex", alignItems: "center", gap: 10, padding: "10px 8px", borderRadius: 8, borderBottom: `1px solid ${T.line}` }}>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ display: "flex", gap: 4, alignItems: "baseline", overflow: "hidden" }}>
                      <span style={{ fontSize: 13.5, fontWeight: 600, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", minWidth: 0, flex: 1 }}>{s.nome}</span>
                      <span style={{ fontSize: 13.5, color: T.sub, fontWeight: 400, flexShrink: 0 }}>· {fmtBR(String(s.data))}</span>
                    </div>
                    <div style={{ fontSize: 11.5, color: T.sub, marginTop: 2, display: "flex", gap: 6, flexWrap: "wrap", alignItems: "center" }}>
                      <span>{totAc}/{totMax} acertos</span>
                      {s.redacao_nota != null && <span>· redação {Number(s.redacao_nota)}</span>}
                      {emRisco > 0 ? <StatusBadge tom="risco">{emRisco} risco{emRisco > 1 ? "s" : ""}</StatusBadge> : <StatusBadge tom="ok">sem risco</StatusBadge>}
                    </div>
                  </div>
                  {podeEditar && <button onClick={() => apagar(s.id)} aria-label="Apagar simulado" style={{ background: "transparent", border: "none", color: T.sub, fontSize: 22, width: 44, height: 44, flexShrink: 0, lineHeight: 1 }}>×</button>}
                </div>
              );
            })}
          </div>
        )}
      </Card>
    </div>
  );
}
