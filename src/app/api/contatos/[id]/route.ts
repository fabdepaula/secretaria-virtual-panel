import { NextResponse } from "next/server";
import { z } from "zod";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { normalizePhones } from "@/lib/phone";

const UpdateContatosSchema = z.object({
  nome: z.string().min(1, "Nome é obrigatório"),
  telefones: z
    .array(z.string().min(1))
    .optional()
    .default([]),
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
  const parsed = UpdateContatosSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { message: parsed.error.flatten().fieldErrors },
      { status: 400 }
    );
  }

  const { error: updateContatoErr } = await supabase
    .from("contatos")
    .update({ nome: parsed.data.nome })
    .eq("id", params.id);

  if (updateContatoErr) {
    return NextResponse.json(
      { message: "Erro ao atualizar contato" },
      { status: 500 }
    );
  }

  // Recria vínculos de telefones para simplificar o MVP.
  const { error: delLinksErr } = await supabase
    .from("contato_telefone")
    .delete()
    .eq("contato_id", params.id);

  if (delLinksErr) {
    return NextResponse.json(
      { message: "Erro ao redefinir telefones" },
      { status: 500 }
    );
  }

  const telefones = normalizePhones(parsed.data.telefones.join(","));

  for (const numero of telefones) {
    // Reutiliza telefone existente quando possível (evita duplicar demais).
    const { data: existingTel } = await supabase
      .from("telefones")
      .select("id")
      .eq("numero", numero)
      .maybeSingle();

    const telefoneId =
      existingTel?.id ??
      (await supabase
        .from("telefones")
        .insert({ numero })
        .select("id")
        .single()
        .then((r) => r.data?.id));

    if (!telefoneId) {
      return NextResponse.json(
        { message: "Erro ao criar telefone" },
        { status: 500 }
      );
    }

    const { error: linkErr } = await supabase.from("contato_telefone").insert({
      contato_id: params.id,
      telefone_id: telefoneId,
    });

    if (linkErr) {
      return NextResponse.json(
        { message: "Erro ao vincular telefone" },
        { status: 500 }
      );
    }
  }

  return NextResponse.json({ ok: true });
}

export async function DELETE(
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

  const { error: delLinksErr } = await supabase
    .from("contato_telefone")
    .delete()
    .eq("contato_id", params.id);

  if (delLinksErr) {
    return NextResponse.json(
      { message: "Erro ao remover vínculos" },
      { status: 500 }
    );
  }

  const { error: delContatoErr } = await supabase
    .from("contatos")
    .delete()
    .eq("id", params.id);

  if (delContatoErr) {
    return NextResponse.json(
      { message: "Erro ao excluir contato" },
      { status: 500 }
    );
  }

  return NextResponse.json({ ok: true });
}

