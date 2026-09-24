// ============================================================
// ONDA 5 — COORDENAÇÃO (17 itens, 15 blocos)
// ------------------------------------------------------------
// Mesmo padrão das ondas anteriores: o repo não sobe navegador nem
// renderiza React em CI, então estes testes travam as propriedades
// por INSPEÇÃO DE FONTE (ver onda1-cors-modais.test.mjs), com
// comentários removidos antes de casar os padrões — senão um
// comentário que MENCIONA o padrão errado (documentando o que foi
// corrigido) faria o teste passar sem o código estar certo.
//
// Cada bloco abaixo trava exatamente o que o bloco corrigiu — não
// mais, não menos — para que reverter o código de um bloco quebre
// SÓ os testes dele.
// ============================================================
import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { adaptarResumoEscola } from "../app/src/shared/metricas/agregados.js";
import { todayISO } from "../app/src/shared/regras/regras.js";
import { sanitizarUrlLogo } from "../app/src/shared/lib/sanitizarUrlLogo.js";

const __dir = dirname(fileURLToPath(import.meta.url));
const root = resolve(__dir, "..");
const ler = (p) => readFileSync(resolve(root, p), "utf8");
const semComentarios = (fonte) => fonte
  .replace(/\/\*[\s\S]*?\*\//g, "")
  .replace(/(^|[^:\\])\/\/.*$/gm, "$1");
const src = (p) => semComentarios(ler(p));

// ── Bloco 1 (I9): contagem exata de acessos, não logs.length ────────────────
test("I9: data/index.js introduz o padrão count:'exact', head:true", () => {
  const codigo = src("app/src/shared/data/index.js");
  assert.match(
    codigo,
    /export async function contarLogsAcesso/,
    "precisa de uma função dedicada para a contagem exata (separada da listagem limitada)",
  );
  const trechoFn = codigo.slice(codigo.indexOf("export async function contarLogsAcesso"));
  assert.match(
    trechoFn.slice(0, 400),
    /\{\s*count:\s*["']exact["']\s*,\s*head:\s*true\s*\}/,
    "contarLogsAcesso precisa pedir count:'exact', head:true — não baixar o array pra contar no cliente",
  );
});

test("I9: AreaEscola.jsx busca a contagem exata e repassa ao PainelConformidade", () => {
  const codigo = src("app/src/routes/escola/AreaEscola.jsx");
  assert.match(codigo, /db\.contarLogsAcesso\(/, "a tela precisa chamar a nova função de contagem exata");
  assert.match(
    codigo,
    /<PainelConformidade[\s\S]*?logsTotal=\{[^}]+\}/,
    "logsTotal precisa ser passado como prop para o painel",
  );
});

test("I9: o StatCard 'Acessos registrados' usa logsTotal, não logs.length (limitado a 100)", () => {
  const codigo = src("app/src/modules/consentimento/PainelConformidade.jsx");
  assert.match(
    codigo,
    /rotulo="Acessos registrados"\s+valor=\{logsTotal\}/,
    "o card de resumo precisa mostrar a contagem exata, não o tamanho do array de 100",
  );
  assert.doesNotMatch(
    codigo,
    /rotulo="Acessos registrados"\s+valor=\{logs\.length\}/,
    "voltou a usar logs.length (nunca passa de 100) como se fosse o total",
  );
});

test("I9: a lista de baixo continua honesta sobre mostrar só os últimos 100", () => {
  const codigo = src("app/src/modules/consentimento/PainelConformidade.jsx");
  assert.match(codigo, /últimos 100/, "o texto de apoio da trilha de acesso não deveria mudar");
  assert.match(codigo, /logs\.map\(/, "a lista em si continua iterando o array limitado (só o resumo usa a contagem exata)");
});

// ── Bloco 2 (T31): "sem atividade" ignora aluno de ciclo encerrado ──────────
const addDias = (iso, n) => {
  const d = new Date(`${iso}T00:00:00`);
  d.setDate(d.getDate() + n);
  return d.toISOString().slice(0, 10);
};

test("T31: sem semanasPorTrilha, adaptarResumoEscola mantém o comportamento antigo (só dias_7d)", () => {
  const [x] = adaptarResumoEscola([{ aluno_id: "a1", dias_7d: 0 }], { a1: { id: "a1", trilha_id: "t1" } });
  assert.equal(x.semAtividade, true, "sem dado de trilha, precisa continuar decidindo só por dias_7d (compat.)");
});

test("T31: aluno de ciclo ENCERRADO não conta como 'sem atividade' mesmo com dias_7d=0", () => {
  const semanasPorTrilha = { t1: [
    { numero: 1, inicio: "2020-01-01", fim: "2020-01-07" },
    { numero: 2, inicio: "2020-01-08", fim: "2020-01-14" },
  ] };
  const [x] = adaptarResumoEscola(
    [{ aluno_id: "a1", dias_7d: 0 }], { a1: { id: "a1", trilha_id: "t1" } }, semanasPorTrilha,
  );
  assert.equal(x.semAtividade, false, "ciclo encerrado não tem mais missão — não faz sentido contar como sem atividade");
});

test("T31: aluno com ciclo EM CURSO e dias_7d=0 continua contando como 'sem atividade'", () => {
  const hoje = todayISO();
  const semanasPorTrilha = { t1: [
    { numero: 1, inicio: addDias(hoje, -30), fim: addDias(hoje, -8) },
    { numero: 2, inicio: addDias(hoje, -7), fim: addDias(hoje, 7) },
  ] };
  const [x] = adaptarResumoEscola(
    [{ aluno_id: "a1", dias_7d: 0 }], { a1: { id: "a1", trilha_id: "t1" } }, semanasPorTrilha,
  );
  assert.equal(x.semAtividade, true, "o ciclo ainda está em curso — o alerta continua válido");
});

test("T31: aluno de trilha SEM semanas cadastradas (sem_semanas) também não é 'encerrado' — mantém dias_7d", () => {
  const [x] = adaptarResumoEscola(
    [{ aluno_id: "a1", dias_7d: 0 }], { a1: { id: "a1", trilha_id: "t1" } }, { t1: [] },
  );
  assert.equal(x.semAtividade, true, "trilha sem semanas é dado quebrado, não fim de ciclo (estadoDoCiclo: 'sem_semanas')");
});

test("T31: aluno com atividade na semana continua sem o selo, ciclo encerrado ou não", () => {
  const semanasPorTrilha = { t1: [{ numero: 1, inicio: "2020-01-01", fim: "2020-01-07" }] };
  const [x] = adaptarResumoEscola(
    [{ aluno_id: "a1", dias_7d: 3 }], { a1: { id: "a1", trilha_id: "t1" } }, semanasPorTrilha,
  );
  assert.equal(x.semAtividade, false);
});

test("T31: listarTrilhas embute as semanas de todas as trilhas (a coordenação precisa de todas em memória)", () => {
  const codigo = src("app/src/shared/data/index.js");
  assert.match(
    codigo,
    /trilha_semanas\(numero,\s*inicio,\s*fim\)/,
    "precisa embutir trilha_semanas na listagem de trilhas — não buscar uma trilha de cada vez",
  );
});

test("T31: AreaEscola.jsx monta o mapa de semanas por trilha e alimenta adaptarResumoEscola com ele", () => {
  const codigo = src("app/src/routes/escola/AreaEscola.jsx");
  assert.match(
    codigo,
    /adaptarResumoEscola\(\s*dados\.resumo,\s*alunosPorId,\s*semanasPorTrilha\s*\)/,
    "resumoLista precisa considerar o estado do ciclo de cada aluno (Painel, Turmas e Ranking reusam este resumo)",
  );
});

test("T31: adaptarResumoEscola expõe cicloEncerrado por aluno (não só semAtividade já filtrada)", () => {
  const [x] = adaptarResumoEscola(
    [{ aluno_id: "a1", dias_7d: 0 }], { a1: { id: "a1", trilha_id: "t1" } },
    { t1: [{ numero: 1, inicio: "2020-01-01", fim: "2020-01-07" }] },
  );
  assert.equal(x.cicloEncerrado, true, "quem monta uma proporção precisa do sinal cru, não só do semAtividade já combinado");
});

// ── Bloco 3 (T31): turma "em risco" por PROPORÇÃO, não por contagem > 0 ─────
test("T31: existe uma constante nomeada para o limiar de turma em risco (não mágica solta)", () => {
  const codigo = src("app/src/routes/escola/AreaEscola.jsx");
  assert.match(
    codigo,
    /const\s+PROPORCAO_TURMA_EM_RISCO\s*=\s*0\.3\s*;/,
    "o limiar de 30% precisa ser uma constante nomeada, não um 0.3 solto no meio do cálculo",
  );
});

test("T31: o cálculo de emRisco exclui ciclo encerrado do numerador E do denominador", () => {
  const codigo = src("app/src/routes/escola/AreaEscola.jsx");
  assert.match(
    codigo,
    /emCicloAtivo\s*=\s*linhas\.filter\(\(x\)\s*=>\s*!x\.cicloEncerrado\)/,
    "o denominador da proporção precisa excluir quem já encerrou o ciclo — senão uma turma formada dilui a proporção",
  );
  assert.match(
    codigo,
    /entrada\.emRisco\s*=\s*emCicloAtivo\.length\s*>\s*0\s*&&\s*entrada\.risco\s*\/\s*emCicloAtivo\.length\s*>\s*PROPORCAO_TURMA_EM_RISCO/,
    "emRisco precisa ser risco/emCicloAtivo acima do limiar, guardado contra divisão por zero",
  );
});

test("T31: o badge 'em risco' usa a proporção (emRisco), não mais qualquer contagem > 0", () => {
  const codigo = src("app/src/routes/escola/AreaEscola.jsx");
  assert.match(codigo, /\{s\.emRisco\s*&&\s*<span/, "o badge precisa depender de emRisco (proporção), não de s.risco > 0");
  assert.doesNotMatch(codigo, /\{s\.risco\s*>\s*0\s*&&\s*<span/, "voltou a disparar com qualquer contagem > 0");
});

// ── Bloco 4 (T33): cards de alerta zerados somem, e o título junto ──────────
test("T33: os três <Alerta> só renderizam quando a contagem é > 0", () => {
  const codigo = src("app/src/modules/desempenho/PainelGestao.jsx");
  for (const variavel of ["semAtividade", "semCredencial", "metaPendente"]) {
    assert.match(
      codigo,
      new RegExp(`\\{${variavel} > 0 && \\(\\s*<Alerta`),
      `o <Alerta> de ${variavel} precisa estar condicionado a ${variavel} > 0`,
    );
  }
});

test("T33: o título 'Alertas de risco' some quando os três estão zerados", () => {
  const codigo = src("app/src/modules/desempenho/PainelGestao.jsx");
  assert.match(
    codigo,
    /\{\(semAtividade > 0 \|\| semCredencial > 0 \|\| metaPendente > 0\) && \(/,
    "o bloco inteiro (título + alertas) precisa desaparecer quando todos os três estão em zero",
  );
});

// ── Bloco 5 (T32): "Destaques da semana" — janela mista no critério acerto ──
test("T32: o critério 'acerto' de Destaques da semana usa accSem (7d), não acc (vida inteira)", () => {
  // D05 (Bloco 3, 23/09/2026): o pódio do painel passou a ser o do
  // Ranking (./ranking.js). As linhas chegam já na janela de 7 dias —
  // linhaDeEstudo(..., "semana") põe accSem em r.acc —, então o
  // critério lê r.acc e a garantia do T32 passa a morar em dois pontos.
  const painel = src("app/src/modules/desempenho/PainelGestao.jsx");
  assert.match(painel, /podioDaSemana\(ag, criterio\)/, "o pódio do painel precisa vir da função única do Ranking");
  const linhaAcerto = painel.match(/acerto:\s*\{[^}]*\}/)[0];
  assert.doesNotMatch(linhaAcerto, /x\.acc\b/, "não pode sobrar leitura de x.acc (geral) no critério de acerto");
  const ranking = src("app/src/modules/desempenho/ranking.js");
  assert.match(ranking, /linhaDeEstudo\(x\.aluno, x, "semana"\)/, "o pódio do painel é sempre da janela de 7 dias");
  assert.match(ranking, /acc: r \? \(geral \? r\.acc : r\.accSem\) : null/, "fora da janela geral, acc é o accSem");
});

// ── Bloco 6 (T34/T35): ranking de ClassificacaoTurma.jsx ────────────────────
test("T34/T35: ClassificacaoTurma importa LIMIAR de niveisAluno.js", () => {
  const codigo = src("app/src/modules/desempenho/ClassificacaoTurma.jsx");
  assert.match(
    codigo,
    /import\s*\{\s*LIMIAR\s*\}\s*from\s*"\.\.\/conteudo\/niveisAluno\.js"/,
    "precisa importar o limiar de volume mínimo já exportado por niveisAluno.js",
  );
});

test("T34/T35: o critério padrão de ClassificacaoTurma passa a ser 'acerto' (era 'questoes')", () => {
  const codigo = src("app/src/modules/desempenho/ClassificacaoTurma.jsx");
  assert.match(codigo, /useState\("acerto"\)/, "o padrão do ranking da coordenação precisa ser acerto");
  assert.doesNotMatch(codigo, /useState\("questoes"\)/, "não pode sobrar o antigo padrão 'questoes'");
});

test("T34/T35: o ranking separa quem tem volume (>= LIMIAR.VOLUME_MINIMO) de quem não tem", () => {
  // D05 (Bloco 3): a classificação saiu de ClassificacaoTurma.jsx para
  // ./ranking.js, que o pódio do painel também usa.
  assert.match(src("app/src/modules/desempenho/ClassificacaoTurma.jsx"), /classificarEstudo\(linhas, criterio\)/);
  const codigo = src("app/src/modules/desempenho/ranking.js");
  assert.match(
    codigo,
    /\.filter\(\(x\)\s*=>\s*x\.q\s*>=\s*LIMIAR\.VOLUME_MINIMO\)/,
    "lista numerada: só quem já passou do piso de volume na janela ativa",
  );
  assert.match(
    codigo,
    /\.filter\(\(x\)\s*=>\s*x\.q\s*<\s*LIMIAR\.VOLUME_MINIMO\)/,
    "grupo 'ainda sem dados suficientes': quem não passou",
  );
});

test("T34/T35: quem não tem volume suficiente é ordenado por nome, não pelo critério escolhido", () => {
  const codigo = src("app/src/modules/desempenho/ranking.js");
  assert.match(
    codigo,
    /x\.q\s*<\s*LIMIAR\.VOLUME_MINIMO\)\s*\n?\s*\.sort\(\(x,\s*y\)\s*=>\s*x\.aluno\.nome\.localeCompare\(y\.aluno\.nome/,
    "o grupo sem dados suficientes precisa ordenar por nome (nunca inventar posição por um critério sem volume que a sustente)",
  );
});

test("T34/T35: a seção 'Ainda sem dados suficientes' existe e não numera essas linhas", () => {
  const codigo = src("app/src/modules/desempenho/ClassificacaoTurma.jsx");
  assert.match(codigo, /Ainda sem dados suficientes/, "precisa de um título discreto para o segundo grupo");
  assert.match(
    codigo,
    /posicao == null \? "" :/,
    "a linha sem posição não pode inventar um Nº nem cair numa medalha",
  );
});

test("T34/T35: PainelGestao.jsx não muda de critério padrão (já era 'acerto' antes deste bloco)", () => {
  const codigo = src("app/src/modules/desempenho/PainelGestao.jsx");
  assert.match(codigo, /useState\("acerto"\)/);
});

// ── Bloco 7 (I11): badge de credencial em ClassificacaoTurma e AreaEscola ──
const PADRAO_CRED_STATUS = /a\.usuarios\?\.credencial_status === "revogada"/;
const PADRAO_CRED_TROCA = /a\.usuarios\?\.must_change_password === true/;

test("I11: ListaAlunos.jsx continua a fonte do padrão (mesma leitura de dado)", () => {
  const codigo = src("app/src/modules/pessoas/ListaAlunos.jsx");
  assert.match(codigo, PADRAO_CRED_STATUS);
  assert.match(codigo, PADRAO_CRED_TROCA);
});

test("I11: ClassificacaoTurma.jsx replica o mesmo padrão de leitura + StatusBadge", () => {
  const codigo = src("app/src/modules/desempenho/ClassificacaoTurma.jsx");
  assert.match(codigo, /import\s*\{[^}]*StatusBadge[^}]*\}\s*from\s*"\.\.\/\.\.\/shared\/ui\/componentes\.jsx"/);
  assert.match(codigo, /aluno\.usuarios\?\.credencial_status === "revogada"/, "mesma leitura de dado que ListaAlunos.jsx");
  assert.match(codigo, /aluno\.usuarios\?\.must_change_password === true/);
  assert.match(codigo, /<StatusBadge tom="risco">credencial revogada<\/StatusBadge>/);
  assert.match(codigo, /<StatusBadge tom="alerta">aguardando troca de senha<\/StatusBadge>/);
  // usado nos dois modos (estudos via LinhaEstudo e simulados inline)
  const usos = codigo.match(/<CredencialBadges aluno=\{r\.aluno\} \/>/g) ?? [];
  assert.equal(usos.length, 2, "precisa aparecer nos dois modos (estudos e simulados)");
});

test("I11: AreaEscola.jsx (card de aluno na turma expandida) replica o mesmo padrão", () => {
  const codigo = src("app/src/routes/escola/AreaEscola.jsx");
  assert.match(codigo, /import\s*\{[^}]*StatusBadge[^}]*\}\s*from\s*"\.\.\/\.\.\/shared\/ui\/componentes\.jsx"/);
  assert.match(codigo, PADRAO_CRED_STATUS, "mesma leitura de dado que ListaAlunos.jsx");
  assert.match(codigo, PADRAO_CRED_TROCA);
  assert.match(codigo, /<StatusBadge tom="risco">credencial revogada<\/StatusBadge>/);
  assert.match(codigo, /<StatusBadge tom="alerta">aguardando troca de senha<\/StatusBadge>/);
});

// ── Bloco 8 (T29): confirmação nos selects de linha (turma/concurso/trilha) ─
test("T29: trocarTurma/trocarConcurso/trocarTrilha passam por dialogo.confirmar antes de gravar", () => {
  const codigo = src("app/src/modules/pessoas/ListaAlunos.jsx");
  for (const nome of ["trocarTurma", "trocarConcurso", "trocarTrilha"]) {
    const inicio = codigo.indexOf(`const ${nome} = async (a,`);
    assert.ok(inicio >= 0, `${nome} precisa ser uma função async (para poder aguardar a confirmação)`);
    const corpo = codigo.slice(inicio, codigo.indexOf("\n  };", inicio));
    assert.match(corpo, /await dialogo\.confirmar\(/, `${nome} precisa confirmar antes de gravar`);
    assert.match(corpo, /if \(!ok\) return;/, `${nome} precisa abortar a gravação se a coordenação cancelar`);
  }
});

test("T29: as mensagens de confirmação dizem o que muda, não um 'tem certeza?' genérico", () => {
  const codigo = src("app/src/modules/pessoas/ListaAlunos.jsx");
  assert.match(codigo, /Mover \$\{a\.nome\} para a turma \$\{turma\.nome\}\?/);
  assert.match(codigo, /Trocar o concurso-alvo de \$\{a\.nome\} para \$\{concurso\.nome\}\?/);
  assert.match(codigo, /Trocar a trilha de estudo de \$\{a\.nome\} para \$\{trilha\.nome\}\?/);
});

test("T29: os três selects de linha continuam chamando as mesmas funções no onChange (zero mudança de API)", () => {
  const codigo = src("app/src/modules/pessoas/ListaAlunos.jsx");
  assert.match(codigo, /onChange=\{\(e\) => trocarTurma\(a, e\.target\.value\)\}/);
  assert.match(codigo, /onChange=\{\(e\) => trocarConcurso\(a, e\.target\.value\)\}/);
  assert.match(codigo, /onChange=\{\(e\) => trocarTrilha\(a, e\.target\.value\)\}/);
});

// ── Bloco 9 (I10): cor de aviso no "Excluir" de turma desabilitado ──────────
test("I10: o botão Excluir turma (s.n > 0) não é mais idêntico ao Renomear", () => {
  const codigo = src("app/src/routes/escola/AreaEscola.jsx");
  const linhaExcluir = codigo.match(/<button type="button" onClick=\{\(\) => excluir\(t, s\.n\)\}[^>]*>/)[0];
  assert.doesNotMatch(
    linhaExcluir,
    /color:\s*s\.n\s*\?\s*T\.sub\s*:/,
    "voltou a usar T.sub (a mesma cor neutra do Renomear) quando a turma ainda tem alunos",
  );
  // Fica na família de perigo nos dois estados, só rebaixada quando inerte
  // (borda mais fraca + a opacity 0.6 que já existia). Dourado competiria
  // com o dourado de ação principal do "Ver classificação ›" ao lado.
  assert.match(
    linhaExcluir,
    /color:\s*T\.red/,
    "o Excluir precisa continuar na família de perigo mesmo quando inerte",
  );
  assert.match(
    linhaExcluir,
    /border:\s*`1px solid \$\{T\.red\}\$\{s\.n \? "33" : "66"\}`/,
    "a diferença entre inerte e ativo precisa estar na intensidade da borda, não na troca de família de cor",
  );
});

// ── Bloco 10 (T42): mesmo nível de perigo em "Revogar credencial"/"acesso" ──
test("T42: 'Revogar credencial' e 'Revogar acesso' têm o mesmo destaque de perigo", () => {
  const codigo = src("app/src/modules/pessoas/VinculosResponsavel.jsx");
  assert.match(
    codigo,
    /<BotaoMini perigo onClick=\{\(\) => setConfirmando\(\{ id: v\.id, tipo: "credencial" \}\)\}>Revogar credencial<\/BotaoMini>/,
    "Revogar credencial precisa continuar com perigo",
  );
  assert.match(
    codigo,
    /<BotaoMini perigo onClick=\{\(\) => setConfirmando\(\{ id: v\.id, tipo: "vinculo" \}\)\}>Revogar acesso<\/BotaoMini>/,
    "Revogar acesso precisa ganhar o mesmo perigo — as duas ações são igualmente irreversíveis por ação simples",
  );
});

// ── Bloco 11 (T37): sanitizarUrlLogo aplicado no save e no href do admin ────
test("T37: sanitizarUrlLogo rejeita javascript: e aceita http(s)/data:image", () => {
  assert.equal(sanitizarUrlLogo("javascript:alert(1)"), "");
  assert.equal(sanitizarUrlLogo("not a url"), "");
  assert.equal(sanitizarUrlLogo("https://escola.example/logo.png"), "https://escola.example/logo.png");
  assert.equal(sanitizarUrlLogo("data:image/png;base64,aGVsbG8="), "data:image/png;base64,aGVsbG8=");
});

test("T37: Marca.jsx e BrandingContext.jsx importam o módulo compartilhado (sem cópia local)", () => {
  const marca = src("app/src/modules/escola/Marca.jsx");
  const branding = src("app/src/shared/branding/BrandingContext.jsx");
  assert.match(marca, /import\s*\{\s*sanitizarUrlLogo\s*\}\s*from\s*"\.\.\/\.\.\/shared\/lib\/sanitizarUrlLogo\.js"/);
  assert.match(branding, /import\s*\{\s*sanitizarUrlLogo\s*\}\s*from\s*"\.\.\/lib\/sanitizarUrlLogo\.js"/);
  assert.doesNotMatch(marca, /function sanitizarUrlLogo/, "não pode sobrar uma cópia local em Marca.jsx");
  assert.doesNotMatch(branding, /function sanitizarUrlLogo/, "não pode sobrar uma cópia local em BrandingContext.jsx");
});

test("T37: Marca.jsx sanitiza antes de gravar e rejeita o salvamento se a URL for maliciosa/inválida", () => {
  const codigo = src("app/src/modules/escola/Marca.jsx");
  assert.match(codigo, /const logoSeguro = logoBruto \? sanitizarUrlLogo\(logoBruto\) : "";/);
  assert.match(codigo, /if \(logoBruto && !logoSeguro\)/, "precisa barrar o salvamento quando a URL não vazia é rejeitada");
  assert.match(codigo, /logo_url: logoSeguro \|\| null/, "o que é gravado no banco precisa ser o valor sanitizado, não logo.trim() cru");
  assert.doesNotMatch(codigo, /logo_url: logo\.trim\(\) \|\| null/, "voltou a gravar o valor cru sem sanitizar");
});

test("T37: o <input> de logo vira type=\"url\" com texto de ajuda", () => {
  const codigo = src("app/src/modules/escola/Marca.jsx");
  assert.match(codigo, /<input id=\{id\("logo"\)\} type="url"/);
});

test("T37: AreaAdmin.jsx sanitiza e.logo_url antes de usá-lo como href no backoffice", () => {
  const codigo = src("app/src/routes/admin/AreaAdmin.jsx");
  assert.match(codigo, /import\s*\{\s*sanitizarUrlLogo\s*\}\s*from\s*"\.\.\/\.\.\/shared\/lib\/sanitizarUrlLogo\.js"/);
  assert.match(codigo, /const logoSeguro = sanitizarUrlLogo\(e\.logo_url\);/);
  assert.match(codigo, /\{logoSeguro && <InfoLinha rotulo="Logo" valor="ver imagem ↗" href=\{logoSeguro\} \/>\}/);
  assert.doesNotMatch(codigo, /href=\{e\.logo_url\}/, "não pode sobrar o href cru — um link malicioso salvo pela escola viraria clicável no backoffice");
});

// ── Bloco 12 (T38): TrilhaConcurso.jsx sem código cru de matéria ────────────
test("T38: carregarRecorrenciaDoConcurso traz o nome real da matéria (catálogo `materias`)", () => {
  // CORRIGIDO EM 20/09/2026. Este teste exigia
  // `prova_materias.select("materia_codigo, nome, …")` — e `nome` NUNCA
  // existiu nessa tabela. Ou seja: o teste não deixou de pegar o defeito,
  // ele OBRIGAVA o defeito. A tela da Trilha ficou morta de 14/09 a 20/09
  // com a suíte verde. A intenção do T38 (mostrar nome, não código cru)
  // continua travada; o mecanismo passou a ser o catálogo `materias`.
  // A trava contra coluna inexistente é tests/seam-colunas-existem-db.
  const codigo = src("app/src/shared/data/index.js");
  assert.match(
    codigo,
    /supabase\.from\("prova_materias"\)\.select\("materia_codigo, peso, num_questoes"\)/,
    "a query de recorrência precisa pedir só o que prova_materias tem",
  );
  assert.match(
    codigo,
    /supabase\.from\("materias"\)\.select\("codigo, nome"\)/,
    "o nome da matéria precisa vir do catálogo `materias`",
  );
});

test("T38: carregarPlanoConcurso anexa materia_nome a cada missão", () => {
  const codigo = src("app/src/shared/data/index.js");
  // o helper não leva mais examTag: o catálogo é global (código → nome).
  assert.match(codigo, /async function carregarNomesMateria\(\)/, "precisa de um helper pra montar código → nome");
  const trecho = codigo.slice(codigo.indexOf("export async function carregarPlanoConcurso"));
  assert.match(trecho, /carregarNomesMateria\(\)/, "carregarPlanoConcurso precisa buscar os nomes junto");
  assert.match(
    trecho,
    /materia_nome:\s*m\.materia_codigo\s*\?\s*\(nomePorMateria\[m\.materia_codigo\]\s*\?\?\s*null\)\s*:\s*null/,
    "cada missão precisa ganhar materia_nome",
  );
});

test("T38: TrilhaConcurso.jsx mostra o nome real da matéria, não o código cru", () => {
  const codigo = src("app/src/modules/conteudo/TrilhaConcurso.jsx");
  assert.match(
    codigo,
    /materia:\s*a\.materia_codigo\s*\?\s*\(nomeMateriaPorCodigo\[a\.materia_codigo\]\s*\?\?\s*a\.materia_codigo\)\s*:\s*null/,
    "recorrência por assunto precisa mostrar o nome (com fallback pro código só se faltar o nome)",
  );
  assert.match(
    codigo,
    /\{mi\.materia_nome \?\? mi\.materia_codigo\}/,
    "a missão precisa mostrar materia_nome, caindo pro código só se faltar",
  );
  assert.doesNotMatch(
    codigo,
    /const NOME_MATERIA/,
    "não pode introduzir uma quarta cópia hardcoded do catálogo — a rota escolhida foi estender as queries",
  );
});

// ── Bloco 13 (T39/T40): copy factual + ações reais na ficha do aluno ───────
test("T39: ResumoResponsavel ganha o prop `publico`, default ausente = comportamento atual", () => {
  const codigo = src("app/src/modules/desempenho/ResumoResponsavel.jsx");
  assert.match(
    codigo,
    /export function ResumoResponsavel\(\{[^}]*publico[^}]*\}\)/,
    "precisa aceitar publico sem quebrar a assinatura existente",
  );
  assert.match(codigo, /const coord = publico === "coordenacao";/);
});

test("T39: AreaResponsavel.jsx não muda — continua sem passar publico (comportamento parental preservado)", () => {
  const codigo = src("app/src/routes/responsavel/AreaResponsavel.jsx");
  assert.doesNotMatch(codigo, /publico=/, "a tela do responsável não pode passar publico — zero mudança pra ela");
});

test("T39: as três frases de conselho parental/segunda pessoa têm equivalente factual sob publico=coordenacao", () => {
  const codigo = src("app/src/modules/desempenho/ResumoResponsavel.jsx");
  // 1) semáforo "Precisa de atenção"
  assert.match(codigo, /coord\s*\n?\s*\?\s*`\$\{primeiroNome\} ainda não estudou nesta semana\.`/);
  // 2) fechoMeta com poucos dias
  assert.match(codigo, /coord\s*\n?\s*\?\s*"A meta da semana foi concluída, com o estudo concentrado em poucos dias\."/);
  // 3) alerta de poucos dias
  assert.match(codigo, /coord \? "Poucos dias de estudo nesta semana\." :/);
  // as frases originais (parentais) continuam existindo pro caso default
  assert.match(codigo, /um incentivo ajuda a retomar/);
  assert.match(codigo, /vale incentivar uma rotina mais distribuída/);
  assert.match(codigo, /vale distribuir melhor a rotina/);
});

test("T40: FichaAluno.jsx ganha uma barra de ações reais no cabeçalho", () => {
  const codigo = src("app/src/modules/desempenho/FichaAluno.jsx");
  assert.match(codigo, /titulo="Ações rápidas"/, "precisa de uma seção visível de ações, não só o Editar do onboarding");
  for (const nome of ["trocarTurma", "trocarConcurso", "trocarTrilha"]) {
    assert.match(codigo, new RegExp(`const ${nome} = async \\(`), `${nome} precisa existir na ficha`);
  }
  assert.match(codigo, /await dialogo\.confirmar\(/, "as trocas da ficha também confirmam antes de gravar (mesmo padrão do Bloco 8)");
  assert.match(codigo, /const credencialAluno = \(\) => comAcao\(async \(\) => aoGerarCredencial\?\.\(await db\.provisionarAluno\(aluno\.id\)\)\);/);
  assert.match(codigo, /import \{ VinculosResponsavel \} from "\.\.\/pessoas\/VinculosResponsavel\.jsx";/);
  assert.match(codigo, /setVinculosAbertos\(true\)/, "\"Ver vínculos\" precisa abrir o mesmo modal que ListaAlunos.jsx usa");
});

test("T40: a ficha passa publico=\"coordenacao\" para ResumoResponsavel", () => {
  const codigo = src("app/src/modules/desempenho/FichaAluno.jsx");
  assert.match(codigo, /<ResumoResponsavel[\s\S]*?publico="coordenacao"/);
});

test("T40: AreaEscola.jsx passa turmas/concursos/trilhas/aoMudar/aoGerarCredencial para a ficha", () => {
  const codigo = src("app/src/routes/escola/AreaEscola.jsx");
  assert.match(
    codigo,
    /<FichaAluno aluno=\{alunoAbertoFresco\} concurso=\{concursoDoAluno\}\s*\n\s*turmas=\{dados\.turmas\} concursos=\{dados\.concursos\} trilhas=\{dados\.trilhas\}\s*\n\s*aoMudar=\{recarregarTudo\} aoGerarCredencial=\{setCredencial\} \/>/,
  );
});

test("T40: AreaEscola.jsx não mostra mais o snapshot velho do aluno — relê de alunosPorId após mudanças", () => {
  const codigo = src("app/src/routes/escola/AreaEscola.jsx");
  assert.match(
    codigo,
    /const alunoAbertoFresco = alunoAberto \? \(alunosPorId\[alunoAberto\.id\] \?\? alunoAberto\) : null;/,
    "sem isto, trocar trilha/concurso na ficha não atualiza o que a própria ficha mostra até fechar e reabrir",
  );
});

// ── Bloco 14 (T10/T43/T46): chrome de diálogo ───────────────────────────────
test("T10: o toggle 'Preferência desta tela' vem ANTES da Missão da semana na aba Hoje", () => {
  const codigo = src("app/src/routes/aluno/VisaoEstudo.jsx");
  const iHoje = codigo.indexOf('tab === "hoje" && (');
  const iToggle = codigo.indexOf('className="today-preference"', iHoje);
  const iMissao = codigo.indexOf('aria-label="Missão da semana"', iHoje);
  assert.ok(iHoje >= 0 && iToggle >= 0 && iMissao >= 0, "os três marcadores precisam existir na aba Hoje");
  assert.ok(iToggle < iMissao, "o toggle precisa vir mais cedo no fluxo, antes da Missão da semana — não mais o último nó da aba");
});

test("T43: 'Fechar' do modal de vínculos usa o mesmo registro visual dos BotaoMini ao lado", () => {
  const codigo = src("app/src/modules/pessoas/VinculosResponsavel.jsx");
  assert.match(codigo, /<BotaoMini onClick=\{aoFechar\}>Fechar<\/BotaoMini>/, "precisa ser um BotaoMini, não um botão custom maior");
  assert.doesNotMatch(
    codigo,
    /background: T\.line, border: "none", color: T\.sub, borderRadius: 9, padding: "11px", fontWeight: 700, fontSize: 13\.5/,
    "não pode sobrar o estilo antigo (fontSize 13.5, fontWeight 700) de ação principal",
  );
});

test("T46: DialogoConfirmar ganha um modo de alerta de botão único (rotuloCancelar: null)", () => {
  const codigo = src("app/src/shared/ui/componentes.jsx");
  assert.match(codigo, /const somenteConfirmar = rotuloCancelar === null;/);
  assert.match(codigo, /\{!somenteConfirmar && <Botao secundario onClick=\{\(\) => fechar\(false\)\}>\{rotuloCancelar\}<\/Botao>\}/);
});

test("T46: AreaEscola.jsx usa o modo de botão único no aviso 'turma ainda tem alunos' (não é decisão binária)", () => {
  const codigo = src("app/src/routes/escola/AreaEscola.jsx");
  const inicio = codigo.indexOf('titulo: "Não é possível excluir agora"');
  assert.ok(inicio >= 0);
  const trecho = codigo.slice(inicio, inicio + 300);
  assert.match(trecho, /rotuloCancelar: null,/, "é um aviso informativo (o código faz return incondicional depois) — não duas escolhas reais");
});

// ── Bloco 15 (T30): altura da lista — POR_PAGINA reduzido ───────────────────
test("T30: POR_PAGINA cai de 50 para algo entre 20 e 25", () => {
  const codigo = src("app/src/modules/pessoas/ListaAlunos.jsx");
  const m = codigo.match(/const POR_PAGINA = (\d+);/);
  assert.ok(m, "POR_PAGINA precisa continuar existindo como constante nomeada");
  const valor = Number(m[1]);
  assert.ok(valor >= 20 && valor <= 25, `POR_PAGINA=${valor} — precisa estar entre 20 e 25 (era 50)`);
});
