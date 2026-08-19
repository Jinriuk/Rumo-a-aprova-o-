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
  assert.doesNotMatch(css, /animation(?:-iteration-count)?\s*:[^;]*infinite/i);
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
