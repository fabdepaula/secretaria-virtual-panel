import { NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";

async function ensurePermission(permissionKey: string) {
  const supabase = createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return { ok: false as const, response: NextResponse.json({ message: "Não autorizado" }, { status: 401 }) };
  }

  const { data: allowed, error } = await supabase.rpc("has_panel_permission", {
    permission_key: permissionKey,
  });

  if (error || !allowed) {
    return {
      ok: false as const,
      response: NextResponse.json({ message: "Sem permissão" }, { status: 403 }),
    };
  }

  return { ok: true as const, supabase };
}

export async function GET() {
  const authz = await ensurePermission("usuarios.read");
  if (!authz.ok) return authz.response;

  const [rolesRes, permsRes, linksRes] = await Promise.all([
    authz.supabase.from("panel_roles").select("id,nome,ativo").order("nome", { ascending: true }),
    authz.supabase.from("panel_permissions").select("id,chave,descricao").order("chave", { ascending: true }),
    authz.supabase.from("panel_role_permissions").select("role_id,permission_id"),
  ]);

  if (rolesRes.error || permsRes.error || linksRes.error) {
    return NextResponse.json(
      { message: "Erro ao carregar metadados de usuários" },
      { status: 500 }
    );
  }

  return NextResponse.json({
    ok: true,
    data: {
      roles: rolesRes.data ?? [],
      permissions: permsRes.data ?? [],
      role_permissions: linksRes.data ?? [],
    },
  });
}

