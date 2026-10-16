/* ============================================================
   Regra de senha — lógica PURA, compartilhada entre toda tela que
   pede senha nova (RedefinirSenha via link de recuperação,
   TrocarSenhaObrigatoria no primeiro acesso). Um piso só: mudar o
   critério aqui muda nas duas telas ao mesmo tempo.

   É a MESMA regra do servidor de autenticação (demo e produção):
   8 caracteres ou mais, com letra minúscula, letra maiúscula e número
   (P1.1, 13/10). Antes a tela aceitava "duas classes quaisquer" e o
   Auth recusava, por exemplo, uma senha sem número: o aluno via a
   senha marcada como "Forte" e depois um erro genérico. Espelhada na
   Edge Function trocar-senha (senhaFraca); tests/etapa7-bloco-b-
   credencial confere que as duas aceitam e recusam as mesmas senhas.
   ============================================================ */
export const REGRAS_SENHA = [
  { id: "tamanho", texto: "8 caracteres ou mais", ok: (s) => s.length >= 8 },
  { id: "minuscula", texto: "uma letra minúscula", ok: (s) => /[a-z]/.test(s) },
  { id: "maiuscula", texto: "uma letra maiúscula", ok: (s) => /[A-Z]/.test(s) },
  { id: "numero", texto: "um número", ok: (s) => /[0-9]/.test(s) },
];

export const REGRA_SENHA_TEXTO = "8 caracteres ou mais, com letra minúscula, letra maiúscula e número";

// Cada regra com ok true/false, na ordem em que a tela mostra.
export function conferirSenha(s) {
  const v = typeof s === "string" ? s : "";
  return REGRAS_SENHA.map(({ id, texto, ok }) => ({ id, texto, ok: ok(v) }));
}

export function senhaAceita(s) {
  return conferirSenha(s).every((r) => r.ok);
}

// Nível para a cor do campo: 0 curta, 1 falta classe, 2 aceita, 3 forte
// (aceita e com símbolo ou 12+ caracteres). Só nível >= 2 libera o botão.
export function forcaSenha(s) {
  const v = typeof s === "string" ? s : "";
  if (!senhaAceita(v)) {
    const faltam = conferirSenha(v).filter((r) => !r.ok).map((r) => r.texto);
    return { nivel: v.length < 8 ? 0 : 1, texto: `Falta: ${faltam.join(", ")}` };
  }
  if (/[^A-Za-z0-9]/.test(v) || v.length >= 12) return { nivel: 3, texto: "Forte" };
  return { nivel: 2, texto: "Aceita" };
}

export const NIVEL_MINIMO_ACEITAVEL = 2;
