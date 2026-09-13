// ============================================================
// Resolução do pacote `pg` para os scripts de operador.
// ------------------------------------------------------------
// Por que este arquivo existe: `checar-migrations.mjs` mandava rodar
// "cd tests && node ../scripts/checar-migrations.mjs" — e isso NUNCA
// funcionou. Em ESM, o especificador nu (`import("pg")`) é resolvido a
// partir do diretório do MÓDULO que importa (scripts/), não do
// diretório de trabalho (tests/). Como `pg` só existe em
// tests/node_modules, o import caía sempre no catch e o script saía
// com "pacote pg não encontrado" seguido da instrução que já estava
// sendo seguida.
//
// Consequência prática: a ferramenta de paridade que o backlog
// (BKL-014/015/017) usa como rede de segurança não era executável pela
// instrução dela mesma. É parte de por que o ledger de produção pôde
// ficar com 3 linhas de 49 sem ninguém tropeçar nisso.
//
// A correção resolve `pg` a partir de tests/node_modules por caminho
// absoluto, mantendo o import normal como primeira tentativa (para
// quando alguém instalar `pg` na raiz ou globalmente).
// ============================================================
import { createRequire } from "node:module";
import { dirname, resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const aqui = dirname(fileURLToPath(import.meta.url));

export async function carregarPg() {
  try {
    return await import("pg");
  } catch {
    // fallback: tests/node_modules/pg (o único lugar do repo que o tem)
    const req = createRequire(pathToFileURL(resolve(aqui, "..", "tests", "package.json")));
    try {
      const caminho = req.resolve("pg");
      return await import(pathToFileURL(caminho).href);
    } catch {
      return null;
    }
  }
}
