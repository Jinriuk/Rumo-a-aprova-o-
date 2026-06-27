/* Relatórios e comparativos da coordenação (PERF1 / Camada 4.6–4.7).
   Comparação por TURMA e recorte por CONCURSO, mais exportação CSV
   (alunos detalhado, resumo por turma, resumo por concurso). Tudo
   sobre o agregado por aluno que a Área da Escola já carregou sob a
   RLS — nenhuma consulta nova, nenhum dado de outra escola. */
import React, { useMemo } from "react";
import { SectionCard, EmptyState, BotaoMini } from "../../shared/ui/componentes.jsx";
import { useTema } from "../../shared/branding/BrandingContext.jsx";
import { paraCSV, baixarCSV, nomeArquivoSeguro } from "../../shared/lib/csv.js";
import {
  compararTurmas, compararConcursos,
  linhasRelatorioAlunos, linhasRelatorioTurmas, linhasRelatorioConcursos,
  COLUNAS_ALUNOS, COLUNAS_TURMAS, COLUNAS_CONCURSOS,
} from "../../shared/metricas/comparativo.js";

const fmtAcerto = (v) => (v == null ? "—" : `${v}%`);

export function Relatorios({ alunos = [], turmas = [], concursosPorId = {}, resumoPorAluno = {}, escolaNome = "escola" }) {
  const T = useTema();

  const params = useMemo(
    () => ({ alunos, turmas, concursosPorId, resumoPorAluno }),
    [alunos, turmas, concursosPorId, resumoPorAluno],
  );
  const porTurma = useMemo(() => compararTurmas(params), [params]);
  const porConcurso = useMemo(() => compararConcursos(params), [params]);

  function exportar(tipo) {
    const base = nomeArquivoSeguro(escolaNome, false);
    if (tipo === "alunos") {
      baixarCSV(`relatorio-alunos-${base}-${hoje()}`, paraCSV(COLUNAS_ALUNOS, linhasRelatorioAlunos(params)));
    } else if (tipo === "turmas") {
      baixarCSV(`relatorio-turmas-${base}-${hoje()}`, paraCSV(COLUNAS_TURMAS, linhasRelatorioTurmas(params)));
    } else if (tipo === "concursos") {
      baixarCSV(`relatorio-concursos-${base}-${hoje()}`, paraCSV(COLUNAS_CONCURSOS, linhasRelatorioConcursos(params)));
    }
  }

  if (alunos.length === 0) {
    return (
      <SectionCard titulo="Relatórios e comparativos">
        <EmptyState icone="📊" titulo="Sem dados para relatório"
          dica="Os comparativos e a exportação aparecem quando há alunos cadastrados." />
      </SectionCard>
    );
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
      <SectionCard
        titulo="Exportar relatórios (CSV)"
        sub="Planilha compatível com Excel/Google Sheets. Exporta apenas os dados desta escola."
        acao={
          <div style={{ display: "flex", gap: 7, flexWrap: "wrap", justifyContent: "flex-end" }}>
            <BotaoMini destaque onClick={() => exportar("alunos")}>↓ Alunos</BotaoMini>
            <BotaoMini onClick={() => exportar("turmas")}>↓ Turmas</BotaoMini>
            <BotaoMini onClick={() => exportar("concursos")}>↓ Concursos</BotaoMini>
          </div>
        }
      >
        <div style={{ fontSize: 12, color: T.sub, lineHeight: 1.5 }}>
          <b style={{ color: T.ink }}>Alunos</b> — uma linha por aluno (turma, concurso, questões, acerto, dias, meta).{" "}
          <b style={{ color: T.ink }}>Turmas</b> e <b style={{ color: T.ink }}>Concursos</b> — uma linha por grupo, com os mesmos indicadores agregados.
        </div>
      </SectionCard>

      <TabelaComparativo titulo="Comparação por turma" colunaChave="turma" rotuloChave="Turma" linhas={porTurma} T={T} />
      <TabelaComparativo titulo="Recorte por concurso" colunaChave="concurso" rotuloChave="Concurso" linhas={porConcurso} T={T} />
    </div>
  );
}

function TabelaComparativo({ titulo, colunaChave, rotuloChave, linhas, T }) {
  if (!linhas.length) {
    return (
      <SectionCard titulo={titulo}>
        <EmptyState icone="📋" titulo="Nada para comparar ainda" dica="Aparece quando há alunos com este recorte." />
      </SectionCard>
    );
  }
  const th = { textAlign: "right", fontSize: 10.5, color: T.sub, textTransform: "uppercase", letterSpacing: 0.4, padding: "8px 10px", whiteSpace: "nowrap", fontWeight: 700 };
  const td = { textAlign: "right", fontSize: 13, padding: "9px 10px", borderTop: `1px solid ${T.line}`, whiteSpace: "nowrap" };
  const cor = (acc) => (acc == null ? T.sub : acc >= 70 ? T.green : acc >= 55 ? T.gold : T.red);
  return (
    <SectionCard titulo={titulo} sub="Visível só para a coordenação." semPadding>
      <div style={{ overflowX: "auto" }}>
        <table style={{ borderCollapse: "collapse", width: "100%", minWidth: 640 }}>
          <thead>
            <tr>
              <th style={{ ...th, textAlign: "left" }}>{rotuloChave}</th>
              <th style={th}>Alunos</th>
              <th style={th}>Questões</th>
              <th style={th}>Q. 7d</th>
              <th style={th}>Acerto</th>
              <th style={th}>Acerto 7d</th>
              <th style={th}>Ativos 7d</th>
              <th style={th}>Sem ativ.</th>
              <th style={th}>Sem cred.</th>
            </tr>
          </thead>
          <tbody>
            {linhas.map((l, i) => (
              <tr key={l[colunaChave] + i} className="row">
                <td style={{ ...td, textAlign: "left", fontWeight: 700 }}>{l[colunaChave]}</td>
                <td style={{ ...td, color: T.sub }}>{l.n}</td>
                <td style={td}>{l.questoes}</td>
                <td style={td}>{l.questoes7d}</td>
                <td style={{ ...td, color: cor(l.acerto), fontWeight: 700 }}>{fmtAcerto(l.acerto)}</td>
                <td style={{ ...td, color: cor(l.acerto7d), fontWeight: 700 }}>{fmtAcerto(l.acerto7d)}</td>
                <td style={{ ...td, color: T.green }}>{l.ativos}</td>
                <td style={{ ...td, color: l.semAtividade ? T.red : T.sub }}>{l.semAtividade}</td>
                <td style={{ ...td, color: l.semCredencial ? T.gold : T.sub }}>{l.semCredencial}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </SectionCard>
  );
}

const hoje = () => new Date().toISOString().slice(0, 10);
