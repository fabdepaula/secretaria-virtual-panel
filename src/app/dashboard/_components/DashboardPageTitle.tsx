"use client";

import { usePathname } from "next/navigation";

const TITLES: { prefix: string; title: string }[] = [
  { prefix: "/dashboard/usuarios", title: "Usuários do painel" },
  { prefix: "/dashboard/servicos", title: "Serviços" },
  { prefix: "/dashboard/clientes", title: "Clientes" },
  { prefix: "/dashboard/contatos", title: "Contatos" },
  { prefix: "/dashboard/planos", title: "Planos" },
  { prefix: "/dashboard", title: "Visão geral" },
];

function titleForPath(pathname: string | null): string {
  if (!pathname) return "Painel";
  for (const { prefix, title } of TITLES) {
    if (prefix === "/dashboard") {
      if (pathname === "/dashboard") return title;
      continue;
    }
    if (pathname === prefix || pathname.startsWith(`${prefix}/`)) {
      return title;
    }
  }
  return "Painel";
}

export default function DashboardPageTitle() {
  const pathname = usePathname();
  const title = titleForPath(pathname);

  return (
    <h1 className="text-xl md:text-2xl font-bold text-white tracking-tight truncate">
      {title}
    </h1>
  );
}
