/* Área do aluno: a própria meta e o próprio progresso. O banco só
   entrega o que é dele — esta tela nem precisa filtrar.
   A contagem para a prova usa a data REAL da trilha quando existe;
   sem trilha, usa a data MÉDIA do concurso escolhido pela escola. */
import React, { useEffect, useMemo, useState } from "react";
import { Cabecalho } from "../../shared/ui/Cabecalho.jsx";
import { Empty, Erro } from "../../shared/ui/componentes.jsx";
import { VisaoEstudo } from "./VisaoEstudo.jsx";
import { useTrilha } from "../../modules/conteudo/useTrilha.js";
import { AvisoMaturidade } from "../../modules/conteudo/SeloMaturidade.jsx";
import { Onboarding } from "../../modules/motor/Onboarding.jsx";
import { diasParaProva } from "../../modules/conteudo/concursos.js";
import { fmtBR } from "../../shared/regras/regras.js";
import { mensagemAmigavel } from "../../shared/lib/erros.js";
import * as db from "../../shared/data/index.js";

export default function AreaAluno({ perfil }) {
  const [aluno, setAluno] = useState(undefined);
  const [erro, setErro] = useState(null);
  const [concurso, setConcurso] = useState(null);
  const [onboarding, setOnboarding] = useState(undefined); // undefined = carregando
  const [materiasProva, setMateriasProva] = useState([]);

  // PERF: a trilha é carregada UMA vez, aqui, e desce por prop para
  // VisaoEstudo. Antes esta tela chamava `db.carregarTrilha` só para pegar
  // `semanas` (a contagem para a prova) e, logo em seguida, VisaoEstudo
  // montava e o `useTrilha` dela buscava a MESMA trilha de novo — 4 queries
  // repetidas por entrada de aluno, a mais pesada sendo `atividades_modelo`
  // (159 linhas em produção).
  const trilhaEstado = useTrilha(aluno?.trilha_id);
  const { trilha } = trilhaEstado;

  // Data da prova: a da trilha quando existe; senão a data média do concurso.
  // Vira memo porque agora depende de dois carregamentos independentes.
  const prova = useMemo(
    () => diasParaProva({ semanasTrilha: trilha?.semanas ?? null, concurso }),
    [trilha, concurso],
  );

  useEffect(() => window.scrollTo({ top: 0, left: 0, behavior: "instant" }), []); // login nasce no topo

  useEffect(() => {
    let vivo = true;
    (async () => {
      try {
        const a = await db.meuAluno();
        if (!vivo) return;
        setAluno(a);
        if (!a) return;

        // Concurso e onboarding não dependem um do outro: vão juntos, em vez
        // de um esperar o outro (cada ida e volta custa ~165 ms em produção).
        // O onboarding é complementar — se falhar, a tela de estudo continua.
        const [c, ob] = await Promise.all([
          db.concursoPorId(a.concurso_id),
          db.carregarOnboarding(a.id).catch(() => null),
        ]);
        if (!vivo) return;
        setConcurso(c);
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
            {concurso && <AvisoMaturidade codigo={concurso.codigo} style={{ marginBottom: 14 }} />}
            <VisaoEstudo aluno={aluno} podeEditar concurso={concurso}
              trilhaEstado={trilhaEstado}
              contexto={concurso ? concurso.nome.split(" (")[0] : "Plano de estudos"} />
          </>
        )}
      </main>
    </div>
  );
}
