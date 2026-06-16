/* Registro de estudo — menos administrativo (ref. designs): registro
   rápido com campos principais (matéria, questões, acertos, minutos) e
   secundários recolhíveis (tópico, observações, data). Resumo do dia
   no topo. Só o aluno escreve; o banco garante isso, não esta tela. */
import React, { useEffect, useMemo, useState } from "react";
import { SectionCard, EmptyState, Botao, Erro, useInputStyle, StatCard } from "../../shared/ui/componentes.jsx";
import { useTema } from "../../shared/branding/BrandingContext.jsx";
import { todayISO } from "../../shared/regras/regras.js";
import { resumirRegistros } from "../../shared/metricas/agregados.js";
import { ListaRegistros } from "../../shared/ui/ListaRegistros.jsx";
import { fmtHoras } from "./jargao.js";
import { mensagemAmigavel } from "../../shared/lib/erros.js";
import * as db from "../../shared/data/index.js";

// Tempo AMIGÁVEL (Fase 4 do doc): aceita "45min", "1h", "1h30", "90".
// Devolve minutos (int) ou null se vazio/não entendido.
export function parseTempo(txt) {
  const s = String(txt ?? "").trim().toLowerCase().replace(",", ".").replace(/\s+/g, "");
  if (!s) return null;
  let m = s.match(/^(\d+)h(\d{1,2})m?$/); // 1h30
  if (m) return +m[1] * 60 + +m[2];
  m = s.match(/^(\d+(?:\.\d+)?)h$/); // 1h, 1.5h
  if (m) return Math.round(+m[1] * 60);
  m = s.match(/^(\d+)(m|min|mins|minutos)?$/); // 45, 45min
  if (m) return +m[1];
  return NaN; // formato não entendido
}

const fmtTempoCurto = (min) => (min >= 60 ? `${Math.floor(min / 60)}h${String(min % 60).padStart(2, "0")}` : `${min}min`);

