import { NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export async function POST() {
  const supabase = createSupabaseServerClient();
  await supabase.auth.getSession();
  await supabase.auth.signOut();

  return NextResponse.json({ ok: true });
}

