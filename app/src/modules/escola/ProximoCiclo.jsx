/* ============================================================
   ABRIR O PRÓXIMO CICLO (a tela que faltava)
   ------------------------------------------------------------
   A Onda 3 fez o app dizer a verdade sobre o fim do ciclo: quando a
   última semana da trilha passa, o aluno entra em `encerrado` e a tela
   do responsável diz que "a coordenação abre o próximo ciclo quando
   ele estiver pronto". A migration 0051 criou o motor que abre. Esta é
   a porta: sem ela, a promessa da tela do responsável apontava para
   uma ação que não existia em lugar nenhum do produto.

   O que a coordenação faz aqui, por trilha com alunos encerrados:
     1. confere quem terminou o ciclo;
     2. escolhe a data da próxima prova (vem preenchida com a mais
        próxima entre os alunos do grupo — e dá para trocar, porque
        quem sabe a data publicada do ano é a escola);
     3. marca quem entra na edição nova (por padrão, ninguém está
        marcado — ver abaixo);
     4. confirma.

   POR QUE NINGUÉM VEM MARCADO

   No fim de um ciclo a turma se divide: quem passou sai, quem não
   passou repete, quem desistiu some. Vir tudo marcado transforma
   "seguinte, seguinte" em turma inteira renovada — e aluno renovado
   em silêncio vira aluno ATIVO nos painéis, que é exatamente o sinal
   de "sem atividade" que as Ondas 5 e 7 consertaram. A marcação é um
   ato, não um padrão.

   O HISTÓRICO NÃO VEM JUNTO, E ISSO É O CERTO: metas são unique por
   (aluno, trilha, semana), então as metas antigas ficam presas à
   edição anterior, intactas. Registros, simulados e XP são presos ao
   ALUNO, nunca à trilha — total, acerto, streak e patente seguem
   inteiros. Zera o ciclo, não a vida do aluno. O texto na tela diz
   isso ao usuário, porque "abrir o próximo ciclo" soa como algo que
   apaga, e ninguém deveria precisar confiar sem ler.
   ============================================================ */
import { useMemo, useState } from "react";
import { SectionCard, EmptyState, Erro, StatusBadge, useDialogo } from "../../shared/ui/componentes.jsx";
import { useTema } from "../../shared/branding/BrandingContext.jsx";
import { useEnvioUnico } from "../../shared/hooks/useEnvioUnico.js";
import { fmtBR } from "../../shared/regras/regras.js";
import { gruposParaRenovar, validarAncora } from "./proximoCiclo.js";
import * as db from "../../shared/data/index.js";

