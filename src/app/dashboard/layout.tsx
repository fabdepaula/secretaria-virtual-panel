import { redirect } from "next/navigation";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { formatCpf } from "@/lib/cpf";
import DashboardPageTitle from "@/app/dashboard/_components/DashboardPageTitle";
import DashboardAside from "@/app/dashboard/_components/DashboardAside";
import { getPanelLogoUrl } from "@/lib/branding";

/** Evita HTML do shell do painel ficar servido de cache (CDN / edge) com markup antigo. */
export const dynamic = "force-dynamic";

export default async function DashboardLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const supabase = createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/");
  }

  const logoUrl = await getPanelLogoUrl();

  let roleNome = "Administrador";
  let usuarioNome = user.email ?? "Usuário";
  let usuarioSub = "Usuário do painel";
  try {
    const { data: panelUser } = await supabaseAdmin
      .from("panel_users")
      .select("cpf, role_id, nome_completo, login")
      .eq("auth_user_id", user.id)
      .maybeSingle();

    if (panelUser?.role_id) {
      const { data: role } = await supabaseAdmin
        .from("panel_roles")
        .select("nome")
        .eq("id", panelUser.role_id)
        .maybeSingle();
      if (role?.nome) roleNome = role.nome;
    }

    if (panelUser?.nome_completo?.trim()) {
      usuarioNome = panelUser.nome_completo.trim();
    } else if (panelUser?.login) {
      usuarioNome = panelUser.login;
    } else if (panelUser?.cpf) {
      usuarioNome = formatCpf(panelUser.cpf);
    }
    usuarioSub = roleNome;
  } catch {
    // Não bloqueia o layout se falhar.
  }

  return (
    <div className="h-dvh overflow-hidden bg-[#F3F7FF] flex flex-col md:flex-row">
      <DashboardAside
        logoUrl={logoUrl}
        usuarioNome={usuarioNome}
        usuarioSub={usuarioSub}
      />

      <main className="flex-1 min-w-0 min-h-0 flex flex-col overflow-hidden">
        {/* Topo fixo: marca (mobile) + título da página */}
        <header className="shrink-0 bg-[#023366] border-b border-[#0A427C] z-10">
          <div className="w-full px-6 md:px-10 py-6 md:py-7 flex items-center gap-4 min-h-[5.5rem] md:min-h-[6rem]">
            <div className="flex items-center gap-3 md:hidden shrink-0">
              <div className="h-14 w-14 rounded-xl bg-white border border-white/20 flex items-center justify-center overflow-hidden">
                <img
                  src={logoUrl}
                  alt=""
                  className="h-14 w-14 object-contain"
                />
              </div>
              <div className="leading-tight">
                <div className="text-sm font-semibold text-white">Secretaria IA</div>
                <div className="text-xs text-white/75">Painel</div>
              </div>
            </div>
            <DashboardPageTitle />
          </div>
        </header>

        {/* Só esta área rola */}
        <div className="flex-1 min-h-0 overflow-y-auto overflow-x-hidden">
          <div className="max-w-7xl mx-auto px-4 md:px-6 py-4 md:py-5">
            {children}
          </div>
        </div>
      </main>
    </div>
  );
}

