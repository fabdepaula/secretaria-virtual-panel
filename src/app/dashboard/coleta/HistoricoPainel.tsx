"use client";

import { useEffect, useState } from "react";

export type ColetaHistorico = {
  id: string;
  protocolo: string | null;
  status: string;
  clinica: string;
  unidade: string | null;
  endereco_resumo: string | null;
  entregador: string | null;
  encerrada_em: string | null;
  min_ate_aceite: number | null;
  min_ate_retirada: number | null;
  min_ate_entrega: number | null;
  min_total: number | null;
  cancelamento_motivo: string | null;
  cancelamento_operador: string | null;
};

const TZ = "America/Sao_Paulo";
const PAGE = 50;

function diaSaoPaulo(offsetDias: number): string {
  const d = new Date(Date.now() + offsetDias * 24 * 60 * 60 * 1000);
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: TZ,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(d);
}

function formatQuando(iso: string | null): string {
  if (!iso) return "—";
  try {
    return new Intl.DateTimeFormat("pt-BR", {
      timeZone: TZ,
      day: "2-digit",
      month: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
    }).format(new Date(iso));
  } catch {
    return "—";
  }
}

function minutos(valor: number | null): string {
  if (valor == null) return "—";
  return `${valor} min`;
}

export default function HistoricoPainel({
  selecionadaId,
  onSelect,
}: {
  selecionadaId: string | null;
  onSelect: (item: ColetaHistorico) => void;
}) {
  const [de, setDe] = useState(() => diaSaoPaulo(-6));
  const [ate, setAte] = useState(() => diaSaoPaulo(0));
  const [busca, setBusca] = useState("");
  const [q, setQ] = useState("");
  const [offset, setOffset] = useState(0);
  const [total, setTotal] = useState(0);
  const [coletas, setColetas] = useState<ColetaHistorico[]>([]);
  const [loading, setLoading] = useState(true);
  const [erro, setErro] = useState<string | null>(null);

  useEffect(() => {
    const ac = new AbortController();
    setLoading(true);
    setErro(null);
    const params = new URLSearchParams({
      de,
      ate,
      limit: String(PAGE),
      offset: String(offset),
    });
    if (q) params.set("q", q);

    fetch(`/api/coleta/historico?${params.toString()}`, {
      signal: ac.signal,
      cache: "no-store",
    })
      .then(async (res) => {
        const json = (await res.json()) as {
          ok?: boolean;
          message?: string;
          data?: { coletas: ColetaHistorico[]; total: number };
        };
        if (!res.ok || !json.ok) {
          throw new Error(json.message || "Falha ao carregar histórico");
        }
        setColetas(json.data?.coletas ?? []);
        setTotal(json.data?.total ?? 0);
      })
      .catch((e: unknown) => {
        if (e instanceof DOMException && e.name === "AbortError") return;
        setErro(e instanceof Error ? e.message : "Erro ao carregar histórico");
      })
      .finally(() => setLoading(false));

    return () => ac.abort();
  }, [ate, de, offset, q]);

  function aplicarBusca() {
    setOffset(0);
    setQ(busca.trim());
  }

  const pagina = Math.floor(offset / PAGE) + 1;
  const paginas = Math.max(1, Math.ceil(total / PAGE));

  return (
    <div className="flex-1 min-h-0 flex flex-col">
      <form
        className="shrink-0 px-3 py-2 border-b border-[#E3EEFF] flex flex-wrap gap-2 items-end"
        onSubmit={(e) => {
          e.preventDefault();
          aplicarBusca();
        }}
      >
        <label className="text-[11px] text-[#0B3D63]/70">
          De
          <input
            type="date"
            value={de}
            onChange={(e) => {
              setOffset(0);
              setDe(e.target.value);
            }}
            className="block mt-0.5 h-8 rounded-lg border border-[#D7E7FF] px-2 text-xs text-[#0B3D63]"
          />
        </label>
        <label className="text-[11px] text-[#0B3D63]/70">
          Até
          <input
            type="date"
            value={ate}
            onChange={(e) => {
              setOffset(0);
              setAte(e.target.value);
            }}
            className="block mt-0.5 h-8 rounded-lg border border-[#D7E7FF] px-2 text-xs text-[#0B3D63]"
          />
        </label>
        <label className="text-[11px] text-[#0B3D63]/70 flex-1 min-w-[8rem]">
          Protocolo ou clínica
          <input
            value={busca}
            onChange={(e) => setBusca(e.target.value)}
            className="block mt-0.5 w-full h-8 rounded-lg border border-[#D7E7FF] px-2 text-xs text-[#0B3D63]"
          />
        </label>
        <button
          type="submit"
          className="h-8 px-3 rounded-lg bg-[#0B64C0] text-white text-xs font-semibold"
        >
          Buscar
        </button>
      </form>

      <div className="flex-1 min-h-0 overflow-auto">
        {loading ? (
          <div className="p-4 text-sm text-[#0B3D63]/60">Carregando histórico…</div>
        ) : erro ? (
          <div className="p-4 text-sm text-red-700">{erro}</div>
        ) : coletas.length === 0 ? (
          <div className="p-4 text-sm text-[#0B3D63]/70">
            Nenhuma coleta encerrada neste período.
          </div>
        ) : (
          <table className="w-full text-left text-xs">
            <thead className="sticky top-0 bg-[#F8FBFF] text-[#0B3D63]/70">
              <tr>
                <th className="px-3 py-2 font-semibold">Protocolo</th>
                <th className="px-3 py-2 font-semibold">Encerrada</th>
                <th className="px-3 py-2 font-semibold">Clínica</th>
                <th className="px-3 py-2 font-semibold">Entregador</th>
                <th className="px-3 py-2 font-semibold">Status</th>
                <th className="px-3 py-2 font-semibold">Aceite</th>
                <th className="px-3 py-2 font-semibold">Retirada</th>
                <th className="px-3 py-2 font-semibold">Entrega</th>
                <th className="px-3 py-2 font-semibold">Total</th>
              </tr>
            </thead>
            <tbody>
              {coletas.map((c) => (
                <tr
                  key={c.id}
                  onClick={() => onSelect(c)}
                  className={`border-t border-[#E8F1FF] cursor-pointer hover:bg-[#F3F7FF] ${
                    selecionadaId === c.id ? "bg-[#E8F1FF]" : ""
                  } ${c.status === "cancelada" ? "bg-red-50/60" : ""}`}
                >
                  <td className="px-3 py-2 font-mono text-[11px]">
                    {c.protocolo ?? "—"}
                  </td>
                  <td className="px-3 py-2 whitespace-nowrap">
                    {formatQuando(c.encerrada_em)}
                  </td>
                  <td className="px-3 py-2">
                    <div className="font-medium text-[#0B3D63]">{c.clinica}</div>
                    {c.unidade ? (
                      <div className="text-[11px] text-[#0B3D63]/65">{c.unidade}</div>
                    ) : null}
                    {c.status === "cancelada" && c.cancelamento_motivo ? (
                      <div className="text-[11px] text-red-800">
                        {c.cancelamento_motivo}
                      </div>
                    ) : null}
                  </td>
                  <td className="px-3 py-2">{c.entregador ?? "—"}</td>
                  <td className="px-3 py-2 capitalize">{c.status}</td>
                  <td className="px-3 py-2 whitespace-nowrap">{minutos(c.min_ate_aceite)}</td>
                  <td className="px-3 py-2 whitespace-nowrap">{minutos(c.min_ate_retirada)}</td>
                  <td className="px-3 py-2 whitespace-nowrap">{minutos(c.min_ate_entrega)}</td>
                  <td className="px-3 py-2 whitespace-nowrap">{minutos(c.min_total)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {total > PAGE ? (
        <div className="shrink-0 px-3 py-2 border-t border-[#E3EEFF] flex items-center justify-between text-xs text-[#0B3D63]/70">
          <span>
            {offset + 1}–{Math.min(offset + PAGE, total)} de {total}
          </span>
          <div className="flex gap-2">
            <button
              type="button"
              disabled={offset === 0}
              onClick={() => setOffset((n) => Math.max(0, n - PAGE))}
              className="font-semibold text-[#0B64C0] disabled:opacity-40"
            >
              Anterior
            </button>
            <span>
              {pagina}/{paginas}
            </span>
            <button
              type="button"
              disabled={offset + PAGE >= total}
              onClick={() => setOffset((n) => n + PAGE)}
              className="font-semibold text-[#0B64C0] disabled:opacity-40"
            >
              Próxima
            </button>
          </div>
        </div>
      ) : null}
    </div>
  );
}
