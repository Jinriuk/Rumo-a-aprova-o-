/* Perfil gamificado (Fase 14 do doc central): a evolução de PATENTES
   e as CONQUISTAS — desbloqueadas e bloqueadas, com requisito e
   progresso ("o que falta para platinar"). Tudo DERIVADO de dado
   real (registros, metas, simulados) — nada persiste, nada se
   falsifica: apagou o progresso, a conquista recua junto. */
import React from "react";
import { useTema } from "../../shared/branding/BrandingContext.jsx";
import { Icone } from "../../shared/ui/Icones.jsx";
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
    { grupo: "Constância", gIcone: "fogo", icone: "fogo", nome: "Aquecendo", req: "Estude 3 dias seguidos", atual: m.streak, alvo: 3 },
    { grupo: "Constância", gIcone: "fogo", icone: "fogo", nome: "Semana de ferro", req: "Estude 7 dias seguidos", atual: m.streak, alvo: 7 },
    { grupo: "Constância", gIcone: "fogo", icone: "relogio", nome: "Maratonista", req: "Acumule 30 dias de estudo", atual: m.totalDias, alvo: 30 },
    { grupo: "Questões", gIcone: "raio", icone: "raio", nome: "Centena", req: "Resolva 100 questões", atual: m.totDone, alvo: 100 },
    { grupo: "Questões", gIcone: "raio", icone: "raio", nome: "Quinhentas", req: "Resolva 500 questões", atual: m.totDone, alvo: 500 },
    { grupo: "Questões", gIcone: "raio", icone: "estrela", nome: "Mil questões", req: "Resolva 1.000 questões", atual: m.totDone, alvo: 1000 },
    { grupo: "Questões", gIcone: "raio", icone: "trofeu", nome: "Lendário", req: "Resolva 5.000 questões", atual: m.totDone, alvo: 5000 },
    { grupo: "Desempenho", gIcone: "alvo", icone: "alvo", nome: "Mira calibrada", req: "70% de acerto geral (mín. 50 questões)", atual: m.totDone >= 50 ? m.acerto : 0, alvo: 70, sufixo: "%" },
    { grupo: "Desempenho", gIcone: "alvo", icone: "medalha", nome: "Especialista", req: "80% de acerto em uma matéria (mín. 10 questões)", atual: melhorMateria, alvo: 80, sufixo: "%" },
    { grupo: "Missões", gIcone: "ancora", icone: "ancora", nome: "Primeiro alvo", req: "Conclua seu primeiro objetivo de missão", atual: cumpridas, alvo: 1 },
    { grupo: "Missões", gIcone: "ancora", icone: "check", nome: "Missão perfeita", req: "Feche uma semana com 100% dos objetivos", atual: semanas100, alvo: 1 },
    { grupo: "Missões", gIcone: "ancora", icone: "trofeu", nome: "Trinca perfeita", req: "Feche 3 semanas com 100%", atual: semanas100, alvo: 3 },
    { grupo: "Simulados", gIcone: "grafico", icone: "lapis", nome: "Batismo de fogo", req: "Faça seu primeiro simulado", atual: simulados.length, alvo: 1 },
    { grupo: "Simulados", gIcone: "grafico", icone: "medalha", nome: "Veterano", req: "Faça 5 simulados", atual: simulados.length, alvo: 5 },
  ];
}

// medalhão circular: anel dourado quando desbloqueado, cadeado quando não
function Medalhao({ icone, ok, T, tam = 58 }) {
  if (ok) {
    return (
      <div style={{ width: tam, height: tam, borderRadius: "50%", flexShrink: 0, display: "flex", alignItems: "center", justifyContent: "center", background: `linear-gradient(135deg, ${T.gold}, #9c7d2e)`, color: "#0A1622", boxShadow: `0 4px 16px ${T.gold}55, inset 0 1px 0 #ffffff66`, border: `2.5px solid ${T.gold}` }}>
        <Icone nome={icone} tam={tam * 0.44} grosso={2.3} />
      </div>
    );
  }
  return (
    <div style={{ width: tam, height: tam, borderRadius: "50%", flexShrink: 0, display: "flex", alignItems: "center", justifyContent: "center", background: T.bg, color: T.sub, border: `2px dashed ${T.line}`, opacity: 0.85 }}>
      <Icone nome="cadeado" tam={tam * 0.38} />
    </div>
  );
}

