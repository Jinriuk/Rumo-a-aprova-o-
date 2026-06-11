/* Configuração da marca (white-label leve): logo, e a cor de acento
   dentro do limite. O design segue fixo — é isso que mantém a
   manutenção possível com 5–6 escolas. */
import React, { useState } from "react";
import { Card, Botao, Erro, useInputStyle } from "../../shared/ui/componentes.jsx";
import { useTema } from "../../shared/branding/BrandingContext.jsx";
import * as db from "../../shared/data/index.js";

export function Marca({ escola, aoMudar }) {
  const T = useTema();
  const { input: inputS, label: lbl } = useInputStyle();
  const [logo, setLogo] = useState(escola.logo_url ?? "");
  const [cor, setCor] = useState(escola.cor_acento ?? "#CDA349");
  const [erro, setErro] = useState(null);
  const [ok, setOk] = useState(false);
  const [ocupado, setOcupado] = useState(false);

  async function salvar() {
    setOcupado(true); setErro(null); setOk(false);
    try {
      await db.atualizarMarca(escola.id, { logo_url: logo.trim() || null, cor_acento: cor });
      setOk(true);
      aoMudar?.();
    } catch (e) { setErro(e.message); }
    setOcupado(false);
  }

  return (
    <Card>
      <div className="disp" style={{ fontSize: 15, fontWeight: 700, marginBottom: 4 }}>Marca da escola</div>
      <div style={{ fontSize: 12, color: T.sub, marginBottom: 14, lineHeight: 1.5 }}>
        O sistema leva o nome e a cara da escola: logo e cor de destaque. O layout e a tipografia são fixos.
      </div>
      <div style={{ display: "grid", gap: 12 }}>
        <div>
          <label style={lbl}>URL do logo (quadrado, opcional)</label>
          <input value={logo} onChange={(e) => setLogo(e.target.value)} placeholder="https://…/logo.png" style={inputS} />
        </div>
        <div>
          <label style={lbl}>Cor de destaque</label>
          <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
            <input type="color" value={cor} onChange={(e) => setCor(e.target.value)} style={{ width: 56, height: 46, border: `1px solid ${T.line}`, borderRadius: 8, background: T.bg, padding: 4 }} />
            <code style={{ color: T.sub, fontSize: 13 }}>{cor}</code>
          </div>
        </div>
      </div>
      <Botao onClick={salvar} disabled={ocupado} style={{ marginTop: 14 }}>{ocupado ? "Salvando…" : "Salvar marca"}</Botao>
      {ok && <div style={{ color: T.green, fontSize: 13, marginTop: 10 }}>Marca atualizada. Recarregue a página para ver em tudo.</div>}
      <Erro>{erro}</Erro>
    </Card>
  );
}
