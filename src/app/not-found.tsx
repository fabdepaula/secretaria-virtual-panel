import Link from "next/link";

export default function NotFound() {
  return (
    <div className="min-h-screen bg-[#EEF5FF] flex items-center justify-center p-6">
      <div className="max-w-md w-full rounded-2xl border border-[#D7E7FF] bg-white shadow-md p-6 text-center">
        <p className="text-4xl font-bold text-[#0B3D63]/30">404</p>
        <h1 className="mt-2 text-lg font-semibold text-[#0B3D63]">
          Página não encontrada
        </h1>
        <p className="mt-2 text-sm text-[#0B3D63]/70">
          O endereço não existe ou foi movido.
        </p>
        <Link
          href="/"
          className="mt-6 inline-flex h-11 items-center justify-center rounded-xl bg-[#0B64C0] px-6 text-white font-semibold hover:bg-[#0958a7]"
        >
          Ir para o login
        </Link>
      </div>
    </div>
  );
}
