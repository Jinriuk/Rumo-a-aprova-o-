/* Conformidade (LGPD): consentimentos registrados e a trilha de
   acesso ao dado dos alunos. Existe desde o MVP de propósito. */
import React from "react";
import { Card, Empty } from "../../shared/ui/componentes.jsx";
import { useTema } from "../../shared/branding/BrandingContext.jsx";

export function PainelConformidade({ consentimentos, logs, alunosPorId }) {
  const T = useTema();
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
      <Card>
        <div className="disp" style={{ fontSize: 15, fontWeight: 700, marginBottom: 10 }}>Consentimentos registrados</div>
        {consentimentos.length === 0 ? <Empty txt="Nenhum consentimento registrado ainda." /> : (
          <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
            {consentimentos.map((c) => (
              <div key={c.id} style={{ padding: "10px 8px", borderBottom: `1px solid ${T.line}`, fontSize: 13 }}>
                <b>{alunosPorId[c.aluno_id]?.nome ?? "(aluno removido)"}</b>
                <span style={{ color: T.sub }}> — responsável {c.responsavel_nome} · termo {c.termo_versao} · {new Date(c.aceito_em).toLocaleString("pt-BR")}</span>
              </div>
            ))}
          </div>
        )}
      </Card>

      <Card>
        <div className="disp" style={{ fontSize: 15, fontWeight: 700, marginBottom: 4 }}>Trilha de acesso ao dado dos alunos</div>
        <div style={{ fontSize: 12, color: T.sub, marginBottom: 10 }}>Quem acessou o dado de qual aluno e quando (últimos 100).</div>
        {logs.length === 0 ? <Empty txt="Nenhum acesso registrado ainda." /> : (
          <div style={{ display: "flex", flexDirection: "column", gap: 2, maxHeight: 420, overflowY: "auto" }}>
            {logs.map((l) => (
              <div key={l.id} style={{ padding: "8px", borderBottom: `1px solid ${T.line}`, fontSize: 12.5, color: T.sub }}>
                <span style={{ color: T.ink }}>{l.acao}</span> · aluno {alunosPorId[l.aluno_id]?.nome ?? l.aluno_id.slice(0, 8)} · papel {l.papel} · {new Date(l.em).toLocaleString("pt-BR")}
              </div>
            ))}
          </div>
        )}
      </Card>
    </div>
  );
}
