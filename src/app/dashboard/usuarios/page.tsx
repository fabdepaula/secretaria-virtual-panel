'use client';

import { useEffect, useMemo, useState, type FormEvent } from "react";
import { KeyRound, Power } from "lucide-react";

type Role = {
  id: string;
  nome: string;
  ativo: boolean;
};

type Permission = {
  id: string;
  chave: string;
  descricao: string | null;
};

type RolePermission = {
  role_id: string;
  permission_id: string;
};

type PanelUser = {
  id: string;
  auth_user_id: string | null;
  nome_completo: string;
  email: string | null;
  login: string;
  cpf: string | null;
  email_interno: string;
  role_id: string;
  role_nome: string;
  ativo: boolean;
  created_at: string;
  updated_at: string | null;
};

type CreateUserForm = {
  nome_completo: string;
  email: string;
  login: string;
  password: string;
  role_id: string;
  ativo: boolean;
};

const emptyUserForm = (): CreateUserForm => ({
  nome_completo: "",
  email: "",
  login: "",
  password: "",
  role_id: "",
  ativo: true,
});

/** Rótulos PT-BR para o primeiro segmento da chave (ex.: planos.read → módulo planos). */
const MODULE_LABELS: Record<string, string> = {
  usuarios: "Usuários do painel",
  contatos: "Contatos",
  clientes: "Clientes",
  servicos: "Serviços",
  planos: "Planos",
};

/** Legado: após migração `panel_permissions_merge_planos.sql`, não deve existir. */
const ACTION_LABELS: Record<string, string> = {
  read: "Consultar",
  create: "Criar",
  update: "Atualizar",
  delete: "Excluir",
};

