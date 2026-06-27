/* ============================================================
   ADM2 — Núcleo de OPERAÇÃO do SuperADM (lógica PURA, sem rede).
   ------------------------------------------------------------
   Centro de operação profissional do operador: classificação de
   escola (demo/teste/real/individual), checklist de go-live,
   avisos de risco, modalidades habilitadas (placeholder controlado)
   e filtros da trilha de auditoria.

   Por que PURO (sem importar o cliente/Supabase): a segurança vive
   na RLS e nas RPCs SECURITY DEFINER (porteiro eh_super_admin) —
   este módulo só INTERPRETA o que aquelas RPCs já devolveram, para
   a tela explicar status, risco e pendência. Sendo puro, roda no
   `node --test` sem banco e sem segredo (tests/adm2-*).

   NADA aqui decide acesso. Classificar uma escola como "real" não
   libera nada; é rótulo operacional para o olho do operador. O
   bloqueio real (suspensa/cancelada) continua sendo do banco.
   ============================================================ */

/* ---------- helpers internos ---------- */
const txt = (v) => (v == null ? "" : String(v)).trim().toLowerCase();
const num = (v) => {
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
};
// Conta coordenadores tanto no formato rico ({id,nome,email}) quanto no
// legado (array de strings) — a 0032 migrou o detalhe, mas a lista do
// dashboard só traz o contador. Tolerante aos dois.
const listaCoords = (d) => (Array.isArray(d?.coordenadores) ? d.coordenadores : []);

/* ============================================================
   1) CATEGORIA da escola — separar visualmente demo / teste /
      real / individual (B2C futura). Tarefa 38.
   ------------------------------------------------------------
   Heurística conservadora e DETERMINÍSTICA. A ordem importa: um
   ambiente de demonstração nunca deve ser confundido com cliente
   real, então 'demo' é checado primeiro; 'real' só é afirmado para
   escola ATIVA que não caiu em demo/teste/individual. O default
   (sem sinal claro) é 'teste' — nunca 'real' por omissão.
   ============================================================ */
export const CATEGORIAS = {
  demo:       { rotulo: "Demonstração", tom: "alerta",  icone: "◑", descricao: "Ambiente de vitrine — dado fictício, não misturar com aluno real." },
  teste:      { rotulo: "Teste/Piloto", tom: "alerta",  icone: "◷", descricao: "Em validação ou implantação — ainda não é operação plena." },
  real:       { rotulo: "Escola real",  tom: "ok",      icone: "🏫", descricao: "Cliente B2B em produção com dado real de aluno." },
  individual: { rotulo: "Individual/B2C", tom: "neutro", icone: "👤", descricao: "Assinante individual (B2C) — modalidade futura, placeholder." },
};

const TEM = (s, ...termos) => termos.some((t) => s.includes(t));

export function categoriaEscola(escola) {
  const status = txt(escola?.status);
  const slug = txt(escola?.slug);
  const plano = txt(escola?.plano);
  const nome = txt(escola?.nome);
  const limite = escola?.limite_alunos;

  // 1) Demonstração — sinal explícito vence tudo (não vira "real" por engano).
  if (status === "demo" || TEM(slug, "demo", "vitrine", "exemplo") || TEM(plano, "demo") || TEM(nome, "demonstra"))
    return categoria("demo");

  // 2) Individual / B2C — plano avulso ou limite de 1 aluno.
  if (TEM(plano, "individual", "b2c", "avulso", "pessoal") || (limite != null && num(limite) === 1))
    return categoria("individual");

  // 3) Teste / Piloto — estados de pré-ativação ou slug de sandbox.
  if (status === "implantacao" || status === "piloto" ||
      TEM(slug, "teste", "test", "piloto", "qa", "sandbox", "homolog"))
    return categoria("teste");

  // 4) Real — somente escola ATIVA que não disparou nenhum sinal acima.
  if (status === "ativa") return categoria("real");

  // 5) Suspensa/cancelada/desconhecido sem outro sinal: trata como teste
  //    (conservador — nunca afirma "real" sem evidência de operação).
  return categoria("teste");
}

