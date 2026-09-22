// Arquivo forense — Etapa 2, C-S01. Cópia exata do código-fonte da Edge
// Function `capture-oidc-20260919`, obtida via `get_edge_function` em
// 2026-09-22 antes da retirada, projeto demo `bdjkgrzfzoamchdpobbl`.
// Nenhum valor de secret está presente neste arquivo: as duas chamadas a
// Deno.env.get() abaixo leem `SUPABASE_URL` e `SUPABASE_SERVICE_ROLE_KEY`
// pelo nome da variável, nunca pelo valor.
//
// Metadados no momento do arquivamento:
//   id            476d325a-8b13-4368-8d14-c7d8e4a87e29
//   slug          capture-oidc-20260919
//   projeto       bdjkgrzfzoamchdpobbl (demo — nunca existiu em produção)
//   status        ACTIVE, versão 2
//   verify_jwt    true
//   criada em     2026-09-19 (epoch 1789847997895)
//   atualizada em 2026-09-19 (epoch 1789849294204)
//   ezbr_sha256   d74f6c5077ffc94acfda2a8926649fede5c184a338821dacc36d488e129bca20
//
// Diagnóstico completo: docs/e0-baseline.md, Bloco 4. Encerramento formal
// do achado: docs/e2-seguranca.md, item C-S01.

import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2";
import { createRemoteJWKSet, jwtVerify } from "npm:jose@6";

const REPO = "Jinriuk/Rumo-a-aprova-o-";
const REF = "refs/heads/tmp/triliva-pack-build-20260919";
const AUD = "triliva-capture-20260919";
const ISS = "https://token.actions.githubusercontent.com";
const JWKS = createRemoteJWKSet(new URL("https://token.actions.githubusercontent.com/.well-known/jwks"));
const profiles: Record<string,string> = {
  coordenacao: "coordenacao@meridiano.demo",
  aluno: "merihele2027@codigo.acesso.local",
  responsavel: "meriresp2027@codigo.acesso.local",
  beatriz: "merialun0003@codigo.acesso.local",
  camila: "merialun0007@codigo.acesso.local",
};
function json(body: unknown, status = 200) { return new Response(JSON.stringify(body), { status, headers: { "content-type":"application/json", "cache-control":"no-store" } }); }
Deno.serve(async (req: Request) => {
  if (req.method !== "POST") return json({error:"method"},405);
  const oidc = req.headers.get("x-capture-oidc") ?? "";
  if (!oidc) return json({error:"auth"},401);
  try {
    const {payload} = await jwtVerify(oidc,JWKS,{issuer:ISS,audience:AUD});
    if (payload.repository!==REPO || payload.ref!==REF || payload.event_name!=="push") return json({error:"claims"},403);
    if (!String(payload.workflow_ref??"").includes(".github/workflows/tmp-capture-triliva.yml@")) return json({error:"workflow"},403);
    const body = await req.json().catch(()=>({}));
    const profile=String(body?.profile??""); const email=profiles[profile]; if(!email) return json({error:"profile"},400);
    const sb=createClient(Deno.env.get("SUPABASE_URL")!,Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,{auth:{autoRefreshToken:false,persistSession:false}});
    const {data,error}=await sb.auth.admin.generateLink({type:"magiclink",email});
    if(error||!data?.properties?.hashed_token) return json({error:"link"},500);
    return json({token_hash:data.properties.hashed_token,profile});
  } catch { return json({error:"verify"},401); }
});