export default function UsuariosPage() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [roles, setRoles] = useState<Role[]>([]);
  const [permissions, setPermissions] = useState<Permission[]>([]);
  const [rolePermissions, setRolePermissions] = useState<RolePermission[]>([]);
  const [users, setUsers] = useState<PanelUser[]>([]);

  const [selectedRoleId, setSelectedRoleId] = useState<string>("");
  const [selectedPermissionIds, setSelectedPermissionIds] = useState<string[]>([]);
  const [userForm, setUserForm] = useState<CreateUserForm>(emptyUserForm());
  const [logoUrl, setLogoUrl] = useState("/logo-placeholder.svg");
  const [logoFile, setLogoFile] = useState<File | null>(null);

  useEffect(() => {
    void loadAll();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    void loadLogo();
  }, []);

  useEffect(() => {
    if (!selectedRoleId) return;
    const ids = rolePermissions
      .filter((rp) => rp.role_id === selectedRoleId)
      .map((rp) => rp.permission_id);
    setSelectedPermissionIds(ids);
  }, [selectedRoleId, rolePermissions]);

  async function loadAll() {
    setLoading(true);
    setError(null);
    try {
      const [usersRes, metaRes] = await Promise.all([
        fetch("/api/usuarios"),
        fetch("/api/usuarios/meta"),
      ]);

      if (!usersRes.ok) throw new Error("Falha ao carregar usuários");
      if (!metaRes.ok) throw new Error("Falha ao carregar roles/permissões");

      const usersJson = await usersRes.json();
      const metaJson = await metaRes.json();

      setUsers((usersJson.data ?? []) as PanelUser[]);
      setRoles((metaJson.data?.roles ?? []) as Role[]);
      setPermissions((metaJson.data?.permissions ?? []) as Permission[]);
      setRolePermissions((metaJson.data?.role_permissions ?? []) as RolePermission[]);

      const initialRole = (metaJson.data?.roles ?? [])[0]?.id ?? "";
      setSelectedRoleId((prev) => prev || initialRole);
      setUserForm((prev) => ({ ...prev, role_id: prev.role_id || initialRole }));
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Erro";
      setError(msg);
    } finally {
      setLoading(false);
    }
  }

  async function loadLogo() {
    try {
      const res = await fetch("/api/branding/logo", { cache: "no-store" });
      if (!res.ok) return;
      const json = (await res.json()) as { url?: string };
      if (json.url) setLogoUrl(json.url);
    } catch {
      // Não quebra o módulo por falha no branding.
    }
  }

  const permissionsByModule = useMemo(() => {
    const map = new Map<string, Permission[]>();
    for (const p of permissions) {
      if (p.chave.startsWith("plano_servicos.")) continue;
      const [module] = p.chave.split(".");
      const arr = map.get(module) ?? [];
      arr.push(p);
      map.set(module, arr);
    }
    return Array.from(map.entries()).sort(([a], [b]) => a.localeCompare(b));
  }, [permissions]);

  function togglePermission(permissionId: string) {
    setSelectedPermissionIds((prev) => {
      if (prev.includes(permissionId)) {
        return prev.filter((id) => id !== permissionId);
      }
      return [...prev, permissionId];
    });
  }

  async function saveRolePermissions() {
    if (!selectedRoleId) return;

    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/roles/${selectedRoleId}/permissions`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ permission_ids: selectedPermissionIds }),
      });

      if (!res.ok) {
        const txt = await res.text().catch(() => "");
        throw new Error(txt || "Falha ao salvar permissões da role");
      }

      await loadAll();
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Erro";
      setError(msg);
    } finally {
      setLoading(false);
    }
  }

  async function createUser(e: FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);
    try {
      if (!userForm.nome_completo.trim()) throw new Error("Informe o nome completo");
      if (!userForm.login.trim()) throw new Error("Informe o usuário (login)");
      if (!userForm.password || userForm.password.length < 6) {
        throw new Error("Senha deve ter ao menos 6 caracteres");
      }
      if (!userForm.role_id) throw new Error("Selecione uma role");

      const res = await fetch("/api/usuarios", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          nome_completo: userForm.nome_completo.trim(),
          email: userForm.email.trim(),
          login: userForm.login.trim(),
          password: userForm.password,
          role_id: userForm.role_id,
          ativo: userForm.ativo,
        }),
      });

      if (!res.ok) {
        const txt = await res.text().catch(() => "");
        throw new Error(txt || "Falha ao criar usuário");
      }

      setUserForm(emptyUserForm());
      await loadAll();
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Erro";
      setError(msg);
    } finally {
      setLoading(false);
    }
  }

  async function changeRole(userId: string, roleId: string) {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/usuarios/${userId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ role_id: roleId }),
      });
      if (!res.ok) {
        const txt = await res.text().catch(() => "");
        throw new Error(txt || "Falha ao atualizar role do usuário");
      }
      await loadAll();
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Erro";
      setError(msg);
    } finally {
      setLoading(false);
    }
  }

  async function toggleUserStatus(user: PanelUser) {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/usuarios/${user.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ativo: !user.ativo }),
      });
      if (!res.ok) {
        const txt = await res.text().catch(() => "");
        throw new Error(txt || "Falha ao alterar status do usuário");
      }
      await loadAll();
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Erro";
      setError(msg);
    } finally {
      setLoading(false);
    }
  }

  async function resetPassword(user: PanelUser) {
    const label = user.nome_completo?.trim() || user.login || "usuário";
    const pass = window.prompt(`Nova senha para ${label}:`);
    if (!pass) return;
    if (pass.length < 6) {
      setError("Senha deve ter ao menos 6 caracteres");
      return;
    }

    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/usuarios/${user.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ password: pass }),
      });
      if (!res.ok) {
        const txt = await res.text().catch(() => "");
        throw new Error(txt || "Falha ao resetar senha");
      }
      await loadAll();
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Erro";
      setError(msg);
    } finally {
      setLoading(false);
    }
  }

  async function uploadLogo(e: FormEvent) {
    e.preventDefault();
    if (!logoFile) {
      setError("Selecione um arquivo de imagem");
      return;
    }

    setLoading(true);
    setError(null);
    try {
      const form = new FormData();
      form.append("file", logoFile);

      const res = await fetch("/api/branding/logo", {
        method: "POST",
        body: form,
      });

      if (!res.ok) {
        const txt = await res.text().catch(() => "");
        throw new Error(txt || "Falha ao enviar logo");
      }

      const json = (await res.json()) as { url?: string };
      if (json.url) setLogoUrl(json.url);
      setLogoFile(null);
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Erro";
      setError(msg);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="flex flex-col gap-4">
      <div>
        <p className="text-sm text-blue-800/70">
          Crie usuários, altere status e ajuste permissões por role.
        </p>
      </div>

      {error ? (
        <div className="rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
          {error}
        </div>
      ) : null}

      <div className="rounded-2xl border border-blue-100 bg-white p-4">
        <div className="text-sm font-semibold text-blue-900">Logo do laboratório</div>
        <div className="mt-3 flex flex-col md:flex-row gap-4 md:items-center">
          <div className="rounded-xl border border-blue-100 bg-blue-50/40 p-3">
            <img
              src={logoUrl}
              alt="Logo do laboratório"
              className="max-h-[72px] w-auto object-contain"
            />
          </div>
          <form onSubmit={uploadLogo} className="flex flex-col sm:flex-row gap-2 sm:items-center">
            <input
              type="file"
              accept="image/*"
              onChange={(e) => setLogoFile(e.target.files?.[0] ?? null)}
              disabled={loading}
              className="text-sm text-blue-900"
            />
            <button
              type="submit"
              disabled={loading || !logoFile}
              className="h-10 rounded-xl bg-blue-600 text-white px-4 text-sm font-semibold hover:bg-blue-700 disabled:opacity-60"
            >
              {loading ? "Enviando..." : "Atualizar logo"}
            </button>
          </form>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">
        <div className="lg:col-span-7 rounded-2xl border border-blue-100 bg-white p-4 min-w-0">
          <div className="text-sm font-semibold text-blue-900">Usuários</div>

          <div className="mt-3 overflow-x-auto">
            <table className="min-w-full text-left text-sm">
              <thead className="text-xs uppercase text-blue-900/60">
                <tr>
                  <th className="py-2 pr-3">Nome</th>
                  <th className="py-2 pr-3">Usuário</th>
                  <th className="py-2 pr-3">E-mail</th>
                  <th className="py-2 pr-3">Role</th>
                  <th className="py-2 pr-3">Status</th>
                  <th className="py-2">Ações</th>
                </tr>
              </thead>
              <tbody>
                {users.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="py-4 text-blue-800/70">
                      Nenhum usuário cadastrado.
                    </td>
                  </tr>
                ) : (
                  users.map((u) => (
                    <tr key={u.id} className="border-t border-blue-100/70">
                      <td className="py-2 pr-3 font-medium text-blue-900">
                        {u.nome_completo || "—"}
                      </td>
                      <td className="py-2 pr-3 text-blue-800/80 font-mono text-xs">
                        {u.login || "—"}
                      </td>
                      <td className="py-2 pr-3 text-blue-800/70 text-xs break-all max-w-[140px]">
                        {u.email ?? "—"}
                      </td>
                      <td className="py-2 pr-3">
                        <select
                          className="h-9 rounded-xl border border-blue-100 px-2 text-foreground"
                          value={u.role_id}
                          onChange={(e) => void changeRole(u.id, e.target.value)}
                          disabled={loading}
                        >
                          {roles.map((r) => (
                            <option key={r.id} value={r.id}>
                              {r.nome}
                            </option>
                          ))}
                        </select>
                      </td>
                      <td className="py-2 pr-3 text-blue-800/70">
                        {u.ativo ? "Ativo" : "Inativo"}
                      </td>
                      <td className="py-2">
                        <div className="flex flex-wrap items-center gap-1">
                          <button
                            type="button"
                            onClick={() => void toggleUserStatus(u)}
                            className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border border-blue-100 bg-white text-blue-700 hover:bg-blue-50 disabled:opacity-60"
                            disabled={loading}
                            title={u.ativo ? "Desativar" : "Ativar"}
                            aria-label={
                              u.ativo ? "Desativar usuário" : "Ativar usuário"
                            }
                          >
                            <Power className="h-4 w-4" strokeWidth={2} aria-hidden />
                          </button>
                          <button
                            type="button"
                            onClick={() => void resetPassword(u)}
                            className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border border-amber-100 bg-white text-amber-700 hover:bg-amber-50 disabled:opacity-60"
                            disabled={loading}
                            title="Redefinir senha"
                            aria-label="Redefinir senha"
                          >
                            <KeyRound className="h-4 w-4" strokeWidth={2} aria-hidden />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>

        <div className="lg:col-span-5 rounded-2xl border border-blue-100 bg-white p-4 min-w-0">
          <div className="text-sm font-semibold text-blue-900">Novo usuário</div>
          <form className="mt-3 flex flex-col gap-3" onSubmit={createUser}>
            <div className="flex flex-col gap-1">
              <label className="text-sm font-medium text-foreground">
                Nome completo
              </label>
              <input
                className="h-11 w-full rounded-xl border border-blue-100 px-3 text-foreground outline-none focus:ring-2 focus:ring-blue-200"
                value={userForm.nome_completo}
                onChange={(e) =>
                  setUserForm((p) => ({ ...p, nome_completo: e.target.value }))
                }
                disabled={loading}
                placeholder="Nome do usuário"
                autoComplete="name"
              />
            </div>
            <div className="flex flex-col gap-1">
              <label className="text-sm font-medium text-foreground">
                E-mail <span className="font-normal text-blue-800/60">(opcional)</span>
              </label>
              <input
                type="email"
                className="h-11 w-full rounded-xl border border-blue-100 px-3 text-foreground outline-none focus:ring-2 focus:ring-blue-200"
                value={userForm.email}
                onChange={(e) =>
                  setUserForm((p) => ({ ...p, email: e.target.value }))
                }
                disabled={loading}
                placeholder="nome@empresa.com"
                autoComplete="email"
              />
              <p className="text-xs text-blue-800/70">
                Informativo, só para referência. O login no painel usa{" "}
                <span className="font-mono">usuário@painel.local</span> (definido pelo
                campo usuário).
              </p>
            </div>
            <div className="flex flex-col gap-1">
              <label className="text-sm font-medium text-foreground">
                Usuário (login único)
              </label>
              <input
                className="h-11 w-full rounded-xl border border-blue-100 px-3 text-foreground outline-none focus:ring-2 focus:ring-blue-200"
                value={userForm.login}
                onChange={(e) =>
                  setUserForm((p) => ({
                    ...p,
                    login: e.target.value.toLowerCase(),
                  }))
                }
                disabled={loading}
                placeholder="ex.: maria.silva"
                autoComplete="username"
              />
              <p className="text-xs text-blue-800/70">
                Letras, números, ponto, hífen e sublinhado (3–50 caracteres).
              </p>
            </div>
            <div className="flex flex-col gap-1">
              <label className="text-sm font-medium text-foreground">Senha</label>
              <input
                type="password"
                className="h-11 w-full rounded-xl border border-blue-100 px-3 text-foreground outline-none focus:ring-2 focus:ring-blue-200"
                value={userForm.password}
                onChange={(e) =>
                  setUserForm((p) => ({ ...p, password: e.target.value }))
                }
                disabled={loading}
                placeholder="Mínimo 6 caracteres"
              />
            </div>
            <div className="flex flex-col gap-1">
              <label className="text-sm font-medium text-foreground">Role</label>
              <select
                className="h-11 w-full rounded-xl border border-blue-100 px-3 text-foreground outline-none focus:ring-2 focus:ring-blue-200"
                value={userForm.role_id}
                onChange={(e) =>
                  setUserForm((p) => ({ ...p, role_id: e.target.value }))
                }
                disabled={loading}
              >
                <option value="">Selecione...</option>
                {roles.map((r) => (
                  <option key={r.id} value={r.id}>
                    {r.nome}
                  </option>
                ))}
              </select>
            </div>
            <label className="flex items-center gap-2 text-sm font-medium text-foreground">
              <input
                type="checkbox"
                checked={userForm.ativo}
                onChange={(e) =>
                  setUserForm((p) => ({ ...p, ativo: e.target.checked }))
                }
                disabled={loading}
              />
              Usuário ativo
            </label>
            <button
              type="submit"
              disabled={
                loading ||
                !userForm.nome_completo.trim() ||
                !userForm.login.trim() ||
                userForm.password.length < 6 ||
                !userForm.role_id
              }
              className="h-11 rounded-xl bg-blue-600 text-white font-semibold hover:bg-blue-700 disabled:opacity-60"
            >
              {loading ? "Salvando..." : "Criar usuário"}
            </button>
          </form>
        </div>
      </div>

      <div className="rounded-2xl border border-blue-100 bg-white p-4">
        <div className="flex items-center gap-3">
          <div className="text-sm font-semibold text-blue-900">Permissões por role</div>
          <select
            className="h-10 rounded-xl border border-blue-100 px-3 text-sm text-foreground"
            value={selectedRoleId}
            onChange={(e) => setSelectedRoleId(e.target.value)}
            disabled={loading}
          >
            {roles.map((r) => (
              <option key={r.id} value={r.id}>
                {r.nome}
              </option>
            ))}
          </select>
          <button
            type="button"
            onClick={() => void saveRolePermissions()}
            disabled={loading || !selectedRoleId}
            className="h-10 rounded-xl bg-blue-600 text-white px-4 text-sm font-semibold hover:bg-blue-700 disabled:opacity-60"
          >
            Salvar permissões
          </button>
        </div>

        <div className="mt-4 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {permissionsByModule.map(([module, perms]) => (
            <div key={module} className="rounded-xl border border-blue-100 p-3">
              <div className="text-sm font-semibold text-blue-900">
                {MODULE_LABELS[module] ?? module}
              </div>
              <div className="mt-2 flex flex-col gap-2">
                {perms
                  .slice()
                  .sort((a, b) => a.chave.localeCompare(b.chave))
                  .map((p) => {
                    const action = p.chave.split(".")[1] ?? "";
                    return (
                    <label
                      key={p.id}
                      className="flex items-center gap-2 text-sm text-blue-900/90"
                    >
                      <input
                        type="checkbox"
                        checked={selectedPermissionIds.includes(p.id)}
                        onChange={() => togglePermission(p.id)}
                        disabled={loading || !selectedRoleId}
                      />
                      <span title={p.chave}>
                        {ACTION_LABELS[action] ?? action}
                      </span>
                    </label>
                    );
                  })}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

