/* Backoffice interno (Fases 17.4/17.5) — área do OPERADOR (super_admin).
   Invisível para escolas: o App só monta isto quando sou_super_admin()
   é true no banco. Lista de escolas, criar escola e detalhe com o
   checklist de implantação. Tudo via RPC com porteiro no banco — nada
   de service_role aqui. A conta do coordenador (Auth) é provisionada
   pela camada de operador (scripts/criar-coordenacao.mjs). */
import React, { useState } from "react";
import { SectionCard, Empty, Erro, EmptyState, StatCard, Botao, useInputStyle } from "../../shared/ui/componentes.jsx";
import { useTema } from "../../shared/branding/BrandingContext.jsx";
import { useRecurso } from "../../shared/hooks/useRecurso.js";
import { nomeValido, limparNome } from "../../shared/validacao.js";
import * as db from "../../shared/data/index.js";

const fmtData = (iso) => {
  if (!iso) return "—";
  return new Date(iso).toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit", year: "2-digit" });
};
const STATUS = { implantacao: "Em implantação", ativa: "Ativa", suspensa: "Suspensa" };

export default function AreaAdmin() {
  const T = useTema();
  const { dados: escolas, carregando, erro, recarregar } = useRecurso(() => db.backofficeEscolas(), []);
  const [aberta, setAberta] = useState(null); // escola_id em detalhe
  const lista = escolas ?? [];
  const totalAlunos = lista.reduce((s, e) => s + Number(e.alunos || 0), 0);

  return (
    <div>
      <header style={{ borderBottom: `1px solid ${T.line}`, background: T.bg2 }}>
        <div style={{ maxWidth: 1080, margin: "0 auto", padding: "14px 16px", display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12 }}>
          <div>
            <div className="disp" style={{ fontSize: 16, fontWeight: 800, color: T.gold }}>Backoffice</div>
            <div style={{ fontSize: 12, color: T.sub }}>Operação interna · super_admin</div>
          </div>
          <button onClick={() => db.sair().catch(console.error)}
            style={{ border: `1px solid ${T.line}`, background: T.card, color: T.sub, borderRadius: 8, padding: "8px 14px", fontSize: 13, fontWeight: 600 }}>
            Sair
          </button>
        </div>
      </header>

      <main style={{ maxWidth: 1080, margin: "0 auto", padding: "16px", display: "flex", flexDirection: "column", gap: 16 }}>
        {erro && <Erro>{erro}</Erro>}
        {carregando && <Empty txt="Carregando escolas…" />}

        {!carregando && !erro && aberta && (
          <DetalheEscola escolaId={aberta} aoVoltar={() => { setAberta(null); recarregar(); }} />
        )}

        {!carregando && !erro && !aberta && (
          <>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(160px,1fr))", gap: 10 }}>
              <StatCard rotulo="Escolas" valor={lista.length} icone="🏫" />
              <StatCard rotulo="Alunos (total)" valor={totalAlunos} icone="👥" />
            </div>

            <NovaEscola aoCriar={recarregar} />

            <SectionCard titulo="Escolas" sub="Clique para ver detalhe e checklist de implantação." semPadding>
              {lista.length === 0 ? (
                <div style={{ padding: 8 }}><EmptyState icone="🏫" titulo="Nenhuma escola ainda" dica="Crie a primeira no formulário acima." /></div>
              ) : (
                <div style={{ display: "flex", flexDirection: "column" }}>
                  {lista.map((e, i) => (
                    <button key={e.escola_id} className="row" onClick={() => setAberta(e.escola_id)}
                      style={{ display: "flex", alignItems: "center", gap: 12, padding: "12px 15px", borderBottom: i === lista.length - 1 ? "none" : `1px solid ${T.line}`, flexWrap: "wrap", width: "100%", textAlign: "left", border: "none", background: "transparent", color: T.ink }}>
                      <div style={{ flex: 1, minWidth: 180 }}>
                        <div style={{ fontSize: 14.5, fontWeight: 700 }}>{e.nome} <SeloStatus status={e.status} /></div>
                        <div style={{ fontSize: 11.5, color: T.sub }}>/{e.slug}{e.cidade ? ` · ${e.cidade}${e.uf ? "/" + e.uf : ""}` : ""} · último acesso {fmtData(e.ultimo_acesso)}</div>
                      </div>
                      <div className="num" style={{ display: "flex", gap: 16, fontSize: 12, color: T.sub, textAlign: "right" }}>
                        <span><b style={{ color: T.ink, fontSize: 15 }}>{Number(e.alunos)}</b><br />alunos</span>
                        <span><b style={{ color: T.ink, fontSize: 15 }}>{Number(e.turmas)}</b><br />turmas</span>
                        <span><b style={{ color: T.ink, fontSize: 15 }}>{Number(e.coordenadores)}</b><br />coord.</span>
                      </div>
                      <span style={{ color: T.gold, fontWeight: 700, flexShrink: 0 }}>›</span>
                    </button>
                  ))}
                </div>
              )}
            </SectionCard>
          </>
        )}
      </main>
    </div>
  );
}

