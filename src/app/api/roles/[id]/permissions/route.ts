import { NextResponse } from "next/server";
import { z } from "zod";
import { createSupabaseServerClient } from "@/lib/supabase/server";

const UpdateRolePermsSchema = z.object({
  permission_ids: z.array(z.string().uuid()).default([]),
});

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

export async function PUT(
  req: Request,
  { params }: { params: { id: string } }
) {
  const authz = await ensurePermission("usuarios.update");
  if (!authz.ok) return authz.response;

  const body = await req.json().catch(() => null);
  const parsed = UpdateRolePermsSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { message: "Dados inválidos", details: parsed.error.flatten() },
      { status: 400 }
    );
  }

  const roleId = params.id;
  const permissionIds = parsed.data.permission_ids;

  const { error: delErr } = await authz.supabase
    .from("panel_role_permissions")
    .delete()
    .eq("role_id", roleId);

  if (delErr) {
    return NextResponse.json(
      { message: "Erro ao limpar permissões da role", details: String(delErr.message ?? delErr) },
      { status: 500 }
    );
  }

  if (permissionIds.length > 0) {
    const rows = permissionIds.map((permissionId) => ({
      role_id: roleId,
      permission_id: permissionId,
    }));

    const { error: insErr } = await authz.supabase
      .from("panel_role_permissions")
      .insert(rows);

    if (insErr) {
      return NextResponse.json(
        { message: "Erro ao inserir permissões da role", details: String(insErr.message ?? insErr) },
        { status: 500 }
      );
    }
  }

  return NextResponse.json({ ok: true });
}

