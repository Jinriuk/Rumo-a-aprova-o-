/* Lista das regras de senha, sempre visível embaixo do campo: o aluno lê
   a regra antes de digitar e vê cada item virar ✓ (P1.1, mudança 1 do
   raio-x). A regra mora em shared/lib/senha.js, igual à do servidor. */
import { conferirSenha } from "../lib/senha.js";

const SO_LEITOR = { position: "absolute", width: 1, height: 1, overflow: "hidden", clip: "rect(0 0 0 0)", whiteSpace: "nowrap" };

export function RegrasSenha({ id, senha, T }) {
  return (
    <ul id={id} aria-label="A senha precisa ter" style={{ listStyle: "none", padding: 0, margin: "-4px 0 14px", fontSize: 12, lineHeight: 1.7 }}>
      {conferirSenha(senha).map((r) => (
        <li key={r.id} style={{ color: r.ok ? T.green : T.sub }}>
          <span aria-hidden="true" style={{ display: "inline-block", width: 16 }}>{r.ok ? "✓" : "○"}</span>
          {r.texto}
          <span style={SO_LEITOR}>{r.ok ? " (cumprida)" : " (falta)"}</span>
        </li>
      ))}
    </ul>
  );
}
