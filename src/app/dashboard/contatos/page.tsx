'use client';

import { useEffect, useState, type FormEvent } from "react";
import { normalizePhones } from "@/lib/phone";
import TableIconActions from "@/app/dashboard/_components/TableIconActions";

type Contato = {
  id: string;
  nome: string;
  created_at: string;
  telefones: string[];
};

export default function ContatosPage() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [contatos, setContatos] = useState<Contato[]>([]);

  const [form, setForm] = useState<{
    id?: string;
    nome: string;
    telefonesRaw: string;
  }>({ nome: "", telefonesRaw: "" });
  const [readOnly, setReadOnly] = useState(false);
  const locked = loading || readOnly;

  useEffect(() => {
    void loadContatos();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function loadContatos() {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/contatos");
      if (!res.ok) throw new Error("Falha ao carregar contatos");
      const json = await res.json();
      setContatos(json.data ?? []);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Erro";
      setError(msg);
    } finally {
      setLoading(false);
    }
  }

  function loadContatoFromRow(c: Contato, edit = false) {
    setForm({
      id: c.id,
      nome: c.nome ?? "",
      telefonesRaw: (c.telefones ?? []).join(", "),
    });
    setReadOnly(!edit);
  }

  function clearPanel() {
    setForm({ nome: "", telefonesRaw: "" });
    setReadOnly(false);
  }

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      const telefones = normalizePhones(form.telefonesRaw);
      const payload = {
        nome: form.nome.trim(),
        telefones,
      };

      const isEdit = Boolean(form.id);
      const res = await fetch(isEdit ? `/api/contatos/${form.id}` : "/api/contatos", {
        method: isEdit ? "PATCH" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      if (!res.ok) {
        throw new Error("Falha ao salvar contato");
      }

      clearPanel();
      await loadContatos();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Erro";
      setError(msg);
    } finally {
      setLoading(false);
    }
  }

  async function onDelete(id: string) {
    const ok = window.confirm("Excluir contato? Essa ação é irreversível.");
    if (!ok) return;

    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/contatos/${id}`, { method: "DELETE" });
      if (!res.ok) throw new Error("Falha ao excluir contato");
      await loadContatos();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Erro";
      setError(msg);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="flex flex-col gap-4">
      <div>
        <p className="text-sm text-blue-800/70">
          <span className="font-medium text-blue-900">Duplo clique</span> na linha
          para consultar. Use <span className="font-medium">Habilitar edição</span>{" "}
          para alterar.
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
              {loading ? "Atualizando..." : `${contatos.length} contato(s)`}
            </div>
          </div>

          <div className="mt-3 overflow-x-auto">
            <table className="min-w-full text-left text-sm">
              <thead className="text-xs uppercase text-blue-900/60">
                <tr>
                  <th className="py-2 pr-3">Nome</th>
                  <th className="py-2 pr-3">Telefones</th>
                  <th className="py-2">Ações</th>
                </tr>
              </thead>
              <tbody>
                {contatos.length === 0 ? (
                  <tr>
                    <td colSpan={3} className="py-4 text-blue-800/70">
                      Nenhum contato cadastrado.
                    </td>
                  </tr>
                ) : (
                  contatos.map((c) => (
                    <tr
                      key={c.id}
                      className={
                        "border-t border-blue-100/70 cursor-pointer transition-colors " +
                        (form.id === c.id
                          ? "bg-blue-100/70 ring-1 ring-inset ring-blue-200"
                          : "hover:bg-blue-50/60")
                      }
                      onDoubleClick={() => loadContatoFromRow(c)}
                    >
                      <td className="py-2 pr-3 font-medium text-blue-900">
                        {c.nome}
                      </td>
                      <td className="py-2 pr-3 text-blue-800/70">
                        {(c.telefones ?? []).join(", ")}
                      </td>
                      <td className="py-2">
                        <TableIconActions
                          showEdit={false}
                          onDelete={() => onDelete(c.id)}
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

        <div className="lg:col-span-5 rounded-2xl border border-blue-100 bg-white p-4 min-w-0">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="text-sm font-semibold text-blue-900">
              {!form.id
                ? "Novo contato"
                : readOnly
                  ? "Consultar contato"
                  : "Editar contato"}
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
                    const c = contatos.find((x) => x.id === form.id);
                    if (c) loadContatoFromRow(c);
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

          <form className="mt-4 flex flex-col gap-3" onSubmit={onSubmit}>
            <div className="flex flex-col gap-1">
              <label className="text-sm font-medium text-foreground" htmlFor="nome">
                Nome
              </label>
              <input
                id="nome"
                className="h-11 rounded-xl border border-blue-100 px-3 text-foreground outline-none focus:ring-2 focus:ring-blue-200"
                value={form.nome}
                onChange={(e) => setForm((p) => ({ ...p, nome: e.target.value }))}
                placeholder="Nome do contato"
                disabled={locked}
              />
            </div>

            <div className="flex flex-col gap-1">
              <label
                className="text-sm font-medium text-foreground"
                htmlFor="telefonesRaw"
              >
                Telefones
              </label>
              <textarea
                id="telefonesRaw"
                className="min-h-[90px] rounded-xl border border-blue-100 px-3 py-2 text-foreground outline-none focus:ring-2 focus:ring-blue-200"
                value={form.telefonesRaw}
                onChange={(e) =>
                  setForm((p) => ({ ...p, telefonesRaw: e.target.value }))
                }
                placeholder="Ex.: 11999999999, 21988888888"
                disabled={locked}
              />
              <div className="text-xs text-blue-800/70">
                Separe por vírgula, espaço ou nova linha. O sistema salva apenas dígitos.
              </div>
            </div>

            <div className="flex gap-2">
              <button
                type="submit"
                disabled={locked || !form.nome.trim()}
                className="flex-1 h-11 rounded-xl bg-blue-600 text-white font-semibold hover:bg-blue-700 disabled:opacity-60"
              >
                {loading ? "Salvando..." : form.id ? "Salvar" : "Criar"}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}

