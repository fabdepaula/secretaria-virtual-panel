"use client";

import Link from "next/link";
import { useDashboardNavVisibility } from "@/app/dashboard/_components/DashboardNavProvider";
import type { DashboardNavModule } from "@/lib/dashboard-nav-visibility";

const CARDS: Array<{
  title: string;
  description: string;
  href: string;
  module: DashboardNavModule;
}> = [
  {
    title: "Contatos",
    description: "Gerencie nomes e telefones dos contatos.",
    href: "/dashboard/contatos",
    module: "contatos",
  },
  {
    title: "Clientes",
    description: "Cadastre tutores e clínicas (PF/PJ).",
    href: "/dashboard/clientes",
    module: "clientes",
  },
  {
    title: "Serviços",
    description: "Cadastre os serviços oferecidos.",
    href: "/dashboard/servicos",
    module: "servicos",
  },
  {
    title: "Planos",
    description: "Defina valores e prazos por plano.",
    href: "/dashboard/planos",
    module: "planos",
  },
];

export default function DashboardHomeContent() {
  const visibility = useDashboardNavVisibility();
  const cards = CARDS.filter((c) => visibility[c.module]);

  return (
    <div className="flex flex-col gap-4">
      <div>
        <p className="text-sm text-[#0B3D63]/70">
          Comece pelos cadastros essenciais do laboratório.
        </p>
      </div>

      {cards.length === 0 ? (
        <div className="rounded-2xl border border-[#D7E7FF] bg-white p-4 text-sm text-[#0B3D63]/80">
          Seu perfil não tem permissão para nenhum módulo do painel. Peça ao
          administrador para ajustar as permissões do seu papel (role).
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {cards.map((card) => (
            <div
              key={card.href}
              className="rounded-2xl border border-[#D7E7FF] bg-white p-4"
            >
              <div className="flex items-center justify-between gap-3">
                <div>
                  <div className="text-base font-bold text-[#0B3D63]">
                    {card.title}
                  </div>
                  <div className="text-sm text-[#0B3D63]/70 mt-1">
                    {card.description}
                  </div>
                </div>
                <Link
                  href={card.href}
                  className="shrink-0 rounded-xl bg-[#0B64C0] text-white px-3 py-2 text-sm font-semibold hover:bg-[#0958a7]"
                >
                  Abrir
                </Link>
              </div>
            </div>
          ))}
        </div>
      )}

      <div className="rounded-2xl border border-[#D7E7FF] bg-white p-4">
        <div className="text-sm font-semibold text-[#0B3D63]">
          Próximos passos
        </div>
        <div className="mt-2 text-sm text-[#0B3D63]/70 leading-relaxed">
          Em seguida, vamos criar os formulários e as tabelas de controle do
          painel no Supabase para aplicar o login (usuário + senha) e o RBAC por
          módulo/ação.
        </div>
      </div>
    </div>
  );
}