function SeloStatus({ status }) {
  const T = useTema();
  const cor = status === "ativa" ? T.green : status === "suspensa" ? T.red : T.gold;
  return (
    <span style={{ fontSize: 10.5, fontWeight: 700, color: cor, background: `${cor}1a`, border: `1px solid ${cor}44`, borderRadius: 6, padding: "1px 7px", marginLeft: 6, verticalAlign: "middle" }}>
      {STATUS[status] ?? status}
    </span>
  );
}

function NovaEscola({ aoCriar }) {
  const { input: inputS, label: lbl } = useInputStyle();
  const T = useTema();
  const [f, setF] = useState({ nome: "", slug: "", cidade: "", uf: "", plano: "", limite: "" });
  const [erro, setErro] = useState(null);
  const [ocupado, setOcupado] = useState(false);
  const set = (k, v) => setF((a) => ({ ...a, [k]: v }));

  const slugValido = /^[a-z0-9-]{2,40}$/.test(f.slug);
  const ufValido = f.uf === "" || /^[A-Za-z]{2}$/.test(f.uf);
  const pronto = nomeValido(f.nome) && slugValido && ufValido && !ocupado;

  async function criar() {
    if (!pronto) return;
    setOcupado(true); setErro(null);
    try {
      await db.backofficeCriarEscola({
        nome: limparNome(f.nome), slug: f.slug.trim().toLowerCase(),
        cidade: f.cidade.trim() || null, uf: f.uf.trim().toUpperCase() || null,
        plano: f.plano.trim() || null, limiteAlunos: f.limite ? +f.limite : null,
      });
      setF({ nome: "", slug: "", cidade: "", uf: "", plano: "", limite: "" });
      aoCriar?.();
    } catch (e) { setErro(e.message); }
    setOcupado(false);
  }

  return (
    <SectionCard titulo="Criar escola" sub="Cadastra a escola em estado de implantação. O coordenador é provisionado depois (operador).">
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(150px,1fr))", gap: 12 }}>
        <div style={{ gridColumn: "1 / -1" }}>
          <label style={lbl}>Nome de exibição</label>
          <input value={f.nome} onChange={(e) => set("nome", e.target.value)} placeholder="ex: Colégio Vitrine Naval" style={inputS} />
        </div>
        <div>
          <label style={lbl}>Slug (URL) <span style={{ color: T.gold }}>*</span></label>
          <input value={f.slug} onChange={(e) => set("slug", e.target.value.toLowerCase())} placeholder="vitrine"
            style={{ ...inputS, borderColor: f.slug && !slugValido ? T.red : T.line, fontFamily: "monospace" }} />
        </div>
        <div><label style={lbl}>Cidade</label><input value={f.cidade} onChange={(e) => set("cidade", e.target.value)} style={inputS} /></div>
        <div>
          <label style={lbl}>UF</label>
          <input value={f.uf} onChange={(e) => set("uf", e.target.value.toUpperCase().slice(0, 2))} placeholder="RJ"
            style={{ ...inputS, borderColor: !ufValido ? T.red : T.line }} />
        </div>
        <div><label style={lbl}>Plano</label><input value={f.plano} onChange={(e) => set("plano", e.target.value)} placeholder="ex: padrão" style={inputS} /></div>
        <div><label style={lbl}>Limite de alunos</label><input type="number" min="0" inputMode="numeric" value={f.limite} onChange={(e) => set("limite", e.target.value)} placeholder="opcional" style={inputS} /></div>
      </div>
      {f.slug && !slugValido && <div style={{ fontSize: 12, color: T.red, marginTop: 8 }}>Slug: 2–40 caracteres, só minúsculas, números e hífen.</div>}
      <Botao onClick={criar} disabled={!pronto} style={{ marginTop: 14 }}>{ocupado ? "Criando…" : "+ Criar escola"}</Botao>
      <Erro>{erro}</Erro>
    </SectionCard>
  );
}

