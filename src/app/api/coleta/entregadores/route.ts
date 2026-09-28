import { NextResponse } from "next/server";
import { ensureColetaPermission } from "@/lib/coleta-auth";

export const dynamic = "force-dynamic";

const STATUS_ORDEM: Record<string, number> = {
  disponivel: 0,
  ocupado: 1,
  offline: 2,
};

export async function GET() {
  const authz = await ensureColetaPermission("coleta.read");
  if (!authz.ok) return authz.response;

  const { data, error } = await authz.supabase
    .from("operacao_mapa_entregadores")
    .select(
      "id,nome,status,ativo,coletas_ativas,capacidade_max,sem_vaga,posicao_incerta"
    )
    .eq("ativo", true);

  if (error) {
    return NextResponse.json(
      {
        ok: false,
        message: "Erro ao listar entregadores",
        details: String(error.message ?? error),
      },
      { status: 500 }
    );
  }

  const entregadores = (data ?? []).slice().sort((a, b) => {
    const oa = STATUS_ORDEM[String(a.status)] ?? 9;
    const ob = STATUS_ORDEM[String(b.status)] ?? 9;
    if (oa !== ob) return oa - ob;
    return String(a.nome ?? "").localeCompare(String(b.nome ?? ""), "pt-BR");
  });

  return NextResponse.json({ ok: true, data: { entregadores } });
}
