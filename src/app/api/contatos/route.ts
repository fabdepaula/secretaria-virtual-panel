import { NextResponse } from "next/server";
import { z } from "zod";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { normalizePhones } from "@/lib/phone";

type ContatoRow = {
  id: string;
  nome: string;
  created_at: string;
};

type ContatoTelefoneRow = {
  contato_id: string;
  // Dependendo de como o Supabase resolve a relação, isso pode vir como objeto ou array.
  telefones:
    | { numero: string }
    | Array<{ numero: string }>
    | null;
};

const CreateContatosSchema = z.object({
  nome: z.string().min(1, "Nome é obrigatório"),
  telefones: z
    .array(z.string().min(1))
    .optional()
    .default([]),
});

export async function GET() {
  const supabase = createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ message: "Não autorizado" }, { status: 401 });
  }

  const { data: contatos, error: contatosErr } = await supabase
    .from("contatos")
    .select("id,nome,created_at")
    .order("created_at", { ascending: false });

  if (contatosErr) {
    return NextResponse.json(
      { message: "Erro ao listar contatos" },
      { status: 500 }
    );
  }

  const { data: contatoTelefones, error: relErr } = await supabase
    .from("contato_telefone")
    .select("contato_id, telefones(numero)")
    .order("contato_id");

  if (relErr) {
    return NextResponse.json(
      { message: "Erro ao listar telefones" },
      { status: 500 }
    );
  }

  const phoneByContato = new Map<string, string[]>();
  for (const rel of (contatoTelefones ?? []) as unknown[]) {
    const relTyped = rel as ContatoTelefoneRow;
    const contatoId = relTyped.contato_id;

    const telefonesVal = relTyped.telefones;
    const numeros: string[] = [];
    if (Array.isArray(telefonesVal)) {
      for (const t of telefonesVal) {
        if (t?.numero) numeros.push(t.numero);
      }
    } else if (telefonesVal?.numero) {
      numeros.push(telefonesVal.numero);
    }

    if (numeros.length === 0) continue;

    const list = phoneByContato.get(contatoId) ?? [];
    list.push(...numeros);
    phoneByContato.set(contatoId, list);
  }

  const result = (contatos ?? []).map((c) => {
    const contato = c as ContatoRow;
    return {
      id: contato.id,
      nome: contato.nome,
      created_at: contato.created_at,
      telefones: (phoneByContato.get(contato.id) ?? []).sort(),
    };
  });

  return NextResponse.json({ ok: true, data: result });
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
  const parsed = CreateContatosSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { message: parsed.error.flatten().fieldErrors },
      { status: 400 }
    );
  }

  const telefones = normalizePhones(parsed.data.telefones.join(",")); // garante normalização

  const { data: contato, error: contatoErr } = await supabase
    .from("contatos")
    .insert({ nome: parsed.data.nome })
    .select("id, nome, created_at")
    .single();

  if (contatoErr || !contato) {
    return NextResponse.json(
      { message: "Erro ao criar contato" },
      { status: 500 }
    );
  }

  for (const numero of telefones) {
    const { data: telefone, error: telErr } = await supabase
      .from("telefones")
      .insert({ numero })
      .select("id")
      .single();

    if (telErr || !telefone) {
      return NextResponse.json(
        { message: "Erro ao criar telefone" },
        { status: 500 }
      );
    }

    const { error: linkErr } = await supabase.from("contato_telefone").insert({
      contato_id: contato.id,
      telefone_id: telefone.id,
    });

    if (linkErr) {
      return NextResponse.json(
        { message: "Erro ao vincular telefone" },
        { status: 500 }
      );
    }
  }

  return NextResponse.json({ ok: true, data: contato });
}

