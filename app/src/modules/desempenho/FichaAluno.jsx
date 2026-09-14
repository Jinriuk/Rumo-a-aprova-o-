/* FICHA DO ALUNO — visão da COORDENAÇÃO (pedido do produto): UMA
   página condensada, sem os menus do aluno. A escola vê o que
   importa: a semana na trilha, o desempenho e o histórico recente —
   no mesmo formato enxuto do responsável. Tudo leitura. */
import React, { useId, useMemo, useRef, useState } from "react";
import { SectionCard, Empty, Erro, EmptyState, Botao, BotaoMini, useInputStyle, CarregandoBloco, useDialogo } from "../../shared/ui/componentes.jsx";
import { useTema } from "../../shared/branding/BrandingContext.jsx";
import { useTrilha } from "../conteudo/useTrilha.js";
import { useRecurso } from "../../shared/hooks/useRecurso.js";
import { mensagemAmigavel } from "../../shared/lib/erros.js";
import { criarTrava } from "../../shared/lib/travaEnvio.js";
import { calcularMetricas } from "./metricas.js";
import { ResumoResponsavel } from "./ResumoResponsavel.jsx";
import { TrilhaConcurso } from "../conteudo/TrilhaConcurso.jsx";
import { HistoricoProgresso } from "./HistoricoProgresso.jsx";
import { ListaRegistros } from "../../shared/ui/ListaRegistros.jsx";
import { VinculosResponsavel } from "../pessoas/VinculosResponsavel.jsx";
import { calcularXP, patente, fmtHoras } from "../motor/jargao.js";
import { semanaAtual } from "../../shared/regras/regras.js";
import * as db from "../../shared/data/index.js";

