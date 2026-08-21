'use client';

import { useEffect, useMemo, useRef, useState, type FormEvent } from "react";
import TableIconActions from "@/app/dashboard/_components/TableIconActions";

type TriFilter = "todos" | "sim" | "nao";

type ServicoBasic = {
  id: string;
  tipo: string | null;
  nome: string;
  valor: number | null;
  ativo: boolean | null;
  agendamento: boolean | null;
  cod_interno: number | null;
  urgencia: boolean | null;
};

type ServicoForm = {
  id?: string;
  tipo: string;
  nome: string;
  preparo: string;
  embedding_text: string;
  valor: string;
  ativo: boolean;
  agendamento: boolean;
  agenda_id: string;
  prazo_entrega: string;
  duracao_minutos: number;
  dado_necessario: string;
  restricao: string;
  cod_interno: string;
  urgencia: boolean;
  prazo_entrega_urgencia: string;
  valor_urgencia: string;
};

const emptyForm = (): ServicoForm => ({
  tipo: "",
  nome: "",
  preparo: "",
  embedding_text: "",
  valor: "",
  ativo: true,
  agendamento: false,
  agenda_id: "",
  prazo_entrega: "",
  duracao_minutos: 0,
  dado_necessario: "",
  restricao: "",
  cod_interno: "",
  urgencia: false,
  prazo_entrega_urgencia: "",
  valor_urgencia: "",
});

function formatCurrencyInput(raw: string): string {
  const digits = raw.replace(/\D/g, "");
  if (!digits) return "";
  const value = Number(digits) / 100;
  return value.toLocaleString("pt-BR", {
    style: "currency",
    currency: "BRL",
  });
}

function parseCurrencyInput(raw: string): number | null {
  const normalized = raw
    .replace(/[^\d,.-]/g, "")
    .replace(/\./g, "")
    .replace(",", ".");
  if (!normalized.trim()) return null;
  const n = Number(normalized);
  return Number.isFinite(n) ? n : null;
}

function formatCurrencyValue(value: number | null | undefined): string {
  if (value === null || value === undefined) return "—";
  return value.toLocaleString("pt-BR", {
    style: "currency",
    currency: "BRL",
  });
}

