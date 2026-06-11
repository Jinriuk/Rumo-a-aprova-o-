/* Cadastro de turma e aluno pela coordenação — é AQUI que a escola
   decide se o sistema é fácil ou um peso (Doc 6, 4.2). Um a um ou
   em lote (um nome por linha). O consentimento entra no mesmo
   passo: é termo no cadastro, não burocracia separada. */
import React, { useState } from "react";
import { Card, Botao, Erro, useInputStyle } from "../../shared/ui/componentes.jsx";
import { useTema } from "../../shared/branding/BrandingContext.jsx";
import * as db from "../../shared/data/index.js";

export function NovaTurma({ aoMudar }) {
  const { input: inputS, label: lbl } = useInputStyle();
  const [nome, setNome] = useState("");
  const [erro, setErro] = useState(null);
  const [ocupado, setOcupado] = useState(false);

  async function criar() {
    if (!nome.trim() || ocupado) return;
    setOcupado(true); setErro(null);
    try {
      await db.criarTurma(nome.trim());
      setNome("");
      aoMudar?.();
    } catch (e) { setErro(e.message); }
    setOcupado(false);
  }

  return (
    <Card>
      <div className="disp" style={{ fontSize: 15, fontWeight: 700, marginBottom: 10 }}>Nova turma</div>
      <div style={{ display: "flex", gap: 10, flexWrap: "wrap", alignItems: "flex-end" }}>
        <div style={{ flex: 1, minWidth: 200 }}>
          <label style={lbl}>Nome da turma</label>
          <input value={nome} onChange={(e) => setNome(e.target.value)} placeholder="ex: Turma CN 2026 — manhã" style={inputS} />
        </div>
        <Botao onClick={criar} disabled={!nome.trim() || ocupado}>{ocupado ? "Criando…" : "+ Criar turma"}</Botao>
      </div>
      <Erro>{erro}</Erro>
    </Card>
  );
}