export function Conquistas({ nome, xp, m, metas, simulados }) {
  const T = useTema();
  const p = patente(xp);
  const conquistas = catalogo({ m, metas, simulados });
  const desbloqueadas = conquistas.filter((c) => c.atual >= c.alvo).length;
  const grupos = [...new Set(conquistas.map((c) => c.grupo))];
  const gIconeDe = (g) => conquistas.find((c) => c.grupo === g)?.gIcone ?? "estrela";

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 18 }}>
      {/* ===== HERO: patente atual ===== */}
      <div style={{ position: "relative", overflow: "hidden", background: `linear-gradient(135deg, ${T.cardHi}, ${T.card})`, border: `1.5px solid ${T.gold}55`, borderRadius: 16, padding: "24px 18px 20px", textAlign: "center" }}>
        <div style={{ position: "absolute", inset: 0, background: `radial-gradient(circle at 50% -20%, ${T.gold}1e, transparent 60%)`, pointerEvents: "none" }} />
        <div style={{ display: "flex", justifyContent: "center" }}>
          <div style={{ width: 76, height: 76, borderRadius: "50%", display: "flex", alignItems: "center", justifyContent: "center", background: `linear-gradient(135deg, ${T.gold}, #9c7d2e)`, color: "#0A1622", boxShadow: `0 6px 24px ${T.gold}66, inset 0 2px 0 #ffffff55`, border: `3px solid ${T.gold}` }}>
            <Icone nome="medalha" tam={36} grosso={2.2} />
          </div>
        </div>
        <div className="disp" style={{ fontSize: 23, fontWeight: 800, marginTop: 12 }}>{p.nome} {nome}</div>
        <div style={{ fontSize: 13, color: T.sub, marginTop: 4 }}>nível {p.nivel} de {PATENTES.length}</div>

        {p.proxXp != null && (
          <div style={{ maxWidth: 420, margin: "14px auto 0" }}>
            <div style={{ height: 9, background: T.bg, borderRadius: 5, overflow: "hidden", border: `1px solid ${T.line}` }}>
              <div style={{ width: `${p.pctProx}%`, height: "100%", background: `linear-gradient(90deg, ${T.gold}, ${T.green})`, boxShadow: `0 0 10px ${T.gold}88` }} />
            </div>
            <div style={{ fontSize: 12, color: T.sub, marginTop: 6 }}>
              faltam <b className="num" style={{ color: T.gold }}>{(p.proxXp - xp).toLocaleString("pt-BR")} XP</b> para <b style={{ color: T.ink }}>{p.proxNome}</b>
            </div>
          </div>
        )}

        <div style={{ display: "flex", justifyContent: "center", gap: 26, marginTop: 16, flexWrap: "wrap" }}>
          {[
            ["XP total", xp.toLocaleString("pt-BR")],
            ["Conquistas", `${desbloqueadas}/${conquistas.length}`],
            ["Ofensiva", `${m.streak} ${m.streak === 1 ? "dia" : "dias"}`],
          ].map(([r, v]) => (
            <div key={r}>
              <div className="num disp" style={{ fontSize: 21, fontWeight: 800, color: T.gold }}>{v}</div>
              <div style={{ fontSize: 10.5, color: T.sub, textTransform: "uppercase", letterSpacing: 0.6, marginTop: 2 }}>{r}</div>
            </div>
          ))}
        </div>
      </div>

      {/* ===== EVOLUÇÃO DE PATENTES ===== */}
      <div style={{ background: T.card, border: `1px solid ${T.line}`, borderRadius: 16, overflow: "hidden" }}>
        <div style={{ padding: "15px 18px", borderBottom: `1px solid ${T.line}` }}>
          <div className="disp" style={{ fontSize: 17, fontWeight: 700 }}>Evolução de patentes</div>
          <div style={{ fontSize: 12.5, color: T.sub, marginTop: 3 }}>Cada patente é desbloqueada por XP — e XP só vem de estudo real.</div>
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill,minmax(250px,1fr))" }}>
          {PATENTES.map((pt, i) => {
            const ok = xp >= pt.xp;
            const atual = p.nivel === i + 1;
            return (
              <div key={pt.nome} style={{ display: "flex", alignItems: "center", gap: 13, padding: "13px 18px", borderBottom: `1px solid ${T.line}`, background: atual ? `linear-gradient(90deg, ${T.gold}14, transparent)` : "transparent", borderLeft: `3px solid ${atual ? T.gold : "transparent"}` }}>
                <div style={{ width: 42, height: 42, borderRadius: 11, flexShrink: 0, display: "flex", alignItems: "center", justifyContent: "center", background: ok ? `linear-gradient(135deg, ${T.gold}, #9c7d2e)` : T.bg, border: ok ? "none" : `1.5px solid ${T.line}`, color: ok ? "#0A1622" : T.sub, boxShadow: ok ? `0 3px 10px ${T.gold}44` : "none" }}>
                  {ok ? <Icone nome="estrela" tam={19} grosso={2.2} preenchido /> : <Icone nome="cadeado" tam={17} />}
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div className="disp" style={{ fontSize: 15, fontWeight: 700, color: ok ? T.ink : T.sub }}>
                    {pt.nome}
                    {atual && <span style={{ fontSize: 9.5, color: "#0A1622", background: T.gold, fontWeight: 800, textTransform: "uppercase", letterSpacing: 0.5, marginLeft: 8, borderRadius: 5, padding: "2px 7px", verticalAlign: "2px" }}>atual</span>}
                  </div>
                  <div className="num" style={{ fontSize: 11.5, color: T.sub, marginTop: 1 }}>
                    nível {i + 1} · {pt.xp.toLocaleString("pt-BR")} XP{!ok && <> · <span style={{ color: T.gold }}>faltam {(pt.xp - xp).toLocaleString("pt-BR")}</span></>}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* ===== CONQUISTAS por grupo ===== */}
      {grupos.map((g) => {
        const doGrupo = conquistas.filter((c) => c.grupo === g);
        const okGrupo = doGrupo.filter((c) => c.atual >= c.alvo).length;
        return (
          <div key={g} style={{ background: T.card, border: `1px solid ${T.line}`, borderRadius: 16, overflow: "hidden" }}>
            <div style={{ display: "flex", alignItems: "center", gap: 10, padding: "14px 18px", borderBottom: `1px solid ${T.line}` }}>
              <span style={{ color: T.gold }}><Icone nome={gIconeDe(g)} tam={19} /></span>
              <div className="disp" style={{ fontSize: 17, fontWeight: 700, flex: 1 }}>{g}</div>
              <span className="num" style={{ fontSize: 12, fontWeight: 700, color: okGrupo ? T.gold : T.sub, border: `1px solid ${okGrupo ? T.gold + "55" : T.line}`, background: okGrupo ? `${T.gold}12` : "transparent", borderRadius: 8, padding: "3px 10px" }}>
                {okGrupo}/{doGrupo.length}
              </span>
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill,minmax(250px,1fr))", gap: 0 }}>
              {doGrupo.map((c) => {
                const ok = c.atual >= c.alvo;
                const pct = Math.min(100, Math.round((c.atual / c.alvo) * 100));
                return (
                  <div key={c.nome} style={{ display: "flex", gap: 14, alignItems: "center", padding: "16px 18px", borderBottom: `1px solid ${T.line}` }}>
                    <Medalhao icone={c.icone} ok={ok} T={T} />
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div className="disp" style={{ fontSize: 15, fontWeight: 700, color: ok ? T.gold : T.ink, display: "flex", alignItems: "center", gap: 6 }}>
                        {c.nome} {ok && <Icone nome="check" tam={14} grosso={3} />}
                      </div>
                      <div style={{ fontSize: 12.5, color: T.sub, lineHeight: 1.45, marginTop: 2 }}>{c.req}</div>
                      {!ok ? (
                        <div style={{ marginTop: 8 }}>
                          <div style={{ height: 5, background: T.bg, borderRadius: 3, overflow: "hidden" }}>
                            <div style={{ width: `${pct}%`, height: "100%", background: `linear-gradient(90deg, ${T.gold}, ${T.green})` }} />
                          </div>
                          <div className="num" style={{ fontSize: 11, color: T.sub, marginTop: 4 }}>
                            {c.atual.toLocaleString("pt-BR")}{c.sufixo ?? ""} de {c.alvo.toLocaleString("pt-BR")}{c.sufixo ?? ""} · <b style={{ color: T.gold }}>{pct}%</b>
                          </div>
                        </div>
                      ) : (
                        <div style={{ fontSize: 11, color: T.green, fontWeight: 700, marginTop: 5, textTransform: "uppercase", letterSpacing: 0.5 }}>✓ Desbloqueada</div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        );
      })}
    </div>
  );
}
