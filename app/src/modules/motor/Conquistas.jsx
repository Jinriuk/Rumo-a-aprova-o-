/* Perfil gamificado (Fase 16): a evolução de PATENTES — com insígnias
   militares (chevrons p/ praças, estrelas p/ oficiais) — e as
   CONQUISTAS, organizadas por categoria, com raridade, requisito e
   progresso ("o que falta"). Tudo DERIVADO de dado real (registros,
   metas, simulados) — nada persiste, nada se falsifica: apagou o
   progresso, a conquista recua junto. */
import React from "react";
import { useTema } from "../../shared/branding/BrandingContext.jsx";
import { Icone } from "../../shared/ui/Icones.jsx";
import { Insignia } from "../../shared/ui/Insignia.jsx";
import { BarraXP, SeloRaridade } from "../../shared/ui/componentes.jsx";
import { PATENTES, patente } from "./jargao.js";

// catálogo de conquistas: cada uma mede o próprio progresso a partir
// de dado real e carrega categoria + raridade (Fase 16). Os nomes têm
// identidade de campanha; o requisito explica o que medimos.
export function catalogoConquistas({ m, metas, simulados }) {
  const cumpridas = metas.reduce((a, mt) => a + (mt.meta_atividades ?? []).filter((x) => x.estado === "concluida").length, 0);
  const semanas100 = metas.filter((mt) => {
    const its = (mt.meta_atividades ?? []).filter((x) => x.estado !== "ignorada");
    return its.length > 0 && its.every((x) => x.estado === "concluida");
  }).length;
  const melhorMateria = Math.max(0, ...m.matStats.filter((s) => s.comAcc).map((s) => s.acc));

  return [
    { grupo: "Constância", gIcone: "fogo", icone: "fogo",    raridade: "comum",     nome: "Primeira Marcha",     req: "Estude 3 dias seguidos",                          atual: m.streak, alvo: 3 },
    { grupo: "Constância", gIcone: "fogo", icone: "fogo",    raridade: "destacada", nome: "Constância de Ferro", req: "Estude 7 dias seguidos",                          atual: m.streak, alvo: 7 },
    { grupo: "Constância", gIcone: "fogo", icone: "relogio", raridade: "rara",      nome: "Sentinela do Foco",   req: "Acumule 30 dias de estudo",                       atual: m.totalDias, alvo: 30 },
    { grupo: "Volume",     gIcone: "raio", icone: "raio",    raridade: "comum",     nome: "Centena",             req: "Resolva 100 questões",                            atual: m.totDone, alvo: 100 },
    { grupo: "Volume",     gIcone: "raio", icone: "raio",    raridade: "destacada", nome: "Linha de Frente",     req: "Resolva 500 questões",                            atual: m.totDone, alvo: 500 },
    { grupo: "Volume",     gIcone: "raio", icone: "estrela", raridade: "rara",      nome: "Mil Questões",        req: "Resolva 1.000 questões",                          atual: m.totDone, alvo: 1000 },
    { grupo: "Volume",     gIcone: "raio", icone: "trofeu",  raridade: "lendaria",  nome: "Lendário",            req: "Resolva 5.000 questões",                          atual: m.totDone, alvo: 5000 },
    { grupo: "Precisão",   gIcone: "alvo", icone: "alvo",    raridade: "destacada", nome: "Mira Certa",          req: "70% de acerto geral (mín. 50 questões)",          atual: m.totDone >= 50 ? m.acerto : 0, alvo: 70, sufixo: "%" },
    { grupo: "Precisão",   gIcone: "alvo", icone: "medalha", raridade: "rara",      nome: "Precisão Cirúrgica",  req: "80% de acerto em uma matéria (mín. 10 questões)", atual: melhorMateria, alvo: 80, sufixo: "%" },
    { grupo: "Missões",    gIcone: "ancora", icone: "ancora", raridade: "comum",    nome: "Primeiro Alvo",       req: "Conclua seu primeiro objetivo de missão",         atual: cumpridas, alvo: 1 },
    { grupo: "Missões",    gIcone: "ancora", icone: "check",  raridade: "destacada", nome: "Missão Cumprida",    req: "Feche uma semana com 100% dos objetivos",         atual: semanas100, alvo: 1 },
    { grupo: "Missões",    gIcone: "ancora", icone: "trofeu", raridade: "elite",    nome: "Operação 100%",       req: "Feche 3 semanas com 100%",                        atual: semanas100, alvo: 3 },
    { grupo: "Simulados",  gIcone: "grafico", icone: "lapis", raridade: "comum",    nome: "Batismo de Fogo",     req: "Faça seu primeiro simulado",                      atual: simulados.length, alvo: 1 },
    { grupo: "Simulados",  gIcone: "grafico", icone: "medalha", raridade: "rara",   nome: "Veterano",            req: "Faça 5 simulados",                                atual: simulados.length, alvo: 5 },
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
  const conquistas = catalogoConquistas({ m, metas, simulados });
  const desbloqueadas = conquistas.filter((c) => c.atual >= c.alvo).length;
  const grupos = [...new Set(conquistas.map((c) => c.grupo))];
  const gIconeDe = (g) => conquistas.find((c) => c.grupo === g)?.gIcone ?? "estrela";

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 18 }}>
      {/* ===== HERO: patente atual com insígnia ===== */}
      <div style={{ position: "relative", overflow: "hidden", background: `linear-gradient(135deg, ${T.cardHi}, ${T.card})`, border: `1.5px solid ${T.gold}55`, borderRadius: 16, padding: "24px 18px 20px", textAlign: "center" }}>
        <div style={{ position: "absolute", inset: 0, background: `radial-gradient(circle at 50% -20%, ${T.gold}22, transparent 60%)`, pointerEvents: "none" }} />
        <div style={{ display: "flex", justifyContent: "center" }}>
          <Insignia patente={p} tam={92} />
        </div>
        <div className="disp" style={{ fontSize: 23, fontWeight: 800, marginTop: 12 }}>{p.nome} {nome}</div>
        <div style={{ fontSize: 13, color: T.sub, marginTop: 4 }}>
          nível {p.nivel} de {PATENTES.length} · {p.faixa === "oficial" ? "Oficialato" : "Praças"}
        </div>
        {p.lema && <div style={{ fontSize: 12.5, color: T.gold, marginTop: 6, fontStyle: "italic", maxWidth: 360, marginInline: "auto" }}>“{p.lema}”</div>}

        {p.proxXp != null && (
          <div style={{ maxWidth: 420, margin: "14px auto 0" }}>
            <BarraXP pct={p.pctProx} alt={9} />
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
          <div style={{ fontSize: 12.5, color: T.sub, marginTop: 3 }}>Praças sobem por chevrons; oficiais, por estrelas. Cada patente vem de XP — e XP só vem de estudo real.</div>
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill,minmax(260px,1fr))" }}>
          {PATENTES.map((pt, i) => {
            const ok = xp >= pt.xp;
            const atual = p.nivel === i + 1;
            return (
              <div key={pt.nome} style={{ display: "flex", alignItems: "center", gap: 13, padding: "13px 18px", borderBottom: `1px solid ${T.line}`, background: atual ? `linear-gradient(90deg, ${T.gold}14, transparent)` : "transparent", borderLeft: `3px solid ${atual ? T.gold : "transparent"}` }}>
                <Insignia patente={pt} tam={38} bloqueada={!ok} />
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
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill,minmax(260px,1fr))", gap: 0 }}>
              {doGrupo.map((c) => {
                const ok = c.atual >= c.alvo;
                const pct = Math.min(100, Math.round((c.atual / c.alvo) * 100));
                return (
                  <div key={c.nome} style={{ display: "flex", gap: 14, alignItems: "center", padding: "16px 18px", borderBottom: `1px solid ${T.line}` }}>
                    <Medalhao icone={c.icone} ok={ok} T={T} />
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div className="disp" style={{ fontSize: 15, fontWeight: 700, color: ok ? T.gold : T.ink, display: "flex", alignItems: "center", gap: 6, flexWrap: "wrap" }}>
                        {c.nome} {ok && <Icone nome="check" tam={14} grosso={3} />}
                        <SeloRaridade raridade={c.raridade} />
                      </div>
                      <div style={{ fontSize: 12.5, color: T.sub, lineHeight: 1.45, marginTop: 2 }}>{c.req}</div>
                      {!ok ? (
                        <div style={{ marginTop: 8 }}>
                          <BarraXP pct={pct} alt={5} brilho={false} />
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

/* Faixa compacta de conquistas para o "Hoje" (Fase 16.2): mostra as
   últimas desbloqueadas como motivação; se ainda não há nenhuma,
   destaca a que está mais perto de sair. Toca → abre a tela completa. */
export function ConquistasRecentes({ m, metas, simulados, aoAbrir }) {
  const T = useTema();
  const todas = catalogoConquistas({ m, metas, simulados });
  const desbloqueadas = todas.filter((c) => c.atual >= c.alvo);
  const proxima = todas
    .filter((c) => c.atual < c.alvo)
    .sort((a, b) => b.atual / b.alvo - a.atual / a.alvo)[0];
  const mostrar = desbloqueadas.slice(-3).reverse();

  return (
    <div onClick={aoAbrir} role={aoAbrir ? "button" : undefined}
      title={aoAbrir ? "Ver todas as conquistas" : undefined}
      style={{ background: T.card, border: `1px solid ${T.line}`, borderRadius: 12, padding: "12px 14px", cursor: aoAbrir ? "pointer" : "default" }}>
      <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 10 }}>
        <span style={{ color: T.gold }}><Icone nome="medalha" tam={16} /></span>
        <div className="disp" style={{ fontSize: 13.5, fontWeight: 700, flex: 1 }}>Conquistas</div>
        <span className="num" style={{ fontSize: 11, fontWeight: 700, color: T.sub }}>{desbloqueadas.length}/{todas.length}</span>
      </div>
      {mostrar.length > 0 ? (
        <div style={{ display: "flex", gap: 14, overflowX: "auto" }} className="navwrap">
          {mostrar.map((c) => (
            <div key={c.nome} style={{ textAlign: "center", width: 64, flexShrink: 0 }}>
              <Medalhao icone={c.icone} ok T={T} tam={44} />
              <div style={{ fontSize: 10, color: T.ink, marginTop: 4, lineHeight: 1.2 }}>{c.nome}</div>
            </div>
          ))}
        </div>
      ) : proxima ? (
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <Medalhao icone={proxima.icone} ok={false} T={T} tam={44} />
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontSize: 12.5, color: T.sub }}>Mais perto de desbloquear</div>
            <div className="disp" style={{ fontSize: 14, fontWeight: 700 }}>{proxima.nome}</div>
            <div style={{ marginTop: 5 }}>
              <BarraXP pct={Math.min(100, Math.round((proxima.atual / proxima.alvo) * 100))} alt={5} brilho={false} />
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
