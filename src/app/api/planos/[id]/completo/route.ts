import { NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export async function GET(
  _req: Request,
  { params }: { params: { id: string } }
) {
  const supabase = createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ message: "Não autorizado" }, { status: 401 });
  }

  const { data: plano, error: planoErr } = await supabase
    .from("planos")
    .select(
      "id,nome,descricao,prioridade_atendimento,prazo_pagamento_dias,permite_faturamento,ativo"
    )
    .eq("id", params.id)
    .maybeSingle();

  if (planoErr || !plano) {
    return NextResponse.json(
      { message: "Plano não encontrado" },
      { status: 404 }
    );
  }

  const { data: mappings, error: mapErr } = await supabase
    .from("plano_servicos")
    .select("id,plano_id,servico_id,valor_especifico,prazo_especifico,ativo")
    .eq("plano_id", params.id)
    .order("id", { ascending: true });

  if (mapErr) {
    return NextResponse.json(
      { message: "Erro ao listar serviços do plano" },
      { status: 500 }
    );
  }

  const servicoIds = Array.from(
    new Set((mappings ?? []).map((m) => m.servico_id))
  );
  const serviceNameById = new Map<string, string>();
  if (servicoIds.length > 0) {
    const { data: services } = await supabase
      .from("Services")
      .select("id,nome")
      .in("id", servicoIds);
    for (const s of services ?? []) {
      serviceNameById.set(s.id, s.nome);
    }
  }

  const { data: clientes, error: cliErr } = await supabase
    .from("clientes")
    .select("id,tipo_cliente,nome,nome_fantasia,documento,plano_id")
    .eq("plano_id", params.id)
    .order("nome", { ascending: true });

  if (cliErr) {
    return NextResponse.json(
      { message: "Erro ao listar clientes do plano" },
      { status: 500 }
    );
  }

  return NextResponse.json({
    ok: true,
    data: {
      plano,
      plano_servicos: (mappings ?? []).map((m) => ({
        id: m.id,
        plano_id: m.plano_id,
        servico_id: m.servico_id,
        servico_nome: serviceNameById.get(m.servico_id) ?? "",
        valor_especifico: m.valor_especifico,
        prazo_especifico: m.prazo_especifico,
        ativo: m.ativo,
      })),
      clientes: clientes ?? [],
    },
  });
}
