// Dependências já instaladas no repositório, sem package.json novo:
// `pg` vem de tests/ (npm ci em tests) e `@supabase/supabase-js` de
// app/ (npm ci em app). O E2E instala os dois de qualquer forma.
import { createRequire } from "node:module";

const deTests = createRequire(new URL("../../tests/package.json", import.meta.url));
const deApp = createRequire(new URL("../../app/package.json", import.meta.url));

export const pg = deTests("pg");
export const { createClient } = deApp("@supabase/supabase-js");
