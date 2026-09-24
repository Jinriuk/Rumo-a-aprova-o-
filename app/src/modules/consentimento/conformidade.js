/* Regras da aba LGPD (Conformidade), fora do JSX para serem testáveis
   sem navegador. Nada aqui decide acesso: só lê o que a RLS já deixou
   a coordenação ver. */

// D10: `logs_acesso.papel` guarda o código (check da 0001: coordenacao,
// aluno, responsavel). A tela mostrava o código cru.
export const PAPEL_ROTULO = {
  coordenacao: "Coordenação",
  aluno: "Aluno",
  responsavel: "Responsável",
};

export function rotuloPapel(papel) {
  return PAPEL_ROTULO[papel] ?? papel ?? "—";
}

// D01/D03: o contador de consentimentos é "N de M alunos". Verde só
// quando TODOS os alunos têm consentimento; âmbar quando falta algum
// (o "0" das capturas de 19/09 saía verde, a cor de sucesso). Conta
// alunos distintos que ainda existem — consentimento de aluno removido
// não fecha a conta de ninguém.
export function resumirConsentimentos(consentimentos, alunosPorId) {
  const alunos = Object.values(alunosPorId ?? {});
  const comConsentimento = new Set(
    (consentimentos ?? []).map((c) => c.aluno_id).filter((id) => alunosPorId?.[id]),
  );
  const pendentes = alunos
    .filter((a) => !comConsentimento.has(a.id))
    .sort((a, b) => String(a.nome).localeCompare(String(b.nome), "pt-BR"));
  const total = alunos.length;
  const consentidos = comConsentimento.size;
  const completo = total > 0 && consentidos >= total;
  return {
    consentidos, total, pendentes, completo,
    tom: total === 0 ? "neutro" : completo ? "ok" : "alerta",
  };
}

// D11: o valor principal do card "Último acesso" era a palavra
// "registrado", com a data escondida no subtítulo. Agora a data e a
// hora são o valor; o ano só aparece quando não é o corrente. Fuso do
// produto (America/Sao_Paulo), não o do navegador.
const FUSO = "America/Sao_Paulo";

function partes(data) {
  const p = Object.fromEntries(
    new Intl.DateTimeFormat("pt-BR", {
      timeZone: FUSO, day: "2-digit", month: "2-digit", year: "numeric",
      hour: "2-digit", minute: "2-digit", hourCycle: "h23",
    }).formatToParts(data).map((x) => [x.type, x.value]),
  );
  return p;
}

export function formatarUltimoAcesso(em, agora = new Date()) {
  if (!em) return "—";
  const d = new Date(em);
  if (Number.isNaN(d.getTime())) return "—";
  const p = partes(d);
  const anoCorrente = partes(agora).year;
  const dia = p.year === anoCorrente ? `${p.day}/${p.month}` : `${p.day}/${p.month}/${p.year}`;
  return `${dia} ${p.hour}:${p.minute}`;
}
