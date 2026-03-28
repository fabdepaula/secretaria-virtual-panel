export function onlyDigits(value: string): string {
  return value.replace(/\D/g, "");
}

export function formatCpf(digits: string): string {
  const d = onlyDigits(digits).slice(0, 11);
  const parts = [
    d.slice(0, 3),
    d.slice(3, 6),
    d.slice(6, 9),
    d.slice(9, 11),
  ].filter(Boolean);

  // Montagem incremental para funcionar bem em digitação.
  if (d.length <= 3) return parts[0] ?? "";
  if (d.length <= 6) return `${parts[0]}.${parts[1] ?? ""}`;
  if (d.length <= 9) return `${parts[0]}.${parts[1] ?? ""}.${parts[2] ?? ""}`;
  return `${parts[0]}.${parts[1] ?? ""}.${parts[2] ?? ""}-${parts[3] ?? ""}`;
}

