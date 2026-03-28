import { NextResponse } from "next/server";
import { z } from "zod";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { onlyDigits } from "@/lib/cpf";
import { emailInternoFromLogin, isValidLogin, normalizeLogin } from "@/lib/panel-login";

const UpdateUsuarioSchema = z.object({
  nome_completo: z.string().min(1).optional(),
  /** Opcional; string vazia remove o e-mail de contato (`null`). */
  email: z.union([z.literal(""), z.string().email()]).optional(),
  login: z.string().min(1).optional(),
  cpf: z.string().optional().nullable(),
  role_id: z.string().uuid().optional(),
  ativo: z.boolean().optional(),
  password: z.string().min(6).optional(),
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

  return { ok: true as const, supabase };
}

export async function PATCH(
  req: Request,
  { params }: { params: { id: string } }
) {
  const authz = await ensurePermission("usuarios.update");
  if (!authz.ok) return authz.response;

  const body = await req.json().catch(() => null);
  const parsed = UpdateUsuarioSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { message: "Dados inválidos", details: parsed.error.flatten() },
      { status: 400 }
    );
  }

  const payload = parsed.data;

  const { data: currentUser, error: currentErr } = await authz.supabase
    .from("panel_users")
    .select("id,auth_user_id,login,email,email_interno")
    .eq("id", params.id)
    .maybeSingle();

  if (currentErr || !currentUser) {
    return NextResponse.json({ message: "Usuário não encontrado" }, { status: 404 });
  }

  if (payload.email !== undefined) {
    const emailNorm = payload.email.trim().toLowerCase();
    if (emailNorm !== "" && emailNorm !== (currentUser.email ?? "").toLowerCase()) {
      const { data: dup } = await authz.supabase
        .from("panel_users")
        .select("id")
        .eq("email", emailNorm)
        .neq("id", params.id)
        .maybeSingle();
      if (dup) {
        return NextResponse.json({ message: "Este e-mail já está em uso" }, { status: 409 });
      }
    }
  }

  /** Quando o login muda, o e-mail no Auth deve ser o sintético `{login}@painel.local`. */
  let authEmailInternoToSync: string | undefined;

  if (payload.login !== undefined) {
    const loginNorm = normalizeLogin(payload.login);
    if (!isValidLogin(loginNorm)) {
      return NextResponse.json(
        {
          message:
            "Usuário (login) inválido: use 3 a 50 caracteres (letras, números, . _ -)",
        },
        { status: 400 }
      );
    }
    if (loginNorm !== (currentUser.login ?? "")) {
      const { data: dupLogin } = await authz.supabase
        .from("panel_users")
        .select("id")
        .eq("login", loginNorm)
        .neq("id", params.id)
        .maybeSingle();
      if (dupLogin) {
        return NextResponse.json(
          { message: "Este usuário (login) já está em uso" },
          { status: 409 }
        );
      }
    }
    const nextInterno = emailInternoFromLogin(loginNorm);
    if (nextInterno !== (currentUser.email_interno ?? "")) {
      authEmailInternoToSync = nextInterno;
    }
  }

  const patch: Record<string, unknown> = {};

  if (payload.nome_completo !== undefined) {
    patch.nome_completo = payload.nome_completo.trim();
  }
  if (payload.email !== undefined) {
    const t = payload.email.trim().toLowerCase();
    patch.email = t === "" ? null : t;
  }
  if (payload.login !== undefined) {
    const loginNorm = normalizeLogin(payload.login);
    patch.login = loginNorm;
    patch.email_interno = emailInternoFromLogin(loginNorm);
  }
  if (payload.cpf !== undefined) {
    if (payload.cpf === null || String(payload.cpf).trim() === "") {
      patch.cpf = null;
    } else {
      const cpfDigits = onlyDigits(String(payload.cpf));
      if (cpfDigits.length !== 11) {
        return NextResponse.json({ message: "CPF inválido" }, { status: 400 });
      }
      patch.cpf = cpfDigits;
    }
  }
  if (payload.role_id !== undefined) patch.role_id = payload.role_id;
  if (payload.ativo !== undefined) patch.ativo = payload.ativo;

  if (Object.keys(patch).length > 0) {
    const { error: updErr } = await authz.supabase
      .from("panel_users")
      .update(patch)
      .eq("id", params.id);

    if (updErr) {
      return NextResponse.json(
        {
          message: "Erro ao atualizar usuário",
          details: String(updErr.message ?? updErr),
        },
        { status: 500 }
      );
    }
  }

  const authUserId = currentUser.auth_user_id as string | null;
  if (authUserId && authEmailInternoToSync) {
    const { error: emailAuthErr } = await supabaseAdmin.auth.admin.updateUserById(
      authUserId,
      { email: authEmailInternoToSync }
    );
    if (emailAuthErr) {
      return NextResponse.json(
        {
          message:
            "Dados salvos no painel, mas falhou ao sincronizar e-mail interno no Auth",
          details: String(emailAuthErr.message ?? emailAuthErr),
        },
        { status: 500 }
      );
    }
  }

  if (payload.password && authUserId) {
    const { error: pwdErr } = await supabaseAdmin.auth.admin.updateUserById(
      authUserId,
      { password: payload.password }
    );

    if (pwdErr) {
      return NextResponse.json(
        {
          message: "Usuário atualizado, mas falhou ao alterar senha",
          details: String(pwdErr.message ?? pwdErr),
        },
        { status: 500 }
      );
    }
  }

  return NextResponse.json({ ok: true });
}
