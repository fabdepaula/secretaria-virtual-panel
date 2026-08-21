import { NextResponse } from "next/server";
import { z } from "zod";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { triggerEmbeddingWorkflow } from "@/lib/n8n";

export async function GET() {
  const supabase = createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ message: "Não autorizado" }, { status: 401 });
  }

  const { data: servicos, error } = await supabase
    .from("Services")
    .select(
      "id,nome,tipo,valor,ativo,agendamento,cod_interno,urgencia"
    )
    .order("nome", { ascending: true });

  if (error) {
    return NextResponse.json(
      { message: "Erro ao listar serviços", details: String(error.message ?? error) },
      { status: 500 }
    );
  }

  return NextResponse.json({ ok: true, data: servicos ?? [] });
}

const IntSchema = z.preprocess((v) => {
  if (typeof v === "string") return Number(v);
  if (typeof v === "number") return v;
  return v;
}, z.number().int());

const NumericSchema = z.preprocess((v) => {
  if (v === "" || v === null || v === undefined) return null;
  if (typeof v === "string") return Number(v);
  if (typeof v === "number") return v;
  return v;
}, z.number().nullable());

const FloatSchema = z.preprocess((v) => {
  if (v === "" || v === null || v === undefined) return null;
  if (typeof v === "string") return Number(v);
  if (typeof v === "number") return v;
  return v;
}, z.number().nullable());

const ServicoUpsertSchema = z
  .object({
    tipo: z.string().min(1, "Tipo é obrigatório"),
    nome: z.string().min(1, "Nome é obrigatório"),
    preparo: z.string().min(1, "Preparo é obrigatório"),
    embedding_text: z.string().min(1, "embedding_text é obrigatório"),
    valor: FloatSchema.optional().nullable(),
    ativo: z.boolean(),
    agendamento: z.boolean(),
    agenda_id: z.string().optional().nullable(),
    prazo_entrega: z.string().optional().nullable(),
    duracao_minutos: IntSchema.optional().nullable(),
    dado_necessario: z.string().optional().nullable(),
    restricao: z.string().optional().nullable(),
    cod_interno: NumericSchema.optional().nullable(),
    urgencia: z.boolean(),
    prazo_entrega_urgencia: z.string().optional().nullable(),
    valor_urgencia: FloatSchema.optional().nullable(),
  })
  .refine(
    (d) => {
      if (d.agendamento) return Boolean(String(d.agenda_id ?? "").trim());
      return true;
    },
    {
      message: "agenda_id é obrigatório quando agendamento = sim",
      path: ["agenda_id"],
    }
  )
  .refine(
    (d) => {
      if (!d.agendamento) return true;
      const dm = d.duracao_minutos;
      return typeof dm === "number" && Number.isFinite(dm) && dm > 0;
    },
    {
      message:
        "Duração (min) é obrigatória e deve ser maior que zero quando agendamento = sim",
      path: ["duracao_minutos"],
    }
  )
  .refine(
    (d) => {
      if (!d.agendamento) return true;
      return Boolean(String(d.dado_necessario ?? "").trim());
    },
    {
      message: "Dados necessários é obrigatório quando agendamento = sim",
      path: ["dado_necessario"],
    }
  )
  .refine(
    (d) => {
      if (!d.urgencia) return true;
      return d.valor_urgencia !== null && d.valor_urgencia !== undefined;
    },
    {
      message: "valor_urgencia é obrigatório quando urgencia = sim",
      path: ["valor_urgencia"],
    }
  );

export async function POST(req: Request) {
  const supabase = createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ message: "Não autorizado" }, { status: 401 });
  }

  const body = await req.json().catch(() => null);
  const parsed = ServicoUpsertSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { message: "Dados inválidos", details: parsed.error.flatten() },
      { status: 400 }
    );
  }

  const payload = parsed.data;
  const embeddingText = payload.embedding_text.trim();
  const insertPayload: Record<string, unknown> = {
    tipo: payload.tipo,
    nome: payload.nome.trim(),
    preparo: payload.preparo,
    embedding_text: embeddingText,
    valor: payload.valor ?? null,
    ativo: payload.ativo,
    agendamento: payload.agendamento,
    agenda: payload.agendamento ? payload.agenda_id ?? null : null,
    prazo_entrega: payload.prazo_entrega ?? null,
    duracao_minutos: payload.agendamento ? payload.duracao_minutos ?? null : null,
    dado_necessario: payload.agendamento ? payload.dado_necessario ?? null : null,
    restricao: payload.restricao ?? null,
    cod_interno: payload.cod_interno ?? null,
    urgencia: payload.urgencia,
    prazo_entrega_urgencia: payload.urgencia
      ? payload.prazo_entrega_urgencia ?? null
      : null,
    valor_urgencia: payload.urgencia ? payload.valor_urgencia ?? null : null,
  };

  const { data: inserted, error } = await supabase
    .from("Services")
    .insert(insertPayload)
    .select("id")
    .single();

  if (error) {
    return NextResponse.json(
      { message: "Erro ao criar serviço", details: String(error.message ?? error) },
      { status: 500 }
    );
  }

  if (inserted?.id) {
    const workflow = embeddingText
      ? await triggerEmbeddingWorkflow({
          service_id: inserted.id,
          embedding_text: embeddingText,
          event: "created",
          triggered_at: new Date().toISOString(),
        })
      : { ok: false, reason: "embedding_text vazio: workflow não disparado" };
    return NextResponse.json({ ok: true, id: inserted.id, workflow });
  }

  return NextResponse.json({ ok: true, id: null });
}
