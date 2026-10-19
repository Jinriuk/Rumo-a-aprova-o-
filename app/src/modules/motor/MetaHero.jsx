/* "Hoje" — peças da área do aluno: a faixa do aspirante (patente + XP +
   ofensiva) e o cartão de ciclo encerrado. O cartão da semana ("Missão N ·
   alvo atual"), o radar e a "Próxima Missão" saíram do Hoje no raio-x fase
   2 (18/10): o topo é a missão da vez (MissaoDaVez.jsx).
   Tudo derivado de dado REAL; o jargão é só apresentação. */
import React from "react";
import { BarraXP } from "../../shared/ui/componentes.jsx";
import { Insignia } from "../../shared/ui/Insignia.jsx";
import { useTema } from "../../shared/branding/BrandingContext.jsx";
import { fmtBR } from "../../shared/regras/regras.js";
import { patente } from "./jargao.js";

export function FaixaAspirante({ nome, contexto, xp, streak, aoAbrirConquistas }) {
  const T = useTema();
  const p = patente(xp);
  const abrirPorTeclado = aoAbrirConquistas ? (e) => {
    if (e.key === "Enter" || e.key === " ") { e.preventDefault(); aoAbrirConquistas(); }
  } : undefined;
  return (
    <div className="player-rank" onClick={aoAbrirConquistas} onKeyDown={abrirPorTeclado}
      role={aoAbrirConquistas ? "button" : undefined} tabIndex={aoAbrirConquistas ? 0 : undefined}
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

/* CICLO ENCERRADO (Onda 3 — A1). A trilha acabou: não há missão nova
   para cobrar, e insistir em cobrar a última é o defeito que deixou 63
   alunos do demo olhando "MISSÃO 9, ATRASADA" em vermelho por 43 dias.

   O que esta tela NÃO faz: declarar que a prova passou. A prova tem
   data própria (ver concursos.js) e, no dado real, 40 dos 63 alunos
   têm prova DEPOIS do fim da trilha — para eles o ciclo de estudo
   acabou e a prova ainda vem. Aqui só se fala do plano de estudo.

   O aluno continua podendo registrar estudo e simulado (decisão de
   produto): o ciclo fecha a cobrança, não a porta. */
export function CicloEncerrado({ trilha, m, metas, aoAvancar }) {
  const T = useTema();
  const ultima = trilha?.semanas?.[trilha.semanas.length - 1] ?? null;
  const semanas = Array.isArray(metas) ? metas.length : (trilha?.semanas?.length ?? 0);
  const alvos = Array.isArray(metas)
    ? metas.reduce((soma, x) => soma + (x.meta_atividades ?? []).filter((i) => i.estado === "concluida").length, 0)
    : 0;

  const numero = (valor, rotulo) => (
    <div style={{ flex: "1 1 88px", minWidth: 78 }}>
      <div className="num disp" style={{ fontSize: 21, fontWeight: 800, color: T.ink, lineHeight: 1.1 }}>{valor}</div>
      <div style={{ fontSize: 10, color: T.sub, textTransform: "uppercase", letterSpacing: 0.4, marginTop: 2 }}>{rotulo}</div>
    </div>
  );

  return (
    <div className="mission-card" style={{ "--mission-accent": T.green, background: `linear-gradient(160deg, ${T.cardHi}, ${T.card})`, border: `1.5px solid ${T.green}66`, borderRadius: 14, padding: 16 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 9, flexWrap: "wrap", marginBottom: 10 }}>
        <span className="disp" style={{ background: T.green, color: "#0A1622", borderRadius: 8, padding: "3px 11px", fontWeight: 800, fontSize: 14 }}>
          CICLO CONCLUÍDO
        </span>
        {ultima && (
          <span style={{ fontSize: 11, color: T.sub, fontWeight: 700, textTransform: "uppercase", letterSpacing: 0.4 }}>
            encerrado em {fmtBR(String(ultima.fim))}
          </span>
        )}
      </div>

      {trilha?.trilha?.nome && (
        <div className="disp" style={{ fontSize: 17, fontWeight: 700, lineHeight: 1.25 }}>{trilha.trilha.nome}</div>
      )}

      <div style={{ display: "flex", flexWrap: "wrap", gap: 14, marginTop: 14, paddingTop: 14, borderTop: `1px solid ${T.line}` }}>
        {numero(semanas, semanas === 1 ? "semana" : "semanas")}
        {numero(alvos, "alvos abatidos")}
        {m?.totDone != null && numero(m.totDone.toLocaleString("pt-BR"), "questões")}
        {m?.acerto != null && numero(`${m.acerto}%`, "de acerto")}
      </div>

      <div style={{ fontSize: 13, color: T.sub, marginTop: 14, lineHeight: 1.5 }}>
        A trilha chegou ao fim. A coordenação abre a próxima quando ela estiver pronta &mdash;
        até lá, <b style={{ color: T.ink }}>você continua podendo registrar estudo e simulado</b>, e tudo
        que registrar entra no seu histórico.
      </div>

      {aoAvancar && (
        <button type="button" className="mission-primary-action" onClick={() => aoAvancar("registrar")}
          style={{ display: "block", width: "100%", marginTop: 12, background: "transparent", color: T.gold, border: `1.5px solid ${T.gold}`, borderRadius: 9, padding: "10px 16px", fontWeight: 700, fontSize: 13, cursor: "pointer", textAlign: "center" }}>
          Registrar estudo
        </button>
      )}
    </div>
  );
}
