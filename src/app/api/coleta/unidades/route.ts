import { NextResponse } from "next/server";
import { z } from "zod";
import { ensureColetaPermission } from "@/lib/coleta-auth";

export const dynamic = "force-dynamic";

const QuerySchema = z.object({
  cliente_id: z.string().uuid(),
});

function resumoEndereco(row: {
  logradouro: string | null;
  numero: string | null;
  bairro: string | null;
  cidade: string | null;
}): string | null {
  const linha = [row.logradouro, row.numero].filter(Boolean).join(" ").trim();
  const texto = [linha, row.bairro, row.cidade].filter((p) => p && p.trim()).join(", ");
  return texto || null;
}

export async function GET(req: Request) {
  const authz = await ensureColetaPermission("coleta.read");
  if (!authz.ok) return authz.response;

  const { searchParams } = new URL(req.url);
  const parsed = QuerySchema.safeParse({
    cliente_id: searchParams.get("cliente_id"),
  });
  if (!parsed.success) {
    return NextResponse.json(
      { ok: false, message: "cliente_id inválido" },
      { status: 400 }
    );
  }

  const clienteId = parsed.data.cliente_id;

  const [pontosRes, enderecosRes] = await Promise.all([
    authz.supabase
      .from("operacao_mapa_pontos")
      .select("id,nome,unidade,cliente_id,endereco_resumo,latitude,longitude,aceita_coleta")
      .eq("tipo", "clinica")
      .eq("cliente_id", clienteId),
    authz.supabase
      .from("enderecos")
      .select(
        "id,tipo_endereco,logradouro,numero,bairro,cidade,latitude,longitude,aceita_coleta"
      )
      .eq("cliente_id", clienteId),
  ]);

  if (pontosRes.error && enderecosRes.error) {
    return NextResponse.json(
      {
        ok: false,
        message: "Erro ao listar unidades",
        details: String(pontosRes.error.message ?? pontosRes.error),
      },
      { status: 500 }
    );
  }

  type Unidade = {
    id: string;
    unidade: string | null;
    endereco_resumo: string | null;
    aceita_coleta: boolean | null;
    tem_coordenada: boolean;
  };

  const byId = new Map<string, Unidade>();

  for (const row of enderecosRes.data ?? []) {
    byId.set(row.id, {
      id: row.id,
      unidade: row.tipo_endereco,
      endereco_resumo: resumoEndereco(row),
      aceita_coleta: row.aceita_coleta,
      tem_coordenada: row.latitude != null && row.longitude != null,
    });
  }

  for (const ponto of pontosRes.data ?? []) {
    const atual = byId.get(ponto.id);
    byId.set(ponto.id, {
      id: ponto.id,
      unidade: ponto.unidade ?? atual?.unidade ?? null,
      endereco_resumo: ponto.endereco_resumo ?? atual?.endereco_resumo ?? null,
      aceita_coleta: ponto.aceita_coleta ?? atual?.aceita_coleta ?? null,
      tem_coordenada:
        (ponto.latitude != null && ponto.longitude != null) ||
        atual?.tem_coordenada === true,
    });
  }

  const unidades = Array.from(byId.values()).sort((a, b) =>
    String(a.unidade ?? "").localeCompare(String(b.unidade ?? ""), "pt-BR")
  );

  return NextResponse.json({ ok: true, data: { unidades } });
}
