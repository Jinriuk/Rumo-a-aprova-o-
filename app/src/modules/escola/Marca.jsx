/* Configuração da marca (white-label leve) + PREVIEW ao vivo (ref.
   spec): a escola vê, na hora, como ficam cabeçalho, botão e card
   com a cor e o logo dela. O design segue fixo — só a marca muda. */
import React, { useId, useMemo, useState } from "react";
import { SectionCard, Botao, Erro, useInputStyle } from "../../shared/ui/componentes.jsx";
import { useTema, useBranding } from "../../shared/branding/BrandingContext.jsx";
import { BASE, precisaClarear, garantirLegivel, SUPERFICIE_CRITICA, RAZAO_MINIMA } from "../../shared/ui/tema.js";
import { razaoContraste, paraOklch } from "../../shared/ui/contraste.js";
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
  // Sem limiar duplicado: quem decide se a cor precisa de ajuste é o
  // mesmo algoritmo que faz o ajuste (tema.js), não uma cópia do
  // número aqui. Antes havia uma constante de luminância mínima em
  // tema.js e uma cópia dela nesta linha — e as duas estavam erradas.
  /* PERF: o clamp faz busca binária em OKLCh (pior caso medido ~0,25 ms,
     num azul saturado). Sem o memo ele rodaria a cada tecla digitada em
     QUALQUER campo desta tela — nome e URL do logo inclusive —, porque
     todos compartilham o mesmo render. Depende só de `cor`. */
  const { precisaAjuste, acento, razaoOriginal, razaoAjustada, perdeuSaturacao } = useMemo(() => {
    const valida = /^#[0-9a-fA-F]{6}$/.test(cor);
    const ac = valida ? garantirLegivel(cor) : BASE.gold;
    return {
      precisaAjuste: valida && precisaClarear(cor),
      acento: ac,
      razaoOriginal: valida ? razaoContraste(cor, SUPERFICIE_CRITICA) : null,
      razaoAjustada: razaoContraste(ac, SUPERFICIE_CRITICA),
      /* Só avisa sobre perda de saturação quando ela de fato acontece:
         em matiz vermelho/azul fechado o gamut sRGB não oferece croma
         suficiente na luminância exigida, mas num verde escuro como
         #0B3D2E o croma sai intacto e o aviso seria mentira. */
      perdeuSaturacao: valida && paraOklch(ac).C < paraOklch(cor).C * 0.98,
    };
  }, [cor]);

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
        {precisaAjuste && (
          <div style={{ marginTop: 12, fontSize: 12.5, color: T.gold, border: `1px solid ${T.gold}44`, background: `${T.gold}10`, borderRadius: 8, padding: "9px 12px", lineHeight: 1.5 }}>
            ⚠ Esta cor rende <b className="num">{razaoOriginal.toFixed(1).replace(".", ",")}:1</b> de contraste
            no fundo mais claro em que o sistema a usa — abaixo dos {String(RAZAO_MINIMA).replace(".", ",")}:1
            que texto precisa para ser legível (WCAG 1.4.3). O sistema vai exibi-la clareada
            (<span style={{ fontFamily: "monospace" }}>{acento}</span>,
            {" "}<b className="num">{razaoAjustada.toFixed(1).replace(".", ",")}:1</b>), mantendo o mesmo matiz.
            {perdeuSaturacao
              ? " Neste matiz não existe cor em tela que alcance esse contraste sem ceder saturação, então ela sai também menos intensa que a escolhida."
              : " A saturação é preservada — muda só a claridade."}
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

// Sanitiza a URL do logo antes de usá-la como `src` de <img>
// (autofix CodeQL js/xss-through-dom): aceita só data:image em base64 de
// formatos sem script (SVG fica de fora de propósito) OU URL absoluta
// http(s); qualquer outra coisa (javascript:, malformada…) vira "".
function sanitizarUrlLogo(valor) {
  const v = String(valor ?? "").trim();
  if (/^data:image\/(?:png|jpe?g|webp|gif);base64,[a-z0-9+/=]+$/i.test(v)) return v;
  try {
    const u = new URL(v);
    return (u.protocol === "https:" || u.protocol === "http:") ? u.toString() : "";
  } catch { return ""; }
}

// Preview ESTÁTICO (não usa o tema da sessão — mostra a cor escolhida AGORA).
function BrandPreview({ nome, logo, acento }) {
  const C = BASE;
  const logoSrcSeguro = sanitizarUrlLogo(logo);
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
      {/* cabeçalho */}
      <div style={{ background: C.bg2, border: `1px solid ${C.line}`, borderRadius: 10, padding: "10px 12px", display: "flex", alignItems: "center", gap: 10 }}>
        {logoSrcSeguro
          ? <img src={logoSrcSeguro} alt="" style={{ width: 32, height: 32, borderRadius: 8, objectFit: "cover" }} onError={(e) => { e.currentTarget.style.display = "none"; }} />
          : <div className="disp" style={{ width: 32, height: 32, borderRadius: 8, background: `linear-gradient(135deg, ${acento}, #9c7d2e)`, display: "flex", alignItems: "center", justifyContent: "center", color: "#0A1622", fontWeight: 800 }}>⚓</div>}
        <div style={{ flex: 1, minWidth: 0 }}>
          <h2 className="disp" style={{ margin: 0, fontSize: 14, fontWeight: 700, color: C.ink, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{nome}</h2>
          <div style={{ fontSize: 10.5, color: C.sub }}>Painel de estudos</div>
        </div>
        {/* C9: aqui havia `124` cravado no JSX, enquanto o cabeçalho da
            MESMA sessão dizia "0". Duas afirmações contraditórias sobre
            o mesmo dado, na mesma tela. Esta é uma pré-visualização de
            MARCA — ela existe para a coordenação ver cor e logo, não
            para informar contagem, e não tem aluno de referência de onde
            tirar uma. Então ela não finge ter um número: mostra o
            formato do bloco, rotulado como exemplo. */}
        <div style={{ textAlign: "center" }} title="Exemplo de layout — a contagem real usa a data de prova de cada aluno">
          <div className="disp" style={{ fontSize: 13, fontWeight: 800, color: acento, lineHeight: 1.1 }}>––</div>
          <div style={{ fontSize: 8.5, color: C.sub }}>dias p/ prova</div>
        </div>
      </div>
      {/* card + botão */}
      <div style={{ background: C.card, border: `1px solid ${C.line}`, borderRadius: 10, padding: 13 }}>
        <h2 className="disp" style={{ margin: 0, fontSize: 13.5, fontWeight: 700, color: C.ink }}>Missão da semana</h2>
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
