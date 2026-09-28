/* eslint-disable react/jsx-no-bind */
"use client";

import dynamic from "next/dynamic";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type {
  ColetaFila,
  EntregadorMapa,
  OperacaoResumo,
  PontoMapa,
} from "@/lib/coleta-types";
import {
  BotoesAcao,
  DialogoAcao,
  HistoricoColeta,
  type AcaoOperador,
} from "@/app/dashboard/coleta/AcoesOperador";
import HistoricoPainel, {
  type ColetaHistorico,
} from "@/app/dashboard/coleta/HistoricoPainel";

const MapaColeta = dynamic(() => import("./MapaColeta"), {
  ssr: false,
  loading: () => (
    <div className="h-full w-full flex items-center justify-center bg-[#E8F1FF] rounded-xl text-sm text-[#0B3D63]/70">
      Carregando mapa…
    </div>
  ),
});

const POLL_MS = 25_000;
const TZ = "America/Sao_Paulo";

const EMPTY_RESUMO: OperacaoResumo = {
  coletas_abertas: 0,
  exigem_operador: 0,
  sla_estourado: 0,
  solicitadas: 0,
  atribuidas: 0,
  em_curso: 0,
  entregadores_disponiveis: 0,
  entregadores_ocupados: 0,
  entregadores_offline: 0,
  entregadores_posicao_incerta: 0,
};

function formatHora(iso: string | null | undefined): string {
  if (!iso) return "—";
  try {
    return new Intl.DateTimeFormat("pt-BR", {
      timeZone: TZ,
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
    }).format(new Date(iso));
  } catch {
    return "—";
  }
}

function statusLabel(status: string): string {
  return status.replace(/_/g, " ");
}

