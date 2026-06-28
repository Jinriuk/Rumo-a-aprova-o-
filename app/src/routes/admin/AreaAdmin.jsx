/* Backoffice interno (D0/D1A/D1B) — área do OPERADOR (super_admin).
   Invisível para escolas: o App só monta isto quando sou_super_admin()
   é true NO BANCO. Dashboard, lista de escolas com busca/filtro, detalhe
   com edição, ações de status e provisionamento de coordenador — tudo
   via RPC/Edge Function com porteiro. Credencial de admin nunca no navegador.
   D1B: backoffice substitui os scripts manuais de provisionamento. */
import React, { useId, useMemo, useState } from "react";
import {
  SectionCard, Empty, Erro, EmptyState, StatCard, StatusBadge,
  Botao, BotaoMini, useInputStyle, CarregandoBloco,
} from "../../shared/ui/componentes.jsx";
import { useTema } from "../../shared/branding/BrandingContext.jsx";
import { useRecurso } from "../../shared/hooks/useRecurso.js";
import { nomeValido, limparNome } from "../../shared/validacao.js";
import { mensagemAmigavel } from "../../shared/lib/erros.js";
import * as db from "../../shared/data/index.js";
import {
  categoriaEscola, avisosRisco, severidadeMaxima,
  checklistGoLive, resumoChecklist,
  modalidadesDaEscola, ESTADO_MODALIDADE,
  resumoRisco, filtrarLogs, acoesPresentes,
} from "../../modules/backoffice/operacao.js";