const itensChecklist = (d) => {
  const e = d.escola ?? {};
  const marca = !!(e.cor_acento || e.logo_url);
  return [
    { ok: true, label: "Escola criada" },
    { ok: (d.coordenadores?.length ?? 0) > 0, label: "Coordenador provisionado", dica: "via scripts/criar-coordenacao.mjs" },
    { ok: marca, label: "Marca configurada (cor/logo)" },
    { ok: (d.turmas?.length ?? 0) > 0, label: "Turmas criadas" },
    { ok: Number(d.alunos) > 0, label: "Alunos importados" },
    { ok: Number(d.alunos_com_credencial) > 0, label: "Credenciais geradas" },
    { ok: Number(d.responsaveis) > 0, label: "Responsáveis vinculados (se houver)" },
    { ok: e.status === "ativa", label: "Acesso liberado (status ativa)" },
  ];
};

function DetalheEscola({ escolaId, aoVoltar }) {
  const T = useTema();
  const { dados: d, carregando, erro } = useRecurso(() => db.backofficeDetalheEscola(escolaId), [escolaId]);

  if (carregando) return <Empty txt="Carregando escola…" />;
  if (erro) return <><BotaoVoltar aoVoltar={aoVoltar} /><Erro>{erro}</Erro></>;
  const e = d.escola ?? {};
  const checklist = itensChecklist(d);
  const feitos = checklist.filter((x) => x.ok).length;

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
      <BotaoVoltar aoVoltar={aoVoltar} />
      <SectionCard titulo={e.nome} sub={`/${e.slug}${e.cidade ? ` · ${e.cidade}${e.uf ? "/" + e.uf : ""}` : ""}`}>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(130px,1fr))", gap: 10 }}>
          <StatCard rotulo="Status" valor={STATUS[e.status] ?? e.status} icone="◷" />
          <StatCard rotulo="Plano" valor={e.plano || "—"} icone="◆" />
          <StatCard rotulo="Alunos" valor={Number(d.alunos)} sub={e.limite_alunos ? `limite ${e.limite_alunos}` : null} icone="👥" />
          <StatCard rotulo="Coordenadores" valor={d.coordenadores?.length ?? 0} icone="🎓" />
        </div>
      </SectionCard>

      <SectionCard titulo="Checklist de implantação" sub={`${feitos} de ${checklist.length} concluídos`} semPadding>
        <div style={{ display: "flex", flexDirection: "column" }}>
          {checklist.map((x, i) => (
            <div key={x.label} style={{ display: "flex", alignItems: "center", gap: 11, padding: "11px 15px", borderBottom: i === checklist.length - 1 ? "none" : `1px solid ${T.line}` }}>
              <span style={{ width: 22, height: 22, borderRadius: "50%", flexShrink: 0, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 13, fontWeight: 800, background: x.ok ? `${T.green}22` : T.bg, color: x.ok ? T.green : T.sub, border: `1px solid ${x.ok ? T.green + "66" : T.line}` }}>
                {x.ok ? "✓" : "○"}
              </span>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 13.5, color: x.ok ? T.ink : T.sub }}>{x.label}</div>
                {!x.ok && x.dica && <div style={{ fontSize: 11, color: T.sub, marginTop: 1 }}>{x.dica}</div>}
              </div>
            </div>
          ))}
        </div>
      </SectionCard>

      {(d.turmas?.length > 0 || d.coordenadores?.length > 0) && (
        <SectionCard titulo="Composição">
          <div style={{ fontSize: 13, color: T.sub, lineHeight: 1.7 }}>
            <div><b style={{ color: T.ink }}>Coordenadores:</b> {d.coordenadores?.length ? d.coordenadores.join(", ") : "—"}</div>
            <div><b style={{ color: T.ink }}>Turmas:</b> {d.turmas?.length ? d.turmas.join(", ") : "—"}</div>
            <div><b style={{ color: T.ink }}>Consentimentos:</b> {Number(d.consentimentos)} · <b style={{ color: T.ink }}>Com credencial:</b> {Number(d.alunos_com_credencial)}/{Number(d.alunos)}</div>
          </div>
        </SectionCard>
      )}
    </div>
  );
}

function BotaoVoltar({ aoVoltar }) {
  const T = useTema();
  return (
    <button onClick={aoVoltar} style={{ alignSelf: "flex-start", border: `1px solid ${T.line}`, background: T.card, color: T.sub, borderRadius: 8, padding: "8px 14px", fontSize: 13, fontWeight: 600 }}>
      ← voltar às escolas
    </button>
  );
}
