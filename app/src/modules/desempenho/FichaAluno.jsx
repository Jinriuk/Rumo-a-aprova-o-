/* FICHA DO ALUNO — visão da COORDENAÇÃO (pedido do produto): UMA
   página condensada, sem os menus do aluno. A escola vê o que
   importa: a semana na trilha, o desempenho e o histórico recente —
   no mesmo formato enxuto do responsável. Tudo leitura. */
import React, { useMemo, useState } from "react";
import { SectionCard, Empty, Erro, EmptyState, Botao, useInputStyle } from "../../shared/ui/componentes.jsx";
import { useTema } from "../../shared/branding/BrandingContext.jsx";
import { useTrilha } from "../conteudo/useTrilha.js";
import { useRecurso } from "../../shared/hooks/useRecurso.js";
import { mensagemAmigavel } from "../../shared/lib/erros.js";
import { calcularMetricas } from "./metricas.js";
import { ResumoResponsavel } from "./ResumoResponsavel.jsx";
import { TrilhaConcurso } from "../conteudo/TrilhaConcurso.jsx";
import { HistoricoProgresso } from "./HistoricoProgresso.jsx";
import { ListaRegistros } from "../../shared/ui/ListaRegistros.jsx";
import { calcularXP, patente, fmtHoras } from "../motor/jargao.js";
import { semanaAtual } from "../../shared/regras/regras.js";
import * as db from "../../shared/data/index.js";

export function FichaAluno({ aluno, concurso }) {
  const T = useTema();
  const { dados: carregado, carregando: carregandoDados, erro: erroDados } = useRecurso(
    () => (aluno
      ? Promise.all([db.listarMetas(aluno.id), db.listarRegistros(aluno.id), db.listarSimulados(aluno.id), db.carregarXpPersistido(aluno.id)])
          .then(([metas, registros, simulados, xpPersistido]) => ({ metas, registros, simulados, xpPersistido }))
      : Promise.resolve({ metas: [], registros: [], simulados: [], xpPersistido: null })),
    [aluno?.id],
  );
  const dados = carregado ?? { metas: [], registros: [], simulados: [], xpPersistido: null };
  const { trilha, carregando: carregandoTrilha, erro: erroTrilha } = useTrilha(aluno?.trilha_id);

  const semanasRegras = useMemo(
    () => (trilha ? trilha.semanas.map((s) => ({ ...s, inicio: String(s.inicio), fim: String(s.fim) })) : []),
    [trilha],
  );
  const semanaAtiva = semanasRegras.length ? semanaAtual(semanasRegras) : null;

  const m = useMemo(() => {
    if (!trilha || !semanaAtiva) return null;
    return calcularMetricas({
      registros: dados.registros, simulados: dados.simulados,
      semanas: semanasRegras, semanaAtiva, disciplinas: trilha.disciplinas,
      metaQuestoes: semanaAtiva.meta_questoes ?? 250,
    });
  }, [dados, trilha, semanaAtiva]);

  if (carregandoTrilha || carregandoDados) return <Empty txt="Carregando ficha do aluno…" />;
  if (erroTrilha || erroDados) return <Erro>{erroTrilha || erroDados}</Erro>;
  if (!trilha) return <Empty txt="Aluno sem trilha de estudo." />;
  if (!m || !semanaAtiva) return <Empty txt="Fora do período da trilha deste aluno." />;

  const meta = dados.metas.find((x) => x.status === "ativa") ?? dados.metas[0] ?? null;
  // XP da fonte de verdade (ledger C0); fallback na estimativa legada.
  const xp = dados.xpPersistido?.eventos?.length
    ? dados.xpPersistido.total
    : calcularXP({ metas: dados.metas, totalQuestoes: m.totDone, simulados: dados.simulados.length });
  const p = patente(xp);
  const turma = (aluno.alunos_turmas ?? []).map((v) => v.turmas?.nome).filter(Boolean)[0];
  const recentes = dados.registros.slice(0, 8);

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
      {/* cabeçalho da ficha */}
      <div style={{ display: "flex", alignItems: "center", gap: 13, background: `linear-gradient(135deg, ${T.cardHi}, ${T.card})`, border: `1px solid ${T.line}`, borderRadius: 14, padding: "14px 16px", flexWrap: "wrap" }}>
        <div className="disp" style={{ width: 48, height: 48, borderRadius: "50%", flexShrink: 0, display: "flex", alignItems: "center", justifyContent: "center", background: `linear-gradient(135deg, ${T.gold}, #9c7d2e)`, color: "#0A1622", fontWeight: 800, fontSize: 17, border: `2px solid ${T.gold}` }}>
          {aluno.nome.split(" ").filter(Boolean).slice(0, 2).map((x) => x[0].toUpperCase()).join("")}
        </div>
        <div style={{ flex: 1, minWidth: 180 }}>
          <div className="disp" style={{ fontSize: 18, fontWeight: 800 }}>{aluno.nome}</div>
          <div style={{ fontSize: 12, color: T.sub, marginTop: 2 }}>
            {[turma, concurso ? concurso.nome.split(" (")[0] : null].filter(Boolean).join(" · ") || "sem turma"}
          </div>
        </div>
        <div style={{ display: "flex", gap: 18, flexShrink: 0, textAlign: "center" }}>
          <div>
            <div className="disp" style={{ fontSize: 14, fontWeight: 800, color: T.gold }}>{p.nome}</div>
            <div className="num" style={{ fontSize: 10.5, color: T.sub }}>{xp.toLocaleString("pt-BR")} XP</div>
          </div>
          <div>
            <div className="disp num" style={{ fontSize: 14, fontWeight: 800 }}>{fmtHoras(m.minutosTotais ?? 0)}</div>
            <div style={{ fontSize: 10.5, color: T.sub }}>tempo total</div>
          </div>
        </div>
      </div>

      {/* o corpo condensado: mesmo formato do responsável */}
      <ResumoResponsavel aluno={aluno} m={m} meta={meta} trilha={trilha}
        simulados={dados.simulados} semanaAtiva={semanaAtiva} concurso={concurso} />

      {/* trilha/missões REAIS do concurso-alvo (Fase 15.4 ligada): a
          coordenação vê o plano por prova do aluno, não uma trilha fixa. */}
      <TrilhaConcurso examTag={concurso?.codigo ?? null} concursoNome={concurso?.nome ?? null} compacto />

      {/* histórico do motor de progresso persistido (Fase C0): eventos
          reais do ledger, não estimativa do front. */}
      <HistoricoProgresso alunoId={aluno.id} />

      {/* histórico recente do que ele tem feito */}
      <SectionCard titulo="Últimos registros de estudo" sub="O que o aluno lançou mais recentemente." semPadding>
        {recentes.length === 0 ? (
          <div style={{ padding: 8 }}><EmptyState icone="✎" titulo="Nenhum registro ainda" dica="Os lançamentos do aluno aparecem aqui." /></div>
        ) : (
          <ListaRegistros registros={recentes} porCodigo={trilha.porCodigo} />
        )}
      </SectionCard>

      <OnboardingAluno alunoId={aluno.id} />
    </div>
  );
}

