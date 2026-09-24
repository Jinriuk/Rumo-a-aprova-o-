// ============================================================
// Pack de capturas v2 (Bloco 5, P01 a P07) — funções PURAS
// ------------------------------------------------------------
// Sem navegador, sem rede, sem dependência: é o que os testes
// (tests/bloco5-captura.test.mjs) exercitam. O runner que abre o
// navegador fica em pack-v2.mjs e só chama o que está aqui.
// ============================================================

// Os seis segredos do repositório que o workflow repassa ao runner.
// Só os NOMES moram no código; os valores nunca são escritos em
// arquivo, log, manifesto ou PR (o runner confere isso no fim).
export const SEGREDOS = [
  "TRILIVA_CAPTURA_COORD_EMAIL",
  "TRILIVA_CAPTURA_COORD_SENHA",
  "TRILIVA_CAPTURA_ALUNO_CODIGO",
  "TRILIVA_CAPTURA_ALUNO_SENHA",
  "TRILIVA_CAPTURA_RESP_CODIGO",
  "TRILIVA_CAPTURA_RESP_SENHA",
];

// P07: o identificador do projeto vai só para o arquivo interno.
export const PROJETO_DEMO = "bdjkgrzfzoamchdpobbl";
export const ESCOLA_DEMO = "Instituto Meridiano";
export const ALUNA_REFERENCIA = "Helena Vasconcelos";

// Os quatro tenants que não podem aparecer em nenhuma captura.
export const TENANTS_PROIBIDOS = /Colégio e Curso Ícone|Escola Piloto I1|Curso Beta Preparatório|Matriz Educação RM/i;

export const MARGEM_RECORTE = 24; // P03: px CSS
export const VOLUME_MINIMO = 20;  // piso do pódio (LIMIAR.VOLUME_MINIMO)

// ── datas (America/Sao_Paulo) ─────────────────────────────────
function partesLocais(agora) {
  const f = new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Sao_Paulo", year: "numeric", month: "2-digit", day: "2-digit",
    hour: "2-digit", minute: "2-digit", weekday: "short", hourCycle: "h23",
  });
  return Object.fromEntries(f.formatToParts(agora).map((p) => [p.type, p.value]));
}

export function dataLocal(agora = new Date()) {
  const p = partesLocais(agora);
  return `${p.year}-${p.month}-${p.day}`;
}

// Seção 3.3/9.1: os números só batem com as apresentações no sábado
// depois das 18:00 de Brasília. A captura oficial exige a janela; o
// ensaio (captura de teste) não.
export function janelaOficial(agora = new Date()) {
  const p = partesLocais(agora);
  const hora = Number(p.hour);
  if (p.weekday !== "Sat") return { ok: false, motivo: `hoje não é sábado em Brasília (${p.weekday} ${p.hour}:${p.minute})` };
  if (hora < 18) return { ok: false, motivo: `sábado antes das 18:00 em Brasília (${p.hour}:${p.minute})` };
  return { ok: true, motivo: `sábado ${p.hour}:${p.minute} em Brasília` };
}

// P01: versão no nome, sem o sufixo de download "_1_1".
export function nomeDoPack(dataIso) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(dataIso)) throw new Error(`data do pack fora do formato AAAA-MM-DD: ${dataIso}`);
  return `pack-triliva-v2-${dataIso}`;
}

// ── recorte (P03) ─────────────────────────────────────────────
// Retângulos em px CSS, coordenadas do DOCUMENTO (não da janela).
const direita = (r) => r.x + r.width;
const base = (r) => r.y + r.height;
const area = (r) => Math.max(0, r.width) * Math.max(0, r.height);

function uniao(rs) {
  const x = Math.min(...rs.map((r) => r.x)), y = Math.min(...rs.map((r) => r.y));
  return { x, y, width: Math.max(...rs.map(direita)) - x, height: Math.max(...rs.map(base)) - y };
}
function expandir(r, m, pagina) {
  const x = Math.max(0, r.x - m), y = Math.max(0, r.y - m);
  return {
    x, y,
    width: Math.min(pagina.width, direita(r) + m) - x,
    height: Math.min(pagina.height, base(r) + m) - y,
  };
}
function naPagina(r, pagina) {
  const x = Math.max(0, r.x), y = Math.max(0, r.y);
  return { x, y, width: Math.min(pagina.width, direita(r)) - x, height: Math.min(pagina.height, base(r)) - y };
}
function intersecta(a, b) {
  return a.x < direita(b) && b.x < direita(a) && a.y < base(b) && b.y < base(a);
}
function contem(fora, dentro) {
  return dentro.x >= fora.x && dentro.y >= fora.y && direita(dentro) <= direita(fora) && base(dentro) <= base(fora);
}

