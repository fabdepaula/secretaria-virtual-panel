/* eslint-disable react/jsx-no-bind */
"use client";

import { useEffect, useMemo, useState, type FormEvent } from "react";
import { formatCnpj, formatCpf, onlyDigits, validateDocumento } from "@/lib/documento";
import { normalizeTipoCliente } from "@/lib/cliente-tipo";
import TableIconActions from "@/app/dashboard/_components/TableIconActions";

type Plano = {
  id: string;
  nome: string;
};

type ContatoOption = {
  id: string;
  nome: string;
};

type ContatoVinculo = {
  contato_id: string;
  cargo: string;
  nome?: string;
};

type EnderecoForm = {
  tipo_endereco: string;
  logradouro: string;
  numero: string;
  complemento: string;
  bairro: string;
  cidade: string;
  estado: string;
  cep: string;
  latitude: string;
  longitude: string;
};

type ClienteRow = {
  id: string;
  tipo_cliente: "PF" | "PJ";
  nome: string;
  nome_fantasia: string | null;
  documento: string | null;
  plano_id: string | null;
  created_at: string;
  updated_at: string | null;
};

type ClienteDetailsData = {
  cliente: ClienteRow;
  enderecos: Array<{
    id: string;
    tipo_endereco: string | null;
    logradouro: string | null;
    numero: string | null;
    complemento: string | null;
    bairro: string | null;
    cidade: string | null;
    estado: string | null;
    cep: string | null;
    latitude: number | null;
    longitude: number | null;
  }>;
  contatos_vinculados: Array<{
    contato_id: string;
    cargo: string;
    nome: string;
  }>;
};

type ClienteDetailsResponse = {
  ok: boolean;
  data: ClienteDetailsData;
};

function emptyEndereco(): EnderecoForm {
  return {
    tipo_endereco: "Residencial",
    logradouro: "",
    numero: "",
    complemento: "",
    bairro: "",
    cidade: "",
    estado: "",
    cep: "",
    latitude: "",
    longitude: "",
  };
}

function tipoClienteLabel(tipo: "PF" | "PJ"): "Física" | "Jurídica" {
  return tipo === "PJ" ? "Jurídica" : "Física";
}

