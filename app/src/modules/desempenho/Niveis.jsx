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
  ROTULO_NIVEL, NIVEIS,
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

  // codigo → nível (regra pura da Fase 15), só matérias com volume mínimo
  const porMateria = {};
  const linhas = m.matStats.map((s) => {
    const r = classificarPorDesempenho({ acertoPct: s.acc ?? undefined, questoes: s.q });
    if (r.nivel) porMateria[s.id] = r.nivel;
    return { ...s, nivel: r.nivel, origem: r.origem };
  });

  const geral = calcularNivelGeral(porMateria, { diasParaProva });
  const resumo = resumirDiagnosticoAluno(porMateria);
  const nomeDe = (cod) => m.matStats.find((s) => s.id === cod)?.name ?? cod;
  const corDe = (cod) => trilha?.porCodigo?.[cod]?.cor ?? T.sub;

  const comDado = linhas.filter((l) => l.nivel);
  if (!comDado.length) {
    return (
      <SectionCard titulo="Estimativa de nível por matéria" sub="Regra pedagógica da Fase 15">
        <EmptyState icone="◔" titulo="Ainda sem evidência suficiente"
          dica="Resolva ao menos 20 questões por matéria para o sistema classificar seu nível com segurança — sem chutar." />
      </SectionCard>
    );
  }

  return (
    <SectionCard titulo="Estimativa de nível por matéria"
      sub="Classificação por desempenho (acerto + volume) — regra da Fase 15"
      acao={geral.nivel
        ? <StatusBadge tom={TOM_NIVEL[geral.nivel] ?? "neutro"}>Geral: {ROTULO_NIVEL[geral.nivel]}</StatusBadge>
        : <StatusBadge tom="neutro">Geral: a validar</StatusBadge>}>

      {/* leitura pedagógica: domina / em risco / foco */}
      <div style={{ display: "flex", flexDirection: "column", gap: 8, marginBottom: 14 }}>
        {resumo.pontosFortes.length > 0 && (
          <Leitura T={T} tom="ok" icone="escudo" titulo="Você domina"
            texto={resumo.pontosFortes.map(nomeDe).join(", ")} />
        )}
        {resumo.pontosAtencao.length > 0 && (
          <Leitura T={T} tom="risco" icone="alvo" titulo="Em risco — priorize"
            texto={resumo.pontosAtencao.map(nomeDe).join(", ")} />
        )}
        {resumo.pontosFortes.length === 0 && resumo.pontosAtencao.length === 0 && (
          <Leitura T={T} tom="alerta" icone="grafico" titulo="Em consolidação"
            texto="Suas matérias estão no nível intermediário. Mantenha o ritmo para subir para Avançado." />
        )}
      </div>

      {/* lista de matérias com o nível */}
      <div style={{ display: "flex", flexDirection: "column", gap: 1 }}>
        {comDado.sort((a, b) => (b.acc ?? 0) - (a.acc ?? 0)).map((l) => (
          <div key={l.id} style={{ display: "flex", alignItems: "center", gap: 10, padding: "9px 2px", borderTop: `1px solid ${T.line}` }}>
            <span style={{ width: 9, height: 9, borderRadius: 3, background: corDe(l.id), flexShrink: 0 }} />
            <span style={{ flex: 1, fontSize: 13, color: T.ink, minWidth: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{l.name}</span>
            <span className="num" style={{ fontSize: 11.5, color: T.sub, minWidth: 64, textAlign: "right" }}>{l.acc != null ? `${l.acc}%` : "—"} · {l.q}q</span>
            <StatusBadge tom={TOM_NIVEL[l.nivel] ?? "neutro"}>{ROTULO_NIVEL[l.nivel]}</StatusBadge>
          </div>
        ))}
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
