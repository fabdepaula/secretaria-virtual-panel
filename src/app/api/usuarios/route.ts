import { NextResponse } from "next/server";
import { z } from "zod";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { emailInternoFromLogin, isValidLogin, normalizeLogin } from "@/lib/panel-login";

const CreateUsuarioSchema = z.object({
  nome_completo: z.string().min(1, "Nome completo é obrigatório"),
  /** Contato opcional; vazio ou omitido grava `null` em `panel_users.email`. */
  email: z
    .union([z.literal(""), z.string().email("E-mail inválido")])
    .optional()
    .default(""),
  login: z.string().min(1, "Usuário (login) é obrigatório"),
  password: z.string().min(6, "Senha deve ter ao menos 6 caracteres"),
  role_id: z.string().uuid("role_id inválido"),
  ativo: z.boolean().optional().default(true),
});

async function ensurePermission(permissionKey: string) {
  const supabase = createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return { ok: false as const, response: NextResponse.json({ message: "Não autorizado" }, { status: 401 }) };
  }

  const { data: allowed, error } = await supabase.rpc("has_panel_permission", {
    permission_key: permissionKey,
  });

  if (error || !allowed) {
    return {
      ok: false as const,
      response: NextResponse.json({ message: "Sem permissão" }, { status: 403 }),
    };
  }

  return { ok: true as const, supabase, userId: user.id };
}

export async function GET() {
  const authz = await ensurePermission("usuarios.read");
  if (!authz.ok) return authz.response;

  const { data, error } = await authz.supabase
    .from("panel_users")
    .select(
      "id,auth_user_id,nome_completo,email,login,cpf,email_interno,role_id,ativo,created_at,updated_at,panel_roles(nome)"
    )
    .order("created_at", { ascending: false });

  if (error) {
    return NextResponse.json(
      { message: "Erro ao listar usuários", details: String(error.message ?? error) },
      { status: 500 }
    );
  }

  const users = (data ?? []).map((u) => {
    const roleName =
      Array.isArray(u.panel_roles) && u.panel_roles.length > 0
        ? u.panel_roles[0]?.nome
        : (u.panel_roles as { nome?: string } | null)?.nome;

    return {
      id: u.id,
      auth_user_id: u.auth_user_id,
      nome_completo: u.nome_completo ?? "",
      email: u.email ?? null,
      login: u.login ?? "",
      cpf: u.cpf ?? null,
      email_interno: u.email_interno,
      role_id: u.role_id,
      role_nome: roleName ?? "",
      ativo: u.ativo,
      created_at: u.created_at,
      updated_at: u.updated_at,
    };
  });

  return NextResponse.json({ ok: true, data: users });
}

export async function POST(req: Request) {
  const authz = await ensurePermission("usuarios.create");
  if (!authz.ok) return authz.response;

  const body = await req.json().catch(() => null);
  const parsed = CreateUsuarioSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { message: "Dados inválidos", details: parsed.error.flatten() },
      { status: 400 }
    );
  }

  const payload = parsed.data;
  const loginNorm = normalizeLogin(payload.login);
  const emailNorm = payload.email.trim().toLowerCase();
  const emailContato = emailNorm === "" ? null : emailNorm;

  if (!isValidLogin(loginNorm)) {
    return NextResponse.json(
      {
        message:
          "Usuário (login) inválido: use 3 a 50 caracteres (letras, números, . _ -)",
      },
      { status: 400 }
    );
  }

  const { data: existsLogin, error: loginErr } = await authz.supabase
    .from("panel_users")
    .select("id")
    .eq("login", loginNorm)
    .maybeSingle();

  if (loginErr) {
    return NextResponse.json(
      { message: "Erro ao validar login" },
      { status: 500 }
    );
  }
  if (existsLogin) {
    return NextResponse.json({ message: "Este usuário (login) já está em uso" }, { status: 409 });
  }

  if (emailContato) {
    const { data: existsEmail, error: emailErr } = await authz.supabase
      .from("panel_users")
      .select("id")
      .eq("email", emailContato)
      .maybeSingle();

    if (emailErr) {
      return NextResponse.json(
        { message: "Erro ao validar e-mail" },
        { status: 500 }
      );
    }
    if (existsEmail) {
      return NextResponse.json(
        { message: "Este e-mail já está cadastrado" },
        { status: 409 }
      );
    }
  }

  const emailInterno = emailInternoFromLogin(loginNorm);

  const { data: createdAuth, error: authErr } =
    await supabaseAdmin.auth.admin.createUser({
      email: emailInterno,
      password: payload.password,
      email_confirm: true,
      user_metadata: {
        login: loginNorm,
        nome_completo: payload.nome_completo.trim(),
      },
    });

  if (authErr || !createdAuth.user) {
    return NextResponse.json(
      {
        message: "Erro ao criar usuário no Auth",
        details: String(authErr?.message ?? authErr),
      },
      { status: 500 }
    );
  }

  const { data: panelUser, error: panelErr } = await authz.supabase
    .from("panel_users")
    .insert({
      auth_user_id: createdAuth.user.id,
      nome_completo: payload.nome_completo.trim(),
      email: emailContato,
      login: loginNorm,
      email_interno: emailInterno,
      role_id: payload.role_id,
      ativo: payload.ativo,
    })
    .select("id")
    .single();

  if (panelErr || !panelUser) {
    return NextResponse.json(
      {
        message: "Usuário Auth criado, mas falhou no painel",
        details: String(panelErr?.message ?? panelErr),
      },
      { status: 500 }
    );
  }

  return NextResponse.json({ ok: true, id: panelUser.id });
}
