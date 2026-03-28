import Link from "next/link";

export default async function DashboardHome() {
  return (
    <div className="flex flex-col gap-4">
      <div>
        <p className="text-sm text-[#0B3D63]/70">
          Comece pelos cadastros essenciais do laboratório.
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <Card
          title="Contatos"
          description="Gerencie nomes e telefones dos contatos."
          href="/dashboard/contatos"
        />
        <Card
          title="Clientes"
          description="Cadastre tutores e clínicas (PF/PJ)."
          href="/dashboard/clientes"
        />
        <Card
          title="Serviços"
          description="Cadastre os serviços oferecidos."
          href="/dashboard/servicos"
        />
        <Card
          title="Planos"
          description="Defina valores e prazos por plano."
          href="/dashboard/planos"
        />
      </div>

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

function Card({
  title,
  description,
  href,
}: {
  title: string;
  description: string;
  href: string;
}) {
  return (
    <div className="rounded-2xl border border-[#D7E7FF] bg-white p-4">
      <div className="flex items-center justify-between gap-3">
        <div>
          <div className="text-base font-bold text-[#0B3D63]">{title}</div>
          <div className="text-sm text-[#0B3D63]/70 mt-1">{description}</div>
        </div>
        <Link
          href={href}
          className="shrink-0 rounded-xl bg-[#0B64C0] text-white px-3 py-2 text-sm font-semibold hover:bg-[#0958a7]"
        >
          Abrir
        </Link>
      </div>
    </div>
  );
}

