/* Selo de maturidade de conteúdo de um concurso (PED2).
   Traduz a matriz de maturidade.js num selo visual e, opcionalmente,
   num aviso curto para coordenação/aluno. Não decide nada: só mostra
   o que a fonte única já declarou. */
import React from "react";
import { StatusBadge } from "../../shared/ui/componentes.jsx";
import { useTema } from "../../shared/branding/BrandingContext.jsx";
import { infoMaturidade } from "./maturidade.js";

// Selo compacto: "Completa" (verde) / "Beta" (dourado) /
// "Esqueleto" (vermelho) / "Indisponível" (neutro).
export function SeloMaturidade({ codigo }) {
  const info = infoMaturidade(codigo);
  return <StatusBadge tom={info.tom}>{info.rotulo}</StatusBadge>;
}

// Aviso curto exibido quando o concurso NÃO está completo — para a
// UI nunca vender trilha parcial como pronta. Some no caso 'completa'.
export function AvisoMaturidade({ codigo, style }) {
  const T = useTema();
  const info = infoMaturidade(codigo);
  if (info.podeExibirComoPronta) return null;
  const cor = info.tom === "alerta" ? T.gold : info.tom === "risco" ? T.red : T.sub;
  return (
    <div style={{
      display: "flex", gap: 8, alignItems: "flex-start",
      border: `1px solid ${cor}55`, background: `${cor}12`, color: T.ink,
      borderRadius: 8, padding: "9px 11px", fontSize: 12, lineHeight: 1.45, ...style,
    }}>
      <span style={{ flexShrink: 0 }}><SeloMaturidade codigo={codigo} /></span>
      <span style={{ color: T.sub }}>
        {info.descricao}
        {!info.aceitaAluno && " Este concurso ainda não recebe alunos."}
      </span>
    </div>
  );
}
