/* Conformidade (LGPD): cards de resumo + consentimentos registrados
   e a trilha de acesso ao dado dos alunos. Linguagem institucional.
   Existe desde o MVP de propósito. */
import React from "react";
import { SectionCard, StatCard, EmptyState } from "../../shared/ui/componentes.jsx";
import { useTema } from "../../shared/branding/BrandingContext.jsx";

const ACAO_ROTULO = {
  "leitura-desempenho": "Leitura de desempenho",
  "exportacao-lgpd": "Exportação de dados",
  "exclusao-lgpd": "Exclusão de dados",
  "provisionou-aluno": "Credencial de aluno gerada",
  "provisionou-responsavel": "Credencial de responsável gerada",
};

export function PainelConformidade({ consentimentos, logs, alunosPorId }) {
  const T = useTema();
  const acoesLgpd = logs.filter((l) => l.acao === "exportacao-lgpd" || l.acao === "exclusao-lgpd").length;
  const ultimoAcesso = logs.length ? new Date(logs[0].em).toLocaleString("pt-BR") : "—";

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
      {/* O QUE É ESTA ÁREA (Fase 12 do doc: a página precisa se explicar) */}
      <div style={{ background: T.card, border: `1px solid ${T.line}`, borderLeft: `4px solid ${T.gold}`, borderRadius: 12, padding: "14px 16px" }}>
        <div className="disp" style={{ fontSize: 15, fontWeight: 700 }}>🛡 Para que serve esta área</div>
        <div style={{ fontSize: 13, color: T.sub, marginTop: 6, lineHeight: 1.6 }}>
          Os alunos são <b style={{ color: T.ink }}>menores de idade</b>, e a LGPD (Lei Geral de Proteção de Dados)
          exige que a escola comprove duas coisas: que o <b style={{ color: T.ink }}>responsável autorizou</b> o uso dos
          dados do aluno (consentimentos, abaixo) e <b style={{ color: T.ink }}>quem acessou o quê e quando</b> (trilha
          de acesso). Se um responsável pedir os dados do filho — ou pedir para apagá-los — é daqui que sai a resposta,
          pelos botões de exportar/excluir na aba Alunos. A escola é a controladora dos dados; esta página é a sua prova de conformidade.
        </div>
      </div>

      {/* RESUMO */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(150px,1fr))", gap: 10 }}>
        <StatCard rotulo="Consentimentos" valor={consentimentos.length} icone="📝" tom="ok" />
        <StatCard rotulo="Acessos registrados" valor={logs.length} icone="🛡" />
        <StatCard rotulo="Ações LGPD" valor={acoesLgpd} sub="exportações / exclusões" icone="⚖" />
        <StatCard rotulo="Último acesso" valor={logs.length ? "registrado" : "—"} sub={ultimoAcesso} icone="🕘" />
      </div>

      <SectionCard titulo="Consentimentos registrados" sub="A escola é a controladora dos dados (LGPD)." semPadding>
        {consentimentos.length === 0 ? (
          <div style={{ padding: 8 }}><EmptyState icone="📝" titulo="Nenhum consentimento ainda" dica="Registre o consentimento do responsável ao cadastrar cada aluno." /></div>
        ) : (
          <div style={{ display: "flex", flexDirection: "column" }}>
            {consentimentos.map((c, i) => (
              <div key={c.id} style={{ padding: "11px 15px", borderBottom: i === consentimentos.length - 1 ? "none" : `1px solid ${T.line}`, fontSize: 13 }}>
                <b>{alunosPorId[c.aluno_id]?.nome ?? "(aluno removido)"}</b>
                <div style={{ color: T.sub, fontSize: 12, marginTop: 2 }}>
                  responsável {c.responsavel_nome} · termo {c.termo_versao} · {new Date(c.aceito_em).toLocaleString("pt-BR")}
                </div>
              </div>
            ))}
          </div>
        )}
      </SectionCard>

      <SectionCard titulo="Trilha de acesso" sub="Quem acessou o dado de qual aluno e quando (últimos 100)." semPadding>
        {logs.length === 0 ? (
          <div style={{ padding: 8 }}><EmptyState icone="🛡" titulo="Nenhum acesso registrado" dica="Cada leitura de dado de aluno é registrada aqui automaticamente." /></div>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", maxHeight: 440, overflowY: "auto" }}>
            {logs.map((l, i) => (
              <div key={l.id} style={{ display: "flex", gap: 10, alignItems: "center", padding: "10px 15px", borderBottom: i === logs.length - 1 ? "none" : `1px solid ${T.line}`, fontSize: 12.5 }}>
                <span style={{ flex: 1, minWidth: 0, color: T.ink }}>
                  {ACAO_ROTULO[l.acao] ?? l.acao} · <span style={{ color: T.sub }}>{alunosPorId[l.aluno_id]?.nome ?? String(l.aluno_id).slice(0, 8)}</span>
                </span>
                <span style={{ color: T.sub, fontSize: 11, whiteSpace: "nowrap" }}>{l.papel} · {new Date(l.em).toLocaleString("pt-BR")}</span>
              </div>
            ))}
          </div>
        )}
      </SectionCard>
    </div>
  );
}
