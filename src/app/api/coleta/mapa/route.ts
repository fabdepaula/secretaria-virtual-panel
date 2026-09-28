import { NextResponse } from "next/server";
import { ensureColetaPermission } from "@/lib/coleta-auth";

export const dynamic = "force-dynamic";

export async function GET() {
  const authz = await ensureColetaPermission("coleta.read");
  if (!authz.ok) return authz.response;

  const [entregadoresRes, pontosRes] = await Promise.all([
    authz.supabase.from("operacao_mapa_entregadores").select("*"),
    authz.supabase.from("operacao_mapa_pontos").select("*"),
  ]);

  if (entregadoresRes.error) {
    return NextResponse.json(
      {
        ok: false,
        message: "Erro ao carregar entregadores",
        details: String(entregadoresRes.error.message ?? entregadoresRes.error),
      },
      { status: 500 }
    );
  }

  if (pontosRes.error) {
    return NextResponse.json(
      {
        ok: false,
        message: "Erro ao carregar pontos do mapa",
        details: String(pontosRes.error.message ?? pontosRes.error),
      },
      { status: 500 }
    );
  }

  return NextResponse.json({
    ok: true,
    data: {
      entregadores: entregadoresRes.data ?? [],
      pontos: pontosRes.data ?? [],
      gerado_em: new Date().toISOString(),
    },
  });
}
