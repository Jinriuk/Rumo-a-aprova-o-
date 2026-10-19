/* Selo de maturidade de conteúdo de um concurso (PED2).
   Traduz a matriz de maturidade.js num selo visual e, opcionalmente,
   num aviso curto para coordenação/aluno. Não decide nada: só mostra
   o que a fonte única já declarou. */
import React, { useState } from "react";
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
// Em 'pre_edital' aparece em dourado: calendário liberado, fonte histórica.
// `aoEntender` põe o botão "Entendi" (aviso que aparece uma vez só).
export function AvisoMaturidade({ codigo, style, aoEntender }) {
  const T = useTema();
  const info = infoMaturidade(codigo);
  if (info.podeExibirComoPronta) return null;
  const cor = info.tom === "alerta" ? T.gold : info.tom === "risco" ? T.red : T.sub;
  return (
    <div role={aoEntender ? "note" : undefined} style={{
      display: "flex", gap: 8, alignItems: "flex-start", flexWrap: aoEntender ? "wrap" : undefined,
      border: `1px solid ${cor}55`, background: `${cor}12`, color: T.ink,
      borderRadius: 8, padding: "9px 11px", fontSize: 12, lineHeight: 1.45, ...style,
    }}>
      <span style={{ flexShrink: 0 }}><SeloMaturidade codigo={codigo} /></span>
      <span style={{ color: T.sub, flex: aoEntender ? "1 1 200px" : undefined }}>
        {info.descricao}
        {!info.aceitaAluno && " Este concurso ainda não recebe alunos."}
      </span>
      {aoEntender && (
        <button type="button" onClick={aoEntender}
          style={{ marginLeft: "auto", minHeight: 36, padding: "6px 14px", borderRadius: 8, border: `1px solid ${cor}`, background: "transparent", color: T.ink, fontWeight: 700, fontSize: 12.5, cursor: "pointer" }}>
          Entendi
        </button>
      )}
    </div>
  );
}

/* Raio-x, mudança 8 (decisão de 18/10): para aluno e responsável o aviso
   aparece uma vez, até o "Entendi". Antes ficava fixo no topo de todas as
   telas (22 das 40 capturas). Guardado neste navegador, por usuário e
   concurso: num aparelho novo ele volta uma vez. Depois disso o aluno
   encontra a mesma informação numa linha do Plano (LinhaMaturidade). */
const chaveAviso = (usuarioId, codigo) => `triliva-aviso-maturidade:${usuarioId ?? "anon"}:${codigo}`;

function avisoJaVisto(chave) {
  try { return localStorage.getItem(chave) === "1"; } catch { return false; }
}

export function AvisoMaturidadeUmaVez({ codigo, usuarioId, style }) {
  const chave = chaveAviso(usuarioId, codigo);
  // guarda a CHAVE dispensada: trocar de concurso (ou de aluno) não herda o "Entendi"
  const [dispensado, setDispensado] = useState(null);
  if (!codigo || dispensado === chave || avisoJaVisto(chave)) return null;
  const entender = () => {
    try { localStorage.setItem(chave, "1"); } catch { /* sem armazenamento: some só nesta visita */ }
    setDispensado(chave);
  };
  return <AvisoMaturidade codigo={codigo} style={style} aoEntender={entender} />;
}

// Uma linha, no Plano: o lugar fixo da informação depois do "Entendi".
export function LinhaMaturidade({ codigo, style }) {
  const T = useTema();
  const info = infoMaturidade(codigo);
  if (!codigo || info.podeExibirComoPronta) return null;
  return (
    <div style={{ display: "flex", gap: 8, alignItems: "center", fontSize: 12, color: T.sub, lineHeight: 1.4, ...style }}>
      <span style={{ flexShrink: 0 }}><SeloMaturidade codigo={codigo} /></span>
      <span>{info.resumo}</span>
    </div>
  );
}
