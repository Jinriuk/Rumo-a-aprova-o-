/* Hoje e Plano pelo desenho aprovado em 18/10 (raio-x fase 2).
   Hoje: o cartão "Missão de agora", a semana das missões em uma linha e as
   missões dela abertas, sem clique; "Ver próximas semanas" abre ali mesmo.
   Cada linha: ✓ concluída (sem botão), ▶ a de agora ou já começada,
   ○ a fazer. Botão só na missão da vez da matéria (o servidor recusa as
   outras): com questões ligadas, "Iniciar" abre a sessão na hora; sem,
   "Registrar" abre o registro já com a missão. No Plano, a concluída
   ganha "Revisar" (decisão de 18/10: revisão só no Plano).
   Quem monta as linhas é montarMissoesPorSemana (conteudo/missoesPorSemana.js). */
import React, { useState } from "react";
import { BarraXP } from "../../shared/ui/componentes.jsx";
import { useTema } from "../../shared/branding/BrandingContext.jsx";
import { nomeDaMateria } from "./jornada.js";
import { destinoDoInicio, podeResolverAqui } from "./questoesIntegradas.js";
import { podeComecar, resumoMissoesDaSemana, nomeCurtoMateria } from "../conteudo/missoesPorSemana.js";

const textoQuestoes = (l) => (l.meta_questoes ? `${l.questoes} de ${l.meta_questoes} questões` : "acompanhada com a coordenação");
const placar = (l) => (l.meta_questoes ? `${l.questoes}/${l.meta_questoes}` : "");

/* O que o botão da linha faz. null = sem botão. */
export function acaoDaMissao(linha, questoesIntegradas, { modo = "hoje", podeResolver = true } = {}) {
  if (!linha) return null;
  if (linha.estado === "concluida") {
    if (modo !== "plano") return null;
    return podeResolver && podeResolverAqui(linha, questoesIntegradas)
      ? { tipo: "revisar-questoes", rotulo: "Revisar" }
      : { tipo: "revisar-registro", rotulo: "Revisar" };
  }
  if (!podeComecar(linha)) return null;
  const destino = destinoDoInicio(linha, questoesIntegradas, { podeResolver });
  if (destino === "carregando") return { tipo: "carregando", rotulo: "…" };
  return destino === "questoes" ? { tipo: "questoes", rotulo: "Iniciar" } : { tipo: "registro", rotulo: "Registrar" };
}

export function MissaoDeAgora({ missao, nomesMateria, questoesIntegradas, carregando = false, semMissoes = false, aoAgir, aoRegistrarLivre }) {
  const T = useTema();
  const acao = carregando ? { tipo: "carregando", rotulo: "…" } : acaoDaMissao(missao, questoesIntegradas);
  const ocupado = acao?.tipo === "carregando";
  return (
    <section aria-label="Missão de agora" className="mission-card"
      style={{ "--mission-accent": T.gold, background: `linear-gradient(160deg, ${T.cardHi}, ${T.card})`, border: `1.5px solid ${T.gold}66`, borderRadius: 14, padding: 16 }}>
      <div style={{ fontSize: 11, color: T.gold, fontWeight: 700, textTransform: "uppercase", letterSpacing: 0.6 }}>Missão de agora</div>
      {carregando ? (
        <h2 className="disp" style={{ fontSize: 17, fontWeight: 700, margin: "6px 0 0" }}>Buscando a sua missão…</h2>
      ) : missao ? (
        <>
          <div style={{ fontSize: 13, color: T.sub, fontWeight: 600, marginTop: 6 }}>{nomeDaMateria(missao.materia_codigo, nomesMateria)}</div>
          <h2 className="disp" style={{ fontSize: 18, fontWeight: 700, lineHeight: 1.25, margin: "2px 0 0" }}>{missao.nome}</h2>
          <div style={{ display: "flex", alignItems: "center", gap: 10, marginTop: 10 }}>
            <span className="num" style={{ fontSize: 12.5, color: T.sub, whiteSpace: "nowrap" }}>{textoQuestoes(missao)}</span>
            {missao.meta_questoes ? <span style={{ flex: 1 }}><BarraXP pct={missao.pct} alt={8} brilho={false} /></span> : null}
          </div>
        </>
      ) : (
        <h2 className="disp" style={{ fontSize: 17, fontWeight: 700, margin: "6px 0 0" }}>
          {semMissoes ? "Seu concurso ainda não tem missões com questões" : "Missões em dia"}
        </h2>
      )}
      {!carregando && !missao && aoRegistrarLivre && (
        <button type="button" className="mission-primary-action" onClick={aoRegistrarLivre}
          style={{ display: "block", width: "100%", marginTop: 14, background: "transparent", color: T.gold, border: `1.5px solid ${T.gold}`, borderRadius: 9, padding: "12px 16px", fontWeight: 700, fontSize: 14, cursor: "pointer" }}>
          Registrar estudo
        </button>
      )}
      {acao && aoAgir && (
        <button type="button" className="mission-primary-action" onClick={() => aoAgir(missao, acao)}
          disabled={ocupado} aria-busy={ocupado || undefined}
          style={{ display: "block", width: "100%", marginTop: 14, background: T.gold, color: "#0A1622", border: `1.5px solid ${T.gold}`, borderRadius: 9, padding: "12px 16px", fontWeight: 700, fontSize: 14, cursor: ocupado ? "progress" : "pointer", opacity: ocupado ? 0.7 : 1 }}>
          {ocupado ? "Carregando…" : acao.tipo === "questoes" ? "▶ Iniciar missão" : "Registrar"}
        </button>
      )}
    </section>
  );
}