// `alvo`: o componente a recortar. `componentes`: as outras caixas e
// linhas de texto visíveis (sem os ancestrais e os descendentes do alvo).
// Regra: margem de 24 px em volta, e nenhum componente pela metade.
//   1. Quem contém o alvo inteiro é pano de fundo (camada decorativa,
//      gradiente): pode ser recortado, é o fundo do recorte.
//   2. Um vizinho que entra só em parte na margem é incluído inteiro (até
//      4 rodadas e até 60% da página).
//   3. Se isso não fechar: quem SOBREPÕE o alvo entra inteiro (não tem
//      lado para onde encolher), e a margem de cada lado encolhe até o
//      vizinho mais próximo; o recorte sai marcado "margem_reduzida".
//   4. Conferência final: se ainda houver componente cortado, não há
//      recorte válido ("sem_recorte_valido", rect null). Nunca meio
//      componente.
export function retanguloDeRecorte({ alvo, componentes = [], pagina, margem = MARGEM_RECORTE }) {
  // só a parte visível conta: o que passa da borda da página (overflow-x:
  // clip, faixa com rolagem lateral) já está fora da imagem integral
  const vizinhos = componentes.map((c) => naPagina(c, pagina))
    .filter((c) => c.width > 0 && c.height > 0 && !contem(c, alvo));
  const limiteArea = 0.6 * area(pagina);
  let caixa = { ...alvo };
  const incluidos = [];
  for (let rodada = 0; rodada < 4; rodada++) {
    const faixa = expandir(caixa, margem, pagina);
    const parciais = vizinhos.filter((c) => intersecta(c, faixa) && !contem(faixa, c) && !contem(caixa, c));
    if (!parciais.length) {
      return { rect: faixa, margens: margensDe(faixa, alvo), incluidos, aviso: null };
    }
    const nova = uniao([caixa, ...parciais]);
    if (area(nova) > limiteArea) break;
    incluidos.push(...parciais);
    caixa = nova;
  }
  let nucleo = { ...alvo };
  for (let i = 0; i < 10; i++) {
    const sobre = vizinhos.filter((c) => intersecta(c, nucleo) && !contem(nucleo, c));
    if (!sobre.length) break;
    nucleo = uniao([nucleo, ...sobre]);
  }
  const faixa = expandir(nucleo, margem, pagina);
  let { x, y } = faixa;
  let dir = direita(faixa), bas = base(faixa);
  for (const c of vizinhos) {
    if (!intersecta(c, faixa) || contem(nucleo, c)) continue;
    if (base(c) <= nucleo.y) y = Math.max(y, base(c));
    else if (c.y >= base(nucleo)) bas = Math.min(bas, c.y);
    else if (direita(c) <= nucleo.x) x = Math.max(x, direita(c));
    else if (c.x >= direita(nucleo)) dir = Math.min(dir, c.x);
  }
  const rect = { x, y, width: dir - x, height: bas - y };
  const cortados = vizinhos.filter((c) => intersecta(c, rect) && !contem(rect, c));
  if (cortados.length) return { rect: null, margens: null, incluidos: [], aviso: "sem_recorte_valido", cortados: cortados.length };
  return { rect, margens: margensDe(rect, alvo), incluidos: [], aviso: "margem_reduzida" };
}

