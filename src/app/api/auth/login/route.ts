import { NextResponse } from "next/server";
import { z } from "zod";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { normalizeLogin } from "@/lib/panel-login";

const LoginSchema = z.object({
  login: z.string().min(1, "Informe o usuário (login)"),
  password: z.string().min(1, "Informe a senha"),
});

type PanelAuthRow = { email_interno: string; ativo: boolean | null };

async function findPanelUserForSignIn(
  rawInput: string
): Promise<{ row: PanelAuthRow | null; lookupError: Error | null }> {
  const trimmed = rawInput.trim();
  if (!trimmed) {
    return { row: null, lookupError: null };
  }

  const loginKey = normalizeLogin(trimmed);

  const { data: byLogin, error: errLogin } = await supabaseAdmin
    .from("panel_users")
    .select("email_interno, ativo")
    .eq("login", loginKey)
    .maybeSingle();

  if (errLogin) {
    return { row: null, lookupError: errLogin };
  }
  if (byLogin?.email_interno && byLogin.ativo !== false) {
    return { row: byLogin as PanelAuthRow, lookupError: null };
  }

  // Permite entrar digitando o e-mail no campo (mesmo cadastro do usuário)
  if (trimmed.includes("@")) {
    const emailNorm = trimmed.toLowerCase();

    const { data: byEmail, error: errEmail } = await supabaseAdmin
      .from("panel_users")
      .select("email_interno, ativo")
      .eq("email", emailNorm)
      .maybeSingle();

    if (errEmail) {
      return { row: null, lookupError: errEmail };
    }
    if (byEmail?.email_interno && byEmail.ativo !== false) {
      return { row: byEmail as PanelAuthRow, lookupError: null };
    }

    const { data: byInterno, error: errInterno } = await supabaseAdmin
      .from("panel_users")
      .select("email_interno, ativo")
      .eq("email_interno", emailNorm)
      .maybeSingle();

    if (errInterno) {
      return { row: null, lookupError: errInterno };
    }
    if (byInterno?.email_interno && byInterno.ativo !== false) {
      return { row: byInterno as PanelAuthRow, lookupError: null };
    }
  }

  return { row: null, lookupError: null };
}

export async function POST(req: Request) {
  try {
    const body = await req.json().catch(() => null);
    const parsed = LoginSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { ok: false, message: "Requisição inválida" },
        { status: 400 }
      );
    }

    const trimmed = parsed.data.login.trim();
    if (trimmed.length < 3) {
      return NextResponse.json(
        { ok: false, message: "Informe ao menos 3 caracteres (usuário ou e-mail)" },
        { status: 400 }
      );
    }

    const { row: panelUser, lookupError } = await findPanelUserForSignIn(
      parsed.data.login
    );

    if (lookupError) {
      console.error("[auth/login] panel_users lookup", lookupError);
      return NextResponse.json(
        {
          ok: false,
          message:
            "Erro ao consultar usuários. Confira se a migração SQL (colunas login/e-mail) foi aplicada no Supabase.",
          details: String(lookupError.message ?? lookupError),
        },
        { status: 500 }
      );
    }

    if (!panelUser?.email_interno || panelUser.ativo === false) {
      return NextResponse.json(
        { ok: false, message: "Credenciais inválidas" },
        { status: 401 }
      );
    }

    const supabase = createSupabaseServerClient();
    await supabase.auth.getSession();

    const { error: signInError } = await supabase.auth.signInWithPassword({
      email: panelUser.email_interno,
      password: parsed.data.password,
    });

    if (signInError) {
      return NextResponse.json(
        {
          ok: false,
          message: "Credenciais inválidas",
          details: String(signInError.message ?? signInError),
        },
        { status: 401 }
      );
    }

    return NextResponse.json({ ok: true });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Erro interno";
    console.error("[auth/login]", e);
    return NextResponse.json(
      {
        ok: false,
        message:
          "Não foi possível conectar ao servidor de autenticação. Verifique .env.local (Supabase) e tente de novo.",
        details: msg,
      },
      { status: 500 }
    );
  }
}
