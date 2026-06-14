/* "Hoje" — o coração gamificado da área do aluno (ref. designs):
   faixa do aspirante (patente + XP + ofensiva), Missão atual grande,
   Radar de desempenho e Próxima Missão compacta/bloqueada.
   Tudo derivado de dado REAL; o jargão é só apresentação. */
import React from "react";
import { StatCard, StatusBadge, BarraXP } from "../../shared/ui/componentes.jsx";
import { Insignia } from "../../shared/ui/Insignia.jsx";
import { useTema } from "../../shared/branding/BrandingContext.jsx";
import { fmtBR, todayISO, daysBetween } from "../../shared/regras/regras.js";
import { L, patente, fmtHoras, fmtHorasCurto, xpPorPrioridade } from "./jargao.js";

export function FaixaAspirante({ nome, contexto, xp, streak, aoAbrirConquistas }) {
  const T = useTema();
  const p = patente(xp);
  return (
    <div onClick={aoAbrirConquistas} role={aoAbrirConquistas ? "button" : undefined}
      title={aoAbrirConquistas ? "Ver patentes e conquistas" : undefined}
      style={{ background: `linear-gradient(135deg, ${T.cardHi}, ${T.card})`, border: `1px solid ${T.line}`, borderRadius: 14, padding: "12px 14px", cursor: aoAbrirConquistas ? "pointer" : "default" }}>
      <div style={{ display: "flex", alignItems: "center", gap: 11 }}>
        <div style={{ position: "relative", flexShrink: 0 }}>
          <Insignia patente={p} tam={42} />
          <span className="num" style={{ position: "absolute", right: -5, bottom: -3, background: T.bg2, border: `1.5px solid ${T.gold}`, color: T.gold, borderRadius: "50%", width: 18, height: 18, fontSize: 10, fontWeight: 800, display: "flex", alignItems: "center", justifyContent: "center" }}>{p.nivel}</span>
        </div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div className="disp" style={{ fontSize: 16, fontWeight: 800, lineHeight: 1.1, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
            {p.nome} {nome}
          </div>
          <div style={{ fontSize: 11, color: T.sub, marginTop: 1, textTransform: "uppercase", letterSpacing: 0.4 }}>{contexto}</div>
        </div>
        <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-end", gap: 4, flexShrink: 0 }}>
          {streak > 0 && (
            <span style={{ fontSize: 11, fontWeight: 700, color: T.gold, background: `${T.gold}14`, border: `1px solid ${T.gold}44`, borderRadius: 7, padding: "2px 7px", whiteSpace: "nowrap" }}>🔥 {streak} {streak === 1 ? "dia" : "dias"}</span>
          )}
          <span className="num" style={{ fontSize: 11.5, fontWeight: 800, color: T.gold }}>{xp.toLocaleString("pt-BR")} XP</span>
        </div>
      </div>
      {p.proxXp != null && (
        <div style={{ marginTop: 9 }}>
          <BarraXP pct={p.pctProx} alt={5} brilho={false} />
          <div style={{ fontSize: 10, color: T.sub, marginTop: 3 }}>
            faltam {(p.proxXp - xp).toLocaleString("pt-BR")} XP para <b style={{ color: T.gold }}>{p.proxNome}</b>
          </div>
        </div>
      )}
    </div>
  );
}

export function MissaoAtual({ meta, trilha, m }) {
  const T = useTema();
  if (!meta) {
    return (
      <div style={{ background: T.card, border: `1px solid ${T.line}`, borderRadius: 14, padding: 18, textAlign: "center" }}>
        <div className="disp" style={{ fontSize: 15, fontWeight: 700 }}>Missão sendo preparada</div>
        <div style={{ fontSize: 12.5, color: T.sub, marginTop: 6, lineHeight: 1.5 }}>
          A missão da semana nasce no servidor, na virada. Se demorar, fale com a coordenação.
        </div>
      </div>
    );
  }

  const semana = trilha.semanas.find((s) => s.numero === meta.semana_numero);
  const proxima = trilha.semanas.find((s) => s.numero === meta.semana_numero + 1);
  const itens = meta.meta_atividades ?? [];
  const feitas = itens.filter((x) => x.estado === "concluida").length;
  const ignoradas = itens.filter((x) => x.estado === "ignorada").length;
  const consideradas = Math.max(1, itens.length - ignoradas);
  const pendentes = consideradas - feitas;
  const pct = Math.min(100, Math.round((feitas / consideradas) * 100));
  const disciplinas = new Set((trilha.atividadesPorSemana[meta.semana_numero] ?? []).map((a) => a.disciplina_codigo)).size;

  // meta de XP da semana: quanto a missão vale e quanto já foi garantido
  const xpDe = (it) => xpPorPrioridade[trilha.atividadesPorId[it.atividade_modelo_id]?.prioridade] ?? 40;
  const xpMissao = itens.filter((x) => x.estado !== "ignorada").reduce((s, it) => s + xpDe(it), 0);
  const xpGanho = itens.filter((x) => x.estado === "concluida").reduce((s, it) => s + xpDe(it), 0);

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
      {/* MISSÃO ATUAL */}
      <div style={{ background: `linear-gradient(160deg, ${T.cardHi}, ${T.card})`, border: `1.5px solid ${T.gold}66`, borderRadius: 14, padding: 16 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 9, flexWrap: "wrap", marginBottom: 8 }}>
          <span className="disp" style={{ background: T.gold, color: "#0A1622", borderRadius: 8, padding: "3px 11px", fontWeight: 800, fontSize: 14 }}>
            {L.missao.toUpperCase()} {meta.semana_numero}
          </span>
          <span style={{ fontSize: 11, color: T.gold, fontWeight: 700, textTransform: "uppercase", letterSpacing: 0.4 }}>⊚ alvo atual</span>
          <span style={{ marginLeft: "auto", textAlign: "right" }}>
            <b className="num disp" style={{ fontSize: 18, color: T.ink }}>{feitas}/{consideradas}</b>
            <div style={{ fontSize: 9.5, color: T.sub, textTransform: "uppercase", letterSpacing: 0.4 }}>alvos abatidos</div>
          </span>
        </div>

        {semana && <div className="disp" style={{ fontSize: 17, fontWeight: 700, lineHeight: 1.25 }}>{semana.foco}</div>}
        {semana?.simulado && <div style={{ fontSize: 12, color: T.red, fontWeight: 700, marginTop: 4 }}>⚑ {semana.simulado} nesta missão</div>}

        {/* barra com o marcador navegando */}
        <div style={{ position: "relative", height: 24, margin: "14px 0 8px" }}>
          <div style={{ position: "absolute", top: 7, left: 0, right: 0, height: 10, background: T.bg, borderRadius: 6, overflow: "hidden" }}>
            <div style={{ width: `${pct}%`, height: "100%", background: `linear-gradient(90deg, ${T.gold}, ${T.green})`, transition: "width .4s" }} />
          </div>
          <div style={{ position: "absolute", top: 0, left: `calc(${pct}% - 12px)`, width: 24, height: 24, borderRadius: "50%", background: T.bg2, border: `2px solid ${T.gold}`, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 12, transition: "left .4s", boxShadow: "0 0 8px #0008" }}>⚓</div>
        </div>

        {/* frase de missão objetiva */}
        <div style={{ fontSize: 13, color: T.ink, fontWeight: 600, marginTop: 6, lineHeight: 1.4 }}>
          {pendentes > 0
            ? <>🎯 Sua missão: concluir <b style={{ color: T.gold }}>{pendentes} {pendentes === 1 ? "objetivo" : "objetivos"}</b> até {fmtBR(String(meta.fim))}.</>
            : <span style={{ color: T.green }}>✓ Missão cumprida! Todos os objetivos desta semana foram concluídos.</span>}
        </div>
        <div style={{ display: "flex", justifyContent: "space-between", fontSize: 11, color: T.sub, marginTop: 8, flexWrap: "wrap", gap: 6 }}>
          <span>{disciplinas} disciplinas · {itens.length} objetivos{ignoradas > 0 ? ` · ${ignoradas} adiados` : ""}</span>
          <span>{fmtBR(String(meta.inicio))} – {fmtBR(String(meta.fim))}</span>
        </div>

        {/* meta de XP da semana — objetivo concreto e curto */}
        {xpMissao > 0 && (
          <div style={{ display: "flex", alignItems: "center", gap: 8, marginTop: 10, background: T.bg, border: `1px solid ${T.line}`, borderRadius: 9, padding: "8px 11px" }}>
            <span style={{ fontSize: 14 }}>⭐</span>
            <span style={{ flex: 1, fontSize: 11.5, color: T.sub }}>XP da missão</span>
            <span className="num" style={{ fontSize: 13, fontWeight: 800 }}>
              <b style={{ color: xpGanho >= xpMissao ? T.green : T.gold }}>{xpGanho}</b>
              <span style={{ color: T.sub, fontWeight: 600 }}> / {xpMissao} XP</span>
            </span>
          </div>
        )}
      </div>

      {/* RADAR DE DESEMPENHO */}
      {m && (
        <div>
          <div style={{ fontSize: 11, color: T.sub, fontWeight: 700, textTransform: "uppercase", letterSpacing: 0.6, margin: "2px 2px 8px" }}>◎ {L.radar}</div>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(150px,1fr))", gap: 10 }}>
            <StatCard rotulo={L.precisao} valor={`${m.acerto}%`} sub="acerto geral" icone="◎" tom={m.acerto >= 70 ? "ok" : m.acerto > 0 ? "alerta" : "neutro"} />
            <StatCard rotulo={L.horas} valor={fmtHoras(m.minutosTotais ?? 0)} sub="tempo registrado" icone="◷" />
            <StatCard rotulo={L.alvos} valor={m.totDone} sub={`${m.qSem} nesta semana`} icone="✦" />
            <StatCard rotulo={L.ritmo} valor={fmtHorasCurto(m.mediaMinutosDia ?? 0)} sub={`ofensiva: ${m.streak} 🔥`} icone="⧗" />
          </div>
        </div>
      )}

      {/* PRÓXIMA MISSÃO — compacta */}
      {proxima ? (() => {
        const diasDesbloqueio = Math.max(0, daysBetween(new Date(todayISO()), new Date(String(proxima.inicio))));
        return (
          <div style={{ display: "flex", alignItems: "center", gap: 12, background: T.card, border: `1px solid ${T.line}`, borderRadius: 12, padding: "11px 14px" }}>
            <div style={{ width: 38, height: 38, borderRadius: 10, border: `1.5px solid ${T.line}`, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 17, flexShrink: 0 }}>🔒</div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontSize: 10.5, color: T.sub, textTransform: "uppercase", letterSpacing: 0.5 }}>{L.proximaMissao}</div>
              <div className="disp" style={{ fontSize: 14.5, fontWeight: 700 }}>{L.missao} {proxima.numero}</div>
            </div>
            <div style={{ textAlign: "right", flexShrink: 0 }}>
              <div style={{ fontSize: 10, color: T.sub }}>desbloqueia em</div>
              <StatusBadge tom="alerta">
                {diasDesbloqueio === 0 ? "hoje à meia-noite" : diasDesbloqueio === 1 ? "1 dia" : `${diasDesbloqueio} dias`}
              </StatusBadge>
            </div>
          </div>
        );
      })() : (
        <div style={{ background: T.card, border: `1px solid ${T.line}`, borderRadius: 12, padding: "12px 14px", textAlign: "center", fontSize: 12.5, color: T.sub }}>
          🏁 Última missão do plano — reta final. Boa prova!
        </div>
      )}
    </div>
  );
}
