/* Contas que o E2E do demo aceita (18/10, achado 4 do #192).
   O spec do aluno troca a senha no primeiro acesso (a nova só existe na
   memória do teste), resolve questões e fecha missão; o da jornada cadastra
   aluno na escola da coordenação. Na vitrine do demo, que é o que se mostra
   a cliente, isso estragaria contas que outras pessoas usam. Por isso só
   conta descartável, criada para a ocasião e apagada depois:
     • aluno: código começando com E2E e fora da lista da vitrine (seeds 04
       e 21);
     • qualquer papel: depois do login, a escola da sessão não pode ser a da
       vitrine. */
export const ESCOLA_VITRINE = "11111111-1111-4111-8111-111111111111";

const CODIGOS_VITRINE = /^(VITRINE\d+|LUCASDEMO2026|BRUNODEMO2026|RESPDEMO2026X|RESPBETA2026XX)$/;

/** Motivo da recusa, ou null se o código é de conta descartável. */
export function recusaCodigoDoDemo(codigo) {
  const c = String(codigo ?? "").replace(/[^a-zA-Z0-9]/g, "").toUpperCase();
  if (CODIGOS_VITRINE.test(c)) return `${c} é conta da vitrine do demo`;
  if (!/^E2E[A-Z0-9]{4,}$/.test(c)) return `${c || "(vazio)"} não é conta descartável (o código precisa ser E2E seguido de 4 ou mais letras ou números)`;
  return null;
}

/** escola_id da sessão do Supabase guardada pelo app (null se não houver). */
export function escolaDaSessao(page) {
  return page.evaluate(() => {
    for (let i = 0; i < localStorage.length; i++) {
      const chave = localStorage.key(i);
      if (!/^sb-.*-auth-token$/.test(chave ?? "")) continue;
      try { return JSON.parse(localStorage.getItem(chave))?.user?.app_metadata?.escola_id ?? null; } catch { return null; }
    }
    return null;
  });
}

/** Lança (o teste falha, não pula) se a sessão é da escola da vitrine. */
export async function recusarEscolaDaVitrine(page) {
  const escola = await escolaDaSessao(page);
  if (escola === ESCOLA_VITRINE) {
    throw new Error("Recusado: a conta é da escola da vitrine do demo. Use uma conta descartável numa escola de teste.");
  }
}
