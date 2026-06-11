/* Área do responsável: leitura do aluno vinculado, com o resumo em
   linguagem clara primeiro. Todo acesso fica no log (LGPD). */
import React, { useEffect, useState } from "react";
import { Cabecalho } from "../../shared/ui/Cabecalho.jsx";
import { Empty, Erro } from "../../shared/ui/componentes.jsx";
import { VisaoEstudo } from "../aluno/VisaoEstudo.jsx";
import * as db from "../../shared/data/index.js";

export default function AreaResponsavel({ perfil }) {
  const [aluno, setAluno] = useState(undefined);
  const [erro, setErro] = useState(null);

  useEffect(() => {
    let vivo = true;
    db.alunoVinculado()
      .then((a) => {
        if (!vivo) return;
        setAluno(a);
        if (a) {
          // trilha de acesso: o responsável leu o dado do aluno
          db.registrarAcesso(perfil.escola.id, a.id, perfil.usuario.id, "responsavel", "leitura-desempenho");
        }
      })
      .catch((e) => vivo && setErro(e.message));
    return () => { vivo = false; };
  }, []);

  return (
    <div>
      <Cabecalho subtitulo={aluno ? `Acompanhamento de ${aluno.nome}` : "Acompanhamento"}
        nomeUsuario={perfil.usuario.nome} rotuloPapel="Acompanhamento" />
      <main style={{ maxWidth: 1080, margin: "0 auto", padding: "18px max(16px, env(safe-area-inset-right)) calc(64px + env(safe-area-inset-bottom)) max(16px, env(safe-area-inset-left))" }}>
        {erro && <Erro>{erro}</Erro>}
        {aluno === undefined && !erro && <Empty txt="Carregando…" />}
        {aluno === null && <Empty txt="Nenhum aluno vinculado a este acesso. Fale com a escola." />}
        {aluno && <VisaoEstudo aluno={aluno} podeEditar={false} comResumo />}
      </main>
    </div>
  );
}
