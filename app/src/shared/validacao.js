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

/* URL de imagem segura para usar como `src` de <img> (logo white-label).
   Aceita só http(s) e data:image; descarta qualquer outro esquema
   (javascript:, vbscript:, etc.) e URLs malformadas. Devolve "" quando
   não for segura — o chamador então mostra o fallback (âncora). Fecha o
   fluxo que o CodeQL marca como "DOM text reinterpreted as HTML". */
export function urlImagemSegura(url) {
  const u = String(url ?? "").trim();
  if (!u) return "";
  if (/^data:image\//i.test(u)) return u;
  try {
    const parsed = new URL(u);
    if (parsed.protocol === "http:" || parsed.protocol === "https:") return parsed.href;
  } catch { /* URL malformada: descarta */ }
  return "";
}