export function Registrar({ aluno, trilha, registros, aoMudar, minutosSugeridos }) {
  const T = useTema();
  const { input: inputS, label: lbl } = useInputStyle();
  const branco = { data: todayISO(), disciplina_codigo: "mat", topico: "", questoes: "", acertos: "", tempo: "", obs: "" };
  const [f, setF] = useState(branco);
  const [erro, setErro] = useState(null);
  const [ocupado, setOcupado] = useState(false);
  const [maisCampos, setMaisCampos] = useState(false);
  const set = (k, v) => setF({ ...f, [k]: v });

  // o cronômetro do topo manda o tempo direto pra cá, já formatado
  useEffect(() => {
    if (minutosSugeridos > 0) setF((atual) => ({ ...atual, tempo: fmtTempoCurto(minutosSugeridos) }));
  }, [minutosSugeridos]);

  const minutosParse = parseTempo(f.tempo);
  const tempoInvalido = Number.isNaN(minutosParse);
  const acertosDemais = f.acertos !== "" && f.questoes !== "" && +f.acertos > +f.questoes;
  const podeSalvar = f.questoes !== "" && +f.questoes > 0 && f.topico.trim() !== "" && !tempoInvalido && !acertosDemais && !ocupado;

  // resumo do dia
  const hoje = todayISO();
  const resumo = useMemo(() => {
    const ls = registros.filter((r) => String(r.data) === hoje);
    const { questoes, minutos, acc } = resumirRegistros(ls);
    const materias = [...new Set(ls.map((r) => r.disciplina_codigo))]
      .map((c) => trilha.porCodigo[c]?.nome).filter(Boolean);
    return { q: questoes, min: minutos, acc, materias, n: ls.length };
  }, [registros, hoje, trilha]);

  async function adicionar() {
    if (!podeSalvar) return;
    setOcupado(true); setErro(null);
    try {
      const acertos = f.acertos === "" ? null : Math.min(+f.acertos, +f.questoes);
      await db.adicionarRegistro({
        escola_id: aluno.escola_id, aluno_id: aluno.id,
        data: f.data, disciplina_codigo: f.disciplina_codigo,
        topico: f.topico.trim(), questoes: +f.questoes,
        acertos, minutos: minutosParse, obs: f.obs || null,
      });
      setF({ ...branco, data: f.data, disciplina_codigo: f.disciplina_codigo });
      aoMudar?.();
    } catch (e) { setErro(mensagemAmigavel(e, "salvar")); }
    setOcupado(false);
  }

  async function apagar(id) {
    setErro(null);
    try { await db.removerRegistro(id); aoMudar?.(); } catch (e) { setErro(mensagemAmigavel(e, "acao")); }
  }

  const recentes = registros.slice(0, 12);

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
      {/* RESUMO DO DIA */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(150px,1fr))", gap: 10 }}>
        <StatCard rotulo="Questões hoje" valor={resumo.q} icone="✦" tom={resumo.q > 0 ? "neutro" : "neutro"} />
        <StatCard rotulo="Tempo hoje" valor={fmtHoras(resumo.min)} icone="◷" />
        <StatCard rotulo="Acerto hoje" valor={resumo.acc == null ? "—" : `${resumo.acc}%`} icone="◎"
          tom={resumo.acc == null ? "neutro" : resumo.acc >= 70 ? "ok" : "alerta"} />
        <StatCard rotulo="Matérias" valor={resumo.materias.length} icone="📚"
          sub={resumo.materias.length ? resumo.materias.slice(0, 2).join(", ") + (resumo.materias.length > 2 ? "…" : "") : "nenhuma ainda"} />
      </div>

      {/* REGISTRO RÁPIDO */}
      <SectionCard titulo="Registro rápido" sub="Lance o que estudou agora — leva segundos.">
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(140px,1fr))", gap: 12 }}>
          <div style={{ gridColumn: "1 / -1" }}>
            <label style={lbl}>Matéria</label>
            <select value={f.disciplina_codigo} onChange={(e) => set("disciplina_codigo", e.target.value)} style={inputS}>
              {trilha.disciplinas.map((s) => <option key={s.codigo} value={s.codigo} style={{ background: T.bg2 }}>{s.nome}</option>)}
            </select>
          </div>
          <div style={{ gridColumn: "1 / -1" }}>
            <label style={lbl}>Tópico <span style={{ color: T.gold }}>*</span></label>
            <input value={f.topico} onChange={(e) => set("topico", e.target.value)} placeholder="ex: divisibilidade — MDC e MMC" style={inputS} />
          </div>
          <div><label style={lbl}>Questões</label><input type="number" inputMode="numeric" min="0" value={f.questoes} onChange={(e) => set("questoes", e.target.value)} placeholder="0" style={inputS} /></div>
          <div>
            <label style={lbl}>Acertos</label>
            <input type="number" inputMode="numeric" min="0" value={f.acertos} onChange={(e) => set("acertos", e.target.value)} placeholder="0"
              style={{ ...inputS, borderColor: acertosDemais ? T.red : T.line }} />
          </div>
          <div>
            <label style={lbl}>Tempo</label>
            <input value={f.tempo} onChange={(e) => set("tempo", e.target.value)} placeholder="1h30, 45min…"
              style={{ ...inputS, borderColor: tempoInvalido ? T.red : minutosSugeridos > 0 && f.tempo ? T.gold : T.line }} />
          </div>
        </div>
        {acertosDemais && <div style={{ fontSize: 12, color: T.red, marginTop: 8 }}>Acertos não podem passar do número de questões.</div>}
        {tempoInvalido && <div style={{ fontSize: 12, color: T.red, marginTop: 8 }}>Tempo não entendido — use formatos como “45min”, “1h” ou “1h30”.</div>}
        {!tempoInvalido && minutosParse > 0 && <div style={{ fontSize: 11.5, color: T.sub, marginTop: 8 }}>◷ {minutosParse} minutos {minutosSugeridos > 0 ? "— puxado do cronômetro, pode ajustar" : ""}</div>}

        <button onClick={() => setMaisCampos((v) => !v)}
          style={{ marginTop: 12, border: "none", background: "transparent", color: T.gold, fontSize: 12.5, fontWeight: 600, padding: "4px 0" }}>
          {maisCampos ? "− Menos campos" : "+ Observação e data"}
        </button>
        {maisCampos && (
          <div style={{ display: "grid", gap: 12, marginTop: 4 }}>
            <div><label style={lbl}>Observações</label><input value={f.obs} onChange={(e) => set("obs", e.target.value)} placeholder="onde travou, o que revisar…" style={inputS} /></div>
            <div style={{ maxWidth: 200 }}><label style={lbl}>Data</label><input type="date" value={f.data} onChange={(e) => set("data", e.target.value)} style={inputS} /></div>
          </div>
        )}

        <Botao onClick={adicionar} disabled={!podeSalvar} style={{ marginTop: 14, width: "100%" }}>
          {ocupado ? "Salvando…" : "✓ Adicionar registro"}
        </Botao>
        {f.questoes !== "" && +f.questoes > 0 && f.topico.trim() === "" && (
          <div style={{ fontSize: 12, color: T.sub, marginTop: 8 }}>Falta o <b style={{ color: T.gold }}>tópico</b> — ele alimenta seu histórico e o radar de desempenho.</div>
        )}
        <Erro>{erro}</Erro>
      </SectionCard>

      {/* RECENTES */}
      <SectionCard titulo="Registros recentes" semPadding>
        {recentes.length === 0 ? (
          <div style={{ padding: 8 }}><EmptyState icone="✎" titulo="Nada registrado ainda" dica="Seu primeiro registro aparece aqui e alimenta o radar de desempenho." /></div>
        ) : (
          <ListaRegistros registros={recentes} porCodigo={trilha.porCodigo} aoApagar={apagar} rotuloAcerto />
        )}
      </SectionCard>
    </div>
  );
}
