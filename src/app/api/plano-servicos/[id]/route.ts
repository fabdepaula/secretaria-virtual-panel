import { NextResponse } from "next/server";
import { z } from "zod";
import { createSupabaseServerClient } from "@/lib/supabase/server";

const IntSchema = z.preprocess((v) => {
  if (typeof v === "string") return Number(v);
  if (typeof v === "number") return v;
  return v;
}, z.number());

const PlanoServicoSchema = z.object({
  plano_id: z.string().min(1, "Selecione um plano"),
  servico_id: z.string().min(1, "Selecione um serviço"),
  valor_especifico: IntSchema,
  prazo_especifico: z.string().optional().nullable(),
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
  const parsed = PlanoServicoSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { message: "Dados inválidos", details: parsed.error.flatten() },
      { status: 400 }
    );
  }

  const payload = parsed.data;

  const { error } = await supabase
    .from("plano_servicos")
    .update({
      plano_id: payload.plano_id,
      servico_id: payload.servico_id,
      valor_especifico: payload.valor_especifico,
      prazo_especifico: payload.prazo_especifico ?? null,
      ativo: payload.ativo,
    })
    .eq("id", params.id);

  if (error) {
    return NextResponse.json(
      { message: "Erro ao atualizar relação" },
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

  const { error } = await supabase.from("plano_servicos").delete().eq("id", params.id);
  if (error) {
    return NextResponse.json(
      { message: "Erro ao excluir relação" },
      { status: 500 }
    );
  }

  return NextResponse.json({ ok: true });
}

