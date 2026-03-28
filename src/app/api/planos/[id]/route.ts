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

export async function PATCH(
  req: Request,
  { params }: { params: { id: string } }
) {
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

  const { error } = await supabase.from("planos").update({
    nome: payload.nome.trim(),
    descricao: payload.descricao ?? null,
    prioridade_atendimento: payload.prioridade_atendimento,
    prazo_pagamento_dias: payload.prazo_pagamento_dias,
    permite_faturamento: payload.permite_faturamento,
    ativo: payload.ativo,
  }).eq("id", params.id);

  if (error) {
    return NextResponse.json(
      { message: "Erro ao atualizar plano" },
      { status: 500 }
    );
  }

  return NextResponse.json({ ok: true });
}

export async function DELETE(
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

  const { error } = await supabase.from("planos").delete().eq("id", params.id);
  if (error) {
    return NextResponse.json(
      { message: "Erro ao excluir plano" },
      { status: 500 }
    );
  }

  return NextResponse.json({ ok: true });
}

