/* Onda 4 — I12: contraste da cor de acento (WCAG 1.4.3).

   O que este arquivo trava, e por quê.

   O clamp anterior (tema.js, `LUM_MINIMA = 0.32`) media "luma" — os
   coeficientes BT.709 aplicados direto sobre bytes sRGB, sem expandir
   a gama —, mirava uma luminância ABSOLUTA e nunca recebia o fundo
   como parâmetro. Medido antes da correção, contra o card #12273B:

     #050505 → #525252   1,95:1      #0B3D2E → #315b4f   1,99:1
     #000000 → #525252   1,95:1      #800000 → #9e3d3d   2,31:1
     #1a1a2e → #505060   1,93:1      #CDA349 → não clampa 6,48:1

   Piso sistemático de ~1,95:1 em toda cor escura, anunciado ao
   usuário como se resolvesse. Os testes abaixo medem a saída real com
   luminância relativa WCAG de verdade. Revertendo tema.js/contraste.js
   eles voltam a ~1,9:1 e quebram. */
import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";

import {
  luminanciaRelativa, razaoContraste, paraOklch,
} from "../app/src/shared/ui/contraste.js";
import {
  BASE, garantirLegivel, precisaClarear, tema,
  SUPERFICIES_DO_ACENTO, SUPERFICIE_CRITICA, RAZAO_MINIMA,
} from "../app/src/shared/ui/tema.js";

const root = resolve(fileURLToPath(new URL("..", import.meta.url)));
const ler = (p) => readFileSync(resolve(root, p), "utf8");

// Texto que o app põe POR CIMA do acento quando o acento é fundo de
// botão (componentes.jsx, `Botao`; Cronometro, Acumulado, Classificação).
const TINTA_SOBRE_ACENTO = "#0A1622";

/* As seis entradas do laudo. `esperaClamp: false` só para o dourado
   padrão, que já passa e não pode ser tocado. */
const CASOS = [
  { entrada: "#050505", nota: "quase preto (Curso Beta Preparatório, em produção)", esperaClamp: true },
  { entrada: "#000000", nota: "preto puro", esperaClamp: true },
  { entrada: "#1a1a2e", nota: "navy quase neutro", esperaClamp: true },
  { entrada: "#0B3D2E", nota: "verde escuro, matiz forte", esperaClamp: true },
  { entrada: "#800000", nota: "vinho", esperaClamp: true },
  { entrada: "#CDA349", nota: "dourado padrão", esperaClamp: false },
];

// ── a régua antes das medidas: a função de contraste está certa? ──

test("a razão de contraste bate com os valores de referência WCAG", () => {
  // extremos exatos definidos pela norma
  assert.equal(luminanciaRelativa("#FFFFFF"), 1);
  assert.equal(luminanciaRelativa("#000000"), 0);
  assert.equal(razaoContraste("#000000", "#FFFFFF"), 21);
  assert.equal(razaoContraste("#123456", "#123456"), 1);
  // simétrica: a ordem dos argumentos não pode importar
  assert.equal(razaoContraste("#0A1622", "#CDA349"), razaoContraste("#CDA349", "#0A1622"));

  // A gama TEM de ser expandida. #777777 sobre branco é 4,48:1 e
  // #767676 é 4,54:1 — o par clássico que separa reprovado de
  // aprovado. A luma sem expansão erra os dois.
  assert.ok(Math.abs(razaoContraste("#777777", "#FFFFFF") - 4.48) < 0.01);
  assert.ok(Math.abs(razaoContraste("#767676", "#FFFFFF") - 4.54) < 0.01);
  // meio-tom: 0,2159 em luz linear, não 0,502 de byte
  assert.ok(Math.abs(luminanciaRelativa("#808080") - 0.2159) < 0.001);
});

