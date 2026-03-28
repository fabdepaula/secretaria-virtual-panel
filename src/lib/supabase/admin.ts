import { createClient, type SupabaseClient } from "@supabase/supabase-js";

let adminClient: SupabaseClient | undefined;

function createAdminClient(): SupabaseClient {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseServiceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl) throw new Error("Missing NEXT_PUBLIC_SUPABASE_URL");
  if (!supabaseServiceRoleKey)
    throw new Error("Missing SUPABASE_SERVICE_ROLE_KEY");

  return createClient(supabaseUrl, supabaseServiceRoleKey, {
    auth: { persistSession: false },
  });
}

/**
 * Cliente admin (service role) só para servidor / API routes.
 * Inicialização lazy: `next build` pode carregar o módulo sem `SUPABASE_SERVICE_ROLE_KEY`;
 * o erro só ocorre na primeira utilização em runtime.
 */
export const supabaseAdmin = new Proxy({} as SupabaseClient, {
  get(_target, prop) {
    if (!adminClient) adminClient = createAdminClient();
    const value = (adminClient as unknown as Record<string | symbol, unknown>)[
      prop
    ];
    return typeof value === "function"
      ? (value as (...a: unknown[]) => unknown).bind(adminClient)
      : value;
  },
});
