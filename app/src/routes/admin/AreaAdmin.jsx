/* Backoffice interno (Fases 17.4/17.5 + D0/D1A) — área do OPERADOR
   (super_admin). Invisível para escolas: o App só monta isto quando
   sou_super_admin() é true NO BANCO. Dashboard, lista de escolas com
   busca/filtro, detalhe com edição e ações de status (suspender/
   reativar/cancelar) — tudo via RPC com PORTEIRO eh_super_admin no
   banco. Nada de service_role aqui. A conta do coordenador (Auth) é
   provisionada pela camada de operador (scripts/criar-coordenacao.mjs). */
import React, { useMemo, useState } from "react";
import {
  SectionCard, Empty, Erro, EmptyState, StatCard, StatusBadge, Botao, BotaoMini, useInputStyle,
} from "../../shared/ui/componentes.jsx";
import { useTema } from "../../shared/branding/BrandingContext.jsx";
import { useRecurso } from "../../shared/hooks/useRecurso.js";
import { nomeValido, limparNome } from "../../shared/validacao.js";
import { mensagemAmigavel } from "../../shared/lib/erros.js";
import * as db from "../../shared/data/index.js";

const fmtData = (iso) => (iso ? new Date(iso).toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit", year: "2-digit" }) : "—");

// Catálogo único de status — usado no selo, nos filtros e nas ações.
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
  const { dados: logs, recarregar: recLogs } = useRecurso(() => db.backofficeLogs(25), []);
  const [aberta, setAberta] = useState(null); // escola_id em detalhe

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
        {carregando && <Empty txt="Carregando escolas…" />}

        {!carregando && !erro && aberta && (
          <DetalheEscola escolaId={aberta} aoVoltar={() => { setAberta(null); recarregarTudo(); }} aoMudar={recarregarTudo} />
        )}

        {!carregando && !erro && !aberta && (
          <>
            <Dashboard dash={dash} />
            <NovaEscola aoCriar={recarregarTudo} />
            <ListaEscolas lista={lista} aoAbrir={setAberta} />
            <AtividadeAdmin logs={logs} nomePorEscola={nomePorEscola} />
          </>
        )}
      </main>
    </div>
  );
}

/* ---------- 9.2 Dashboard ---------- */
function Dashboard({ dash }) {
  const T = useTema();
  if (!dash) return null;
  const semCoord = Number(dash.escolas_sem_coordenador || 0);
  const suspensas = Number(dash.escolas_suspensas || 0);
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
        <StatCard rotulo="Alunos ativos (7d)" valor={Number(dash.alunos_ativos_7d || 0)} icone="⚡" sub="com acesso nos últimos 7 dias" />
        <StatCard rotulo="Coordenadores" valor={Number(dash.coordenadores_total || 0)} icone="🎓" />
        <StatCard rotulo="Sem coordenador" valor={semCoord} icone="⚠" tom={semCoord ? "risco" : "ok"} sub={semCoord ? "precisam de provisão" : "tudo coberto"} />
      </div>
    </div>
  );
}

