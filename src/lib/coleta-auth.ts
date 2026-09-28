import { NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import type { SupabaseClient, User } from "@supabase/supabase-js";

export async function ensureColetaPermission(permissionKey: string): Promise<
  | { ok: true; supabase: SupabaseClient; user: User }
  | { ok: false; response: NextResponse }
> {
  const supabase = createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return {
      ok: false,
      response: NextResponse.json(
        { ok: false, message: "Não autorizado" },
        { status: 401 }
      ),
    };
  }

  const { data: allowed, error } = await supabase.rpc("has_panel_permission", {
    permission_key: permissionKey,
  });

  if (error || !allowed) {
    return {
      ok: false,
      response: NextResponse.json(
        { ok: false, message: "Sem permissão" },
        { status: 403 }
      ),
    };
  }

  return { ok: true, supabase, user };
}
