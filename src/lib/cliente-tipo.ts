import { z } from "zod";

/** Aceita "pf", "PJ", etc. e normaliza para o que o banco/API usam. */
export function normalizeTipoCliente(
  raw: string | null | undefined
): "PF" | "PJ" {
  const u = String(raw ?? "")
    .trim()
    .toUpperCase();
  return u === "PJ" ? "PJ" : "PF";
}

/** Schema Zod: aceita PF/PJ em qualquer capitalização vinda do cliente ou do legado no banco. */
export const ClienteTipoSchema = z.preprocess(
  (val) => (typeof val === "string" ? val.trim().toUpperCase() : val),
  z.enum(["PF", "PJ"])
);