/* ---------- 9.3 Lista de escolas (busca + filtros + ordenação) ---------- */
function ListaEscolas({ lista, aoAbrir }) {
  const T = useTema();
  const { input: inputS, label: lbl } = useInputStyle();
  const [busca, setBusca] = useState("");
  const [fStatus, setFStatus] = useState("");
  const [fPlano, setFPlano] = useState("");
  const [ordem, setOrdem] = useState("nome");

  const planos = useMemo(() => [...new Set(lista.map((e) => e.plano).filter(Boolean))].sort(), [lista]);

  const filtrada = useMemo(() => {
    const q = busca.trim().toLowerCase();
    let r = lista.filter((e) => {
      const txt = `${e.nome} ${e.slug} ${e.cidade ?? ""}`.toLowerCase();
      return (!q || txt.includes(q)) && (!fStatus || e.status === fStatus) && (!fPlano || e.plano === fPlano);
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
          <input value={busca} onChange={(e) => setBusca(e.target.value)} placeholder="🔎 Buscar por nome, slug ou cidade" style={inputS} />
        </div>
        <div>
          <label style={lbl}>Status</label>
          <select value={fStatus} onChange={(e) => setFStatus(e.target.value)} style={selS}>
            <option value="">Todos</option>
            {Object.entries(STATUS).map(([k, v]) => <option key={k} value={k}>{v.rotulo}</option>)}
          </select>
        </div>
        <div>
          <label style={lbl}>Plano</label>
          <select value={fPlano} onChange={(e) => setFPlano(e.target.value)} style={selS}>
            <option value="">Todos</option>
            {planos.map((p) => <option key={p} value={p}>{p}</option>)}
          </select>
        </div>
        <div>
          <label style={lbl}>Ordenar por</label>
          <select value={ordem} onChange={(e) => setOrdem(e.target.value)} style={selS}>
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
            return (
              <button key={e.escola_id} className="row" onClick={() => aoAbrir(e.escola_id)}
                style={{ display: "flex", alignItems: "center", gap: 12, padding: "12px 15px", borderBottom: i === filtrada.length - 1 ? "none" : `1px solid ${T.line}`, flexWrap: "wrap", width: "100%", textAlign: "left", border: "none", background: "transparent", color: T.ink }}>
                <div style={{ flex: 1, minWidth: 180 }}>
                  <div style={{ fontSize: 14.5, fontWeight: 700, display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
                    {e.nome}
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

/* ---------- 9.5 Criar escola ---------- */
function NovaEscola({ aoCriar }) {
  const { input: inputS, label: lbl } = useInputStyle();
  const T = useTema();
  const [aberto, setAberto] = useState(false);
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
      setAberto(false);
      aoCriar?.();
    } catch (e) { setErro(mensagemAmigavel(e, "salvar")); }
    setOcupado(false);
  }

  if (!aberto) {
    return (
      <SectionCard titulo="Criar escola" sub="Cadastra a escola em estado de implantação. O coordenador é provisionado depois (operador)."
        acao={<BotaoMini destaque onClick={() => setAberto(true)}>+ Nova escola</BotaoMini>}>
        <div style={{ fontSize: 12.5, color: T.sub }}>Abra o formulário para cadastrar uma nova escola.</div>
      </SectionCard>
    );
  }

  return (
    <SectionCard titulo="Criar escola" sub="A escola nasce em implantação. Ative-a no detalhe quando estiver pronta."
      acao={<BotaoMini onClick={() => setAberto(false)}>Cancelar</BotaoMini>}>
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

/* ---------- 9.7 Atividade administrativa (logs globais) ---------- */
function AtividadeAdmin({ logs, nomePorEscola }) {
  const T = useTema();
  const lista = logs ?? [];
  return (
    <SectionCard titulo="Atividade administrativa" sub="Ações do operador — trilha de auditoria (admin_logs)." semPadding>
      {lista.length === 0 ? (
        <div style={{ padding: 8 }}><EmptyState icone="🗒️" titulo="Sem atividade ainda" dica="As ações do backoffice aparecem aqui." /></div>
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
};
const rotuloAcao = (a) => ACOES[a] ?? a;

// Antes/depois legível, sem despejar jsonb cru nem dado sensível.
function ResumoDetalhe({ acao, detalhe }) {
  const T = useTema();
  if (!detalhe) return null;
  if (acao === "alterar-status-escola" || acao === "suspender-escola" || acao === "ativar-escola") {
    if (detalhe.de && detalhe.para) return <span style={{ color: T.sub }}> · {rotuloStatus(detalhe.de)} → {rotuloStatus(detalhe.para)}</span>;
  }
  if (acao === "editar-escola" && detalhe.antes && detalhe.depois) {
    const campos = ["nome", "plano", "cidade", "uf", "limite_alunos", "cor_acento", "logo_url", "observacao"];
    const mudou = campos.filter((c) => detalhe.antes[c] !== detalhe.depois[c]);
    if (mudou.length) return <span style={{ color: T.sub }}> · alterou {mudou.join(", ")}</span>;
  }
  return null;
}

/* ---------- 9.4 Detalhe da escola + ações ---------- */
function DetalheEscola({ escolaId, aoVoltar, aoMudar }) {
  const T = useTema();
  const { dados: d, carregando, erro, recarregar } = useRecurso(() => db.backofficeDetalheEscola(escolaId), [escolaId]);
  const { dados: logs, recarregar: recLogs } = useRecurso(() => db.backofficeLogs(60), []);
  const [editando, setEditando] = useState(false);

  if (carregando) return <Empty txt="Carregando escola…" />;
  if (erro) return <><BotaoVoltar aoVoltar={aoVoltar} /><Erro>{erro}</Erro></>;
  const e = d.escola ?? {};
  const logsEscola = (logs ?? []).filter((l) => l.escola_id === escolaId);
  const recarregarLocal = () => { recarregar(); recLogs(); aoMudar?.(); };

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
      <BotaoVoltar aoVoltar={aoVoltar} />

      <SectionCard
        titulo={<span style={{ display: "inline-flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>{e.nome} <StatusBadge tom={STATUS[e.status]?.tom ?? "neutro"}>{rotuloStatus(e.status)}</StatusBadge></span>}
        sub={`/${e.slug}${e.cidade ? ` · ${e.cidade}${e.uf ? "/" + e.uf : ""}` : ""}`}
        acao={<BotaoMini destaque onClick={() => setEditando((v) => !v)}>{editando ? "Fechar edição" : "✎ Editar"}</BotaoMini>}>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(130px,1fr))", gap: 10 }}>
          <StatCard rotulo="Status" valor={rotuloStatus(e.status)} tom={STATUS[e.status]?.tom} icone="◷" />
          <StatCard rotulo="Plano" valor={e.plano || "—"} icone="◆" />
          <StatCard rotulo="Alunos" valor={Number(d.alunos)} sub={e.limite_alunos ? `limite ${e.limite_alunos}` : null} icone="👥" />
          <StatCard rotulo="Turmas" valor={d.turmas?.length ?? 0} icone="🏷️" />
        </div>
        <div style={{ marginTop: 12, display: "flex", gap: 16, flexWrap: "wrap", fontSize: 12.5, color: T.sub }}>
          <span style={{ display: "inline-flex", alignItems: "center", gap: 6 }}>
            Cor: {e.cor_acento ? <><span style={{ width: 14, height: 14, borderRadius: 4, background: e.cor_acento, border: `1px solid ${T.line}`, display: "inline-block" }} /> <code>{e.cor_acento}</code></> : "—"}
          </span>
          <span>Logo: {e.logo_url ? <a href={e.logo_url} target="_blank" rel="noreferrer" style={{ color: T.gold }}>ver imagem ↗</a> : "—"}</span>
        </div>
        {e.observacao && <div style={{ marginTop: 10, fontSize: 12.5, color: T.sub, background: T.bg, border: `1px solid ${T.line}`, borderRadius: 8, padding: "8px 10px" }}><b style={{ color: T.ink }}>Obs. interna:</b> {e.observacao}</div>}
      </SectionCard>

      {editando && <EditarEscola escola={e} aoSalvar={() => { setEditando(false); recarregarLocal(); }} />}

      <AcoesStatus escola={e} aoMudar={recarregarLocal} />

      <ChecklistImplantacao d={d} />

      <Coordenadores d={d} />

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

/* ---------- 9.5 Editar escola ---------- */
function EditarEscola({ escola, aoSalvar }) {
  const { input: inputS, label: lbl } = useInputStyle();
  const T = useTema();
  const [f, setF] = useState({
    nome: escola.nome ?? "", plano: escola.plano ?? "", cidade: escola.cidade ?? "", uf: escola.uf ?? "",
    corAcento: escola.cor_acento ?? "", logoUrl: escola.logo_url ?? "", limite: escola.limite_alunos ?? "", observacao: escola.observacao ?? "",
  });
  const [erro, setErro] = useState(null);
  const [ocupado, setOcupado] = useState(false);
  const set = (k, v) => setF((a) => ({ ...a, [k]: v }));

  const corValida = f.corAcento === "" || /^#[0-9a-fA-F]{6}$/.test(f.corAcento);
  const ufValido = f.uf === "" || /^[A-Za-z]{2}$/.test(f.uf);
  const pronto = nomeValido(f.nome) && corValida && ufValido && !ocupado;

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
      });
      aoSalvar?.();
    } catch (ex) { setErro(mensagemAmigavel(ex, "salvar")); }
    setOcupado(false);
  }

  return (
    <SectionCard titulo="Editar dados da escola" sub="Em branco = mantém o valor atual. Toda alteração fica registrada na auditoria.">
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(150px,1fr))", gap: 12 }}>
        <div style={{ gridColumn: "1 / -1" }}><label style={lbl}>Nome de exibição</label><input value={f.nome} onChange={(e) => set("nome", e.target.value)} style={inputS} /></div>
        <div><label style={lbl}>Plano</label><input value={f.plano} onChange={(e) => set("plano", e.target.value)} placeholder="ex: padrão" style={inputS} /></div>
        <div><label style={lbl}>Limite de alunos</label><input type="number" min="0" inputMode="numeric" value={f.limite} onChange={(e) => set("limite", e.target.value)} style={inputS} /></div>
        <div><label style={lbl}>Cidade</label><input value={f.cidade} onChange={(e) => set("cidade", e.target.value)} style={inputS} /></div>
        <div><label style={lbl}>UF</label><input value={f.uf} onChange={(e) => set("uf", e.target.value.toUpperCase().slice(0, 2))} style={{ ...inputS, borderColor: ufValido ? T.line : T.red }} /></div>
        <div>
          <label style={lbl}>Cor de acento</label>
          <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
            <input value={f.corAcento} onChange={(e) => set("corAcento", e.target.value)} placeholder="#CDA349" style={{ ...inputS, borderColor: corValida ? T.line : T.red, fontFamily: "monospace" }} />
            <span style={{ width: 38, height: 38, flexShrink: 0, borderRadius: 8, border: `1px solid ${T.line}`, background: corValida && f.corAcento ? f.corAcento : T.bg }} />
          </div>
        </div>
        <div style={{ gridColumn: "1 / -1" }}>
          <label style={lbl}>Logo (URL)</label>
          <input value={f.logoUrl} onChange={(e) => set("logoUrl", e.target.value)} placeholder="https://… (link público de imagem)" style={inputS} />
          <div style={{ fontSize: 11, color: T.sub, marginTop: 4 }}>Cole o link público de uma imagem (PNG/SVG). Upload de arquivo ainda não está disponível aqui.</div>
        </div>
        <div style={{ gridColumn: "1 / -1" }}>
          <label style={lbl}>Observação interna (não aparece para a escola)</label>
          <textarea value={f.observacao} onChange={(e) => set("observacao", e.target.value)} rows={2} style={{ ...inputS, minHeight: 56, resize: "vertical" }} />
        </div>
      </div>
      {!corValida && <div style={{ fontSize: 12, color: T.red, marginTop: 8 }}>Cor: use hexadecimal #RRGGBB (ex.: #CDA349).</div>}
      <Botao onClick={salvar} disabled={!pronto} style={{ marginTop: 14 }}>{ocupado ? "Salvando…" : "Salvar alterações"}</Botao>
      <Erro>{erro}</Erro>
    </SectionCard>
  );
}

/* ---------- 9.4/9.8 Ações de status com confirmação ---------- */
function AcoesStatus({ escola, aoMudar }) {
  const T = useTema();
  const [confirma, setConfirma] = useState(null); // { status, titulo, corpo, perigo }
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

/* ---------- 9.8 Modal de confirmação (guardrail de ação sensível) ---------- */
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

/* ---------- Checklist de implantação (semântica consistente com a RLS) ---------- */
function ChecklistImplantacao({ d }) {
  const T = useTema();
  const e = d.escola ?? {};
  const marca = !!(e.cor_acento || e.logo_url);
  const op = operacional(e.status);
  const checklist = [
    { ok: true, label: "Escola criada" },
    { ok: (d.coordenadores?.length ?? 0) > 0, label: "Coordenador provisionado", dica: "via scripts/criar-coordenacao.mjs" },
    { ok: marca, label: "Marca configurada (cor/logo)" },
    { ok: (d.turmas?.length ?? 0) > 0, label: "Turmas criadas" },
    { ok: Number(d.alunos) > 0, label: "Alunos importados" },
    { ok: Number(d.alunos_com_credencial) > 0, label: "Credenciais geradas" },
    { ok: Number(d.responsaveis) > 0, label: "Responsáveis vinculados (se houver)" },
    {
      ok: op,
      label: e.status === "ativa" ? "Escola ativada (status ativa)" : `Acesso operacional (${rotuloStatus(e.status)})`,
      dica: op ? null : `Escola ${rotuloStatus(e.status).toLowerCase()} — acesso bloqueado pela RLS até reativar`,
    },
  ];
  const feitos = checklist.filter((x) => x.ok).length;

  return (
    <SectionCard titulo="Checklist de implantação" sub={`${feitos} de ${checklist.length} concluídos`} semPadding>
      <div style={{ display: "flex", flexDirection: "column" }}>
        {checklist.map((x, i) => (
          <div key={x.label} style={{ display: "flex", alignItems: "center", gap: 11, padding: "11px 15px", borderBottom: i === checklist.length - 1 ? "none" : `1px solid ${T.line}` }}>
            <span style={{ width: 22, height: 22, borderRadius: "50%", flexShrink: 0, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 13, fontWeight: 800, background: x.ok ? `${T.green}22` : T.bg, color: x.ok ? T.green : T.sub, border: `1px solid ${x.ok ? T.green + "66" : T.line}` }}>
              {x.ok ? "✓" : "○"}
            </span>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontSize: 13.5, color: x.ok ? T.ink : T.sub }}>{x.label}</div>
              {x.dica && <div style={{ fontSize: 11, color: T.sub, marginTop: 1 }}>{x.dica}</div>}
            </div>
          </div>
        ))}
      </div>
    </SectionCard>
  );
}

/* ---------- 9.6 Coordenador principal ---------- */
function Coordenadores({ d }) {
  const T = useTema();
  const coords = d.coordenadores ?? [];
  return (
    <SectionCard titulo="Coordenação" sub="A conta do coordenador (Auth) é provisionada pela camada de operador — nunca pelo front.">
      {coords.length > 0 ? (
        <div style={{ fontSize: 13.5, color: T.ink, lineHeight: 1.8 }}>
          {coords.map((nome, i) => (
            <div key={i} style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <span style={{ color: T.green }}>●</span> {nome}
            </div>
          ))}
        </div>
      ) : (
        <EmptyState icone="🎓" titulo="Nenhum coordenador ainda"
          dica="Rode scripts/criar-coordenacao.mjs (operador) com ESCOLA_SLUG, COORD_EMAIL e COORD_SENHA. Senha nunca é exibida nem fica no repositório; o coordenador entra com e-mail e senha." />
      )}
      {coords.length > 0 && (
        <div style={{ marginTop: 12, fontSize: 11.5, color: T.sub, background: T.bg, border: `1px solid ${T.line}`, borderRadius: 8, padding: "9px 11px", lineHeight: 1.5 }}>
          Para adicionar/reativar coordenador ou redefinir senha, use a camada de operador (script). O backoffice não cria conta Auth (precisaria de service_role, que não entra no front).
        </div>
      )}
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
