/* O "hero" da meta — a cara de jogo (inspiração: guruja/Rumo ao
   fisco, adaptada à identidade navy/dourado). Barra de progresso
   com o marcador navegando, contadores feitas/pendentes/ignoradas
   e o cartão da PRÓXIMA meta, bloqueada até a virada (que roda no
   servidor — aqui ela só fica visível e desejável). */
import React from "react";
import { Card, MiniStat } from "../../shared/ui/componentes.jsx";
import { useTema } from "../../shared/branding/BrandingContext.jsx";
import { fmtBR } from "../../shared/regras/regras.js";

function fmtHoras(min) {
  const h = Math.floor(min / 60);
  const m = Math.round(min % 60);
  return `${String(h).padStart(2, "0")}h${String(m).padStart(2, "0")}m`;
}

export function MetaHero({ meta, trilha, m }) {
  const T = useTema();
  if (!meta) return null;

  const semana = trilha.semanas.find((s) => s.numero === meta.semana_numero);
  const proxima = trilha.semanas.find((s) => s.numero === meta.semana_numero + 1);

  const itens = meta.meta_atividades ?? [];
  const feitas = itens.filter((x) => x.estado === "concluida").length;
  const ignoradas = itens.filter((x) => x.estado === "ignorada").length;
  const pendentes = itens.length - feitas - ignoradas;
  const consideradas = Math.max(1, itens.length - ignoradas);
  const pct = Math.min(100, Math.round((feitas / consideradas) * 100));

  const disciplinasDaSemana = new Set(
    (trilha.atividadesPorSemana[meta.semana_numero] ?? []).map((a) => a.disciplina_codigo),
  ).size;

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
      <div style={{ display: "grid", gridTemplateColumns: "1fr", gap: 12 }}>
        <style>{`@media (min-width: 760px) { .meta-hero-grid { display:grid; grid-template-columns: 1fr 230px; gap:12px; } }`}</style>
        <div className="meta-hero-grid" style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          {/* META ATUAL */}
          <Card style={{ padding: 0, overflow: "hidden" }}>
            <div style={{ padding: "10px 16px", borderBottom: `1px solid ${T.line}`, display: "flex", alignItems: "center", gap: 8 }}>
              <span style={{ color: T.gold }}>⚑</span>
              <span className="disp" style={{ fontSize: 14, fontWeight: 700 }}>Meta atual</span>
              {semana?.simulado && (
                <span style={{ marginLeft: "auto", fontSize: 11.5, color: T.red, fontWeight: 700 }}>⚑ {semana.simulado}</span>
              )}
            </div>
            <div style={{ padding: 16 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap", marginBottom: 6 }}>
                <span className="disp" style={{ border: `1px solid ${T.gold}`, color: T.gold, borderRadius: 7, padding: "2px 10px", fontWeight: 700, fontSize: 14 }}>
                  Semana {meta.semana_numero}
                </span>
                <span style={{ fontSize: 12.5, color: T.sub, fontStyle: "italic" }}>{semana?.foco}</span>
              </div>

              {/* contadores e barra com o marcador navegando */}
              <div style={{ display: "flex", justifyContent: "space-between", fontSize: 13, margin: "10px 0 6px" }}>
                <span style={{ color: T.green, fontWeight: 700 }}>✓ {feitas}</span>
                <span style={{ color: T.sub, fontWeight: 700 }}>
                  {pendentes} <span style={{ fontWeight: 400 }}>pendentes</span>
                  {ignoradas > 0 && <span style={{ fontWeight: 400 }}> · {ignoradas} ignoradas</span>}
                </span>
              </div>
              <div style={{ position: "relative", height: 26, marginBottom: 8 }}>
                <div style={{ position: "absolute", top: 8, left: 0, right: 0, height: 10, background: T.bg, borderRadius: 6, overflow: "hidden" }}>
                  <div style={{ width: `${pct}%`, height: "100%", background: `linear-gradient(90deg, ${T.gold}, ${T.green})`, transition: "width .4s" }} />
                </div>
                <div title={`${pct}% da meta`} style={{
                  position: "absolute", top: 0, left: `calc(${pct}% - 13px)`, width: 26, height: 26,
                  borderRadius: "50%", background: T.bg2, border: `2px solid ${T.gold}`,
                  display: "flex", alignItems: "center", justifyContent: "center", fontSize: 13,
                  transition: "left .4s", boxShadow: "0 0 8px #0008",
                }}>⚓</div>
              </div>

              <div style={{ display: "flex", justifyContent: "space-between", fontSize: 12, color: T.sub, flexWrap: "wrap", gap: 6 }}>
                <span><b style={{ color: T.ink }}>{disciplinasDaSemana}</b> disciplinas · <b style={{ color: T.ink }}>{itens.length}</b> atividades</span>
                <span>Iniciada: <b style={{ color: T.ink }}>{fmtBR(String(meta.inicio))}</b> · termina {fmtBR(String(meta.fim))}</span>
              </div>
            </div>
          </Card>

          {/* PRÓXIMA META, bloqueada até a virada no servidor */}
          <Card style={{ border: `1.5px solid ${T.gold}`, textAlign: "center", display: "flex", flexDirection: "column", justifyContent: "center", gap: 8 }}>
            <div className="disp" style={{ fontSize: 13.5, fontWeight: 700 }}>Próxima Meta</div>
            {proxima ? (
              <>
                <span className="disp" style={{ alignSelf: "center", border: `1px solid ${T.line}`, color: T.sub, borderRadius: 7, padding: "2px 10px", fontWeight: 700, fontSize: 13 }}>
                  Semana {proxima.numero}
                </span>
                <div style={{ width: 46, height: 46, borderRadius: "50%", border: `2px solid ${T.gold}`, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 20, alignSelf: "center" }}>🔒</div>
                <div style={{ fontSize: 12, color: T.sub }}>
                  Liberada em: <b style={{ color: T.gold }}>{fmtBR(String(proxima.inicio))}</b>
                </div>
                <div style={{ fontSize: 11, color: T.sub, lineHeight: 1.4 }}>
                  A virada acontece sozinha à meia-noite. Finalize ou ignore as atividades da meta atual.
                </div>
              </>
            ) : (
              <>
                <div style={{ fontSize: 22 }}>🏁</div>
                <div style={{ fontSize: 12, color: T.sub, lineHeight: 1.4 }}>
                  Última semana do plano — reta final. Boa prova!
                </div>
              </>
            )}
          </Card>
        </div>
      </div>

      {/* cartões de stats da semana, no estilo do guruja, na nossa paleta */}
      {m && (
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(150px,1fr))", gap: 10 }}>
          <CartaoStat cor="#3D6FA8" rotulo="Seu desempenho" valor={`${m.acerto}%`} icone="✪" sub="acerto geral" />
          <CartaoStat cor={T.green} rotulo="Horas estudadas" valor={fmtHoras(m.minutosTotais ?? 0)} icone="◷" sub="no período todo" />
          <CartaoStat cor="#C56B3F" rotulo="Questões resolvidas" valor={m.totDone} icone="✔" sub={`${m.qSem} nesta semana`} />
          <CartaoStat cor={T.gold} rotulo="Média diária" valor={fmtHoras(m.mediaMinutosDia ?? 0)} icone="⧗" sub={`sequência: ${m.streak} 🔥`} />
        </div>
      )}
    </div>
  );
}

function CartaoStat({ cor, rotulo, valor, sub, icone }) {
  return (
    <div style={{ background: `linear-gradient(135deg, ${cor}, ${cor}99)`, borderRadius: 12, padding: "12px 14px", position: "relative", overflow: "hidden", minHeight: 86 }}>
      <div style={{ fontSize: 11.5, color: "#0A1622", fontWeight: 800, textTransform: "uppercase", letterSpacing: 0.3, opacity: 0.85 }}>{rotulo}</div>
      <div className="num disp" style={{ fontSize: 26, fontWeight: 800, color: "#fff", lineHeight: 1.15, marginTop: 4, textShadow: "0 1px 2px #0004" }}>{valor}</div>
      {sub && <div style={{ fontSize: 10.5, color: "#0A1622", fontWeight: 600, marginTop: 2, opacity: 0.8 }}>{sub}</div>}
      <div style={{ position: "absolute", right: 10, bottom: 8, fontSize: 22, color: "#ffffff55" }}>{icone}</div>
    </div>
  );
}
