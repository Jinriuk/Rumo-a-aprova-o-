/* Cadastro de turma e aluno pela coordenação — é AQUI que a escola
   decide se o sistema é fácil ou um peso (Doc 6, 4.2). Um a um ou
   em lote (um nome por linha ou via CSV). O consentimento entra no mesmo
   passo: é termo no cadastro, não burocracia separada. */
import React, { useId, useRef, useState } from "react";
import { Card, Botao, BotaoMini, Erro, useInputStyle } from "../../shared/ui/componentes.jsx";
import { useTema } from "../../shared/branding/BrandingContext.jsx";
import { limparNome, nomeValido } from "../../shared/validacao.js";
import { useEnvioUnico } from "../../shared/hooks/useEnvioUnico.js";
import { comConcorrenciaLimitada } from "../../shared/lib/concorrencia.js";
import { AvisoMaturidade } from "../conteudo/SeloMaturidade.jsx";
import { maturidadeDe, rotuloMaturidade, podeAtribuirTrilhaSemanal, aceitaAluno } from "../conteudo/maturidade.js";
import * as db from "../../shared/data/index.js";

// Fase B-min, B.6: cadastro em lote pode trazer 300+ nomes de uma vez.
// Gerar a meta de cada um é uma chamada de Edge Function (rede); um
// `for` sequencial somaria centenas de viagens de rede uma atrás da
// outra. Um teto de chamadas em paralelo evita tanto a espera longa
// quanto sobrecarregar a função com 300+ chamadas simultâneas.
const CONCORRENCIA_GERAR_META = 10;

