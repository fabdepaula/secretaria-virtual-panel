import { NextResponse } from "next/server";
import { z } from "zod";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { validateDocumento, onlyDigits } from "@/lib/documento";
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

const CreateClienteSchema = z.object({
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

export async function GET() {
  const supabase = createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ message: "Não autorizado" }, { status: 401 });
  }

  const { data: clientes, error } = await supabase
    .from("clientes")
    .select(
      "id,tipo_cliente,nome,nome_fantasia,documento,plano_id,created_at,updated_at"
    )
    .order("created_at", { ascending: false });

  if (error) {
    return NextResponse.json(
      { message: "Erro ao listar clientes" },
      { status: 500 }
    );
  }

  return NextResponse.json({ ok: true, data: clientes ?? [] });
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
  const parsed = CreateClienteSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { message: "Dados inválidos", details: parsed.error.flatten() },
      { status: 400 }
    );
  }

  const payload = parsed.data;
  const documentoDigits = onlyDigits(payload.documento ?? "");

  // Regra: valida CPF vs CNPJ conforme tipo_cliente
  if (documentoDigits && !validateDocumento(payload.tipo_cliente, documentoDigits)) {
    return NextResponse.json(
      { message: "Documento inválido para o tipo informado" },
      { status: 400 }
    );
  }

  const { data: cliente, error: clienteErr } = await supabase
    .from("clientes")
    .insert({
      tipo_cliente: toDbTipoCliente(payload.tipo_cliente),
      nome: payload.nome,
      nome_fantasia: payload.nome_fantasia ?? null,
      documento: documentoDigits || null,
      plano_id: payload.plano_id ?? null,
    })
    .select("id")
    .single();

  if (clienteErr || !cliente) {
    return NextResponse.json(
      { message: "Erro ao criar cliente" },
      { status: 500 }
    );
  }

  const clienteId = cliente.id as string;

  // Endereços
  const enderecos = payload.enderecos ?? [];
  for (const e of enderecos) {
    const latitude =
      e.latitude === null || e.latitude === undefined
        ? null
        : typeof e.latitude === "number"
          ? e.latitude
          : Number(e.latitude);
    const longitude =
      e.longitude === null || e.longitude === undefined
        ? null
        : typeof e.longitude === "number"
          ? e.longitude
          : Number(e.longitude);

    const { error: endErr } = await supabase.from("enderecos").insert({
      cliente_id: clienteId,
      tipo_endereco: e.tipo_endereco || null,
      logradouro: e.logradouro || null,
      numero: e.numero || null,
      complemento: e.complemento || null,
      bairro: e.bairro || null,
      cidade: e.cidade || null,
      estado: e.estado || null,
      cep: e.cep || null,
      latitude: Number.isFinite(latitude as number) ? latitude : null,
      longitude: Number.isFinite(longitude as number) ? longitude : null,
    });

    if (endErr) {
      return NextResponse.json(
        { message: "Erro ao criar endereços" },
        { status: 500 }
      );
    }
  }

  // Contatos vinculados (cargo)
  const links = payload.contatos_vinculados ?? [];
  for (const link of links) {
    const { error: linkErr } = await supabase.from("cliente_contato").insert({
      cliente_id: clienteId,
      contato_id: link.contato_id,
      cargo: link.cargo,
    });

    if (linkErr) {
      return NextResponse.json(
        { message: "Erro ao vincular contatos" },
        { status: 500 }
      );
    }
  }

  return NextResponse.json({ ok: true, data: { id: clienteId } });
}

