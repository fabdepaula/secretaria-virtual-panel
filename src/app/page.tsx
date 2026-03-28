"use client";

import { useEffect, useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";

export default function Home() {
  const router = useRouter();
  const [login, setLogin] = useState("");
  const [password, setPassword] = useState("");
  const [serverError, setServerError] = useState<string | null>(null);
  const [fieldError, setFieldError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [logoUrl, setLogoUrl] = useState("/logo-placeholder.svg");

  useEffect(() => {
    let active = true;
    async function loadLogo() {
      try {
        const res = await fetch("/api/branding/logo", { cache: "no-store" });
        if (!res.ok) return;
        const json = (await res.json()) as { url?: string };
        if (active && json.url) setLogoUrl(json.url);
      } catch {
        // Sem bloqueio de login se falhar branding.
      }
    }
    void loadLogo();
    return () => {
      active = false;
    };
  }, []);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setServerError(null);
    setFieldError(null);

    const loginTrim = login.trim();
    if (loginTrim.length < 3) {
      setFieldError("Informe o usuário ou e-mail (mínimo 3 caracteres)");
      return;
    }
    if (!password.trim()) {
      setFieldError("Informe a senha");
      return;
    }

    setLoading(true);
    try {
      const res = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          login: loginTrim,
          password,
        }),
      });

      if (!res.ok) {
        const json = (await res.json().catch(() => null)) as {
          message?: string;
          details?: string;
        } | null;
        const msg =
          json?.message ?? json?.details ?? "Usuário ou senha inválidos.";
        setServerError(msg);
        return;
      }

      router.push("/dashboard");
      router.refresh();
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen bg-[#EEF5FF] flex items-center justify-center p-6">
      <div className="w-full max-w-md rounded-2xl border border-[#D7E7FF] bg-white shadow-md p-6">
        <div className="flex flex-col items-center gap-4">
          <div className="h-[220px] w-[220px] rounded-2xl bg-white border border-blue-100 flex items-center justify-center overflow-hidden">
            <img
              src={logoUrl}
              alt="Logo do laboratório"
              className="h-[200px] w-auto object-contain"
            />
          </div>
          <div className="text-center">
            <h1 className="text-xl font-semibold text-[#0B3D63]">
              Secretaria Virtual IA
            </h1>
            <p className="text-sm text-blue-800/80">
              Usuário (login) ou e-mail cadastrado, e senha
            </p>
          </div>
        </div>

        <form className="mt-6 flex flex-col gap-4" onSubmit={onSubmit}>
          <div className="flex flex-col gap-1">
            <label className="text-sm font-medium text-foreground" htmlFor="login">
              Usuário ou e-mail
            </label>
            <input
              id="login"
              autoComplete="username"
              className="h-11 rounded-xl border border-[#D7E7FF] px-3 text-foreground outline-none focus:ring-2 focus:ring-[#0B64C0]/30"
              placeholder="Login ou e-mail"
              value={login}
              onChange={(e) => {
                setLogin(e.target.value);
                setFieldError(null);
              }}
            />
          </div>

          <div className="flex flex-col gap-1">
            <label className="text-sm font-medium text-foreground" htmlFor="password">
              Senha
            </label>
            <input
              id="password"
              type="password"
              autoComplete="current-password"
              className="h-11 rounded-xl border border-[#D7E7FF] px-3 text-foreground outline-none focus:ring-2 focus:ring-[#0B64C0]/30"
              placeholder="Digite sua senha"
              value={password}
              onChange={(e) => {
                setPassword(e.target.value);
                setFieldError(null);
              }}
            />
          </div>

          {fieldError ? (
            <div className="rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-900">
              {fieldError}
            </div>
          ) : null}

          {serverError ? (
            <div className="rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
              {serverError}
            </div>
          ) : null}

          <button
            type="submit"
            disabled={loading}
            className="h-11 rounded-xl bg-[#0B64C0] text-white font-semibold hover:bg-[#0958a7] disabled:opacity-60"
          >
            {loading ? "Entrando..." : "Entrar"}
          </button>
        </form>
      </div>
    </div>
  );
}
