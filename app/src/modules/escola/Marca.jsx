/* Configuração da marca (white-label leve) + PREVIEW ao vivo (ref.
   spec): a escola vê, na hora, como ficam cabeçalho, botão e card
   com a cor e o logo dela. O design segue fixo — só a marca muda. */
import React, { useId, useState } from "react";
import { SectionCard, Botao, Erro, useInputStyle } from "../../shared/ui/componentes.jsx";
import { useTema, useBranding } from "../../shared/branding/BrandingContext.jsx";
import { BASE, luminancia, garantirLegivel } from "../../shared/ui/tema.js";
import { mensagemAmigavel } from "../../shared/lib/erros.js";
import * as db from "../../shared/data/index.js";

export function Marca({ escola, aoMudar }) {
  const T = useTema();
  const { aplicarMarca } = useBranding();
  const { input: inputS, label: lbl } = useInputStyle();
  const [nome, setNome] = useState(escola.nome ?? "");
  const [logo, setLogo] = useState(escola.logo_url ?? "");
  const [cor, setCor] = useState(escola.cor_acento ?? "#CDA349");
  const [erro, setErro] = useState(null);
  const [ok, setOk] = useState(false);
  const [ocupado, setOcupado] = useState(false);
  const uid = useId();
  const id = (k) => `${uid}-${k}`;

  const corValida = /^#[0-9a-fA-F]{6}$/.test(cor);
  const corEscura = corValida && luminancia(cor) < 0.32;
  const acento = corValida ? garantirLegivel(cor) : BASE.gold;

  async function salvar() {
    setOcupado(true); setErro(null); setOk(false);
    try {
      const marca = { nome: nome.trim() || escola.nome, logo_url: logo.trim() || null, cor_acento: corValida ? cor : null };
      await db.atualizarMarca(escola.id, marca);
      aplicarMarca(marca); // aplica em TODO o sistema na hora, sem recarregar
      setOk(true);
      aoMudar?.();
    } catch (e) { setErro(mensagemAmigavel(e, "salvar")); }
    setOcupado(false);
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
      <SectionCard titulo="Marca da escola" sub="O sistema leva o nome e a cara da escola. Layout e tipografia são fixos.">
        <div style={{ display: "grid", gap: 14 }}>
          <div>
            <label htmlFor={id("nome")} style={lbl}>Nome de exibição</label>
            <input id={id("nome")} value={nome} onChange={(e) => setNome(e.target.value)} placeholder="ex: Colégio Vitrine Naval" style={inputS} />
          </div>
          <div>
            <label htmlFor={id("logo")} style={lbl}>URL do logo (quadrado, opcional)</label>
            <input id={id("logo")} value={logo} onChange={(e) => setLogo(e.target.value)} placeholder="https://…/logo.png" style={inputS} />
          </div>
          <div>
            <label htmlFor={id("cor")} style={lbl}>Cor de destaque</label>
            <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
              <input id={id("cor")} type="color" value={corValida ? cor : "#CDA349"} onChange={(e) => setCor(e.target.value)} style={{ width: 54, height: 44, border: `1px solid ${T.line}`, borderRadius: 8, background: T.bg, padding: 4 }} />
              <input value={cor} onChange={(e) => setCor(e.target.value)} placeholder="#CDA349" aria-label="Cor de destaque em hexadecimal"
                style={{ ...inputS, width: 130, fontFamily: "monospace" }} />
            </div>
          </div>
        </div>
        {corEscura && (
          <div style={{ marginTop: 12, fontSize: 12.5, color: T.gold, border: `1px solid ${T.gold}44`, background: `${T.gold}10`, borderRadius: 8, padding: "9px 12px", lineHeight: 1.5 }}>
            ⚠ Esta cor é escura demais para o tema escuro — o sistema vai clareá-la automaticamente
            (<span style={{ fontFamily: "monospace" }}>{acento}</span>) para manter botões e destaques legíveis.
          </div>
        )}
        <Botao onClick={salvar} disabled={ocupado} style={{ marginTop: 16, width: "100%" }}>{ocupado ? "Salvando…" : "Salvar marca"}</Botao>
        {ok && <div style={{ color: BASE.green, fontSize: 13, marginTop: 10 }}>✓ Marca salva no banco e aplicada em todo o sistema.</div>}
        <Erro>{erro}</Erro>
      </SectionCard>

      <SectionCard titulo="Como a escola verá" sub="Pré-visualização ao vivo da personalização.">
        <BrandPreview nome={nome.trim() || escola.nome} logo={logo.trim()} acento={acento} />
      </SectionCard>
    </div>
  );
}

// Preview ESTÁTICO (não usa o tema da sessão — mostra a cor escolhida AGORA).
function BrandPreview({ nome, logo, acento }) {
  const C = BASE;
  const logoTrim = String(logo ?? "").trim();
  // Só http(s)/data:image viram <img src> (bloqueia javascript: e afins).
  // O teste de esquema INLINE sobre a mesma variável usada no src é a
  // barreira que a análise de taint reconhece (CodeQL DomBasedXss),
  // fechando o alerta "DOM text reinterpreted as HTML".
  const logoSeguro = /^(https?:\/\/|data:image\/)/i.test(logoTrim);
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
      {/* cabeçalho */}
      <div style={{ background: C.bg2, border: `1px solid ${C.line}`, borderRadius: 10, padding: "10px 12px", display: "flex", alignItems: "center", gap: 10 }}>
        {logoSeguro
          ? <img src={logoTrim} alt="" style={{ width: 32, height: 32, borderRadius: 8, objectFit: "cover" }} onError={(e) => { e.currentTarget.style.display = "none"; }} />
          : <div className="disp" style={{ width: 32, height: 32, borderRadius: 8, background: `linear-gradient(135deg, ${acento}, #9c7d2e)`, display: "flex", alignItems: "center", justifyContent: "center", color: "#0A1622", fontWeight: 800 }}>⚓</div>}
        <div style={{ flex: 1, minWidth: 0 }}>
          <div className="disp" style={{ fontSize: 14, fontWeight: 700, color: C.ink, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{nome}</div>
          <div style={{ fontSize: 10.5, color: C.sub }}>Painel de estudos</div>
        </div>
        <div style={{ textAlign: "center" }}>
          <div className="num disp" style={{ fontSize: 16, fontWeight: 800, color: acento }}>124</div>
          <div style={{ fontSize: 8.5, color: C.sub }}>dias p/ prova</div>
        </div>
      </div>
      {/* card + botão */}
      <div style={{ background: C.card, border: `1px solid ${C.line}`, borderRadius: 10, padding: 13 }}>
        <div className="disp" style={{ fontSize: 13.5, fontWeight: 700, color: C.ink }}>Missão da semana</div>
        <div style={{ height: 7, background: C.bg, borderRadius: 4, overflow: "hidden", margin: "9px 0" }}>
          <div style={{ width: "62%", height: "100%", background: `linear-gradient(90deg, ${acento}, ${C.green})` }} />
        </div>
        <div style={{ display: "flex", gap: 8 }}>
          <span style={{ background: acento, color: "#0A1622", borderRadius: 8, padding: "8px 16px", fontWeight: 800, fontSize: 12.5 }}>Concluir</span>
          <span style={{ border: `1px solid ${C.line}`, color: C.sub, borderRadius: 8, padding: "8px 14px", fontWeight: 600, fontSize: 12.5 }}>Adiar</span>
        </div>
      </div>
    </div>
  );
}
