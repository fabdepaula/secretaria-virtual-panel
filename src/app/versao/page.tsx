import { getPanelBuildInfo } from "@/lib/panel-build-info";

export const dynamic = "force-dynamic";

/**
 * Página de diagnóstico (não depende de /api).
 * Se abrir http://localhost:PORTA/versao e der 404, o servidor não é um build deste código.
 */
export default function VersaoPage() {
  const info = getPanelBuildInfo();

  return (
    <div className="min-h-screen bg-[#F3F7FF] p-8 font-mono text-sm text-[#0B3D63]">
      <h1 className="text-xl font-bold mb-2">Versão do painel (diagnóstico)</h1>
      <p className="mb-4 text-[#0B3D63]/80 max-w-xl">
        Se esta página abrir, o processo Next está servindo o código atual. Use a mesma
        porta no <code className="bg-white px-1 rounded">/dashboard</code> (veja o número no
        terminal ao rodar <code className="bg-white px-1 rounded">npm run dev</code>).
      </p>
      <pre className="rounded-xl border border-[#D7E7FF] bg-white p-4 overflow-auto text-xs">
        {JSON.stringify(info, null, 2)}
      </pre>
    </div>
  );
}
