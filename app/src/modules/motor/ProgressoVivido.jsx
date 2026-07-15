/* ============================================================
   PROGRESSO VIVIDO (PED1) — feedback e leitura do que o MOTOR
   concedeu de verdade no banco. Nada aqui calcula XP: só LÊ o que
   foi persistido (ledger de XP, missões fechadas, conquistas) e dá
   ao aluno o retorno no momento da ação.
   ============================================================ */
import React from "react";
import { SectionCard, StatusBadge, BarraXP } from "../../shared/ui/componentes.jsx";
import { useTema } from "../../shared/branding/BrandingContext.jsx";

/* Toast de retorno imediato: aparece quando uma recarga revela que o
   banco concedeu algo (XP, missão fechada, conquista). É honesto — só
   celebra o que o motor de fato gravou. Some sozinho. */
export function FeedbackProgresso({ feedback, aoFechar }) {
  const T = useTema();
  if (!feedback) return null;
  const partes = [];
  if (feedback.xp > 0) partes.push(`+${feedback.xp} XP`);
  if (feedback.missoes > 0) partes.push(`${feedback.missoes} ${feedback.missoes === 1 ? "missão concluída" : "missões concluídas"}`);
  if (feedback.conquistas > 0) partes.push(`${feedback.conquistas} ${feedback.conquistas === 1 ? "conquista desbloqueada" : "conquistas desbloqueadas"}`);
  if (!partes.length) return null;

  return (
    <div
      role="status"
      aria-live="polite"
      onClick={aoFechar}
      style={{
        position: "fixed", left: "50%", transform: "translateX(-50%)",
        top: "max(14px, env(safe-area-inset-top))", zIndex: 60, cursor: "pointer",
        background: `linear-gradient(135deg, ${T.gold}, ${T.gold}cc)`, color: "#0A1622",
        border: `1px solid ${T.gold}`, borderRadius: 12, padding: "12px 18px",
        boxShadow: "0 10px 30px rgba(0,0,0,.35)", fontWeight: 800, fontSize: 14.5,
        display: "flex", alignItems: "center", gap: 10, maxWidth: "92vw",
      }}
      className="fade"
    >
      <span style={{ fontSize: 18 }}>★</span>
      <span>{partes.join(" · ")}</span>
    </div>
  );
}

const ROTULO_MATERIA = { mat: "Matemática", por: "Português", ing: "Inglês", fis: "Física", qui: "Química", bio: "Biologia", his: "História", geo: "Geografia", red: "Redação", soc: "Estudos Sociais" };

/* Lista das missões do aluno COMO O BANCO as vê: fechadas com check,
   em andamento com a barra de volume/acurácia. Substitui a leitura de
   "missão é só texto" — agora a missão fecha sozinha e isso aparece.

   EST1-A5: mostra o critério REAL que o motor aplica (meta_questoes +
   meta_acuracia), não o texto aspiracional (achado PEDAGOGIA-04); e
   marca honestamente as missões cuja matéria o aluno não pode registrar
   na própria trilha — em vez de deixá-las travadas em 0% para sempre
   (achado PEDAGOGIA-05, ex.: missão de Biologia numa trilha CN sem
   disciplina de Biologia). `disciplinas` = as disciplinas registráveis
   da trilha do aluno (mesma lista do seletor do Registrar). */
export function MissoesPersistidas({ missoes = [], disciplinas = [] }) {
  const T = useTema();
  if (!missoes.length) return null;
  const registraveis = new Set((disciplinas ?? []).map((d) => d.codigo));
  const podeRegistrar = (cod) => registraveis.size === 0 || !cod || registraveis.has(cod);
  const ordem = { concluida: 0, em_andamento: 1 };
  const lista = [...missoes].sort((a, b) => (ordem[a.estado] ?? 9) - (ordem[b.estado] ?? 9));
  const fechadas = missoes.filter((m) => m.estado === "concluida").length;

  return (
    <SectionCard titulo="Missões" sub={`${fechadas} de ${missoes.length} concluída${fechadas === 1 ? "" : "s"} — fecham sozinhas quando você bate o critério.`}>
      <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
        {lista.map((mi) => {
          const nome = mi.missoes?.nome ?? "Missão";
          const codMateria = mi.missoes?.materia_codigo;
          const materia = ROTULO_MATERIA[codMateria] ?? codMateria ?? "";
          const fechada = mi.estado === "concluida";
          const pct = mi.acuracia ?? 0;
          // critério REAL do motor (mesmo que fecha a missão): volume + acerto.
          const metaQ = mi.missoes?.meta_questoes ?? null;
          const metaAcc = mi.missoes?.meta_acuracia ?? null;
          const alvo = metaQ != null
            ? `alvo: ${metaQ} questões${metaAcc != null ? ` e ≥${metaAcc}% de acerto` : ""}`
            : "acompanhamento da coordenação (sem fechamento automático)";
          // não fecha sozinha se a matéria não é registrável na trilha do aluno.
          const inalcancavel = !fechada && metaQ != null && !podeRegistrar(codMateria);
          return (
            <div key={mi.id} style={{ background: T.card, border: `1px solid ${fechada ? T.green : T.line}`, borderRadius: 10, padding: "11px 13px" }}>
              <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
                <span style={{ fontWeight: 700, fontSize: 13.5 }}>{nome}</span>
                {materia && <span style={{ fontSize: 11, color: T.sub }}>· {materia}</span>}
                <span style={{ marginLeft: "auto" }}>
                  <StatusBadge tom={fechada ? "ok" : inalcancavel ? "neutro" : "alerta"}>
                    {fechada ? "✓ Concluída" : inalcancavel ? "Com a coordenação" : "Em andamento"}
                  </StatusBadge>
                </span>
              </div>
              {fechada ? (
                <div style={{ fontSize: 11.5, color: T.green, marginTop: 6, fontWeight: 600 }}>
                  +{mi.xp_concedido} XP concedidos · {mi.questoes_acumuladas} questões{mi.acuracia != null ? ` · ${mi.acuracia}% de acerto` : ""}
                </div>
              ) : inalcancavel ? (
                <div style={{ fontSize: 11.5, color: T.sub, marginTop: 6, lineHeight: 1.5 }}>
                  {materia} não está entre as matérias que você registra nesta trilha — esta missão é
                  acompanhada com a coordenação, não fecha sozinha pelo seu registro de estudo.
                </div>
              ) : (
                <div style={{ marginTop: 8 }}>
                  <BarraXP pct={Math.min(100, pct)} alt={5} brilho={false} />
                  <div style={{ fontSize: 11, color: T.sub, marginTop: 4 }}>
                    {mi.questoes_acumuladas}{metaQ != null ? `/${metaQ}` : ""} questões{mi.acuracia != null ? ` · ${mi.acuracia}% de acerto` : " · registre acertos para medir o domínio"} · {alvo}
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </SectionCard>
  );
}
