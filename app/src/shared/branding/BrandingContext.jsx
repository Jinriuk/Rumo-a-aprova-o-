/* A camada de marca (white-label leve, Doc 6 §1.2): aplica logo,
   nome e cor de acento da escola POR CIMA do design fixo. */
import React, { createContext, useContext, useMemo, useState } from "react";
import { BASE, tema as temaDaEscola } from "../ui/tema.js";

const BrandingContext = createContext({ escola: null, tema: BASE, aplicarMarca: () => {} });

export function BrandingProvider({ escola, children }) {
  // override local: a tela Marca aplica a mudança NA HORA, sem F5
  const [marcaLocal, setMarcaLocal] = useState(null);
  const efetiva = useMemo(
    () => (escola && marcaLocal ? { ...escola, ...marcaLocal } : escola),
    [escola, marcaLocal],
  );
  const tema = useMemo(() => temaDaEscola(efetiva?.cor_acento), [efetiva?.cor_acento]);
  // PERF: sem este memo o `value` era um objeto literal novo a cada
  // renderização do provider, e TODO consumidor de contexto re-renderizava
  // junto — `useTema()` aparece 92 vezes em 36 arquivos. Era também o que
  // anulava o `React.memo` do componente `Mini` em AreaEscola: ele lê o
  // contexto por dentro, então o memo de props não o protegia de nada.
  // `setMarcaLocal` já é estável (vem do useState), não precisa de useCallback.
  const valor = useMemo(
    () => ({ escola: efetiva, tema, aplicarMarca: setMarcaLocal }),
    [efetiva, tema],
  );
  return (
    <BrandingContext.Provider value={valor}>
      {children}
    </BrandingContext.Provider>
  );
}

export const useBranding = () => useContext(BrandingContext);
export const useTema = () => useContext(BrandingContext).tema;

// Sanitiza a URL do logo antes do <img src> (autofix CodeQL
// js/xss-through-dom): só data:image em base64 (formatos sem script) ou
// URL absoluta http(s); o resto (javascript:, malformada…) vira "".
function sanitizarUrlLogo(valor) {
  const v = String(valor ?? "").trim();
  if (/^data:image\/(?:png|jpe?g|webp|gif);base64,[a-z0-9+/=]+$/i.test(v)) return v;
  try {
    const u = new URL(v);
    return (u.protocol === "https:" || u.protocol === "http:") ? u.toString() : "";
  } catch { return ""; }
}

// O selo da escola no topo: logo dela se houver, senão a âncora
// sobre o gradiente de acento (mesma assinatura visual da versão atual).
export function MarcaEscola({ tamanho = 38 }) {
  const { escola, tema } = useBranding();
  const logoSrcSeguro = sanitizarUrlLogo(escola?.logo_url);
  if (logoSrcSeguro) {
    return (
      <img src={logoSrcSeguro} alt={escola.nome}
        style={{ width: tamanho, height: tamanho, borderRadius: 8, objectFit: "cover", flexShrink: 0 }} />
    );
  }
  return (
    <div className="disp" style={{
      width: tamanho, height: tamanho, borderRadius: 8,
      background: `linear-gradient(135deg,${tema.gold},#9c7d2e)`,
      display: "flex", alignItems: "center", justifyContent: "center",
      color: "#0A1622", fontWeight: 700, flexShrink: 0, fontSize: tamanho / 2,
    }}>⚓</div>
  );
}
