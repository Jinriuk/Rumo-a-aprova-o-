// Cliente Supabase do FRONT. Só a chave pública (anon) entra aqui.
// A chave de serviço NUNCA chega perto deste arquivo: ela vive nas
// Edge Functions (supabase/functions), e só lá.
import { createClient } from "@supabase/supabase-js";

const url = import.meta.env.VITE_SUPABASE_URL;
const anon = import.meta.env.VITE_SUPABASE_ANON_KEY;

if (!url || !anon) {
  // sem falha silenciosa: melhor quebrar com mensagem do que rodar sem banco
  throw new Error("Configure VITE_SUPABASE_URL e VITE_SUPABASE_ANON_KEY (.env — ver .env.example).");
}

export const supabase = createClient(url, anon);
