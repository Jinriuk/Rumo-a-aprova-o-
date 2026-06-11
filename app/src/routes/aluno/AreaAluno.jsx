/* Área do aluno: a própria meta e o próprio progresso. O banco só
   entrega o que é dele — esta tela nem precisa filtrar. */
import React, { useEffect, useState } from "react";
import { Cabecalho } from "../../shared/ui/Cabecalho.jsx";
import { Empty, Erro } from "../../shared/ui/componentes.jsx";
import { useTema } from "../../shared/branding/BrandingContext.jsx";
import { VisaoEstudo } from "./VisaoEstudo.jsx";
import { todayISO, daysBetween } from "../../shared/regras/regras.js";
import * as db from "../../shared/data/index.js";

export default function AreaAluno({ perfil }) {
  const T = useTema();
  const [aluno, setAluno] = useState(undefined);
  const [erro, setErro] = useState(null);
  const [diasProva, setDiasProva] = useState(null);

  useEffect(() => {
    let vivo = true;
    db.meuAluno()
      .then(async (a) => {
        if (!vivo) return;
        setAluno(a);
        if (a?.trilha_id) {
          const { semanas } = await db.carregarTrilha(a.trilha_id);
          const fim = String(semanas[semanas.length - 1].fim);
          if (vivo) setDiasProva(Math.max(0, daysBetween(new Date(todayISO()), new Date(fim))));
        }
      })
      .catch((e) => vivo && setErro(e.message));
    return () => { vivo = false; };
  }, []);

  return (
    <div>
      <Cabecalho subtitulo="Área do aluno" diasProva={diasProva} nomeUsuario={perfil.usuario.nome} />
      <main style={{ maxWidth: 1080, margin: "0 auto", padding: "18px max(16px, env(safe-area-inset-right)) calc(64px + env(safe-area-inset-bottom)) max(16px, env(safe-area-inset-left))" }}>
        {erro && <Erro>{erro}</Erro>}
        {aluno === undefined && !erro && <Empty txt="Carregando…" />}
        {aluno === null && <Empty txt="Sua conta não está ligada a um aluno. Fale com a coordenação." />}
        {aluno && <VisaoEstudo aluno={aluno} podeEditar />}
      </main>
    </div>
  );
}
