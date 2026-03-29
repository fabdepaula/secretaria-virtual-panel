'use client';

import { useEffect, useMemo, useState, type FormEvent } from "react";
import TableIconActions from "@/app/dashboard/_components/TableIconActions";
import { normalizeTipoCliente } from "@/lib/cliente-tipo";
import { formatCnpj, formatCpf, onlyDigits } from "@/lib/documento";

type PlanoRow = {
  id: string;
  nome: string;
  descricao: string | null;
  prioridade_atendimento: number;
  prazo_pagamento_dias: number;
  permite_faturamento: boolean;
  ativo: boolean;
};

type PlanoForm = {
  id?: string;
  nome: string;
  descricao: string;
  prioridade_atendimento: number;
  prazo_pagamento_dias: number;
  permite_faturamento: boolean;
  ativo: boolean;
};

type ServicoOption = { id: string; nome: string };

type PlanoServicoRow = {
  id: string;
  servico_id: string;
  servico_nome: string;
  valor_especifico: number;
  prazo_especifico: string | null;
  ativo: boolean;
};

type ClienteMini = {
  id: string;
  tipo_cliente: string;
  nome: string;
  nome_fantasia: string | null;
  documento: string | null;
  plano_id: string | null;
};

type ClienteOption = {
  id: string;
  nome: string;
  nome_fantasia: string | null;
  tipo_cliente: string;
  plano_id: string | null;
};

const emptyForm = (): PlanoForm => ({
  nome: "",
  descricao: "",
  prioridade_atendimento: 0,
  prazo_pagamento_dias: 0,
  permite_faturamento: true,
  ativo: true,
});

const emptyPsForm = () => ({
  servico_id: "",
  valor_especifico: 0,
  prazo_especifico: "",
  ativo: true,
});

function tipoClienteLabel(tipo: string): "Física" | "Jurídica" {
  return normalizeTipoCliente(tipo) === "PJ" ? "Jurídica" : "Física";
}

function displayNomeCliente(c: ClienteMini | ClienteOption): string {
  const tipo = normalizeTipoCliente(c.tipo_cliente);
  if (tipo === "PJ") return c.nome_fantasia?.trim() || c.nome;
  return c.nome;
}

function formatDoc(documento: string | null, tipo: string): string {
  if (!documento) return "—";
  const d = onlyDigits(documento);
  return normalizeTipoCliente(tipo) === "PJ" ? formatCnpj(d) : formatCpf(d);
}