function categoria(chave) {
  return { chave, ...CATEGORIAS[chave] };
}

/* ============================================================
   2) AVISOS DE RISCO por escola — tarefa 41.
   ------------------------------------------------------------
   Lê o detalhe da escola (backoffice_detalhe_escola) e a linha da
   lista, e devolve avisos acionáveis. Cada aviso tem nível:
     'risco'  → vermelho, bloqueia/ameaça operação (sem coordenador,
                limite estourado);
     'alerta' → dourado, pendência relevante (sem aluno, sem LGPD,
                sem e-mail de acesso);
     'info'   → neutro, contexto (ambiente demo, escola suspensa).
   O front NÃO inventa: cada aviso aponta a falta de um dado real.
   Itens de infraestrutura não detectáveis pelo front (backup, SMTP
   do projeto) ficam no CHECKLIST como confirmação manual, não aqui.
   ============================================================ */
export function avisosRisco(escola = {}, detalhe = null) {
  const avisos = [];
  const add = (nivel, codigo, titulo, recomendacao) => avisos.push({ nivel, codigo, titulo, recomendacao });

  const status = txt(escola.status);
  const cat = categoriaEscola(escola).chave;

  // Contadores: preferir o detalhe (rico); cair na linha da lista.
  const coords = detalhe ? listaCoords(detalhe) : null;
  const nCoord = coords ? coords.length : num(escola.coordenadores);
  const nAlunos = detalhe ? num(detalhe.alunos) : num(escola.alunos);
  const comCredencial = detalhe ? num(detalhe.alunos_com_credencial) : null;
  const nResp = detalhe ? num(detalhe.responsaveis) : null;
  const nConsent = detalhe ? num(detalhe.consentimentos) : null;
  const limite = escola.limite_alunos ?? detalhe?.escola?.limite_alunos ?? null;
  const emailInst = escola.email_institucional ?? detalhe?.escola?.email_institucional ?? null;

  // --- riscos (vermelho) ---
  if (nCoord === 0)
    add("risco", "sem-coordenador", "Escola sem coordenador",
        "Provisione a coordenação pelo backoffice — sem ela, ninguém opera a escola.");

  if (limite != null && nAlunos > num(limite))
    add("risco", "limite-excedido", `Limite de alunos excedido (${nAlunos}/${num(limite)})`,
        "Revise o plano/limite ou contenha novos cadastros.");

  // --- alertas (dourado) ---
  // Coordenador sem login: existe coordenador, mas sem e-mail de acesso.
  if (coords && nCoord > 0 && coords.some((c) => !txt(c?.email)))
    add("alerta", "coordenador-sem-login", "Coordenador sem e-mail de acesso",
        "Re-provisione para registrar o e-mail e enviar o link de senha.");

  if (nAlunos === 0 && status !== "demo" && cat !== "demo")
    add("alerta", "sem-alunos", "Escola sem alunos",
        "Crie turmas e importe alunos para a escola sair do papel.");

  if (!txt(emailInst))
    add("alerta", "sem-email-institucional", "Sem e-mail institucional",
        "Sem e-mail de contato o envio de acessos/avisos fica comprometido (depende de SMTP/fallback).");

  if (comCredencial != null && nAlunos > 0 && comCredencial === 0)
    add("alerta", "alunos-sem-credencial", "Alunos sem credencial gerada",
        "Gere as credenciais/códigos para os alunos conseguirem entrar.");

  if (nConsent != null && nAlunos > 0 && nConsent === 0)
    add("alerta", "sem-consentimento", "Sem consentimento LGPD registrado",
        "Registre o consentimento dos responsáveis antes de liberar o acesso.");

  // --- info (neutro/contexto) ---
  if (cat === "demo")
    add("info", "ambiente-demo", "Ambiente de demonstração",
        "Dado fictício/credenciais demo — não tratar como cliente real.");

  if (status === "suspensa")
    add("info", "suspensa", "Escola suspensa",
        "Acesso bloqueado pela RLS até reativar — dado preservado.");
  if (status === "cancelada")
    add("info", "cancelada", "Escola cancelada",
        "Desligamento sinalizado (reversível). Nenhum dado foi apagado.");

  void nResp; // reservado: vínculo de responsável entra no checklist, não como risco
  return avisos;
}

