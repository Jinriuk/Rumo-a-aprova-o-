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
  // T14: os campos (data, questões, acerto, minutos) já são dados
  // discretos — juntá-los numa única string com " · " virava prosa
  // corrida, difícil de escanear numa lista de dezenas de linhas. Cada
  // um vira um selo próprio, como o app já faz noutros lugares (ex.:
  // "✦ ≈N questões" em MetaSemana.jsx).
  const selo = { fontSize: 11, fontWeight: 700, color: T.sub, border: `1px solid ${T.line}`, borderRadius: 6, padding: "1px 7px" };
  return (
    <div className="row" style={{ display: "flex", alignItems: "center", gap: 10, padding: "11px 14px", borderBottom: ultima ? "none" : `1px solid ${T.line}` }}>
      <span style={{ width: 9, height: 9, borderRadius: 3, background: disciplina?.cor, flexShrink: 0 }} />
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: 13.5, color: T.ink, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
          {disciplina?.nome}{l.topico ? <span style={{ color: T.sub }}> · {l.topico}</span> : null}
        </div>
        <div style={{ display: "flex", flexWrap: "wrap", alignItems: "center", gap: 6, marginTop: 4 }}>
          <span className="num" style={{ fontSize: 11.5, color: T.sub }}>{fmtBR(String(l.data))}</span>
          <span className="num" style={selo}>{l.questoes} questões</span>
          {acc !== null && (
            <span className="num" style={{ ...selo, color: acc >= 60 ? T.green : T.red, borderColor: `${acc >= 60 ? T.green : T.red}55` }}>
              {acc}%{rotuloAcerto ? " acerto" : ""}
            </span>
          )}
          {l.minutos ? <span className="num" style={selo}>{l.minutos}min</span> : null}
        </div>
      </div>
      {aoApagar && (
        <button type="button" onClick={() => aoApagar(l.id)} aria-label="Apagar registro" style={{ background: "transparent", border: "none", color: T.sub, fontSize: 22, width: 40, height: 40, flexShrink: 0, lineHeight: 1 }}>×</button>
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