// ────────────────────────────────────────────────────────────
// Parsing de CSV/TSV — sem dependência externa
// ────────────────────────────────────────────────────────────
function parsearCsv(texto) {
  const SEP = /[,;|\t]/;
  return texto
    .split("\n")
    .map((linha) => linha.trim())
    .filter(Boolean)
    .map((linha) => {
      const cols = linha.split(SEP).map((c) => c.trim().replace(/^["']|["']$/g, ""));
      return { nome: cols[0] ?? "", turmaNome: cols[1] ?? "" };
    });
}

function detectarCabecalho(linhas) {
  if (!linhas.length) return false;
  const primeira = (linhas[0].nome ?? "").toLowerCase();
  return /^nome$|^name$|^aluno$|^estudante$/.test(primeira);
}

function validarLinhasCsv(linhas, turmas) {
  const turmaMap = new Map(turmas.map((t) => [t.nome.toLowerCase(), t.id]));
  return linhas.map((l, idx) => {
    const nome = limparNome(l.nome ?? "");
    const valido = nomeValido(nome);
    let turmaId = "";
    let turmaErro = "";
    if (l.turmaNome) {
      const tid = turmaMap.get(l.turmaNome.toLowerCase());
      if (tid) turmaId = tid;
      else turmaErro = `turma "${l.turmaNome}" não encontrada`;
    }
    return { idx: idx + 1, nome, turmaNome: l.turmaNome, turmaId, valido, turmaErro };
  });
}

// ────────────────────────────────────────────────────────────
// Cadastro INDIVIDUAL de aluno
// ────────────────────────────────────────────────────────────
export function NovoAluno({ turmas, trilhaPadrao, concursos = [], aoMudar }) {
  const T = useTema();
  const { input: inputS, label: lbl } = useInputStyle();
  const uid = useId();
  const cid = (k) => `${uid}-${k}`;
  const [nome, setNome] = useState("");
  const [turmaId, setTurmaId] = useState("");
  const [concursoId, setConcursoId] = useState("");
  const [consentiu, setConsentiu] = useState(false);
  const [consentimentoNome, setConsentimentoNome] = useState("");
  const { ocupado, erro, enviar } = useEnvioUnico("salvar"); // trava de duplo cadastro
  const [feito, setFeito] = useState(null);

  // Maturidade do concurso selecionado governa o que o sistema oferece:
  // só concurso COMPLETO recebe a trilha semanal (calendário); indisponível
  // não recebe aluno (PED2). Sem essa trava, todo aluno herdava o calendário
  // do CN, e trilha incompleta aparecia como pronta.
  const cnId = concursos.find((c) => c.codigo === "cn")?.id ?? null;
  const codigoSel = concursos.find((c) => c.id === (concursoId || cnId))?.codigo ?? null;
  const usaTrilhaSemanal = codigoSel ? podeAtribuirTrilhaSemanal(codigoSel) : false;
  const concursoBloqueado = codigoSel ? !aceitaAluno(codigoSel) : false;

  const pronto = nomeValido(nome) && !concursoBloqueado && (!consentiu || nomeValido(consentimentoNome));

  async function cadastrar() {
    if (!pronto) return;
    setFeito(null);
    await enviar(async () => {
      const concursoEscolhido = concursoId || cnId || null;
      const trilhaEscolhida = usaTrilhaSemanal ? (trilhaPadrao?.id ?? null) : null;
      const alunos = await db.cadastrarAlunos(
        [limparNome(nome)], turmaId || null, trilhaEscolhida, concursoEscolhido,
      );
      if (consentiu && nomeValido(consentimentoNome)) {
        await db.registrarConsentimento(alunos[0].id, limparNome(consentimentoNome));
      }
      await db.gerarMeta(alunos[0].id).catch((e) => console.error("gerar meta:", e.message));
      setFeito(`${limparNome(nome)} cadastrado. Gere a credencial na lista abaixo.`);
      setNome(""); setConsentiu(false); setConsentimentoNome("");
      aoMudar?.();
    });
  }

  return (
    <div>
      <div style={{ display: "flex", gap: 10, flexWrap: "wrap", marginBottom: 12 }}>
        <div style={{ flex: 2, minWidth: 200 }}>
          <label htmlFor={cid("nome")} style={lbl}>Nome do aluno</label>
          <input id={cid("nome")} value={nome} onChange={(e) => { setNome(e.target.value); setFeito(null); }}
            placeholder="ex: Maria da Silva" style={inputS} />
        </div>
        <div style={{ flex: 1, minWidth: 160 }}>
          <label htmlFor={cid("turma")} style={lbl}>Turma</label>
          <select id={cid("turma")} value={turmaId} onChange={(e) => setTurmaId(e.target.value)} style={inputS}>
            <option value="" style={{ background: T.bg2 }}>— sem turma —</option>
            {turmas.map((t) => <option key={t.id} value={t.id} style={{ background: T.bg2 }}>{t.nome}</option>)}
          </select>
        </div>
        {concursos.length > 0 && (
          <div style={{ flex: 1, minWidth: 160 }}>
            <label htmlFor={cid("concurso")} style={lbl}>Concurso</label>
            <select id={cid("concurso")} value={concursoId || (cnId ?? "")}
              onChange={(e) => setConcursoId(e.target.value)} style={inputS}>
              {concursos.map((c) => (
                <option key={c.id} value={c.id} style={{ background: T.bg2 }}>
                  {c.nome} · {rotuloMaturidade(c.codigo)}
                </option>
              ))}
            </select>
          </div>
        )}
      </div>
      {/* Honestidade de conteúdo (PED2): concurso não-completo mostra o estado real. */}
      {codigoSel && maturidadeDe(codigoSel) !== "completa" && (
        <AvisoMaturidade codigo={codigoSel} style={{ marginBottom: 12 }} />
      )}
      <div style={{ border: `1px solid ${T.line}`, borderRadius: 8, padding: 12, marginBottom: 12 }}>
        <label style={{ display: "flex", gap: 10, alignItems: "flex-start", cursor: "pointer" }}>
          <input type="checkbox" checked={consentiu} onChange={(e) => setConsentiu(e.target.checked)}
            style={{ marginTop: 2, accentColor: T.gold, width: 20, height: 20, flexShrink: 0 }} />
          <span style={{ fontSize: 12.5, color: T.ink, lineHeight: 1.5 }}>
            Registrar o consentimento do responsável para o tratamento dos dados de estudo deste aluno (termo v1).
          </span>
        </label>
        {consentiu && (
          <div style={{ marginTop: 10 }}>
            <label htmlFor={cid("consent")} style={lbl}>Nome do responsável que consentiu</label>
            <input id={cid("consent")} value={consentimentoNome} onChange={(e) => setConsentimentoNome(e.target.value)} style={inputS} />
          </div>
        )}
      </div>
      {concursoBloqueado && (
        <div style={{ color: T.gold, fontSize: 12, marginBottom: 10 }}>
          Este concurso está indisponível (sem conteúdo). Escolha outro para cadastrar.
        </div>
      )}
      <Botao onClick={cadastrar} disabled={!pronto || ocupado}>
        {ocupado ? "Cadastrando…" : "+ Cadastrar aluno"}
      </Botao>
      {feito && <div style={{ color: T.green, fontSize: 13, marginTop: 10 }}>{feito}</div>}
      <Erro>{erro}</Erro>
    </div>
  );
}

// ────────────────────────────────────────────────────────────
// Importação em lote (nomes em texto OU CSV com preview)
// ────────────────────────────────────────────────────────────
export function NovosAlunos({ turmas, trilhaPadrao, concursos = [], aoMudar }) {
  const T = useTema();
  const { input: inputS, label: lbl } = useInputStyle();
  const uid = useId();
  const cid = (k) => `${uid}-${k}`;
  const [modo, setModo] = useState("texto"); // texto | csv
  const [nomes, setNomes] = useState("");
  const [csvLinhas, setCsvLinhas] = useState(null); // null = sem arquivo; array = preview
  const fileRef = useRef(null);
  const [turmaId, setTurmaId] = useState("");
  const [concursoId, setConcursoId] = useState("");
  const [consentimentoNome, setConsentimentoNome] = useState("");
  const [consentiu, setConsentiu] = useState(false);
  const { ocupado, erro, setErro, enviar } = useEnvioUnico("salvar"); // trava de duplo import
  const [feito, setFeito] = useState(null);

  // ── modo texto ──
  const linhasTexto = nomes.split("\n").map(limparNome).filter(Boolean);
  const listaTexto = linhasTexto.filter(nomeValido);
  const descartadosTexto = linhasTexto.length - listaTexto.length;
  const emLoteTexto = listaTexto.length > 1;

  // ── modo csv ──
  const linhasValidas = (csvLinhas ?? []).filter((l) => l.valido);
  const linhasInvalidas = (csvLinhas ?? []).filter((l) => !l.valido);

  function carregarCsv(e) {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      const texto = ev.target?.result ?? "";
      const linhas = parsearCsv(String(texto));
      const semCabecalho = detectarCabecalho(linhas) ? linhas.slice(1) : linhas;
      setCsvLinhas(validarLinhasCsv(semCabecalho, turmas));
      setFeito(null); setErro(null);
    };
    reader.readAsText(file, "utf-8");
  }

  function limparCsv() {
    setCsvLinhas(null);
    if (fileRef.current) fileRef.current.value = "";
  }

  // Maturidade do concurso: só completo recebe trilha semanal; indisponível
  // não recebe aluno (PED2). Evita herdar o calendário do CN por engano.
  const cnId = concursos.find((c) => c.codigo === "cn")?.id ?? null;
  const codigoSel = concursos.find((c) => c.id === (concursoId || cnId))?.codigo ?? null;
  const usaTrilhaSemanal = codigoSel ? podeAtribuirTrilhaSemanal(codigoSel) : false;
  const concursoBloqueado = codigoSel ? !aceitaAluno(codigoSel) : false;

  const prontoTexto = !concursoBloqueado && listaTexto.length > 0 && (!emLoteTexto || !consentiu || nomeValido(consentimentoNome));
  const prontoCsv = !concursoBloqueado && linhasValidas.length > 0;

  async function cadastrar() {
    if (concursoBloqueado) return;
    setFeito(null);
    await enviar(async () => {
      const concursoEscolhido = concursoId || cnId || null;
      const trilhaEscolhida = usaTrilhaSemanal ? (trilhaPadrao?.id ?? null) : null;

      if (modo === "csv") {
        const grupos = new Map();
        for (const l of linhasValidas) {
          const tid = l.turmaId || turmaId || null;
          const k = tid ?? "__sem_turma__";
          if (!grupos.has(k)) grupos.set(k, { turmaId: tid, nomes: [] });
          grupos.get(k).nomes.push(l.nome);
        }
        let total = 0;
        for (const { turmaId: tid, nomes: ns } of grupos.values()) {
          const alunos = await db.cadastrarAlunos(ns, tid, trilhaEscolhida, concursoEscolhido);
          await comConcorrenciaLimitada(alunos, CONCORRENCIA_GERAR_META, (a) =>
            db.gerarMeta(a.id).catch((e) => console.error(`gerar meta (aluno ${a.id}):`, e.message)),
          );
          total += alunos.length;
        }
        const avisoInvalidos = linhasInvalidas.length ? ` (${linhasInvalidas.length} linha(s) ignorada(s) por nome inválido)` : "";
        setFeito(`${total} aluno(s) importado(s) do CSV.${avisoInvalidos}`);
        limparCsv();
      } else {
        const alunos = await db.cadastrarAlunos(
          listaTexto, turmaId || null, trilhaEscolhida, concursoEscolhido,
        );
        if (!emLoteTexto && consentiu && nomeValido(consentimentoNome)) {
          await db.registrarConsentimento(alunos[0].id, limparNome(consentimentoNome));
        }
        await comConcorrenciaLimitada(alunos, CONCORRENCIA_GERAR_META, (a) =>
          db.gerarMeta(a.id).catch((e) => console.error(`gerar meta (aluno ${a.id}):`, e.message)),
        );
        setFeito(`${alunos.length} aluno(s) cadastrado(s). Gere as credenciais na lista abaixo.`);
        setNomes(""); setConsentimentoNome(""); setConsentiu(false);
      }
      aoMudar?.();
    });
  }

  const selS = { background: T.bg, border: `1px solid ${T.line}`, color: T.ink, borderRadius: 8, padding: "7px 9px", fontSize: 12.5 };
  const tabS = (ativo) => ({
    border: "none", background: "none", color: ativo ? T.gold : T.sub,
    borderBottom: `2px solid ${ativo ? T.gold : "transparent"}`, padding: "8px 14px",
    fontSize: 13, fontWeight: ativo ? 700 : 400, cursor: "pointer",
  });

  return (
    <div>
      <div style={{ display: "flex", gap: 0, marginBottom: 14, borderBottom: `1px solid ${T.line}` }}>
        <button style={tabS(modo === "texto")} onClick={() => { setModo("texto"); setFeito(null); }}>Nomes em texto</button>
        <button style={tabS(modo === "csv")} onClick={() => { setModo("csv"); setFeito(null); }}>Importar CSV</button>
      </div>

      {/* Configurações comuns: turma, concurso */}
      <div style={{ display: "flex", gap: 10, flexWrap: "wrap", marginBottom: 12 }}>
        {modo === "texto" || !csvLinhas ? (
          <div style={{ flex: 1, minWidth: 160 }}>
            <label htmlFor={cid("turma")} style={lbl}>Turma padrão</label>
            <select id={cid("turma")} value={turmaId} onChange={(e) => setTurmaId(e.target.value)} style={inputS}>
              <option value="" style={{ background: T.bg2 }}>— sem turma —</option>
              {turmas.map((t) => <option key={t.id} value={t.id} style={{ background: T.bg2 }}>{t.nome}</option>)}
            </select>
          </div>
        ) : null}
        {concursos.length > 0 && (
          <div style={{ flex: 1, minWidth: 160 }}>
            <label htmlFor={cid("concurso")} style={lbl}>Concurso</label>
            <select id={cid("concurso")} value={concursoId || (cnId ?? "")}
              onChange={(e) => setConcursoId(e.target.value)} style={inputS}>
              {concursos.map((c) => (
                <option key={c.id} value={c.id} style={{ background: T.bg2 }}>
                  {c.nome} · {rotuloMaturidade(c.codigo)}
                </option>
              ))}
            </select>
          </div>
        )}
        <div style={{ flex: 1, minWidth: 160 }}>
          <label htmlFor={cid("trilha")} style={lbl}>Trilha de estudo</label>
          <input id={cid("trilha")}
            value={usaTrilhaSemanal ? (trilhaPadrao?.nome ?? "—") : "Sem trilha semanal — usa a contagem do concurso"}
            disabled style={{ ...inputS, color: T.sub }} />
        </div>
      </div>

      {/* Honestidade de conteúdo (PED2): concurso não-completo mostra o estado real. */}
      {codigoSel && maturidadeDe(codigoSel) !== "completa" && (
        <AvisoMaturidade codigo={codigoSel} style={{ marginBottom: 12 }} />
      )}
      {concursoBloqueado && (
        <div style={{ color: T.gold, fontSize: 12, marginBottom: 10 }}>
          Este concurso está indisponível (sem conteúdo). Escolha outro para cadastrar.
        </div>
      )}

      {/* ── modo TEXTO ── */}
      {modo === "texto" && (
        <>
          <label htmlFor={cid("nomes")} style={lbl}>Nome(s) — um por linha</label>
          <textarea id={cid("nomes")} value={nomes} onChange={(e) => { setNomes(e.target.value); setFeito(null); }}
            rows={emLoteTexto ? 6 : 2}
            placeholder={"Maria da Silva\nJoão Souza"}
            style={{ ...inputS, resize: "vertical", fontFamily: "Archivo, sans-serif" }} />
          {descartadosTexto > 0 && (
            <div style={{ color: T.gold, fontSize: 12, marginTop: 8 }}>
              {descartadosTexto} linha(s) ignorada(s): cada nome precisa ter de 2 a 80 caracteres.
            </div>
          )}
          {!emLoteTexto && (
            <div style={{ marginTop: 12, border: `1px solid ${T.line}`, borderRadius: 8, padding: 12 }}>
              <label style={{ display: "flex", gap: 10, alignItems: "flex-start", cursor: "pointer" }}>
                <input type="checkbox" checked={consentiu} onChange={(e) => setConsentiu(e.target.checked)}
                  style={{ marginTop: 2, accentColor: T.gold, width: 20, height: 20, flexShrink: 0 }} />
                <span style={{ fontSize: 12.5, color: T.ink, lineHeight: 1.5 }}>
                  Registrar o consentimento do responsável para o tratamento dos dados de estudo deste aluno (termo v1).
                </span>
              </label>
              {consentiu && (
                <div style={{ marginTop: 10 }}>
                  <label htmlFor={cid("consent")} style={lbl}>Nome do responsável que consentiu</label>
                  <input id={cid("consent")} value={consentimentoNome} onChange={(e) => setConsentimentoNome(e.target.value)} style={inputS} />
                </div>
              )}
            </div>
          )}
          <Botao onClick={cadastrar} disabled={!prontoTexto || ocupado} style={{ marginTop: 14 }}>
            {ocupado ? "Cadastrando…" : emLoteTexto ? `+ Cadastrar ${listaTexto.length} alunos` : "+ Cadastrar aluno"}
          </Botao>
        </>
      )}

      {/* ── modo CSV ── */}
      {modo === "csv" && (
        <>
          {!csvLinhas ? (
            <div>
              <div style={{ fontSize: 12, color: T.sub, marginBottom: 10, lineHeight: 1.6 }}>
                Arquivo CSV, TSV ou Excel salvo como CSV. Colunas: <b>nome</b> (obrigatório), <b>turma</b> (opcional — deve bater exatamente com uma turma cadastrada).
                Linha de cabeçalho é detectada automaticamente.
              </div>
              <input ref={fileRef} type="file" accept=".csv,.tsv,.txt"
                onChange={carregarCsv} aria-label="Selecionar arquivo CSV de alunos"
                style={{ display: "block", marginBottom: 10, color: T.ink, fontSize: 13 }} />
            </div>
          ) : (
            <div>
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 10 }}>
                <div style={{ fontSize: 13, color: T.sub }}>
                  <b style={{ color: T.green }}>{linhasValidas.length}</b> válido(s)
                  {linhasInvalidas.length > 0 && <> · <b style={{ color: T.red }}>{linhasInvalidas.length}</b> inválido(s)</>}
                </div>
                <BotaoMini onClick={limparCsv}>Trocar arquivo</BotaoMini>
              </div>
              <div style={{ maxHeight: 260, overflowY: "auto", overflowX: "auto", border: `1px solid ${T.line}`, borderRadius: 8 }}>
                <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12.5, minWidth: 320 }}>
                  <thead>
                    <tr style={{ background: T.bg2, position: "sticky", top: 0 }}>
                      <th style={{ textAlign: "left", padding: "7px 10px", color: T.sub, fontWeight: 600, width: 30 }}>#</th>
                      <th style={{ textAlign: "left", padding: "7px 10px", color: T.sub, fontWeight: 600 }}>Nome</th>
                      <th style={{ textAlign: "left", padding: "7px 10px", color: T.sub, fontWeight: 600 }}>Turma</th>
                      <th style={{ textAlign: "left", padding: "7px 10px", color: T.sub, fontWeight: 600 }}>Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {csvLinhas.map((l) => (
                      <tr key={l.idx} style={{ borderTop: `1px solid ${T.line}`, opacity: l.valido ? 1 : 0.6 }}>
                        <td style={{ padding: "6px 10px", color: T.sub }}>{l.idx}</td>
                        <td style={{ padding: "6px 10px" }}>{l.nome || <em style={{ color: T.sub }}>vazio</em>}</td>
                        <td style={{ padding: "6px 10px", color: T.sub }}>{l.turmaNome || "—"}</td>
                        <td style={{ padding: "6px 10px" }}>
                          {l.valido
                            ? <span style={{ color: T.green, fontSize: 11 }}>✓ ok</span>
                            : <span style={{ color: T.red, fontSize: 11 }}>✗ {!nomeValido(l.nome) ? "nome inválido" : l.turmaErro}</span>
                          }
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              {linhasInvalidas.length > 0 && (
                <div style={{ color: T.gold, fontSize: 12, marginTop: 8 }}>
                  Linhas inválidas serão ignoradas. Apenas os {linhasValidas.length} nome(s) válidos serão importados.
                </div>
              )}
              <Botao onClick={cadastrar} disabled={!prontoCsv || ocupado} style={{ marginTop: 14 }}>
                {ocupado ? "Importando…" : `+ Importar ${linhasValidas.length} aluno(s)`}
              </Botao>
            </div>
          )}
        </>
      )}

      {feito && <div style={{ color: T.green, fontSize: 13, marginTop: 10 }}>{feito}</div>}
      <Erro>{erro}</Erro>
    </div>
  );
}

// ────────────────────────────────────────────────────────────
// Card wrapper para as seções de cadastro (aba "Alunos")
// ────────────────────────────────────────────────────────────
export function PainelCadastroAlunos({ turmas, trilhaPadrao, concursos = [], aoMudar }) {
  const T = useTema();
  const [aba, setAba] = useState("individual");
  // Colapsado por padrão (UX1.2): o formulário de cadastro não empurra
  // mais a LISTA de alunos para baixo — quem só quer consultar abre direto
  // a lista; quem vai cadastrar expande aqui.
  const [aberto, setAberto] = useState(false);

  const tabS = (ativo) => ({
    border: "none", background: "none", color: ativo ? T.gold : T.sub,
    borderBottom: `2px solid ${ativo ? T.gold : "transparent"}`, padding: "8px 14px",
    fontSize: 13, fontWeight: ativo ? 700 : 400, cursor: "pointer",
  });

  return (
    <Card>
      <button onClick={() => setAberto((v) => !v)} aria-expanded={aberto}
        style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10, width: "100%", border: "none", background: "transparent", textAlign: "left", padding: 0, color: T.ink, cursor: "pointer", minHeight: 40 }}>
        <span>
          <span className="disp" style={{ fontSize: 15, fontWeight: 700 }}>Cadastrar alunos</span>
          <span style={{ display: "block", fontSize: 12, color: T.sub, marginTop: 3 }}>
            Só o nome — nada de CPF nem documento (minimização, LGPD).
          </span>
        </span>
        <span style={{ flexShrink: 0, border: `1px solid ${aberto ? T.gold : T.line}`, background: aberto ? `${T.gold}14` : "transparent", color: aberto ? T.gold : T.sub, borderRadius: 8, fontSize: 12.5, fontWeight: 700, padding: "7px 13px", whiteSpace: "nowrap" }}>
          {aberto ? "Fechar ▴" : "+ Cadastrar ▾"}
        </span>
      </button>
      {aberto && (
        <div style={{ marginTop: 14 }}>
          <div style={{ display: "flex", gap: 0, marginBottom: 14, borderBottom: `1px solid ${T.line}` }}>
            <button style={tabS(aba === "individual")} onClick={() => setAba("individual")}>Individual</button>
            <button style={tabS(aba === "lote")} onClick={() => setAba("lote")}>Em lote</button>
          </div>
          {aba === "individual"
            ? <NovoAluno turmas={turmas} trilhaPadrao={trilhaPadrao} concursos={concursos} aoMudar={aoMudar} />
            : <NovosAlunos turmas={turmas} trilhaPadrao={trilhaPadrao} concursos={concursos} aoMudar={aoMudar} />
          }
        </div>
      )}
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

export function NovaTurma({ aoMudar }) {
  const { input: inputS, label: lbl } = useInputStyle();
  const uid = useId();
  const [nome, setNome] = useState("");
  const { ocupado, erro, enviar } = useEnvioUnico("salvar"); // trava de duplo "criar turma"

  async function criar() {
    if (!nomeValido(nome)) return;
    await enviar(async () => {
      await db.criarTurma(limparNome(nome));
      setNome("");
      aoMudar?.();
    });
  }

  return (
    <Card>
      <div className="disp" style={{ fontSize: 15, fontWeight: 700, marginBottom: 10 }}>Nova turma</div>
      <div style={{ display: "flex", gap: 10, flexWrap: "wrap", alignItems: "flex-end" }}>
        <div style={{ flex: 1, minWidth: 200 }}>
          <label htmlFor={`${uid}-turma`} style={lbl}>Nome da turma</label>
          <input id={`${uid}-turma`} value={nome} onChange={(e) => setNome(e.target.value)} placeholder="ex: Turma CN 2026 — manhã" style={inputS} />
        </div>
        <Botao onClick={criar} disabled={!nomeValido(nome) || ocupado}>{ocupado ? "Criando…" : "+ Criar turma"}</Botao>
      </div>
      <Erro>{erro}</Erro>
    </Card>
  );
}
