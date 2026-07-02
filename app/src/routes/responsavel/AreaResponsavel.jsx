/* Área do responsável: experiência própria, simples e objetiva.
   Sem abas, sem jargão de jogo, sem controles. Só leitura do(s)
   aluno(s) vinculado(s), com linguagem clara. Todo acesso fica no
   log (LGPD) — um registro POR ALUNO consultado.
   FIX1 (OBS-RC1-004): responsável com 2+ filhos escolhe qual
   acompanhar; antes o `.limit(1)` mostrava um aluno indeterminado. */
import React, { useEffect, useMemo, useState } from "react";
import { Cabecalho } from "../../shared/ui/Cabecalho.jsx";
import { Empty, ErroComRetry, CarregandoBloco } from "../../shared/ui/componentes.jsx";
import { ResumoResponsavel } from "../../modules/desempenho/ResumoResponsavel.jsx";
import { useTrilha } from "../../modules/conteudo/useTrilha.js";
import { calcularMetricas } from "../../modules/desempenho/metricas.js";
import { diasParaProva } from "../../modules/conteudo/concursos.js";
import { semanaAtual, fmtBR } from "../../shared/regras/regras.js";
import { mensagemAmigavel } from "../../shared/lib/erros.js";
import { useTema } from "../../shared/branding/BrandingContext.jsx";
import * as db from "../../shared/data/index.js";

export default function AreaResponsavel({ perfil }) {
  const T = useTema();
  const [alunos, setAlunos] = useState(undefined); // undefined = carregando; [] = nenhum vínculo
  const [alunoId, setAlunoId] = useState(null);
  const [erro, setErro] = useState(null);
  const [dados, setDados] = useState(null); // null = ainda não carregou o aluno selecionado
  const [concurso, setConcurso] = useState(null);
  const [prova, setProva] = useState(null);
  const [versao, setVersao] = useState(0);

  // Aluno em foco: o escolhido no seletor, ou o primeiro da lista
  // (ordenada por nome no seam — determinística, sem "aluno sorteado").
  const aluno = useMemo(() => {
    if (alunos === undefined) return undefined;
    if (!alunos.length) return null;
    return alunos.find((a) => a.id === alunoId) ?? alunos[0];
  }, [alunos, alunoId]);

  const { trilha, recarregar: recarregarTrilha } = useTrilha(aluno?.trilha_id);
  const recarregar = () => {
    setErro(null); setAlunos(undefined); setDados(null);
    setVersao((v) => v + 1); recarregarTrilha();
  };

  useEffect(() => window.scrollTo({ top: 0, left: 0, behavior: "instant" }), []); // login nasce no topo

  // 1) Quem são os alunos vinculados (todos — a RLS decide).
  useEffect(() => {
    let vivo = true;
    (async () => {
      try {
        const lista = await db.alunosVinculados();
        if (vivo) setAlunos(lista);
      } catch (e) { if (vivo) setErro(mensagemAmigavel(e, "carregar")); }
    })();
    return () => { vivo = false; };
  }, [versao]);

  // 2) Dados do aluno EM FOCO. Roda de novo a cada troca no seletor;
  //    o log LGPD registra a leitura do aluno efetivamente consultado.
  useEffect(() => {
    if (!aluno) return;
    let vivo = true;
    setErro(null); // falha do irmão anterior não polui a troca
    setDados(null); // não mostrar métricas do irmão anterior durante a troca
    setConcurso(null);
    setProva(null);
    (async () => {
      try {
        db.registrarAcesso(perfil.escola.id, aluno.id, perfil.usuario.id, "responsavel", "leitura-desempenho");

        const [metas, registros, simulados] = await Promise.all([
          db.listarMetas(aluno.id), db.listarRegistros(aluno.id), db.listarSimulados(aluno.id),
        ]);
        if (!vivo) return;
        setDados({ metas, registros, simulados });

        let semanasTrilha = null;
        if (aluno.trilha_id) semanasTrilha = (await db.carregarTrilha(aluno.trilha_id)).semanas;
        let c = null;
        if (aluno.concurso_id) {
          const concursos = await db.listarConcursos();
          c = concursos.find((x) => x.id === aluno.concurso_id) ?? null;
        }
        if (!vivo) return;
        setConcurso(c);
        setProva(diasParaProva({ semanasTrilha, concurso: c }));
      } catch (e) { if (vivo) setErro(mensagemAmigavel(e, "carregar")); }
    })();
    return () => { vivo = false; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [aluno?.id, versao]);

  const semanasRegras = useMemo(
    () => (trilha ? trilha.semanas.map((s) => ({ ...s, inicio: String(s.inicio), fim: String(s.fim) })) : []),
    [trilha],
  );
  const semanaAtiva = semanasRegras.length ? semanaAtual(semanasRegras) : null;
  const meta = dados?.metas.find((x) => x.status === "ativa") ?? dados?.metas[0] ?? null;

  const m = useMemo(() => {
    if (!dados || !trilha || !semanaAtiva) return null;
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

        {/* Seletor de aluno — só aparece quando há mais de um vínculo. */}
        {Array.isArray(alunos) && alunos.length > 1 && (
          <div role="group" aria-label="Escolher qual aluno acompanhar"
            style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 16 }}>
            {alunos.map((a) => {
              const ativo = aluno?.id === a.id;
              return (
                <button key={a.id} type="button" aria-pressed={ativo}
                  onClick={() => setAlunoId(a.id)}
                  style={{
                    padding: "9px 16px", borderRadius: 999, cursor: "pointer",
                    fontWeight: 700, fontSize: 13.5, fontFamily: "inherit",
                    border: `1px solid ${ativo ? T.gold : T.line}`,
                    background: ativo ? `${T.gold}22` : T.card,
                    color: ativo ? T.gold : T.sub,
                  }}>
                  {a.nome}
                </button>
              );
            })}
          </div>
        )}

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
