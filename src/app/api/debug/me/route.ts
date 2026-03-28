import { NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export async function GET() {
  const supabase = createSupabaseServerClient();

  const {
    data: { user },
    error: userErr,
  } = await supabase.auth.getUser();

  if (userErr || !user) {
    return NextResponse.json(
      { ok: false, message: "Não autorizado" },
      { status: 401 }
    );
  }

  // Essas RPCs foram criadas no `supabase/panel_rls.sql`.
  const { data: roleId, error: roleErr } = await supabase.rpc(
    "current_panel_role_id"
  );
  const { data: canClientesRead, error: permErr } = await supabase.rpc(
    "has_panel_permission",
    { permission_key: "clientes.read" }
  );

  const { data: canPlanosRead, error: permPlanosErr } = await supabase.rpc(
    "has_panel_permission",
    { permission_key: "planos.read" }
  );

  const { data: canServicosRead, error: permServicosErr } = await supabase.rpc(
    "has_panel_permission",
    { permission_key: "servicos.read" }
  );

  // Teste real da policy: retorna 1 registro (se permitido)
  const { data: oneCliente, error: clientesErr } = await supabase
    .from("clientes")
    .select("id,nome,tipo_cliente,documento")
    .limit(1);

  const { data: onePlano, error: planosErr } = await supabase
    .from("planos")
    .select("id,nome")
    .limit(1);

  const { data: oneServico, error: servicosErr } = await supabase
    .from("Services")
    .select("id,nome")
    .limit(1);

  return NextResponse.json({
    ok: true,
    auth_uid: user.id,
    role_id: roleErr ? null : roleId,
    can_clientes_read: permErr ? null : canClientesRead,
    can_planos_read: permPlanosErr ? null : canPlanosRead,
    can_servicos_read: permServicosErr ? null : canServicosRead,
    clientes_error: clientesErr ? String(clientesErr.message ?? clientesErr) : null,
    planos_error: planosErr ? String(planosErr.message ?? planosErr) : null,
    servicos_error: servicosErr ? String(servicosErr.message ?? servicosErr) : null,
    one_cliente: oneCliente?.[0] ?? null,
    one_plano: onePlano?.[0] ?? null,
    one_servico: oneServico?.[0] ?? null,
  });
}