// Roda NO NAVEGADOR (locator.evaluate): precisa ser autocontida, sem
// nada de fora. Sobe do elemento-âncora até o componente, lista os
// vizinhos que não podem sair cortados e diz se a tela é um modal.
// Modal = o componente mora numa camada position:fixed (portal com fundo
// escuro). Aí só contam os vizinhos DESSA camada (a lista atrás do fundo
// escuro não é vizinha, está coberta), as coordenadas são da janela e a
// captura integral é a da janela: com "página inteira", uma camada fixa
// não tem posição garantida na imagem.
export function coletarGeometria(el) {
  const temCaixa = (n) => {
    const cs = getComputedStyle(n);
    return parseFloat(cs.borderTopWidth) > 0 || cs.boxShadow !== "none" || cs.backgroundColor !== "rgba(0, 0, 0, 0)";
  };
  const temTextoProprio = (n) => [...n.childNodes].some((c) => c.nodeType === 3 && c.textContent.trim());
  const vw = document.documentElement.clientWidth;
  let comp = el;
  for (let n = el; n && n !== document.body; n = n.parentElement) {
    const r = n.getBoundingClientRect();
    if (n.getAttribute("role") === "dialog" || (r.width >= Math.min(300, vw - 32) && r.height >= 90 && r.height <= 2400 && temCaixa(n))) { comp = n; break; }
  }
  let camada = null;
  for (let n = comp; n && n !== document.body; n = n.parentElement) {
    if (getComputedStyle(n).position === "fixed") camada = n;
  }
  const modal = !!camada;
  if (!modal) window.scrollTo(0, 0);
  const dx = modal ? 0 : window.scrollX, dy = modal ? 0 : window.scrollY;
  const doc = (r) => ({ x: r.left + dx, y: r.top + dy, width: r.width, height: r.height });
  const componentes = [];
  for (const n of (camada ?? document.body).querySelectorAll("*")) {
    if (n === comp || n.contains(comp) || comp.contains(n)) continue;
    // decoração declarada (aria-hidden: anéis, brilhos, estrelas) é fundo,
    // não conteúdo; na tela 03 o svg.portal-rings sobrepõe meio cartão
    if (n.closest('[aria-hidden="true"]')) continue;
    const r = n.getBoundingClientRect();
    if (r.width < 4 || r.height < 4) continue;
    const caixa = temCaixa(n) && r.width >= 40 && r.height >= 24;
    if (!caixa && !temTextoProprio(n) && !["IMG", "SVG", "svg", "CANVAS", "INPUT", "BUTTON"].includes(n.tagName)) continue;
    const cs = getComputedStyle(n);
    if (cs.visibility === "hidden" || cs.display === "none" || Number(cs.opacity) === 0) continue;
    componentes.push(doc(r));
    if (componentes.length > 5000) break;
  }
  // rolagem interna: a "página inteira" não mostraria o que está dentro
  const rolagemInterna = [...(camada ?? document.body).querySelectorAll("*")].filter((n) => {
    const cs = getComputedStyle(n);
    return /(auto|scroll)/.test(cs.overflowY) && n.scrollHeight > n.clientHeight + 4 && n.clientHeight > 200;
  }).length;
  return {
    modal, alvo: doc(comp.getBoundingClientRect()), componentes, rolagemInterna,
    pagina: modal
      ? { width: document.documentElement.clientWidth, height: window.innerHeight }
      : { width: document.documentElement.scrollWidth, height: document.documentElement.scrollHeight },
  };
}

function margensDe(rect, alvo) {
  return {
    topo: Math.round(alvo.y - rect.y),
    direita: Math.round(direita(rect) - direita(alvo)),
    base: Math.round(base(rect) - base(alvo)),
    esquerda: Math.round(alvo.x - rect.x),
  };
}

// CSS → pixels da imagem integral (DPR), sem sair da imagem.
export function paraPixels(rect, dpr, imagem) {
  const x = Math.max(0, Math.floor(rect.x * dpr));
  const y = Math.max(0, Math.floor(rect.y * dpr));
  const w = Math.min(imagem.width - x, Math.ceil((rect.x + rect.width) * dpr) - x);
  const h = Math.min(imagem.height - y, Math.ceil((rect.y + rect.height) * dpr) - y);
  return { x, y, width: w, height: h };
}

// ── conferência (P05) ─────────────────────────────────────────
export const fmtMilhar = (n) => Number(n).toLocaleString("pt-BR");
export const fmtHorasMin = (min) => `${Math.floor(min / 60)}h${String(Math.round(min % 60)).padStart(2, "0")}m`;
const pct = (a, b) => (b ? Math.round((100 * a) / b) : null);

