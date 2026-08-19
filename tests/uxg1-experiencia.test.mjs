import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(fileURLToPath(new URL("..", import.meta.url)));
const ler = (p) => readFileSync(resolve(root, p), "utf8");

test("UXG2 mantém JSX/Vite e isola o motor de animação", () => {
  const main = ler("app/src/main.jsx");
  const pkg = JSON.parse(ler("app/package.json"));
  const vite = ler("app/vite.config.js");
  assert.match(main, /shared\/ui\/experiencia\.css/);
  assert.equal(pkg.dependencies?.tailwindcss, undefined);
  assert.equal(pkg.dependencies?.["framer-motion"], undefined);
  assert.match(pkg.dependencies?.motion, /^\^13\./);
  assert.match(vite, /return "motion"/);
  assert.match(vite, /motion-dom\|motion-utils\|framer-motion/);
});

test("UXG1 respeita preferência de movimento reduzido", () => {
  const css = ler("app/src/shared/ui/experiencia.css");
  const login = ler("app/src/routes/publico/Login.jsx");
  assert.match(css, /@media\s*\(prefers-reduced-motion:\s*reduce\)/);
  assert.match(css, /animation-duration:\s*\.01ms\s*!important/);
  // Movimento contínuo é proibido em superfície de leitura. A única
  // exceção permitida é o indicador de envio, que existe enquanto o
  // servidor responde e some junto com a espera.
  const blocosInfinitos = css.split("}").filter((b) => /infinite/.test(b));
  for (const bloco of blocosInfinitos) {
    assert.match(bloco, /login-loading/,
      `animação contínua fora do indicador de carregamento: ${bloco.trim().slice(0, 80)}`);
  }
  assert.match(login, /matchMedia\("\(prefers-reduced-motion: reduce\)"\)/);
  assert.match(login, /reducedMotion=\{fx\.ativos \? "user" : "always"\}/);
});

test("a entrada responde ao usuário sem inventar dado nem quebrar o fluxo", () => {
  const src = ler("app/src/routes/publico/Login.jsx");
  // troca de papel deslizante, operável por teclado
  assert.match(src, /login-role-pill/);
  assert.match(src, /ArrowDown/);
  assert.match(src, /role="group"/);
  // a carga do código é a MESMA regra que libera o botão
  assert.match(src, /const CODIGO_MIN = 12/);
  assert.match(src, /codigoLimpo\.length >= CODIGO_MIN/);
  assert.match(src, /length: CODIGO_MIN/);
  // aviso de Caps Lock só quando o evento informa o modificador
  assert.match(src, /getModifierState/);
  assert.match(src, /typeof e\.getModifierState !== "function"\) return/);
  // erro tem papel de alerta e sacode a superfície uma vez por recusa
  assert.match(src, /className="login-erro" role="alert"/);
  assert.match(src, /dataset\.tremor = "true"/);
  // o foco de luz não roda no toque nem para quem pediu menos movimento
  assert.match(src, /matchMedia\("\(pointer: fine\)"\)/);
  assert.match(src, /matchMedia\("\(prefers-reduced-motion: reduce\)"\)/);
  assert.match(src, /requestAnimationFrame/);
  // o fluxo continua o mesmo: mesmas chamadas de entrada
  assert.match(src, /db\.entrarComCodigo\(codigo\)/);
  assert.match(src, /db\.entrarComEmail\(email\.trim\(\), senha\)/);
  assert.match(src, /db\.recuperarSenha\(emailRecup\.trim\(\)\)/);
});

test("a entrada preserva os nomes acessíveis em que a suíte E2E se apoia", () => {
  const src = ler("app/src/routes/publico/Login.jsx");
  assert.match(src, /"Aluno \/ Responsável"/);
  assert.match(src, /"Coordenação"/);
  assert.match(src, />Código de acesso</);
  assert.match(src, /busy \? "Abrindo sua central…" : "Entrar na missão"/);
  // WCAG 2.5.3 (Label in Name): o nome acessível precisa CONTER o
  // rótulo visível. Um aria-label="Entrar" por cima de "Entrar na
  // missão" quebra comando de voz — e existia só para agradar a um
  // seletor de teste, que casa por substring de qualquer jeito.
  const cta = /<m\.button className="login-primary"[\s\S]*?>/.exec(src)?.[0] ?? "";
  assert.doesNotMatch(cta, /aria-label=/);
  assert.match(cta, /aria-busy=/);
});

test("teclado enxerga todo alvo operável", () => {
  const css = ler("app/src/shared/ui/experiencia.css");
  assert.match(css, /button:focus-visible/);
  assert.match(css, /outline: 2px solid var\(--ui-accent\)/);
});

