"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  ClipboardList,
  CreditCard,
  LayoutDashboard,
  Phone,
  UserCog,
  UserRound,
  Users,
  type LucideIcon,
} from "lucide-react";
import LogoutButton from "@/app/dashboard/_components/LogoutButton";

const NAV_ITEMS: { href: string; label: string; Icon: LucideIcon }[] = [
  { href: "/dashboard", label: "Visão geral", Icon: LayoutDashboard },
  { href: "/dashboard/contatos", label: "Contatos", Icon: Phone },
  { href: "/dashboard/clientes", label: "Clientes", Icon: Users },
  { href: "/dashboard/servicos", label: "Serviços", Icon: ClipboardList },
  { href: "/dashboard/planos", label: "Planos", Icon: CreditCard },
  { href: "/dashboard/usuarios", label: "Usuários", Icon: UserCog },
];

export default function DashboardAside({
  logoUrl,
  usuarioNome,
  usuarioSub,
}: {
  logoUrl: string;
  usuarioNome: string;
  usuarioSub: string;
}) {
  const pathname = usePathname();

  function isActive(href: string) {
    if (href === "/dashboard") return pathname === "/dashboard";
    return pathname === href || pathname?.startsWith(`${href}/`);
  }

  return (
    <aside className="w-[15.5rem] hidden md:flex flex-col h-dvh shrink-0 overflow-hidden border-r border-[#0A427C] bg-[#023366]">
      <div className="p-5">
        <div className="flex flex-col items-center gap-3 text-center">
          <div className="h-[120px] w-[120px] rounded-2xl bg-white border border-white/20 flex items-center justify-center overflow-hidden shrink-0">
            <img
              src={logoUrl}
              alt="Logo do laboratório"
              className="h-[110px] w-[110px] object-contain"
            />
          </div>
          <div className="leading-tight px-1">
            <div className="text-lg sm:text-xl font-bold text-white tracking-tight">
              Painel do laboratório
            </div>
          </div>
        </div>
      </div>

      <div className="mx-4 h-px shrink-0 bg-[#5B9BD5]/50" aria-hidden />

      <nav className="flex-1 min-h-0 overflow-hidden px-3 py-2 flex flex-col justify-start">
        <div className="flex flex-col gap-1 shrink-0">
          {NAV_ITEMS.map(({ href, label, Icon }) => {
            const active = isActive(href);
            return (
              <Link
                key={href}
                href={href}
                className={[
                  "flex items-center gap-3 px-3 py-2 rounded-xl text-base font-bold transition-colors",
                  active
                    ? "bg-white/15 text-white"
                    : "text-[#CDDEF3] hover:bg-white/10",
                ].join(" ")}
              >
                <span
                  className={[
                    "w-5 h-5 flex items-center justify-center shrink-0",
                    active ? "text-white" : "text-[#CDDEF3]",
                  ].join(" ")}
                >
                  <Icon size={18} />
                </span>
                <span className="truncate">{label}</span>
              </Link>
            );
          })}
        </div>
      </nav>

      <div className="mx-4 h-px shrink-0 bg-[#5B9BD5]/50" aria-hidden />

      <div className="mt-auto px-4 pb-5 pt-2">
        <div className="rounded-2xl border border-white/10 bg-white/10 p-3 flex items-center gap-3">
          <div className="h-10 w-10 rounded-full bg-[#14508C] flex items-center justify-center">
            <UserRound size={18} color="white" />
          </div>
          <div className="min-w-0">
            <div className="text-sm font-semibold text-white truncate">
              {usuarioNome}
            </div>
            <div className="text-xs text-white/70">{usuarioSub}</div>
          </div>
        </div>

        <div className="mt-3">
          <LogoutButton variant="link" className="w-full justify-start" />
        </div>
      </div>
    </aside>
  );
}
