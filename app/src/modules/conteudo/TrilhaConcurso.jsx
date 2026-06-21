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
import { SectionCard, Empty, Erro, EmptyState, StatusBadge } from "../../shared/ui/componentes.jsx";
import { useTema } from "../../shared/branding/BrandingContext.jsx";
import { useRecurso } from "../../shared/hooks/useRecurso.js";
import { montarMissoesDoAluno, desviosDeMissao } from "./missoes.js";
import * as db from "../../shared/data/index.js";

// prioridade da missão ('alta'|'media'|'baixa') → tom do StatusBadge
const TOM_PRIORIDADE = { alta: "risco", media: "alerta", baixa: "neutro" };
const ROTULO_TIPO = {
  anual: "Anual", semestral: "Semestral", intensiva: "Intensiva", reta_final: "Reta final",
};

export function TrilhaConcurso({ examTag, concursoNome, nivel = null, compacto = false }) {
  const T = useTema();
  const { dados, carregando, erro } = useRecurso(
    () => db.carregarPlanoConcurso(examTag),
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
  if (carregando) return <Empty txt="Carregando a trilha do concurso…" />;
  if (erro) return <Erro>{erro}</Erro>;

  const { planos = [], missoes = [], ajustesEscola = [] } = dados ?? {};
  // anti-furo (exam_tag) + ajustes da escola + ordenação — lógica pura.
  const missoesAluno = montarMissoesDoAluno({ missoes, examTagAtivo: examTag, nivel, ajustesEscola });
  const desvios = desviosDeMissao(missoes, ajustesEscola);

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
      {/* horizontes da trilha (anual / reta final / …) por concurso */}
      <SectionCard
        titulo="Trilha do concurso"
        sub={concursoNome ? `Plano de ${concursoNome.split(" (")[0]} (por prova).` : "Plano pedagógico por prova."}
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

      {desvios.length > 0 && (
        <div style={{ fontSize: 12, color: T.gold, lineHeight: 1.5 }}>
          ⚑ {desvios.length} missão(ões) ajustada(s) pela escola além do desenho oficial do edital.
        </div>
      )}
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