const fmtData = (iso) => (iso ? new Date(iso).toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit", year: "2-digit" }) : "—");

const STATUS = {
  implantacao: { rotulo: "Em implantação", tom: "alerta", operacional: true },
  demo:        { rotulo: "Demonstração",   tom: "alerta", operacional: true },
  piloto:      { rotulo: "Piloto",         tom: "alerta", operacional: true },
  ativa:       { rotulo: "Ativa",          tom: "ok",     operacional: true },
  suspensa:    { rotulo: "Suspensa",       tom: "risco",  operacional: false },
  cancelada:   { rotulo: "Cancelada",      tom: "risco",  operacional: false },
};
const rotuloStatus = (s) => STATUS[s]?.rotulo ?? s ?? "—";
const operacional = (s) => STATUS[s]?.operacional ?? true;

export default function AreaAdmin() {
  const T = useTema();
  const { dados: escolas, carregando, erro, recarregar } = useRecurso(() => db.backofficeEscolas(), []);
  const { dados: dash, recarregar: recDash } = useRecurso(() => db.backofficeDashboard(), []);
  const { dados: logs, recarregar: recLogs } = useRecurso(() => db.backofficeLogs(200), []);
  const [aberta, setAberta] = useState(null);

  const recarregarTudo = () => { recarregar(); recDash(); recLogs(); };
  const lista = escolas ?? [];
  const nomePorEscola = useMemo(() => Object.fromEntries(lista.map((e) => [e.escola_id, e.nome])), [lista]);

  return (
    <div>
      <header style={{ borderBottom: `1px solid ${T.line}`, background: T.bg2, position: "sticky", top: 0, zIndex: 10 }}>
        <div style={{ maxWidth: 1080, margin: "0 auto", padding: "14px 16px", display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <div className="disp" style={{ width: 34, height: 34, borderRadius: 8, background: `linear-gradient(135deg,${T.gold},#9c7d2e)`, display: "flex", alignItems: "center", justifyContent: "center", color: "#0A1622", fontWeight: 800, fontSize: 17 }}>⚓</div>
            <div>
              <div className="disp" style={{ fontSize: 16, fontWeight: 800, color: T.gold, lineHeight: 1.1 }}>Backoffice</div>
              <div style={{ fontSize: 11.5, color: T.sub }}>Operação interna · super_admin</div>
            </div>
          </div>
          <button onClick={() => db.sair().catch(console.error)}
            style={{ border: `1px solid ${T.line}`, background: T.card, color: T.sub, borderRadius: 8, padding: "8px 14px", fontSize: 13, fontWeight: 600 }}>
            Sair
          </button>
        </div>
      </header>

      <main style={{ maxWidth: 1080, margin: "0 auto", padding: "16px", display: "flex", flexDirection: "column", gap: 16 }}>
        {erro && <Erro>{erro}</Erro>}
        {carregando && <CarregandoBloco titulo="Carregando escolas…" cartoes={4} linhas={5} />}

        {!carregando && !erro && aberta && (
          <DetalheEscola escolaId={aberta} aoVoltar={() => { setAberta(null); recarregarTudo(); }} aoMudar={recarregarTudo} />
        )}

        {!carregando && !erro && !aberta && (
          <>
            <Dashboard dash={dash} lista={lista} />
            <NovaEscola aoCriar={recarregarTudo} />
            <ListaEscolas lista={lista} aoAbrir={setAberta} />
            <AtividadeAdmin logs={logs} nomePorEscola={nomePorEscola} />
          </>
        )}
      </main>
    </div>
  );
}

/* ---------- Dashboard ---------- */
function Dashboard({ dash, lista = [] }) {
  const T = useTema();
  if (!dash) return null;
  const semCoord = Number(dash.escolas_sem_coordenador || 0);
  const suspensas = Number(dash.escolas_suspensas || 0);
  // Resumo de risco/categoria derivado da LISTA (puro). Separa demo/teste/
  // real/individual e conta pendências para o painel de saúde (ADM2 t.36/38).
  const risco = useMemo(() => resumoRisco(lista), [lista]);
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(150px,1fr))", gap: 10 }}>
        <StatCard rotulo="Escolas" valor={Number(dash.escolas_total || 0)} icone="🏫" gradiente={T.gold} />
        <StatCard rotulo="Ativas" valor={Number(dash.escolas_ativas || 0)} icone="✓" tom="ok" />
        <StatCard rotulo="Demo / piloto" valor={Number(dash.escolas_demo_piloto || 0)} icone="◷" tom="alerta" />
        <StatCard rotulo="Suspensas" valor={suspensas} icone="⏸" tom={suspensas ? "risco" : "neutro"} />
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(150px,1fr))", gap: 10 }}>
        <StatCard rotulo="Alunos (total)" valor={Number(dash.alunos_total || 0)} icone="👥" />
        <StatCard rotulo="Alunos ativos (7d)" valor={Number(dash.alunos_ativos_7d || 0)} icone="⚡" sub="acesso nos últimos 7 dias" />
        <StatCard rotulo="Coordenadores" valor={Number(dash.coordenadores_total || 0)} icone="🎓" />
        <StatCard rotulo="Sem coordenador" valor={semCoord} icone="⚠" tom={semCoord ? "risco" : "ok"} sub={semCoord ? "precisam de provisão" : "tudo coberto"} />
      </div>

      {/* Saúde da operação: categoria das escolas + risco agregado */}
      <SectionCard titulo="Saúde da operação" sub="Separação demo/teste/real/individual e pendências que pedem atenção." semPadding>
        <div style={{ padding: 12, display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(120px,1fr))", gap: 10 }}>
          <MiniSaude rotulo="Reais (B2B)" valor={risco.real} tom="ok" icone="🏫" />
          <MiniSaude rotulo="Teste/piloto" valor={risco.teste} tom="alerta" icone="◷" />
          <MiniSaude rotulo="Demonstração" valor={risco.demo} tom="alerta" icone="◑" />
          <MiniSaude rotulo="Individual/B2C" valor={risco.individual} tom="neutro" icone="👤" />
          <MiniSaude rotulo="Sem alunos" valor={risco.semAlunos} tom={risco.semAlunos ? "risco" : "ok"} icone="∅" />
          <MiniSaude rotulo="Com risco" valor={risco.comRisco} tom={risco.comRisco ? "risco" : "ok"} icone="⚠" sub="risco ou alerta aberto" />
        </div>
      </SectionCard>
    </div>
  );
}

function MiniSaude({ rotulo, valor, tom, icone, sub }) {
  const T = useTema();
  const cor = tom === "ok" ? T.green : tom === "alerta" ? T.gold : tom === "risco" ? T.red : T.ink;
  return (
    <div style={{ background: T.bg, border: `1px solid ${T.line}`, borderRadius: 10, padding: "10px 12px" }}>
      <div style={{ fontSize: 10.5, color: T.sub, textTransform: "uppercase", letterSpacing: 0.3, display: "flex", gap: 5, alignItems: "center" }}>
        <span style={{ opacity: 0.8 }}>{icone}</span>{rotulo}
      </div>
      <div className="num disp" style={{ fontSize: 21, fontWeight: 800, color: cor, marginTop: 3 }}>{valor}</div>
      {sub && <div style={{ fontSize: 10.5, color: T.sub, marginTop: 1 }}>{sub}</div>}
    </div>
  );
}

// Selo de categoria operacional (demo/teste/real/individual).
function SeloCategoria({ escola }) {
  const cat = categoriaEscola(escola);
  return <StatusBadge tom={cat.tom}>{cat.icone} {cat.rotulo}</StatusBadge>;
}

/* ---------- Lista de escolas ---------- */
function ListaEscolas({ lista, aoAbrir }) {
  const T = useTema();
  const { input: inputS, label: lbl } = useInputStyle();
  const uid = useId();
  const fid = (k) => `${uid}-${k}`;
  const [busca, setBusca] = useState("");
  const [fStatus, setFStatus] = useState("");
  const [fPlano, setFPlano] = useState("");
  const [fCategoria, setFCategoria] = useState("");
  const [ordem, setOrdem] = useState("nome");

  const planos = useMemo(() => [...new Set(lista.map((e) => e.plano).filter(Boolean))].sort(), [lista]);

  const filtrada = useMemo(() => {
    const q = busca.trim().toLowerCase();
    let r = lista.filter((e) => {
      const txt = `${e.nome} ${e.slug} ${e.cidade ?? ""}`.toLowerCase();
      return (!q || txt.includes(q)) && (!fStatus || e.status === fStatus) && (!fPlano || e.plano === fPlano)
        && (!fCategoria || categoriaEscola(e).chave === fCategoria);
    });
    const por = {
      nome: (a, b) => a.nome.localeCompare(b.nome),
      alunos: (a, b) => Number(b.alunos) - Number(a.alunos),
      recente: (a, b) => new Date(b.ultimo_acesso || 0) - new Date(a.ultimo_acesso || 0),
    };
    return [...r].sort(por[ordem] ?? por.nome);
  }, [lista, busca, fStatus, fPlano, ordem]);

  const selS = { ...inputS, minHeight: 42, fontSize: 13.5, padding: "9px 10px" };

  return (
    <SectionCard titulo="Escolas" sub={`${filtrada.length} de ${lista.length} · clique para ver detalhe e ações`} semPadding>
      <div style={{ padding: 12, borderBottom: `1px solid ${T.line}`, display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(150px,1fr))", gap: 10 }}>
        <div style={{ gridColumn: "1 / -1" }}>
          <input value={busca} onChange={(e) => setBusca(e.target.value)} placeholder="🔎 Buscar por nome, slug ou cidade" aria-label="Buscar escola por nome, slug ou cidade" style={inputS} />
        </div>
        <div>
          <label htmlFor={fid("status")} style={lbl}>Status</label>
          <select id={fid("status")} value={fStatus} onChange={(e) => setFStatus(e.target.value)} style={selS}>
            <option value="">Todos</option>
            {Object.entries(STATUS).map(([k, v]) => <option key={k} value={k}>{v.rotulo}</option>)}
          </select>
        </div>
        <div>
          <label htmlFor={fid("categoria")} style={lbl}>Categoria</label>
          <select id={fid("categoria")} value={fCategoria} onChange={(e) => setFCategoria(e.target.value)} style={selS}>
            <option value="">Todas</option>
            <option value="real">Escola real (B2B)</option>
            <option value="teste">Teste/Piloto</option>
            <option value="demo">Demonstração</option>
            <option value="individual">Individual/B2C</option>
          </select>
        </div>
        <div>
          <label htmlFor={fid("plano")} style={lbl}>Plano</label>
          <select id={fid("plano")} value={fPlano} onChange={(e) => setFPlano(e.target.value)} style={selS}>
            <option value="">Todos</option>
            {planos.map((p) => <option key={p} value={p}>{p}</option>)}
          </select>
        </div>
        <div>
          <label htmlFor={fid("ordem")} style={lbl}>Ordenar por</label>
          <select id={fid("ordem")} value={ordem} onChange={(e) => setOrdem(e.target.value)} style={selS}>
            <option value="nome">Nome (A–Z)</option>
            <option value="alunos">Mais alunos</option>
            <option value="recente">Acesso recente</option>
          </select>
        </div>
      </div>

      {filtrada.length === 0 ? (
        <div style={{ padding: 8 }}><EmptyState icone="🏫" titulo="Nenhuma escola encontrada" dica="Ajuste a busca/filtros ou crie a primeira no formulário acima." /></div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column" }}>
          {filtrada.map((e, i) => {
            const semCoord = Number(e.coordenadores) === 0;
            const sev = severidadeMaxima(avisosRisco(e, null));
            return (
              <button key={e.escola_id} className="row" onClick={() => aoAbrir(e.escola_id)}
                style={{ display: "flex", alignItems: "center", gap: 12, padding: "12px 15px", borderBottom: i === filtrada.length - 1 ? "none" : `1px solid ${T.line}`, flexWrap: "wrap", width: "100%", textAlign: "left", border: "none", background: "transparent", color: T.ink }}>
                <span style={{ width: 8, height: 8, borderRadius: "50%", flexShrink: 0, background: sev === "risco" ? T.red : sev === "alerta" ? T.gold : T.green }} title={sev === "ok" ? "sem pendências" : `${sev} aberto`} />
                <div style={{ flex: 1, minWidth: 180 }}>
                  <div style={{ fontSize: 14.5, fontWeight: 700, display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
                    {e.nome}
                    <SeloCategoria escola={e} />
                    <StatusBadge tom={STATUS[e.status]?.tom ?? "neutro"}>{rotuloStatus(e.status)}</StatusBadge>
                    {semCoord && <StatusBadge tom="risco">sem coordenador</StatusBadge>}
                  </div>
                  <div style={{ fontSize: 11.5, color: T.sub, marginTop: 2 }}>
                    /{e.slug}{e.cidade ? ` · ${e.cidade}${e.uf ? "/" + e.uf : ""}` : ""}{e.plano ? ` · ${e.plano}` : ""} · último acesso {fmtData(e.ultimo_acesso)}
                  </div>
                </div>
                <div className="num" style={{ display: "flex", gap: 16, fontSize: 12, color: T.sub, textAlign: "right" }}>
                  <span><b style={{ color: T.ink, fontSize: 15 }}>{Number(e.alunos)}</b><br />alunos</span>
                  <span><b style={{ color: T.ink, fontSize: 15 }}>{Number(e.turmas)}</b><br />turmas</span>
                  <span><b style={{ color: semCoord ? T.red : T.ink, fontSize: 15 }}>{Number(e.coordenadores)}</b><br />coord.</span>
                </div>
                <span style={{ color: T.gold, fontWeight: 700, flexShrink: 0 }}>›</span>
              </button>
            );
          })}
        </div>
      )}
    </SectionCard>
  );
}

/* ---------- Criar escola (blocos A + B + C) ---------- */
function NovaEscola({ aoCriar }) {
  const { input: inputS, label: lbl } = useInputStyle();
  const T = useTema();
  const uid = useId();
  const fid = (k) => `${uid}-${k}`;
  const [aberto, setAberto] = useState(false);
  const [f, setF] = useState({
    // Bloco A — dados da escola
    nome: "", slug: "", cidade: "", uf: "", plano: "", limite: "", statusInicial: "implantacao",
    corAcento: "", logoUrl: "", observacao: "",
    // Bloco B — contato administrativo
    emailInstitucional: "", telefoneContato: "", contatoNome: "", contatoObservacao: "",
    // Bloco C — acesso da coordenação
    opcaoCoord: "depois", coordNome: "", coordEmail: "",
  });
  const [erro, setErro] = useState(null);
  const [ok, setOk] = useState(null);
  const [ocupado, setOcupado] = useState(false);
  const set = (k, v) => setF((a) => ({ ...a, [k]: v }));

  const slugValido = /^[a-z0-9-]{2,40}$/.test(f.slug);
  const ufValido = f.uf === "" || /^[A-Za-z]{2}$/.test(f.uf);
  const corValida = f.corAcento === "" || /^#[0-9a-fA-F]{6}$/.test(f.corAcento);
  const emailInstValido = f.emailInstitucional === "" || /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(f.emailInstitucional);
  const emailCoordValido = f.coordEmail === "" || /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(f.coordEmail);
  const coordCompleto = f.opcaoCoord !== "criar" || (f.coordNome.trim().length >= 2 && emailCoordValido && f.coordEmail.trim().length > 0);
  const pronto = nomeValido(f.nome) && slugValido && ufValido && corValida && emailInstValido && coordCompleto && !ocupado;

  async function criar() {
    if (!pronto) return;
    setOcupado(true); setErro(null); setOk(null);
    try {
      const escolaId = await db.backofficeCriarEscola({
        nome: limparNome(f.nome), slug: f.slug.trim().toLowerCase(),
        cidade: f.cidade.trim() || null, uf: f.uf.trim().toUpperCase() || null,
        plano: f.plano.trim() || null, limiteAlunos: f.limite ? +f.limite : null,
        statusInicial: f.statusInicial || null,
        emailInstitucional: f.emailInstitucional.trim() || null,
        telefoneContato: f.telefoneContato.trim() || null,
        contatoNome: f.contatoNome.trim() || null,
        contatoObservacao: f.contatoObservacao.trim() || null,
      });

      let msgCoord = "";
      if (f.opcaoCoord === "criar" && f.coordEmail.trim()) {
        const r = await db.backofficeProvisionarCoordenador({
          escolaId, nome: f.coordNome.trim(), email: f.coordEmail.trim().toLowerCase(),
        });
        msgCoord = r.link
          ? " Coordenador criado e link de acesso gerado."
          : " Coordenador criado. Configure o SMTP no Supabase para envio automático.";
      }

      setOk(`Escola "${limparNome(f.nome)}" criada com sucesso.${msgCoord}`);
      setF({ nome: "", slug: "", cidade: "", uf: "", plano: "", limite: "", statusInicial: "implantacao",
             corAcento: "", logoUrl: "", observacao: "",
             emailInstitucional: "", telefoneContato: "", contatoNome: "", contatoObservacao: "",
             opcaoCoord: "depois", coordNome: "", coordEmail: "" });
      aoCriar?.();
      setTimeout(() => { setAberto(false); setOk(null); }, 2000);
    } catch (e) { setErro(mensagemAmigavel(e, "salvar")); }
    setOcupado(false);
  }

  const selS = { ...inputS, minHeight: 42, fontSize: 13.5, padding: "9px 10px" };

  if (!aberto) {
    return (
      <SectionCard titulo="Criar escola" sub="Cadastra escola, contato administrativo e provisionamento de coordenador."
        acao={<BotaoMini destaque onClick={() => setAberto(true)}>+ Nova escola</BotaoMini>}>
        <div style={{ fontSize: 12.5, color: T.sub }}>Abra o formulário para cadastrar uma nova escola.</div>
      </SectionCard>
    );
  }

  return (
    <SectionCard titulo="Criar escola" sub="Preencha os blocos abaixo. A escola nasce em implantação por padrão."
      acao={<BotaoMini onClick={() => setAberto(false)}>Cancelar</BotaoMini>}>

      {/* ── Bloco A — Dados da escola ── */}
      <BlocoLabel titulo="Bloco A — Dados da escola" />
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(150px,1fr))", gap: 12, marginBottom: 18 }}>
        <div style={{ gridColumn: "1 / -1" }}>
          <label htmlFor={fid("nome")} style={lbl}>Nome de exibição *</label>
          <input id={fid("nome")} value={f.nome} onChange={(e) => set("nome", e.target.value)} placeholder="ex: Colégio Vitrine Naval" style={inputS} />
        </div>
        <div>
          <label htmlFor={fid("slug")} style={lbl}>Slug (URL) *</label>
          <input id={fid("slug")} value={f.slug} onChange={(e) => set("slug", e.target.value.toLowerCase())} placeholder="vitrine"
            aria-invalid={f.slug && !slugValido ? true : undefined}
            style={{ ...inputS, borderColor: f.slug && !slugValido ? T.red : T.line, fontFamily: "monospace" }} />
          {f.slug && !slugValido && <div style={{ fontSize: 11, color: T.red, marginTop: 3 }}>2–40 chars, minúsculas, números e hífen.</div>}
        </div>
        <div>
          <label htmlFor={fid("status")} style={lbl}>Status inicial</label>
          <select id={fid("status")} value={f.statusInicial} onChange={(e) => set("statusInicial", e.target.value)} style={selS}>
            {Object.entries(STATUS).map(([k, v]) => <option key={k} value={k}>{v.rotulo}</option>)}
          </select>
        </div>
        <div>
          <label htmlFor={fid("plano")} style={lbl}>Plano</label>
          <input id={fid("plano")} value={f.plano} onChange={(e) => set("plano", e.target.value)} placeholder="ex: padrão" style={inputS} />
        </div>
        <div>
          <label htmlFor={fid("limite")} style={lbl}>Limite de alunos</label>
          <input id={fid("limite")} type="number" min="0" inputMode="numeric" value={f.limite} onChange={(e) => set("limite", e.target.value)} placeholder="opcional" style={inputS} />
        </div>
        <div>
          <label htmlFor={fid("cidade")} style={lbl}>Cidade</label>
          <input id={fid("cidade")} value={f.cidade} onChange={(e) => set("cidade", e.target.value)} style={inputS} />
        </div>
        <div>
          <label htmlFor={fid("uf")} style={lbl}>UF</label>
          <input id={fid("uf")} value={f.uf} onChange={(e) => set("uf", e.target.value.toUpperCase().slice(0, 2))} placeholder="RJ"
            aria-invalid={!ufValido ? true : undefined}
            style={{ ...inputS, borderColor: !ufValido ? T.red : T.line }} />
        </div>
        <div>
          <label htmlFor={fid("cor")} style={lbl}>Cor de acento</label>
          <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
            <input id={fid("cor")} value={f.corAcento} onChange={(e) => set("corAcento", e.target.value)} placeholder="#CDA349"
              aria-invalid={!corValida ? true : undefined}
              style={{ ...inputS, borderColor: corValida ? T.line : T.red, fontFamily: "monospace" }} />
            <span style={{ width: 38, height: 38, flexShrink: 0, borderRadius: 8, border: `1px solid ${T.line}`, background: corValida && f.corAcento ? f.corAcento : T.bg }} />
          </div>
        </div>
        <div style={{ gridColumn: "1 / -1" }}>
          <label htmlFor={fid("logo")} style={lbl}>Logo (URL)</label>
          <input id={fid("logo")} value={f.logoUrl} onChange={(e) => set("logoUrl", e.target.value)} placeholder="https://…" style={inputS} />
        </div>
        <div style={{ gridColumn: "1 / -1" }}>
          <label htmlFor={fid("obs")} style={lbl}>Observação interna (não aparece para a escola)</label>
          <textarea id={fid("obs")} value={f.observacao} onChange={(e) => set("observacao", e.target.value)} rows={2} style={{ ...inputS, minHeight: 56, resize: "vertical" }} />
        </div>
      </div>

      {/* ── Bloco B — Contato administrativo ── */}
      <BlocoLabel titulo="Bloco B — Contato administrativo" />
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(150px,1fr))", gap: 12, marginBottom: 18 }}>
        <div style={{ gridColumn: "1 / -1" }}>
          <label htmlFor={fid("contatoNome")} style={lbl}>Nome do responsável administrativo</label>
          <input id={fid("contatoNome")} value={f.contatoNome} onChange={(e) => set("contatoNome", e.target.value)} placeholder="ex: João Diretor" style={inputS} />
        </div>
        <div style={{ gridColumn: "1 / -1" }}>
          <label htmlFor={fid("emailInst")} style={lbl}>E-mail institucional da escola</label>
          <input id={fid("emailInst")} type="email" value={f.emailInstitucional} onChange={(e) => set("emailInstitucional", e.target.value)} placeholder="escola@dominio.com.br"
            aria-invalid={f.emailInstitucional && !emailInstValido ? true : undefined}
            style={{ ...inputS, borderColor: f.emailInstitucional && !emailInstValido ? T.red : T.line }} />
        </div>
        <div style={{ gridColumn: "1 / -1" }}>
          <label htmlFor={fid("tel")} style={lbl}>Telefone / WhatsApp</label>
          <input id={fid("tel")} value={f.telefoneContato} onChange={(e) => set("telefoneContato", e.target.value)} placeholder="(21) 9xxxx-xxxx" style={inputS} />
        </div>
        <div style={{ gridColumn: "1 / -1" }}>
          <label htmlFor={fid("contatoObs")} style={lbl}>Observação de contato</label>
          <textarea id={fid("contatoObs")} value={f.contatoObservacao} onChange={(e) => set("contatoObservacao", e.target.value)} rows={2} style={{ ...inputS, minHeight: 52, resize: "vertical" }} />
        </div>
      </div>

      {/* ── Bloco C — Acesso da coordenação ── */}
      <BlocoLabel titulo="Bloco C — Acesso da coordenação" />
      <div style={{ display: "flex", flexDirection: "column", gap: 10, marginBottom: 18 }}>
        {[
          ["depois", "Deixar para depois", "Escola criada sem coordenador (checklist fica pendente)"],
          ["criar",  "Criar coordenador agora", "Cria conta e envia link de definição de senha"],
        ].map(([v, titulo, desc]) => {
          const on = f.opcaoCoord === v;
          return (
            <button key={v} type="button" onClick={() => set("opcaoCoord", v)}
              style={{ textAlign: "left", border: `1px solid ${on ? T.gold : T.line}`, background: on ? `${T.gold}12` : T.bg, color: T.ink, borderRadius: 10, padding: "12px 14px" }}>
              <div style={{ fontWeight: 700, fontSize: 13.5 }}>{titulo}</div>
              <div style={{ fontSize: 12, color: T.sub, marginTop: 2 }}>{desc}</div>
            </button>
          );
        })}
        {f.opcaoCoord === "criar" && (
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(150px,1fr))", gap: 12, padding: "12px", background: T.bg, border: `1px solid ${T.line}`, borderRadius: 10 }}>
            <div style={{ gridColumn: "1 / -1" }}>
              <label htmlFor={fid("coordNome")} style={lbl}>Nome do coordenador *</label>
              <input id={fid("coordNome")} value={f.coordNome} onChange={(e) => set("coordNome", e.target.value)} placeholder="ex: Maria Coordenadora" style={inputS} />
            </div>
            <div style={{ gridColumn: "1 / -1" }}>
              <label htmlFor={fid("coordEmail")} style={lbl}>E-mail do coordenador *</label>
              <input id={fid("coordEmail")} type="email" value={f.coordEmail} onChange={(e) => set("coordEmail", e.target.value)} placeholder="coord@escola.com.br"
                aria-invalid={f.coordEmail && !emailCoordValido ? true : undefined}
                style={{ ...inputS, borderColor: f.coordEmail && !emailCoordValido ? T.red : T.line }} />
              <div style={{ fontSize: 11, color: T.sub, marginTop: 4 }}>
                Um link para definir a senha será enviado para este e-mail. Senha nunca é exposta.
              </div>
            </div>
          </div>
        )}
      </div>

      {ok && <div style={{ fontSize: 13, color: T.green, background: `${T.green}14`, border: `1px solid ${T.green}44`, borderRadius: 8, padding: "10px 12px", marginBottom: 10 }}>{ok}</div>}
      <Botao onClick={criar} disabled={!pronto} style={{ marginTop: 4 }}>{ocupado ? "Criando…" : "+ Criar escola"}</Botao>
      <Erro>{erro}</Erro>
    </SectionCard>
  );
}

function BlocoLabel({ titulo }) {
  const T = useTema();
  return (
    <div style={{ fontSize: 11, fontWeight: 800, color: T.gold, textTransform: "uppercase", letterSpacing: 0.8, borderBottom: `1px solid ${T.line}`, paddingBottom: 6, marginBottom: 10 }}>
      {titulo}
    </div>
  );
}

/* ---------- Atividade administrativa (logs globais, com filtros) ---------- */
function AtividadeAdmin({ logs, nomePorEscola }) {
  const T = useTema();
  const { input: inputS, label: lbl } = useInputStyle();
  const uid = useId();
  const fid = (k) => `${uid}-${k}`;
  const todas = logs ?? [];
  const [busca, setBusca] = useState("");
  const [fAcao, setFAcao] = useState("");
  const [fEscola, setFEscola] = useState("");
  const [fPeriodo, setFPeriodo] = useState(0);

  const acoes = useMemo(() => acoesPresentes(todas), [todas]);
  const escolasComLog = useMemo(
    () => [...new Set(todas.map((l) => l.escola_id).filter(Boolean))]
      .map((id) => [id, nomePorEscola[id] ?? "escola"]).sort((a, b) => a[1].localeCompare(b[1])),
    [todas, nomePorEscola]);

  const lista = useMemo(
    () => filtrarLogs(todas, { busca, acao: fAcao, escolaId: fEscola, periodoDias: +fPeriodo, nomePorEscola }),
    [todas, busca, fAcao, fEscola, fPeriodo, nomePorEscola]);

  const selS = { ...inputS, minHeight: 42, fontSize: 13.5, padding: "9px 10px" };

  return (
    <SectionCard titulo="Logs administrativos" sub={`${lista.length} de ${todas.length} · trilha de auditoria (admin_logs) — filtre por escola, ação ou período.`} semPadding>
      <div style={{ padding: 12, borderBottom: `1px solid ${T.line}`, display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(150px,1fr))", gap: 10 }}>
        <div style={{ gridColumn: "1 / -1" }}>
          <input value={busca} onChange={(e) => setBusca(e.target.value)} placeholder="🔎 Buscar por ação, escola, nome ou e-mail" aria-label="Buscar logs por ação, escola, nome ou e-mail" style={inputS} />
        </div>
        <div>
          <label htmlFor={fid("acao")} style={lbl}>Ação</label>
          <select id={fid("acao")} value={fAcao} onChange={(e) => setFAcao(e.target.value)} style={selS}>
            <option value="">Todas</option>
            {acoes.map((a) => <option key={a} value={a}>{rotuloAcao(a)}</option>)}
          </select>
        </div>
        <div>
          <label htmlFor={fid("escola")} style={lbl}>Escola</label>
          <select id={fid("escola")} value={fEscola} onChange={(e) => setFEscola(e.target.value)} style={selS}>
            <option value="">Todas</option>
            {escolasComLog.map(([id, nome]) => <option key={id} value={id}>{nome}</option>)}
          </select>
        </div>
        <div>
          <label htmlFor={fid("periodo")} style={lbl}>Período</label>
          <select id={fid("periodo")} value={fPeriodo} onChange={(e) => setFPeriodo(+e.target.value)} style={selS}>
            <option value={0}>Todo o histórico</option>
            <option value={1}>Últimas 24h</option>
            <option value={7}>Últimos 7 dias</option>
            <option value={30}>Últimos 30 dias</option>
            <option value={90}>Últimos 90 dias</option>
          </select>
        </div>
      </div>

      {lista.length === 0 ? (
        <div style={{ padding: 8 }}><EmptyState icone="🗒️" titulo="Nenhum log para o filtro" dica="Ajuste a busca/filtros — ou as ações do backoffice aparecem aqui assim que ocorrerem." /></div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column" }}>
          {lista.map((l, i) => (
            <div key={i} style={{ display: "flex", alignItems: "center", gap: 10, padding: "10px 15px", borderBottom: i === lista.length - 1 ? "none" : `1px solid ${T.line}`, fontSize: 12.5 }}>
              <span style={{ flex: 1, minWidth: 0, color: T.ink }}>
                <b>{rotuloAcao(l.acao)}</b>
                {l.escola_id && <span style={{ color: T.sub }}> · {nomePorEscola[l.escola_id] ?? l.detalhe?.nome ?? "escola"}</span>}
                <ResumoDetalhe acao={l.acao} detalhe={l.detalhe} />
              </span>
              <span className="num" style={{ color: T.sub, flexShrink: 0 }}>{fmtData(l.em)}</span>
            </div>
          ))}
        </div>
      )}
    </SectionCard>
  );
}

const ACOES = {
  "criar-escola": "Escola criada", "editar-escola": "Escola editada",
  "suspender-escola": "Escola suspensa", "ativar-escola": "Escola ativada",
  "alterar-status-escola": "Status alterado",
  "vincular-coordenador": "Coordenador vinculado",
  "reenviar-acesso": "Acesso reenviado",
};
const rotuloAcao = (a) => ACOES[a] ?? a;

function ResumoDetalhe({ acao, detalhe }) {
  const T = useTema();
  if (!detalhe) return null;
  if (acao === "alterar-status-escola" || acao === "suspender-escola" || acao === "ativar-escola") {
    if (detalhe.de && detalhe.para) return <span style={{ color: T.sub }}> · {rotuloStatus(detalhe.de)} → {rotuloStatus(detalhe.para)}</span>;
  }
  if (acao === "editar-escola" && detalhe.antes && detalhe.depois) {
    const campos = ["nome", "plano", "cidade", "uf", "limite_alunos", "cor_acento", "logo_url",
                    "observacao", "email_institucional", "telefone_contato", "contato_nome"];
    const mudou = campos.filter((c) => detalhe.antes[c] !== detalhe.depois[c]);
    if (mudou.length) return <span style={{ color: T.sub }}> · alterou {mudou.join(", ")}</span>;
  }
  if ((acao === "vincular-coordenador" || acao === "reenviar-acesso") && detalhe.email) {
    return <span style={{ color: T.sub }}> · {detalhe.nome ?? ""} ({detalhe.email})</span>;
  }
  return null;
}

/* ---------- Detalhe da escola + ações ---------- */
function DetalheEscola({ escolaId, aoVoltar, aoMudar }) {
  const T = useTema();
  const { dados: d, carregando, erro, recarregar } = useRecurso(() => db.backofficeDetalheEscola(escolaId), [escolaId]);
  const { dados: logs, recarregar: recLogs } = useRecurso(() => db.backofficeLogs(60), []);
  const [editando, setEditando] = useState(false);

  if (carregando) return <CarregandoBloco titulo="Carregando escola…" cartoes={3} linhas={5} />;
  if (erro) return <><BotaoVoltar aoVoltar={aoVoltar} /><Erro>{erro}</Erro></>;
  const e = d.escola ?? {};
  const logsEscola = (logs ?? []).filter((l) => l.escola_id === escolaId);
  const recarregarLocal = () => { recarregar(); recLogs(); aoMudar?.(); };

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
      <BotaoVoltar aoVoltar={aoVoltar} />

      <SectionCard
        titulo={<span style={{ display: "inline-flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>{e.nome} <SeloCategoria escola={e} /> <StatusBadge tom={STATUS[e.status]?.tom ?? "neutro"}>{rotuloStatus(e.status)}</StatusBadge></span>}
        sub={`/${e.slug}${e.cidade ? ` · ${e.cidade}${e.uf ? "/" + e.uf : ""}` : ""}`}
        acao={<BotaoMini destaque onClick={() => setEditando((v) => !v)}>{editando ? "Fechar edição" : "✎ Editar"}</BotaoMini>}>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(130px,1fr))", gap: 10 }}>
          <StatCard rotulo="Status" valor={rotuloStatus(e.status)} tom={STATUS[e.status]?.tom} icone="◷" />
          <StatCard rotulo="Plano" valor={e.plano || "—"} icone="◆" />
          <StatCard rotulo="Alunos" valor={Number(d.alunos)} sub={e.limite_alunos ? `limite ${e.limite_alunos}` : null} icone="👥" />
          <StatCard rotulo="Turmas" valor={d.turmas?.length ?? 0} icone="🏷️" />
        </div>
        <div style={{ marginTop: 12, display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(200px,1fr))", gap: 8, fontSize: 12.5, color: T.sub }}>
          {e.contato_nome && <InfoLinha rotulo="Responsável administrativo" valor={e.contato_nome} />}
          {e.email_institucional && <InfoLinha rotulo="E-mail institucional" valor={e.email_institucional} href={`mailto:${e.email_institucional}`} />}
          {e.telefone_contato && <InfoLinha rotulo="Telefone/WhatsApp" valor={e.telefone_contato} />}
          <InfoLinha rotulo="Cor de acento" valor={e.cor_acento ?? "—"} swatch={e.cor_acento} />
          {e.logo_url && <InfoLinha rotulo="Logo" valor="ver imagem ↗" href={e.logo_url} />}
        </div>
        {e.observacao && <div style={{ marginTop: 10, fontSize: 12.5, color: T.sub, background: T.bg, border: `1px solid ${T.line}`, borderRadius: 8, padding: "8px 10px", lineHeight: 1.5 }}><b style={{ color: T.ink }}>Obs. interna:</b> {e.observacao}</div>}
        {e.contato_observacao && <div style={{ marginTop: 8, fontSize: 12.5, color: T.sub, background: T.bg, border: `1px solid ${T.line}`, borderRadius: 8, padding: "8px 10px", lineHeight: 1.5 }}><b style={{ color: T.ink }}>Obs. de contato:</b> {e.contato_observacao}</div>}
      </SectionCard>

      {editando && <EditarEscola escola={e} aoSalvar={() => { setEditando(false); recarregarLocal(); }} />}

      <AvisosRisco escola={e} d={d} />

      <AcoesStatus escola={e} aoMudar={recarregarLocal} />

      <ChecklistGoLive d={d} />

      <Coordenadores d={d} escolaId={escolaId} aoMudar={recarregarLocal} />

      <Modalidades escola={e} />

      <SectionCard titulo="Atividade desta escola" sub="Últimas ações administrativas sobre esta escola." semPadding>
        {logsEscola.length === 0 ? (
          <div style={{ padding: 8 }}><EmptyState icone="🗒️" titulo="Sem ações registradas" dica="Editar, suspender ou ativar a escola registra aqui." /></div>
        ) : (
          <div style={{ display: "flex", flexDirection: "column" }}>
            {logsEscola.map((l, i) => (
              <div key={i} style={{ display: "flex", alignItems: "center", gap: 10, padding: "10px 15px", borderBottom: i === logsEscola.length - 1 ? "none" : `1px solid ${T.line}`, fontSize: 12.5 }}>
                <span style={{ flex: 1, minWidth: 0, color: T.ink }}><b>{rotuloAcao(l.acao)}</b><ResumoDetalhe acao={l.acao} detalhe={l.detalhe} /></span>
                <span className="num" style={{ color: T.sub, flexShrink: 0 }}>{fmtData(l.em)}</span>
              </div>
            ))}
          </div>
        )}
      </SectionCard>
    </div>
  );
}

function InfoLinha({ rotulo, valor, href, swatch }) {
  const T = useTema();
  return (
    <div>
      <span style={{ color: T.sub }}>{rotulo}: </span>
      {href
        ? <a href={href} target="_blank" rel="noreferrer" style={{ color: T.gold }}>{valor}</a>
        : <span style={{ color: T.ink, display: "inline-flex", alignItems: "center", gap: 6 }}>
            {swatch && <span style={{ width: 13, height: 13, borderRadius: 3, background: swatch, border: `1px solid ${T.line}`, display: "inline-block" }} />}
            {valor}
          </span>}
    </div>
  );
}

/* ---------- Editar escola (com campos de contato) ---------- */
function EditarEscola({ escola, aoSalvar }) {
  const { input: inputS, label: lbl } = useInputStyle();
  const T = useTema();
  const uid = useId();
  const fid = (k) => `${uid}-${k}`;
  const [f, setF] = useState({
    nome: escola.nome ?? "", plano: escola.plano ?? "", cidade: escola.cidade ?? "", uf: escola.uf ?? "",
    corAcento: escola.cor_acento ?? "", logoUrl: escola.logo_url ?? "", limite: escola.limite_alunos ?? "",
    observacao: escola.observacao ?? "",
    emailInstitucional: escola.email_institucional ?? "", telefoneContato: escola.telefone_contato ?? "",
    contatoNome: escola.contato_nome ?? "", contatoObservacao: escola.contato_observacao ?? "",
  });
  const [erro, setErro] = useState(null);
  const [ocupado, setOcupado] = useState(false);
  const set = (k, v) => setF((a) => ({ ...a, [k]: v }));

  const corValida = f.corAcento === "" || /^#[0-9a-fA-F]{6}$/.test(f.corAcento);
  const ufValido = f.uf === "" || /^[A-Za-z]{2}$/.test(f.uf);
  const emailInstValido = f.emailInstitucional === "" || /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(f.emailInstitucional);
  const pronto = nomeValido(f.nome) && corValida && ufValido && emailInstValido && !ocupado;

  async function salvar() {
    if (!pronto) return;
    setOcupado(true); setErro(null);
    try {
      await db.backofficeEditarEscola(escola.id, {
        nome: limparNome(f.nome), plano: f.plano.trim() || null,
        cidade: f.cidade.trim() || null, uf: f.uf.trim().toUpperCase() || null,
        corAcento: f.corAcento.trim() || null, logoUrl: f.logoUrl.trim() || null,
        limiteAlunos: f.limite === "" ? null : +f.limite,
        observacao: f.observacao.trim() || null,
        emailInstitucional: f.emailInstitucional.trim() || null,
        telefoneContato: f.telefoneContato.trim() || null,
        contatoNome: f.contatoNome.trim() || null,
        contatoObservacao: f.contatoObservacao.trim() || null,
      });
      aoSalvar?.();
    } catch (ex) { setErro(mensagemAmigavel(ex, "salvar")); }
    setOcupado(false);
  }

  return (
    <SectionCard titulo="Editar dados da escola" sub="Em branco = mantém o valor atual. Toda alteração fica registrada na auditoria.">
      <BlocoLabel titulo="Dados da escola" />
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(150px,1fr))", gap: 12, marginBottom: 16 }}>
        <div style={{ gridColumn: "1 / -1" }}><label htmlFor={fid("nome")} style={lbl}>Nome de exibição</label><input id={fid("nome")} value={f.nome} onChange={(e) => set("nome", e.target.value)} style={inputS} /></div>
        <div><label htmlFor={fid("plano")} style={lbl}>Plano</label><input id={fid("plano")} value={f.plano} onChange={(e) => set("plano", e.target.value)} placeholder="ex: padrão" style={inputS} /></div>
        <div><label htmlFor={fid("limite")} style={lbl}>Limite de alunos</label><input id={fid("limite")} type="number" min="0" inputMode="numeric" value={f.limite} onChange={(e) => set("limite", e.target.value)} style={inputS} /></div>
        <div><label htmlFor={fid("cidade")} style={lbl}>Cidade</label><input id={fid("cidade")} value={f.cidade} onChange={(e) => set("cidade", e.target.value)} style={inputS} /></div>
        <div><label htmlFor={fid("uf")} style={lbl}>UF</label><input id={fid("uf")} value={f.uf} onChange={(e) => set("uf", e.target.value.toUpperCase().slice(0, 2))} aria-invalid={ufValido ? undefined : true} style={{ ...inputS, borderColor: ufValido ? T.line : T.red }} /></div>
        <div>
          <label htmlFor={fid("cor")} style={lbl}>Cor de acento</label>
          <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
            <input id={fid("cor")} value={f.corAcento} onChange={(e) => set("corAcento", e.target.value)} placeholder="#CDA349" aria-invalid={corValida ? undefined : true} style={{ ...inputS, borderColor: corValida ? T.line : T.red, fontFamily: "monospace" }} />
            <span style={{ width: 38, height: 38, flexShrink: 0, borderRadius: 8, border: `1px solid ${T.line}`, background: corValida && f.corAcento ? f.corAcento : T.bg }} />
          </div>
        </div>
        <div style={{ gridColumn: "1 / -1" }}>
          <label htmlFor={fid("logo")} style={lbl}>Logo (URL)</label>
          <input id={fid("logo")} value={f.logoUrl} onChange={(e) => set("logoUrl", e.target.value)} placeholder="https://…" style={inputS} />
        </div>
        <div style={{ gridColumn: "1 / -1" }}>
          <label htmlFor={fid("obs")} style={lbl}>Observação interna</label>
          <textarea id={fid("obs")} value={f.observacao} onChange={(e) => set("observacao", e.target.value)} rows={2} style={{ ...inputS, minHeight: 56, resize: "vertical" }} />
        </div>
      </div>

      <BlocoLabel titulo="Contato administrativo" />
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(150px,1fr))", gap: 12, marginBottom: 8 }}>
        <div style={{ gridColumn: "1 / -1" }}><label htmlFor={fid("contatoNome")} style={lbl}>Nome do responsável administrativo</label><input id={fid("contatoNome")} value={f.contatoNome} onChange={(e) => set("contatoNome", e.target.value)} style={inputS} /></div>
        <div style={{ gridColumn: "1 / -1" }}>
          <label htmlFor={fid("emailInst")} style={lbl}>E-mail institucional</label>
          <input id={fid("emailInst")} type="email" value={f.emailInstitucional} onChange={(e) => set("emailInstitucional", e.target.value)}
            aria-invalid={f.emailInstitucional && !emailInstValido ? true : undefined}
            style={{ ...inputS, borderColor: f.emailInstitucional && !emailInstValido ? T.red : T.line }} />
        </div>
        <div style={{ gridColumn: "1 / -1" }}><label htmlFor={fid("tel")} style={lbl}>Telefone / WhatsApp</label><input id={fid("tel")} value={f.telefoneContato} onChange={(e) => set("telefoneContato", e.target.value)} style={inputS} /></div>
        <div style={{ gridColumn: "1 / -1" }}>
          <label htmlFor={fid("contatoObs")} style={lbl}>Observação de contato</label>
          <textarea id={fid("contatoObs")} value={f.contatoObservacao} onChange={(e) => set("contatoObservacao", e.target.value)} rows={2} style={{ ...inputS, minHeight: 52, resize: "vertical" }} />
        </div>
      </div>

      {!corValida && <div style={{ fontSize: 12, color: T.red, marginTop: 8 }}>Cor: use hexadecimal #RRGGBB (ex.: #CDA349).</div>}
      <Botao onClick={salvar} disabled={!pronto} style={{ marginTop: 14 }}>{ocupado ? "Salvando…" : "Salvar alterações"}</Botao>
      <Erro>{erro}</Erro>
    </SectionCard>
  );
}

/* ---------- Ações de status ---------- */
function AcoesStatus({ escola, aoMudar }) {
  const T = useTema();
  const [confirma, setConfirma] = useState(null);
  const [ocupado, setOcupado] = useState(false);
  const [erro, setErro] = useState(null);

  const op = operacional(escola.status);
  const acoes = [];
  if (!op) acoes.push({ status: "ativa", rotulo: "▶ Reativar escola", titulo: "Reativar escola", perigo: false, corpo: `A escola "${escola.nome}" volta a operar e a coordenação recupera o acesso ao painel.` });
  if (op && escola.status !== "ativa") acoes.push({ status: "ativa", rotulo: "✓ Ativar (status ativa)", titulo: "Ativar escola", perigo: false, corpo: `Marca "${escola.nome}" como ativa — o estado final de implantação.` });
  if (op) acoes.push({ status: "suspensa", rotulo: "⏸ Suspender escola", titulo: "Suspender escola", perigo: true, corpo: `A coordenação, alunos e responsáveis de "${escola.nome}" PERDEM o acesso ao painel até a reativação. O dado é preservado (ação reversível).` });
  if (escola.status !== "cancelada") acoes.push({ status: "cancelada", rotulo: "✕ Cancelar escola", titulo: "Cancelar escola", perigo: true, corpo: `Encerra o acesso de "${escola.nome}". Nenhum dado é apagado — é reversível, mas sinaliza desligamento.` });

  async function aplicar() {
    if (!confirma) return;
    setOcupado(true); setErro(null);
    try {
      await db.backofficeDefinirStatus(escola.id, confirma.status);
      setConfirma(null);
      aoMudar?.();
    } catch (ex) { setErro(mensagemAmigavel(ex, "acao")); }
    setOcupado(false);
  }

  return (
    <SectionCard titulo="Ações de operação" sub="Mudanças de status são reversíveis e ficam registradas na auditoria.">
      <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
        {acoes.map((a) => (
          <button key={a.status + a.rotulo} onClick={() => { setErro(null); setConfirma(a); }}
            style={{ border: `1px solid ${a.perigo ? T.red + "88" : T.line}`, background: a.perigo ? `${T.red}12` : "transparent", color: a.perigo ? T.red : T.gold, borderRadius: 9, fontSize: 13, fontWeight: 700, padding: "10px 16px", minHeight: 44 }}>
            {a.rotulo}
          </button>
        ))}
      </div>
      <Erro>{erro}</Erro>
      {confirma && (
        <ConfirmacaoModal
          titulo={confirma.titulo} corpo={confirma.corpo} perigo={confirma.perigo} ocupado={ocupado}
          rotuloConfirmar={confirma.perigo ? "Sim, confirmar" : "Confirmar"}
          aoConfirmar={aplicar} aoCancelar={() => !ocupado && setConfirma(null)} />
      )}
    </SectionCard>
  );
}

/* ---------- Modal de confirmação ---------- */
function ConfirmacaoModal({ titulo, corpo, perigo, ocupado, rotuloConfirmar = "Confirmar", aoConfirmar, aoCancelar }) {
  const T = useTema();
  return (
    <div onClick={aoCancelar} style={{ position: "fixed", inset: 0, zIndex: 50, background: "#0A1622cc", display: "flex", alignItems: "center", justifyContent: "center", padding: 18 }}>
      <div onClick={(ev) => ev.stopPropagation()} style={{ width: "100%", maxWidth: 420, background: T.bg2, border: `1px solid ${perigo ? T.red + "66" : T.line}`, borderRadius: 14, padding: 20, boxShadow: "0 18px 50px #0009" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 10 }}>
          <span style={{ fontSize: 10.5, fontWeight: 800, color: perigo ? T.red : T.gold, border: `1px solid ${(perigo ? T.red : T.gold)}66`, background: `${(perigo ? T.red : T.gold)}14`, borderRadius: 6, padding: "2px 8px", textTransform: "uppercase", letterSpacing: 0.4 }}>
            {perigo ? "Ação sensível" : "Ação reversível"}
          </span>
        </div>
        <div className="disp" style={{ fontSize: 17, fontWeight: 800, color: T.ink, marginBottom: 8 }}>{titulo}</div>
        <div style={{ fontSize: 13.5, color: T.sub, lineHeight: 1.55, marginBottom: 18 }}>{corpo}</div>
        <div style={{ display: "flex", gap: 10, justifyContent: "flex-end", flexWrap: "wrap" }}>
          <button onClick={aoCancelar} disabled={ocupado}
            style={{ border: `1px solid ${T.line}`, background: T.card, color: T.sub, borderRadius: 8, padding: "11px 18px", minHeight: 44, fontWeight: 700, fontSize: 14, opacity: ocupado ? 0.5 : 1 }}>
            Cancelar
          </button>
          <button onClick={aoConfirmar} disabled={ocupado}
            style={{ border: "none", background: ocupado ? T.line : (perigo ? T.red : T.gold), color: ocupado ? T.sub : "#0A1622", borderRadius: 8, padding: "11px 18px", minHeight: 44, fontWeight: 800, fontSize: 14 }}>
            {ocupado ? "Aplicando…" : rotuloConfirmar}
          </button>
        </div>
      </div>
    </div>
  );
}

/* ---------- Avisos de risco (ADM2 t.41) ---------- */
function AvisosRisco({ escola, d }) {
  const T = useTema();
  const avisos = useMemo(() => avisosRisco(escola, d), [escola, d]);
  if (avisos.length === 0) {
    return (
      <SectionCard titulo="Avisos de risco" sub="Nenhuma pendência crítica detectada nesta escola.">
        <div style={{ fontSize: 13, color: T.green, display: "flex", alignItems: "center", gap: 8 }}>
          <span>✓</span> Sem riscos ou alertas abertos.
        </div>
      </SectionCard>
    );
  }
  const tomDe = (n) => (n === "risco" ? T.red : n === "alerta" ? T.gold : T.sub);
  const rotuloNivel = { risco: "Risco", alerta: "Alerta", info: "Info" };
  return (
    <SectionCard titulo="Avisos de risco" sub={`${avisos.length} ponto(s) de atenção — riscos primeiro.`} semPadding>
      <div style={{ display: "flex", flexDirection: "column" }}>
        {[...avisos].sort((a, b) => severidadePeso(b.nivel) - severidadePeso(a.nivel)).map((a, i, arr) => (
          <div key={a.codigo} style={{ display: "flex", alignItems: "flex-start", gap: 11, padding: "11px 15px", borderBottom: i === arr.length - 1 ? "none" : `1px solid ${T.line}`, borderLeft: `3px solid ${tomDe(a.nivel)}` }}>
            <span style={{ flexShrink: 0, marginTop: 1, fontSize: 10.5, fontWeight: 800, color: tomDe(a.nivel), border: `1px solid ${tomDe(a.nivel)}66`, background: `${tomDe(a.nivel)}14`, borderRadius: 5, padding: "1px 6px", textTransform: "uppercase", letterSpacing: 0.3 }}>
              {rotuloNivel[a.nivel] ?? a.nivel}
            </span>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontSize: 13.5, fontWeight: 700, color: T.ink }}>{a.titulo}</div>
              {a.recomendacao && <div style={{ fontSize: 11.5, color: T.sub, marginTop: 2, lineHeight: 1.45 }}>{a.recomendacao}</div>}
            </div>
          </div>
        ))}
      </div>
    </SectionCard>
  );
}
const severidadePeso = (n) => (n === "risco" ? 3 : n === "alerta" ? 2 : n === "info" ? 1 : 0);

/* ---------- Checklist de GO-LIVE (ADM2 t.37 — dados reais + manuais) ---------- */
function ChecklistGoLive({ d }) {
  const T = useTema();
  const itens = useMemo(() => checklistGoLive(d), [d]);
  const resumo = useMemo(() => resumoChecklist(itens), [itens]);

  // agrupa por seção para a leitura ficar profissional
  const grupos = useMemo(() => {
    const g = {};
    for (const it of itens) (g[it.grupo] ??= []).push(it);
    return g;
  }, [itens]);

  const sub = resumo.prontoGoLive
    ? "Pronto para go-live — todos os itens críticos concluídos."
    : `${resumo.feitos}/${resumo.total} concluídos · ${resumo.criticosPendentes.length} crítico(s) pendente(s)`;

  return (
    <SectionCard
      titulo="Checklist de go-live"
      sub={sub}
      semPadding
      acao={<StatusBadge tom={resumo.prontoGoLive ? "ok" : resumo.criticosPendentes.length ? "risco" : "alerta"}>
        {resumo.prontoGoLive ? "✓ go-live" : "pendente"}
      </StatusBadge>}>
      <div style={{ display: "flex", flexDirection: "column" }}>
        {Object.entries(grupos).map(([grupo, lista]) => (
          <div key={grupo}>
            <div style={{ fontSize: 10.5, fontWeight: 800, color: T.gold, textTransform: "uppercase", letterSpacing: 0.6, padding: "9px 15px 4px", background: T.bg2 }}>{grupo}</div>
            {lista.map((x) => (
              <div key={x.chave} style={{ display: "flex", alignItems: "flex-start", gap: 11, padding: "10px 15px", borderTop: `1px solid ${T.line}` }}>
                <span style={{ width: 22, height: 22, borderRadius: "50%", flexShrink: 0, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 13, fontWeight: 800, background: x.ok ? `${T.green}22` : T.bg, color: x.ok ? T.green : T.sub, border: `1px solid ${x.ok ? T.green + "66" : T.line}` }}>
                  {x.ok ? "✓" : x.manual ? "◌" : "○"}
                </span>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 13.5, color: x.ok ? T.ink : T.sub, display: "flex", alignItems: "center", gap: 7, flexWrap: "wrap" }}>
                    {x.label}
                    {x.critico && !x.ok && <span style={{ fontSize: 9.5, fontWeight: 800, color: T.red, border: `1px solid ${T.red}66`, background: `${T.red}14`, borderRadius: 4, padding: "0 5px", textTransform: "uppercase" }}>crítico</span>}
                    {x.manual && <span style={{ fontSize: 9.5, fontWeight: 700, color: T.sub, border: `1px solid ${T.line}`, borderRadius: 4, padding: "0 5px", textTransform: "uppercase" }}>manual</span>}
                  </div>
                  {x.dica && <div style={{ fontSize: 11, color: T.sub, marginTop: 1, lineHeight: 1.4 }}>{x.dica}</div>}
                </div>
              </div>
            ))}
          </div>
        ))}
      </div>
      {resumo.manuaisTotal > 0 && (
        <div style={{ fontSize: 11.5, color: T.sub, padding: "10px 15px", borderTop: `1px solid ${T.line}`, lineHeight: 1.5, background: T.bg2 }}>
          ◌ itens <b>manuais</b> (backup, smoke, SMTP, termo) são confirmados pelo operador fora do sistema —
          ver <span style={{ color: T.gold }}>docs/operacao/checklist-go-live-escola.md</span>. Eles não fecham
          automaticamente para não dar falso "pronto".
        </div>
      )}
    </SectionCard>
  );
}