test("a superfície crítica é a mais clara das que recebem o acento", () => {
  const maisClara = SUPERFICIES_DO_ACENTO
    .reduce((a, b) => (luminanciaRelativa(b) > luminanciaRelativa(a) ? b : a));
  assert.equal(SUPERFICIE_CRITICA, maisClara);
  // goldSoft (#3a3320) é mais clara que cardHi: é fundo de texto no
  // acento em Cronometro.jsx e não é re-tematizada pela escola.
  assert.equal(SUPERFICIE_CRITICA, BASE.goldSoft);
  assert.ok(luminanciaRelativa(BASE.goldSoft) > luminanciaRelativa(BASE.cardHi));
  assert.match(ler("app/src/shared/ui/Cronometro.jsx"), /background: T\.goldSoft, color: T\.gold/);
});

// ── a tabela: os dois papéis, em todas as superfícies ──

for (const { entrada, nota, esperaClamp } of CASOS) {
  test(`${entrada} (${nota}) alcança ${RAZAO_MINIMA}:1 nos dois papéis`, () => {
    const saida = garantirLegivel(entrada);
    assert.match(saida, /^#[0-9a-fA-F]{6}$/);

    // papel A — acento como TEXTO sobre cada superfície do tema
    for (const [nomeSup, sup] of Object.entries(BASE)) {
      if (!SUPERFICIES_DO_ACENTO.includes(sup)) continue;
      const r = razaoContraste(saida, sup);
      assert.ok(r >= RAZAO_MINIMA,
        `texto ${saida} sobre ${nomeSup} (${sup}) = ${r.toFixed(2)}:1, exigido ${RAZAO_MINIMA}:1`);
    }

    // papel B — acento como FUNDO de botão, texto #0A1622 por cima
    const rBotao = razaoContraste(TINTA_SOBRE_ACENTO, saida);
    assert.ok(rBotao >= RAZAO_MINIMA,
      `texto ${TINTA_SOBRE_ACENTO} sobre botão ${saida} = ${rBotao.toFixed(2)}:1`);

    // o tema inteiro, não só a função solta
    assert.equal(tema(entrada).gold, saida);

    if (esperaClamp) {
      assert.notEqual(saida.toLowerCase(), entrada.toLowerCase());
      assert.equal(precisaClarear(entrada), true);
    } else {
      // cor que já passa sai INTACTA: o clamp não pode mexer no que já está bom
      assert.equal(saida, entrada);
      assert.equal(precisaClarear(entrada), false);
    }
  });
}

test("nenhuma saída reproduz o piso de ~1,95:1 do algoritmo antigo", () => {
  // as saídas exatas que o clamp quebrado produzia
  const saidasQuebradas = ["#525252", "#505060", "#315b4f", "#9e3d3d"];
  for (const { entrada } of CASOS) {
    const saida = garantirLegivel(entrada).toLowerCase();
    assert.ok(!saidasQuebradas.includes(saida),
      `${entrada} ainda produz a saída do algoritmo antigo (${saida})`);
    // e a razão contra o card sai bem acima do piso antigo
    assert.ok(razaoContraste(saida, BASE.card) > 3,
      `${entrada} → ${saida} continua perto do piso de 1,95:1`);
  }
});

// ── matiz: o ponto em que o algoritmo antigo falhava feio ──

const grau = (rad) => ((rad * 180) / Math.PI + 360) % 360;
const canal = (hex, i) => parseInt(hex.slice(1 + i * 2, 3 + i * 2), 16);

test("#0B3D2E (verde escuro) continua VERDE, não vira cinza", () => {
  const entrada = "#0B3D2E";
  const saida = garantirLegivel(entrada);

  const antes = paraOklch(entrada);
  const depois = paraOklch(saida);

  // matiz preservado (o antigo interpolava para #FFFFFF e lavava a cor)
  const desvio = Math.abs(((grau(depois.H) - grau(antes.H) + 540) % 360) - 180);
  assert.ok(desvio < 5,
    `matiz saiu de ${grau(antes.H).toFixed(0)}° para ${grau(depois.H).toFixed(0)}°`);

  // e CONTINUA colorido: croma preservado, não colapsado
  assert.ok(depois.C >= antes.C * 0.9,
    `croma caiu de ${antes.C.toFixed(3)} para ${depois.C.toFixed(3)}`);

  // teste grosso, em RGB puro: verde manda, e a cor não é acromática
  const [r, g, b] = [canal(saida, 0), canal(saida, 1), canal(saida, 2)];
  assert.ok(g > r && g > b, `${saida} não é dominante em verde (r=${r} g=${g} b=${b})`);
  assert.ok(Math.max(r, g, b) - Math.min(r, g, b) > 24,
    `${saida} está perto demais de cinza (amplitude ${Math.max(r, g, b) - Math.min(r, g, b)})`);

  // o antigo entregava #315b4f, com 1,99:1 contra o card
  assert.notEqual(saida.toLowerCase(), "#315b4f");
});

test("matizes fortes sobrevivem ao clareamento em toda a roda de cor", () => {
  const fortes = ["#800000", "#0B3D2E", "#00008B", "#4B0082", "#8B4513", "#006400"];
  for (const entrada of fortes) {
    const saida = garantirLegivel(entrada);
    const antes = paraOklch(entrada);
    const depois = paraOklch(saida);
    const desvio = Math.abs(((grau(depois.H) - grau(antes.H) + 540) % 360) - 180);
    assert.ok(desvio < 5, `${entrada} → ${saida}: matiz girou ${desvio.toFixed(1)}°`);
    assert.ok(depois.C > 0.05, `${entrada} → ${saida}: croma ${depois.C.toFixed(3)} — virou cinza`);
    assert.ok(razaoContraste(saida, SUPERFICIE_CRITICA) >= RAZAO_MINIMA);
  }
});

test("vermelho e azul puros perdem croma — e é o gamut que obriga", () => {
  /* Fato colorimétrico, não escolha de projeto: #FF0000 tem luminância
     relativa 0,2126 e dá no máximo 3,33:1 contra a superfície crítica;
     #0000FF dá 1,55:1. Nesses matizes, 4,5:1 é inalcançável a croma
     cheia. O algoritmo cede croma, e o aviso da tela diz isso. */
  for (const puro of ["#FF0000", "#0000FF"]) {
    assert.ok(razaoContraste(puro, SUPERFICIE_CRITICA) < RAZAO_MINIMA);
    const saida = garantirLegivel(puro);
    assert.ok(razaoContraste(saida, SUPERFICIE_CRITICA) >= RAZAO_MINIMA);
    assert.ok(paraOklch(saida).C < paraOklch(puro).C, `${puro} devia ter cedido croma`);
    // cedeu croma, mas NÃO o matiz
    const desvio = Math.abs(((grau(paraOklch(saida).H) - grau(paraOklch(puro).H) + 540) % 360) - 180);
    assert.ok(desvio < 5, `${puro} → ${saida}: matiz girou ${desvio.toFixed(1)}°`);
  }
});

// ── robustez e higiene ──

test("o clamp é idempotente e estável", () => {
  for (const { entrada } of CASOS) {
    const uma = garantirLegivel(entrada);
    assert.equal(garantirLegivel(uma), uma, `${entrada} muda ao passar duas vezes`);
  }
});

test("entrada inválida não derruba o tema", () => {
  for (const ruim of ["", "#GGG", "#12345", "vermelho", null, undefined, "#1234567"]) {
    assert.equal(tema(ruim), BASE);
    assert.equal(precisaClarear(ruim), false);
  }
});

test("o limiar de contraste existe em UM lugar só", () => {
  const marca = ler("app/src/modules/escola/Marca.jsx");
  const temaSrc = ler("app/src/shared/ui/tema.js");

  // o limiar antigo sumiu dos dois arquivos
  assert.ok(!/LUM_MINIMA/.test(temaSrc), "LUM_MINIMA ainda existe em tema.js");
  assert.ok(!/luminancia\(cor\)\s*<\s*0\.32/.test(marca), "limiar 0.32 ainda duplicado em Marca.jsx");
  assert.ok(!/\b0\.32\b/.test(marca), "número 0.32 ainda hardcoded em Marca.jsx");

  // Marca consome o limiar exportado, não uma cópia
  assert.match(marca, /precisaClarear/);
  assert.match(marca, /RAZAO_MINIMA/);
  assert.equal(RAZAO_MINIMA, 4.5);

  // a luma quebrada não sobreviveu em lugar nenhum
  assert.ok(!/export function luminancia\s*\(/.test(temaSrc),
    "a luma sem expansão de gama ainda é exportada");
});

test("o aviso da tela descreve o que o algoritmo faz de fato", () => {
  const marca = ler("app/src/modules/escola/Marca.jsx");
  // a frase antiga prometia legibilidade sem dizer contra o quê
  assert.ok(!/clareá-la automaticamente/.test(marca),
    "o texto antigo continua prometendo o que o algoritmo não entregava");
  // agora mostra a razão MEDIDA (antes e depois) e cita o critério
  assert.match(marca, /razaoOriginal/);
  assert.match(marca, /razaoAjustada/);
  assert.match(marca, /WCAG 1\.4\.3/);
  assert.match(marca, /matiz/);
  // e diz contra QUAL fundo mede — o pior, não "o fundo escuro"
  assert.match(marca, /fundo mais claro/);
  assert.match(marca, /SUPERFICIE_CRITICA/);

  /* A frase sobre saturação é CONDICIONAL: só aparece quando o croma
     cede de fato. Prometer perda de saturação num matiz que não perde
     é o mesmo defeito de antes, invertido. */
  assert.match(marca, /perdeuSaturacao/);
  assert.match(marca, /ceder satura/);
  assert.match(marca, /saturação é preservada/);
});

test("a expansão de gama está no código, não só no resultado", () => {
  const src = ler("app/src/shared/ui/contraste.js");
  assert.match(src, /0\.03928/);
  assert.match(src, /12\.92/);
  assert.match(src, /1\.055/);
  assert.match(src, /2\.4/);
  assert.match(src, /0\.05/); // o +0.05 da razão WCAG
});


test("o aviso só promete perda de saturação onde o croma cede de fato", () => {
  const croma = (h) => paraOklch(h).C;
  // matiz vermelho/azul fechado: o gamut sRGB obriga a ceder croma
  for (const cor of ["#FF0000", "#0000FF"]) {
    assert.ok(croma(garantirLegivel(cor)) < croma(cor) * 0.98,
      `${cor} devia ceder croma — o aviso condicional depende disso`);
  }
  // verde escuro e índigo: o croma sobrevive, então o aviso não deve aparecer
  for (const cor of ["#0B3D2E", "#4B0082", "#800000"]) {
    assert.ok(croma(garantirLegivel(cor)) >= croma(cor) * 0.98,
      `${cor} cedeu croma sem precisar`);
  }
  // acromático não tem matiz a perder: entra e sai neutro
  const preto = garantirLegivel("#000000");
  assert.ok(croma(preto) < 0.01, `#000000 → ${preto} deveria sair neutro`);
});

test("a garantia vale para o cubo de cor inteiro, não só para a tabela", () => {
  /* A escola escolhe a cor num seletor livre: a garantia não pode valer
     só para os seis casos do laudo. Varre 4.096 cores (passo 17 em cada
     canal) e exige os dois papéis em todas. */
  let piorTexto = Infinity, piorBotao = Infinity, pior = null;
  for (let r = 0; r < 256; r += 17) {
    for (let g = 0; g < 256; g += 17) {
      for (let b = 0; b < 256; b += 17) {
        const hex = `#${[r, g, b].map((x) => x.toString(16).padStart(2, "0")).join("")}`;
        const saida = garantirLegivel(hex);
        const comoTexto = razaoContraste(saida, SUPERFICIE_CRITICA);
        const comoBotao = razaoContraste(TINTA_SOBRE_ACENTO, saida);
        if (comoTexto < piorTexto) { piorTexto = comoTexto; pior = `${hex} → ${saida}`; }
        piorBotao = Math.min(piorBotao, comoBotao);
      }
    }
  }
  assert.ok(piorTexto >= RAZAO_MINIMA,
    `pior caso como texto: ${piorTexto.toFixed(4)}:1 em ${pior}`);
  assert.ok(piorBotao >= RAZAO_MINIMA,
    `pior caso como fundo de botão: ${piorBotao.toFixed(4)}:1`);
});
