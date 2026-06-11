/* A camada de marca (white-label leve, Doc 6 §1.2): aplica logo,
   nome e cor de acento da escola POR CIMA do design fixo. */
import React, { createContext, useContext } from "react";
import { BASE, tema as temaDaEscola } from "../ui/tema.js";

const BrandingContext = createContext({ escola: null, tema: BASE });

export function BrandingProvider({ escola, children }) {
  const tema = temaDaEscola(escola?.cor_acento);
  return <BrandingContext.Provider value={{ escola, tema }}>{children}</BrandingContext.Provider>;
}

export const useBranding = () => useContext(BrandingContext);
export const useTema = () => useContext(BrandingContext).tema;

// O selo da escola no topo: logo dela se houver, senão a âncora
// sobre o gradiente de acento (mesma assinatura visual da versão atual).
export function MarcaEscola({ tamanho = 38 }) {
  const { escola, tema } = useBranding();
  if (escola?.logo_url) {
    return (
      <img src={escola.logo_url} alt={escola.nome}
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
