/* ============================================================
   Força de senha — lógica PURA, compartilhada entre toda tela que
   pede senha nova (RedefinirSenha via link de recuperação,
   TrocarSenhaObrigatoria no primeiro acesso). Um piso só: mudar o
   critério aqui muda nas duas telas ao mesmo tempo, sem risco de
   uma ficar mais branda que a outra.

   Espelha o piso do SERVIDOR (Edge Function trocar-senha:
   senhaFraca) — o servidor recusa o que o cliente já teria barrado;
   o cliente só dá o feedback incremental (cor, texto) enquanto o
   usuário digita.
   ============================================================ */
export function forcaSenha(s) {
  if (s.length < 8) return { nivel: 0, texto: "Muito curta (mín. 8 caracteres)" };
  const tem = [/[A-Z]/, /[a-z]/, /[0-9]/, /[^A-Za-z0-9]/].filter((r) => r.test(s)).length;
  if (tem <= 1) return { nivel: 1, texto: "Fraca — adicione letras maiúsculas, números ou símbolos" };
  if (tem === 2) return { nivel: 2, texto: "Razoável" };
  return { nivel: 3, texto: "Forte" };
}

// Mesmo piso mínimo de aceite usado nas telas (nível >= 2 libera o botão).
export const NIVEL_MINIMO_ACEITAVEL = 2;
