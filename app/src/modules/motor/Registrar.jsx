/* Registro de estudo (questões, acertos, tempo) — portado da versão
   atual. Só o aluno escreve; o banco garante isso, não esta tela. */
import React, { useEffect, useState } from "react";
import { Card, Empty, Botao, Erro, useInputStyle } from "../../shared/ui/componentes.jsx";
import { useTema } from "../../shared/branding/BrandingContext.jsx";
import { todayISO, fmtBR } from "../../shared/regras/regras.js";
import * as db from "../../shared/data/index.js";

export function Registrar({ aluno, trilha, registros, aoMudar, minutosSugeridos }) {
  const T = useTema();
  const { input: inputS, label: lbl } = useInputStyle();
  const branco = { data: todayISO(), disciplina_codigo: "mat", topico: "", questoes: "", acertos: "", minutos: "", obs: "" };
  const [f, setF] = useState(branco);
  const [erro, setErro] = useState(null);
  const [ocupado, setOcupado] = useState(false);
  const set = (k, v) => setF({ ...f, [k]: v });

  // o cronômetro do topo manda os minutos direto pra cá
  useEffect(() => {
    if (minutosSugeridos > 0) setF((atual) => ({ ...atual, minutos: String(minutosSugeridos) }));
  }, [minutosSugeridos]);

  async function adicionar() {
    if (!f.questoes || +f.questoes <= 0 || ocupado) return;
    setOcupado(true); setErro(null);
    try {
      const acertos = f.acertos === "" ? null : Math.min(+f.acertos, +f.questoes);
      await db.adicionarRegistro({
        escola_id: aluno.escola_id, aluno_id: aluno.id,
        data: f.data, disciplina_codigo: f.disciplina_codigo,
        topico: f.topico || null, questoes: +f.questoes,
        acertos, minutos: f.minutos === "" ? null : +f.minutos, obs: f.obs || null,
      });
      setF({ ...f, topico: "", questoes: "", acertos: "", minutos: "", obs: "" });
      aoMudar?.();
    } catch (e) { setErro(e.message); }
    setOcupado(false);
  }

  async function apagar(id) {
    setErro(null);
    try { await db.removerRegistro(id); aoMudar?.(); } catch (e) { setErro(e.message); }
  }

  const recentes = registros.slice(0, 12);

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
      <Card>
        <div className="disp" style={{ fontSize: 16, fontWeight: 700, marginBottom: 14 }}>Registrar estudo do dia</div>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(140px,1fr))", gap: 12 }}>
          <div><label style={lbl}>Data</label><input type="date" value={f.data} onChange={(e) => set("data", e.target.value)} style={inputS} /></div>
          <div><label style={lbl}>Matéria</label>
            <select value={f.disciplina_codigo} onChange={(e) => set("disciplina_codigo", e.target.value)} style={inputS}>
              {trilha.disciplinas.map((s) => <option key={s.codigo} value={s.codigo} style={{ background: T.bg2 }}>{s.nome}</option>)}
            </select>
          </div>
          <div style={{ gridColumn: "1 / -1" }}><label style={lbl}>Tópico (opcional)</label><input value={f.topico} onChange={(e) => set("topico", e.target.value)} placeholder="ex: geometria — ângulo inscrito" style={inputS} /></div>
          <div><label style={lbl}>Questões feitas</label><input type="number" inputMode="numeric" min="0" value={f.questoes} onChange={(e) => set("questoes", e.target.value)} placeholder="0" style={inputS} /></div>
          <div><label style={lbl}>Acertos</label><input type="number" inputMode="numeric" min="0" value={f.acertos} onChange={(e) => set("acertos", e.target.value)} placeholder="0" style={inputS} /></div>
          <div><label style={lbl}>Minutos</label><input type="number" inputMode="numeric" min="0" value={f.minutos} onChange={(e) => set("minutos", e.target.value)} placeholder="opcional" style={inputS} /></div>
        </div>
        <div style={{ marginTop: 12 }}><label style={lbl}>Observações</label><input value={f.obs} onChange={(e) => set("obs", e.target.value)} placeholder="onde travou, o que revisar…" style={inputS} /></div>
        <Botao onClick={adicionar} disabled={!f.questoes || +f.questoes <= 0 || ocupado} style={{ marginTop: 14 }}>
          {ocupado ? "Salvando…" : "+ Adicionar registro"}
        </Botao>
        <Erro>{erro}</Erro>
      </Card>

      <Card>
        <div className="disp" style={{ fontSize: 15, fontWeight: 700, marginBottom: 10 }}>Registros recentes</div>
        {recentes.length === 0 ? <Empty txt="Nenhum registro ainda." /> : (
          <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
            {recentes.map((l) => {
              const s = trilha.porCodigo[l.disciplina_codigo];
              const acc = l.acertos !== null && l.questoes ? Math.round((l.acertos / l.questoes) * 100) : null;
              return (
                <div key={l.id} className="row" style={{ display: "flex", alignItems: "center", gap: 10, padding: "10px 8px", borderRadius: 8, borderBottom: `1px solid ${T.line}` }}>
                  <span style={{ width: 9, height: 9, borderRadius: 3, background: s?.cor, flexShrink: 0 }} />
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 13.5, color: T.ink }}>{s?.nome}{l.topico ? <span style={{ color: T.sub }}> · {l.topico}</span> : null}</div>
                    <div style={{ fontSize: 11.5, color: T.sub }}>{fmtBR(String(l.data))} · {l.questoes} questões{acc !== null ? ` · ${acc}% acerto` : ""}{l.minutos ? ` · ${l.minutos}min` : ""}</div>
                  </div>
                  <button onClick={() => apagar(l.id)} aria-label="Apagar registro" style={{ background: "transparent", border: "none", color: T.sub, fontSize: 22, width: 44, height: 44, flexShrink: 0, lineHeight: 1 }}>×</button>
                </div>
              );
            })}
          </div>
        )}
      </Card>
    </div>
  );
}
