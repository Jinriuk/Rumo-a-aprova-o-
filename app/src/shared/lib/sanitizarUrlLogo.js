/* T37: sanitiza a URL do logo da escola ANTES de qualquer uso — seja
   como `src` de <img> (autofix CodeQL js/xss-through-dom) ou como
   `href` de link clicável. Aceita só data:image em base64 de formatos
   sem script (SVG fica de fora de propósito) OU URL absoluta http(s);
   qualquer outra coisa (javascript:, malformada…) vira "".

   Compartilhado entre Marca.jsx (preview + o que é gravado no banco),
   BrandingContext.jsx (o <img> real do sistema) e AreaAdmin.jsx (o
   href do backoffice) — um valor malicioso salvo por uma escola não
   pode virar um link cru clicado depois por um super-admin. */
export function sanitizarUrlLogo(valor) {
  const v = String(valor ?? "").trim();
  if (/^data:image\/(?:png|jpe?g|webp|gif);base64,[a-z0-9+/=]+$/i.test(v)) return v;
  try {
    const u = new URL(v);
    return (u.protocol === "https:" || u.protocol === "http:") ? u.toString() : "";
  } catch { return ""; }
}
