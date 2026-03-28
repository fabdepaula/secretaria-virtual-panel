import { NextResponse } from "next/server";
import { z } from "zod";
import { createSupabaseServerClient } from "@/lib/supabase/server";

const IntSchema = z.preprocess((v) => {
  if (typeof v === "string") return Number(v);
  if (typeof v === "number") return v;
  return v;
}, z.number().int());

const PlanoSchema = z.object({
  nome: z.string().min(1, "Nome é obrigatório"),
  descricao: z.string().optional().nullable(),
  prioridade_atendimento: IntSchema,
  prazo_pagamento_dias: IntSchema,
  permite_faturamento: z.boolean(),
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

  const { data: planos, error } = await supabase
    .from("planos")
    .select(
      "id,nome,descricao,prioridade_atendimento,prazo_pagamento_dias,permite_faturamento,ativo"
    )
    .order("nome", { ascending: true });

  if (error) {
    return NextResponse.json(
      { message: "Erro ao listar planos" },
      { status: 500 }
    );
  }

  return NextResponse.json({ ok: true, data: planos ?? [] });
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
  const parsed = PlanoSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { message: "Dados inválidos", details: parsed.error.flatten() },
      { status: 400 }
    );
  }

  const payload = parsed.data;

  const { data: inserted, error } = await supabase
    .from("planos")
    .insert({
      nome: payload.nome.trim(),
      descricao: payload.descricao ?? null,
      prioridade_atendimento: payload.prioridade_atendimento,
      prazo_pagamento_dias: payload.prazo_pagamento_dias,
      permite_faturamento: payload.permite_faturamento,
      ativo: payload.ativo,
    })
    .select("id")
    .single();

  if (error || !inserted) {
    return NextResponse.json(
      { message: "Erro ao criar plano" },
      { status: 500 }
    );
  }

  return NextResponse.json({ ok: true, id: inserted.id });
}

