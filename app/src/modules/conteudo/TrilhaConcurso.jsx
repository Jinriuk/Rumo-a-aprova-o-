/* ============================================================
   TRILHA DO CONCURSO (Fase 15.4 ligada ao runtime — Fase C0.5)
   ------------------------------------------------------------
   Mostra a trilha/missões REAIS do concurso-alvo do aluno, lidas
   por exam_tag de `trilha_planos` + `missoes` (com os ajustes da
   escola). É o conserto do sintoma "todo aluno vê o plano do
   Lucas/CN": aqui o conteúdo vem do exam_tag do próprio aluno, não
   de uma trilha fixa. Aluno de EPCAR vê missões de EPCAR; de EEAR,
   de EEAR; e assim por diante. A SELEÇÃO/ajuste fica em
   conteudo/missoes.js (lógica pura) — esta tela só apresenta.
   Mesma composição para aluno e coordenação (o banco/RLS decide o
   que cada um lê).
   ============================================================ */
import React from "react";
import { SectionCard, EmptyState, StatusBadge, CarregandoBloco } from "../../shared/ui/componentes.jsx";
import { useTema } from "../../shared/branding/BrandingContext.jsx";
import { useRecurso } from "../../shared/hooks/useRecurso.js";
import { montarMissoesDoAluno, desviosDeMissao } from "./missoes.js";
import { consolidarRecorrencia, prioridadeSugerida, relatorioIncidencia } from "./recorrencia.js";
import * as db from "../../shared/data/index.js";

// prioridade da missão ('alta'|'media'|'baixa') → tom do StatusBadge
const TOM_PRIORIDADE = { alta: "risco", media: "alerta", baixa: "neutro" };
const ROTULO_TIPO = {
  anual: "Anual", semestral: "Semestral", intensiva: "Intensiva", reta_final: "Reta final",
};
// grau de recorrência → rótulo honesto do nível de confiança do dado.
const ROTULO_RECORRENCIA = { estimada: "Estimada", validada: "Validada", medida: "Medida" };
const TOM_RECORRENCIA = { medida: "ok", validada: "ok", estimada: "neutro" };

