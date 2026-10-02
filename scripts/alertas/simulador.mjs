// ============================================================
// ETAPA 4 — Resend e healthchecks SIMULADOS para a prova na stack local
// ------------------------------------------------------------
// Um servidor HTTP que finge ser os dois serviços externos:
//   POST /emails            → o que a função mandaria ao Resend
//   GET|POST /hc/<uuid>[/fail] → o ping do healthchecks (pg_net)
// Cada pedido vira uma linha JSON em $SIMULADOR_LOG. Nada sai da
// máquina. Escuta em 0.0.0.0 para os containers da stack alcançarem
// pelo IP do host na rede do Docker.
// Uso: SIMULADOR_LOG=arquivo SIMULADOR_PORTA=54399 node simulador.mjs
// ============================================================
import http from "node:http";
import { appendFileSync } from "node:fs";

const LOG = process.env.SIMULADOR_LOG || "simulador.jsonl";
const PORTA = +(process.env.SIMULADOR_PORTA || 54399);

http.createServer((req, res) => {
  let corpo = "";
  req.on("data", (c) => { corpo += c; if (corpo.length > 1e6) req.destroy(); });
  req.on("end", () => {
    let json = null;
    try { json = corpo ? JSON.parse(corpo) : null; } catch { /* corpo não-JSON fica como texto */ }
    const tipo = req.url === "/emails" ? "email" : req.url.startsWith("/hc/") ? "healthchecks" : "outro";
    appendFileSync(LOG, JSON.stringify({ em: new Date().toISOString(), tipo, metodo: req.method, url: req.url, autorizacao: req.headers.authorization ? "presente" : "ausente", corpo: json ?? corpo }) + "\n");
    res.writeHead(200, { "content-type": "application/json" });
    res.end(tipo === "email" ? JSON.stringify({ id: `simulado-${Date.now()}` }) : "OK");
  });
}).listen(PORTA, "0.0.0.0", () => console.log(`simulador (Resend + healthchecks) em 0.0.0.0:${PORTA}, log em ${LOG}`));
