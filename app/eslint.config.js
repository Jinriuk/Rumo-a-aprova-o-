// ============================================================
// ESLint — Onda 0 do plano de correção dos 86 defeitos (12/09/2026).
// ------------------------------------------------------------
// O repositório nunca teve linter. Este config é a linha de base:
// pega regressão de import morto, dep de hook e alvo básico de a11y
// antes de qualquer correção manual das ondas seguintes.
//
// Regras de acessibilidade (jsx-a11y) entram TODAS como "warn", não
// "error" (o preset "recommended" do plugin marca praticamente tudo
// como error por padrão — forçamos a severidade abaixo em vez de
// listar regra por regra, que é frágil): a varredura catalogou ~30
// achados de a11y só na Onda 4 (I8: 100 <select> sem rótulo; T2: 23
// botões sem type; T3/T24: h2 nunca usado). Ligar como erro agora
// travaria o CI antes de existir onda para corrigi-los. Cada onda que
// fecha uma categoria promove a regra correspondente para "error" logo
// abaixo, para não regredir.
//
// eslint-plugin-react-hooks v7 (a única compatível com ESLint 9 hoje)
// trocou o conteúdo do preset "recommended": não é mais só
// rules-of-hooks/exhaustive-deps, agora inclui as regras de
// diagnóstico do REACT COMPILER (purity, set-state-in-effect,
// static-components, immutability, refs, ...). São achados REAIS
// (ex.: MenuPrincipal define componente dentro do render; Cronometro
// chama Date.now() na inicialização do useState) mas NÃO fazem parte
// dos 86 do catálogo — ligar como "error" travaria o CI por um
// trabalho fora de escopo desta rodada. Mantidas como "warn" aqui;
// viram recomendação de backlog separada, não onda deste plano.
//
// react-hooks/rules-of-hooks fica "error": é uma regra binária (ordem
// de chamada), sem zona cinzenta. Os 2 achados reais (PainelGestao.jsx,
// AreaAdmin.jsx/Dashboard — useState/useMemo chamados DEPOIS de um
// return condicional, risco real de a ordem dos hooks quebrar quando
// o dado chega async) foram corrigidos junto com a instalação — sem
// isso o gate nasceria vermelho por bug pré-existente, não regressão.
//
// react-hooks/exhaustive-deps fica "warn" nesta onda: são 17 achados
// pré-existentes, e diferente do rules-of-hooks cada um exige ler o
// componente para saber se a dependência "faltando" é omissão real
// ou supressão intencional (callback recriado a cada render que, se
// entrar no array, gera loop ou refetch indevido). Não é dev mecânico
// de Onda 0 — vira item de triagem por caso numa onda futura.
// ============================================================
import js from "@eslint/js";
import react from "eslint-plugin-react";
import reactHooks from "eslint-plugin-react-hooks";
import jsxA11y from "eslint-plugin-jsx-a11y";
import globals from "globals";

const a11yComoWarn = Object.fromEntries(
  Object.keys(jsxA11y.configs.recommended.rules).map((regra) => [regra, "warn"]),
);

export default [
  { ignores: ["dist/**", "playwright-report/**", "test-results/**"] },

  js.configs.recommended,

  {
    // Config files (Vite/Playwright) rodam em Node, não no browser.
    files: ["*.config.js"],
    languageOptions: { globals: { ...globals.node } },
  },

  {
    files: ["**/*.{js,jsx}"],
    ignores: ["*.config.js"],
    languageOptions: {
      ecmaVersion: 2023,
      sourceType: "module",
      parserOptions: { ecmaFeatures: { jsx: true } },
      globals: { ...globals.browser, ...globals.es2021 },
    },
    plugins: {
      react,
      "react-hooks": reactHooks,
      "jsx-a11y": jsxA11y,
    },
    settings: { react: { version: "19.2" } },
    rules: {
      ...react.configs.recommended.rules,
      ...a11yComoWarn,

      // Ver nota no cabeçalho: rules-of-hooks é error (zero débito
      // depois da correção); exhaustive-deps é warn (17 pré-existentes,
      // exigem triagem caso a caso, não fix mecânico desta onda).
      "react-hooks/rules-of-hooks": "error",
      "react-hooks/exhaustive-deps": "warn",

      // Diagnóstico do React Compiler (v7) — ver nota no cabeçalho.
      "react-hooks/static-components": "warn",
      "react-hooks/use-memo": "warn",
      "react-hooks/preserve-manual-memoization": "warn",
      "react-hooks/incompatible-library": "warn",
      "react-hooks/immutability": "warn",
      "react-hooks/globals": "warn",
      "react-hooks/refs": "warn",
      "react-hooks/set-state-in-effect": "warn",
      "react-hooks/error-boundaries": "warn",
      "react-hooks/purity": "warn",
      "react-hooks/set-state-in-render": "warn",
      "react-hooks/unsupported-syntax": "warn",
      "react-hooks/gating": "warn",

      // JSX runtime automático (React 19) — não precisa de import React.
      "react/react-in-jsx-scope": "off",
      "react/jsx-uses-react": "off",
      "react/prop-types": "off",

      // ruído alto em código com muito objeto de estilo inline —
      // mantém como warn para não afogar o que importa.
      "no-unused-vars": ["warn", { argsIgnorePattern: "^_", varsIgnorePattern: "^_" }],
    },
  },

  {
    // Testes Node (tests/) e scripts de operador rodam fora do browser.
    files: ["**/e2e/**/*.js", "**/*.spec.js"],
    languageOptions: {
      globals: { ...globals.node, ...globals.browser },
    },
  },
];