// Maior severidade de uma lista de avisos (para o selo da lista).
export function severidadeMaxima(avisos = []) {
  if (avisos.some((a) => a.nivel === "risco")) return "risco";
  if (avisos.some((a) => a.nivel === "alerta")) return "alerta";
  if (avisos.length) return "info";
  return "ok";
}

/* ============================================================
   3) CHECKLIST DE GO-LIVE por escola — tarefas 37 + 36.
   ------------------------------------------------------------
   Evolui o "checklist de implantação" (que só via dado interno)
   para um checklist de GO-LIVE completo: marca, coordenador,
   alunos, responsáveis, SMTP/fallback, LGPD, termo, backup, smoke.

   Cada item tem:
     ok         — concluído? (itens automáticos derivam de dado real;
                  itens manuais começam pendentes — o operador
                  confirma no doc/operacao, ver dica);
     manual     — não detectável pelo front (infra/processo);
     critico    — trava o go-live se faltar;
     grupo      — para agrupar visualmente.
   A confirmação de itens manuais NÃO é persistida aqui (seria
   migration); o checklist documenta a exigência e aponta a fonte.
   ============================================================ */
export function checklistGoLive(detalhe = {}) {
  const e = detalhe.escola ?? {};
  const coords = listaCoords(detalhe);
  const turmas = Array.isArray(detalhe.turmas) ? detalhe.turmas : [];
  const nAlunos = num(detalhe.alunos);
  const operacional = !["suspensa", "cancelada"].includes(txt(e.status));

  const itens = [
    { chave: "escola_criada", grupo: "Cadastro", ok: true, manual: false, critico: true,
      label: "Escola criada" },
    { chave: "dados_basicos", grupo: "Cadastro", ok: !!(e.nome && e.slug), manual: false, critico: true,
      label: "Dados básicos (nome e slug)" },
    { chave: "contato", grupo: "Cadastro", ok: !!(e.email_institucional || e.contato_nome || e.telefone_contato), manual: false, critico: false,
      label: "Contato administrativo informado",
      dica: "Necessário para enviar acessos e avisos à escola." },
    { chave: "marca", grupo: "Cadastro", ok: !!(e.cor_acento || e.logo_url), manual: false, critico: false,
      label: "Marca configurada (cor ou logo)" },

    { chave: "coordenador", grupo: "Acesso", ok: coords.length > 0, manual: false, critico: true,
      label: "Coordenador provisionado",
      dica: coords.length === 0 ? "Crie o coordenador no painel 'Coordenação' abaixo." : null },
    { chave: "coordenador_login", grupo: "Acesso", ok: coords.length > 0 && coords.every((c) => !!txt(c?.email)), manual: false, critico: true,
      label: "Coordenador com e-mail de acesso",
      dica: "Sem e-mail não há link de senha — coordenador não entra." },

    { chave: "turmas", grupo: "Alunos", ok: turmas.length > 0, manual: false, critico: false,
      label: "Turmas criadas" },
    { chave: "alunos", grupo: "Alunos", ok: nAlunos > 0, manual: false, critico: true,
      label: "Alunos cadastrados" },
    { chave: "credenciais", grupo: "Alunos", ok: num(detalhe.alunos_com_credencial) > 0, manual: false, critico: false,
      label: "Credenciais/códigos gerados" },
    { chave: "responsaveis", grupo: "Alunos", ok: num(detalhe.responsaveis) > 0, manual: false, critico: false,
      label: "Responsáveis vinculados" },

    { chave: "lgpd_consentimento", grupo: "Conformidade", ok: num(detalhe.consentimentos) > 0, manual: false, critico: false,
      label: "Consentimento LGPD registrado",
      dica: "Obrigatório para aluno menor — registrar antes de liberar." },
    { chave: "smtp_fallback", grupo: "Conformidade", ok: false, manual: true, critico: false,
      label: "SMTP / fallback de e-mail verificado",
      dica: "Confirmar envio de senha/aviso (ou fallback de link manual). Ver docs/operacao." },
    { chave: "termo_uso", grupo: "Conformidade", ok: false, manual: true, critico: false,
      label: "Termo de uso / contrato aceito",
      dica: "Confirmação de processo — não detectável pelo sistema." },
    { chave: "backup", grupo: "Conformidade", ok: false, manual: true, critico: true,
      label: "Backup confirmado e testado",
      dica: "Backup do projeto Supabase validado. Ver docs/operacao/backup-retencao-lgpd.md." },
    { chave: "smoke", grupo: "Conformidade", ok: false, manual: true, critico: true,
      label: "Smoke test dos 4 perfis (aluno/responsável/coord/admin)",
      dica: "Login real testado em cada papel sem erro de console." },

    { chave: "operacional", grupo: "Go-live", ok: operacional && txt(e.status) === "ativa", manual: false, critico: true,
      label: "Escola ativada (status ativa)",
      dica: operacional ? "Mude o status para 'ativa' quando tudo acima estiver pronto." : "Escola bloqueada — reative para operar." },
  ];

  return itens;
}

