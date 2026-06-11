/* Área da coordenação: alunos e turmas, credenciais, consentimento,
   desempenho por aluno, conformidade e marca. */
import React, { useEffect, useState } from "react";
import { Cabecalho } from "../../shared/ui/Cabecalho.jsx";
import { Card, Empty, Erro } from "../../shared/ui/componentes.jsx";
import { useTema } from "../../shared/branding/BrandingContext.jsx";
import { NovaTurma, NovosAlunos, CredencialGerada } from "../../modules/pessoas/CadastroAlunos.jsx";
import { ListaAlunos } from "../../modules/pessoas/ListaAlunos.jsx";
import { Marca } from "../../modules/escola/Marca.jsx";
import { PainelConformidade } from "../../modules/consentimento/PainelConformidade.jsx";
import { VisaoEstudo } from "../aluno/VisaoEstudo.jsx";
import * as db from "../../shared/data/index.js";

export default function AreaEscola({ perfil }) {
  const T = useTema();
  const [tab, setTab] = useState("alunos");
  const [dados, setDados] = useState({ carregando: true, erro: null, turmas: [], alunos: [], consentimentos: [], logs: [], trilha: null });
  const [credencial, setCredencial] = useState(null);
  const [alunoAberto, setAlunoAberto] = useState(null);
  const [versao, setVersao] = useState(0);
  const recarregar = () => setVersao((v) => v + 1);

  useEffect(() => {
    let vivo = true;
    Promise.all([db.listarTurmas(), db.listarAlunos(), db.listarConsentimentos(), db.listarLogsAcesso(), db.trilhaPadrao()])
      .then(([turmas, alunos, consentimentos, logs, trilha]) =>
        vivo && setDados({ carregando: false, erro: null, turmas, alunos, consentimentos, logs, trilha }))
      .catch((e) => vivo && setDados((d) => ({ ...d, carregando: false, erro: e.message })));
    return () => { vivo = false; };
  }, [versao]);

  function verAluno(aluno) {
    setAlunoAberto(aluno);
    // trilha de acesso: a coordenação abriu o desempenho do aluno
    db.registrarAcesso(perfil.escola.id, aluno.id, perfil.usuario.id, "coordenacao", "leitura-desempenho");
  }

  const alunosPorId = Object.fromEntries(dados.alunos.map((a) => [a.id, a]));
  const ABAS = [["alunos", "Alunos"], ["turmas", "Turmas"], ["conformidade", "LGPD"], ["marca", "Marca"]];

  return (
    <div>
      <Cabecalho subtitulo="Área da coordenação" nomeUsuario={perfil.usuario.nome} />
      <div className="navwrap" style={{ maxWidth: 1080, margin: "0 auto", padding: "0 8px", display: "flex", gap: 2, overflowX: "auto", borderBottom: `1px solid ${T.line}` }}>
        {ABAS.map(([k, lb]) => (
          <button key={k} className="tab" onClick={() => { setTab(k); setAlunoAberto(null); }}
            style={{ border: "none", background: "transparent", color: tab === k && !alunoAberto ? T.gold : T.sub, fontWeight: 600, fontSize: 14, padding: "13px 14px", minHeight: 46, whiteSpace: "nowrap", borderBottom: tab === k && !alunoAberto ? `2px solid ${T.gold}` : "2px solid transparent" }}>
            {lb}
          </button>
        ))}
      </div>

      <main style={{ maxWidth: 1080, margin: "0 auto", padding: "18px max(16px, env(safe-area-inset-right)) calc(64px + env(safe-area-inset-bottom)) max(16px, env(safe-area-inset-left))" }} className="fade" key={tab + (alunoAberto?.id ?? "")}>
        {dados.erro && <Erro>{dados.erro}</Erro>}
        {dados.carregando && <Empty txt="Carregando…" />}

        {!dados.carregando && alunoAberto && (
          <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
              <button onClick={() => setAlunoAberto(null)} style={{ border: `1px solid ${T.line}`, background: T.card, color: T.sub, borderRadius: 8, padding: "8px 14px", fontSize: 13, fontWeight: 600 }}>← voltar</button>
              <div className="disp" style={{ fontSize: 18, fontWeight: 700 }}>{alunoAberto.nome}</div>
            </div>
            <VisaoEstudo aluno={alunoAberto} podeEditar={false} comResumo />
          </div>
        )}

        {!dados.carregando && !alunoAberto && tab === "alunos" && (
          <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
            <NovosAlunos turmas={dados.turmas} trilhaPadrao={dados.trilha} aoMudar={recarregar} />
            <ListaAlunos alunos={dados.alunos} consentimentos={dados.consentimentos}
              aoMudar={recarregar} aoGerarCredencial={setCredencial} aoVerAluno={verAluno} />
          </div>
        )}

        {!dados.carregando && !alunoAberto && tab === "turmas" && (
          <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
            <NovaTurma aoMudar={recarregar} />
            <Card>
              <div className="disp" style={{ fontSize: 15, fontWeight: 700, marginBottom: 10 }}>Turmas</div>
              {dados.turmas.length === 0 ? <Empty txt="Nenhuma turma ainda." /> : (
                dados.turmas.map((t) => {
                  const n = dados.alunos.filter((a) => (a.alunos_turmas ?? []).some((v) => v.turma_id === t.id)).length;
                  return (
                    <div key={t.id} style={{ padding: "10px 8px", borderBottom: `1px solid ${T.line}`, fontSize: 14 }}>
                      <b>{t.nome}</b> <span style={{ color: T.sub, fontSize: 12.5 }}>· {n} aluno(s)</span>
                    </div>
                  );
                })
              )}
            </Card>
          </div>
        )}

        {!dados.carregando && !alunoAberto && tab === "conformidade" && (
          <PainelConformidade consentimentos={dados.consentimentos} logs={dados.logs} alunosPorId={alunosPorId} />
        )}

        {!dados.carregando && !alunoAberto && tab === "marca" && (
          <Marca escola={perfil.escola} aoMudar={recarregar} />
        )}
      </main>

      <CredencialGerada credencial={credencial} aoFechar={() => setCredencial(null)} />
    </div>
  );
}
