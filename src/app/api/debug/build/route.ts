import { NextResponse } from "next/server";
import { getPanelBuildInfo } from "@/lib/panel-build-info";

/**
 * Diagnóstico: confirma qual build está rodando.
 * Preferência: use também GET /api/panel-version ou a página /versao
 */
export const dynamic = "force-dynamic";

export async function GET() {
  return NextResponse.json(getPanelBuildInfo());
}