export function TrilhaConcurso({ examTag, concursoNome, nivel = null, compacto = false }) {
  const T = useTema();
  const { dados, carregando, erro } = useRecurso(
    () => db.carregarPlanoConcurso(examTag),
    [examTag],
  );
  // Recorrência por assunto (Fase 15.7 ligada à tela): grau de
  // confiança + prioridade sugerida. É complementar à trilha — se
  // falhar/estiver vazia, a trilha aparece igual (degrada sem quebrar).
  const { dados: rec } = useRecurso(
    () => examTag ? db.carregarRecorrenciaDoConcurso(examTag) : Promise.resolve(null),
    [examTag],
  );

  if (!examTag) {
    return (
      <SectionCard titulo="Trilha do concurso" sub="Plano pedagógico por prova.">
        <div style={{ padding: 8 }}>
          <EmptyState icone="🎯" titulo="Sem concurso-alvo definido"
            dica="A coordenação precisa vincular o aluno a um concurso para a trilha aparecer." />
        </div>
      </SectionCard>
    );
  }
  if (carregando) return (
    <SectionCard titulo="Trilha do concurso" sub="Plano pedagógico por prova.">
      <CarregandoBloco titulo="Carregando a trilha do concurso…" linhas={4} />
    </SectionCard>
  );
  if (erro) {
    const ehProblemaDeRede = /instável|connexão|offline/i.test(erro);
    return (
      <SectionCard titulo="Trilha do concurso">
        <EmptyState
          icone={ehProblemaDeRede ? "📡" : "⚠️"}
          titulo={ehProblemaDeRede ? "Falha de conexão" : "Trilha temporariamente indisponível"}
          dica={ehProblemaDeRede
            ? "Verifique sua conexão e tente novamente."
            : "Não foi possível carregar a trilha agora. Recarregue a página ou tente em instantes."}
        />
      </SectionCard>
    );
  }

  const { planos = [], missoes = [], ajustesEscola = [] } = dados ?? {};
  // anti-furo (exam_tag) + ajustes da escola + ordenação — lógica pura.
  const missoesAluno = montarMissoesDoAluno({ missoes, examTagAtivo: examTag, nivel, ajustesEscola });
  const desvios = desviosDeMissao(missoes, ajustesEscola);

  // recorrência → assuntos com grau de confiança + prioridade sugerida.
  // Toda a regra (consolidar o maior grau, não promover estimada) vem
  // de recorrencia.js (lógica pura); aqui só montamos para exibir.
  const recorrenciaAssuntos = montarRecorrenciaPorAssunto(rec);

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
      {/* horizontes da trilha (anual / reta final / …) por concurso */}
      <SectionCard
        titulo="Trilha do concurso"
        sub={concursoNome
          ? `Plano de ${concursoNome.split(" (")[0]} (por prova). Cartões apenas informativos.`
          : "Plano pedagógico por prova. Cartões apenas informativos."}
        semPadding
      >
        {planos.length === 0 ? (
          <div style={{ padding: 8 }}>
            <EmptyState icone="🗺️" titulo="Trilha deste concurso em configuração"
              dica="Os horizontes (anual, reta final…) deste edital aparecem aqui assim que a escola publicar o conteúdo." />
          </div>
        ) : (
          <div style={{ display: "flex", flexWrap: "wrap", gap: 10, padding: "12px 14px" }}>
            {planos.map((p) => (
              <div key={p.id ?? `${p.exam_tag}-${p.tipo}`}
                style={{ flex: "1 1 200px", minWidth: 180, background: T.bg2, border: `1px solid ${T.line}`, borderRadius: 12, padding: "11px 13px" }}>
                <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
                  <span className="disp" style={{ fontSize: 13.5, fontWeight: 700 }}>{p.nome}</span>
                  <StatusBadge tom="neutro">{ROTULO_TIPO[p.tipo] ?? p.tipo}</StatusBadge>
                </div>
                {p.descricao && <div style={{ fontSize: 12, color: T.sub, marginTop: 6, lineHeight: 1.45 }}>{p.descricao}</div>}
              </div>
            ))}
          </div>
        )}
      </SectionCard>

      {/* missões do concurso-alvo — distintas por prova */}
      <SectionCard
        titulo="Missões do seu concurso"
        sub="Metas de estudo do edital alvo. As de outros concursos não entram."
        semPadding
      >
        {missoesAluno.length === 0 ? (
          <div style={{ padding: 8 }}>
            <EmptyState icone="✦" titulo="Missões deste concurso em configuração"
              dica="Assim que a escola publicar as missões deste edital, elas aparecem aqui — nunca conteúdo de outro concurso." />
          </div>
        ) : (
          <div>
            {missoesAluno.map((mi, i) => (
              <MissaoConcurso key={mi.id ?? i} mi={mi} ultima={i === missoesAluno.length - 1} compacto={compacto} T={T} />
            ))}
          </div>
        )}
      </SectionCard>

      {/* recorrência por assunto — grau de confiança honesto + prioridade
          sugerida. Só aparece quando há dado (degrada graciosamente). */}
      {recorrenciaAssuntos.linhas.length > 0 && (
        <SectionCard
          titulo="Recorrência por assunto"
          sub="O quanto cada assunto cai na prova e a prioridade sugerida. Estimada é inferência: não vira prioridade oficial sozinha."
          semPadding
        >
          <div>
            {recorrenciaAssuntos.linhas.map((l, i) => (
              <RecorrenciaAssunto key={l.assunto_id ?? i} l={l} ultima={i === recorrenciaAssuntos.linhas.length - 1} T={T} />
            ))}
          </div>
          {recorrenciaAssuntos.pontosCegos > 0 && (
            <div style={{ fontSize: 11.5, color: T.sub, lineHeight: 1.5, padding: "10px 14px", borderTop: `1px solid ${T.line}` }}>
              ⚐ {recorrenciaAssuntos.pontosCegos} assunto(s) do edital ainda sem incidência medida em prova real (ponto cego — cobertura por validar).
            </div>
          )}
        </SectionCard>
      )}

      {desvios.length > 0 && (
        <div style={{ fontSize: 12, color: T.gold, lineHeight: 1.5 }}>
          ⚑ {desvios.length} missão(ões) ajustada(s) pela escola além do desenho oficial do edital.
        </div>
      )}
    </div>
  );
}

/* Monta as linhas de recorrência por assunto a partir do pacote do
   seam ({assuntos, materias, recorrencia, medida}). Usa a lógica pura
   de recorrencia.js: consolida o maior grau disponível por assunto e
   deriva a prioridade sugerida (estimada NÃO aplica). Conta os pontos
   cegos via relatorioIncidencia (edital × prova real). */
