/* Lista de registros de estudo — uma linha por lançamento. Era código
   repetido na ficha do aluno (coordenação, leitura) e na tela de
   registrar (aluno, com apagar). `porCodigo` resolve nome/cor da
   disciplina; `aoApagar` (opcional) mostra o botão de remover. */
import React from "react";
import { useTema } from "../branding/BrandingContext.jsx";
import { fmtBR } from "../regras/regras.js";

export function RegistroRow({ registro: l, disciplina, aoApagar, rotuloAcerto = false, ultima = false }) {
  const T = useTema();
  const acc = l.acertos !== null && l.questoes ? Math.round((l.acertos / l.questoes) * 100) : null;
  return (
    <div className="row" style={{ display: "flex", alignItems: "center", gap: 10, padding: "11px 14px", borderBottom: ultima ? "none" : `1px solid ${T.line}` }}>
      <span style={{ width: 9, height: 9, borderRadius: 3, background: disciplina?.cor, flexShrink: 0 }} />
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: 13.5, color: T.ink, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
          {disciplina?.nome}{l.topico ? <span style={{ color: T.sub }}> · {l.topico}</span> : null}
        </div>
        <div className="num" style={{ fontSize: 11.5, color: T.sub, marginTop: 1 }}>
          {fmtBR(String(l.data))} · {l.questoes} questões{acc !== null ? ` · ${acc}%${rotuloAcerto ? " acerto" : ""}` : ""}{l.minutos ? ` · ${l.minutos}min` : ""}
        </div>
      </div>
      {aoApagar && (
        <button onClick={() => aoApagar(l.id)} aria-label="Apagar registro" style={{ background: "transparent", border: "none", color: T.sub, fontSize: 22, width: 40, height: 40, flexShrink: 0, lineHeight: 1 }}>×</button>
      )}
    </div>
  );
}

export function ListaRegistros({ registros, porCodigo, aoApagar, rotuloAcerto = false }) {
  return (
    <div style={{ display: "flex", flexDirection: "column" }}>
      {registros.map((l, i) => (
        <RegistroRow key={l.id} registro={l} disciplina={porCodigo[l.disciplina_codigo]}
          aoApagar={aoApagar} rotuloAcerto={rotuloAcerto} ultima={i === registros.length - 1} />
      ))}
    </div>
  );
}
