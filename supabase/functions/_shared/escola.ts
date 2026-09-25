// Porteiro de escola operacional para as Edge Functions da coordenação.
//
// Por que existe (Etapa 2, fatia 7): suspender ou cancelar uma escola só
// muda `escolas.status`, e quem barra é a RLS, por `app.tenant_operacional()`.
// As Edge Functions falam com o banco pela chave de serviço, que ignora a
// RLS; sem este porteiro, a coordenação de escola suspensa ou cancelada
// seguia criando contas, trocando credenciais, gerando meta e exportando
// o dossiê LGPD de qualquer aluno da escola.
//
// Mesma regra da 0056: escola ausente ou inexistente não opera; existente
// opera se não estiver suspensa nem cancelada. O super_admin não passa
// por aqui (as funções dele têm porteiro próprio, `internal_admins`).
//
// Sem import de rede de propósito: o cliente entra por parâmetro, e o
// teste roda este arquivo no Node com um cliente falso.

type ClienteLeitura = { from: (tabela: string) => any };

export const STATUS_PARADOS = ["suspensa", "cancelada"];

export const RESPOSTA_ESCOLA_PARADA = {
  error: "escola suspensa ou cancelada: operação indisponível",
  estado: "escola_nao_operacional",
};

export async function escolaOperacional(
  admin: ClienteLeitura,
  escolaId: string | null | undefined,
): Promise<boolean> {
  if (!escolaId) return false;
  const { data, error } = await admin
    .from("escolas")
    .select("status")
    .eq("id", escolaId)
    .maybeSingle();
  if (error) throw error;
  return !!data && !STATUS_PARADOS.includes(data.status);
}
