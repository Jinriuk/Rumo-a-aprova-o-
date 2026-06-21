/* ============================================================
   NÍVEIS POR MATÉRIA + LEITURA PEDAGÓGICA (Fase 16.5).
   ------------------------------------------------------------
   Camada VISUAL sobre a regra da Fase 15 (niveisAluno.js): não
   reclassifica nada por conta própria — alimenta as funções puras
   com as métricas que a tela já calcula (m.matStats) e desenha o
   resultado. Deixa claro o que o aluno DOMINA, o que está EM RISCO
   e ONDE FOCAR, sem inventar corte nem precisão falsa.
   ============================================================ */
import React from "react";
import { useTema } from "../../shared/branding/BrandingContext.jsx";
import { SectionCard, StatusBadge, EmptyState } from "../../shared/ui/componentes.jsx";
import { Icone } from "../../shared/ui/Icones.jsx";
import {
  classificarPorDesempenho, calcularNivelGeral, resumirDiagnosticoAluno,
  ROTULO_NIVEL, NIVEIS, CONFIANCA,
} from "../conteudo/niveisAluno.js";

// cor/tom de cada nível (coerente com o sistema: verde=ok, dourado=meio,
// vermelho=atenção, cinza=sem evidência).
const TOM_NIVEL = {
  [NIVEIS.AVANCADO]: "ok",
  [NIVEIS.INTERMEDIARIO]: "alerta",
  [NIVEIS.BASE]: "risco",
  [NIVEIS.RETA_FINAL]: "alerta",
};

export function NiveisPorMateria({ m, trilha, diasParaProva }) {
  const T = useTema();
  if (!m) return null;

  // codigo → nível (regra pura da Fase 15). QA1.5: o nível GERAL e a
  // leitura forte ("você domina" / "em risco") só usam matérias com
  // confiança ALTA (volume robusto). As de confiança PARCIAL aparecem
  // na lista como ESTIMATIVA INICIAL — nunca como diagnóstico absoluto.
  const porMateriaFirme = {};
  const linhas = m.matStats.map((s) => {
    const r = classificarPorDesempenho({ acertoPct: s.acc ?? undefined, questoes: s.q });
    if (r.nivel && r.confianca === CONFIANCA.ALTA) porMateriaFirme[s.id] = r.nivel;
    return { ...s, nivel: r.nivel, origem: r.origem, confianca: r.confianca ?? null };
  });

  const geral = calcularNivelGeral(porMateriaFirme, { diasParaProva });
  const resumo = resumirDiagnosticoAluno(porMateriaFirme);
  const nomeDe = (cod) => m.matStats.find((s) => s.id === cod)?.name ?? cod;
  const corDe = (cod) => trilha?.porCodigo?.[cod]?.cor ?? T.sub;

  const comDado = linhas.filter((l) => l.nivel);
  const temFirme = linhas.some((l) => l.confianca === CONFIANCA.ALTA);
  if (!comDado.length) {
    return (
      <SectionCard titulo="Estimativa inicial de nível por matéria" sub="Baseada em acerto e volume de questões resolvidas">
        <EmptyState icone="◔" titulo="Base insuficiente para estimar"
          dica="Resolva ao menos 20 questões por matéria para uma estimativa inicial — e 50+ para o nível se firmar. O sistema não chuta." />
      </SectionCard>
    );
  }

  return (
    <SectionCard titulo="Estimativa inicial de nível por matéria"
      sub="Estimativa por acerto e volume — firma conforme o aluno acumula registros"
      acao={geral.nivel
        ? <StatusBadge tom={TOM_NIVEL[geral.nivel] ?? "neutro"}>Geral: {ROTULO_NIVEL[geral.nivel]}</StatusBadge>
        : <StatusBadge tom="neutro">Geral: a acompanhar</StatusBadge>}>

      {/* leitura pedagógica: só com base firme afirma domina/risco */}
      <div style={{ display: "flex", flexDirection: "column", gap: 8, marginBottom: 14 }}>
        {!temFirme ? (
          <Leitura T={T} tom="alerta" icone="grafico" titulo="Estimativa inicial"
            texto="Ainda há pouco volume por matéria para firmar o nível. Estes são pontos de partida — acompanhe mais registros antes de concluir." />
        ) : (
          <>
            {resumo.pontosFortes.length > 0 && (
              <Leitura T={T} tom="ok" icone="escudo" titulo="Pontos fortes (base firme)"
                texto={resumo.pontosFortes.map(nomeDe).join(", ")} />
            )}
            {resumo.pontosAtencao.length > 0 && (
              <Leitura T={T} tom="risco" icone="alvo" titulo="Atenção — priorize"
                texto={resumo.pontosAtencao.map(nomeDe).join(", ")} />
            )}
            {resumo.pontosFortes.length === 0 && resumo.pontosAtencao.length === 0 && (
              <Leitura T={T} tom="alerta" icone="grafico" titulo="Em consolidação"
                texto="As matérias com base firme estão no nível intermediário. Mantenha o ritmo para evoluir." />
            )}
          </>
        )}
      </div>

      {/* lista de matérias: PARCIAL = estimativa inicial (em formação) */}
      <div style={{ display: "flex", flexDirection: "column", gap: 1 }}>
        {comDado.sort((a, b) => (b.acc ?? 0) - (a.acc ?? 0)).map((l) => {
          const parcial = l.confianca === CONFIANCA.PARCIAL;
          return (
            <div key={l.id} style={{ display: "flex", alignItems: "center", gap: 10, padding: "9px 2px", borderTop: `1px solid ${T.line}` }}>
              <span style={{ width: 9, height: 9, borderRadius: 3, background: corDe(l.id), flexShrink: 0 }} />
              <span style={{ flex: 1, fontSize: 13, color: T.ink, minWidth: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{l.name}</span>
              <span className="num" style={{ fontSize: 11.5, color: T.sub, minWidth: 64, textAlign: "right" }}>{l.acc != null ? `${l.acc}%` : "—"} · {l.q}q</span>
              <StatusBadge tom={parcial ? "neutro" : (TOM_NIVEL[l.nivel] ?? "neutro")}>
                {parcial ? `${ROTULO_NIVEL[l.nivel]} (estimativa)` : ROTULO_NIVEL[l.nivel]}
              </StatusBadge>
            </div>
          );
        })}
      </div>

      {/* nota de método: deixa claro que é estimativa, não veredito */}
      <div style={{ fontSize: 11, color: T.sub, marginTop: 12, lineHeight: 1.5 }}>
        Estimativa inicial: até 20 questões por matéria, base insuficiente; de 20 a 50, nível provisório
        (em formação); acima de 50, o nível se firma. Avançado exige 100+ questões com bom acerto.
      </div>
    </SectionCard>
  );
}

function Leitura({ T, tom, icone, titulo, texto }) {
  const cor = tom === "ok" ? T.green : tom === "risco" ? T.red : T.gold;
  return (
    <div style={{ display: "flex", gap: 10, alignItems: "flex-start", background: T.bg, border: `1px solid ${T.line}`, borderLeft: `4px solid ${cor}`, borderRadius: 10, padding: "10px 12px" }}>
      <span style={{ color: cor, marginTop: 1 }}><Icone nome={icone} tam={16} /></span>
      <div style={{ minWidth: 0 }}>
        <div style={{ fontSize: 10.5, color: cor, textTransform: "uppercase", letterSpacing: 0.5, fontWeight: 800 }}>{titulo}</div>
        <div style={{ fontSize: 13, color: T.ink, marginTop: 2, lineHeight: 1.4 }}>{texto}</div>
      </div>
    </div>
  );
}
