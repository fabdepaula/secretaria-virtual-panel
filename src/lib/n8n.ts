type EmbeddingTriggerPayload = {
  service_id: string;
  embedding_text: string;
  event: "created" | "updated";
  triggered_at: string;
};

export async function triggerEmbeddingWorkflow(
  payload: EmbeddingTriggerPayload
): Promise<{ ok: boolean; reason?: string }> {
  const webhookUrl =
    process.env.N8N_EMBEDDING_WEBHOOK_URL ||
    "https://n8n.fpsoftware.cloud/webhook/embedding_por_servico";
  if (!webhookUrl) {
    return { ok: false, reason: "N8N_EMBEDDING_WEBHOOK_URL não configurada" };
  }

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 8000);

  try {
    const res = await fetch(webhookUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        id: payload.service_id,
        embedding_text: payload.embedding_text,
      }),
      signal: controller.signal,
      cache: "no-store",
    });

    if (!res.ok) {
      return { ok: false, reason: `Webhook retornou ${res.status}` };
    }

    return { ok: true };
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return { ok: false, reason: msg };
  } finally {
    clearTimeout(timeout);
  }
}

