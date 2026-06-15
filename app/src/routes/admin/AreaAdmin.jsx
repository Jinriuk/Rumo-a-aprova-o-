/* Backoffice interno (Fase 17.4) — área do OPERADOR (super_admin).
   Invisível para escolas: o App só monta isto quando sou_super_admin()
   é true no banco. Esta é a FUNDAÇÃO: lista de escolas (leitura).
   Criar escola, detalhe e implantação entram na 17.5. Nada de
   service_role aqui — tudo via RPC com porteiro no banco. */
import React from "react";
import { SectionCard, Empty, Erro, EmptyState, StatCard } from "../../shared/ui/componentes.jsx";
import { useTema } from "../../shared/branding/BrandingContext.jsx";
import { useRecurso } from "../../shared/hooks/useRecurso.js";
import * as db from "../../shared/data/index.js";

const fmtData = (iso) => {
  if (!iso) return "—";
  const d = new Date(iso);
  return d.toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit", year: "2-digit" });
};

export default function AreaAdmin() {
  const T = useTema();
  const { dados: escolas, carregando, erro } = useRecurso(() => db.backofficeEscolas(), []);
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

        {!carregando && !erro && (
          <>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(160px,1fr))", gap: 10 }}>
              <StatCard rotulo="Escolas" valor={lista.length} icone="🏫" />
              <StatCard rotulo="Alunos (total)" valor={totalAlunos} icone="👥" />
            </div>

            <SectionCard titulo="Escolas" sub="Todas as escolas do sistema (visão do operador)." semPadding>
              {lista.length === 0 ? (
                <div style={{ padding: 8 }}>
                  <EmptyState icone="🏫" titulo="Nenhuma escola ainda"
                    dica="O cadastro de escola pelo backoffice entra na Fase 17.5." />
                </div>
              ) : (
                <div style={{ display: "flex", flexDirection: "column" }}>
                  {lista.map((e, i) => (
                    <div key={e.escola_id} style={{ display: "flex", alignItems: "center", gap: 12, padding: "12px 15px", borderBottom: i === lista.length - 1 ? "none" : `1px solid ${T.line}`, flexWrap: "wrap" }}>
                      <div style={{ flex: 1, minWidth: 180 }}>
                        <div style={{ fontSize: 14.5, fontWeight: 700 }}>{e.nome}</div>
                        <div style={{ fontSize: 11.5, color: T.sub }}>/{e.slug} · último acesso {fmtData(e.ultimo_acesso)}</div>
                      </div>
                      <div className="num" style={{ display: "flex", gap: 16, fontSize: 12, color: T.sub, textAlign: "right" }}>
                        <span><b style={{ color: T.ink, fontSize: 15 }}>{Number(e.alunos)}</b><br />alunos</span>
                        <span><b style={{ color: T.ink, fontSize: 15 }}>{Number(e.turmas)}</b><br />turmas</span>
                        <span><b style={{ color: T.ink, fontSize: 15 }}>{Number(e.coordenadores)}</b><br />coord.</span>
                      </div>
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