function toCurrencyField(value: unknown): string {
  if (value === null || value === undefined || value === "") return "";
  const n = Number(value);
  if (!Number.isFinite(n)) return "";
  return n.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

function matchesTri(value: boolean | null | undefined, filter: TriFilter): boolean {
  if (filter === "todos") return true;
  const isTrue = Boolean(value);
  return filter === "sim" ? isTrue : !isTrue;
}

const inputClass =
  "h-10 w-full rounded-lg border border-blue-100 bg-white px-3 text-sm text-foreground outline-none focus:border-blue-300 focus:ring-2 focus:ring-blue-100 disabled:bg-blue-50/50 disabled:text-blue-900/60";
const textareaClass =
  "w-full rounded-lg border border-blue-100 bg-white px-3 py-2 text-sm text-foreground outline-none focus:border-blue-300 focus:ring-2 focus:ring-blue-100 disabled:bg-blue-50/50 disabled:text-blue-900/60";
const labelClass = "text-xs font-medium text-blue-900/70";
const selectClass =
  "h-10 rounded-lg border border-blue-100 bg-white px-2.5 text-sm text-blue-900 outline-none focus:border-blue-300 focus:ring-2 focus:ring-blue-100";

export default function ServicosPage() {
  const detailRequestId = useRef(0);
  const formRef = useRef<HTMLDivElement>(null);

  const [loadingList, setLoadingList] = useState(false);
  const [loadingDetail, setLoadingDetail] = useState(false);
  const [mutating, setMutating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [servicos, setServicos] = useState<ServicoBasic[]>([]);
  const [form, setForm] = useState<ServicoForm>(emptyForm());
  const [readOnly, setReadOnly] = useState(false);

  const [busca, setBusca] = useState("");
  const [filtroAtivo, setFiltroAtivo] = useState<TriFilter>("todos");
  const [filtroAgendamento, setFiltroAgendamento] = useState<TriFilter>("todos");
  const [filtroUrgencia, setFiltroUrgencia] = useState<TriFilter>("todos");

  const listBusy = loadingList || loadingDetail || mutating;
  const locked = readOnly || loadingDetail || mutating;

  const filtrados = useMemo(() => {
    const q = busca.trim().toLowerCase();
    return servicos.filter((s) => {
      if (!matchesTri(s.ativo, filtroAtivo)) return false;
      if (!matchesTri(s.agendamento, filtroAgendamento)) return false;
      if (!matchesTri(s.urgencia, filtroUrgencia)) return false;
      if (!q) return true;
      const nome = (s.nome ?? "").toLowerCase();
      const codigo = s.cod_interno == null ? "" : String(s.cod_interno);
      return nome.includes(q) || codigo.includes(q);
    });
  }, [servicos, busca, filtroAtivo, filtroAgendamento, filtroUrgencia]);

  useEffect(() => {
    void loadServicos();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function loadServicos() {
    setLoadingList(true);
    setError(null);
    try {
      const res = await fetch("/api/servicos");
      if (!res.ok) throw new Error("Falha ao carregar serviços");
      const json = await res.json();
      setServicos((json.data ?? []) as ServicoBasic[]);
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Erro";
      setError(msg);
    } finally {
      setLoadingList(false);
    }
  }

  async function loadServicoIntoPanel(id: string, options?: { edit?: boolean }) {
    const reqId = ++detailRequestId.current;
    setLoadingDetail(true);
    setError(null);
    try {
      const res = await fetch(`/api/servicos/${id}`);
      if (!res.ok) throw new Error("Falha ao carregar detalhes do serviço");
      const json = await res.json();
      if (reqId !== detailRequestId.current) return;

      const d = json.data ?? {};
      setForm({
        id: d.id,
        tipo: d.tipo ?? "",
        nome: d.nome ?? "",
        preparo: d.preparo ?? "",
        embedding_text: d.embedding_text ?? "",
        valor: toCurrencyField(d.valor),
        ativo: Boolean(d.ativo),
        agendamento: Boolean(d.agendamento),
        agenda_id: d.agenda_id ?? "",
        prazo_entrega: d.prazo_entrega ?? "",
        duracao_minutos: Number(d.duracao_minutos ?? 0),
        dado_necessario: d.dado_necessario ?? "",
        restricao: d.restricao ?? "",
        cod_interno:
          d.cod_interno === null || d.cod_interno === undefined
            ? ""
            : String(d.cod_interno),
        urgencia: Boolean(d.urgencia),
        prazo_entrega_urgencia: d.prazo_entrega_urgencia ?? "",
        valor_urgencia: toCurrencyField(d.valor_urgencia),
      });
      setReadOnly(!options?.edit);
      requestAnimationFrame(() => {
        formRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
      });
    } catch (e) {
      if (reqId !== detailRequestId.current) return;
      const msg = e instanceof Error ? e.message : "Erro";
      setError(msg);
    } finally {
      if (reqId === detailRequestId.current) setLoadingDetail(false);
    }
  }

  function clearPanel() {
    setForm(emptyForm());
    setReadOnly(false);
  }

  function startNew() {
    clearPanel();
    requestAnimationFrame(() => {
      formRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
    });
  }

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setMutating(true);
    setError(null);
    try {
      if (!form.tipo.trim()) throw new Error("Tipo é obrigatório");
      if (!form.nome.trim()) throw new Error("Nome é obrigatório");
      if (!form.preparo.trim()) throw new Error("Preparo é obrigatório");
      if (!form.embedding_text.trim())
        throw new Error("Sinônimos é obrigatório");
      if (form.agendamento) {
        if (!form.agenda_id.trim())
          throw new Error("Agenda é obrigatória quando agendamento está marcado");
        if (!Number.isFinite(form.duracao_minutos) || form.duracao_minutos < 1) {
          throw new Error(
            "Duração (min) é obrigatória e deve ser maior que zero quando agendamento está marcado"
          );
        }
        if (!form.dado_necessario.trim()) {
          throw new Error(
            "Dados necessários é obrigatório quando agendamento está marcado"
          );
        }
      }
      if (form.urgencia && parseCurrencyInput(form.valor_urgencia) === null) {
        throw new Error("Valor de urgência é obrigatório quando urgência está marcada");
      }

      const codRaw = form.cod_interno.trim();
      const cod_interno =
        codRaw === ""
          ? null
          : (() => {
              const n = Number(codRaw);
              if (!Number.isFinite(n)) throw new Error("Código interno inválido");
              return n;
            })();

      const payload = {
        tipo: form.tipo.trim(),
        nome: form.nome.trim(),
        preparo: form.preparo,
        embedding_text: form.embedding_text.trim(),
        valor: parseCurrencyInput(form.valor),
        ativo: form.ativo,
        agendamento: form.agendamento,
        agenda_id: form.agendamento ? form.agenda_id.trim() : null,
        prazo_entrega: form.prazo_entrega.trim() || null,
        duracao_minutos: form.agendamento ? form.duracao_minutos : null,
        dado_necessario: form.agendamento ? form.dado_necessario.trim() : null,
        restricao: form.restricao.trim() || null,
        cod_interno,
        urgencia: form.urgencia,
        prazo_entrega_urgencia: form.urgencia
          ? form.prazo_entrega_urgencia.trim() || null
          : null,
        valor_urgencia: form.urgencia
          ? parseCurrencyInput(form.valor_urgencia)
          : null,
      };

      const isEdit = Boolean(form.id);
      const url = isEdit ? `/api/servicos/${form.id}` : "/api/servicos";
      const method = isEdit ? "PATCH" : "POST";

      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      if (!res.ok) {
        const json = await res.json().catch(() => null);
        throw new Error(json?.message || "Falha ao salvar serviço");
      }

      clearPanel();
      await loadServicos();
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Erro";
      setError(msg);
    } finally {
      setMutating(false);
    }
  }

  async function onDelete(id: string) {
    const ok = window.confirm("Excluir serviço? Essa ação é irreversível.");
    if (!ok) return;

    setMutating(true);
    setError(null);
    try {
      const res = await fetch(`/api/servicos/${id}`, { method: "DELETE" });
      if (!res.ok) throw new Error("Falha ao excluir serviço");
      if (form.id === id) clearPanel();
      await loadServicos();
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Erro";
      setError(msg);
    } finally {
      setMutating(false);
    }
  }

  const schedulingIncomplete =
    form.agendamento &&
    (!form.agenda_id.trim() ||
      !Number.isFinite(form.duracao_minutos) ||
      form.duracao_minutos < 1 ||
      !form.dado_necessario.trim());

  const urgenciaIncomplete =
    form.urgencia && parseCurrencyInput(form.valor_urgencia) === null;

  return (
    <div className="flex flex-col gap-5">
      {error ? (
        <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
          {error}
        </div>
      ) : null}

      {/* Lista + filtros */}
      <section className="rounded-xl border border-blue-100 bg-white">
        <div className="flex flex-col gap-3 border-b border-blue-50 px-4 py-3 sm:flex-row sm:items-end sm:justify-between">
          <div className="min-w-0 flex-1">
            <label className={labelClass} htmlFor="busca-servico">
              Buscar exame
            </label>
            <input
              id="busca-servico"
              className={`${inputClass} mt-1`}
              value={busca}
              onChange={(e) => setBusca(e.target.value)}
              placeholder="Nome ou código interno"
              autoComplete="off"
            />
          </div>

          <div className="flex flex-wrap items-end gap-2">
            <div>
              <div className={labelClass}>Ativo</div>
              <select
                className={`${selectClass} mt-1`}
                value={filtroAtivo}
                onChange={(e) => setFiltroAtivo(e.target.value as TriFilter)}
              >
                <option value="todos">Todos</option>
                <option value="sim">Sim</option>
                <option value="nao">Não</option>
              </select>
            </div>
            <div>
              <div className={labelClass}>Agendamento</div>
              <select
                className={`${selectClass} mt-1`}
                value={filtroAgendamento}
                onChange={(e) =>
                  setFiltroAgendamento(e.target.value as TriFilter)
                }
              >
                <option value="todos">Todos</option>
                <option value="sim">Sim</option>
                <option value="nao">Não</option>
              </select>
            </div>
            <div>
              <div className={labelClass}>Urgência</div>
              <select
                className={`${selectClass} mt-1`}
                value={filtroUrgencia}
                onChange={(e) => setFiltroUrgencia(e.target.value as TriFilter)}
              >
                <option value="todos">Todos</option>
                <option value="sim">Sim</option>
                <option value="nao">Não</option>
              </select>
            </div>
            <button
              type="button"
              onClick={startNew}
              disabled={listBusy}
              className="h-10 rounded-lg bg-blue-600 px-4 text-sm font-semibold text-white hover:bg-blue-700 disabled:opacity-60"
            >
              Novo
            </button>
          </div>
        </div>

        <div className="flex items-center justify-between px-4 py-2 text-xs text-blue-800/65">
          <span>
            {listBusy
              ? "Atualizando…"
              : `${filtrados.length} de ${servicos.length} exame(s)`}
          </span>
          <span>Clique na linha para carregar abaixo</span>
        </div>

        <div className="max-h-[220px] overflow-auto border-t border-blue-50">
          <table className="min-w-full text-left text-sm">
            <thead className="sticky top-0 z-10 bg-blue-50/95 text-[11px] uppercase tracking-wide text-blue-900/55 backdrop-blur">
              <tr>
                <th className="whitespace-nowrap px-4 py-2 font-medium">Código</th>
                <th className="px-3 py-2 font-medium">Nome</th>
                <th className="whitespace-nowrap px-3 py-2 text-right font-medium">
                  Valor
                </th>
                <th className="whitespace-nowrap px-3 py-2 text-center font-medium">
                  Ativo
                </th>
                <th className="whitespace-nowrap px-3 py-2 text-center font-medium">
                  Agend.
                </th>
                <th className="whitespace-nowrap px-3 py-2 text-center font-medium">
                  Urgência
                </th>
                <th className="whitespace-nowrap px-4 py-2 text-center font-medium">
                  Ações
                </th>
              </tr>
            </thead>
            <tbody>
              {filtrados.length === 0 ? (
                <tr>
                  <td
                    colSpan={7}
                    className="px-4 py-8 text-center text-blue-800/60"
                  >
                    {servicos.length === 0
                      ? "Nenhum serviço cadastrado."
                      : "Nenhum exame encontrado com esses filtros."}
                  </td>
                </tr>
              ) : (
                filtrados.map((s) => {
                  const selected = form.id === s.id;
                  return (
                    <tr
                      key={s.id}
                      className={
                        "cursor-pointer border-t border-blue-50 transition-colors " +
                        (selected
                          ? "bg-blue-100/80"
                          : "hover:bg-blue-50/70")
                      }
                      onClick={() => void loadServicoIntoPanel(s.id)}
                    >
                      <td className="whitespace-nowrap px-4 py-2.5 tabular-nums text-blue-800/70">
                        {s.cod_interno ?? "—"}
                      </td>
                      <td className="max-w-[420px] truncate px-3 py-2.5 font-medium text-blue-950">
                        {s.nome}
                      </td>
                      <td className="whitespace-nowrap px-3 py-2.5 text-right tabular-nums text-blue-800/80">
                        {formatCurrencyValue(s.valor)}
                      </td>
                      <td className="px-3 py-2.5 text-center text-blue-800/70">
                        {s.ativo ? "Sim" : "Não"}
                      </td>
                      <td className="px-3 py-2.5 text-center text-blue-800/70">
                        {s.agendamento ? "Sim" : "Não"}
                      </td>
                      <td className="px-3 py-2.5 text-center text-blue-800/70">
                        {s.urgencia ? "Sim" : "Não"}
                      </td>
                      <td className="px-4 py-2.5 text-center">
                        <TableIconActions
                          showEdit={false}
                          onDelete={() => onDelete(s.id)}
                          disabled={listBusy}
                        />
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </section>

      {/* Formulário */}
      <section
        ref={formRef}
        className="rounded-xl border border-blue-100 bg-white"
      >
        <div className="flex flex-wrap items-center justify-between gap-2 border-b border-blue-50 px-4 py-3">
          <div>
            <h2 className="text-sm font-semibold text-blue-950">
              {!form.id
                ? "Novo serviço"
                : readOnly
                  ? "Consulta"
                  : "Edição"}
            </h2>
            {form.nome ? (
              <p className="mt-0.5 text-xs text-blue-800/60 truncate max-w-[520px]">
                {form.cod_interno ? `${form.cod_interno} · ` : ""}
                {form.nome}
              </p>
            ) : null}
          </div>
          <div className="flex flex-wrap items-center gap-2">
            {form.id && readOnly ? (
              <button
                type="button"
                onClick={() => setReadOnly(false)}
                className="h-9 rounded-lg bg-blue-600 px-3 text-xs font-semibold text-white hover:bg-blue-700 disabled:opacity-60"
                disabled={listBusy}
              >
                Habilitar edição
              </button>
            ) : null}
            {form.id && !readOnly ? (
              <button
                type="button"
                onClick={() =>
                  form.id ? void loadServicoIntoPanel(form.id) : undefined
                }
                className="h-9 rounded-lg border border-blue-100 px-3 text-xs font-semibold text-blue-800 hover:bg-blue-50 disabled:opacity-60"
                disabled={listBusy}
              >
                Cancelar edição
              </button>
            ) : null}
            {form.id ? (
              <button
                type="button"
                onClick={clearPanel}
                className="h-9 rounded-lg border border-blue-100 px-3 text-xs font-semibold text-blue-800 hover:bg-blue-50 disabled:opacity-60"
                disabled={listBusy}
              >
                Limpar
              </button>
            ) : null}
          </div>
        </div>

        <form className="flex flex-col gap-3 px-4 py-4" onSubmit={onSubmit}>
          {/* Identificação */}
          <div className="rounded-lg border border-blue-100 bg-[#F3F7FF]/60 p-3">
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-12 sm:items-end">
              <div className="sm:col-span-2 flex flex-col gap-1">
                <label className={labelClass}>Cod Lab.</label>
                <input
                  className={inputClass}
                  value={form.cod_interno}
                  onChange={(e) =>
                    setForm((p) => ({
                      ...p,
                      cod_interno: e.target.value.replace(/[^\d.-]/g, ""),
                    }))
                  }
                  disabled={locked}
                  inputMode="decimal"
                />
              </div>
              <div className="sm:col-span-2 flex flex-col gap-1">
                <label className={labelClass}>Tipo</label>
                <input
                  className={inputClass}
                  value={form.tipo}
                  onChange={(e) =>
                    setForm((p) => ({ ...p, tipo: e.target.value }))
                  }
                  disabled={locked}
                />
              </div>
              <div className="sm:col-span-6 flex flex-col gap-1">
                <label className={labelClass}>Nome</label>
                <input
                  className={inputClass}
                  value={form.nome}
                  onChange={(e) =>
                    setForm((p) => ({ ...p, nome: e.target.value }))
                  }
                  disabled={locked}
                />
              </div>
              <div className="sm:col-span-2 flex items-center sm:justify-center sm:pb-2">
                <label className="flex items-center gap-2 text-sm font-medium text-blue-950">
                  <input
                    type="checkbox"
                    checked={form.ativo}
                    onChange={(e) =>
                      setForm((p) => ({ ...p, ativo: e.target.checked }))
                    }
                    disabled={locked}
                    className="rounded border-blue-200"
                  />
                  Ativo
                </label>
              </div>
            </div>
          </div>

          {/* Valores e prazos */}
          <div className="rounded-lg border border-blue-100 bg-[#F3F7FF]/60 p-3">
            <div className="mb-2 text-[11px] font-semibold uppercase tracking-wide text-blue-900/45">
              Valores e Prazos
            </div>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-[1fr_1fr_auto_1fr_1fr] sm:items-end">
              <div className="flex flex-col gap-1">
                <label className={labelClass}>Valor (R$)</label>
                <input
                  className={inputClass}
                  value={form.valor}
                  onChange={(e) =>
                    setForm((p) => ({
                      ...p,
                      valor: formatCurrencyInput(e.target.value),
                    }))
                  }
                  disabled={locked}
                  inputMode="numeric"
                  placeholder="R$ 0,00"
                />
              </div>
              <div className="flex flex-col gap-1">
                <label className={labelClass}>Prazo Entrega</label>
                <input
                  className={inputClass}
                  value={form.prazo_entrega}
                  onChange={(e) =>
                    setForm((p) => ({ ...p, prazo_entrega: e.target.value }))
                  }
                  disabled={locked}
                />
              </div>
              <div className="flex items-center sm:px-2 sm:pb-2">
                <label className="flex items-center gap-2 whitespace-nowrap text-sm font-medium text-blue-950">
                  <input
                    type="checkbox"
                    checked={form.urgencia}
                    onChange={(e) =>
                      setForm((p) => ({ ...p, urgencia: e.target.checked }))
                    }
                    disabled={locked}
                    className="rounded border-blue-200"
                  />
                  Urgência
                </label>
              </div>
              <div className="flex flex-col gap-1">
                <label className={labelClass}>Prazo Urgência</label>
                <input
                  className={inputClass}
                  value={form.prazo_entrega_urgencia}
                  onChange={(e) =>
                    setForm((p) => ({
                      ...p,
                      prazo_entrega_urgencia: e.target.value,
                    }))
                  }
                  disabled={locked || !form.urgencia}
                />
              </div>
              <div className="flex flex-col gap-1">
                <label className={labelClass}>Valor Urgência (R$)</label>
                <input
                  className={inputClass}
                  value={form.valor_urgencia}
                  onChange={(e) =>
                    setForm((p) => ({
                      ...p,
                      valor_urgencia: formatCurrencyInput(e.target.value),
                    }))
                  }
                  disabled={locked || !form.urgencia}
                  inputMode="numeric"
                  placeholder="R$ 0,00"
                />
              </div>
            </div>
          </div>

          {/* Agendamento */}
          <div className="rounded-lg border border-blue-100 bg-[#F3F7FF]/60 p-3">
            <div className="mb-2 text-[11px] font-semibold uppercase tracking-wide text-blue-900/45">
              Agendamento
            </div>
            <div className="grid grid-cols-1 gap-3 lg:grid-cols-12">
              <div className="flex flex-col gap-3 lg:col-span-8">
                <div className="grid grid-cols-1 gap-3 sm:grid-cols-12 sm:items-end">
                  <div className="sm:col-span-7 flex items-center sm:pb-2">
                    <label className="flex items-center gap-2 text-sm font-medium text-blue-950">
                      <input
                        type="checkbox"
                        checked={form.agendamento}
                        onChange={(e) =>
                          setForm((p) => ({
                            ...p,
                            agendamento: e.target.checked,
                          }))
                        }
                        disabled={locked}
                        className="rounded border-blue-200"
                      />
                      Requer Agendamento
                    </label>
                  </div>
                  <div className="sm:col-span-5 flex flex-col gap-1">
                    <label className={labelClass}>Duração (min)</label>
                    <input
                      type="number"
                      min={1}
                      className={inputClass}
                      value={form.duracao_minutos || ""}
                      onChange={(e) =>
                        setForm((p) => ({
                          ...p,
                          duracao_minutos: Number(e.target.value || 0),
                        }))
                      }
                      disabled={locked || !form.agendamento}
                    />
                  </div>
                </div>
                <div className="flex flex-col gap-1">
                  <label className={labelClass}>Agenda</label>
                  <input
                    className={inputClass}
                    value={form.agenda_id}
                    onChange={(e) =>
                      setForm((p) => ({ ...p, agenda_id: e.target.value }))
                    }
                    disabled={locked || !form.agendamento}
                    autoComplete="off"
                  />
                </div>
              </div>
              <div className="flex flex-col gap-1 lg:col-span-4">
                <label className={labelClass}>
                  Dados Necessários no Agendamento
                </label>
                <textarea
                  className={`${textareaClass} min-h-[108px] flex-1`}
                  rows={4}
                  value={form.dado_necessario}
                  onChange={(e) =>
                    setForm((p) => ({
                      ...p,
                      dado_necessario: e.target.value,
                    }))
                  }
                  disabled={locked || !form.agendamento}
                />
              </div>
            </div>
          </div>

          {/* Informações complementares */}
          <div className="rounded-lg border border-blue-100 bg-[#F3F7FF]/60 p-3">
            <div className="mb-2 text-[11px] font-semibold uppercase tracking-wide text-blue-900/45">
              Informações Complementares
            </div>
            <div className="grid grid-cols-1 gap-3 lg:grid-cols-3">
              <div className="flex flex-col gap-1">
                <label className={labelClass}>Preparo</label>
                <textarea
                  className={`${textareaClass} h-[280px] resize-y`}
                  rows={12}
                  value={form.preparo}
                  onChange={(e) =>
                    setForm((p) => ({ ...p, preparo: e.target.value }))
                  }
                  disabled={locked}
                />
              </div>
              <div className="flex flex-col gap-1">
                <label className={labelClass}>Restrição</label>
                <textarea
                  className={`${textareaClass} h-[280px] resize-y`}
                  rows={12}
                  value={form.restricao}
                  onChange={(e) =>
                    setForm((p) => ({ ...p, restricao: e.target.value }))
                  }
                  disabled={locked}
                />
              </div>
              <div className="flex flex-col gap-1">
                <label className={labelClass}>Sinônimos</label>
                <textarea
                  className={`${textareaClass} h-[280px] resize-y`}
                  rows={12}
                  value={form.embedding_text}
                  onChange={(e) =>
                    setForm((p) => ({ ...p, embedding_text: e.target.value }))
                  }
                  disabled={locked}
                />
              </div>
            </div>
          </div>

          <div className="flex justify-end pt-1">
            <button
              type="submit"
              disabled={
                mutating ||
                readOnly ||
                loadingDetail ||
                !form.tipo.trim() ||
                !form.nome.trim() ||
                !form.preparo.trim() ||
                !form.embedding_text.trim() ||
                schedulingIncomplete ||
                urgenciaIncomplete
              }
              className="h-10 min-w-[140px] rounded-lg bg-blue-600 px-5 text-sm font-semibold text-white hover:bg-blue-700 disabled:opacity-60"
            >
              {mutating ? "Salvando…" : form.id ? "Salvar" : "Criar"}
            </button>
          </div>
        </form>
      </section>
    </div>
  );
}
