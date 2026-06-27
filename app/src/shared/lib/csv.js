/* ============================================================
   CSV — serialização pura (sem React, sem DOM) e o gatilho de
   download (este sim toca o navegador). Separados de propósito:
   `paraCSV` é testável sem banco nem browser; `baixarCSV` só
   embrulha o Blob.
   ------------------------------------------------------------
   SEGURANÇA / TENANT: este módulo NÃO busca dado. Ele só formata
   as linhas que a tela já tem em mãos — e a tela só tem o que a
   RLS entregou para a escola logada. Não há como exportar dado de
   outra escola por aqui: o CSV é um espelho do array recebido.
   ------------------------------------------------------------
   Excel pt-BR: separador `;` por padrão e BOM UTF-8 no download,
   senão acento sai quebrado e tudo cai numa coluna só.
   ============================================================ */

// Uma célula precisa de aspas se contém o separador, aspas, ou
// quebra de linha. Aspas internas viram aspas duplicadas (RFC 4180).
// `null`/`undefined` viram string vazia — nunca o texto "null".
function celula(valor, separador) {
  if (valor === null || valor === undefined) return "";
  const s = String(valor);
  if (s.includes(separador) || s.includes('"') || s.includes("\n") || s.includes("\r")) {
    return `"${s.replace(/"/g, '""')}"`;
  }
  return s;
}

/* Monta o texto CSV.
   - `colunas`: [{ chave, rotulo }] — define ordem e cabeçalho.
   - `linhas`:  array de objetos; cada um lido por `coluna.chave`.
   Devolve string com cabeçalho + linhas separadas por CRLF (Excel). */
export function paraCSV(colunas, linhas, { separador = ";" } = {}) {
  const cab = colunas.map((c) => celula(c.rotulo ?? c.chave, separador)).join(separador);
  const corpo = (linhas ?? []).map((linha) =>
    colunas.map((c) => celula(linha[c.chave], separador)).join(separador),
  );
  return [cab, ...corpo].join("\r\n");
}

/* Dispara o download no navegador. Best-effort: se não houver DOM
   (SSR/teste), não faz nada e devolve false. BOM UTF-8 na frente
   para o Excel pt-BR ler acento corretamente. */
export function baixarCSV(nomeArquivo, conteudoCSV) {
  if (typeof document === "undefined" || typeof URL === "undefined") return false;
  const blob = new Blob(["﻿", conteudoCSV], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = nomeArquivo.endsWith(".csv") ? nomeArquivo : `${nomeArquivo}.csv`;
  link.click();
  URL.revokeObjectURL(url);
  return true;
}

// Nome de arquivo seguro a partir de um rótulo livre (nome de escola/
// turma): sem espaço, sem acento perdido virar caractere inválido.
export function nomeArquivoSeguro(base, sufixoData = true) {
  const limpo = String(base ?? "relatorio")
    .normalize("NFD").replace(/[̀-ͯ]/g, "") // tira acento
    .replace(/[^a-zA-Z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .toLowerCase() || "relatorio";
  if (!sufixoData) return limpo;
  const hoje = new Date().toISOString().slice(0, 10);
  return `${limpo}-${hoje}`;
}
