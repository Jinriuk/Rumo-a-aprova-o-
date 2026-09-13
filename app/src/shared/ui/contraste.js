/* Contraste WCAG 2.x de verdade + clareamento que preserva o matiz.
   Este módulo é COLORIMETRIA PURA: não conhece o tema, não conhece a
   escola. Quem amarra isso às superfícies do produto é tema.js.

   Por que o módulo existe (I12): o cálculo anterior aplicava os
   coeficientes BT.709 direto sobre bytes sRGB, sem expandir a gama.
   Isso é "luma", não luminância relativa — as duas divergem muito no
   escuro, que é justamente onde o tema vive. Sobre esse número errado
   rodava um clamp que mirava luminância ABSOLUTA (0.32) e ignorava o
   fundo, interpolando para #FFFFFF com um fator linear. Resultado
   medido: toda cor escura convergia para ~#525252 e entregava 1,95:1
   contra o card — abaixo de qualquer critério WCAG, e anunciado ao
   usuário como se estivesse resolvido. */

// ── sRGB ↔ luz linear (WCAG 2.x / IEC 61966-2-1) ──────────────────
const paraLinear = (canal) => {
  const c = canal / 255;
  return c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4);
};

const paraByte = (linear) => {
  const c = Math.max(0, Math.min(1, linear));
  const v = c <= 0.0031308 ? c * 12.92 : 1.055 * Math.pow(c, 1 / 2.4) - 0.055;
  return Math.max(0, Math.min(255, Math.round(v * 255)));
};

export const HEX_VALIDO = /^#[0-9a-fA-F]{6}$/;