// Resumo do checklist: progresso automático vs. confirmações manuais e
// se há item CRÍTICO pendente (trava o go-live). Separa os dois mundos
// para não dar falso "pronto" quando só os automáticos fecharam.
export function resumoChecklist(itens = []) {
  const automaticos = itens.filter((i) => !i.manual);
  const manuais = itens.filter((i) => i.manual);
  const feitosAuto = automaticos.filter((i) => i.ok).length;
  const criticosPendentes = itens.filter((i) => i.critico && !i.ok);
  return {
    total: itens.length,
    feitos: itens.filter((i) => i.ok).length,
    automaticosTotal: automaticos.length,
    automaticosFeitos: feitosAuto,
    manuaisTotal: manuais.length,
    criticosPendentes,
    prontoAutomatico: automaticos.every((i) => i.ok),
    // "Pronto para go-live" exige todo CRÍTICO fechado, inclusive manuais —
    // por isso só vira true quando o operador marcou backup/smoke (que aqui
    // chegam como ok=false até a confirmação externa). Honesto por padrão.
    prontoGoLive: criticosPendentes.length === 0,
  };
}

/* ============================================================
   4) MODALIDADES habilitadas — tarefa 39 (placeholder controlado).
   ------------------------------------------------------------
   Catálogo de modalidades do produto. Hoje só 'concurso' está em
   produção; as demais são placeholders DECLARADOS (estado != 'ativa')
   para o operador enxergar o roadmap sem que nada seja prometido nem
   habilitado de fato. Persistência por escola é DIFERIDA (exigiria
   migration) — `modalidadesDaEscola` deriva do plano de forma
   tolerante e marca tudo como não-persistido.
   ============================================================ */
export const MODALIDADES = [
  { codigo: "concurso", rotulo: "Preparação para concurso", estado: "ativa",   nota: "Modalidade em produção (MOD atual)." },
  { codigo: "enem",     rotulo: "ENEM / vestibular",        estado: "em-breve", nota: "Placeholder — não implementado." },
  { codigo: "militar",  rotulo: "Carreiras militares",      estado: "em-breve", nota: "Placeholder — não implementado." },
  { codigo: "oab",      rotulo: "OAB / exames de ordem",    estado: "em-breve", nota: "Placeholder — não implementado." },
  { codigo: "idiomas",  rotulo: "Idiomas / proficiência",   estado: "estudo",   nota: "Em estudo — fora de escopo atual." },
];