export default function ClientesPage() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [clientes, setClientes] = useState<ClienteRow[]>([]);
  const [planos, setPlanos] = useState<Plano[]>([]);
  const [contatos, setContatos] = useState<ContatoOption[]>([]);

  const [form, setForm] = useState<{
    id?: string;
    tipo_cliente: "PF" | "PJ";
    nome: string;
    nome_fantasia: string;
    documentoDigits: string;
    plano_id: string | null;
    enderecos: EnderecoForm[];
    contatos_vinculados: ContatoVinculo[];
  }>({
    tipo_cliente: "PF",
    nome: "",
    nome_fantasia: "",
    documentoDigits: "",
    plano_id: null,
    enderecos: [emptyEndereco()],
    contatos_vinculados: [],
  });

  const [addContato, setAddContato] = useState<{
    contato_id: string;
    cargo: string;
  }>({ contato_id: "", cargo: "" });

  const [readOnly, setReadOnly] = useState(false);
  const locked = loading || readOnly;

  const documentoMasked = useMemo(() => {
    if (form.tipo_cliente === "PF") return formatCpf(form.documentoDigits);
    return formatCnpj(form.documentoDigits);
  }, [form.documentoDigits, form.tipo_cliente]);

  const contatoOptionsDisponiveis = useMemo(() => {
    const vincIds = new Set(form.contatos_vinculados.map((c) => c.contato_id));
    return contatos.filter((c) => !vincIds.has(c.id));
  }, [contatos, form.contatos_vinculados]);

  useEffect(() => {
    void loadAll();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function loadAll() {
    setLoading(true);
    setError(null);
    try {
      const errors: string[] = [];

      // Carregamento parcial: falha em planos não deve impedir listar clientes/contatos
      const [cRes, pRes, ctRes] = await Promise.all([
        fetch("/api/clientes"),
        fetch("/api/planos"),
        fetch("/api/contatos"),
      ]);

      if (cRes.ok) {
        const cJson = await cRes.json();
        setClientes(cJson.data ?? []);
      } else {
        errors.push("Falha ao carregar clientes");
      }

      if (pRes.ok) {
        const pJson = await pRes.json();
        setPlanos(pJson.data ?? []);
      } else {
        errors.push("Falha ao carregar planos");
      }

      if (ctRes.ok) {
        const ctJson = await ctRes.json();
        setContatos(ctJson.data ?? []);
      } else {
        errors.push("Falha ao carregar contatos");
      }

      if (errors.length) setError(errors[0]);
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Erro";
      setError(msg);
    } finally {
      setLoading(false);
    }
  }

  function resetForm() {
    setForm({
      tipo_cliente: "PF",
      nome: "",
      nome_fantasia: "",
      documentoDigits: "",
      plano_id: planos[0]?.id ?? null,
      enderecos: [emptyEndereco()],
      contatos_vinculados: [],
    });
    setAddContato({ contato_id: "", cargo: "" });
    setReadOnly(false);
  }

  async function startEdit(id: string) {
    setError(null);
    setLoading(true);
    try {
      const res = await fetch(`/api/clientes/${id}`);
      if (!res.ok) throw new Error("Falha ao buscar detalhes do cliente");

      const json: ClienteDetailsResponse = await res.json();
      const d = json.data;

      setForm({
        id: d.cliente.id,
        tipo_cliente: normalizeTipoCliente(d.cliente.tipo_cliente),
        nome: d.cliente.nome,
        nome_fantasia: d.cliente.nome_fantasia ?? "",
        documentoDigits: d.cliente.documento ? onlyDigits(d.cliente.documento) : "",
        plano_id: d.cliente.plano_id ?? null,
        enderecos: (d.enderecos ?? []).map((e) => ({
          tipo_endereco: e.tipo_endereco ?? "",
          logradouro: e.logradouro ?? "",
          numero: e.numero ?? "",
          complemento: e.complemento ?? "",
          bairro: e.bairro ?? "",
          cidade: e.cidade ?? "",
          estado: e.estado ?? "",
          cep: e.cep ?? "",
          latitude: e.latitude === null ? "" : String(e.latitude),
          longitude: e.longitude === null ? "" : String(e.longitude),
        })),
        contatos_vinculados: (d.contatos_vinculados ?? [])
          .map((l) => ({
            contato_id: String(l.contato_id ?? ""),
            cargo: String(l.cargo ?? ""),
            nome: l.nome,
          }))
          .filter((l) => l.contato_id.trim().length > 0),
      });
      setReadOnly(true);
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Erro";
      setError(msg);
    } finally {
      setLoading(false);
    }
  }

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      const documentoDigits = onlyDigits(form.documentoDigits);
      if (documentoDigits && !validateDocumento(form.tipo_cliente, documentoDigits)) {
        throw new Error(
          form.tipo_cliente === "PF"
            ? "Informe um CPF válido (com dígitos verificadores)"
            : "Informe um CNPJ válido (com dígitos verificadores)"
        );
      }
      if (!form.nome.trim()) throw new Error("Nome é obrigatório");

      const payload = {
        tipo_cliente: form.tipo_cliente,
        nome: form.nome.trim(),
        nome_fantasia:
          form.tipo_cliente === "PJ" ? form.nome_fantasia.trim() : null,
        documento: documentoDigits || null,
        plano_id: form.plano_id ?? null,
        enderecos: form.enderecos
          .filter((x) => {
            // Evita inserir endereços totalmente vazios
            return (
              x.logradouro.trim() ||
              x.numero.trim() ||
              x.cep.trim() ||
              x.bairro.trim() ||
              x.cidade.trim()
            );
          })
          .map((x) => ({
            tipo_endereco: x.tipo_endereco.trim(),
            logradouro: x.logradouro.trim(),
            numero: x.numero.trim(),
            complemento: x.complemento.trim(),
            bairro: x.bairro.trim(),
            cidade: x.cidade.trim(),
            estado: x.estado.trim(),
            cep: x.cep.trim(),
            latitude: x.latitude.trim() ? x.latitude.trim() : null,
            longitude: x.longitude.trim() ? x.longitude.trim() : null,
          })),
        contatos_vinculados: form.contatos_vinculados
          .map((l) => ({
            contato_id: String(l.contato_id ?? "").trim(),
            cargo: String(l.cargo ?? "").trim(),
          }))
          .filter((l) => l.contato_id.length > 0),
      };

      const isEdit = Boolean(form.id);
      const url = isEdit ? `/api/clientes/${form.id}` : "/api/clientes";
      const method = isEdit ? "PATCH" : "POST";

      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      if (!res.ok) {
        const txt = await res.text().catch(() => "");
        throw new Error(txt || "Falha ao salvar cliente");
      }

      resetForm();
      await loadAll();
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Erro";
      setError(msg);
    } finally {
      setLoading(false);
    }
  }

  async function onDelete(id: string) {
    const ok = window.confirm("Excluir cliente? Essa ação é irreversível.");
    if (!ok) return;

    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/clientes/${id}`, { method: "DELETE" });
      if (!res.ok) throw new Error("Falha ao excluir cliente");
      resetForm();
      await loadAll();
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Erro";
      setError(msg);
    } finally {
      setLoading(false);
    }
  }

  function addContatoVinculo() {
    if (!addContato.contato_id) {
      setError("Selecione um contato para vincular.");
      return;
    }
    if (!addContato.cargo.trim()) {
      setError("Informe o cargo do contato para este cliente.");
      return;
    }

    const already = form.contatos_vinculados.some(
      (x) => x.contato_id === addContato.contato_id
    );
    if (already) {
      setError("Esse contato já está vinculado a este cliente.");
      return;
    }

    const nome = contatos.find((c) => c.id === addContato.contato_id)?.nome ?? "";

    setForm((p) => ({
      ...p,
      contatos_vinculados: [
        ...p.contatos_vinculados,
        { contato_id: addContato.contato_id, cargo: addContato.cargo.trim(), nome },
      ],
    }));
    setAddContato({ contato_id: "", cargo: "" });
  }

  return (
    <div className="flex flex-col gap-4">
      <div>
        <p className="text-sm text-blue-800/70">
          Cadastro PF/PJ com endereços e contatos vinculados (cargo).{" "}
          <span className="font-medium text-blue-900">Duplo clique</span> na linha
          para consultar; use <span className="font-medium">Habilitar edição</span> para
          alterar.
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
              {loading ? "Atualizando..." : `${clientes.length} cliente(s)`}
            </div>
          </div>

          <div className="mt-3 overflow-x-auto">
            <table className="min-w-full text-left text-sm">
              <thead className="text-xs uppercase text-blue-900/60">
                <tr>
                  <th className="py-2 pr-3">Tipo</th>
                  <th className="py-2 pr-3">Nome</th>
                  <th className="py-2 pr-3">Documento</th>
                  <th className="py-2">Ações</th>
                </tr>
              </thead>
              <tbody>
                {clientes.length === 0 ? (
                  <tr>
                    <td colSpan={4} className="py-4 text-blue-800/70">
                      Nenhum cliente cadastrado.
                    </td>
                  </tr>
                ) : (
                  clientes.map((c) => {
                    const tipo = normalizeTipoCliente(c.tipo_cliente);
                    const masked = !c.documento
                      ? "-"
                      : tipo === "PF"
                        ? formatCpf(c.documento)
                        : formatCnpj(c.documento);
                    return (
                      <tr
                        key={c.id}
                        className={
                          "border-t border-blue-100/70 cursor-pointer transition-colors " +
                          (form.id === c.id
                            ? "bg-blue-100/70 ring-1 ring-inset ring-blue-200"
                            : "hover:bg-blue-50/60")
                        }
                        onDoubleClick={() => void startEdit(c.id)}
                      >
                        <td className="py-2 pr-3 font-medium text-blue-900">
                          {tipoClienteLabel(tipo)}
                        </td>
                        <td className="py-2 pr-3 text-blue-900/90">
                          {tipo === "PJ"
                            ? c.nome_fantasia ?? c.nome
                            : c.nome}
                        </td>
                        <td className="py-2 pr-3 text-blue-800/70">{masked}</td>
                        <td className="py-2">
                          <TableIconActions
                            showEdit={false}
                            onDelete={() => onDelete(c.id)}
                            disabled={loading}
                          />
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>

        <div className="lg:col-span-5 rounded-2xl border border-blue-100 bg-white p-4 min-w-0">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="text-sm font-semibold text-blue-900">
              {!form.id
                ? "Novo cliente"
                : readOnly
                  ? "Consultar cliente"
                  : "Editar cliente"}
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
                    if (form.id) void startEdit(form.id);
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
                  className="text-xs font-semibold text-blue-700 hover:bg-blue-50 rounded-xl border border-blue-100 px-3 py-2 disabled:opacity-60"
                  onClick={() => resetForm()}
                  disabled={loading}
                >
                  Limpar
                </button>
              ) : null}
            </div>
          </div>

          <form className="mt-4 flex flex-col gap-3" onSubmit={onSubmit}>
            <div className="flex gap-2">
              <div className="flex-1 flex flex-col gap-1">
                <label className="text-sm font-medium text-foreground">Tipo</label>
                <select
                  className="h-11 w-full rounded-xl border border-blue-100 px-3 text-foreground outline-none focus:ring-2 focus:ring-blue-200"
                  value={form.tipo_cliente}
                  onChange={(e) => {
                    const next = e.target.value as "PF" | "PJ";
                    setForm((p) => ({ ...p, tipo_cliente: next, nome_fantasia: next === "PJ" ? p.nome_fantasia : "" }));
                  }}
                  disabled={locked}
                >
                  <option value="PF">Física</option>
                  <option value="PJ">Jurídica</option>
                </select>
              </div>
            </div>

            <div className="flex flex-col gap-1">
              <label className="text-sm font-medium text-foreground">Nome</label>
              <input
                className="h-11 w-full rounded-xl border border-blue-100 px-3 text-foreground outline-none focus:ring-2 focus:ring-blue-200"
                value={form.nome}
                onChange={(e) => setForm((p) => ({ ...p, nome: e.target.value }))}
                placeholder={form.tipo_cliente === "PJ" ? "Nome (pessoa/contato)" : "Nome do tutor"}
                disabled={locked}
              />
            </div>

            {form.tipo_cliente === "PJ" ? (
              <div className="flex flex-col gap-1">
                <label className="text-sm font-medium text-foreground">
                  Nome fantasia
                </label>
                <input
                  className="h-11 w-full rounded-xl border border-blue-100 px-3 text-foreground outline-none focus:ring-2 focus:ring-blue-200"
                  value={form.nome_fantasia}
                  onChange={(e) =>
                    setForm((p) => ({ ...p, nome_fantasia: e.target.value }))
                  }
                  placeholder="Nome da clínica"
                  disabled={locked}
                />
              </div>
            ) : null}

            <div className="flex flex-col gap-1">
              <label className="text-sm font-medium text-foreground">
                Documento ({tipoClienteLabel(form.tipo_cliente)})
              </label>
              <input
                inputMode="numeric"
                autoComplete="username"
                className="h-11 w-full rounded-xl border border-blue-100 px-3 text-foreground outline-none focus:ring-2 focus:ring-blue-200"
                value={documentoMasked}
                onChange={(e) => {
                  const digits = onlyDigits(e.target.value);
                  setForm((p) => ({ ...p, documentoDigits: digits }));
                }}
                placeholder={form.tipo_cliente === "PF" ? "000.000.000-00" : "00.000.000/0000-00"}
                disabled={locked}
              />
              <div className="text-xs text-blue-800/70">
                Opcional. Se informado, deve ser um {form.tipo_cliente === "PF" ? "CPF" : "CNPJ"} válido.
              </div>
            </div>

            <div className="flex flex-col gap-1">
              <label className="text-sm font-medium text-foreground">Plano</label>
              <select
                className="h-11 w-full rounded-xl border border-blue-100 px-3 text-foreground outline-none focus:ring-2 focus:ring-blue-200"
                value={form.plano_id ?? ""}
                onChange={(e) => {
                  const v = e.target.value;
                  setForm((p) => ({ ...p, plano_id: v ? v : null }));
                }}
                disabled={locked}
              >
                <option value="">Sem plano</option>
                {planos.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.nome}
                  </option>
                ))}
              </select>
            </div>

            <div className="rounded-xl border border-blue-100 bg-blue-50/40 p-3">
              <div className="text-sm font-semibold text-blue-900">
                Endereço(s)
              </div>
              <div className="mt-2 flex flex-col gap-3">
                {form.enderecos.map((end, idx) => (
                  <div key={idx} className="rounded-xl border border-blue-100 bg-white p-3">
                    <div className="grid grid-cols-1 gap-2">
                      <div className="flex flex-col gap-1">
                        <label className="text-sm font-medium text-foreground">
                          Tipo
                        </label>
                        <input
                          className="h-10 w-full rounded-xl border border-blue-100 px-3 text-foreground outline-none focus:ring-2 focus:ring-blue-200"
                          value={end.tipo_endereco}
                          onChange={(e) => {
                            const v = e.target.value;
                            setForm((p) => ({
                              ...p,
                              enderecos: p.enderecos.map((x, i) =>
                                i === idx ? { ...x, tipo_endereco: v } : x
                              ),
                            }));
                          }}
                          disabled={locked}
                        />
                      </div>

                      <div className="flex flex-col gap-1">
                        <label className="text-sm font-medium text-foreground">
                          Logradouro
                        </label>
                        <input
                          className="h-10 w-full rounded-xl border border-blue-100 px-3 text-foreground outline-none focus:ring-2 focus:ring-blue-200"
                          value={end.logradouro}
                          onChange={(e) => {
                            const v = e.target.value;
                            setForm((p) => ({
                              ...p,
                              enderecos: p.enderecos.map((x, i) =>
                                i === idx ? { ...x, logradouro: v } : x
                              ),
                            }));
                          }}
                          disabled={locked}
                        />
                      </div>

                      <div className="flex gap-2">
                        <div className="flex-1 flex flex-col gap-1">
                          <label className="text-sm font-medium text-foreground">
                            Número
                          </label>
                          <input
                            className="h-10 w-full rounded-xl border border-blue-100 px-3 text-foreground outline-none focus:ring-2 focus:ring-blue-200"
                            value={end.numero}
                            onChange={(e) => {
                              const v = e.target.value;
                              setForm((p) => ({
                                ...p,
                                enderecos: p.enderecos.map((x, i) =>
                                  i === idx ? { ...x, numero: v } : x
                                ),
                              }));
                            }}
                            disabled={locked}
                          />
                        </div>
                        <div className="flex-1 flex flex-col gap-1">
                          <label className="text-sm font-medium text-foreground">
                            CEP
                          </label>
                          <input
                            className="h-10 w-full rounded-xl border border-blue-100 px-3 text-foreground outline-none focus:ring-2 focus:ring-blue-200"
                            value={end.cep}
                            onChange={(e) => {
                              const v = e.target.value;
                              setForm((p) => ({
                                ...p,
                                enderecos: p.enderecos.map((x, i) =>
                                  i === idx ? { ...x, cep: v } : x
                                ),
                              }));
                            }}
                            disabled={locked}
                          />
                        </div>
                      </div>

                      <div className="flex flex-col gap-1">
                        <label className="text-sm font-medium text-foreground">
                          Complemento
                        </label>
                        <input
                          className="h-10 w-full rounded-xl border border-blue-100 px-3 text-foreground outline-none focus:ring-2 focus:ring-blue-200"
                          value={end.complemento}
                          onChange={(e) => {
                            const v = e.target.value;
                            setForm((p) => ({
                              ...p,
                              enderecos: p.enderecos.map((x, i) =>
                                i === idx ? { ...x, complemento: v } : x
                              ),
                            }));
                          }}
                          disabled={locked}
                        />
                      </div>

                      <div className="flex flex-col gap-1">
                        <label className="text-sm font-medium text-foreground">
                          Bairro
                        </label>
                        <input
                          className="h-10 w-full rounded-xl border border-blue-100 px-3 text-foreground outline-none focus:ring-2 focus:ring-blue-200"
                          value={end.bairro}
                          onChange={(e) => {
                            const v = e.target.value;
                            setForm((p) => ({
                              ...p,
                              enderecos: p.enderecos.map((x, i) =>
                                i === idx ? { ...x, bairro: v } : x
                              ),
                            }));
                          }}
                          disabled={locked}
                        />
                      </div>

                      <div className="flex gap-2">
                        <div className="flex-1 flex flex-col gap-1">
                          <label className="text-sm font-medium text-foreground">
                            Cidade
                          </label>
                          <input
                            className="h-10 w-full rounded-xl border border-blue-100 px-3 text-foreground outline-none focus:ring-2 focus:ring-blue-200"
                            value={end.cidade}
                            onChange={(e) => {
                              const v = e.target.value;
                              setForm((p) => ({
                                ...p,
                                enderecos: p.enderecos.map((x, i) =>
                                  i === idx ? { ...x, cidade: v } : x
                                ),
                              }));
                            }}
                            disabled={locked}
                          />
                        </div>
                        <div className="flex-1 flex flex-col gap-1">
                          <label className="text-sm font-medium text-foreground">
                            Estado
                          </label>
                          <input
                            className="h-10 w-full rounded-xl border border-blue-100 px-3 text-foreground outline-none focus:ring-2 focus:ring-blue-200"
                            value={end.estado}
                            onChange={(e) => {
                              const v = e.target.value;
                              setForm((p) => ({
                                ...p,
                                enderecos: p.enderecos.map((x, i) =>
                                  i === idx ? { ...x, estado: v } : x
                                ),
                              }));
                            }}
                            disabled={locked}
                          />
                        </div>
                      </div>

                      <div className="flex gap-2">
                        <div className="flex-1 flex flex-col gap-1">
                          <label className="text-sm font-medium text-foreground">
                            Latitude
                          </label>
                          <input
                            className="h-10 w-full rounded-xl border border-blue-100 px-3 text-foreground outline-none focus:ring-2 focus:ring-blue-200"
                            value={end.latitude}
                            onChange={(e) => {
                              const v = e.target.value;
                              setForm((p) => ({
                                ...p,
                                enderecos: p.enderecos.map((x, i) =>
                                  i === idx ? { ...x, latitude: v } : x
                                ),
                              }));
                            }}
                            disabled={locked}
                          />
                        </div>
                        <div className="flex-1 flex flex-col gap-1">
                          <label className="text-sm font-medium text-foreground">
                            Longitude
                          </label>
                          <input
                            className="h-10 w-full rounded-xl border border-blue-100 px-3 text-foreground outline-none focus:ring-2 focus:ring-blue-200"
                            value={end.longitude}
                            onChange={(e) => {
                              const v = e.target.value;
                              setForm((p) => ({
                                ...p,
                                enderecos: p.enderecos.map((x, i) =>
                                  i === idx ? { ...x, longitude: v } : x
                                ),
                              }));
                            }}
                            disabled={locked}
                          />
                        </div>
                      </div>

                      {form.enderecos.length > 1 ? (
                        <div className="flex justify-end">
                          <button
                            type="button"
                            onClick={() => {
                              setForm((p) => ({
                                ...p,
                                enderecos: p.enderecos.filter((_, i) => i !== idx),
                              }));
                            }}
                            className="text-xs font-semibold text-red-700 hover:bg-red-50 rounded-xl border border-red-100 px-3 py-2 disabled:opacity-60"
                            disabled={locked}
                          >
                            Remover endereço
                          </button>
                        </div>
                      ) : null}
                    </div>
                  </div>
                ))}

                <div className="flex justify-end">
                  <button
                    type="button"
                    onClick={() => {
                      setForm((p) => ({
                        ...p,
                        enderecos: [...p.enderecos, emptyEndereco()],
                      }));
                    }}
                    className="text-xs font-semibold text-blue-700 hover:bg-blue-50 rounded-xl border border-blue-100 px-3 py-2 disabled:opacity-60"
                    disabled={locked}
                  >
                    Adicionar endereço
                  </button>
                </div>
              </div>
            </div>

            <div className="rounded-xl border border-blue-100 bg-blue-50/40 p-3">
              <div className="flex items-center justify-between gap-3">
                <div className="text-sm font-semibold text-blue-900">
                  Contatos vinculados
                </div>
              </div>

              <div className="mt-3 flex flex-col gap-3">
                <div className="flex gap-2">
                  <select
                    className="h-11 flex-1 rounded-xl border border-blue-100 px-3 text-foreground outline-none focus:ring-2 focus:ring-blue-200"
                    value={addContato.contato_id}
                    onChange={(e) =>
                      setAddContato((p) => ({ ...p, contato_id: e.target.value }))
                    }
                    disabled={locked || contatoOptionsDisponiveis.length === 0}
                  >
                    <option value="">
                      {contatoOptionsDisponiveis.length ? "Selecione contato" : "Todos vinculados"}
                    </option>
                    {contatoOptionsDisponiveis.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.nome}
                      </option>
                    ))}
                  </select>

                  <input
                    className="h-11 flex-1 w-full rounded-xl border border-blue-100 px-3 text-foreground outline-none focus:ring-2 focus:ring-blue-200"
                    value={addContato.cargo}
                    onChange={(e) =>
                      setAddContato((p) => ({ ...p, cargo: e.target.value }))
                    }
                    placeholder="Cargo"
                    disabled={locked || contatoOptionsDisponiveis.length === 0}
                  />

                  <button
                    type="button"
                    onClick={addContatoVinculo}
                    className="h-11 rounded-xl bg-blue-600 text-white font-semibold hover:bg-blue-700 disabled:opacity-60 px-3"
                    disabled={locked}
                  >
                    Vincular
                  </button>
                </div>

                {form.contatos_vinculados.length === 0 ? (
                  <div className="text-sm text-blue-800/70">
                    Nenhum contato vinculado a este cliente.
                  </div>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="min-w-full text-left text-sm">
                      <thead className="text-xs uppercase text-blue-900/60">
                        <tr>
                          <th className="py-2 pr-3">Contato</th>
                          <th className="py-2 pr-3">Cargo</th>
                          <th className="py-2">Ações</th>
                        </tr>
                      </thead>
                      <tbody>
                        {form.contatos_vinculados.map((l) => (
                          <tr key={l.contato_id} className="border-t border-blue-100/70">
                            <td className="py-2 pr-3 font-medium text-blue-900">
                              {l.nome ?? contatos.find((c) => c.id === l.contato_id)?.nome ?? ""}
                            </td>
                            <td className="py-2 pr-3">
                              <input
                                className="h-10 w-full rounded-xl border border-blue-100 px-3 text-foreground outline-none focus:ring-2 focus:ring-blue-200"
                                value={l.cargo}
                                onChange={(e) => {
                                  const v = e.target.value;
                                  setForm((p) => ({
                                    ...p,
                                    contatos_vinculados: p.contatos_vinculados.map((x) =>
                                      x.contato_id === l.contato_id
                                        ? { ...x, cargo: v }
                                        : x
                                    ),
                                  }));
                                }}
                                disabled={locked}
                              />
                            </td>
                            <td className="py-2">
                              <button
                                type="button"
                                className="rounded-xl border border-red-100 bg-white px-3 py-1 text-xs font-semibold text-red-700 hover:bg-red-50 disabled:opacity-60"
                                onClick={() => {
                                  setForm((p) => ({
                                    ...p,
                                    contatos_vinculados: p.contatos_vinculados.filter(
                                      (x) => x.contato_id !== l.contato_id
                                    ),
                                  }));
                                }}
                                disabled={locked}
                              >
                                Remover
                              </button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            </div>

            <div className="flex gap-2">
              <button
                type="submit"
                disabled={loading || locked || !form.nome.trim()}
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

