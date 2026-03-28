export function onlyDigits(value: string): string {
  return value.replace(/\D/g, "");
}

export function normalizePhones(raw: string): string[] {
  // Aceita números separados por vírgula, espaço ou quebra de linha.
  const parts = raw
    .split(/[\s,;]+/g)
    .map((p) => onlyDigits(p))
    .filter(Boolean);

  // Remove duplicados preservando ordem
  const seen = new Set<string>();
  const out: string[] = [];
  for (const p of parts) {
    if (!seen.has(p)) {
      seen.add(p);
      out.push(p);
    }
  }
  return out;
}