function montarRecorrenciaPorAssunto(rec) {
  const vazio = { linhas: [], pontosCegos: 0 };
  if (!rec) return vazio;
  const { assuntos = [], materias = [], recorrencia = [], medida = [] } = rec;
  if (!recorrencia.length && !medida.length) return vazio;

  const pesoPorMateria = Object.fromEntries(materias.map((m) => [m.materia_codigo, m.peso != null ? Number(m.peso) : null]));
  const nomePorAssunto = Object.fromEntries(assuntos.map((a) => [a.id, a]));
  const medidaPorAssunto = Object.fromEntries(medida.map((m) => [m.assunto_id, m]));

  // agrupa a recorrência por assunto e consolida o maior grau.
  const porAssunto = new Map();
  for (const r of recorrencia) {
    if (!r.assunto_id) continue;
    if (!porAssunto.has(r.assunto_id)) porAssunto.set(r.assunto_id, []);
    porAssunto.get(r.assunto_id).push(r);
  }

  const linhas = [];
  for (const [assuntoId, linhasRec] of porAssunto) {
    const consolidado = consolidarRecorrencia(linhasRec);
    if (!consolidado) continue;
    const a = nomePorAssunto[assuntoId] ?? {};
    const sugestao = prioridadeSugerida(consolidado, { peso: pesoPorMateria[a.materia_codigo] ?? null });
    linhas.push({
      assunto_id: assuntoId,
      nome: a.nome ?? "Assunto",
      materia: a.materia_codigo ?? null,
      consolidado,
      sugestao,
      questoesMedidas: medidaPorAssunto[assuntoId]?.num_questoes_medidas ?? null,
    });
  }
  // ordena por prioridade sugerida (alta → baixa) e depois por grau.
  const ordemPrior = { alta: 0, media: 1, baixa: 2 };
  linhas.sort((x, y) => (ordemPrior[x.sugestao.prioridade] ?? 3) - (ordemPrior[y.sugestao.prioridade] ?? 3));

  const incidencia = relatorioIncidencia(
    assuntos.map((a) => ({ id: a.id, nome: a.nome, materia_codigo: a.materia_codigo, prioridade: a.prioridade })),
    Object.fromEntries(medida.map((m) => [m.assunto_id, { num_questoes_medidas: m.num_questoes_medidas }])),
  );
  const pontosCegos = incidencia.filter((r) => r.semIncidenciaMedida).length;
  return { linhas, pontosCegos };
}

function RecorrenciaAssunto({ l, ultima, T }) {
  const tomGrau = TOM_RECORRENCIA[l.consolidado.tipo] ?? "neutro";
  const tomPrior = TOM_PRIORIDADE[l.sugestao.prioridade] ?? "neutro";
  const pct = l.consolidado.pct_materia;
  const nQ = l.questoesMedidas ?? l.consolidado.num_questoes;
  return (
    <div style={{ padding: "12px 14px", borderBottom: ultima ? "none" : `1px solid ${T.line}` }}>
      <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
        <span className="disp" style={{ fontSize: 14, fontWeight: 700 }}>{l.nome}</span>
        {l.materia && (
          <span className="num" style={{ fontSize: 10.5, color: T.sub, textTransform: "uppercase", letterSpacing: 0.4 }}>{l.materia}</span>
        )}
        <StatusBadge tom={tomGrau}>{ROTULO_RECORRENCIA[l.consolidado.tipo] ?? l.consolidado.tipo}</StatusBadge>
        {l.sugestao.prioridade && <StatusBadge tom={tomPrior}>prioridade {l.sugestao.prioridade}</StatusBadge>}
        {(pct != null || nQ != null) && (
          <span className="num" style={{ marginLeft: "auto", fontSize: 11.5, color: T.sub }}>
            {pct != null ? `${Number(pct)}% da matéria` : `${nQ} ${nQ === 1 ? "questão" : "questões"}`}
          </span>
        )}
      </div>
      <div style={{ fontSize: 11.5, color: l.sugestao.aplicar ? T.sub : T.gold, marginTop: 6, lineHeight: 1.45 }}>
        {l.sugestao.aplicar
          ? `Prioridade derivada de recorrência ${l.consolidado.tipo} (dado de produção).`
          : "Inferência preliminar — ainda pendente de validação, não vira prioridade oficial."}
      </div>
    </div>
  );
}

function MissaoConcurso({ mi, ultima, compacto, T }) {
  const tom = TOM_PRIORIDADE[mi.prioridade] ?? "neutro";
  return (
    <div style={{ padding: "12px 14px", borderBottom: ultima ? "none" : `1px solid ${T.line}` }}>
      <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
        <span className="disp" style={{ fontSize: 14, fontWeight: 700 }}>{mi.nome}</span>
        {mi.materia_codigo && (
          <span className="num" style={{ fontSize: 10.5, color: T.sub, textTransform: "uppercase", letterSpacing: 0.4 }}>{mi.materia_codigo}</span>
        )}
        <StatusBadge tom={tom}>prioridade {mi.prioridade}</StatusBadge>
        {mi.desvioDoEdital && <StatusBadge tom="alerta">ajuste da escola</StatusBadge>}
        {Number.isFinite(mi.xp_sugerido) && (
          <span className="num" style={{ marginLeft: "auto", fontSize: 11.5, color: T.gold, fontWeight: 700 }}>+{mi.xp_sugerido} XP</span>
        )}
      </div>
      {mi.objetivo && <div style={{ fontSize: 12.5, color: T.ink, marginTop: 6, lineHeight: 1.45 }}>{mi.objetivo}</div>}
      {!compacto && mi.criterio_conclusao && (
        <div style={{ fontSize: 11.5, color: T.sub, marginTop: 6, lineHeight: 1.45 }}>
          <b style={{ color: T.sub }}>Conclui quando:</b> {mi.criterio_conclusao}
        </div>
      )}
    </div>
  );
}