test("login comunica a proposta e mantém uma ação primária", () => {
  const src = ler("app/src/routes/publico/Login.jsx");
  assert.match(src, /Sua prova tem um alvo/);
  assert.match(src, /Transforme o edital em missões/);
  assert.match(src, /aria-pressed=\{on\}/);
  assert.match(src, /className="login-primary" type="submit"/);
});

test("o pacote de features do Motion cobre tudo o que a entrada usa", () => {
  // domAnimation = renderer + animations + gestures. NÃO inclui layout:
  // com ele, `layout` e `layoutId` são ignorados em silêncio e a
  // animação simplesmente não acontece. Se a tela passar a depender de
  // layout animation, o pacote tem de virar domMax — e o custo de
  // bundle vira uma decisão consciente, não um efeito que não roda.
  const fontes = ["app/src/routes/publico/Login.jsx", "app/src/routes/publico/PortalLogin.jsx"]
    .map((caminho) => ler(caminho)).join("\n");
  const usaLayout = /\blayoutId=|\blayout\b(?==|\s*\/?>)/.test(fontes);
  const pacote = /features=\{(\w+)\}/.exec(fontes)?.[1];
  assert.ok(pacote, "a entrada precisa declarar o pacote de features do LazyMotion");
  if (usaLayout) {
    assert.equal(pacote, "domMax", "layout/layoutId exigem domMax — com domAnimation não animam");
  } else {
    assert.equal(pacote, "domAnimation", "sem layout animation, o pacote menor basta");
  }
});

test("a entrada não anuncia estado que não mede", () => {
  const fontes = ["app/src/routes/publico/Login.jsx", "app/src/routes/publico/PortalLogin.jsx"]
    .map((caminho) => ler(caminho)).join("\n");
  // "sistema online" seria um selo de saúde sem nenhuma verificação por
  // trás; "continue de onde parou" é falso para quem nunca entrou.
  assert.doesNotMatch(fontes, /SISTEMA ONLINE/i);
  assert.doesNotMatch(fontes, /CONTINUE DE ONDE PAROU/i);
});

test("portal visual representa método sem fabricar métricas do aluno", () => {
  const src = ler("app/src/routes/publico/PortalLogin.jsx");
  for (const conceito of ["Plano", "Prática", "Domínio", "PROGRESSO REAL"]) {
    assert.ok(src.includes(conceito), `conceito ausente do portal: ${conceito}`);
  }
  assert.doesNotMatch(src, /\b\d+\s*(XP|questões|dias de ofensiva)\b/i);
  assert.match(src, /aria-hidden="true"/);
});

test("efeitos vivos podem ser pausados e param fora da aba", () => {
  const login = ler("app/src/routes/publico/Login.jsx");
  const portal = ler("app/src/routes/publico/PortalLogin.jsx");
  assert.match(login, /visibilitychange/);
  assert.match(login, /raa:efeitos-login/);
  assert.match(portal, /Pausar efeitos visuais/);
  assert.match(portal, /aria-pressed=\{ativos\}/);
  assert.match(portal, /aria-label=\{rotulo\}/);
  for (const trecho of portal.matchAll(/repeat:\s*Infinity/g)) {
    const antes = portal.slice(Math.max(0, trecho.index - 260), trecho.index);
    assert.match(antes, /efeitos\s*\?/,
      "todo loop do portal precisa depender da preferência de efeitos");
  }
});

test("troca de papel e campos usam transição física sem trocar semântica", () => {
  const src = ler("app/src/routes/publico/Login.jsx");
  // O realce viaja por transform escrito no elemento. Nem layoutId
  // (precisa do pacote de layout, que não está carregado) nem var()
  // em custom property não registrada interpolam — os dois teleportam.
  assert.match(src, /className="login-role-pill"[^>]*\n?\s*style=\{\{ transform: `translateX/);
  assert.match(src, /type:\s*"spring"/);
  assert.match(src, /role="group"/);
  assert.match(src, /aria-pressed=\{on\}/);
  assert.match(src, /<label htmlFor=\{idCodigo\}/);
  assert.match(src, /<label htmlFor=\{idEmail\}/);
  assert.match(src, /<label htmlFor=\{idSenha\}/);
});

test("casca traduz o tema white-label para tokens CSS", () => {
  const src = ler("app/src/App.jsx");
  for (const token of ["--ui-bg", "--ui-card", "--ui-accent", "--ui-green", "--ui-red"]) {
    assert.ok(src.includes(`"${token}"`), `token ausente: ${token}`);
  }
});

test("missão, progresso e recompensa têm estados visuais identificáveis", () => {
  const hero = ler("app/src/modules/motor/MetaHero.jsx");
  const progresso = ler("app/src/modules/motor/ProgressoVivido.jsx");
  assert.match(hero, /className="mission-card"/);
  assert.match(hero, /className="mission-progress-fill"/);
  assert.match(hero, /className="mission-primary-action"/);
  assert.match(progresso, /reward-island/);
});
