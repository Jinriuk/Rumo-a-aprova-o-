/* Registro de estudo — menos administrativo (ref. designs): registro
   rápido com campos principais (matéria, questões, acertos, minutos) e
   secundários recolhíveis (tópico, observações, data). Resumo do dia
   no topo. Só o aluno escreve; o banco garante isso, não esta tela. */
import React, { useEffect, useId, useMemo, useState } from "react";
import { SectionCard, EmptyState, Botao, Erro, useInputStyle, StatCard, Toast, useToast } from "../../shared/ui/componentes.jsx";
import { useTema } from "../../shared/branding/BrandingContext.jsx";
import { todayISO } from "../../shared/regras/regras.js";
import { resumirRegistros } from "../../shared/metricas/agregados.js";
import { ListaRegistros } from "../../shared/ui/ListaRegistros.jsx";
import { fmtHoras } from "./jargao.js";
import { mensagemAmigavel } from "../../shared/lib/erros.js";
import { useEnvioUnico } from "../../shared/hooks/useEnvioUnico.js";
import { parseTempo, validarRegistroEstudo } from "../../shared/contratos/registroEstudo.js";
import * as db from "../../shared/data/index.js";

// parseTempo e a validação do payload moram agora no contrato
// shared/contratos/registroEstudo.js (lógica pura, testável fora do
// React). Reexportado aqui para não quebrar quem importava daqui.
export { parseTempo };

const fmtTempoCurto = (min) => (min >= 60 ? `${Math.floor(min / 60)}h${String(min % 60).padStart(2, "0")}` : `${min}min`);

export function Registrar({ aluno, trilha, registros, aoMudar, minutosSugeridos }) {
  const T = useTema();
  const { input: inputS, label: lbl } = useInputStyle();
  const branco = { data: todayISO(), disciplina_codigo: "mat", topico: "", questoes: "", acertos: "", tempo: "", obs: "" };
  const [f, setF] = useState(branco);
  // Envio único: trava síncrona contra duplo clique no "Adicionar"
  // (FE1, tarefa 82). `erro`/`setErro` vêm do hook (camada comum).
  const { ocupado, erro, setErro, enviar } = useEnvioUnico("salvar");
  const [maisCampos, setMaisCampos] = useState(false);
  const set = (k, v) => setF({ ...f, [k]: v });
  // confirmação visível de que o registro foi salvo (AV2 MEL-P3-001).
  const { toast, mostrar, fechar } = useToast();
  const uid = useId();
  const id = (k) => `${uid}-${k}`;

  // o cronômetro do topo manda o tempo direto pra cá, já formatado
  useEffect(() => {
    if (minutosSugeridos > 0) setF((atual) => ({ ...atual, tempo: fmtTempoCurto(minutosSugeridos) }));
  }, [minutosSugeridos]);

  // Verdade da validação vem do contrato (mesma regra do payload que
  // vai ao banco). As dicas inline de borda derivam dela.
  const validacao = useMemo(() => validarRegistroEstudo(f), [f]);
  const minutosParse = parseTempo(f.tempo);
  const tempoInvalido = !!validacao.erros.tempo;
  const acertosDemais = !!validacao.erros.acertos;
  const podeSalvar = validacao.ok && !ocupado;

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
    const v = validarRegistroEstudo(f);
    if (!v.ok) { setErro(Object.values(v.erros)[0]); return; }
    // enviar() é a trava: um segundo clique no mesmo tick é ignorado.
    await enviar(async () => {
      await db.adicionarRegistro({ escola_id: aluno.escola_id, aluno_id: aluno.id, ...v.campos });
      setF({ ...branco, data: f.data, disciplina_codigo: f.disciplina_codigo });
      aoMudar?.();
      mostrar("Registro salvo! Já entrou no seu desempenho.", "ok");
    });
  }

  async function apagar(id) {
    // #18 — confirmação obrigatória: um toque acidental no × (sobretudo em
    // mobile) não pode apagar um registro de estudo sem aviso.
    if (typeof window !== "undefined" && !window.confirm("Remover este registro de estudo? Esta ação não pode ser desfeita.")) return;
    setErro(null);
    try { await db.removerRegistro(id); aoMudar?.(); } catch (e) { setErro(mensagemAmigavel(e, "acao")); }
  }

  const [limiteRecentes, setLimiteRecentes] = useState(7);
  const recentes = registros.slice(0, limiteRecentes);
  const temMaisRecentes = registros.length > limiteRecentes;

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
      {toast && <Toast texto={toast.texto} tom={toast.tom} aoFechar={fechar} />}
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
            <label htmlFor={id("mat")} style={lbl}>Matéria</label>
            <select id={id("mat")} value={f.disciplina_codigo} onChange={(e) => set("disciplina_codigo", e.target.value)} style={inputS}>
              {trilha.disciplinas.map((s) => <option key={s.codigo} value={s.codigo} style={{ background: T.bg2 }}>{s.nome}</option>)}
            </select>
          </div>
          <div style={{ gridColumn: "1 / -1" }}>
            <label htmlFor={id("top")} style={lbl}>Tópico <span style={{ color: T.gold }}>*</span></label>
            <input id={id("top")} value={f.topico} onChange={(e) => set("topico", e.target.value)} placeholder="ex: divisibilidade — MDC e MMC" style={inputS} />
          </div>
          <div><label htmlFor={id("q")} style={lbl}>Questões</label><input id={id("q")} type="number" inputMode="numeric" min="0" value={f.questoes} onChange={(e) => set("questoes", e.target.value)} placeholder="0" style={inputS} /></div>
          <div>
            <label htmlFor={id("ac")} style={lbl}>Acertos</label>
            <input id={id("ac")} type="number" inputMode="numeric" min="0" value={f.acertos} onChange={(e) => set("acertos", e.target.value)} placeholder="0"
              aria-invalid={acertosDemais ? true : undefined}
              style={{ ...inputS, borderColor: acertosDemais ? T.red : T.line }} />
          </div>
          <div>
            <label htmlFor={id("tempo")} style={lbl}>Tempo</label>
            <input id={id("tempo")} value={f.tempo} onChange={(e) => set("tempo", e.target.value)} placeholder="1h30, 45min…"
              aria-invalid={tempoInvalido ? true : undefined}
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
            <div><label htmlFor={id("obs")} style={lbl}>Observações</label><input id={id("obs")} value={f.obs} onChange={(e) => set("obs", e.target.value)} placeholder="onde travou, o que revisar…" style={inputS} /></div>
            <div style={{ maxWidth: 200 }}><label htmlFor={id("data")} style={lbl}>Data</label><input id={id("data")} type="date" value={f.data} onChange={(e) => set("data", e.target.value)} style={inputS} /></div>
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
          <>
            <ListaRegistros registros={recentes} porCodigo={trilha.porCodigo} aoApagar={apagar} rotuloAcerto />
            {temMaisRecentes && (
              <div style={{ padding: "10px 14px", borderTop: `1px solid ${T.line}` }}>
                <button onClick={() => setLimiteRecentes(registros.length)}
                  style={{ border: "none", background: "transparent", color: T.gold, fontSize: 13, fontWeight: 700, padding: 0, cursor: "pointer" }}>
                  Ver mais ({registros.length - limiteRecentes} registros)
                </button>
              </div>
            )}
          </>
        )}
      </SectionCard>
    </div>
  );
}