export default function ColetaPage() {
  const [entregadores, setEntregadores] = useState<EntregadorMapa[]>([]);
  const [pontos, setPontos] = useState<PontoMapa[]>([]);
  const [coletas, setColetas] = useState<ColetaFila[]>([]);
  const [resumo, setResumo] = useState<OperacaoResumo>(EMPTY_RESUMO);
  const [geradoEm, setGeradoEm] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [forbidden, setForbidden] = useState(false);
  const [staleWarning, setStaleWarning] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [soAtencao, setSoAtencao] = useState(false);
  const [aba, setAba] = useState<"fila" | "historico">("fila");
  const [detalheHist, setDetalheHist] = useState<ColetaHistorico | null>(null);
  const [fitOnce, setFitOnce] = useState(true);
  const [focus, setFocus] = useState<{
    lat: number;
    lng: number;
    zoom?: number;
  } | null>(null);
  const [podeAtualizar, setPodeAtualizar] = useState(false);
  const [selecionadaId, setSelecionadaId] = useState<string | null>(null);
  const [dialogo, setDialogo] = useState<{
    acao: AcaoOperador;
    coleta: ColetaFila;
  } | null>(null);
  const [avisoAcao, setAvisoAcao] = useState<string | null>(null);
  const [historicoTick, setHistoricoTick] = useState(0);

  const abortRef = useRef<AbortController | null>(null);
  const hasDataRef = useRef(false);
  const lastOkAtRef = useRef<string | null>(null);

  const load = useCallback(async () => {
    abortRef.current?.abort();
    const ac = new AbortController();
    abortRef.current = ac;

    try {
      const [mapaRes, filaRes] = await Promise.all([
        fetch("/api/coleta/mapa", { signal: ac.signal, cache: "no-store" }),
        fetch("/api/coleta/fila", { signal: ac.signal, cache: "no-store" }),
      ]);

      if (mapaRes.status === 403 || filaRes.status === 403) {
        setForbidden(true);
        setLoading(false);
        return;
      }

      if (!mapaRes.ok || !filaRes.ok) {
        const msg = !mapaRes.ok
          ? ((await mapaRes.json().catch(() => null)) as { message?: string } | null)
              ?.message
          : ((await filaRes.json().catch(() => null)) as { message?: string } | null)
              ?.message;
        throw new Error(msg || "Falha ao atualizar operação");
      }

      const mapaJson = (await mapaRes.json()) as {
        ok: boolean;
        data: {
          entregadores: EntregadorMapa[];
          pontos: PontoMapa[];
          gerado_em: string;
        };
      };
      const filaJson = (await filaRes.json()) as {
        ok: boolean;
        data: {
          coletas: ColetaFila[];
          resumo: OperacaoResumo;
          gerado_em: string;
          pode_atualizar?: boolean;
        };
      };

      const stamp = filaJson.data.gerado_em ?? mapaJson.data.gerado_em;
      setEntregadores(mapaJson.data.entregadores ?? []);
      setPontos(mapaJson.data.pontos ?? []);
      setColetas(filaJson.data.coletas ?? []);
      setPodeAtualizar(filaJson.data.pode_atualizar === true);
      setResumo(filaJson.data.resumo ?? EMPTY_RESUMO);
      setGeradoEm(stamp);
      lastOkAtRef.current = stamp;
      setStaleWarning(null);
      setError(null);
      setForbidden(false);
      hasDataRef.current = true;
    } catch (e) {
      if (e instanceof DOMException && e.name === "AbortError") return;
      const msg = e instanceof Error ? e.message : "Erro de rede";
      if (hasDataRef.current) {
        setStaleWarning(
          `Sem atualizar desde ${formatHora(lastOkAtRef.current ?? new Date().toISOString())}`
        );
      } else {
        setError(msg);
      }
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();

    const id = window.setInterval(() => {
      if (document.visibilityState === "visible") void load();
    }, POLL_MS);

    function onVisibility() {
      if (document.visibilityState === "visible") void load();
    }
    document.addEventListener("visibilitychange", onVisibility);

    return () => {
      window.clearInterval(id);
      document.removeEventListener("visibilitychange", onVisibility);
      abortRef.current?.abort();
    };
  }, [load]);

  const filaVisivel = useMemo(() => {
    if (!soAtencao) return coletas;
    return coletas.filter((c) => c.exige_operador || c.sla_estourado);
  }, [coletas, soAtencao]);

  const semPosicao = useMemo(
    () =>
      entregadores.filter(
        (e) => e.ativo && (e.latitude == null || e.longitude == null)
      ),
    [entregadores]
  );

  const selecionada = useMemo(
    () => coletas.find((c) => c.id === selecionadaId) ?? null,
    [coletas, selecionadaId]
  );

  function onSelectColeta(c: ColetaFila) {
    setDetalheHist(null);
    setSelecionadaId(c.id);
    const lat = c.coleta_latitude ?? c.entregador_latitude;
    const lng = c.coleta_longitude ?? c.entregador_longitude;
    if (lat == null || lng == null) return;
    setFocus({ lat, lng, zoom: 16 });
  }

  function onSelectHistorico(item: ColetaHistorico) {
    setDetalheHist(item);
    setSelecionadaId(item.id);
  }

  function onAcaoConcluida(mensagem: string) {
    setDialogo(null);
    setAvisoAcao(mensagem);
    setHistoricoTick((n) => n + 1);
    void load();
  }

  function refit() {
    setFitOnce(true);
  }

  if (forbidden) {
    return (
      <div className="rounded-2xl border border-[#D7E7FF] bg-white p-6 text-sm text-[#0B3D63]/80">
        Seu perfil não tem permissão para visualizar a operação da coleta
        (`coleta.read`). Peça ao administrador para ajustar o papel.
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-3 h-[calc(100dvh-9.5rem)] md:h-[calc(100dvh-8.5rem)] min-h-[28rem]">
      <div className="shrink-0 rounded-2xl border border-[#D7E7FF] bg-white px-4 py-3 flex flex-wrap items-center gap-3 justify-between">
        <div className="flex flex-wrap gap-2 text-xs md:text-sm">
          <Chip label="Abertas" value={resumo.coletas_abertas} />
          <Chip
            label="Exigem operador"
            value={resumo.exigem_operador}
            tone="danger"
          />
          <Chip label="SLA estourado" value={resumo.sla_estourado} tone="warn" />
          <Chip label="Em curso" value={resumo.em_curso} />
          <Chip
            label="Entregadores"
            value={`${resumo.entregadores_disponiveis} disp. / ${resumo.entregadores_ocupados} ocup. / ${resumo.entregadores_offline} off`}
          />
        </div>
        <div className="flex items-center gap-2 text-xs text-[#0B3D63]/70">
          {staleWarning ? (
            <span className="text-amber-700 font-medium">{staleWarning}</span>
          ) : (
            <span>
              Atualizado às {formatHora(geradoEm)}
              {loading ? " · atualizando…" : ""}
            </span>
          )}
          <button
            type="button"
            onClick={() => void load()}
            className="rounded-lg border border-[#B7D4F5] px-2 py-1 font-semibold text-[#0B64C0] hover:bg-[#F3F7FF]"
          >
            Atualizar
          </button>
          <button
            type="button"
            onClick={refit}
            className="rounded-lg border border-[#B7D4F5] px-2 py-1 font-semibold text-[#0B64C0] hover:bg-[#F3F7FF]"
          >
            Enquadrar mapa
          </button>
        </div>
      </div>

      {error && !hasDataRef.current ? (
        <div className="rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800">
          {error}
        </div>
      ) : null}
      {avisoAcao ? (
        <div className="rounded-xl border border-[#B7D4F5] bg-white px-3 py-2 text-sm text-[#0B3D63] flex items-start justify-between gap-3">
          <span>{avisoAcao}</span>
          <button
            type="button"
            className="text-xs font-semibold text-[#0B64C0]"
            onClick={() => setAvisoAcao(null)}
          >
            Fechar
          </button>
        </div>
      ) : null}

      <div className="flex-1 min-h-0 grid grid-cols-1 lg:grid-cols-[minmax(0,1.4fr)_minmax(20rem,1fr)] gap-3">
        <div className="min-h-[320px] lg:min-h-0 rounded-2xl border border-[#D7E7FF] bg-white p-2 flex flex-col gap-2">
          <div className="flex-1 min-h-[300px] relative">
            {loading && !hasDataRef.current ? (
              <div className="absolute inset-0 flex items-center justify-center text-sm text-[#0B3D63]/60">
                Carregando…
              </div>
            ) : (
              <MapaColeta
                entregadores={entregadores}
                pontos={pontos}
                coletas={coletas}
                focus={focus}
                fitOnce={fitOnce}
                onFitted={() => setFitOnce(false)}
              />
            )}
          </div>
          {semPosicao.length > 0 ? (
            <div className="px-2 pb-1 text-xs text-[#0B3D63]/65">
              Sem posição no mapa:{" "}
              {semPosicao.map((e) => e.nome).join(", ")}
            </div>
          ) : null}
          <div className="px-2 pb-1 flex flex-wrap gap-3 text-[11px] text-[#0B3D63]/70">
            <span className="inline-flex items-center gap-1">
              <img
                src="/coleta/moto-disponivel.png"
                alt=""
                className="h-5 w-5 object-contain"
              />
              Disponível
            </span>
            <span className="inline-flex items-center gap-1">
              <img
                src="/coleta/moto-ocupado.png"
                alt=""
                className="h-5 w-5 object-contain"
              />
              Ocupado
            </span>
            <span className="inline-flex items-center gap-1">
              <img
                src="/coleta/moto-offline.png"
                alt=""
                className="h-5 w-5 object-contain"
              />
              Offline
            </span>
            <span>
              <span className="inline-block w-2.5 h-2.5 rounded-full bg-[#0B64C0] mr-1" />
              Clínica
            </span>
            <span>
              <span className="inline-block w-2.5 h-2.5 rounded-full bg-[#023366] mr-1" />
              Laboratório
            </span>
          </div>
        </div>

        <div className="min-h-0 rounded-2xl border border-[#D7E7FF] bg-white flex flex-col overflow-hidden">
          <div className="shrink-0 px-3 py-2 border-b border-[#E3EEFF] flex items-center justify-between gap-2">
            <div className="flex gap-1">
              <button
                type="button"
                onClick={() => setAba("fila")}
                className={`rounded-lg px-3 py-1 text-sm font-bold ${
                  aba === "fila" ? "bg-[#023366] text-white" : "text-[#0B3D63]"
                }`}
              >
                Fila
              </button>
              <button
                type="button"
                onClick={() => setAba("historico")}
                className={`rounded-lg px-3 py-1 text-sm font-bold ${
                  aba === "historico" ? "bg-[#023366] text-white" : "text-[#0B3D63]"
                }`}
              >
                Histórico
              </button>
            </div>
            {aba === "fila" ? (
              <label className="flex items-center gap-1.5 text-xs text-[#0B3D63]/80 cursor-pointer">
                <input
                  type="checkbox"
                  checked={soAtencao}
                  onChange={(e) => setSoAtencao(e.target.checked)}
                  className="rounded border-[#B7D4F5]"
                />
                Só o que exige atenção
              </label>
            ) : null}
          </div>

          {selecionadaId && (selecionada || detalheHist?.id === selecionadaId) ? (
            <div className="shrink-0 border-b border-[#E3EEFF] px-3 py-2 space-y-2 bg-[#F8FBFF]">
              <div className="flex items-start justify-between gap-2">
                <div>
                  {(() => {
                    const hist =
                      detalheHist && detalheHist.id === selecionadaId
                        ? detalheHist
                        : null;
                    const protocolo =
                      hist?.protocolo ?? selecionada?.protocolo ?? "Sem protocolo";
                    const status = hist?.status ?? selecionada?.status ?? "";
                    const clinica = hist?.clinica ?? selecionada?.clinica ?? "";
                    const unidade = hist?.unidade ?? selecionada?.unidade ?? null;
                    return (
                      <>
                        <div className="text-sm font-bold text-[#0B3D63]">
                          {protocolo} · {statusLabel(status)}
                        </div>
                        <div className="text-xs text-[#0B3D63]/70">
                          {clinica}
                          {unidade ? ` — ${unidade}` : ""}
                        </div>
                        {hist?.status === "cancelada" && hist.cancelamento_motivo ? (
                          <div className="text-xs text-red-800 mt-1">
                            Cancelada
                            {hist.cancelamento_operador
                              ? ` por ${hist.cancelamento_operador}`
                              : ""}
                            : {hist.cancelamento_motivo}
                          </div>
                        ) : null}
                      </>
                    );
                  })()}
                </div>
                <button
                  type="button"
                  className="text-xs font-semibold text-[#0B64C0]"
                  onClick={() => {
                    setSelecionadaId(null);
                    setDetalheHist(null);
                  }}
                >
                  Fechar
                </button>
              </div>
              {podeAtualizar && selecionada && detalheHist?.id !== selecionada.id ? (
                <BotoesAcao
                  coleta={selecionada}
                  onEscolher={(acao, coleta) => setDialogo({ acao, coleta })}
                />
              ) : null}
              <HistoricoColeta coletaId={selecionadaId} reloadKey={historicoTick} />
            </div>
          ) : null}

          {aba === "historico" ? (
            <HistoricoPainel
              selecionadaId={selecionadaId}
              onSelect={onSelectHistorico}
            />
          ) : null}
          {aba === "fila" ? (

          <div className="flex-1 min-h-0 overflow-auto">
            {loading && !hasDataRef.current ? (
              <div className="p-4 space-y-2">
                {[1, 2, 3, 4].map((i) => (
                  <div
                    key={i}
                    className="h-12 rounded-lg bg-[#E8F1FF] animate-pulse"
                  />
                ))}
              </div>
            ) : filaVisivel.length === 0 ? (
              <div className="p-4 text-sm text-[#0B3D63]/70">
                Nenhuma coleta em aberto
                {soAtencao ? " que exija atenção" : ""}.
              </div>
            ) : (
              <table className="w-full text-left text-xs md:text-sm">
                <thead className="sticky top-0 bg-[#F8FBFF] text-[#0B3D63]/70">
                  <tr>
                    <th className="px-3 py-2 font-semibold">Protocolo</th>
                    <th className="px-3 py-2 font-semibold">Status</th>
                    <th className="px-3 py-2 font-semibold">Clínica</th>
                    <th className="px-3 py-2 font-semibold">Entregador</th>
                    <th className="px-3 py-2 font-semibold">Parado há</th>
                    {podeAtualizar ? (
                      <th className="px-3 py-2 font-semibold">Ações</th>
                    ) : null}
                  </tr>
                </thead>
                <tbody>
                  {filaVisivel.map((c) => {
                    const rowClass = c.exige_operador
                      ? "bg-red-50 hover:bg-red-100/80"
                      : c.sla_estourado
                        ? "bg-amber-50 hover:bg-amber-100/70"
                        : "hover:bg-[#F3F7FF]";
                    return (
                      <tr
                        key={c.id}
                        className={`border-t border-[#E8F1FF] cursor-pointer ${rowClass} ${
                          selecionadaId === c.id ? "outline outline-2 outline-[#0B64C0]" : ""
                        }`}
                        onClick={() => onSelectColeta(c)}
                      >
                        <td className="px-3 py-2 font-mono text-[11px] md:text-xs">
                          {c.protocolo ?? "—"}
                          {c.urgencia === "urgente" ? (
                            <span className="ml-1 inline-block rounded bg-rose-600 text-white text-[10px] px-1 font-bold">
                              URG
                            </span>
                          ) : null}
                        </td>
                        <td className="px-3 py-2 capitalize">
                          {statusLabel(c.status)}
                          {c.sla_estourado ? (
                            <span className="block text-[10px] font-semibold text-amber-700">
                              SLA
                            </span>
                          ) : null}
                          {c.exige_operador ? (
                            <span className="block text-[10px] font-semibold text-red-700">
                              Operador
                            </span>
                          ) : null}
                        </td>
                        <td className="px-3 py-2">
                          <div className="font-medium text-[#0B3D63]">
                            {c.clinica}
                          </div>
                          {c.unidade ? (
                            <div className="text-[11px] text-[#0B3D63]/65">
                              {c.unidade}
                            </div>
                          ) : null}
                        </td>
                        <td className="px-3 py-2">{c.entregador ?? "—"}</td>
                        <td className="px-3 py-2 whitespace-nowrap">
                          {c.minutos_no_status} min
                        </td>
                        {podeAtualizar ? (
                          <td className="px-3 py-2">
                            <BotoesAcao
                              coleta={c}
                              curto
                              onEscolher={(acao, coleta) => setDialogo({ acao, coleta })}
                            />
                          </td>
                        ) : null}
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            )}
          </div>
          ) : null}
        </div>
      </div>
      {dialogo ? (
        <DialogoAcao
          acao={dialogo.acao}
          coleta={dialogo.coleta}
          onFechar={() => setDialogo(null)}
          onConcluido={onAcaoConcluida}
        />
      ) : null}
    </div>
  );
}

function Chip({
  label,
  value,
  tone,
}: {
  label: string;
  value: string | number;
  tone?: "danger" | "warn";
}) {
  const toneClass =
    tone === "danger"
      ? "border-red-200 bg-red-50 text-red-800"
      : tone === "warn"
        ? "border-amber-200 bg-amber-50 text-amber-900"
        : "border-[#D7E7FF] bg-[#F8FBFF] text-[#0B3D63]";
  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-xl border px-2.5 py-1 ${toneClass}`}
    >
      <span className="opacity-70">{label}</span>
      <span className="font-bold">{value}</span>
    </span>
  );
}