function GrupoTrilha({ grupo, aoMudar }) {
  const T = useTema();
  const dialogo = useDialogo();
  const [ancora, setAncora] = useState(grupo.ancoraSugerida ?? "");
  const [marcados, setMarcados] = useState(() => new Set());
  // o hook já traduz a exceção e expõe `erro` — não existe try/catch
  // local aqui de propósito: capturar por fora faria o erro do RPC
  // nunca chegar ao caminho de erro do próprio hook.
  const { ocupado, erro, enviar } = useEnvioUnico("abrir o próximo ciclo");

  const problemaAncora = validarAncora(ancora, grupo.fimAtual);
  const nenhumMarcado = marcados.size === 0;

  function alternar(id) {
    setMarcados((p) => {
      const n = new Set(p);
      if (n.has(id)) n.delete(id); else n.add(id);
      return n;
    });
  }
  const todosMarcados = marcados.size === grupo.alunos.length && grupo.alunos.length > 0;
  function alternarTodos() {
    setMarcados(todosMarcados ? new Set() : new Set(grupo.alunos.map((l) => l.aluno.id)));
  }

  async function abrir() {
    if (problemaAncora || nenhumMarcado) return;
    const ok = await dialogo.confirmar({
      titulo: "Abrir o próximo ciclo",
      mensagem:
        `${marcados.size} aluno(s) vão para uma edição nova de "${grupo.trilha?.nome ?? "trilha"}", ` +
        `com o plano terminando em ${fmtBR(String(ancora))}. ` +
        "As metas do ciclo anterior ficam guardadas na edição antiga; registros, simulados, XP e patente " +
        "seguem com o aluno. Quem não for marcado continua onde está.",
      rotuloConfirmar: "Abrir ciclo",
      rotuloCancelar: "Cancelar",
    });
    if (!ok) return;
    await enviar(async () => {
      await db.abrirProximoCiclo({
        trilhaId: grupo.trilhaId,
        ancora,
        alunoIds: [...marcados],
      });
      setMarcados(new Set());
      aoMudar?.();
    });
  }

  const idBase = `ciclo-${grupo.trilhaId}`;

  return (
    <SectionCard
      titulo={grupo.trilha?.nome ?? "Trilha sem nome"}
      sub={`${grupo.alunos.length} aluno${grupo.alunos.length > 1 ? "s" : ""} com o ciclo encerrado${grupo.fimAtual ? ` · plano terminou em ${fmtBR(String(grupo.fimAtual))}` : ""}`}
    >
      {dialogo.elemento}
      <div style={{ padding: "14px 16px", display: "flex", flexDirection: "column", gap: 14 }}>

        {grupo.concursosDivergentes && (
          <div style={{ background: `${T.gold}10`, border: `1px solid ${T.gold}55`, borderRadius: 10, padding: "10px 12px", fontSize: 12.5, lineHeight: 1.5 }}>
            <b style={{ color: T.gold }}>Provas diferentes na mesma trilha.</b>{" "}
            {grupo.concursos.map((c) => `${c.concurso?.codigo?.toUpperCase() ?? "?"} (${c.alunos})`).join(" · ")}.
            {" "}A data sugerida é a prova mais próxima; um plano só não serve aos dois calendários com folga igual.
          </div>
        )}

        <div>
          <label htmlFor={`${idBase}-ancora`} style={{ display: "block" }}>
            <span style={{ fontSize: 11, color: T.sub, marginBottom: 4, display: "block" }}>
              Data da próxima prova (fim da nova edição)
            </span>
          <input
            id={`${idBase}-ancora`}
            type="date"
            aria-label="Data da próxima prova (fim da nova edição)"
            value={ancora}
            onChange={(e) => setAncora(e.target.value)}
            style={{ background: T.bg, border: `1px solid ${problemaAncora && ancora ? T.red : T.line}`, color: T.ink, borderRadius: 8, padding: "12px", fontSize: 16, minHeight: 46, maxWidth: 220, width: "100%" }}
            aria-invalid={problemaAncora && ancora ? true : undefined}
            aria-describedby={`${idBase}-ancora-dica`}
          />
          </label>
          <div id={`${idBase}-ancora-dica`} style={{ fontSize: 11.5, color: problemaAncora && ancora ? T.red : T.sub, marginTop: 5, lineHeight: 1.5 }}>
            {problemaAncora && ancora
              ? problemaAncora
              : "As semanas do plano andam todas juntas, preservando a forma do ciclo: a última termina nesta data."}
          </div>
        </div>

        <div>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10, marginBottom: 6, flexWrap: "wrap" }}>
            <div style={{ fontSize: 11, color: T.sub, fontWeight: 700, textTransform: "uppercase", letterSpacing: 0.4 }}>
              Quem entra na edição nova
            </div>
            <button type="button" onClick={alternarTodos}
              style={{ background: "transparent", border: `1px solid ${T.line}`, color: T.sub, borderRadius: 8, padding: "7px 12px", fontSize: 12, fontWeight: 600, minHeight: 36 }}>
              {todosMarcados ? "Desmarcar todos" : "Marcar todos"}
            </button>
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
            {grupo.alunos.map((l) => (
              <label key={l.aluno.id} htmlFor={`${idBase}-${l.aluno.id}`}
                style={{ display: "flex", alignItems: "center", gap: 10, padding: "9px 8px", borderRadius: 8, borderBottom: `1px solid ${T.line}`, cursor: "pointer", minHeight: 44 }}>
                <input id={`${idBase}-${l.aluno.id}`} type="checkbox"
                  checked={marcados.has(l.aluno.id)} onChange={() => alternar(l.aluno.id)}
                  aria-label={`Incluir ${l.aluno.nome} no próximo ciclo`}
                  style={{ width: 18, height: 18, flexShrink: 0 }} />
                <span style={{ flex: 1, minWidth: 0, fontSize: 13.5, fontWeight: 600, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                  {l.aluno.nome}
                </span>
                {l.semCredencial && <StatusBadge tom="alerta">sem credencial</StatusBadge>}
              </label>
            ))}
          </div>
        </div>

        <div style={{ fontSize: 11.5, color: T.sub, lineHeight: 1.55 }}>
          O que o aluno leva: registros, simulados, XP, patente e conquistas — tudo preso a ele, não à trilha.
          O que fica para trás: as metas do ciclo anterior, guardadas na edição antiga.
        </div>

        <button type="button" onClick={abrir} disabled={!!problemaAncora || nenhumMarcado || ocupado}
          style={{
            background: problemaAncora || nenhumMarcado || ocupado ? T.line : T.gold,
            color: problemaAncora || nenhumMarcado || ocupado ? T.sub : "#0A1622",
            border: "none", borderRadius: 8, padding: "13px 20px", minHeight: 48, fontWeight: 700, fontSize: 15, width: "100%",
          }}>
          {ocupado ? "Abrindo…" : nenhumMarcado ? "Marque quem entra no próximo ciclo" : `Abrir ciclo para ${marcados.size} aluno${marcados.size > 1 ? "s" : ""}`}
        </button>
        <Erro>{erro}</Erro>
      </div>
    </SectionCard>
  );
}

export function ProximoCiclo({ resumo, trilhasPorId, concursosPorId, aoMudar }) {
  const grupos = useMemo(
    () => gruposParaRenovar({ resumo, trilhasPorId, concursosPorId }),
    [resumo, trilhasPorId, concursosPorId],
  );

  if (grupos.length === 0) {
    return (
      <SectionCard titulo="Próximo ciclo">
        <EmptyState
          icone="↻"
          titulo="Nenhuma turma chegou ao fim do plano"
          dica="Quando a última semana de uma trilha passar, os alunos dela aparecem aqui para a coordenação abrir a próxima edição."
        />
      </SectionCard>
    );
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
      {grupos.map((g) => (
        <GrupoTrilha key={g.trilhaId} grupo={g} aoMudar={aoMudar} />
      ))}
    </div>
  );
}