// A partir do que o BANCO devolve (resumo_escola, alunos com turma,
// XP) — calculado aqui de forma independente das telas, para que a
// conferência pegue a tela que diverge em vez de repetir o erro dela.
export function esperadoDaEscola({ linhas, alunos, xpPorAluno = {} }) {
  const porId = new Map(linhas.map((l) => [l.aluno_id, l]));
  const n = (v) => Number(v) || 0;
  const porAluno = alunos.map((a) => {
    const l = porId.get(a.id) ?? {};
    return {
      id: a.id, nome: a.nome, semCredencial: !a.usuario_id,
      turmas: (a.alunos_turmas ?? []).map((v) => v.turmas?.nome).filter(Boolean),
      q7: n(l.questoes_7d), acc7: pct(n(l.acertos_7d), n(l.ca_questoes_7d)),
      min7: n(l.minutos_7d), dias7: n(l.dias_7d),
      qCiclo: n(l.questoes_total), accCiclo: pct(n(l.acertos_total), n(l.ca_questoes_total)),
      feitas: n(l.meta_feitas), consideradas: n(l.meta_consideradas),
      xp: n(xpPorAluno[a.id]),
    };
  });
  const soma = (k) => linhas.reduce((s, l) => s + n(l[k]), 0);
  const painel = {
    ativos7d: porAluno.filter((x) => x.dias7 > 0).length,
    questoes7d: soma("questoes_7d"),
    acerto7dPonderado: pct(soma("acertos_7d"), soma("ca_questoes_7d")),
    semAtividade: porAluno.filter((x) => x.dias7 === 0).map((x) => x.nome),
    semCredencial: porAluno.filter((x) => x.semCredencial).map((x) => x.nome),
  };
  const nomesTurma = [...new Set(porAluno.flatMap((x) => x.turmas))].sort((a, b) => a.localeCompare(b, "pt-BR"));
  const turmas = nomesTurma.map((nome) => {
    const da = porAluno.filter((x) => x.turmas.includes(nome));
    const comAcc = da.filter((x) => x.accCiclo != null);
    return {
      nome, alunos: da.length,
      questoesCiclo: da.reduce((s, x) => s + x.qCiclo, 0),
      // é o que a tela Turmas mostra hoje: média SIMPLES do acerto do ciclo
      acertoCicloMediaSimples: comAcc.length ? Math.round(comAcc.reduce((s, x) => s + x.accCiclo, 0) / comAcc.length) : null,
      semAtividade: da.filter((x) => x.dias7 === 0).length,
    };
  });
  const podioAcerto7d = porAluno
    .filter((x) => x.q7 >= VOLUME_MINIMO)
    .sort((x, y) => ((y.acc7 ?? -1) - (x.acc7 ?? -1)) || (y.q7 - x.q7) || (y.min7 - x.min7)
      || x.nome.localeCompare(y.nome, "pt-BR") || (x.id < y.id ? -1 : 1))
    .slice(0, 3).map((x) => x.nome);
  return { porAluno, painel, turmas, podioAcerto7d };
}

// Os números da Helena (critério de aceite, seção 3.3) e onde cada um
// deve aparecer. `formas`: as grafias aceitas na tela.
export function numerosDaReferencia(esperado, nome = ALUNA_REFERENCIA) {
  const h = esperado.porAluno.find((x) => x.nome === nome);
  if (!h) return [];
  return [
    { numero: "Atividades da missão", valor: `${h.feitas}/${h.consideradas}`, formas: [`${h.feitas}/${h.consideradas}`, `${h.feitas} de ${h.consideradas}`] },
    { numero: "Questões (7 dias)", valor: String(h.q7), formas: [String(h.q7)] },
    { numero: "Tempo (7 dias)", valor: fmtHorasMin(h.min7), formas: [fmtHorasMin(h.min7), fmtHorasMin(h.min7).replace(/m$/, "")] },
    { numero: "Acerto no ciclo", valor: h.accCiclo == null ? "—" : `${h.accCiclo}%`, formas: h.accCiclo == null ? [] : [`${h.accCiclo}%`] },
    { numero: "Dias ativos (7 dias)", valor: `${h.dias7}/7`, formas: [`${h.dias7}/7`, `${h.dias7} de 7`] },
    { numero: "XP", valor: fmtMilhar(h.xp), formas: [fmtMilhar(h.xp), `${fmtMilhar(h.xp)} XP`] },
  ];
}

// Matriz número × tela: a grafia aparece no texto da tela? "não
// encontrado" não é erro automático (a tela pode não mostrar aquele
// número); é o que o humano confere na imagem.
export function conferir(numeros, textosPorTela) {
  const limpar = (t) => t.replace(/\s+/g, " ");
  return numeros.map((n) => ({
    ...n,
    telas: Object.fromEntries(Object.entries(textosPorTela).map(([tela, texto]) =>
      [tela, n.formas.some((f) => limpar(texto).includes(f))])),
  }));
}

// P07 e segredos: nenhum arquivo do pack comercial pode conter o id do
// projeto nem o valor de um segredo. Devolve as violações (vazio = ok).
export function violacoesDoPackComercial(arquivos, { projeto = PROJETO_DEMO, segredos = [] } = {}) {
  // projeto: null confere só os segredos (o arquivo interno leva o id de propósito)
  const proibidos = [projeto, ...segredos.filter((s) => typeof s === "string" && s.length >= 4)].filter(Boolean);
  const out = [];
  for (const [nome, conteudo] of Object.entries(arquivos)) {
    for (const p of proibidos) {
      if (conteudo.toLowerCase().includes(p.toLowerCase())) {
        out.push({ arquivo: nome, motivo: p === projeto ? "identificador do projeto" : "valor de segredo" });
      }
    }
  }
  return out;
}
