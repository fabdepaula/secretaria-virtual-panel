"use client";

import { useEffect, useMemo, useState } from "react";
import type { ColetaFila } from "@/lib/coleta-types";

export type AcaoOperador =
  | "devolver_fila"
  | "reatribuir"
  | "definir_unidade"
  | "cancelar";

type EntregadorOpcao = {
  id: string;
  nome: string;
  status: string;
  coletas_ativas: number;
  capacidade_max: number;
  sem_vaga: boolean;
  posicao_incerta: boolean;
};

type UnidadeOpcao = {
  id: string;
  unidade: string | null;
  endereco_resumo: string | null;
  aceita_coleta: boolean | null;
  tem_coordenada: boolean;
};

type EventoColeta = {
  evento_id: string;
  evento: string;
  ator: string | null;
  operador: string | null;
  motivo: string | null;
  entregador: string | null;
  criado_em: string;
};

const PODE_DEVOLVER = new Set([
  "atribuida",
  "aceita",
  "coletando",
  "sem_entregador",
]);
const PODE_REATRIBUIR = new Set([
  "solicitada",
  "atribuida",
  "aceita",
  "coletando",
  "sem_entregador",
]);

const TZ = "America/Sao_Paulo";

export function acoesDaColeta(status: string): AcaoOperador[] {
  const acoes: AcaoOperador[] = [];
  if (PODE_DEVOLVER.has(status)) acoes.push("devolver_fila");
  if (PODE_REATRIBUIR.has(status)) acoes.push("reatribuir");
  if (status === "aguardando_unidade") acoes.push("definir_unidade");
  acoes.push("cancelar");
  return acoes;
}

function rotuloAcao(acao: AcaoOperador, curto = false): string {
  if (acao === "devolver_fila") return curto ? "Fila" : "Devolver à fila";
  if (acao === "reatribuir") return curto ? "Entregador" : "Atribuir / trocar";
  if (acao === "definir_unidade") return curto ? "Unidade" : "Definir unidade";
  return curto ? "Cancelar" : "Cancelar coleta";
}

function statusHumano(status: string): string {
  if (status === "disponivel") return "disponível";
  if (status === "ocupado") return "ocupado";
  if (status === "offline") return "offline";
  return status.replace(/_/g, " ");
}

function formatQuando(iso: string): string {
  try {
    return new Intl.DateTimeFormat("pt-BR", {
      timeZone: TZ,
      day: "2-digit",
      month: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
    }).format(new Date(iso));
  } catch {
    return iso;
  }
}

export function BotoesAcao({
  coleta,
  curto,
  onEscolher,
}: {
  coleta: ColetaFila;
  curto?: boolean;
  onEscolher: (acao: AcaoOperador, coleta: ColetaFila) => void;
}) {
  return (
    <div className="flex flex-wrap gap-1">
      {acoesDaColeta(coleta.status).map((acao) => (
        <button
          key={acao}
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            onEscolher(acao, coleta);
          }}
          className={[
            "rounded-lg px-2 py-1 text-[11px] font-semibold border",
            acao === "cancelar"
              ? "border-red-300 text-red-800 bg-red-50 hover:bg-red-100"
              : "border-[#B7D4F5] text-[#0B64C0] bg-white hover:bg-[#F3F7FF]",
          ].join(" ")}
        >
          {rotuloAcao(acao, curto)}
        </button>
      ))}
    </div>
  );
}