export default function PlanosPage() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [planos, setPlanos] = useState<PlanoRow[]>([]);
  const [servicos, setServicos] = useState<ServicoOption[]>([]);
  const [todosClientes, setTodosClientes] = useState<ClienteOption[]>([]);

  const [form, setForm] = useState<PlanoForm>(emptyForm());
  const [readOnly, setReadOnly] = useState(false);
  const locked = loading || readOnly;

  const [planoServicos, setPlanoServicos] = useState<PlanoServicoRow[]>([]);
  const [clientesPlano, setClientesPlano] = useState<ClienteMini[]>([]);
  const [psForm, setPsForm] = useState(emptyPsForm());
  const [psReadOnly, setPsReadOnly] = useState(false);
  const [psEditId, setPsEditId] = useState<string | undefined>();

  const [addClienteId, setAddClienteId] = useState("");

  const selectedPlanoId = form.id ?? null;

  const servicosDisponiveisParaVincular = useMemo(() => {
    const usados = new Set(planoServicos.map((x) => x.servico_id));
    return servicos.filter((s) => !usados.has(s.id));
  }, [servicos, planoServicos]);

  const clientesDisponiveisParaAssociar = useMemo(() => {
    if (!selectedPlanoId) return [];
    return todosClientes.filter((c) => c.plano_id !== selectedPlanoId);
  }, [todosClientes, selectedPlanoId]);

  useEffect(() => {
    void loadPlanos();
    void loadServicos();
    void loadTodosClientes();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function loadServicos() {
    try {
      const res = await fetch("/api/servicos");
      if (!res.ok) return;
      const json = await res.json();
      setServicos((json.data ?? []) as ServicoOption[]);
    } catch {
      /* ignore */
    }
  }

  async function loadTodosClientes() {
    try {
      const res = await fetch("/api/clientes");
      if (!res.ok) return;
      const json = await res.json();
      setTodosClientes((json.data ?? []) as ClienteOption[]);
    } catch {
      /* ignore */
    }
  }

  async function loadPlanos() {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/planos");
      if (!res.ok) throw new Error("Falha ao carregar planos");
      const json = await res.json();
      setPlanos((json.data ?? []) as PlanoRow[]);
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Erro";
      setError(msg);
    } finally {
      setLoading(false);
    }
  }

  async function loadPlanoCompleto(planoId: string) {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/planos/${planoId}/completo`);
      if (!res.ok) throw new Error("Falha ao carregar detalhes do plano");
      const json = await res.json();
      const d = json.data;
      if (!d?.plano) throw new Error("Plano não encontrado");

      const p = d.plano as PlanoRow;
      setForm({
        id: p.id,
        nome: p.nome ?? "",
        descricao: p.descricao ?? "",
        prioridade_atendimento: p.prioridade_atendimento ?? 0,
        prazo_pagamento_dias: p.prazo_pagamento_dias ?? 0,
        permite_faturamento: Boolean(p.permite_faturamento),
        ativo: Boolean(p.ativo),
      });
      setPlanoServicos((d.plano_servicos ?? []) as PlanoServicoRow[]);
      setClientesPlano((d.clientes ?? []) as ClienteMini[]);
      setReadOnly(true);
      clearPsForm();
      setAddClienteId("");
      await loadTodosClientes();
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Erro";
      setError(msg);
    } finally {
      setLoading(false);
    }
  }

  function clearPsForm() {
    setPsForm(emptyPsForm());
    setPsReadOnly(false);
    setPsEditId(undefined);
  }

  function loadPlanoFromRow(p: PlanoRow) {
    void loadPlanoCompleto(p.id);
  }

  function clearPanel() {
    setForm(emptyForm());
    setReadOnly(false);
    setPlanoServicos([]);
    setClientesPlano([]);
    clearPsForm();
    setAddClienteId("");
  }

  async function onSubmitPlano(e: FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);
    try {
      if (!form.nome.trim()) throw new Error("Nome é obrigatório");

      const payload = {
        nome: form.nome.trim(),
        descricao: form.descricao.trim() ? form.descricao.trim() : null,
        prioridade_atendimento: form.prioridade_atendimento,
        prazo_pagamento_dias: form.prazo_pagamento_dias,
        permite_faturamento: form.permite_faturamento,
        ativo: form.ativo,
      };

      const isEdit = Boolean(form.id);
      const res = await fetch(
        isEdit ? `/api/planos/${form.id}` : "/api/planos",
        {
          method: isEdit ? "PATCH" : "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        }
      );

      if (!res.ok) {
        const txt = await res.text().catch(() => "");
        throw new Error(txt || "Falha ao salvar plano");
      }

      if (!isEdit) {
        const json = await res.json().catch(() => ({}));
        const newId = json.id as string | undefined;
        await loadPlanos();
        if (newId) {
          await loadPlanoCompleto(newId);
        } else {
          clearPanel();
          await loadPlanos();
        }
      } else {
        await loadPlanos();
        if (form.id) await loadPlanoCompleto(form.id);
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Erro";
      setError(msg);
    } finally {
      setLoading(false);
    }
  }

  async function onDeletePlano(id: string) {
    const ok = window.confirm("Excluir plano? Essa ação é irreversível.");
    if (!ok) return;

    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/planos/${id}`, { method: "DELETE" });
      if (!res.ok) throw new Error("Falha ao excluir plano");
      if (form.id === id) clearPanel();
      await loadPlanos();
      await loadTodosClientes();
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Erro";
      setError(msg);
    } finally {
      setLoading(false);
    }
  }

  function loadPsFromRow(m: PlanoServicoRow) {
    setPsEditId(m.id);
    setPsForm({
      servico_id: m.servico_id,
      valor_especifico: Number(m.valor_especifico ?? 0),
      prazo_especifico: m.prazo_especifico ?? "",
      ativo: Boolean(m.ativo),
    });
    setPsReadOnly(true);
  }

  async function onSubmitPlanoServico(e: FormEvent) {
    e.preventDefault();
    if (!selectedPlanoId) {
      setError("Salve o plano antes de vincular serviços.");
      return;
    }
    setLoading(true);
    setError(null);
    try {
      if (!psForm.servico_id && !psEditId) {
        throw new Error("Selecione um serviço");
      }

      const payload = {
        plano_id: selectedPlanoId,
        servico_id: psForm.servico_id,
        valor_especifico: psForm.valor_especifico,
        prazo_especifico: psForm.prazo_especifico.trim()
          ? psForm.prazo_especifico.trim()
          : null,
        ativo: psForm.ativo,
      };

      const isEdit = Boolean(psEditId);
      const res = await fetch(
        isEdit ? `/api/plano-servicos/${psEditId}` : "/api/plano-servicos",
        {
          method: isEdit ? "PATCH" : "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        }
      );

      if (!res.ok) {
        const txt = await res.text().catch(() => "");
        throw new Error(txt || "Falha ao salvar vínculo");
      }

      clearPsForm();
      await loadPlanoCompleto(selectedPlanoId);
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Erro";
      setError(msg);
    } finally {
      setLoading(false);
    }
  }

  async function onDeletePlanoServico(id: string) {
    const ok = window.confirm("Remover este serviço do plano?");
    if (!ok) return;
    if (!selectedPlanoId) return;

    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/plano-servicos/${id}`, { method: "DELETE" });
      if (!res.ok) throw new Error("Falha ao remover vínculo");
      clearPsForm();
      await loadPlanoCompleto(selectedPlanoId);
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Erro";
      setError(msg);
    } finally {
      setLoading(false);
    }
  }

  async function onAssociarCliente() {
    if (!selectedPlanoId || !addClienteId) return;
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/clientes/${addClienteId}/plano`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ plano_id: selectedPlanoId }),
      });
      if (!res.ok) {
        const txt = await res.text().catch(() => "");
        throw new Error(txt || "Falha ao associar cliente");
      }
      setAddClienteId("");
      await loadPlanoCompleto(selectedPlanoId);
      await loadTodosClientes();
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Erro";
      setError(msg);
    } finally {
      setLoading(false);
    }
  }

  async function onRemoverClienteDoPlano(clienteId: string) {
    const ok = window.confirm("Remover este cliente do plano?");
    if (!ok) return;
    if (!selectedPlanoId) return;

    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/clientes/${clienteId}/plano`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ plano_id: null }),
      });
      if (!res.ok) throw new Error("Falha ao remover cliente do plano");
      await loadPlanoCompleto(selectedPlanoId);
      await loadTodosClientes();
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Erro";
      setError(msg);
    } finally {
      setLoading(false);
    }
  }

  const psLocked = loading || psReadOnly;
  const mostrarSecoesPlano = Boolean(selectedPlanoId);

  return (
    <div className="flex flex-col gap-4">
      <div>
        <p className="text-sm text-blue-800/70">
          <span className="font-medium text-blue-900">Clique</span> na linha para
          selecionar o plano e gerenciar{" "}
          <span className="font-medium">serviços</span> e{" "}
          <span className="font-medium">clientes</span> no mesmo lugar. Use{" "}
          <span className="font-medium">Habilitar edição</span> para alterar os dados do
          plano.
        </p>
      </div>

      {error ? (
        <div className="rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
          {error}
        </div>
      ) : null}

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">
        <div className="lg:col-span-5 xl:col-span-4 rounded-2xl border border-blue-100 bg-white p-4 min-w-0">
          <div className="flex items-center justify-between gap-3">
            <div className="text-sm font-semibold text-blue-900">Planos</div>
            <div className="text-xs text-blue-800/70">
              {loading ? "Atualizando..." : `${planos.length} plano(s)`}
            </div>
          </div>

          <div className="mt-3 overflow-x-auto">
            <table className="min-w-full text-left text-sm">
              <thead className="text-xs uppercase text-blue-900/60">
                <tr>
                  <th className="py-2 pr-3">Nome</th>
                  <th className="py-2 pr-3">Ativo</th>
                  <th className="py-2">Ações</th>
                </tr>
              </thead>
              <tbody>
                {planos.length === 0 ? (
                  <tr>
                    <td colSpan={3} className="py-4 text-blue-800/70">
                      Nenhum plano cadastrado.
                    </td>
                  </tr>
                ) : (
                  planos.map((p) => (
                    <tr
                      key={p.id}
                      className={
                        "border-t border-blue-100/70 cursor-pointer transition-colors " +
                        (form.id === p.id
                          ? "bg-blue-100/70 ring-1 ring-inset ring-blue-200"
                          : "hover:bg-blue-50/60")
                      }
                      onClick={() => loadPlanoFromRow(p)}
                    >
                      <td className="py-2 pr-3 font-medium text-blue-900">
                        {p.nome}
                      </td>
                      <td className="py-2 pr-3 text-blue-800/70">
                        {p.ativo ? "Sim" : "Não"}
                      </td>
                      <td className="py-2">
                        <TableIconActions
                          showEdit={false}
                          onDelete={() => onDeletePlano(p.id)}
                          disabled={loading}
                        />
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>

        <div className="lg:col-span-7 xl:col-span-8 flex flex-col gap-4 min-w-0">
          <div className="rounded-2xl border border-blue-100 bg-white p-4 min-w-0">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="text-sm font-semibold text-blue-900">
                {!form.id
                  ? "Novo plano"
                  : readOnly
                    ? "Dados do plano"
                    : "Editar plano"}
              </div>
              <div className="flex flex-wrap gap-2">
                {form.id && readOnly ? (
                  <button
                    type="button"
                    onClick={() => setReadOnly(false)}
                    className="text-xs font-semibold rounded-xl bg-blue-600 text-white px-3 py-2 hover:bg-blue-700 disabled:opacity-60"
                    disabled={loading}
                  >
                    Habilitar edição
                  </button>
                ) : null}
                {form.id && !readOnly ? (
                  <button
                    type="button"
                    onClick={() => {
                      if (form.id) void loadPlanoCompleto(form.id);
                    }}
                    className="text-xs font-semibold text-blue-700 hover:bg-blue-50 rounded-xl border border-blue-100 px-3 py-2 disabled:opacity-60"
                    disabled={loading}
                  >
                    Cancelar edição
                  </button>
                ) : null}
                {form.id ? (
                  <button
                    type="button"
                    onClick={() => clearPanel()}
                    className="text-xs font-semibold text-blue-700 hover:bg-blue-50 rounded-xl border border-blue-100 px-3 py-2 disabled:opacity-60"
                    disabled={loading}
                  >
                    Limpar
                  </button>
                ) : null}
              </div>
            </div>

            <form className="mt-4 flex flex-col gap-3" onSubmit={onSubmitPlano}>
              <div className="flex flex-col gap-1">
                <label className="text-sm font-medium text-foreground">Nome</label>
                <input
                  className="h-11 w-full rounded-xl border border-blue-100 px-3 text-foreground outline-none focus:ring-2 focus:ring-blue-200"
                  value={form.nome}
                  onChange={(e) => setForm((p) => ({ ...p, nome: e.target.value }))}
                  placeholder="Ex.: Mensal, Anual..."
                  disabled={locked}
                />
              </div>

              <div className="flex flex-col gap-1">
                <label className="text-sm font-medium text-foreground">
                  Descrição
                </label>
                <textarea
                  className="min-h-[80px] w-full rounded-xl border border-blue-100 px-3 py-2 text-foreground outline-none focus:ring-2 focus:ring-blue-200"
                  value={form.descricao}
                  onChange={(e) =>
                    setForm((p) => ({ ...p, descricao: e.target.value }))
                  }
                  placeholder="Detalhes do plano"
                  disabled={locked}
                />
              </div>

              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <div className="flex flex-col gap-1">
                  <label className="text-sm font-medium text-foreground">
                    Prioridade
                  </label>
                  <input
                    type="number"
                    className="h-11 w-full rounded-xl border border-blue-100 px-3 text-foreground outline-none focus:ring-2 focus:ring-blue-200"
                    value={form.prioridade_atendimento}
                    onChange={(e) =>
                      setForm((p) => ({
                        ...p,
                        prioridade_atendimento: Number(e.target.value || 0),
                      }))
                    }
                    disabled={locked}
                  />
                </div>

                <div className="flex flex-col gap-1">
                  <label className="text-sm font-medium text-foreground">
                    Prazo (dias)
                  </label>
                  <input
                    type="number"
                    className="h-11 w-full rounded-xl border border-blue-100 px-3 text-foreground outline-none focus:ring-2 focus:ring-blue-200"
                    value={form.prazo_pagamento_dias}
                    onChange={(e) =>
                      setForm((p) => ({
                        ...p,
                        prazo_pagamento_dias: Number(e.target.value || 0),
                      }))
                    }
                    disabled={locked}
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <label className="flex items-center gap-2 text-sm font-medium text-foreground">
                  <input
                    type="checkbox"
                    checked={form.permite_faturamento}
                    onChange={(e) =>
                      setForm((p) => ({
                        ...p,
                        permite_faturamento: e.target.checked,
                      }))
                    }
                    disabled={locked}
                  />
                  Permite faturamento
                </label>

                <label className="flex items-center gap-2 text-sm font-medium text-foreground">
                  <input
                    type="checkbox"
                    checked={form.ativo}
                    onChange={(e) =>
                      setForm((p) => ({ ...p, ativo: e.target.checked }))
                    }
                    disabled={locked}
                  />
                  Ativo
                </label>
              </div>

              <button
                type="submit"
                disabled={loading || locked || !form.nome.trim()}
                className="h-11 w-full rounded-xl bg-blue-600 text-white font-semibold hover:bg-blue-700 disabled:opacity-60"
              >
                {loading ? "Salvando..." : form.id ? "Salvar plano" : "Criar plano"}
              </button>
            </form>
          </div>

          {mostrarSecoesPlano ? (
            <>
              <div className="rounded-2xl border border-blue-100 bg-white p-4 min-w-0">
                <div className="text-sm font-semibold text-blue-900">
                  Serviços do plano
                </div>
                <p className="mt-1 text-xs text-blue-800/70">
                  Vincule serviços com valor e prazo específicos para este plano.
                </p>

                <div className="mt-3 overflow-x-auto">
                  <table className="min-w-full text-left text-sm">
                    <thead className="text-xs uppercase text-blue-900/60">
                      <tr>
                        <th className="py-2 pr-3">Serviço</th>
                        <th className="py-2 pr-3">Valor</th>
                        <th className="py-2 pr-3">Prazo</th>
                        <th className="py-2 pr-3">Ativo</th>
                        <th className="py-2">Ações</th>
                      </tr>
                    </thead>
                    <tbody>
                      {planoServicos.length === 0 ? (
                        <tr>
                          <td colSpan={5} className="py-3 text-blue-800/70">
                            Nenhum serviço vinculado.
                          </td>
                        </tr>
                      ) : (
                        planoServicos.map((m) => (
                          <tr
                            key={m.id}
                            className={
                              "border-t border-blue-100/70 cursor-pointer transition-colors " +
                              (psEditId === m.id
                                ? "bg-blue-100/70 ring-1 ring-inset ring-blue-200"
                                : "hover:bg-blue-50/60")
                            }
                            onClick={() => loadPsFromRow(m)}
                          >
                            <td className="py-2 pr-3 font-medium text-blue-900">
                              {m.servico_nome}
                            </td>
                            <td className="py-2 pr-3 text-blue-800/70">
                              {m.valor_especifico}
                            </td>
                            <td className="py-2 pr-3 text-blue-800/70">
                              {m.prazo_especifico ?? "—"}
                            </td>
                            <td className="py-2 pr-3 text-blue-800/70">
                              {m.ativo ? "Sim" : "Não"}
                            </td>
                            <td className="py-2">
                              <TableIconActions
                                showEdit={false}
                                onDelete={() => onDeletePlanoServico(m.id)}
                                disabled={loading}
                              />
                            </td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>

                <form
                  className="mt-4 flex flex-col gap-3 border-t border-blue-100 pt-4"
                  onSubmit={onSubmitPlanoServico}
                >
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div className="text-xs font-semibold text-blue-900">
                      {psEditId ? "Editar vínculo" : "Novo vínculo"}
                    </div>
                    <div className="flex flex-wrap gap-2">
                      {psEditId && psReadOnly ? (
                        <button
                          type="button"
                          onClick={() => setPsReadOnly(false)}
                          className="text-xs font-semibold rounded-xl bg-blue-600 text-white px-3 py-2 hover:bg-blue-700 disabled:opacity-60"
                          disabled={loading}
                        >
                          Habilitar edição
                        </button>
                      ) : null}
                      {psEditId ? (
                        <button
                          type="button"
                          onClick={() => clearPsForm()}
                          className="text-xs font-semibold text-blue-700 hover:bg-blue-50 rounded-xl border border-blue-100 px-3 py-2 disabled:opacity-60"
                          disabled={loading}
                        >
                          Cancelar
                        </button>
                      ) : null}
                    </div>
                  </div>

                  <div className="flex flex-col gap-1">
                    <label className="text-sm font-medium text-foreground">
                      Serviço
                    </label>
                    <select
                      className="h-11 w-full rounded-xl border border-blue-100 px-3 text-foreground outline-none focus:ring-2 focus:ring-blue-200"
                      value={psForm.servico_id}
                      onChange={(e) =>
                        setPsForm((p) => ({ ...p, servico_id: e.target.value }))
                      }
                      disabled={psLocked || Boolean(psEditId)}
                    >
                      {!psEditId ? (
                        <option value="">Selecione...</option>
                      ) : null}
                      {(psEditId ? servicos : servicosDisponiveisParaVincular).map(
                        (s) => (
                          <option key={s.id} value={s.id}>
                            {s.nome}
                          </option>
                        )
                      )}
                    </select>
                  </div>

                  <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                    <div className="flex flex-col gap-1">
                      <label className="text-sm font-medium text-foreground">
                        Valor
                      </label>
                      <input
                        type="number"
                        className="h-11 w-full rounded-xl border border-blue-100 px-3 text-foreground outline-none focus:ring-2 focus:ring-blue-200"
                        value={psForm.valor_especifico}
                        onChange={(e) =>
                          setPsForm((p) => ({
                            ...p,
                            valor_especifico: Number(e.target.value || 0),
                          }))
                        }
                        disabled={psLocked}
                      />
                    </div>
                    <div className="flex flex-col gap-1">
                      <label className="text-sm font-medium text-foreground">
                        Prazo
                      </label>
                      <input
                        className="h-11 w-full rounded-xl border border-blue-100 px-3 text-foreground outline-none focus:ring-2 focus:ring-blue-200"
                        value={psForm.prazo_especifico}
                        onChange={(e) =>
                          setPsForm((p) => ({
                            ...p,
                            prazo_especifico: e.target.value,
                          }))
                        }
                        placeholder="Ex.: 24h, 2 dias..."
                        disabled={psLocked}
                      />
                    </div>
                  </div>

                  <label className="flex items-center gap-2 text-sm font-medium text-foreground">
                    <input
                      type="checkbox"
                      checked={psForm.ativo}
                      onChange={(e) =>
                        setPsForm((p) => ({ ...p, ativo: e.target.checked }))
                      }
                      disabled={psLocked}
                    />
                    Ativo
                  </label>

                  <button
                    type="submit"
                    disabled={
                      loading ||
                      psLocked ||
                      (!psEditId && !psForm.servico_id)
                    }
                    className="h-11 w-full rounded-xl bg-blue-600 text-white font-semibold hover:bg-blue-700 disabled:opacity-60"
                  >
                    {loading
                      ? "Salvando..."
                      : psEditId
                        ? "Salvar vínculo"
                        : "Adicionar serviço"}
                  </button>
                </form>
              </div>

              <div className="rounded-2xl border border-blue-100 bg-white p-4 min-w-0">
                <div className="text-sm font-semibold text-blue-900">
                  Clientes neste plano
                </div>
                <p className="mt-1 text-xs text-blue-800/70">
                  Associar move o cliente para este plano (se já estiver em outro, o
                  vínculo anterior é substituído).
                </p>

                <div className="mt-3 flex flex-wrap gap-2 items-end">
                  <div className="min-w-[200px] flex-1 flex flex-col gap-1">
                    <label className="text-sm font-medium text-foreground">
                      Adicionar cliente
                    </label>
                    <select
                      className="h-11 w-full rounded-xl border border-blue-100 px-3 text-foreground outline-none focus:ring-2 focus:ring-blue-200"
                      value={addClienteId}
                      onChange={(e) => setAddClienteId(e.target.value)}
                      disabled={loading}
                    >
                      <option value="">
                        {clientesDisponiveisParaAssociar.length
                          ? "Selecione..."
                          : "Todos já estão neste plano"}
                      </option>
                      {clientesDisponiveisParaAssociar.map((c) => (
                        <option key={c.id} value={c.id}>
                          {displayNomeCliente(c)}
                          {c.plano_id && c.plano_id !== selectedPlanoId
                            ? " (outro plano)"
                            : ""}
                        </option>
                      ))}
                    </select>
                  </div>
                  <button
                    type="button"
                    onClick={() => void onAssociarCliente()}
                    disabled={loading || !addClienteId}
                    className="h-11 rounded-xl bg-blue-600 text-white font-semibold px-4 hover:bg-blue-700 disabled:opacity-60"
                  >
                    Associar
                  </button>
                </div>

                <div className="mt-4 overflow-x-auto">
                  <table className="min-w-full text-left text-sm">
                    <thead className="text-xs uppercase text-blue-900/60">
                      <tr>
                        <th className="py-2 pr-3">Nome</th>
                        <th className="py-2 pr-3">Tipo</th>
                        <th className="py-2 pr-3">Documento</th>
                        <th className="py-2">Ações</th>
                      </tr>
                    </thead>
                    <tbody>
                      {clientesPlano.length === 0 ? (
                        <tr>
                          <td colSpan={4} className="py-3 text-blue-800/70">
                            Nenhum cliente neste plano.
                          </td>
                        </tr>
                      ) : (
                        clientesPlano.map((c) => (
                            <tr
                              key={c.id}
                              className="border-t border-blue-100/70"
                            >
                              <td className="py-2 pr-3 font-medium text-blue-900">
                                {displayNomeCliente(c)}
                              </td>
                              <td className="py-2 pr-3 text-blue-800/70">
                                {tipoClienteLabel(c.tipo_cliente)}
                              </td>
                              <td className="py-2 pr-3 text-blue-800/70">
                                {formatDoc(c.documento, c.tipo_cliente)}
                              </td>
                              <td className="py-2">
                                <button
                                  type="button"
                                  onClick={() => void onRemoverClienteDoPlano(c.id)}
                                  className="text-xs font-semibold rounded-xl border border-red-100 bg-white px-3 py-1.5 text-red-700 hover:bg-red-50 disabled:opacity-60"
                                  disabled={loading}
                                >
                                  Remover
                                </button>
                              </td>
                            </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            </>
          ) : (
            <div className="rounded-2xl border border-dashed border-blue-200 bg-blue-50/40 px-4 py-6 text-sm text-blue-800/80">
              Selecione um plano na lista (clique na linha) ou crie um plano acima para
              gerenciar serviços e clientes.
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
