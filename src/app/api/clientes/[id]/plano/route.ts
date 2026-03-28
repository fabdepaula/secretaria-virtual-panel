import { NextResponse } from "next/server";
import { z } from "zod";
import { createSupabaseServerClient } from "@/lib/supabase/server";

const BodySchema = z.object({
  plano_id: z.preprocess(
    (v) => (v === "" || v === undefined ? null : v),
    z.union([z.string().uuid(), z.null()])
  ),
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
  const parsed = BodySchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { message: "Dados inválidos", details: parsed.error.flatten() },
      { status: 400 }
    );
  }

  const { error } = await supabase
    .from("clientes")
    .update({ plano_id: parsed.data.plano_id })
    .eq("id", params.id);

  if (error) {
    return NextResponse.json(
      { message: "Erro ao atualizar plano do cliente", details: String(error.message ?? error) },
      { status: 500 }
    );
  }

  return NextResponse.json({ ok: true });
}
