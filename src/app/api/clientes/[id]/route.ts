import { NextResponse } from "next/server";
import { z } from "zod";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { onlyDigits, validateDocumento } from "@/lib/documento";
import { ClienteTipoSchema } from "@/lib/cliente-tipo";

const EnderecoSchema = z.object({
  tipo_endereco: z.string().optional().default(""),
  logradouro: z.string().optional().default(""),
  numero: z.string().optional().default(""),
  complemento: z.string().optional().default(""),
  bairro: z.string().optional().default(""),
  cidade: z.string().optional().default(""),
  estado: z.string().optional().default(""),
  cep: z.string().optional().default(""),
  latitude: z.union([z.string(), z.number()]).optional().nullable(),
  longitude: z.union([z.string(), z.number()]).optional().nullable(),
});

const ContatoVinculoSchema = z.object({
  contato_id: z.preprocess(
    (v) => (typeof v === "string" ? v : String(v ?? "")),
    z.string().min(1, "Selecione um contato")
  ),
  cargo: z.preprocess(
    (v) => (typeof v === "string" ? v : String(v ?? "")),
    z.string().optional().default("")
  ),
});

const UpdateClienteSchema = z.object({
  tipo_cliente: ClienteTipoSchema,
  nome: z.string().min(1, "Nome é obrigatório"),
  nome_fantasia: z.string().optional().nullable(),
  documento: z.string().optional().nullable(),
  plano_id: z.string().optional().nullable(),
  enderecos: z.array(EnderecoSchema).optional().default([]),
  contatos_vinculados: z.array(ContatoVinculoSchema).optional().default([]),
});

function toDbTipoCliente(tipo: "PF" | "PJ"): "pf" | "pj" {
  return tipo === "PJ" ? "pj" : "pf";
}

function toNullableString(v: string | null | undefined): string | null {
  const s = v ?? "";
  const trimmed = s.trim();
  return trimmed.length ? trimmed : null;
}