// T39/T40: as três trocas de linha + gerar credencial já existem em
// ListaAlunos.jsx (com confirmação, Bloco 8 desta onda) — duplicadas
// aqui porque a extração para um módulo compartilhado se mostrou
// arriscada demais para o escopo do bloco (ListaAlunos.jsx amarra
// essas ações a uma trava de LISTA inteira; a ficha trabalha com um
// aluno só). São ~10 linhas cada, já finas: dialogo.confirmar + uma
// chamada a db.*.
export function FichaAluno({ aluno, concurso, turmas = [], concursos = [], trilhas = [], aoMudar, aoGerarCredencial }) {
  const T = useTema();
  const dialogo = useDialogo();
  const [ocupado, setOcupado] = useState(false);
  const [erroAcao, setErroAcao] = useState(null);
  const [vinculosAbertos, setVinculosAbertos] = useState(false);
  const travaRef = useRef(null);
  if (travaRef.current === null) travaRef.current = criarTrava();

  async function comAcao(fn) {
    if (!travaRef.current.tentar()) return;
    setOcupado(true); setErroAcao(null);
    try { await fn(); aoMudar?.(); } catch (e) { setErroAcao(mensagemAmigavel(e, "acao")); }
    finally { travaRef.current.liberar(); }
    setOcupado(false);
  }
  const trocarTurma = async (turmaId) => {
    const turma = turmas.find((t) => t.id === turmaId);
    const ok = await dialogo.confirmar({
      titulo: "Trocar turma",
      mensagem: turma ? `Mover ${aluno.nome} para a turma ${turma.nome}?` : `Remover ${aluno.nome} de sua turma atual?`,
      rotuloConfirmar: "Mover",
    });
    if (!ok) return;
    return comAcao(() => db.definirTurma(aluno.id, turmaId || null));
  };
  const trocarConcurso = async (concursoId) => {
    const c = concursos.find((x) => x.id === concursoId);
    const ok = await dialogo.confirmar({
      titulo: "Trocar concurso",
      mensagem: c ? `Trocar o concurso-alvo de ${aluno.nome} para ${c.nome}?` : `Remover o concurso-alvo de ${aluno.nome}?`,
      rotuloConfirmar: "Trocar",
    });
    if (!ok) return;
    return comAcao(() => db.atualizarAluno(aluno.id, { concurso_id: concursoId || null }));
  };
  const trocarTrilha = async (trilhaId) => {
    const trilha = trilhas.find((t) => t.id === trilhaId);
    const ok = await dialogo.confirmar({
      titulo: "Trocar trilha de estudo",
      mensagem: trilha ? `Trocar a trilha de estudo de ${aluno.nome} para ${trilha.nome}?` : `Remover a trilha de estudo de ${aluno.nome}?`,
      rotuloConfirmar: "Trocar",
    });
    if (!ok) return;
    return comAcao(() => db.atualizarAluno(aluno.id, { trilha_id: trilhaId || null }));
  };
  const credencialAluno = () => comAcao(async () => aoGerarCredencial?.(await db.provisionarAluno(aluno.id)));
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

  if (carregandoTrilha || carregandoDados) return <CarregandoBloco titulo="Carregando a ficha do aluno…" cartoes={3} linhas={4} />;
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

  const turmaAtual = (aluno.alunos_turmas ?? [])[0]?.turma_id ?? "";
  const selMini = { background: T.bg, border: `1px solid ${T.line}`, color: T.sub, borderRadius: 7, padding: "5px 9px", minHeight: 32, fontSize: 11.5, maxWidth: "100%" };

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
      {dialogo.elemento}
      {/* cabeçalho da ficha */}
      <div style={{ display: "flex", alignItems: "center", gap: 13, background: `linear-gradient(135deg, ${T.cardHi}, ${T.card})`, border: `1px solid ${T.line}`, borderRadius: 14, padding: "14px 16px", flexWrap: "wrap" }}>
        <div className="disp" style={{ width: 48, height: 48, borderRadius: "50%", flexShrink: 0, display: "flex", alignItems: "center", justifyContent: "center", background: `linear-gradient(135deg, ${T.gold}, #9c7d2e)`, color: "#0A1622", fontWeight: 800, fontSize: 17, border: `2px solid ${T.gold}` }}>
          {aluno.nome.split(" ").filter(Boolean).slice(0, 2).map((x) => x[0].toUpperCase()).join("")}
        </div>
        <div style={{ flex: 1, minWidth: 180 }}>
          <h2 className="disp" style={{ margin: 0, fontSize: 18, fontWeight: 800 }}>{aluno.nome}</h2>
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

      {/* T39/T40: barra de ações reais — até aqui a única ação visível na
          ficha inteira era o "Editar" discreto do onboarding lá embaixo;
          trocar trilha/concurso, gerar credencial e vínculos ficavam só
          na lista (atrás do "···Mais"), longe de quem já está vendo o
          desempenho do aluno. */}
      <SectionCard titulo="Ações rápidas" semPadding>
        <div style={{ display: "flex", flexWrap: "wrap", gap: 8, alignItems: "center", padding: "12px 14px" }}>
          {turmas.length > 0 && (
            <select value={turmaAtual} disabled={ocupado} onChange={(e) => trocarTurma(e.target.value)}
              onWheel={(e) => e.currentTarget.blur()} title="Turma do aluno"
              aria-label={`Turma de ${aluno.nome}`} style={selMini}>
              <option value="">— sem turma —</option>
              {turmas.map((t) => <option key={t.id} value={t.id}>{t.nome}</option>)}
            </select>
          )}
          {concursos.length > 0 && (
            <select value={aluno.concurso_id ?? ""} disabled={ocupado} onChange={(e) => trocarConcurso(e.target.value)}
              onWheel={(e) => e.currentTarget.blur()} title="Concurso do aluno"
              aria-label={`Concurso de ${aluno.nome}`} style={selMini}>
              <option value="">— sem concurso —</option>
              {concursos.map((c) => <option key={c.id} value={c.id}>{c.nome}</option>)}
            </select>
          )}
          {trilhas.length > 1 && (
            <select value={aluno.trilha_id ?? ""} disabled={ocupado} onChange={(e) => trocarTrilha(e.target.value)}
              onWheel={(e) => e.currentTarget.blur()} title="Trilha de estudo"
              aria-label={`Trilha de estudo de ${aluno.nome}`} style={selMini}>
              <option value="">— sem trilha —</option>
              {trilhas.map((t) => <option key={t.id} value={t.id}>{t.nome}</option>)}
            </select>
          )}
          {!aluno.usuario_id && (
            <BotaoMini destaque disabled={ocupado} onClick={credencialAluno}>{ocupado ? "…" : "Gerar credencial"}</BotaoMini>
          )}
          <BotaoMini onClick={() => setVinculosAbertos(true)}>Ver vínculos</BotaoMini>
        </div>
        {erroAcao && <div style={{ padding: "0 14px 12px" }}><Erro>{erroAcao}</Erro></div>}
      </SectionCard>

      {vinculosAbertos && (
        <VinculosResponsavel aluno={aluno} aoMudar={aoMudar} aoFechar={() => setVinculosAbertos(false)} aoGerarCredencial={aoGerarCredencial} />
      )}

      {/* o corpo condensado: mesmo formato do responsável, com copy
          factual de terceira pessoa (a coordenação não é o pai/mãe). */}
      <ResumoResponsavel aluno={aluno} m={m} meta={meta} trilha={trilha}
        simulados={dados.simulados} semanaAtiva={semanaAtiva} concurso={concurso} publico="coordenacao" />

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
  const uid = useId();
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
      <label htmlFor={`${uid}-${k}`} style={lbl}>{label}</label>
      <input
        id={`${uid}-${k}`}
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
        <button type="button" onClick={iniciarEdicao}
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
              <div style={{ fontSize: 13, color: T.sub }}>Onboarding em branco. Clique em &quot;Editar&quot; para preencher.</div>
            )}
          </div>
        ) : (
          <div style={{ padding: "12px 0", fontSize: 13, color: T.sub }}>
            Nenhuma informação de onboarding. Clique em &quot;Preencher&quot; para registrar o contexto inicial do aluno.
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
            <label htmlFor={`${uid}-obs`} style={lbl}>Observação da coordenação</label>
            <textarea
              id={`${uid}-obs`}
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