// ────────────────────────────────────────────────────────────
// Formulário de onboarding pedagógico (só coordenação edita)
// ────────────────────────────────────────────────────────────
function OnboardingAluno({ alunoId }) {
  const T = useTema();
  const { input: inputS, label: lbl } = useInputStyle();
  const [editando, setEditando] = useState(false);
  const [salvando, setSalvando] = useState(false);
  const [erroSalvar, setErroSalvar] = useState(null);

  const { dados, carregando, erro, recarregar } = useRecurso(
    () => db.carregarOnboarding(alunoId),
    [alunoId],
  );

  const [form, setForm] = useState(null);

  function iniciarEdicao() {
    setForm({
      experiencia_previa: dados?.experiencia_previa ?? "",
      disponibilidade_semanal_h: dados?.disponibilidade_semanal_h ?? "",
      maior_dificuldade: dados?.maior_dificuldade ?? "",
      objetivo: dados?.objetivo ?? "",
      observacao_coordenacao: dados?.observacao_coordenacao ?? "",
    });
    setEditando(true);
    setErroSalvar(null);
  }

  async function salvar() {
    if (!form || salvando) return;
    setSalvando(true); setErroSalvar(null);
    try {
      const payload = {
        ...form,
        disponibilidade_semanal_h: form.disponibilidade_semanal_h === "" ? null : Number(form.disponibilidade_semanal_h),
      };
      await db.salvarOnboarding(alunoId, payload);
      setEditando(false);
      recarregar();
    } catch (e) {
      setErroSalvar(mensagemAmigavel(e, "salvar"));
    }
    setSalvando(false);
  }

  const campo = (k, label, placeholder, tipo = "text") => (
    <div key={k} style={{ flex: 1, minWidth: 180 }}>
      <label style={lbl}>{label}</label>
      <input
        type={tipo}
        value={form[k] ?? ""}
        placeholder={placeholder}
        onChange={(e) => setForm((f) => ({ ...f, [k]: e.target.value }))}
        style={inputS}
        min={tipo === "number" ? 0 : undefined}
        max={tipo === "number" ? 168 : undefined}
      />
    </div>
  );

  return (
    <SectionCard
      titulo="Onboarding pedagógico"
      sub="Contexto inicial do aluno — preenchido pela coordenação."
      acao={!editando && !carregando && (
        <button onClick={iniciarEdicao}
          style={{ background: "none", border: "none", color: T.gold, fontSize: 12.5, cursor: "pointer", textDecoration: "underline" }}>
          {dados ? "Editar" : "Preencher"}
        </button>
      )}
    >
      {carregando && <Empty txt="Carregando onboarding…" />}
      {erro && !carregando && <Erro>{erro}</Erro>}

      {!carregando && !editando && (
        dados ? (
          <div style={{ display: "flex", flexDirection: "column", gap: 10, padding: "12px 0" }}>
            {[
              ["Experiência prévia", dados.experiencia_previa],
              ["Disponibilidade semanal", dados.disponibilidade_semanal_h != null ? `${dados.disponibilidade_semanal_h}h` : null],
              ["Maior dificuldade", dados.maior_dificuldade],
              ["Objetivo", dados.objetivo],
              ["Observação da coordenação", dados.observacao_coordenacao],
            ].map(([rotulo, valor]) => valor ? (
              <div key={rotulo} style={{ display: "flex", gap: 8 }}>
                <span style={{ fontSize: 12, color: T.sub, minWidth: 180, flexShrink: 0 }}>{rotulo}</span>
                <span style={{ fontSize: 13, color: T.ink }}>{valor}</span>
              </div>
            ) : null).filter(Boolean)}
            {!dados.experiencia_previa && !dados.objetivo && !dados.maior_dificuldade && (
              <div style={{ fontSize: 13, color: T.sub }}>Onboarding em branco. Clique em "Editar" para preencher.</div>
            )}
          </div>
        ) : (
          <div style={{ padding: "12px 0", fontSize: 13, color: T.sub }}>
            Nenhuma informação de onboarding. Clique em "Preencher" para registrar o contexto inicial do aluno.
          </div>
        )
      )}

      {!carregando && editando && form && (
        <div style={{ paddingTop: 8 }}>
          <div style={{ display: "flex", gap: 10, flexWrap: "wrap", marginBottom: 10 }}>
            {campo("experiencia_previa", "Experiência prévia", "ex: nunca estudou | estuda há 1 ano")}
            {campo("disponibilidade_semanal_h", "Horas/semana disponíveis", "ex: 15", "number")}
          </div>
          <div style={{ display: "flex", gap: 10, flexWrap: "wrap", marginBottom: 10 }}>
            {campo("maior_dificuldade", "Maior dificuldade", "ex: matemática, concentração")}
            {campo("objetivo", "Objetivo do aluno", "ex: aprovação no 1º semestre 2027")}
          </div>
          <div style={{ marginBottom: 10 }}>
            <label style={lbl}>Observação da coordenação</label>
            <textarea
              value={form.observacao_coordenacao ?? ""}
              onChange={(e) => setForm((f) => ({ ...f, observacao_coordenacao: e.target.value }))}
              placeholder="Notas internas — não visíveis ao aluno"
              rows={3}
              style={{ ...inputS, resize: "vertical" }}
            />
          </div>
          {erroSalvar && <Erro>{erroSalvar}</Erro>}
          <div style={{ display: "flex", gap: 8 }}>
            <Botao onClick={salvar} disabled={salvando}>{salvando ? "Salvando…" : "Salvar onboarding"}</Botao>
            <Botao secundario onClick={() => setEditando(false)}>Cancelar</Botao>
          </div>
        </div>
      )}
    </SectionCard>
  );
}
