"use client";

import { useEffect } from "react";

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("[app/error]", error);
  }, [error]);

  return (
    <div className="min-h-[40vh] flex flex-col items-center justify-center gap-4 px-6 py-12 text-center bg-[#F3F7FF]">
      <h2 className="text-lg font-semibold text-[#0B3D63]">
        Algo deu errado nesta página
      </h2>
      <p className="text-sm text-[#0B3D63]/70 max-w-md">
        {error.message || "Erro inesperado. Tente novamente ou atualize o navegador."}
      </p>
      <button
        type="button"
        onClick={() => reset()}
        className="h-11 px-6 rounded-xl bg-[#0B64C0] text-white font-semibold hover:bg-[#0958a7]"
      >
        Tentar de novo
      </button>
    </div>
  );
}
