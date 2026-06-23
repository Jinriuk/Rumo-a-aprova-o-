// Contexto comum das Edge Functions. AQUI (e só aqui) vive a chave
// de serviço — injetada pelo Supabase no ambiente da função. Ela
// NUNCA aparece no front nem no repositório (Doc 4, seção 12, risco nº 1).
import { createClient, SupabaseClient } from "jsr:@supabase/supabase-js@2";

export const admin: SupabaseClient = createClient(
  Deno.env.get("SUPABASE_URL")!,
  Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  { auth: { persistSession: false } },
);

export const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, apikey, content-type, x-client-info",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

export const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...cors, "content-type": "application/json" },
  });

export type Chamador = {
  id: string;
  escola_id: string;
  papel: "coordenacao" | "aluno" | "responsavel";
};

// Identifica quem chama pela credencial REAL do token (verificada
// pelo Auth), não por campo de formulário.
export async function chamador(req: Request): Promise<Chamador | null> {
  const auth = req.headers.get("authorization") ?? "";
  const token = auth.replace(/^Bearer\s+/i, "");
  if (!token) return null;
  const { data, error } = await admin.auth.getUser(token);
  if (error || !data.user) return null;
  const meta = (data.user.app_metadata ?? {}) as Record<string, string>;
  if (!meta.escola_id || !meta.papel) return null;
  return { id: data.user.id, escola_id: meta.escola_id, papel: meta.papel as Chamador["papel"] };
}

// Confere que o aluno existe e pertence à escola de quem chama.
export async function alunoDaEscola(alunoId: string, escolaId: string) {
  const { data, error } = await admin
    .from("alunos")
    .select("id, escola_id, nome, usuario_id, trilha_id")
    .eq("id", alunoId)
    .eq("escola_id", escolaId)
    .maybeSingle();
  if (error) throw error;
  return data;
}

export async function registrarLog(
  escolaId: string, alunoId: string, usuarioId: string, papel: string, acao: string,
) {
  const { error } = await admin.from("logs_acesso").insert({
    escola_id: escolaId, aluno_id: alunoId, usuario_id: usuarioId, papel, acao,
  });
  if (error) console.error("falha ao registrar log de acesso:", error.message);
}