export function DialogoAcao({
  acao,
  coleta,
  onFechar,
  onConcluido,
}: {
  acao: AcaoOperador;
  coleta: ColetaFila;
  onFechar: () => void;
  onConcluido: (mensagem: string, aviso?: boolean) => void;
}) {
  const [motivo, setMotivo] = useState("");
  const [entregadorId, setEntregadorId] = useState("");
  const [enderecoId, setEnderecoId] = useState("");
  const [entregadores, setEntregadores] = useState<EntregadorOpcao[]>([]);
  const [unidades, setUnidades] = useState<UnidadeOpcao[]>([]);
  const [carregandoOpcoes, setCarregandoOpcoes] = useState(false);
  const [enviando, setEnviando] = useState(false);
  const [erroLocal, setErroLocal] = useState<string | null>(null);

  useEffect(() => {
    let ativo = true;
    async function carregar() {
      setCarregandoOpcoes(true);
      try {
        if (acao === "reatribuir") {
          const res = await fetch("/api/coleta/entregadores", { cache: "no-store" });
          const json = (await res.json()) as {
            ok?: boolean;
            message?: string;
            data?: { entregadores: EntregadorOpcao[] };
          };
          if (!res.ok || !json.ok) throw new Error(json.message || "Falha ao listar entregadores");
          if (ativo) setEntregadores(json.data?.entregadores ?? []);
        }
        if (acao === "definir_unidade") {
          const res = await fetch(
            `/api/coleta/unidades?cliente_id=${encodeURIComponent(coleta.clinica_id)}`,
            { cache: "no-store" }
          );
          const json = (await res.json()) as {
            ok?: boolean;
            message?: string;
            data?: { unidades: UnidadeOpcao[] };
          };
          if (!res.ok || !json.ok) throw new Error(json.message || "Falha ao listar unidades");
          if (ativo) setUnidades(json.data?.unidades ?? []);
        }
      } catch (e) {
        if (ativo) setErroLocal(e instanceof Error ? e.message : "Erro ao carregar opções");
      } finally {
        if (ativo) setCarregandoOpcoes(false);
      }
    }
    void carregar();
    return () => {
      ativo = false;
    };
  }, [acao, coleta.clinica_id]);

  const entregador = useMemo(
    () => entregadores.find((e) => e.id === entregadorId) ?? null,
    [entregadores, entregadorId]
  );
  const unidade = useMemo(
    () => unidades.find((u) => u.id === enderecoId) ?? null,
    [unidades, enderecoId]
  );

  const motivoTrim = motivo.trim();
  const motivoInvalido = motivoTrim.length > 0 && motivoTrim.length < 3;
  const podeConfirmar =
    !enviando &&
    !motivoInvalido &&
    (acao !== "cancelar" || motivoTrim.length >= 3) &&
    (acao !== "reatribuir" || Boolean(entregadorId)) &&
    (acao !== "definir_unidade" || Boolean(enderecoId));

  async function confirmar() {
    setErroLocal(null);
    setEnviando(true);
    try {
      const res = await fetch("/api/coleta/acao", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          acao,
          coleta_id: coleta.id,
          entregador_id: acao === "reatribuir" ? entregadorId : undefined,
          endereco_id: acao === "definir_unidade" ? enderecoId : undefined,
          motivo: motivoTrim || undefined,
        }),
      });
      const json = (await res.json().catch(() => null)) as {
        ok?: boolean;
        message?: string;
        data?: { ok?: boolean; mensagem?: string };
      } | null;

      if (res.status === 504) {
        onConcluido(
          json?.message ||
            "A ação pode ter sido aplicada. Atualize a fila antes de tentar de novo.",
          true
        );
        return;
      }

      if (!res.ok || !json?.ok) {
        throw new Error(json?.message || "Não foi possível executar a ação");
      }

      const mensagem =
        json.data?.mensagem ||
        (json.data?.ok
          ? "Ação registrada."
          : "A ação não foi aplicada.");
      onConcluido(mensagem, json.data?.ok === false);
    } catch (e) {
      setErroLocal(e instanceof Error ? e.message : "Erro ao executar a ação");
    } finally {
      setEnviando(false);
    }
  }

  return (
    <div className="fixed inset-0 z-[2000] flex items-center justify-center bg-[#023366]/40 p-4">
      <div className="w-full max-w-md rounded-2xl bg-white border border-[#D7E7FF] shadow-xl p-4">
        <div className="text-base font-bold text-[#0B3D63]">
          {rotuloAcao(acao)} · {coleta.protocolo ?? "sem protocolo"}
        </div>
        <p className="mt-1 text-sm text-[#0B3D63]/75">
          {coleta.clinica}
          {coleta.unidade ? ` — ${coleta.unidade}` : ""}
        </p>

        {acao === "devolver_fila" ? (
          <p className="mt-3 text-sm text-[#0B3D63]">
            A coleta volta para a fila e a roteirização escolhe de novo.
          </p>
        ) : null}

        {acao === "cancelar" ? (
          <p className="mt-3 rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800">
            Esta ação é irreversível. A clínica e o entregador, se houver, serão avisados.
          </p>
        ) : null}

        {acao === "reatribuir" ? (
          <label className="mt-3 block text-sm text-[#0B3D63]">
            Entregador
            <select
              className="mt-1 w-full h-11 rounded-xl border border-[#D7E7FF] bg-white px-3"
              value={entregadorId}
              onChange={(e) => setEntregadorId(e.target.value)}
            >
              <option value="">Selecione</option>
              {entregadores.map((e) => (
                <option key={e.id} value={e.id}>
                  {e.nome} — {statusHumano(e.status)} — {e.coletas_ativas}/{e.capacidade_max}
                  {e.sem_vaga ? " (lotado)" : ""}
                </option>
              ))}
            </select>
            {entregador ? (
              <p className="mt-2 text-xs text-[#0B3D63]/80">
                {entregador.nome}: {statusHumano(entregador.status)}, carga{" "}
                {entregador.coletas_ativas}/{entregador.capacidade_max}
                {entregador.sem_vaga ? ", sem vaga" : ""}
                {entregador.posicao_incerta ? ", posição incerta" : ""}.
              </p>
            ) : null}
          </label>
        ) : null}

        {acao === "definir_unidade" ? (
          <label className="mt-3 block text-sm text-[#0B3D63]">
            Unidade
            <select
              className="mt-1 w-full h-11 rounded-xl border border-[#D7E7FF] bg-white px-3"
              value={enderecoId}
              onChange={(e) => setEnderecoId(e.target.value)}
            >
              <option value="">Selecione</option>
              {unidades.map((u) => (
                <option key={u.id} value={u.id}>
                  {u.unidade || "Unidade"}{u.tem_coordenada ? "" : " (sem coordenada)"}
                </option>
              ))}
            </select>
            {unidade ? (
              <p className="mt-2 text-xs text-[#0B3D63]/80">
                {unidade.unidade || "Unidade"}
                {unidade.endereco_resumo ? ` — ${unidade.endereco_resumo}` : ""}
                {unidade.aceita_coleta === false ? " — não aceita coleta" : ""}
                {unidade.tem_coordenada ? "" : " — sem coordenada no mapa"}
              </p>
            ) : null}
          </label>
        ) : null}

        <label className="mt-3 block text-sm text-[#0B3D63]">
          Motivo {acao === "cancelar" ? "(obrigatório)" : "(opcional)"}
          <textarea
            className="mt-1 w-full min-h-[4.5rem] rounded-xl border border-[#D7E7FF] px-3 py-2"
            maxLength={300}
            value={motivo}
            onChange={(e) => setMotivo(e.target.value)}
          />
        </label>
        {motivoInvalido ? (
          <p className="mt-1 text-xs text-amber-800">O motivo precisa ter ao menos 3 caracteres.</p>
        ) : null}

        {carregandoOpcoes ? (
          <p className="mt-2 text-xs text-[#0B3D63]/60">Carregando opções…</p>
        ) : null}
        {erroLocal ? (
          <p className="mt-2 text-sm text-red-700">{erroLocal}</p>
        ) : null}

        <div className="mt-4 flex justify-end gap-2">
          <button
            type="button"
            onClick={onFechar}
            disabled={enviando}
            className="h-10 px-3 rounded-xl border border-[#D7E7FF] text-sm font-semibold text-[#0B3D63]"
          >
            Voltar
          </button>
          <button
            type="button"
            disabled={!podeConfirmar}
            onClick={() => void confirmar()}
            className={[
              "h-10 px-4 rounded-xl text-sm font-semibold text-white disabled:opacity-50",
              acao === "cancelar" ? "bg-red-700 hover:bg-red-800" : "bg-[#0B64C0] hover:bg-[#0958a7]",
            ].join(" ")}
          >
            {enviando ? "Enviando…" : "Confirmar"}
          </button>
        </div>
      </div>
    </div>
  );
}

