import { NextResponse } from "next/server";
import { z } from "zod";
import { ensureColetaPermission } from "@/lib/coleta-auth";

export const dynamic = "force-dynamic";

const QuerySchema = z.object({
  de: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  ate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  q: z.string().trim().max(80).optional(),
  limit: z.coerce.number().int().min(1).max(100).optional(),
  offset: z.coerce.number().int().min(0).optional(),
});

function diaSaoPaulo(offsetDias: number): string {
  const d = new Date(Date.now() + offsetDias * 24 * 60 * 60 * 1000);
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Sao_Paulo",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(d);
}

function inicioDia(dia: string): string {
  return `${dia}T00:00:00-03:00`;
}

function fimDia(dia: string): string {
  return `${dia}T23:59:59.999-03:00`;
}

function escapeIlike(raw: string): string {
  return raw.replace(/[%_\\,()]/g, "");
}

export async function GET(req: Request) {
  const authz = await ensureColetaPermission("coleta.read");
  if (!authz.ok) return authz.response;

  const { searchParams } = new URL(req.url);
  const parsed = QuerySchema.safeParse({
    de: searchParams.get("de") ?? undefined,
    ate: searchParams.get("ate") ?? undefined,
    q: searchParams.get("q") ?? undefined,
    limit: searchParams.get("limit") ?? undefined,
    offset: searchParams.get("offset") ?? undefined,
  });
  if (!parsed.success) {
    return NextResponse.json(
      { ok: false, message: "Filtro inválido" },
      { status: 400 }
    );
  }

  const de = parsed.data.de ?? diaSaoPaulo(-6);
  const ate = parsed.data.ate ?? diaSaoPaulo(0);
  const limit = parsed.data.limit ?? 50;
  const offset = parsed.data.offset ?? 0;
  const q = escapeIlike(parsed.data.q ?? "");

  let query = authz.supabase
    .from("operacao_historico_coletas")
    .select("*", { count: "exact" })
    .gte("encerrada_em", inicioDia(de))
    .lte("encerrada_em", fimDia(ate))
    .order("encerrada_em", { ascending: false })
    .range(offset, offset + limit - 1);

  if (q) {
    query = query.or(`protocolo.ilike.%${q}%,clinica.ilike.%${q}%`);
  }

  const { data, error, count } = await query;
  if (error) {
    return NextResponse.json(
      {
        ok: false,
        message: "Erro ao carregar histórico de coletas",
        details: String(error.message ?? error),
      },
      { status: 500 }
    );
  }

  return NextResponse.json({
    ok: true,
    data: {
      coletas: data ?? [],
      total: count ?? 0,
      de,
      ate,
    },
  });
}
