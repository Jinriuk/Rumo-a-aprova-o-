/* Backoffice interno (Fases 17.4/17.5 + D0) — área do OPERADOR
   (super_admin). Invisível para escolas: o App só monta isto quando
   sou_super_admin() é true no banco, na rota /admin-interno. Tudo via
   RPC com porteiro no banco (nada de service_role aqui); a conta da
   coordenação (Auth) vai pela Edge Function segura backoffice-coordenador.
   D0 acrescenta: dashboard agregado, editar escola, suspender/ativar,
   plano/status e provisão da coordenação principal — cada ação gera log. */
import React, { useState } from "react";
import { SectionCard, Empty, Erro, EmptyState, StatCard, Botao, BotaoMini, useInputStyle } from "../../shared/ui/componentes.jsx";
import { useTema } from "../../shared/branding/BrandingContext.jsx";
import { useRecurso } from "../../shared/hooks/useRecurso.js";
import { nomeValido, limparNome } from "../../shared/validacao.js";
import { mensagemAmigavel } from "../../shared/lib/erros.js";
import * as db from "../../shared/data/index.js";

const fmtData = (iso) => {
  if (!iso) return "—";
  return new Date(iso).toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit", year: "2-digit" });
};
const STATUS = {
  implantacao: "Em implantação", demo: "Demo", piloto: "Piloto",
  ativa: "Ativa", suspensa: "Suspensa", cancelada: "Cancelada",
};
const PLANOS = ["", "demo", "essencial", "gestao", "performance", "licenca"];

