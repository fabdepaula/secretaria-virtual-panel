import { NextResponse } from "next/server";
import { ensureColetaPermission } from "@/lib/coleta-auth";

export const dynamic = "force-dynamic";

export async function GET(
  _req: Request,
  { params }: { params: { id: string } }
) {
  const authz = await ensureColetaPermission("coleta.read");
  if (!authz.ok) return authz.response;

  const { data, error } = await authz.supabase
    .from("operacao_coleta_eventos")
    .select("evento_id,coleta_id,criado_em,evento,ator,operador,motivo,entregador")
    .eq("coleta_id", params.id)
    .order("criado_em", { ascending: true });

  if (error) {
    return NextResponse.json(
      {
        ok: false,
        message: "Erro ao carregar histórico",
        details: String(error.message ?? error),
      },
      { status: 500 }
    );
  }

  return NextResponse.json({ ok: true, data: { eventos: data ?? [] } });
}