export function NovosAlunos({ turmas, trilhaPadrao, concursos = [], aoMudar }) {
  const T = useTema();
  const { input: inputS, label: lbl } = useInputStyle();
  const [nomes, setNomes] = useState("");
  const [turmaId, setTurmaId] = useState("");
  const [concursoId, setConcursoId] = useState("");
  const [consentimentoNome, setConsentimentoNome] = useState("");
  const [consentiu, setConsentiu] = useState(false);
  const [erro, setErro] = useState(null);
  const [ocupado, setOcupado] = useState(false);
  const [feito, setFeito] = useState(null);

  const lista = nomes.split("\n").map((n) => n.trim()).filter(Boolean);
  const emLote = lista.length > 1;
  // em lote o consentimento é registrado aluno a aluno depois,
  // porque cada um tem um responsável diferente
  const pronto = lista.length > 0 && (emLote || !consentiu || consentimentoNome.trim());

  async function cadastrar() {
    if (!pronto || ocupado) return;
    setOcupado(true); setErro(null); setFeito(null);
    try {
      const concursoEscolhido = concursoId || concursos.find((c) => c.codigo === "cn")?.id || null;
      const alunos = await db.cadastrarAlunos(lista, turmaId || null, trilhaPadrao?.id ?? null, concursoEscolhido);
      if (!emLote && consentiu && consentimentoNome.trim()) {
        await db.registrarConsentimento(alunos[0].id, consentimentoNome.trim());
      }
      // a meta da semana nasce agora, pelo motor — não espera a virada
      for (const a of alunos) {
        await db.gerarMeta(a.id).catch((e) => console.error(`meta de ${a.nome}:`, e.message));
      }
      setFeito(`${alunos.length} aluno(s) cadastrado(s). Gere as credenciais na lista abaixo.`);
      setNomes(""); setConsentimentoNome(""); setConsentiu(false);
      aoMudar?.();
    } catch (e) { setErro(e.message); }
    setOcupado(false);
  }

  return (
    <Card>
      <div className="disp" style={{ fontSize: 15, fontWeight: 700, marginBottom: 4 }}>Cadastrar alunos</div>
      <div style={{ fontSize: 12, color: T.sub, marginBottom: 12 }}>
        Um nome por linha cadastra em lote. Só o nome — nada de CPF nem documento (minimização, LGPD).
      </div>
      <label style={lbl}>Nome(s)</label>
      <textarea value={nomes} onChange={(e) => setNomes(e.target.value)} rows={emLote ? 6 : 2}
        placeholder={"Maria da Silva\nJoão Souza"}
        style={{ ...inputS, resize: "vertical", fontFamily: "Archivo, sans-serif" }} />
      <div style={{ display: "flex", gap: 10, flexWrap: "wrap", marginTop: 12 }}>
        <div style={{ flex: 1, minWidth: 180 }}>
          <label style={lbl}>Turma</label>
          <select value={turmaId} onChange={(e) => setTurmaId(e.target.value)} style={inputS}>
            <option value="" style={{ background: T.bg2 }}>— sem turma —</option>
            {turmas.map((t) => <option key={t.id} value={t.id} style={{ background: T.bg2 }}>{t.nome}</option>)}
          </select>
        </div>
        <div style={{ flex: 1, minWidth: 180 }}>
          <label style={lbl}>Concurso</label>
          <select value={concursoId || (concursos.find((c) => c.codigo === "cn")?.id ?? "")}
            onChange={(e) => setConcursoId(e.target.value)} style={inputS}>
            {concursos.map((c) => (
              <option key={c.id} value={c.id} style={{ background: T.bg2 }}>{c.nome}</option>
            ))}
          </select>
        </div>
        <div style={{ flex: 1, minWidth: 180 }}>
          <label style={lbl}>Trilha de estudo</label>
          <input value={trilhaPadrao?.nome ?? "—"} disabled style={{ ...inputS, color: T.sub }} />
        </div>
      </div>

      {!emLote && (
        <div style={{ marginTop: 12, border: `1px solid ${T.line}`, borderRadius: 8, padding: 12 }}>
          <label style={{ display: "flex", gap: 10, alignItems: "flex-start", cursor: "pointer" }}>
            <input type="checkbox" checked={consentiu} onChange={(e) => setConsentiu(e.target.checked)}
              style={{ marginTop: 2, accentColor: T.gold, width: 20, height: 20, flexShrink: 0 }} />
            <span style={{ fontSize: 12.5, color: T.ink, lineHeight: 1.5 }}>
              Registrar o consentimento do responsável para o tratamento dos dados de estudo deste aluno
              (termo v1). A escola é a controladora; o consentimento fica gravado com data e quem registrou.
            </span>
          </label>
          {consentiu && (
            <div style={{ marginTop: 10 }}>
              <label style={lbl}>Nome do responsável que consentiu</label>
              <input value={consentimentoNome} onChange={(e) => setConsentimentoNome(e.target.value)} style={inputS} />
            </div>
          )}
        </div>
      )}

      <Botao onClick={cadastrar} disabled={!pronto || ocupado} style={{ marginTop: 14 }}>
        {ocupado ? "Cadastrando…" : emLote ? `+ Cadastrar ${lista.length} alunos` : "+ Cadastrar aluno"}
      </Botao>
      {feito && <div style={{ color: T.green, fontSize: 13, marginTop: 10 }}>{feito}</div>}
      <Erro>{erro}</Erro>
    </Card>
  );
}

/* Credencial gerada: aparece UMA vez, grande, pra copiar e entregar. */
export function CredencialGerada({ credencial, aoFechar }) {
  const T = useTema();
  if (!credencial) return null;
  return (
    <div style={{ position: "fixed", inset: 0, background: "#000a", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 50, padding: 18 }}>
      <Card style={{ maxWidth: 420, width: "100%", textAlign: "center" }}>
        <div className="disp" style={{ fontSize: 17, fontWeight: 700, marginBottom: 6 }}>
          Credencial de {credencial.papel === "aluno" ? "aluno" : "responsável"}
        </div>
        <div style={{ fontSize: 13, color: T.sub, marginBottom: 14 }}>{credencial.nome}</div>
        <div className="num" style={{ fontSize: 28, fontWeight: 800, letterSpacing: 3, color: T.gold, fontFamily: "monospace", padding: "14px 0", border: `1px dashed ${T.gold}`, borderRadius: 10, userSelect: "all" }}>
          {credencial.codigo}
        </div>
        <div style={{ fontSize: 12, color: T.red, marginTop: 12, lineHeight: 1.5 }}>
          Anote e entregue agora: por segurança, este código não fica visível depois.
        </div>
        <div style={{ display: "flex", gap: 8, marginTop: 14, justifyContent: "center" }}>
          <Botao onClick={() => navigator.clipboard?.writeText(credencial.codigo).catch(() => {})} secundario>Copiar</Botao>
          <Botao onClick={aoFechar}>Entreguei, fechar</Botao>
        </div>
      </Card>
    </div>
  );
}