export default function AreaAdmin() {
  const T = useTema();
  const { dados: escolas, carregando, erro, recarregar } = useRecurso(() => db.backofficeEscolas(), []);
  const { dados: painel, recarregar: recarregarPainel } = useRecurso(() => db.backofficeDashboard(), []);
  const { dados: logs, recarregar: recarregarLogs } = useRecurso(() => db.backofficeLogs(20), []);
  const [aberta, setAberta] = useState(null); // escola_id em detalhe

  const recarregarTudo = () => { recarregar(); recarregarPainel(); recarregarLogs(); };
  const lista = escolas ?? [];
  const nomePorEscola = Object.fromEntries(lista.map((e) => [e.escola_id, e.nome]));

  return (
    <div>
      <header style={{ borderBottom: `1px solid ${T.line}`, background: T.bg2 }}>
        <div style={{ maxWidth: 1080, margin: "0 auto", padding: "14px 16px", display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12 }}>
          <div>
            <div className="disp" style={{ fontSize: 16, fontWeight: 800, color: T.gold }}>Backoffice Interno</div>
            <div style={{ fontSize: 12, color: T.sub }}>Operação das escolas e controle administrativo · super_admin</div>
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
            <PainelVisaoGeral painel={painel} />

            <NovaEscola aoCriar={recarregarTudo} />

            <SectionCard titulo="Escolas" sub="Clique para ver detalhe, editar, suspender/ativar e vincular coordenação." semPadding>
              {lista.length === 0 ? (
                <div style={{ padding: 8 }}><EmptyState icone="🏫" titulo="Nenhuma escola ainda" dica="Crie a primeira no formulário acima." /></div>
              ) : (
                <div style={{ display: "flex", flexDirection: "column" }}>
                  {lista.map((e, i) => (
                    <button key={e.escola_id} className="row" onClick={() => setAberta(e.escola_id)}
                      style={{ display: "flex", alignItems: "center", gap: 12, padding: "12px 15px", borderBottom: i === lista.length - 1 ? "none" : `1px solid ${T.line}`, flexWrap: "wrap", width: "100%", textAlign: "left", border: "none", background: "transparent", color: T.ink }}>
                      <div style={{ flex: 1, minWidth: 180 }}>
                        <div style={{ fontSize: 14.5, fontWeight: 700 }}>{e.nome} <SeloStatus status={e.status} /></div>
                        <div style={{ fontSize: 11.5, color: T.sub }}>/{e.slug}{e.plano ? ` · ${e.plano}` : ""}{e.cidade ? ` · ${e.cidade}${e.uf ? "/" + e.uf : ""}` : ""} · último acesso {fmtData(e.ultimo_acesso)}</div>
                      </div>
                      <div className="num" style={{ display: "flex", gap: 16, fontSize: 12, color: T.sub, textAlign: "right" }}>
                        <span><b style={{ color: T.ink, fontSize: 15 }}>{Number(e.alunos)}</b><br />alunos</span>
                        <span><b style={{ color: T.ink, fontSize: 15 }}>{Number(e.turmas)}</b><br />turmas</span>
                        <span><b style={{ color: e.coordenadores > 0 ? T.ink : T.red, fontSize: 15 }}>{Number(e.coordenadores)}</b><br />coord.</span>
                      </div>
                      <span style={{ color: T.gold, fontWeight: 700, flexShrink: 0 }}>›</span>
                    </button>
                  ))}
                </div>
              )}
            </SectionCard>

            <SectionCard titulo="Atividade administrativa" sub="Trilha de auditoria das ações do operador." semPadding>
              {(logs ?? []).length === 0 ? (
                <div style={{ padding: 8 }}><EmptyState icone="🗒️" titulo="Sem atividade ainda" dica="As ações do backoffice aparecem aqui." /></div>
              ) : (
                <div style={{ display: "flex", flexDirection: "column" }}>
                  {logs.map((l, i) => (
                    <div key={i} style={{ display: "flex", alignItems: "center", gap: 10, padding: "10px 15px", borderBottom: i === logs.length - 1 ? "none" : `1px solid ${T.line}`, fontSize: 12.5 }}>
                      <span style={{ flex: 1, minWidth: 0, color: T.ink }}>
                        <b>{rotuloAcao(l.acao)}</b>
                        {l.escola_id && <span style={{ color: T.sub }}> · {nomePorEscola[l.escola_id] ?? l.detalhe?.nome ?? l.detalhe?.depois?.nome ?? "escola"}</span>}
                      </span>
                      <span className="num" style={{ color: T.sub, flexShrink: 0 }}>{fmtData(l.em)}</span>
                    </div>
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

const rotuloAcao = (a) => ({
  "criar-escola": "Criou escola", "editar-escola": "Editou escola",
  "suspender-escola": "Suspendeu escola", "ativar-escola": "Ativou escola",
  "alterar-status-escola": "Alterou status", "vincular-coordenador": "Vinculou coordenação",
}[a] ?? a);

function PainelVisaoGeral({ painel }) {
  if (!painel) return null;
  const n = (k) => Number(painel[k] ?? 0);
  return (
    <SectionCard titulo="Visão geral" sub="Saúde operacional das escolas (dados em tempo real).">
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(140px,1fr))", gap: 10 }}>
        <StatCard rotulo="Escolas" valor={n("escolas_total")} icone="🏫" />
        <StatCard rotulo="Ativas" valor={n("escolas_ativas")} icone="✅" tom="ok" />
        <StatCard rotulo="Suspensas" valor={n("escolas_suspensas")} icone="⏸️" tom={n("escolas_suspensas") ? "risco" : undefined} />
        <StatCard rotulo="Demo/Piloto" valor={n("escolas_demo_piloto")} icone="🧪" />
        <StatCard rotulo="Canceladas" valor={n("escolas_canceladas")} icone="🚫" />
        <StatCard rotulo="Alunos" valor={n("alunos_total")} icone="👥" />
        <StatCard rotulo="Ativos 7 dias" valor={n("alunos_ativos_7d")} icone="📈" sub="por acesso" />
        <StatCard rotulo="Coordenadores" valor={n("coordenadores_total")} icone="🎓" />
        <StatCard rotulo="Sem coordenação" valor={n("escolas_sem_coordenador")} icone="⚠️" tom={n("escolas_sem_coordenador") ? "alerta" : undefined} />
      </div>
    </SectionCard>
  );
}

function SeloStatus({ status }) {
  const T = useTema();
  const cor = status === "ativa" ? T.green : (status === "suspensa" || status === "cancelada") ? T.red : T.gold;
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
    } catch (e) { setErro(mensagemAmigavel(e, "salvar")); }
    setOcupado(false);
  }

  return (
    <SectionCard titulo="Criar escola" sub="Cadastra a escola em estado de implantação. O coordenador é vinculado depois, no detalhe.">
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
        <div>
          <label style={lbl}>Plano</label>
          <select value={f.plano} onChange={(e) => set("plano", e.target.value)} style={inputS}>
            {PLANOS.map((p) => <option key={p} value={p}>{p === "" ? "—" : p}</option>)}
          </select>
        </div>
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
    { ok: (d.coordenadores?.length ?? 0) > 0, label: "Coordenador vinculado", dica: "use o painel “Coordenação principal” abaixo" },
    { ok: marca, label: "Marca configurada (cor/logo)" },
    { ok: (d.turmas?.length ?? 0) > 0, label: "Turmas criadas" },
    { ok: Number(d.alunos) > 0, label: "Alunos importados" },
    { ok: Number(d.alunos_com_credencial) > 0, label: "Credenciais geradas" },
    { ok: Number(d.responsaveis) > 0, label: "Responsáveis vinculados (se houver)" },
    { ok: e.status === "ativa", label: "Acesso liberado (status ativa)" },
  ];
};

function DetalheEscola({ escolaId, aoVoltar, aoMudar }) {
  const T = useTema();
  const { dados: d, carregando, erro, recarregar } = useRecurso(() => db.backofficeDetalheEscola(escolaId), [escolaId]);

  if (carregando) return <Empty txt="Carregando escola…" />;
  if (erro) return <><BotaoVoltar aoVoltar={aoVoltar} /><Erro>{erro}</Erro></>;
  const e = d.escola ?? {};
  const checklist = itensChecklist(d);
  const feitos = checklist.filter((x) => x.ok).length;
  const aposMudanca = () => { recarregar(); aoMudar?.(); };

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
      <BotaoVoltar aoVoltar={aoVoltar} />
      <SectionCard titulo={<>{e.nome} <SeloStatus status={e.status} /></>} sub={`/${e.slug}${e.cidade ? ` · ${e.cidade}${e.uf ? "/" + e.uf : ""}` : ""} · atualizada ${fmtData(e.atualizada_em)}`}>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(130px,1fr))", gap: 10 }}>
          <StatCard rotulo="Status" valor={STATUS[e.status] ?? e.status} icone="◷" />
          <StatCard rotulo="Plano" valor={e.plano || "—"} icone="◆" />
          <StatCard rotulo="Alunos" valor={Number(d.alunos)} sub={e.limite_alunos ? `limite ${e.limite_alunos}` : null} icone="👥" />
          <StatCard rotulo="Coordenadores" valor={d.coordenadores?.length ?? 0} tom={(d.coordenadores?.length ?? 0) ? undefined : "alerta"} icone="🎓" />
        </div>
      </SectionCard>

      <AcoesStatus escola={e} aoMudar={aposMudanca} />
      <EditarEscola escola={e} aoSalvar={aposMudanca} />
      <Coordenacao escolaId={escolaId} coordenadores={d.coordenadores ?? []} aoVincular={aposMudanca} />

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

// D0.6 — suspender / ativar (reversível, com confirmação). Ações
// perigosas (suspender/cancelar) pedem um segundo clique de confirmação.
function AcoesStatus({ escola, aoMudar }) {
  const T = useTema();
  const [ocupado, setOcupado] = useState(false);
  const [erro, setErro] = useState(null);
  const [confirmar, setConfirmar] = useState(null); // status pendente de confirmação

  async function aplicar(status) {
    setOcupado(true); setErro(null);
    try {
      await db.backofficeDefinirStatus(escola.id, status);
      setConfirmar(null);
      aoMudar?.();
    } catch (e) { setErro(mensagemAmigavel(e, "salvar")); }
    setOcupado(false);
  }
  // perigosas confirmam; ativar/voltar não precisa
  const pedir = (status) => (status === "suspensa" || status === "cancelada") ? setConfirmar(status) : aplicar(status);

  return (
    <SectionCard titulo="Status operacional" sub="Suspender bloqueia a operação da escola; nada é apagado e tudo é reversível.">
      {confirmar ? (
        <div style={{ border: `1px solid ${T.red}55`, background: `${T.red}11`, borderRadius: 10, padding: 14 }}>
          <div style={{ fontSize: 13.5, color: T.ink, marginBottom: 10 }}>
            Confirmar mudança para <b>{STATUS[confirmar]}</b>? A escola <b>{escola.nome}</b>
            {confirmar === "suspensa" ? " deixará de operar até ser reativada." : " será desligada (reversível, sem perda de dados)."}
          </div>
          <div style={{ display: "flex", gap: 8 }}>
            <Botao onClick={() => aplicar(confirmar)} disabled={ocupado} perigo>{ocupado ? "Aplicando…" : `Sim, ${confirmar === "suspensa" ? "suspender" : "cancelar"}`}</Botao>
            <Botao onClick={() => setConfirmar(null)} disabled={ocupado} secundario>Voltar</Botao>
          </div>
        </div>
      ) : (
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
          {escola.status !== "ativa" && <Botao onClick={() => aplicar("ativa")} disabled={ocupado} style={{ background: T.green, color: "#08130b" }}>▶ Ativar</Botao>}
          {escola.status !== "suspensa" && <Botao onClick={() => pedir("suspensa")} disabled={ocupado} perigo>⏸ Suspender</Botao>}
          {escola.status !== "cancelada" && <Botao onClick={() => pedir("cancelada")} disabled={ocupado} secundario>Cancelar escola</Botao>}
        </div>
      )}
      <Erro>{erro}</Erro>
    </SectionCard>
  );
}

// D0.5 — editar dados básicos. Manda só o que o operador preenche;
// campos em branco preservam o valor atual (coalesce no banco).
function EditarEscola({ escola, aoSalvar }) {
  const { input: inputS, label: lbl } = useInputStyle();
  const T = useTema();
  const [aberto, setAberto] = useState(false);
  const [f, setF] = useState(() => ({
    nome: escola.nome ?? "", plano: escola.plano ?? "", cor: escola.cor_acento ?? "",
    logo: escola.logo_url ?? "", cidade: escola.cidade ?? "", uf: escola.uf ?? "",
    limite: escola.limite_alunos ?? "", observacao: escola.observacao ?? "",
  }));
  const [ocupado, setOcupado] = useState(false);
  const [erro, setErro] = useState(null);
  const set = (k, v) => setF((a) => ({ ...a, [k]: v }));

  const corOk = f.cor === "" || /^#[0-9a-fA-F]{6}$/.test(f.cor);
  const nomeOk = nomeValido(f.nome);
  const pronto = nomeOk && corOk && !ocupado;

  async function salvar() {
    if (!pronto) return;
    setOcupado(true); setErro(null);
    try {
      await db.backofficeEditarEscola(escola.id, {
        nome: limparNome(f.nome), plano: f.plano.trim(), corAcento: f.cor.trim() || null,
        logoUrl: f.logo.trim() || null, cidade: f.cidade.trim(), uf: f.uf.trim().toUpperCase(),
        limiteAlunos: f.limite === "" ? null : +f.limite, observacao: f.observacao,
      });
      setAberto(false);
      aoSalvar?.();
    } catch (e) { setErro(mensagemAmigavel(e, "salvar")); }
    setOcupado(false);
  }

  if (!aberto) {
    return (
      <SectionCard titulo="Dados básicos" sub="Nome, plano, marca, localização e observação interna." acao={<BotaoMini destaque onClick={() => setAberto(true)}>Editar</BotaoMini>}>
        <div style={{ fontSize: 13, color: T.sub, lineHeight: 1.7 }}>
          <div><b style={{ color: T.ink }}>Plano:</b> {escola.plano || "—"} · <b style={{ color: T.ink }}>Limite:</b> {escola.limite_alunos ?? "—"}</div>
          <div><b style={{ color: T.ink }}>Marca:</b> {escola.cor_acento || "sem cor"} {escola.logo_url ? "· logo definida" : ""}</div>
          {escola.observacao && <div><b style={{ color: T.ink }}>Obs.:</b> {escola.observacao}</div>}
        </div>
      </SectionCard>
    );
  }

  return (
    <SectionCard titulo="Editar dados básicos" sub="Campos em branco preservam o valor atual.">
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(150px,1fr))", gap: 12 }}>
        <div style={{ gridColumn: "1 / -1" }}><label style={lbl}>Nome</label><input value={f.nome} onChange={(e) => set("nome", e.target.value)} style={inputS} /></div>
        <div>
          <label style={lbl}>Plano</label>
          <select value={PLANOS.includes(f.plano) ? f.plano : ""} onChange={(e) => set("plano", e.target.value)} style={inputS}>
            {PLANOS.map((p) => <option key={p} value={p}>{p === "" ? "—" : p}</option>)}
          </select>
        </div>
        <div>
          <label style={lbl}>Cor de destaque</label>
          <input value={f.cor} onChange={(e) => set("cor", e.target.value)} placeholder="#CDA349"
            style={{ ...inputS, borderColor: corOk ? T.line : T.red, fontFamily: "monospace" }} />
        </div>
        <div style={{ gridColumn: "1 / -1" }}><label style={lbl}>Logo (URL)</label><input value={f.logo} onChange={(e) => set("logo", e.target.value)} placeholder="https://…" style={inputS} /></div>
        <div><label style={lbl}>Cidade</label><input value={f.cidade} onChange={(e) => set("cidade", e.target.value)} style={inputS} /></div>
        <div><label style={lbl}>UF</label><input value={f.uf} onChange={(e) => set("uf", e.target.value.toUpperCase().slice(0, 2))} style={inputS} /></div>
        <div><label style={lbl}>Limite de alunos</label><input type="number" min="0" inputMode="numeric" value={f.limite} onChange={(e) => set("limite", e.target.value)} style={inputS} /></div>
        <div style={{ gridColumn: "1 / -1" }}><label style={lbl}>Observação interna</label><textarea value={f.observacao} onChange={(e) => set("observacao", e.target.value)} rows={2} style={{ ...inputS, resize: "vertical" }} /></div>
      </div>
      {!corOk && <div style={{ fontSize: 12, color: T.red, marginTop: 8 }}>Cor deve ser #RRGGBB (hex de 6 dígitos).</div>}
      <div style={{ display: "flex", gap: 8, marginTop: 14 }}>
        <Botao onClick={salvar} disabled={!pronto}>{ocupado ? "Salvando…" : "Salvar"}</Botao>
        <Botao onClick={() => setAberto(false)} disabled={ocupado} secundario>Cancelar</Botao>
      </div>
      <Erro>{erro}</Erro>
    </SectionCard>
  );
}

// D0.7 — coordenação principal. A conta nasce na Edge Function segura:
// senha aleatória descartável + link de definição de senha (convite).
function Coordenacao({ escolaId, coordenadores, aoVincular }) {
  const { input: inputS, label: lbl } = useInputStyle();
  const T = useTema();
  const [f, setF] = useState({ nome: "", email: "" });
  const [ocupado, setOcupado] = useState(false);
  const [erro, setErro] = useState(null);
  const [resultado, setResultado] = useState(null);
  const set = (k, v) => setF((a) => ({ ...a, [k]: v }));

  const emailOk = /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(f.email);
  const pronto = nomeValido(f.nome) && emailOk && !ocupado;

  async function vincular() {
    if (!pronto) return;
    setOcupado(true); setErro(null); setResultado(null);
    try {
      const r = await db.backofficeVincularCoordenador({ escolaId, nome: limparNome(f.nome), email: f.email.trim() });
      setResultado(r);
      setF({ nome: "", email: "" });
      aoVincular?.();
    } catch (e) { setErro(mensagemAmigavel(e, "salvar")); }
    setOcupado(false);
  }

  return (
    <SectionCard titulo="Coordenação principal" sub="Cria/atualiza a conta da coordenação presa a esta escola. A senha é definida pela própria pessoa, por link seguro.">
      {coordenadores.length > 0 && (
        <div style={{ fontSize: 13, color: T.sub, marginBottom: 12 }}>
          <b style={{ color: T.ink }}>Já vinculados:</b> {coordenadores.join(", ")}
        </div>
      )}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(180px,1fr))", gap: 12 }}>
        <div><label style={lbl}>Nome</label><input value={f.nome} onChange={(e) => set("nome", e.target.value)} placeholder="Coordenação Fulano" style={inputS} /></div>
        <div>
          <label style={lbl}>E-mail</label>
          <input value={f.email} onChange={(e) => set("email", e.target.value)} placeholder="coord@escola.com" type="email"
            style={{ ...inputS, borderColor: f.email && !emailOk ? T.red : T.line }} />
        </div>
      </div>
      <Botao onClick={vincular} disabled={!pronto} style={{ marginTop: 14 }}>{ocupado ? "Vinculando…" : "Vincular coordenação"}</Botao>
      <Erro>{erro}</Erro>
      {resultado?.ok && (
        <div style={{ marginTop: 12, border: `1px solid ${T.green}55`, background: `${T.green}11`, borderRadius: 10, padding: 12, fontSize: 13 }}>
          <div style={{ color: T.ink, fontWeight: 700, marginBottom: 4 }}>
            {resultado.conta_nova ? "Conta criada" : "Conta revinculada"}: {resultado.email}
          </div>
          {resultado.link
            ? <div style={{ color: T.sub }}>Envie este link para a coordenação definir a senha:<br />
                <a href={resultado.link} style={{ color: T.gold, wordBreak: "break-all" }}>{resultado.link}</a></div>
            : <div style={{ color: T.sub }}>Peça à coordenação para usar “Esqueci minha senha” no login (não foi possível gerar o link automático).</div>}
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
