"use client";

/**
 * Erros no root layout caem aqui (precisa de html/body próprios).
 */
export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <html lang="pt-BR">
      <body className="min-h-screen bg-[#EEF5FF] antialiased flex items-center justify-center p-6">
        <div className="max-w-md w-full rounded-2xl border border-[#D7E7FF] bg-white shadow-md p-6 text-center">
          <h1 className="text-lg font-semibold text-[#0B3D63]">
            Erro ao carregar o painel
          </h1>
          <p className="mt-2 text-sm text-[#0B3D63]/70">
            {error.message || "Falha inesperada."}
          </p>
          <button
            type="button"
            onClick={() => reset()}
            className="mt-6 h-11 w-full rounded-xl bg-[#0B64C0] text-white font-semibold hover:bg-[#0958a7]"
          >
            Tentar de novo
          </button>
        </div>
      </body>
    </html>
  );
}