/* ---------- Modalidades habilitadas (ADM2 t.39 — placeholder controlado) ---------- */
function Modalidades({ escola }) {
  const T = useTema();
  const mods = useMemo(() => modalidadesDaEscola(escola), [escola]);
  return (
    <SectionCard titulo="Modalidades" sub="Roadmap de modalidades. Só 'concurso' está em produção — o resto é placeholder declarado (não habilita nada).">
      <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
        {mods.map((m) => {
          const est = ESTADO_MODALIDADE[m.estado] ?? { rotulo: m.estado, tom: "neutro" };
          return (
            <div key={m.codigo} style={{ display: "flex", alignItems: "center", gap: 10, padding: "10px 12px", background: T.bg, border: `1px solid ${T.line}`, borderRadius: 9, flexWrap: "wrap" }}>
              <div style={{ flex: 1, minWidth: 160 }}>
                <div style={{ fontSize: 13.5, fontWeight: 700, color: m.habilitada ? T.ink : T.sub }}>{m.rotulo}</div>
                <div style={{ fontSize: 11, color: T.sub, marginTop: 1 }}>{m.nota}</div>
              </div>
              <StatusBadge tom={est.tom}>{est.rotulo}</StatusBadge>
              <StatusBadge tom={m.habilitada ? "ok" : "neutro"}>{m.habilitada ? "habilitada" : "—"}</StatusBadge>
            </div>
          );
        })}
      </div>
      <div style={{ fontSize: 11, color: T.sub, marginTop: 10, lineHeight: 1.5 }}>
        Persistência por escola é diferida (exigiria migration). MOD0 completo está fora do escopo desta camada.
      </div>
    </SectionCard>
  );
}

