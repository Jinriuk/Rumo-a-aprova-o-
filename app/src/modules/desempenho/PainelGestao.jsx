/* "Painel de Gestão" da coordenação (ref. designs): indicadores de
   gestão, cards de ALERTA de risco (sem atividade, sem credencial,
   meta atrasada) e ranking resumido. Tudo leitura, dentro do tenant
   (a RLS já limita à escola). Clicar num alerta leva à aba útil. */
import React, { useState } from "react";
import { SectionCard, StatCard, EmptyState } from "../../shared/ui/componentes.jsx";
import { useTema } from "../../shared/branding/BrandingContext.jsx";
import { fmtHorasCurto } from "../motor/jargao.js";
import { acertoPonderadoSemana } from "../../shared/metricas/agregados.js";
import { podioDaSemana } from "./ranking.js";
import { LIMIAR } from "../conteudo/niveisAluno.js";

// `resumo` já vem agregado por aluno (RPC resumo_escola, adaptado em
// adaptarResumoEscola) — o painel só lê e exibe; nenhuma varredura de
// registros no cliente.
export function PainelGestao({ resumo, aoIr, aoIrFiltrado }) {
  const T = useTema();
  const ag = resumo;

  // Hook antes do return condicional abaixo (regra dos hooks: a lista
  // pode ficar vazia hoje e ganhar alunos depois, sem remontar o
  // componente — a ordem dos hooks não pode depender disso).
  const [criterio, setCriterio] = useState("acerto");

  if (ag.length === 0) {
    return (
      <SectionCard titulo="Painel de gestão">
        <EmptyState icone="📋" titulo="Nenhum aluno cadastrado ainda"
          dica="Cadastre turmas e alunos na aba Alunos. Os indicadores de gestão aparecem aqui." />
      </SectionCard>
    );
  }

  const total = ag.length;
  const ativos = ag.filter((x) => !x.semAtividade).length;
  const semAtividade = ag.filter((x) => x.semAtividade).length;
  const semCredencial = ag.filter((x) => x.semCredencial).length;
  // semana em curso: meta incompleta é PENDÊNCIA (em aberto), não "atraso".
  const metaPendente = ag.filter((x) => x.metaIncompleta).length;
  // D04: acerto ponderado dos 7 dias (mesma janela dos cards vizinhos)
  const acertoSemana = acertoPonderadoSemana(ag);
  const questoesSemana = ag.reduce((s, x) => s + x.qSem, 0);

  // Destaques: a escola escolhe o critério (Fase 9 do doc central).
  // D05/D06 (Bloco 3): o pódio é o do Ranking — mesma função
  // (./ranking.js), janela de 7 dias, piso de volume. As linhas já vêm
  // na janela, então r.q/r.acc/r.minutos/r.dias são todos de 7 dias
  // (T32: acerto não pode ser o único critério de janela geral).
  const CRITERIOS = {
    acerto: { rotulo: "Melhor acerto (7d)", fmt: (r) => (r.acc == null ? "—" : `${r.acc}%`), sub: "acerto 7d" },
    questoes: { rotulo: "Mais questões (7d)", fmt: (r) => r.q, sub: "questões 7d" },
    tempo: { rotulo: "Mais tempo (7d)", fmt: (r) => fmtHorasCurto(r.minutos), sub: "tempo 7d" },
    dias: { rotulo: "Mais dias (7d)", fmt: (r) => `${r.dias}d`, sub: "dias 7d" },
  };
  const crit = CRITERIOS[criterio];
  const ranking = podioDaSemana(ag, criterio);

  const nomeTurma = (a) => (a.alunos_turmas ?? []).map((v) => v.turmas?.nome).filter(Boolean)[0];

  // ir é uma função onClick (ou null quando n===0)
  const Alerta = ({ tom, icone, titulo, sub, n, ir, rotuloCta, nomes = [] }) => {
    const cor = tom === "risco" ? T.red : tom === "alerta" ? T.gold : T.sub;
    const preview = nomes.slice(0, 3);
    return (
      <button type="button" onClick={ir ?? undefined}
        style={{ width: "100%", textAlign: "left", display: "flex", alignItems: "flex-start", gap: 12, background: T.card, border: `1px solid ${T.line}`, borderLeft: `4px solid ${cor}`, borderRadius: 12, padding: "13px 15px", cursor: ir ? "pointer" : "default" }}>
        <div style={{ width: 38, height: 38, borderRadius: 10, background: `${cor}1a`, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 18, flexShrink: 0, marginTop: 1 }}>{icone}</div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div className="disp" style={{ fontSize: 14.5, fontWeight: 700 }}>{titulo}</div>
          <div style={{ fontSize: 11.5, color: T.sub, marginTop: 1 }}>{sub}</div>
          {preview.length > 0 && (
            <div style={{ fontSize: 11, color: T.sub, marginTop: 4, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
              {preview.join(", ")}{nomes.length > 3 ? ` e mais ${nomes.length - 3}` : ""}
            </div>
          )}
          {ir && rotuloCta && (
            <div style={{ fontSize: 11.5, color: cor, fontWeight: 700, marginTop: 6 }}>{rotuloCta} →</div>
          )}
        </div>
        <div style={{ textAlign: "right", flexShrink: 0 }}>
          <div className="num disp" style={{ fontSize: 22, fontWeight: 800, color: cor }}>{n}</div>
          <div style={{ fontSize: 9.5, color: T.sub, textTransform: "uppercase", letterSpacing: 0.4 }}>{n === 1 ? "aluno" : "alunos"}</div>
        </div>
      </button>
    );
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
      {/* KPIs */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(140px,1fr))", gap: 10 }}>
        <StatCard rotulo="Alunos" valor={total} icone="👥" />
        <StatCard rotulo="Ativos na semana" valor={ativos} sub={`de ${total}`} icone="✦" tom={ativos >= total * 0.6 ? "ok" : "alerta"} />
        <StatCard rotulo="Acerto (7 dias)" valor={acertoSemana == null ? "—" : `${acertoSemana}%`} icone="◎" tom={acertoSemana == null ? "neutro" : acertoSemana >= 70 ? "ok" : "alerta"} />
        <StatCard rotulo="Questões (7 dias)" valor={questoesSemana} icone="📈" />
      </div>

      {/* ALERTAS DE RISCO — T33: card zerado não informa nada (nem "0
          alunos"); o título da seção também some quando os três estão
          em zero, senão sobra como cabeçalho vazio. */}
      {(semAtividade > 0 || semCredencial > 0 || metaPendente > 0) && (
        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          <div style={{ fontSize: 11, color: T.sub, fontWeight: 700, textTransform: "uppercase", letterSpacing: 0.6, margin: "2px 2px 0" }}>⚠ Alertas de risco</div>
          {semAtividade > 0 && (
            <Alerta tom="risco" icone="💤" titulo="Sem atividade" sub="Nenhum registro nos últimos 7 dias" n={semAtividade}
              ir={() => aoIrFiltrado ? aoIrFiltrado("alunos", "sem-atividade") : aoIr("ranking")}
              rotuloCta="Ver lista filtrada"
              nomes={ag.filter((x) => x.semAtividade).map((x) => x.aluno.nome.split(" ")[0])} />
          )}
          {semCredencial > 0 && (
            <Alerta tom="alerta" icone="🔑" titulo="Sem credencial" sub="Acesso ainda não liberado" n={semCredencial}
              ir={() => aoIrFiltrado ? aoIrFiltrado("alunos", "sem-credencial") : aoIr("alunos")}
              rotuloCta="Liberar credenciais"
              nomes={ag.filter((x) => x.semCredencial).map((x) => x.aluno.nome.split(" ")[0])} />
          )}
          {metaPendente > 0 && (
            <Alerta tom="neutro" icone="🏁" titulo="Pendências da semana" sub="Missão desta semana ainda em aberto (semana em curso)" n={metaPendente}
              ir={() => aoIrFiltrado ? aoIrFiltrado("alunos", "meta-atrasada") : aoIr("ranking")}
              rotuloCta="Ver alunos com pendências"
              nomes={ag.filter((x) => x.metaIncompleta).map((x) => x.aluno.nome.split(" ")[0])} />
          )}
        </div>
      )}

      {/* RANKING RESUMIDO — critério escolhido pela escola */}
      <SectionCard titulo="Destaques da semana" acao={
        <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
          <select value={criterio} onChange={(e) => setCriterio(e.target.value)} aria-label="Critério de destaque"
            style={{ background: T.bg, border: `1px solid ${T.line}`, color: T.ink, borderRadius: 8, padding: "7px 9px", fontSize: 12 }}>
            {Object.entries(CRITERIOS).map(([k, c]) => <option key={k} value={k} style={{ background: T.bg2 }}>{c.rotulo}</option>)}
          </select>
          {/* T1: sem padding nenhum antes — o pior caso do bloco (~17px). */}
          <button type="button" onClick={() => aoIr("ranking")} style={{ border: "none", background: "transparent", color: T.gold, fontSize: 12.5, fontWeight: 700, padding: "9px 4px", minHeight: 32 }}>Ver completo ›</button>
        </div>
      } semPadding>
        {ranking.length === 0 ? (
          <div style={{ padding: 8 }}><EmptyState icone="🏆" titulo="Sem dados para ranking" dica={`Os destaques aparecem quando algum aluno passa de ${LIMIAR.VOLUME_MINIMO} questões nos últimos 7 dias.`} /></div>
        ) : (
          <div style={{ display: "flex", flexDirection: "column" }}>
            {ranking.map((r, i) => (
              <div key={r.aluno.id} style={{ display: "flex", alignItems: "center", gap: 12, padding: "11px 14px", borderBottom: i === ranking.length - 1 ? "none" : `1px solid ${T.line}` }}>
                <div className="num disp" style={{ width: 28, textAlign: "center", fontSize: 18, fontWeight: 800, color: T.gold }}>{["🥇", "🥈", "🥉"][i]}</div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 14, fontWeight: 700 }}>{r.aluno.nome}</div>
                  <div style={{ fontSize: 11, color: T.sub }}>{nomeTurma(r.aluno) || "sem turma"} · {r.q} questões em 7 dias</div>
                </div>
                <div style={{ textAlign: "right" }}>
                  <div className="num disp" style={{ fontSize: 16, fontWeight: 800, color: T.gold }}>{crit.fmt(r)}</div>
                  <div style={{ fontSize: 9.5, color: T.sub, textTransform: "uppercase" }}>{crit.sub}</div>
                </div>
              </div>
            ))}
          </div>
        )}
      </SectionCard>
    </div>
  );
}