export const ESTADO_MODALIDADE = {
  "ativa":    { rotulo: "Ativa",    tom: "ok" },
  "em-breve": { rotulo: "Em breve", tom: "alerta" },
  "estudo":   { rotulo: "Em estudo", tom: "neutro" },
};

// Modalidades habilitadas para uma escola. Sem coluna no banco ainda,
// derivamos do plano (tolerante) e SEMPRE incluímos 'concurso' (a única
// real). Retorna objetos {…modalidade, habilitada, persistido:false}.
export function modalidadesDaEscola(escola = {}) {
  const plano = txt(escola.plano);
  return MODALIDADES.map((m) => ({
    ...m,
    habilitada: m.codigo === "concurso" || (m.estado === "ativa" && TEM(plano, m.codigo)),
    persistido: false, // ainda não há persistência por escola (placeholder controlado)
  }));
}

/* ============================================================
   5) RESUMO DE RISCO do dashboard — tarefa 36.
   ------------------------------------------------------------
   Agrega a LISTA de escolas (backoffice_escolas) em contadores de
   saúde para o topo do painel: quantas sem coordenador, sem aluno,
   demo, suspensas, e quantas têm algum risco. Puro — só conta.
   ============================================================ */
export function resumoRisco(escolas = []) {
  const r = {
    total: escolas.length,
    semCoordenador: 0,
    semAlunos: 0,
    demo: 0,
    teste: 0,
    real: 0,
    individual: 0,
    suspensas: 0,
    comRisco: 0,
  };
  for (const e of escolas) {
    const cat = categoriaEscola(e).chave;
    r[cat] = (r[cat] ?? 0) + 1;
    const status = txt(e.status);
    if (status === "suspensa" || status === "cancelada") r.suspensas++;
    const semCoord = num(e.coordenadores) === 0;
    const semAlunos = num(e.alunos) === 0 && cat !== "demo";
    if (semCoord) r.semCoordenador++;
    if (semAlunos) r.semAlunos++;
    // "com risco" = teria pelo menos um aviso de nível risco/alerta.
    const sev = severidadeMaxima(avisosRisco(e, null));
    if (sev === "risco" || sev === "alerta") r.comRisco++;
  }
  return r;
}

/* ============================================================
   6) FILTROS da trilha de auditoria (admin_logs) — tarefa 40.
   ------------------------------------------------------------
   Área de logs legível com filtros por escola, ação, usuário e
   período. Puro: recebe os logs já lidos (backofficeLogs) e o
   critério, e devolve o subconjunto. Sem rede.
   ============================================================ */
export function filtrarLogs(logs = [], { escolaId = "", acao = "", usuarioId = "", periodoDias = 0, busca = "", nomePorEscola = {} } = {}) {
  const q = txt(busca);
  const corte = periodoDias > 0 ? Date.now() - periodoDias * 86400000 : null;
  return logs.filter((l) => {
    if (escolaId && l.escola_id !== escolaId) return false;
    if (acao && l.acao !== acao) return false;
    if (usuarioId && l.super_admin_id !== usuarioId) return false;
    if (corte != null) {
      const t = l.em ? new Date(l.em).getTime() : 0;
      if (!(t >= corte)) return false;
    }
    if (q) {
      const nomeEscola = txt(nomePorEscola[l.escola_id] ?? l.detalhe?.nome ?? "");
      const alvo = `${txt(l.acao)} ${nomeEscola} ${txt(l.detalhe?.email)} ${txt(l.detalhe?.nome)}`;
      if (!alvo.includes(q)) return false;
    }
    return true;
  });
}

// Ações distintas presentes nos logs — para popular o filtro de ação.
export function acoesPresentes(logs = []) {
  return [...new Set(logs.map((l) => l.acao).filter(Boolean))].sort();
}
