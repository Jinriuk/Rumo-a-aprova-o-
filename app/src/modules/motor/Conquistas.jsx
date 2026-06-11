/* Perfil gamificado (Fase 14 do doc central): a evolução de PATENTES
   e as CONQUISTAS — desbloqueadas e bloqueadas, com requisito e
   progresso ("o que falta para platinar"). Tudo DERIVADO de dado
   real (registros, metas, simulados) — nada persiste, nada se
   falsifica: apagou o progresso, a conquista recua junto. */
import React from "react";
import { SectionCard } from "../../shared/ui/componentes.jsx";
import { useTema } from "../../shared/branding/BrandingContext.jsx";
import { PATENTES, patente } from "./jargao.js";

// catálogo de conquistas: cada uma sabe medir o próprio progresso
function catalogo({ m, metas, simulados }) {
  const cumpridas = metas.reduce((a, mt) => a + (mt.meta_atividades ?? []).filter((x) => x.estado === "concluida").length, 0);
  const semanas100 = metas.filter((mt) => {
    const its = (mt.meta_atividades ?? []).filter((x) => x.estado !== "ignorada");
    return its.length > 0 && its.every((x) => x.estado === "concluida");
  }).length;
  const melhorMateria = Math.max(0, ...m.matStats.filter((s) => s.comAcc).map((s) => s.acc));

  return [
    { grupo: "Constância", icone: "🔥", nome: "Aquecendo", req: "Estude 3 dias seguidos", atual: m.streak, alvo: 3 },
    { grupo: "Constância", icone: "🔥", nome: "Semana de ferro", req: "Estude 7 dias seguidos", atual: m.streak, alvo: 7 },
    { grupo: "Constância", icone: "📅", nome: "Maratonista", req: "Acumule 30 dias de estudo", atual: m.totalDias, alvo: 30 },
    { grupo: "Questões", icone: "✦", nome: "Centena", req: "Resolva 100 questões", atual: m.totDone, alvo: 100 },
    { grupo: "Questões", icone: "✦", nome: "Quinhentas", req: "Resolva 500 questões", atual: m.totDone, alvo: 500 },
    { grupo: "Questões", icone: "⚡", nome: "Mil questões", req: "Resolva 1.000 questões", atual: m.totDone, alvo: 1000 },
    { grupo: "Questões", icone: "👑", nome: "Lendário", req: "Resolva 5.000 questões", atual: m.totDone, alvo: 5000 },
    { grupo: "Desempenho", icone: "◎", nome: "Mira calibrada", req: "70% de acerto geral (mín. 50 questões)", atual: m.totDone >= 50 ? m.acerto : 0, alvo: 70, sufixo: "%" },
    { grupo: "Desempenho", icone: "🎯", nome: "Especialista", req: "80% de acerto em uma matéria (mín. 10 questões)", atual: melhorMateria, alvo: 80, sufixo: "%" },
    { grupo: "Missões", icone: "⚓", nome: "Primeiro alvo", req: "Conclua seu primeiro objetivo de missão", atual: cumpridas, alvo: 1 },
    { grupo: "Missões", icone: "🏁", nome: "Missão perfeita", req: "Feche uma semana com 100% dos objetivos", atual: semanas100, alvo: 1 },
    { grupo: "Missões", icone: "🏆", nome: "Trinca perfeita", req: "Feche 3 semanas com 100%", atual: semanas100, alvo: 3 },
    { grupo: "Simulados", icone: "📝", nome: "Batismo de fogo", req: "Faça seu primeiro simulado", atual: simulados.length, alvo: 1 },
    { grupo: "Simulados", icone: "🎖", nome: "Veterano", req: "Faça 5 simulados", atual: simulados.length, alvo: 5 },
  ];
}

