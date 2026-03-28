/** Domínio sintético para o e-mail no Supabase Auth (mesmo padrão do legado com CPF). */
export const PAINEL_EMAIL_DOMAIN = "painel.local";

/** Normaliza o login para armazenamento e busca (minúsculas, sem espaços nas pontas). */
export function normalizeLogin(raw: string): string {
  return raw.trim().toLowerCase();
}

/** E-mail usado no Auth: `{login}@painel.local` — não é o e-mail de contato do cadastro. */
export function emailInternoFromLogin(loginNormalized: string): string {
  return `${normalizeLogin(loginNormalized)}@${PAINEL_EMAIL_DOMAIN}`;
}

/**
 * Login único: letras, números, ponto, hífen e sublinhado; 3–50 caracteres.
 * Permite logins legados só numéricos (ex.: CPF antigo).
 */
export function isValidLogin(login: string): boolean {
  const s = normalizeLogin(login);
  if (s.length < 3 || s.length > 50) return false;
  return /^[a-z0-9._-]+$/.test(s);
}
