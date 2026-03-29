'use client';

import { useEffect, useRef, useState, type FormEvent } from "react";
import TableIconActions from "@/app/dashboard/_components/TableIconActions";

type ServicoBasic = {
  id: string;
  tipo: string | null;
  nome: string;
  valor: number | null;
  ativo: boolean | null;
  agendamento: boolean | null;
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

function formatCurrencyValue(value: number | null): string {
  if (value === null || value === undefined) return "-";
  return value.toLocaleString("pt-BR", {
    style: "currency",
    currency: "BRL",
  });
}

export default function ServicosPage() {
  /** Evita aplicar resposta antiga se o utilizador mudar de linha rápido */
  const detailRequestId = useRef(0);

  const [loadingList, setLoadingList] = useState(false);
  const [loadingDetail, setLoadingDetail] = useState(false);
  const [mutating, setMutating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [servicos, setServicos] = useState<ServicoBasic[]>([]);
  const [form, setForm] = useState<ServicoForm>(emptyForm());
  /** true = painel direito só leitura (carregado por clique na linha) */
  const [readOnly, setReadOnly] = useState(false);

  const listBusy = loadingList || loadingDetail || mutating;
  const locked = readOnly || loadingDetail || mutating;

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
        valor:
          d.valor === null || d.valor === undefined
            ? ""
            : Number(d.valor).toLocaleString("pt-BR", {
                style: "currency",
                currency: "BRL",
              }),
        ativo: Boolean(d.ativo),
        agendamento: Boolean(d.agendamento),
        agenda_id: d.agenda_id ?? "",
        prazo_entrega: d.prazo_entrega ?? "",
        duracao_minutos: Number(d.duracao_minutos ?? 0),
        dado_necessario: d.dado_necessario ?? "",
        restricao: d.restricao ?? "",
      });
      setReadOnly(!options?.edit);
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
        if (
          !Number.isFinite(form.duracao_minutos) ||
          form.duracao_minutos < 1
        ) {
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

      const payload = {
        tipo: form.tipo.trim(),
        nome: form.nome.trim(),
        preparo: form.preparo,
        embedding_text: form.embedding_text.trim(),
        valor: parseCurrencyInput(form.valor),
        ativo: form.ativo,
        agendamento: form.agendamento,
        agenda_id: form.agendamento ? form.agenda_id.trim() : null,
        prazo_entrega: form.prazo_entrega.trim() ? form.prazo_entrega.trim() : null,
        duracao_minutos: form.agendamento
          ? form.duracao_minutos
          : null,
        dado_necessario: form.agendamento
          ? form.dado_necessario.trim()
          : null,
        restricao: form.restricao.trim() ? form.restricao.trim() : null,
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
        const txt = await res.text().catch(() => "");
        throw new Error(txt || "Falha ao salvar serviço");
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
      clearPanel();
      await loadServicos();
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Erro";
      setError(msg);
    } finally {
      setMutating(false);
    }
  }

  /** Quando agendamento está marcado, agenda + duração + dados são obrigatórios */
  const schedulingIncomplete =
    form.agendamento &&
    (!form.agenda_id.trim() ||
      !Number.isFinite(form.duracao_minutos) ||
      form.duracao_minutos < 1 ||
      !form.dado_necessario.trim());

  return (
    <div className="flex flex-col gap-4">
      <div>
        <p className="text-sm text-blue-800/70">
          <span className="font-medium text-blue-900">Clique</span> na linha para
          carregar o serviço à direita em modo consulta. Use{" "}
          <span className="font-medium">Habilitar edição</span> para alterar. Com{" "}
          <span className="font-medium">Agendamento</span> marcado, preencha também
          Agenda, Duração e Dados necessários.
        </p>
      </div>

      {error ? (
        <div className="rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
          {error}
        </div>
      ) : null}

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">
        <div className="lg:col-span-7 rounded-2xl border border-blue-100 bg-white p-4 min-w-0">
          <div className="flex items-center justify-between gap-3">
            <div className="text-sm font-semibold text-blue-900">Lista</div>
            <div className="text-xs text-blue-800/70">
              {listBusy ? "Atualizando..." : `${servicos.length} serviço(s)`}
            </div>
          </div>

          <div className="mt-3 overflow-x-auto">
            <table className="min-w-full text-left text-sm">
              <thead className="text-xs uppercase text-blue-900/60">
                <tr>
                  <th className="py-2 pr-3">Nome</th>
                  <th className="py-2 px-2 text-center">Tipo</th>
                  <th className="py-2 px-2 text-center">Valor</th>
                  <th className="py-2 px-2 text-center">Ativo</th>
                  <th className="py-2 px-2 text-center">Agendamento</th>
                  <th className="py-2 text-center">Ações</th>
                </tr>
              </thead>
              <tbody>
                {servicos.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="py-4 text-blue-800/70">
                      Nenhum serviço cadastrado.
                    </td>
                  </tr>
                ) : (
                  servicos.map((s) => (
                    <tr
                      key={s.id}
                      className={
                        "border-t border-blue-100/70 cursor-pointer transition-colors " +
                        (form.id === s.id
                          ? "bg-blue-100/70 ring-1 ring-inset ring-blue-200"
                          : "hover:bg-blue-50/60")
                      }
                      onClick={() => void loadServicoIntoPanel(s.id)}
                    >
                      <td className="py-2 pr-3 font-medium text-blue-900">
                        {s.nome}
                      </td>
                      <td className="py-2 px-2 text-center text-blue-800/70">
                        {s.tipo ?? "-"}
                      </td>
                      <td className="py-2 px-2 text-center text-blue-800/70">
                        {formatCurrencyValue(s.valor)}
                      </td>
                      <td className="py-2 px-2 text-center text-blue-800/70">
                        {s.ativo ? "Sim" : "Não"}
                      </td>
                      <td className="py-2 px-2 text-center text-blue-800/70">
                        {s.agendamento ? "Sim" : "Não"}
                      </td>
                      <td className="py-2 text-center">
                        <TableIconActions
                          showEdit={false}
                          onDelete={() => onDelete(s.id)}
                          disabled={listBusy}
                        />
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>

        <div className="lg:col-span-5 rounded-2xl border border-blue-100 bg-white p-4 min-w-0">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="text-sm font-semibold text-blue-900">
              {!form.id
                ? "Novo serviço"
                : readOnly
                  ? "Consultar serviço"
                  : "Editar serviço"}
            </div>
            <div className="flex flex-wrap items-center gap-2">
              {form.id && readOnly ? (
                <button
                  type="button"
                  onClick={() => setReadOnly(false)}
                  className="text-xs font-semibold rounded-xl bg-blue-600 text-white px-3 py-2 hover:bg-blue-700 disabled:opacity-60"
                  disabled={listBusy}
                >
                  Habilitar edição
                </button>
              ) : null}
              {form.id && !readOnly ? (
                <button
                  type="button"
                  onClick={() =>
                    form.id
                      ? void loadServicoIntoPanel(form.id)
                      : undefined
                  }
                  className="text-xs font-semibold text-blue-700 hover:bg-blue-50 rounded-xl border border-blue-100 px-3 py-2 disabled:opacity-60"
                  disabled={listBusy}
                >
                  Cancelar edição
                </button>
              ) : null}
              {form.id ? (
                <button
                  type="button"
                  onClick={() => clearPanel()}
                  className="text-xs font-semibold text-blue-700 hover:bg-blue-50 rounded-xl border border-blue-100 px-3 py-2 disabled:opacity-60"
                  disabled={listBusy}
                >
                  Limpar
                </button>
              ) : null}
            </div>
          </div>

          <form className="mt-4 flex flex-col gap-4" onSubmit={onSubmit}>
            {/* Tipo + Ativo (mesma linha) */}
            <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between sm:gap-4">
              <div className="min-w-0 flex-1 flex flex-col gap-1">
                <label className="text-sm font-medium text-foreground">
                  Tipo
                </label>
                <input
                  className="h-11 w-full rounded-xl border border-blue-100 px-3 text-foreground outline-none focus:ring-2 focus:ring-blue-200"
                  value={form.tipo}
                  onChange={(e) =>
                    setForm((p) => ({ ...p, tipo: e.target.value }))
                  }
                  disabled={locked}
                  placeholder="Ex: Exame de Imagem, Exame Laboratorial"
                />
              </div>
              <label className="flex shrink-0 items-center gap-2 pb-0.5 text-sm font-medium text-foreground sm:pb-1">
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

            <div className="flex flex-col gap-1">
              <label className="text-sm font-medium text-foreground">Nome</label>
              <input
                className="h-11 w-full rounded-xl border border-blue-100 px-3 text-foreground outline-none focus:ring-2 focus:ring-blue-200"
                value={form.nome}
                onChange={(e) => setForm((p) => ({ ...p, nome: e.target.value }))}
                disabled={locked}
                placeholder="Nome do Serviço"
              />
            </div>

            <div className="flex flex-col gap-1">
              <label className="text-sm font-medium text-foreground">
                Preparo
              </label>
              <textarea
                className="min-h-[200px] w-full rounded-xl border border-blue-100 px-3 py-2 text-foreground outline-none focus:ring-2 focus:ring-blue-200"
                value={form.preparo}
                onChange={(e) =>
                  setForm((p) => ({ ...p, preparo: e.target.value }))
                }
                disabled={locked}
                placeholder="Informações de Preparo para Paciente"
              />
            </div>

            <div className="flex flex-col gap-1">
              <label className="text-sm font-medium text-foreground">
                Restrição
              </label>
              <textarea
                className="min-h-[200px] w-full rounded-xl border border-blue-100 px-3 py-2 text-foreground outline-none focus:ring-2 focus:ring-blue-200"
                value={form.restricao}
                onChange={(e) =>
                  setForm((p) => ({ ...p, restricao: e.target.value }))
                }
                disabled={locked}
                placeholder="Restrições e Observações"
              />
            </div>

            {/* Prazo entrega + Valor */}
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <div className="flex flex-col gap-1">
                <label className="text-sm font-medium text-foreground">
                  Prazo entrega (dias)
                </label>
                <input
                  className="h-11 w-full rounded-xl border border-blue-100 px-3 text-foreground outline-none focus:ring-2 focus:ring-blue-200"
                  value={form.prazo_entrega}
                  onChange={(e) =>
                    setForm((p) => ({ ...p, prazo_entrega: e.target.value }))
                  }
                  disabled={locked}
                  placeholder="Ex: 2 dias"
                />
              </div>
              <div className="flex flex-col gap-1">
                <label className="text-sm font-medium text-foreground">
                  Valor (R$)
                </label>
                <input
                  className="h-11 w-full rounded-xl border border-blue-100 px-3 text-foreground outline-none focus:ring-2 focus:ring-blue-200"
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
            </div>

            <label className="flex items-center gap-2 text-sm font-medium text-foreground">
              <input
                type="checkbox"
                checked={form.agendamento}
                onChange={(e) =>
                  setForm((p) => ({ ...p, agendamento: e.target.checked }))
                }
                disabled={locked}
                className="rounded border-blue-200"
              />
              Agendamento
            </label>

            {form.agendamento ? (
              <div className="flex flex-col gap-3 rounded-xl border border-blue-100 bg-blue-50/40 p-3">
                <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
                  <div className="flex flex-col gap-1 sm:col-span-2">
                    <label className="text-sm font-medium text-foreground">
                      Agenda
                    </label>
                    <input
                      className="h-11 w-full rounded-xl border border-blue-100 bg-white px-3 text-foreground outline-none focus:ring-2 focus:ring-blue-200"
                      value={form.agenda_id}
                      onChange={(e) =>
                        setForm((p) => ({ ...p, agenda_id: e.target.value }))
                      }
                      disabled={locked}
                      placeholder="ID agenda do google agenda"
                      autoComplete="off"
                    />
                  </div>
                  <div className="flex flex-col gap-1 sm:col-span-1">
                    <label className="text-sm font-medium text-foreground">
                      Duração (min)
                    </label>
                    <input
                      type="number"
                      min={1}
                      className="h-11 w-full rounded-xl border border-blue-100 bg-white px-3 text-foreground outline-none focus:ring-2 focus:ring-blue-200"
                      value={form.duracao_minutos || ""}
                      onChange={(e) =>
                        setForm((p) => ({
                          ...p,
                          duracao_minutos: Number(e.target.value || 0),
                        }))
                      }
                      disabled={locked}
                      placeholder="Min"
                    />
                  </div>
                </div>
                <div className="flex flex-col gap-1">
                  <label className="text-sm font-medium text-foreground">
                    Dados necessários
                  </label>
                  <textarea
                    className="min-h-[200px] w-full rounded-xl border border-blue-100 bg-white px-3 py-2 text-foreground outline-none focus:ring-2 focus:ring-blue-200"
                    value={form.dado_necessario}
                    onChange={(e) =>
                      setForm((p) => ({ ...p, dado_necessario: e.target.value }))
                    }
                    disabled={locked}
                    placeholder="Dados necessários para ser solicitado para agendamento"
                  />
                </div>
              </div>
            ) : null}

            <div className="flex flex-col gap-1">
              <label className="text-sm font-medium text-foreground">
                Sinônimos
              </label>
              <textarea
                className="min-h-[200px] w-full rounded-xl border border-blue-100 px-3 py-2 text-foreground outline-none focus:ring-2 focus:ring-blue-200"
                value={form.embedding_text}
                onChange={(e) =>
                  setForm((p) => ({ ...p, embedding_text: e.target.value }))
                }
                disabled={locked}
                placeholder="Termos alternativos para busca e correspondência"
              />
              <div className="text-xs text-blue-800/70">
                Obrigatório para salvar o serviço.
              </div>
            </div>

            <div className="flex gap-2">
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
                  schedulingIncomplete
                }
                className="flex-1 h-11 rounded-xl bg-blue-600 text-white font-semibold hover:bg-blue-700 disabled:opacity-60"
              >
                {mutating ? "Salvando..." : form.id ? "Salvar" : "Criar"}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}

