/* Área do aluno: a própria meta e o próprio progresso. O banco só
   entrega o que é dele — esta tela nem precisa filtrar.
   A contagem para a prova usa a data REAL da trilha quando existe;
   sem trilha, usa a data MÉDIA do concurso escolhido pela escola. */
import React, { useEffect, useState } from "react";
import { Cabecalho } from "../../shared/ui/Cabecalho.jsx";
import { Empty, Erro } from "../../shared/ui/componentes.jsx";
import { VisaoEstudo } from "./VisaoEstudo.jsx";
import { Onboarding } from "../../modules/motor/Onboarding.jsx";
import { diasParaProva } from "../../modules/conteudo/concursos.js";
import { fmtBR } from "../../shared/regras/regras.js";
import { mensagemAmigavel } from "../../shared/lib/erros.js";
import * as db from "../../shared/data/index.js";

export default function AreaAluno({ perfil }) {
  const [aluno, setAluno] = useState(undefined);
  const [erro, setErro] = useState(null);
  const [prova, setProva] = useState(null);
  const [concurso, setConcurso] = useState(null);
  const [onboarding, setOnboarding] = useState(undefined); // undefined = carregando
  const [materiasProva, setMateriasProva] = useState([]);

  useEffect(() => window.scrollTo({ top: 0, left: 0, behavior: "instant" }), []); // login nasce no topo

  useEffect(() => {
    let vivo = true;
    (async () => {
      try {
        const a = await db.meuAluno();
        if (!vivo) return;
        setAluno(a);
        if (!a) return;

        let semanasTrilha = null;
        if (a.trilha_id) {
          const { semanas } = await db.carregarTrilha(a.trilha_id);
          semanasTrilha = semanas;
        }
        let c = null;
        if (a.concurso_id) {
          const concursos = await db.listarConcursos();
          c = concursos.find((x) => x.id === a.concurso_id) ?? null;
        }
        if (!vivo) return;
        setConcurso(c);
        setProva(diasParaProva({ semanasTrilha, concurso: c }));

        // onboarding pedagógico (diagnóstico inicial) — só o do próprio aluno
        let ob = null;
        try {
          ob = await db.carregarOnboarding(a.id);
        } catch { ob = null; }
        if (!vivo) return;
        setOnboarding(ob);
        // matérias da prova só quando o onboarding AINDA não foi concluído
        // (alimenta o formulário). Evita query extra no caso comum. Best-effort.
        if (!ob?.concluido_em && c?.codigo) {
          try {
            const est = await db.carregarEstruturaProva(c.codigo);
            if (vivo) setMateriasProva(est.materias ?? []);
          } catch { /* sem estrutura: o onboarding ainda funciona */ }
        }
      } catch (e) {
        if (vivo) setErro(mensagemAmigavel(e, "carregar"));
      }
    })();
    return () => { vivo = false; };
  }, []);

  const subtitulo = [
    "Área do aluno",
    concurso ? concurso.nome.split(" (")[0] : null,
    prova ? `prova ${prova.media ? "≈" : "em"} ${fmtBR(prova.dataIso)}${prova.media ? " (data média)" : ""}` : null,
  ].filter(Boolean).join(" · ");

  return (
    <div>
      <Cabecalho subtitulo={subtitulo} diasProva={prova?.dias ?? null} nomeUsuario={perfil.usuario.nome} />
      <main className="com-sidebar" style={{ maxWidth: 1080, margin: "0 auto", padding: "18px max(16px, env(safe-area-inset-right)) calc(88px + env(safe-area-inset-bottom)) max(16px, env(safe-area-inset-left))" }}>
        {erro && <Erro>{erro}</Erro>}
        {aluno === undefined && !erro && <Empty txt="Preparando painel de estudos…" />}
        {aluno === null && <Empty txt="Sua conta não está ligada a um aluno. Fale com a coordenação." />}
        {aluno && (
          <>
            {/* Onboarding NÃO bloqueia o estudo: aparece como diagnóstico
                inicial acima do painel enquanto não foi concluído. Some ao
                concluir. Assim a tela "Hoje" está sempre disponível. */}
            {onboarding !== undefined && !onboarding?.concluido_em && (
              <div style={{ marginBottom: 16 }}>
                <Onboarding aluno={aluno} materias={materiasProva}
                  aoConcluir={() => setOnboarding({ concluido_em: new Date().toISOString() })} />
              </div>
            )}
            <VisaoEstudo aluno={aluno} podeEditar concurso={concurso}
              contexto={concurso ? concurso.nome.split(" (")[0] : "Plano de estudos"} />
          </>
        )}
      </main>
    </div>
  );
}
