import { NextResponse } from "next/server";
import { z } from "zod";
import { createSupabaseServerClient } from "@/lib/supabase/server";

const PlanoServicoSchema = z.object({
  plano_id: z.string().min(1, "Selecione um plano"),
  servico_id: z.string().min(1, "Selecione um serviço"),
  valor_especifico: z.preprocess((v) => {
    if (typeof v === "string") return Number(v);
    if (typeof v === "number") return v;
    return v;
  }, z.number()),
  prazo_especifico: z.string().min(0).optional().nullable(),
  ativo: z.boolean(),
});

export async function GET() {
  const supabase = createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ message: "Não autorizado" }, { status: 401 });
  }

  const { data: mappings, error: mapErr } = await supabase
    .from("plano_servicos")
    .select("id,plano_id,servico_id,valor_especifico,prazo_especifico,ativo");

  if (mapErr) {
    return NextResponse.json(
      { message: "Erro ao listar relações plano-serviço" },
      { status: 500 }
    );
  }

  const { data: plans } = await supabase.from("planos").select("id,nome");
  const { data: services } = await supabase.from("Services").select("id,nome");

  const planNameById = new Map<string, string>();
  for (const p of plans ?? []) {
    planNameById.set(p.id, p.nome);
  }

  const serviceNameById = new Map<string, string>();
  for (const s of services ?? []) {
    serviceNameById.set(s.id, s.nome);
  }

  return NextResponse.json({
    ok: true,
    data: (mappings ?? []).map((m) => ({
      id: m.id,
      plano_id: m.plano_id,
      servico_id: m.servico_id,
      plano_nome: planNameById.get(m.plano_id) ?? "",
      servico_nome: serviceNameById.get(m.servico_id) ?? "",
      valor_especifico: m.valor_especifico,
      prazo_especifico: m.prazo_especifico,
      ativo: m.ativo,
    })),
  });
}

export async function POST(req: Request) {
  const supabase = createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ message: "Não autorizado" }, { status: 401 });
  }

  const body = await req.json().catch(() => null);
  const parsed = PlanoServicoSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { message: "Dados inválidos", details: parsed.error.flatten() },
      { status: 400 }
    );
  }

  const payload = parsed.data;

  const { data, error } = await supabase
    .from("plano_servicos")
    .insert({
      plano_id: payload.plano_id,
      servico_id: payload.servico_id,
      valor_especifico: payload.valor_especifico,
      prazo_especifico: payload.prazo_especifico ?? null,
      ativo: payload.ativo,
    })
    .select("id")
    .single();

  if (error || !data) {
    return NextResponse.json(
      { message: "Erro ao criar relação" },
      { status: 500 }
    );
  }

  return NextResponse.json({ ok: true, id: data.id });
}

