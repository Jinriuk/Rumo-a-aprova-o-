import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(fileURLToPath(new URL("..", import.meta.url)));
const ler = (p) => readFileSync(resolve(root, p), "utf8");

test("UXG1 carrega uma camada visual global sem trocar o stack", () => {
  const main = ler("app/src/main.jsx");
  const pkg = JSON.parse(ler("app/package.json"));
  assert.match(main, /shared\/ui\/experiencia\.css/);
  assert.equal(pkg.dependencies?.tailwindcss, undefined);
  assert.equal(pkg.dependencies?.["framer-motion"], undefined);
  assert.equal(pkg.dependencies?.motion, undefined);
});

test("UXG1 respeita preferência de movimento reduzido", () => {
  const css = ler("app/src/shared/ui/experiencia.css");
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
  assert.match(src, /busy \? "Entrando…" : "Entrar"/);
});

test("teclado enxerga todo alvo operável", () => {
  const css = ler("app/src/shared/ui/experiencia.css");
  assert.match(css, /button:focus-visible/);
  assert.match(css, /outline: 2px solid var\(--ui-accent\)/);
});

test("login comunica a proposta e mantém uma ação primária", () => {
  const src = ler("app/src/routes/publico/Login.jsx");
  assert.match(src, /Sua aprovação vira uma/);
  assert.match(src, /missão central por vez/);
  assert.match(src, /aria-pressed=\{on\}/);
  assert.match(src, /className="login-primary"\s+type="submit"/);
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
