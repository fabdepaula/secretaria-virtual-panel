import { NextResponse } from "next/server";
import { z } from "zod";
import { ensureColetaPermission } from "@/lib/coleta-auth";
import { supabaseAdmin } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";

const BodySchema = z.object({
  acao: z.enum(["reatribuir", "devolver_fila", "definir_unidade", "cancelar"]),
  coleta_id: z.string().uuid(),
  entregador_id: z.string().uuid().optional(),
  endereco_id: z.string().uuid().optional(),
  motivo: z.string().trim().min(3).max(300).optional(),
});

const DEFAULT_URL = "https://n8n.fpsoftware.cloud/webhook/operador-acao";
const TIMEOUT_MS = 15_000;

type AcaoData = {
  ok: boolean;
  resultado?: string;
  mensagem?: string;
};

function unwrap(raw: unknown): unknown {
  if (Array.isArray(raw)) return raw[0];
  return raw;
}

function parseAcaoData(raw: unknown): AcaoData | null {
  const value = unwrap(raw);
  if (!value || typeof value !== "object") return null;
  const obj = value as Record<string, unknown>;
  const inner =
    obj.data && typeof obj.data === "object"
      ? (obj.data as Record<string, unknown>)
      : obj;
  if (typeof inner.ok !== "boolean" && typeof inner.mensagem !== "string") {
    return null;
  }
  return {
    ok: inner.ok === true,
    resultado: typeof inner.resultado === "string" ? inner.resultado : undefined,
    mensagem: typeof inner.mensagem === "string" ? inner.mensagem : undefined,
  };
}

export async function POST(req: Request) {
  const authz = await ensureColetaPermission("coleta.update");
  if (!authz.ok) return authz.response;

  const json = await req.json().catch(() => null);
  const parsed = BodySchema.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json(
      { ok: false, message: "Requisição inválida" },
      { status: 400 }
    );
  }

  const body = parsed.data;
  if (body.acao === "reatribuir" && !body.entregador_id) {
    return NextResponse.json(
      { ok: false, message: "Selecione o entregador" },
      { status: 400 }
    );
  }
  if (body.acao === "definir_unidade" && !body.endereco_id) {
    return NextResponse.json(
      { ok: false, message: "Selecione a unidade" },
      { status: 400 }
    );
  }
  if (body.acao === "cancelar" && !body.motivo) {
    return NextResponse.json(
      { ok: false, message: "Informe o motivo do cancelamento" },
      { status: 400 }
    );
  }

  const { data: panelUser, error: panelErr } = await supabaseAdmin
    .from("panel_users")
    .select("login")
    .eq("auth_user_id", authz.user.id)
    .maybeSingle();

  const operador = panelUser?.login?.trim();
  if (panelErr || !operador) {
    return NextResponse.json(
      { ok: false, message: "Não foi possível identificar o operador da sessão" },
      { status: 500 }
    );
  }

  const url = process.env.N8N_OPERADOR_ACAO_URL || DEFAULT_URL;
  const token = process.env.N8N_OPERADOR_ACAO_TOKEN?.trim();
  if (!token) {
    return NextResponse.json(
      {
        ok: false,
        message:
          "Ação do operador indisponível: falta N8N_OPERADOR_ACAO_TOKEN no servidor",
      },
      { status: 503 }
    );
  }

  const headerName = process.env.N8N_OPERADOR_ACAO_HEADER?.trim() || "Authorization";
  const payload: Record<string, string> = {
    acao: body.acao,
    coleta_id: body.coleta_id,
    operador,
  };
  if (body.entregador_id) payload.entregador_id = body.entregador_id;
  if (body.endereco_id) payload.endereco_id = body.endereco_id;
  if (body.motivo) payload.motivo = body.motivo;

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), TIMEOUT_MS);

  try {
    const res = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        [headerName]: token,
      },
      body: JSON.stringify(payload),
      signal: controller.signal,
      cache: "no-store",
    });

    const raw = await res.json().catch(() => null);
    const data = parseAcaoData(raw);

    if (data) {
      return NextResponse.json({ ok: true, data });
    }

    return NextResponse.json(
      {
        ok: false,
        message: `O serviço de ações respondeu de forma inesperada (${res.status})`,
      },
      { status: 502 }
    );
  } catch (err) {
    const aborted = err instanceof Error && err.name === "AbortError";
    if (aborted) {
      return NextResponse.json(
        {
          ok: false,
          message:
            "A ação pode ter sido aplicada. Atualize a fila antes de tentar de novo.",
        },
        { status: 504 }
      );
    }
    const msg = err instanceof Error ? err.message : "Falha ao chamar o serviço de ações";
    return NextResponse.json({ ok: false, message: msg }, { status: 502 });
  } finally {
    clearTimeout(timeout);
  }
}
