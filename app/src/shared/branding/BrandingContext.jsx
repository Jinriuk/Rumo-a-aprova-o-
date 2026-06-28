/* A camada de marca (white-label leve, Doc 6 §1.2): aplica logo,
   nome e cor de acento da escola POR CIMA do design fixo. */
import React, { createContext, useContext, useState } from "react";
import { BASE, tema as temaDaEscola } from "../ui/tema.js";
import { urlImagemSegura } from "../validacao.js";

const BrandingContext = createContext({ escola: null, tema: BASE, aplicarMarca: () => {} });

export function BrandingProvider({ escola, children }) {
  // override local: a tela Marca aplica a mudança NA HORA, sem F5
  const [marcaLocal, setMarcaLocal] = useState(null);
  const efetiva = escola && marcaLocal ? { ...escola, ...marcaLocal } : escola;
  const tema = temaDaEscola(efetiva?.cor_acento);
  return (
    <BrandingContext.Provider value={{ escola: efetiva, tema, aplicarMarca: setMarcaLocal }}>
      {children}
    </BrandingContext.Provider>
  );
}

export const useBranding = () => useContext(BrandingContext);
export const useTema = () => useContext(BrandingContext).tema;

// O selo da escola no topo: logo dela se houver, senão a âncora
// sobre o gradiente de acento (mesma assinatura visual da versão atual).
export function MarcaEscola({ tamanho = 38 }) {
  const { escola, tema } = useBranding();
  const logoUrl = urlImagemSegura(escola?.logo_url);
  if (logoUrl) {
    return (
      <img src={logoUrl} alt={escola.nome}
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
