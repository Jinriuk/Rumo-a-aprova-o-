/* Validação leve de entrada no cliente. A segurança de verdade está
   no banco (RLS + constraints); isto é higiene de UX: evita gravar
   nome vazio, só espaço, ou textão acidental colado de outro lugar. */

export const LIMITE_NOME = 80;

// Normaliza espaços e apara as pontas.
export function limparNome(texto) {
  return String(texto ?? "").replace(/\s+/g, " ").trim();
}

// Nome de pessoa/turma aceitável: 2..80 caracteres depois de limpo.
export function nomeValido(texto) {
  const n = limparNome(texto);
  return n.length >= 2 && n.length <= LIMITE_NOME;
}