export function HistoricoColeta({
  coletaId,
  reloadKey,
}: {
  coletaId: string;
  reloadKey?: number;
}) {
  const [eventos, setEventos] = useState<EventoColeta[] | null>(null);
  const [erro, setErro] = useState<string | null>(null);

  useEffect(() => {
    let ativo = true;
    setEventos(null);
    setErro(null);
    async function carregar() {
      try {
        const res = await fetch(`/api/coleta/${coletaId}/eventos`, { cache: "no-store" });
        const json = (await res.json()) as {
          ok?: boolean;
          message?: string;
          data?: { eventos: EventoColeta[] };
        };
        if (!res.ok || !json.ok) throw new Error(json.message || "Falha no histórico");
        if (ativo) setEventos(json.data?.eventos ?? []);
      } catch (e) {
        if (ativo) setErro(e instanceof Error ? e.message : "Erro no histórico");
      }
    }
    void carregar();
    return () => {
      ativo = false;
    };
  }, [coletaId, reloadKey]);

  if (erro) return <p className="text-xs text-red-700">{erro}</p>;
  if (!eventos) return <p className="text-xs text-[#0B3D63]/60">Carregando histórico…</p>;
  if (eventos.length === 0) return <p className="text-xs text-[#0B3D63]/60">Nenhum evento.</p>;

  return (
    <ol className="space-y-1.5 max-h-48 overflow-auto pr-1">
      {eventos.map((ev) => (
          <li key={ev.evento_id} className="text-[11px] text-[#0B3D63]/85">
            <span className="font-semibold">{ev.evento.replace(/_/g, " ")}</span>
            <span className="text-[#0B3D63]/55">
              {" "}
              · {formatQuando(ev.criado_em)}
              {ev.ator ? ` · ${ev.ator}` : ""}
              {ev.operador ? ` · ${ev.operador}` : ""}
              {ev.entregador ? ` · ${ev.entregador}` : ""}
            </span>
            {ev.motivo ? <span className="block text-[#0B3D63]/70">{ev.motivo}</span> : null}
          </li>
        ))}
    </ol>
  );
}
