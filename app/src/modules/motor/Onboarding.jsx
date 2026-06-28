/* ============================================================
   ONBOARDING PEDAGÓGICO DO ALUNO (PED1) — diagnóstico inicial.
   ------------------------------------------------------------
   Antes ficava dormente (só a coordenação escrevia). Agora o próprio
   aluno responde o diagnóstico na 1ª vez, por um RPC SECURITY DEFINER
   que grava só a linha dele (sem enfraquecer a RLS). É insumo, não
   regra: alimenta a leitura da coordenação e o ponto de partida.
   ============================================================ */
import React, { useId, useState } from "react";
import { SectionCard, Botao, Erro, useInputStyle } from "../../shared/ui/componentes.jsx";
import { useTema } from "../../shared/branding/BrandingContext.jsx";
import { mensagemAmigavel } from "../../shared/lib/erros.js";
import * as db from "../../shared/data/index.js";

const ROTULO_MATERIA = { mat: "Matemática", por: "Português", ing: "Inglês", fis: "Física", qui: "Química", bio: "Biologia", his: "História", geo: "Geografia", red: "Redação", soc: "Estudos Sociais" };

const EXPERIENCIAS = [
  ["nunca estudou", "Estou começando agora"],
  ["estuda há alguns meses", "Estudo há alguns meses"],
  ["estuda há 1 ano ou mais", "Estudo há 1 ano ou mais"],
  ["ja prestou prova", "Já prestei essa prova antes"],
];

export function Onboarding({ aluno, materias = [], aoConcluir }) {
  const T = useTema();
  const { input: inputS, label: lbl } = useInputStyle();
  const [f, setF] = useState({ experiencia: "", disponibilidade: "", dificuldade: "", objetivo: "" });
  const [erro, setErro] = useState(null);
  const [ocupado, setOcupado] = useState(false);
  const set = (k, v) => setF({ ...f, [k]: v });
  const uid = useId();
  const id = (k) => `${uid}-${k}`;

  const dispNum = f.disponibilidade === "" ? null : Number(f.disponibilidade);
  const dispInvalida = dispNum != null && (!Number.isFinite(dispNum) || dispNum < 0 || dispNum > 168);
  const podeSalvar = f.experiencia !== "" && !dispInvalida && !ocupado;

  async function salvar() {
    if (!podeSalvar) return;
    setOcupado(true); setErro(null);
    try {
      await db.salvarOnboardingAluno({
        experiencia: f.experiencia || null,
        disponibilidade: dispNum,
        dificuldade: f.dificuldade || null,
        objetivo: f.objetivo.trim() || null,
      });
      aoConcluir?.();
    } catch (e) { setErro(mensagemAmigavel(e, "salvar")); }
    setOcupado(false);
  }

  return (
    <SectionCard
      titulo={`Bem-vindo, ${aluno.nome.split(" ")[0]}!`}
      sub="Antes de começar, conte rapidinho seu ponto de partida. Leva 30 segundos e ajuda a orientar seu estudo."
    >
      <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
        <div>
          <label htmlFor={id("exp")} style={lbl}>Como está sua preparação hoje? <span style={{ color: T.gold }}>*</span></label>
          <select id={id("exp")} value={f.experiencia} onChange={(e) => set("experiencia", e.target.value)} style={inputS}>
            <option value="" style={{ background: T.bg2 }}>Escolha uma opção…</option>
            {EXPERIENCIAS.map(([v, txt]) => <option key={v} value={v} style={{ background: T.bg2 }}>{txt}</option>)}
          </select>
        </div>

        <div style={{ maxWidth: 260 }}>
          <label htmlFor={id("disp")} style={lbl}>Quantas horas por semana você consegue estudar?</label>
          <input id={id("disp")} type="number" inputMode="numeric" min="0" max="168" value={f.disponibilidade}
            onChange={(e) => set("disponibilidade", e.target.value)} placeholder="ex: 20"
            aria-invalid={dispInvalida ? true : undefined}
            style={{ ...inputS, borderColor: dispInvalida ? T.red : T.line }} />
          {dispInvalida && <div style={{ fontSize: 12, color: T.red, marginTop: 6 }}>Use um número de horas entre 0 e 168.</div>}
        </div>

        <div>
          <label htmlFor={id("dif")} style={lbl}>Qual matéria mais te preocupa?</label>
          <select id={id("dif")} value={f.dificuldade} onChange={(e) => set("dificuldade", e.target.value)} style={inputS}>
            <option value="" style={{ background: T.bg2 }}>Prefiro não dizer ainda</option>
            {materias.map((mt) => {
              const cod = mt.codigo ?? mt.materia_codigo;
              const nome = mt.nome ?? ROTULO_MATERIA[cod] ?? cod;
              return <option key={cod} value={cod} style={{ background: T.bg2 }}>{nome}</option>;
            })}
          </select>
        </div>

        <div>
          <label htmlFor={id("obj")} style={lbl}>Seu objetivo (opcional)</label>
          <input id={id("obj")} value={f.objetivo} onChange={(e) => set("objetivo", e.target.value)}
            placeholder="ex: passar no Colégio Naval em 2026" style={inputS} />
        </div>

        <Botao onClick={salvar} disabled={!podeSalvar} style={{ width: "100%" }}>
          {ocupado ? "Salvando…" : "Começar minha jornada →"}
        </Botao>
        <Erro>{erro}</Erro>
      </div>
    </SectionCard>
  );
}
