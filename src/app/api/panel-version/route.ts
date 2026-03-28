import { NextResponse } from "next/server";
import { getPanelBuildInfo } from "@/lib/panel-build-info";

export const dynamic = "force-dynamic";

export async function GET() {
  return NextResponse.json(getPanelBuildInfo());
}
