// ============================================================
// ETAPA 3 — artefatos do E2E, sanitizados
// ------------------------------------------------------------
// O que sobe do runner é SÓ o que sai daqui (e2e-artefatos/):
//   • resultados.json (com as medições da camada HTTP nas anotações),
//     jornadas.md e rede.jsonl;
//   • de cada teste que falhou: o error-context.md e o screenshot.
// Nunca sobem: trace, vídeo, relatório HTML (embute anexos e corpo de
// requisição), nem estado de autenticação salvo (storageState). Se
// existir arquivo de estado de autenticação em app/, o script reprova.
//
// Todo texto passa por redação antes de ser copiado: JWT, chave
// publicável/secreta, access/refresh token em JSON, as chaves da stack e
// as senhas da fixture. Depois, uma varredura final reprova se sobrou
// algo com cara de JWT.
// Uso: node scripts/e2e/sanitizar-artefatos.mjs [saida]
// ============================================================
import { readdirSync, readFileSync, writeFileSync, mkdirSync, statSync, copyFileSync, existsSync, rmSync } from "node:fs";
import { resolve, dirname, relative, join, basename } from "node:path";
import { fileURLToPath } from "node:url";
import { SENHA_E2E, SENHA_NOVA_E2E } from "./contas.mjs";
import { carregarLocalEnv } from "./ambiente.mjs";

const JWT = /eyJ[A-Za-z0-9_-]{8,}\.[A-Za-z0-9_-]{8,}\.[A-Za-z0-9_-]{8,}/g;
const CHAVE_SB = /sb_(publishable|secret)_[A-Za-z0-9_-]{8,}/g;
const TOKEN_JSON = /("(?:access_token|refresh_token|provider_token|provider_refresh_token)"\s*:\s*")[^"]*(")/g;
const BEARER = /(Bearer\s+)[A-Za-z0-9._-]{16,}/g;
const ESTADO_AUTH = /(storage-?state|\.auth\.json$|auth-state)/i;

export function redigir(texto, segredos = []) {
  let t = String(texto)
    .replace(JWT, "[JWT removido]")
    .replace(CHAVE_SB, "[chave removida]")
    .replace(TOKEN_JSON, "$1[token removido]$2")
    .replace(BEARER, "$1[token removido]");
  for (const s of segredos.filter((x) => x && x.length >= 8)) t = t.split(s).join("[segredo removido]");
  return t;
}

function listar(dir) {
  if (!existsSync(dir)) return [];
  return readdirSync(dir).flatMap((n) => {
    const p = join(dir, n);
    return statSync(p).isDirectory() ? listar(p) : [p];
  });
}

export function sanitizar({ origem, saida, appDir, segredos }) {
  // estado de autenticação salvo em qualquer lugar do app é reprovação
  const estados = listar(appDir).filter((p) => !p.includes("node_modules") && ESTADO_AUTH.test(basename(p)));
  if (estados.length) throw new Error(`estado de autenticação salvo no app: ${estados.map((p) => relative(appDir, p)).join(", ")}`);

  rmSync(saida, { recursive: true, force: true });
  mkdirSync(saida, { recursive: true });
  const copiados = [];
  // as medições da camada HTTP estão nas anotações do resultados.json
  const TEXTO = ["resultados.json", "jornadas.md", "rede.jsonl"];
  for (const nome of TEXTO) {
    const p = join(origem, nome);
    if (!existsSync(p)) continue;
    writeFileSync(join(saida, nome), redigir(readFileSync(p, "utf8"), segredos));
    copiados.push(nome);
  }
  for (const p of listar(join(origem, "saida"))) {
    const rel = relative(join(origem, "saida"), p);
    const destino = join(saida, "falhas", rel);
    if (p.endsWith("error-context.md")) {
      mkdirSync(dirname(destino), { recursive: true });
      writeFileSync(destino, redigir(readFileSync(p, "utf8"), segredos));
      copiados.push(`falhas/${rel}`);
    } else if (p.endsWith(".png")) {
      mkdirSync(dirname(destino), { recursive: true });
      copyFileSync(p, destino);
      copiados.push(`falhas/${rel}`);
    }
    // trace.zip, vídeo e qualquer outro anexo ficam de fora
  }
  // varredura final: nada com cara de JWT ou chave pode ter sobrado
  const sobras = listar(saida).filter((p) => !p.endsWith(".png"))
    .filter((p) => { const t = readFileSync(p, "utf8"); JWT.lastIndex = 0; CHAVE_SB.lastIndex = 0; return JWT.test(t) || CHAVE_SB.test(t); });
  if (sobras.length) throw new Error(`segredo sobrou nos artefatos: ${sobras.map((p) => relative(saida, p)).join(", ")}`);
  return copiados;
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const raiz = resolve(dirname(fileURLToPath(import.meta.url)), "../..");
  const env = carregarLocalEnv(process.env);
  const saida = resolve(process.argv[2] ?? `${raiz}/e2e-artefatos`);
  try {
    const copiados = sanitizar({
      origem: `${raiz}/app/e2e-resultados`, saida, appDir: `${raiz}/app`,
      segredos: [env.E2E_ANON_KEY, env.E2E_SERVICE_ROLE_KEY, SENHA_E2E, SENHA_NOVA_E2E,
        "super-secret-jwt-token-with-at-least-32-characters-long"],
    });
    console.log(`artefatos sanitizados em ${saida}: ${copiados.length} arquivo(s)`);
  } catch (e) {
    console.error(`::error::artefatos do E2E: ${e.message}`);
    process.exit(1);
  }
}