function toNullableNumber(v: string | number | null | undefined): number | null {
  if (v === null || v === undefined) return null;
  const n = typeof v === "number" ? v : Number(v);
  return Number.isFinite(n) ? n : null;
}

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

  const { data: cliente, error: clienteErr } = await supabase
    .from("clientes")
    .select(
      "id,tipo_cliente,nome,nome_fantasia,documento,plano_id,created_at,updated_at"
    )
    .eq("id", params.id)
    .maybeSingle();

  if (clienteErr || !cliente) {
    return NextResponse.json(
      { message: "Cliente não encontrado" },
      { status: 404 }
    );
  }

  const { data: enderecos, error: endErr } = await supabase
    .from("enderecos")
    .select(
      "id,tipo_endereco,logradouro,numero,complemento,bairro,cidade,estado,cep,latitude,longitude"
    )
    .eq("cliente_id", params.id)
    .order("created_at", { ascending: true });

  if (endErr) {
    return NextResponse.json(
      { message: "Erro ao buscar endereços" },
      { status: 500 }
    );
  }

  const { data: links, error: linksErr } = await supabase
    .from("cliente_contato")
    .select("contato_id,cargo")
    .eq("cliente_id", params.id);

  if (linksErr) {
    return NextResponse.json(
      { message: "Erro ao buscar contatos vinculados" },
      { status: 500 }
    );
  }

  const contatoIds = (links ?? []).map((l) => l.contato_id).filter(Boolean);
  const { data: contatos, error: contatosErr } = await supabase
    .from("contatos")
    .select("id,nome")
    .in("id", contatoIds);

  if (contatosErr) {
    return NextResponse.json(
      { message: "Erro ao buscar contatos" },
      { status: 500 }
    );
  }

  const contatoById = new Map<string, { id: string; nome: string }>();
  for (const c of contatos ?? []) {
    contatoById.set(c.id, { id: c.id, nome: c.nome });
  }

  return NextResponse.json({
    ok: true,
    data: {
      cliente,
      enderecos: enderecos ?? [],
      contatos_vinculados: (links ?? []).map((l) => ({
        contato_id: l.contato_id,
        cargo: l.cargo,
        nome: contatoById.get(l.contato_id)?.nome ?? "",
      })),
    },
  });
}

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
  const parsed = UpdateClienteSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { message: "Dados inválidos", details: parsed.error.flatten() },
      { status: 400 }
    );
  }

  const payload = parsed.data;
  const documentoDigits = onlyDigits(payload.documento ?? "");

  if (documentoDigits && !validateDocumento(payload.tipo_cliente, documentoDigits)) {
    return NextResponse.json(
      { message: "Documento inválido para o tipo informado" },
      { status: 400 }
    );
  }

  const updatePayload: {
    tipo_cliente: "pf" | "pj";
    nome: string;
    nome_fantasia: string | null;
    plano_id: string | null;
    documento?: string | null;
  } = {
    tipo_cliente: toDbTipoCliente(payload.tipo_cliente),
    nome: payload.nome,
    nome_fantasia: payload.nome_fantasia ?? null,
    plano_id: payload.plano_id ?? null,
  };

  if (documentoDigits) {
    updatePayload.documento = documentoDigits;
  }

  const { error: updateErr } = await supabase
    .from("clientes")
    .update(updatePayload)
    .eq("id", params.id);

  if (updateErr) {
    return NextResponse.json(
      { message: "Erro ao atualizar cliente", details: String(updateErr.message ?? updateErr) },
      { status: 500 }
    );
  }

  // Endereços: recria para simplificar MVP
  const { error: delEndErr } = await supabase
    .from("enderecos")
    .delete()
    .eq("cliente_id", params.id);
  if (delEndErr) {
    return NextResponse.json(
      { message: "Erro ao remover endereços" },
      { status: 500 }
    );
  }

  for (const e of payload.enderecos ?? []) {
    const latitude = toNullableNumber(e.latitude);
    const longitude = toNullableNumber(e.longitude);

    const { error: insErr } = await supabase.from("enderecos").insert({
      cliente_id: params.id,
      tipo_endereco: toNullableString(e.tipo_endereco),
      logradouro: toNullableString(e.logradouro),
      numero: toNullableString(e.numero),
      complemento: toNullableString(e.complemento),
      bairro: toNullableString(e.bairro),
      cidade: toNullableString(e.cidade),
      estado: toNullableString(e.estado),
      cep: toNullableString(e.cep),
      latitude,
      longitude,
    });
    if (insErr) {
      return NextResponse.json(
        { message: "Erro ao inserir endereço" },
        { status: 500 }
      );
    }
  }

  // Contatos vinculados: recria
  const { error: delLinksErr } = await supabase
    .from("cliente_contato")
    .delete()
    .eq("cliente_id", params.id);
  if (delLinksErr) {
    return NextResponse.json(
      { message: "Erro ao remover vínculos de contatos" },
      { status: 500 }
    );
  }

  for (const link of payload.contatos_vinculados ?? []) {
    const { error: insLinkErr } = await supabase
      .from("cliente_contato")
      .insert({
        cliente_id: params.id,
        contato_id: link.contato_id,
        cargo: link.cargo,
      });
    if (insLinkErr) {
      return NextResponse.json(
        { message: "Erro ao inserir vínculo de contato" },
        { status: 500 }
      );
    }
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

  const { error: delLinksErr } = await supabase
    .from("cliente_contato")
    .delete()
    .eq("cliente_id", params.id);

  if (delLinksErr) {
    return NextResponse.json(
      { message: "Erro ao remover vínculos" },
      { status: 500 }
    );
  }

  const { error: delEndErr } = await supabase
    .from("enderecos")
    .delete()
    .eq("cliente_id", params.id);

  if (delEndErr) {
    return NextResponse.json(
      { message: "Erro ao remover endereços" },
      { status: 500 }
    );
  }

  const { error: delClienteErr } = await supabase
    .from("clientes")
    .delete()
    .eq("id", params.id);

  if (delClienteErr) {
    return NextResponse.json(
      { message: "Erro ao excluir cliente" },
      { status: 500 }
    );
  }

  return NextResponse.json({ ok: true });
}

