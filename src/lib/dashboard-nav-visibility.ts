import type { SupabaseClient } from "@supabase/supabase-js";

export type DashboardNavModule =
  | "contatos"
  | "clientes"
  | "servicos"
  | "planos"
  | "usuarios";

export type DashboardNavVisibility = Record<DashboardNavModule, boolean>;

const MODULES: DashboardNavModule[] = [
  "contatos",
  "clientes",
  "servicos",
  "planos",
  "usuarios",
];

const ACTIONS = ["read", "create", "update", "delete"] as const;

/**
 * Mostra item de menu se o role tiver pelo menos uma permissão do módulo (qualquer ação).
 */
export async function getDashboardNavVisibility(
  supabase: SupabaseClient
): Promise<DashboardNavVisibility> {
  const out = {} as DashboardNavVisibility;

  for (const mod of MODULES) {
    let any = false;
    for (const action of ACTIONS) {
      const { data, error } = await supabase.rpc("has_panel_permission", {
        permission_key: `${mod}.${action}`,
      });
      if (!error && data === true) {
        any = true;
        break;
      }
    }
    out[mod] = any;
  }

  return out;
}