export function Conquistas({ nome, xp, m, metas, simulados }) {
  const T = useTema();
  const p = patente(xp);
  const conquistas = catalogo({ m, metas, simulados });
  const desbloqueadas = conquistas.filter((c) => c.atual >= c.alvo).length;
  const grupos = [...new Set(conquistas.map((c) => c.grupo))];

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
      {/* RESUMO */}
      <div style={{ background: `linear-gradient(135deg, ${T.cardHi}, ${T.card})`, border: `1.5px solid ${T.gold}55`, borderRadius: 14, padding: 16, textAlign: "center" }}>
        <div style={{ fontSize: 34 }}>🎖</div>
        <div className="disp" style={{ fontSize: 19, fontWeight: 800, marginTop: 4 }}>{p.nome} {nome}</div>
        <div style={{ fontSize: 12.5, color: T.sub, marginTop: 4 }}>
          nível {p.nivel} · <b className="num" style={{ color: T.gold }}>{xp.toLocaleString("pt-BR")} XP</b> · {desbloqueadas}/{conquistas.length} conquistas
        </div>
      </div>

      {/* EVOLUÇÃO DE PATENTES */}
      <SectionCard titulo="Evolução de patentes" sub="Cada patente é desbloqueada por XP — e XP só vem de estudo real." semPadding>
        <div style={{ display: "flex", flexDirection: "column" }}>
          {PATENTES.map((pt, i) => {
            const desbloqueada = xp >= pt.xp;
            const atual = p.nivel === i + 1;
            return (
              <div key={pt.nome} style={{ display: "flex", alignItems: "center", gap: 12, padding: "10px 15px", borderBottom: i === PATENTES.length - 1 ? "none" : `1px solid ${T.line}`, background: atual ? `${T.gold}10` : "transparent" }}>
                <div style={{ width: 34, height: 34, borderRadius: 9, flexShrink: 0, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 15, background: desbloqueada ? `linear-gradient(135deg, ${T.gold}, #9c7d2e)` : T.bg, border: desbloqueada ? "none" : `1.5px solid ${T.line}`, color: "#0A1622", fontWeight: 800, filter: desbloqueada ? "none" : "grayscale(1)" }}>
                  {desbloqueada ? "★" : "🔒"}
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div className="disp" style={{ fontSize: 14, fontWeight: 700, color: desbloqueada ? T.ink : T.sub }}>
                    {pt.nome} {atual && <span style={{ fontSize: 10, color: T.gold, fontWeight: 800, textTransform: "uppercase", letterSpacing: 0.5, marginLeft: 6 }}>← você está aqui</span>}
                  </div>
                  <div style={{ fontSize: 11, color: T.sub }}>nível {i + 1} · a partir de {pt.xp.toLocaleString("pt-BR")} XP</div>
                </div>
                {!desbloqueada && (
                  <div className="num" style={{ fontSize: 11, color: T.sub, flexShrink: 0 }}>faltam {(pt.xp - xp).toLocaleString("pt-BR")} XP</div>
                )}
              </div>
            );
          })}
        </div>
      </SectionCard>

      {/* CONQUISTAS por grupo */}
      {grupos.map((g) => (
        <SectionCard key={g} titulo={g} semPadding>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill,minmax(230px,1fr))", gap: 1 }}>
            {conquistas.filter((c) => c.grupo === g).map((c) => {
              const ok = c.atual >= c.alvo;
              const pct = Math.min(100, Math.round((c.atual / c.alvo) * 100));
              return (
                <div key={c.nome} style={{ padding: "13px 15px", borderBottom: `1px solid ${T.line}`, opacity: ok ? 1 : 0.85 }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                    <span style={{ fontSize: 22, filter: ok ? "none" : "grayscale(1) opacity(.5)" }}>{c.icone}</span>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div className="disp" style={{ fontSize: 13.5, fontWeight: 700, color: ok ? T.gold : T.ink }}>{c.nome} {ok && "✓"}</div>
                      <div style={{ fontSize: 11, color: T.sub, lineHeight: 1.4 }}>{c.req}</div>
                    </div>
                  </div>
                  {!ok && (
                    <div style={{ marginTop: 8 }}>
                      <div style={{ height: 4, background: T.bg, borderRadius: 2, overflow: "hidden" }}>
                        <div style={{ width: `${pct}%`, height: "100%", background: T.gold }} />
                      </div>
                      <div className="num" style={{ fontSize: 10, color: T.sub, marginTop: 3 }}>{c.atual.toLocaleString("pt-BR")}{c.sufixo ?? ""} / {c.alvo.toLocaleString("pt-BR")}{c.sufixo ?? ""}</div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </SectionCard>
      ))}
    </div>
  );
}
