/* Classificação da turma — visão da COORDENAÇÃO. Ranqueia os alunos
   da escola por esforço e resultado, com filtro por turma e janela
   (últimos 7 dias / geral). Decisão registrada: o ranking é só da
   escola; aluno não vê classificação de aluno (comparativo social
   entre alunos é Fase 3, travada nos documentos). */
import React, { useMemo, useState } from "react";
import { corDeAcerto } from "./metricas.js";
import { Card, Empty, StatusBadge } from "../../shared/ui/componentes.jsx";
import { useTema } from "../../shared/branding/BrandingContext.jsx";
import { fmtBR } from "../../shared/regras/regras.js";
import { provaDoConcurso, notaPct, totalAcertos, totalQuestoes } from "../conteudo/provas.js";
import { LIMIAR } from "../conteudo/niveisAluno.js";
import { CRITERIOS_ESTUDO, linhaDeEstudo, classificarEstudo, semPodioNaJanela } from "./ranking.js";

const MEDALHAS = ["🥇", "🥈", "🥉"];
const fmtH = (min) => {
  if (!min) return "0m";
  const h = Math.floor(min / 60), m = Math.round(min % 60);
  return h ? `${h}h${String(m).padStart(2, "0")}m` : `${m}m`;
};

export function ClassificacaoTurma({ alunos, turmas, resumoPorAluno = {}, simulados = [], concursosPorId }) {
  const T = useTema();
  const [modo, setModo] = useState("estudos"); // estudos | simulados (Fase 11: dois rankings)
  // T34/T35: "acerto" é o critério padrão desta tela (era "questoes") —
  // acerto só compara quem já passou do piso de volume (abaixo, ver
  // LIMIAR.VOLUME_MINIMO), então não corre o risco de abrir com um
  // aluno de 1 questão e 100% no topo.
  const [criterio, setCriterio] = useState("acerto");
  const [turmaId, setTurmaId] = useState("");
  const [janela, setJanela] = useState("semana"); // semana (últimos 7 dias) | geral

  // O agregado por aluno já vem pronto do banco; aqui só escolhemos a
  // janela (geral/7d) e ordenamos. Sem varrer registros no cliente.
  //
  // T34/T35: nem todo mundo tem volume pra ser COMPARADO — um aluno com
  // 2 questões e 100% de acerto não é "melhor" que um com 80 questões e
  // 85%, é só pouco dado. `comparaveis` (q >= LIMIAR.VOLUME_MINIMO na
  // janela ativa) entra na lista numerada; o resto vai para
  // `semDadosSuficientes`, sem posição — ordenados por nome, nunca por
  // um critério que não têm volume pra sustentar.
  // D05: a classificação mora em ./ranking.js, a mesma que o pódio do
  // Painel de gestão usa — as duas telas não podem mais divergir.
  const { comparaveis, semDadosSuficientes } = useMemo(() => {
    const visiveis = alunos.filter(
      (a) => !turmaId || (a.alunos_turmas ?? []).some((v) => v.turma_id === turmaId),
    );
    const linhas = visiveis.map((a) => linhaDeEstudo(a, resumoPorAluno[a.id], janela));
    return classificarEstudo(linhas, criterio);
  }, [alunos, resumoPorAluno, turmaId, janela, criterio]);

  // RANKING 2 — Simulados: a nota como a PROVA classificaria (melhor
  // simulado de cada aluno na janela; nota pela estrutura do concurso).
  // Simulados são indexados por aluno uma vez (Map) — sem O(n×m).
  const rankingSim = useMemo(() => {
    const simPorAluno = new Map();
    for (const s of simulados) {
      const arr = simPorAluno.get(s.aluno_id);
      if (arr) arr.push(s); else simPorAluno.set(s.aluno_id, [s]);
    }
    const visiveis = alunos.filter(
      (a) => !turmaId || (a.alunos_turmas ?? []).some((v) => v.turma_id === turmaId),
    );
    return visiveis.map((a) => {
      const prova = provaDoConcurso(concursosPorId?.[a.concurso_id]?.codigo);
      const meus = simPorAluno.get(a.id) ?? [];
      if (!meus.length) return { aluno: a, prova, melhor: null };
      const melhor = [...meus].sort((x, y) => notaPct(prova, y.acertos) - notaPct(prova, x.acertos))[0];
      return {
        aluno: a, prova, melhor,
        nota: notaPct(prova, melhor.acertos),
        tot: totalAcertos(prova, melhor.acertos),
        max: totalQuestoes(prova),
        n: meus.length,
      };
    }).sort((x, y) => (y.nota ?? -1) - (x.nota ?? -1) || (y.tot ?? -1) - (x.tot ?? -1));
  }, [alunos, simulados, turmaId, concursosPorId]);

  const maxQ = Math.max(1, ...comparaveis.map((r) => r.q), ...semDadosSuficientes.map((r) => r.q));

  const seletor = (valor, setValor, opcoes) => (
    <div style={{ display: "flex", background: T.bg, borderRadius: 8, padding: 3, border: `1px solid ${T.line}` }}>
      {opcoes.map(([k, lb]) => (
        <button type="button" key={k} onClick={() => setValor(k)}
          style={{ border: "none", background: valor === k ? T.gold : "transparent", color: valor === k ? "#0A1622" : T.sub, fontWeight: 600, fontSize: 12, padding: "7px 11px", minHeight: 36, borderRadius: 6, whiteSpace: "nowrap" }}>
          {lb}
        </button>
      ))}
    </div>
  );

  return (
    <Card>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 10, marginBottom: 4 }}>
        <div>
          <h2 className="disp" style={{ margin: 0, fontSize: 15, fontWeight: 700 }}>Ranking — {modo === "estudos" ? "Estudos" : "Simulados"}</h2>
          <div style={{ fontSize: 12, color: T.sub, marginTop: 2 }}>
            {modo === "estudos"
              ? "Constância e volume: escolha o critério de ordenação. Visível só para a coordenação."
              : "Como a prova classificaria: melhor simulado de cada aluno, nota pela estrutura do concurso dele."}
          </div>
        </div>
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
          {seletor(modo, setModo, [["estudos", "📚 Estudos"], ["simulados", "🎯 Simulados"]])}
          {modo === "estudos" && seletor(criterio, setCriterio, Object.entries(CRITERIOS_ESTUDO).map(([k, c]) => [k, c.rotulo]))}
          {modo === "estudos" && seletor(janela, setJanela, [["semana", "7 dias"], ["geral", "Geral"]])}
          {turmas.length > 0 && (
            <select value={turmaId} onChange={(e) => setTurmaId(e.target.value)} aria-label="Filtrar por turma"
              style={{ background: T.bg, border: `1px solid ${T.line}`, color: T.ink, borderRadius: 8, padding: "8px 10px", fontSize: 13 }}>
              <option value="" style={{ background: T.bg2 }}>Todas as turmas</option>
              {turmas.map((t) => <option key={t.id} value={t.id} style={{ background: T.bg2 }}>{t.nome}</option>)}
            </select>
          )}
        </div>
      </div>

      {modo === "simulados" ? (
        rankingSim.length === 0 ? <Empty txt="Nenhum aluno nesta seleção." /> : (
          <div style={{ display: "flex", flexDirection: "column", gap: 2, marginTop: 12 }}>
            {rankingSim.map((r, i) => {
              const destaque = i < 3 && r.melhor != null;
              return (
                <div key={r.aluno.id} className="row" style={{
                  display: "flex", alignItems: "center", gap: 12, padding: "11px 10px", borderRadius: 10,
                  border: `1px solid ${destaque ? T.gold : "transparent"}`,
                  background: destaque ? T.cardHi : "transparent",
                  borderBottom: `1px solid ${T.line}`, flexWrap: "wrap",
                }}>
                  <div className="num disp" style={{ width: 36, textAlign: "center", fontSize: destaque ? 20 : 14, fontWeight: 800, color: destaque ? T.gold : T.sub, flexShrink: 0 }}>
                    {destaque ? MEDALHAS[i] : `${i + 1}º`}
                  </div>
                  <div style={{ flex: 1, minWidth: 150 }}>
                    <div style={{ fontSize: 14, fontWeight: 700 }}>{r.aluno.nome}</div>
                    <div style={{ fontSize: 11, color: T.sub, marginTop: 1 }}>
                      {r.prova.rotulo}{r.melhor ? <> · {r.melhor.nome} · {fmtBR(String(r.melhor.data))} · {r.n} {r.n === 1 ? "simulado" : "simulados"}</> : " · nenhum simulado ainda"}
                    </div>
                    <CredencialBadges aluno={r.aluno} />
                  </div>
                  {r.melhor && (
                    <div style={{ display: "flex", gap: 14, fontSize: 12, color: T.sub, flexShrink: 0, textAlign: "right" }}>
                      <span><b className="num" style={{ color: r.nota >= 70 ? T.green : r.nota >= 50 ? T.gold : T.red, fontSize: 16 }}>{r.nota}</b><br />nota /100</span>
                      <span><b className="num" style={{ color: T.ink, fontSize: 16 }}>{r.tot}/{r.max}</b><br />acertos</span>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )
      ) : comparaveis.length === 0 && semDadosSuficientes.length === 0 ? <Empty txt="Nenhum aluno nesta seleção." /> : (
        <div style={{ display: "flex", flexDirection: "column", gap: 2, marginTop: 12 }}>
          {comparaveis.map((r, i) => (
            <LinhaEstudo key={r.aluno.id} r={r} posicao={i} maxQ={maxQ} concursosPorId={concursosPorId} T={T} />
          ))}
          {comparaveis.length === 0 && (
            <div role="status" style={{ fontSize: 13, color: T.ink, fontWeight: 600, padding: "10px 10px 4px" }}>
              {semPodioNaJanela(janela)}
            </div>
          )}
          {semDadosSuficientes.length > 0 && (
            <>
              <div style={{ fontSize: 11, color: T.sub, fontWeight: 700, textTransform: "uppercase", letterSpacing: 0.6, margin: comparaveis.length ? "14px 2px 0" : "2px 2px 0" }}>
                Ainda sem dados suficientes
              </div>
              <div style={{ fontSize: 11.5, color: T.sub, margin: "0 2px 4px", lineHeight: 1.4 }}>
                Menos de {LIMIAR.VOLUME_MINIMO} questões na janela ativa — sem volume para comparar por {CRITERIOS_ESTUDO[criterio].rotulo.toLowerCase()}.
              </div>
              {semDadosSuficientes.map((r) => (
                <LinhaEstudo key={r.aluno.id} r={r} posicao={null} maxQ={maxQ} concursosPorId={concursosPorId} T={T} />
              ))}
            </>
          )}
        </div>
      )}
    </Card>
  );
}

// I11: mesma leitura de dado e mesmo componente que ListaAlunos.jsx já
// usa para o selo de credencial — replicado aqui (modos estudos e
// simulados) porque a coordenação também decide ações a partir daqui.
function CredencialBadges({ aluno }) {
  const temCred = !!aluno.usuario_id;
  const credRevogada = temCred && aluno.usuarios?.credencial_status === "revogada";
  const aguardaTroca = temCred && !credRevogada && aluno.usuarios?.must_change_password === true;
  if (!credRevogada && !aguardaTroca) return null;
  return (
    <div style={{ display: "flex", gap: 5, marginTop: 4, flexWrap: "wrap" }}>
      {credRevogada && <StatusBadge tom="risco">credencial revogada</StatusBadge>}
      {aguardaTroca && <StatusBadge tom="alerta">aguardando troca de senha</StatusBadge>}
    </div>
  );
}

// Linha do ranking de estudos — `posicao` null é o grupo "ainda sem
// dados suficientes" (T34/T35): sem medalha, sem Nº, só o nome e os
// números crus (não inventa posição pra quem não tem volume pra ser
// comparado).
function LinhaEstudo({ r, posicao, maxQ, concursosPorId, T }) {
  const concurso = concursosPorId?.[r.aluno.concurso_id];
  const destaque = posicao != null && posicao < 3 && r.q > 0;
  return (
    <div className="row" style={{
      display: "flex", alignItems: "center", gap: 12, padding: "11px 10px", borderRadius: 10,
      border: `1px solid ${destaque ? T.gold : "transparent"}`,
      background: destaque ? T.cardHi : "transparent",
      borderBottom: `1px solid ${T.line}`, flexWrap: "wrap",
    }}>
      <div className="num disp" style={{ width: 36, textAlign: "center", fontSize: destaque ? 20 : 14, fontWeight: 800, color: destaque ? T.gold : T.sub, flexShrink: 0 }}>
        {posicao == null ? "" : destaque ? MEDALHAS[posicao] : `${posicao + 1}º`}
      </div>
      <div style={{ flex: 1, minWidth: 150 }}>
        <div style={{ fontSize: 14, fontWeight: 700 }}>{r.aluno.nome}</div>
        <div style={{ fontSize: 11, color: T.sub, marginTop: 1 }}>
          {concurso ? concurso.nome.split(" (")[0] : "sem concurso"}
          {r.metaPct !== null && <> · meta da semana: <b style={{ color: r.metaPct >= 80 ? T.green : r.metaPct >= 40 ? T.gold : T.red }}>{r.feitas}/{r.consideradas} ({r.metaPct}%)</b></>}
        </div>
        <CredencialBadges aluno={r.aluno} />
        <div style={{ height: 5, background: T.bg, borderRadius: 3, overflow: "hidden", marginTop: 6, maxWidth: 360 }}>
          <div style={{ width: `${(r.q / maxQ) * 100}%`, height: "100%", background: `linear-gradient(90deg,${T.gold},${T.green})` }} />
        </div>
      </div>
      <div style={{ display: "flex", gap: 14, fontSize: 12, color: T.sub, flexShrink: 0, textAlign: "right" }}>
        <span><b className="num" style={{ color: T.ink, fontSize: 15 }}>{r.q}</b><br />questões</span>
        <span><b className="num" style={{ color: corDeAcerto(T, r.acc), fontSize: 15 }}>{r.acc == null ? "—" : `${r.acc}%`}</b><br />acerto</span>
        <span><b className="num" style={{ color: T.ink, fontSize: 15 }}>{fmtH(r.minutos)}</b><br />tempo</span>
        <span><b className="num" style={{ color: T.ink, fontSize: 15 }}>{r.dias}</b><br />dias</span>
      </div>
    </div>
  );
}