function canais(hex) {
  const n = parseInt(hex.slice(1), 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

const paraHex = (r, g, b) =>
  `#${[r, g, b].map((v) => v.toString(16).padStart(2, "0")).join("")}`;

/* Luminância relativa WCAG: os coeficientes BT.709 entram DEPOIS da
   expansão de gama, sobre luz linear. É esta a diferença que o código
   antigo não fazia. */
export function luminanciaRelativa(hex) {
  const [r, g, b] = canais(hex);
  return 0.2126 * paraLinear(r) + 0.7152 * paraLinear(g) + 0.0722 * paraLinear(b);
}

/* Razão de contraste WCAG: (L_clara + 0.05) / (L_escura + 0.05).
   Vai de 1 (idênticas) a 21 (preto contra branco). */
export function razaoContraste(corA, corB) {
  const a = luminanciaRelativa(corA);
  const b = luminanciaRelativa(corB);
  return (Math.max(a, b) + 0.05) / (Math.min(a, b) + 0.05);
}

// ── OKLab / OKLCh (Björn Ottosson, 2020) ──────────────────────────
/* ESCOLHA DE PROJETO — por que OKLCh e não outra coisa.

   O requisito é subir a luminância SEM perder o matiz da escola. Três
   caminhos foram considerados e dois foram descartados por medição:

   1. Interpolar para #FFFFFF (o que o código antigo fazia). Move matiz
      E croma ao mesmo tempo: é literalmente a definição de lavar a cor.
      É a causa do "tudo vira cinza".

   2. Escalar o RGB linear por um fator k. Preserva a cromaticidade
      exatamente, mas quebra em dois pontos: não faz nada com #000000
      (0 × k = 0) e, para matizes saturados, satura o canal dominante
      antes de alcançar a luminância necessária.

   3. HSL. O matiz sobrevive por construção, mas o eixo "L" do HSL não
      é perceptual — uma varredura de L a matiz constante desloca o
      matiz aparente (efeito Abney; azul puxa para roxo) — e, pior, o
      croma real desaba sozinho conforme L→1, sem nenhuma alavanca
      para controlar quanto se perde.

   OKLCh resolve o que importa aqui: L é aproximadamente uniforme em
   percepção, H segura o matiz aparente enquanto L se move, e C fica
   como EIXO EXPLÍCITO. Isso permite a política que o produto quer —
   segurar o matiz sem abrir mão de croma, e cortar croma SÓ o quanto
   o gamut sRGB obrigar naquela luminância.

   E ele obriga. Esse é o fato colorimétrico que nenhuma escolha de
   espaço contorna: um matiz vermelho puro a croma cheia (#FF0000)
   tem luminância relativa 0,2126 e chega no máximo a 3,33:1 contra a
   superfície mais clara do tema; azul puro (#0000FF) chega a 1,55:1.
   Para esses matizes, 4,5:1 EXIGE perder croma. O algoritmo abaixo
   perde o mínimo necessário, e nem um ponto além. */

function linearParaOklab(r, g, b) {
  const l = Math.cbrt(0.4122214708 * r + 0.5363325363 * g + 0.0514459929 * b);
  const m = Math.cbrt(0.2119034982 * r + 0.6806995451 * g + 0.1073969566 * b);
  const s = Math.cbrt(0.0883024619 * r + 0.2817188376 * g + 0.6299787005 * b);
  return [
    0.2104542553 * l + 0.7936177850 * m - 0.0040720468 * s,
    1.9779984951 * l - 2.4285922050 * m + 0.4505937099 * s,
    0.0259040371 * l + 0.7827717662 * m - 0.8086757660 * s,
  ];
}

function oklabParaLinear(L, a, b) {
  const l = (L + 0.3963377774 * a + 0.2158037573 * b) ** 3;
  const m = (L - 0.1055613458 * a - 0.0638541728 * b) ** 3;
  const s = (L - 0.0894841775 * a - 1.2914855480 * b) ** 3;
  return [
    4.0767416621 * l - 3.3077115913 * m + 0.2309699292 * s,
    -1.2684380046 * l + 2.6097574011 * m - 0.3413193965 * s,
    -0.0041960863 * l - 0.7034186147 * m + 1.7076147010 * s,
  ];
}

/* Tolerância de gamut: 1e-4 em luz linear é bem abaixo de meio passo
   de 8 bits, então nada que passe aqui muda de byte no arredondamento. */
const DENTRO_DO_GAMUT = ([r, g, b]) => {
  const e = 1e-4;
  return r >= -e && r <= 1 + e && g >= -e && g <= 1 + e && b >= -e && b <= 1 + e;
};

/** hex → { L, C, H } em OKLCh (H em radianos). */
export function paraOklch(hex) {
  const [r, g, b] = canais(hex);
  const [L, a, bb] = linearParaOklab(paraLinear(r), paraLinear(g), paraLinear(b));
  return { L, C: Math.hypot(a, bb), H: Math.atan2(bb, a) };
}

/** OKLCh → hex sRGB, cortando o croma só até caber no gamut. */
export function deOklch({ L, C, H }) {
  let croma = C;
  const emL = (c) => oklabParaLinear(L, Math.cos(H) * c, Math.sin(H) * c);
  if (!DENTRO_DO_GAMUT(emL(croma))) {
    // maior croma que ainda cabe, neste L e neste matiz
    let baixo = 0, alto = croma;
    for (let i = 0; i < 28; i++) {
      const meio = (baixo + alto) / 2;
      if (DENTRO_DO_GAMUT(emL(meio))) baixo = meio; else alto = meio;
    }
    croma = baixo;
  }
  const [r, g, b] = emL(croma);
  return paraHex(paraByte(r), paraByte(g), paraByte(b));
}

/**
 * Devolve `cor` clareada até alcançar `alvo` de razão de contraste
 * contra `fundo`, mantendo o matiz. Se já alcança, devolve intacta.
 *
 * Sobe o L do OKLCh (matiz travado, croma como teto) até o hex de 8
 * bits REALMENTE medir `alvo`. O predicado da busca roda sobre a cor
 * já quantizada, então o resultado não depende de arredondamento
 * posterior: o que a função devolve é o que a função mediu.
 */
export function clarearAteRazao(cor, fundo, alvo) {
  if (!HEX_VALIDO.test(cor)) return cor;
  if (razaoContraste(cor, fundo) >= alvo) return cor;

  const { L, C, H } = paraOklch(cor);
  const passa = (l) => razaoContraste(deOklch({ L: l, C, H }), fundo) >= alvo;

  // L=1 é branco: contra qualquer superfície do tema escuro passa com
  // folga, então a busca sempre tem um extremo superior válido.
  let baixo = L, alto = 1;
  for (let i = 0; i < 40; i++) {
    const meio = (baixo + alto) / 2;
    if (passa(meio)) alto = meio; else baixo = meio;
  }

  /* Rede de segurança: a quantização para 8 bits não é estritamente
     monótona em L, então a fronteira da busca binária pode cair um
     passo abaixo. Avança em degraus pequenos até medir de fato. */
  let l = alto;
  let saida = deOklch({ L: l, C, H });
  while (l < 1 && razaoContraste(saida, fundo) < alvo) {
    l = Math.min(1, l + 0.002);
    saida = deOklch({ L: l, C, H });
  }
  return saida;
}
