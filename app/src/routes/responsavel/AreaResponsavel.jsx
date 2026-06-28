/* Área do responsável: experiência própria, simples e objetiva.
   Sem abas, sem jargão de jogo, sem controles. Só leitura do aluno
   vinculado, com linguagem clara. Todo acesso fica no log (LGPD). */
import React, { useEffect, useMemo, useState } from "react";
import { Cabecalho } from "../../shared/ui/Cabecalho.jsx";
import { Empty, Erro, ErroComRetry, CarregandoBloco } from "../../shared/ui/componentes.jsx";
import { ResumoResponsavel } from "../../modules/desempenho/ResumoResponsavel.jsx";
import { useTrilha } from "../../modules/conteudo/useTrilha.js";
import { calcularMetricas } from "../../modules/desempenho/metricas.js";
import { diasParaProva } from "../../modules/conteudo/concursos.js";
import { semanaAtual, fmtBR } from "../../shared/regras/regras.js";
import { mensagemAmigavel } from "../../shared/lib/erros.js";
import * as db from "../../shared/data/index.js";

export default function AreaResponsavel({ perfil }) {
  const [aluno, setAluno] = useState(undefined);
  const [erro, setErro] = useState(null);
  const [dados, setDados] = useState({ metas: [], registros: [], simulados: [] });
  const [concurso, setConcurso] = useState(null);
  const [prova, setProva] = useState(null);
  const [versao, setVersao] = useState(0);
  const { trilha, recarregar: recarregarTrilha } = useTrilha(aluno?.trilha_id);
  const recarregar = () => { setErro(null); setAluno(undefined); setVersao((v) => v + 1); recarregarTrilha(); };

  useEffect(() => window.scrollTo({ top: 0, left: 0, behavior: "instant" }), []); // login nasce no topo

  useEffect(() => {
    let vivo = true;
    (async () => {
      try {
        const a = await db.alunoVinculado();
        if (!vivo) return;
        setAluno(a);
        if (!a) return;
        db.registrarAcesso(perfil.escola.id, a.id, perfil.usuario.id, "responsavel", "leitura-desempenho");

        const [metas, registros, simulados] = await Promise.all([
          db.listarMetas(a.id), db.listarRegistros(a.id), db.listarSimulados(a.id),
        ]);
        if (!vivo) return;
        setDados({ metas, registros, simulados });

        let semanasTrilha = null;
        if (a.trilha_id) semanasTrilha = (await db.carregarTrilha(a.trilha_id)).semanas;
        let c = null;
        if (a.concurso_id) {
          const concursos = await db.listarConcursos();
          c = concursos.find((x) => x.id === a.concurso_id) ?? null;
        }
        if (!vivo) return;
        setConcurso(c);
        setProva(diasParaProva({ semanasTrilha, concurso: c }));
      } catch (e) { if (vivo) setErro(mensagemAmigavel(e, "carregar")); }
    })();
    return () => { vivo = false; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [versao]);

  const semanasRegras = useMemo(
    () => (trilha ? trilha.semanas.map((s) => ({ ...s, inicio: String(s.inicio), fim: String(s.fim) })) : []),
    [trilha],
  );
  const semanaAtiva = semanasRegras.length ? semanaAtual(semanasRegras) : null;
  const meta = dados.metas.find((x) => x.status === "ativa") ?? dados.metas[0] ?? null;

  const m = useMemo(() => {
    if (!trilha || !semanaAtiva) return null;
    return calcularMetricas({
      registros: dados.registros, simulados: dados.simulados,
      semanas: semanasRegras, semanaAtiva, disciplinas: trilha.disciplinas,
      metaQuestoes: semanaAtiva.meta_questoes ?? 250,
    });
  }, [dados, trilha, semanaAtiva]);

  const subtitulo = [
    aluno ? aluno.nome : "Acompanhamento",
    concurso ? concurso.nome.split(" (")[0] : null,
    prova ? `prova ${prova.media ? "≈" : "em"} ${fmtBR(prova.dataIso)}` : null,
  ].filter(Boolean).join(" · ");

  return (
    <div>
      <Cabecalho subtitulo={subtitulo} diasProva={prova?.dias ?? null} diasProvaMedia={prova?.media}
        nomeUsuario={perfil.usuario.nome} rotuloPapel="Responsável" />
      <main style={{ maxWidth: 760, margin: "0 auto", padding: "18px max(16px, env(safe-area-inset-right)) calc(88px + env(safe-area-inset-bottom)) max(16px, env(safe-area-inset-left))" }}>
        {erro && <ErroComRetry aoTentar={recarregar}>{erro}</ErroComRetry>}
        {aluno === undefined && !erro && <CarregandoBloco titulo="Carregando os dados do aluno…" cartoes={2} linhas={3} />}
        {aluno === null && <Empty txt="Nenhum aluno vinculado a este acesso. Fale com a escola." />}
        {aluno && m && trilha && (
          <ResumoResponsavel aluno={aluno} m={m} meta={meta} trilha={trilha}
            simulados={dados.simulados} semanaAtiva={semanaAtiva} concurso={concurso} />
        )}
        {aluno && (!m || !trilha) && <CarregandoBloco titulo="Carregando os dados do aluno…" cartoes={2} linhas={3} />}
      </main>
    </div>
  );
}