export function LinhaMissao({ linha, deAgora = false, nomesMateria, questoesIntegradas, modo = "hoje", aoAgir }) {
  const T = useTema();
  const acao = aoAgir ? acaoDaMissao(linha, questoesIntegradas, { modo }) : null;
  const feita = linha.estado === "concluida";
  const comecada = deAgora || (linha.estado === "atual" && linha.questoes > 0);
  const icone = feita ? "✓" : comecada ? "▶" : "○";
  const corIcone = feita ? T.green : comecada ? T.gold : T.sub;
  const materia = nomeCurtoMateria(nomeDaMateria(linha.materia_codigo, nomesMateria));
  return (
    <li data-estado={linha.estado} style={{ display: "flex", alignItems: "center", gap: 10, padding: "9px 0", borderBottom: `1px solid ${T.line}` }}>
      <span aria-hidden="true" style={{ width: 16, textAlign: "center", color: corIcone, fontWeight: 800, flexShrink: 0 }}>{icone}</span>
      <span style={{ flex: 1, minWidth: 0, fontSize: 13.5, lineHeight: 1.3, color: feita ? T.sub : T.ink, overflow: "hidden", display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical" }}>
        <span className="sr-only">{feita ? "Concluída: " : comecada ? "Em andamento: " : "A fazer: "}</span>
        <b style={{ fontWeight: 700 }}>{materia}</b> · {linha.nome}
      </span>
      <span className="num" style={{ fontSize: 12.5, color: T.sub, flexShrink: 0 }}>{placar(linha)}</span>
      {acao && (
        <button type="button" onClick={() => aoAgir(linha, acao)} disabled={acao.tipo === "carregando"}
          aria-label={`${acao.rotulo === "…" ? "Carregando" : acao.rotulo}: ${linha.nome}`}
          style={{ flexShrink: 0, minWidth: 74, minHeight: 36, borderRadius: 8, border: `1px solid ${T.gold}`, background: acao.tipo === "questoes" ? T.gold : "transparent", color: acao.tipo === "questoes" ? "#0A1622" : T.gold, fontWeight: 700, fontSize: 12.5, cursor: "pointer", padding: "0 10px" }}>
          {acao.rotulo}
        </button>
      )}
    </li>
  );
}

export function ListaMissoes({ linhas, deAgoraId = null, ...resto }) {
  return (
    <ul style={{ listStyle: "none", margin: 0, padding: 0 }}>
      {linhas.map((l) => <LinhaMissao key={l.id} linha={l} deAgora={l.id === deAgoraId} {...resto} />)}
    </ul>
  );
}

/* O bloco do Hoje abaixo do cartão: a semana das missões e as próximas,
   que abrem na própria tela (nada aqui troca de aba). */
export function MissoesDoHoje({ montagem, totalSemanas, nomesMateria, questoesIntegradas, aoAgir }) {
  const T = useTema();
  const [verProximas, setVerProximas] = useState(false);
  const { porSemana, semanaAtual, missaoDeAgora, semSemana = [] } = montagem;
  const comuns = { nomesMateria, questoesIntegradas, aoAgir, modo: "hoje" };
  if (semanaAtual == null) {
    // missões fora das semanas do plano (concurso sem plano semanal)
    const soltas = semSemana.filter((l) => l.estado !== "manual");
    if (!soltas.some((l) => l.estado !== "concluida")) return null;
    return (
      <section aria-label="Missões do concurso">
        <div className="num" style={{ fontSize: 13.5, fontWeight: 700, color: T.ink, margin: "2px 0 4px" }}>
          Missões do concurso · {resumoMissoesDaSemana(soltas).texto}
        </div>
        <ListaMissoes linhas={soltas} deAgoraId={missaoDeAgora?.id} {...comuns} />
      </section>
    );
  }
  const linhas = porSemana.get(semanaAtual) ?? [];
  const proximas = [...porSemana.keys()].filter((n) => n > semanaAtual).sort((a, b) => a - b);
  return (
    <section aria-label="Missões da semana">
      <div className="num" style={{ fontSize: 13.5, fontWeight: 700, color: T.ink, margin: "2px 0 4px" }}>
        Semana {semanaAtual}{totalSemanas ? ` de ${totalSemanas}` : ""} · {resumoMissoesDaSemana(linhas).texto}
      </div>
      <ListaMissoes linhas={linhas} deAgoraId={missaoDeAgora?.id} {...comuns} />
      {proximas.length > 0 && (
        <>
          <button type="button" aria-expanded={verProximas} onClick={() => setVerProximas((v) => !v)}
            style={{ display: "block", margin: "10px auto 0", background: "none", border: "none", color: T.sub, fontSize: 13, fontWeight: 600, minHeight: 40, cursor: "pointer" }}>
            {verProximas ? "Ocultar próximas semanas ▴" : "Ver próximas semanas ▾"}
          </button>
          {verProximas && proximas.map((n) => (
            <div key={n} style={{ marginTop: 12 }}>
              <div className="num" style={{ fontSize: 12.5, fontWeight: 700, color: T.sub, marginBottom: 2 }}>
                Semana {n} · {resumoMissoesDaSemana(porSemana.get(n)).texto}
              </div>
              <ListaMissoes linhas={porSemana.get(n)} {...comuns} />
            </div>
          ))}
        </>
      )}
    </section>
  );
}
