import { NextResponse } from "next/server";
import { ensureColetaPermission } from "@/lib/coleta-auth";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const authz = await ensureColetaPermission("coleta.read");
  if (!authz.ok) return authz.response;

  const { searchParams } = new URL(req.url);
  const statusFilter = searchParams.get("status");

  let filaQuery = authz.supabase
    .from("operacao_fila_coletas")
    .select("*")
    .order("prioridade", { ascending: true })
    .order("desde", { ascending: true });

  if (statusFilter) {
    const statuses = statusFilter
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean);
    if (statuses.length === 1) {
      filaQuery = filaQuery.eq("status", statuses[0]);
    } else if (statuses.length > 1) {
      filaQuery = filaQuery.in("status", statuses);
    }
  }

  const [filaRes, resumoRes, updateRes] = await Promise.all([
    filaQuery,
    authz.supabase.from("operacao_resumo").select("*").maybeSingle(),
    authz.supabase.rpc("has_panel_permission", {
      permission_key: "coleta.update",
    }),
  ]);

  if (filaRes.error) {
    return NextResponse.json(
      {
        ok: false,
        message: "Erro ao carregar fila de coletas",
        details: String(filaRes.error.message ?? filaRes.error),
      },
      { status: 500 }
    );
  }

  if (resumoRes.error) {
    return NextResponse.json(
      {
        ok: false,
        message: "Erro ao carregar resumo",
        details: String(resumoRes.error.message ?? resumoRes.error),
      },
      { status: 500 }
    );
  }

  return NextResponse.json({
    ok: true,
    data: {
      coletas: filaRes.data ?? [],
      resumo: resumoRes.data ?? {
        coletas_abertas: 0,
        exigem_operador: 0,
        sla_estourado: 0,
        solicitadas: 0,
        atribuidas: 0,
        em_curso: 0,
        entregadores_disponiveis: 0,
        entregadores_ocupados: 0,
        entregadores_offline: 0,
        entregadores_posicao_incerta: 0,
      },
      gerado_em: new Date().toISOString(),
      pode_atualizar: updateRes.data === true,
    },
  });
}