/* ---------- Coordenadores — provisionamento completo pelo backoffice ---------- */
function Coordenadores({ d, escolaId, aoMudar }) {
  const T = useTema();
  const { input: inputS, label: lbl } = useInputStyle();
  const uid = useId();
  const fid = (k) => `${uid}-${k}`;
  const coords = d.coordenadores ?? [];
  const [criando, setCriando] = useState(false);
  const [f, setF] = useState({ nome: "", email: "" });
  const [ocupado, setOcupado] = useState(false);
  const [ok, setOk] = useState(null);
  const [erro, setErro] = useState(null);
  const set = (k, v) => setF((a) => ({ ...a, [k]: v }));

  const emailValido = f.email === "" || /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(f.email);
  const pronto = f.nome.trim().length >= 2 && emailValido && f.email.trim().length > 0 && !ocupado;

  async function provisionar() {
    if (!pronto) return;
    setOcupado(true); setErro(null); setOk(null);
    try {
      const r = await db.backofficeProvisionarCoordenador({
        escolaId, nome: f.nome.trim(), email: f.email.trim().toLowerCase(),
      });
      const msg = r.link
        ? "Coordenador criado. Um link de acesso/redefinição de senha foi enviado para o e-mail cadastrado."
        : "Coordenador criado. Configure o envio de e-mail no Supabase Auth para envio automático.";
      setOk(msg);
      setF({ nome: "", email: "" });
      setCriando(false);
      aoMudar?.();
    } catch (ex) { setErro(mensagemAmigavel(ex, "provisionar")); }
    setOcupado(false);
  }

  async function reenviar(coord) {
    setOcupado(true); setErro(null); setOk(null);
    try {
      await db.backofficeReenviarAcesso({ escolaId, usuarioId: coord.id, email: coord.email });
      setOk("Link de redefinição de senha enviado (ou agendado). Verifique o SMTP no Supabase Auth.");
    } catch (ex) { setErro(mensagemAmigavel(ex, "reenviar")); }
    setOcupado(false);
  }

  return (
    <SectionCard titulo="Coordenação"
      sub="Crie ou vincule o coordenador diretamente pelo backoffice — sem script manual."
      acao={!criando && <BotaoMini destaque onClick={() => { setCriando(true); setOk(null); setErro(null); }}>+ Criar coordenador</BotaoMini>}>

      {ok && <div style={{ fontSize: 13, color: T.green, background: `${T.green}14`, border: `1px solid ${T.green}44`, borderRadius: 8, padding: "10px 12px", marginBottom: 12 }}>{ok}</div>}

      {coords.length > 0 && (
        <div style={{ display: "flex", flexDirection: "column", gap: 10, marginBottom: criando ? 16 : 0 }}>
          {coords.map((c) => (
            <div key={c.id} style={{ display: "flex", alignItems: "center", gap: 12, padding: "12px 14px", background: T.bg, border: `1px solid ${T.line}`, borderRadius: 10, flexWrap: "wrap" }}>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 14, fontWeight: 700, color: T.ink, display: "flex", alignItems: "center", gap: 6 }}>
                  <span style={{ color: T.green, fontSize: 10 }}>●</span> {c.nome}
                </div>
                {c.email && <div style={{ fontSize: 12, color: T.sub, marginTop: 2 }}>{c.email}</div>}
                {!c.email && <div style={{ fontSize: 12, color: T.sub, marginTop: 2 }}>E-mail não registrado (re-provisione para atualizar)</div>}
              </div>
              {c.email && (
                <button onClick={() => reenviar(c)} disabled={ocupado}
                  style={{ border: `1px solid ${T.line}`, background: T.card, color: T.gold, borderRadius: 8, fontSize: 12.5, fontWeight: 700, padding: "8px 14px", minHeight: 38, opacity: ocupado ? 0.5 : 1 }}>
                  {ocupado ? "Enviando…" : "↻ Reenviar acesso"}
                </button>
              )}
            </div>
          ))}
        </div>
      )}

      {coords.length === 0 && !criando && (
        <EmptyState icone="🎓" titulo="Nenhum coordenador ainda"
          dica="Clique em '+ Criar coordenador' para provisionar o acesso pelo backoffice. Um link de definição de senha será enviado por e-mail." />
      )}

      {criando && (
        <div style={{ padding: 14, background: T.bg, border: `1px solid ${T.line}`, borderRadius: 10 }}>
          <div style={{ fontSize: 13, fontWeight: 700, color: T.ink, marginBottom: 12 }}>Novo coordenador</div>
          <div style={{ display: "grid", gap: 12 }}>
            <div>
              <label htmlFor={fid("nome")} style={lbl}>Nome *</label>
              <input id={fid("nome")} value={f.nome} onChange={(e) => set("nome", e.target.value)} placeholder="ex: Maria Coordenadora" style={inputS} />
            </div>
            <div>
              <label htmlFor={fid("email")} style={lbl}>E-mail *</label>
              <input id={fid("email")} type="email" value={f.email} onChange={(e) => set("email", e.target.value)} placeholder="coord@escola.com.br"
                aria-invalid={f.email && !emailValido ? true : undefined}
                style={{ ...inputS, borderColor: f.email && !emailValido ? T.red : T.line }} />
              <div style={{ fontSize: 11, color: T.sub, marginTop: 4 }}>
                Um link de definição de senha será enviado. Senha nunca é exibida nem registrada.
              </div>
            </div>
          </div>
          <div style={{ display: "flex", gap: 10, marginTop: 14 }}>
            <Botao onClick={provisionar} disabled={!pronto}>{ocupado ? "Criando…" : "Criar acesso"}</Botao>
            <button onClick={() => { setCriando(false); setErro(null); setF({ nome: "", email: "" }); }}
              style={{ border: `1px solid ${T.line}`, background: T.card, color: T.sub, borderRadius: 8, padding: "10px 18px", fontWeight: 600, fontSize: 13 }}>
              Cancelar
            </button>
          </div>
        </div>
      )}

      <Erro>{erro}</Erro>
    </SectionCard>
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
