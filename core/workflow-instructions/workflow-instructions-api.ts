/**
 * REAL Make.com webhook implementation. Posts a workflow instruction (title + file)
 * to the configured Make.com scenario webhook as `multipart/form-data`, mirroring
 * `core/openproject/openproject-api.ts`'s role as the single point of contact for
 * the live external call.
 */
import type { WorkflowInstructionSubmission } from "@/core/domain/types";

/**
 * Posts a workflow instruction to a Make.com webhook.
 *
 * Builds the same `multipart/form-data` shape Make.com's "Custom webhook" trigger
 * expects (a `title` field plus a file field, here named `prompt` to match the
 * scenario's existing mapping) and authenticates with both headers Make.com accepts
 * for a webhook API key — `x-make-apikey` and HTTP Basic (`apikey:<token>`) — so the
 * scenario works regardless of which auth method its webhook is configured to check.
 *
 * @param webhookUrl - Make.com scenario webhook URL (`MAKE_WEBHOOK_URL`).
 * @param apiKey - Make.com webhook API key (`MAKE_API_KEY`).
 * @param title - Human-readable title for the workflow instruction.
 * @param file - The instruction document to submit (e.g. a `.docx`/`.txt` file).
 * @param jobId - Correlation id the scenario must echo back to
 * `POST /api/workflow-instructions/callback` once it finishes, so the client knows when
 * the generated tasks are actually ready instead of just that the webhook accepted the file.
 * @throws {Error} If the webhook responds with a non-2xx status.
 */
export async function postWorkflowInstruction(
  webhookUrl: string,
  apiKey: string,
  title: string,
  file: File,
  jobId: string,
): Promise<WorkflowInstructionSubmission> {
  const auth = Buffer.from(`apikey:${apiKey}`).toString("base64");
  const form = new FormData();
  form.append("title", title);
  form.append("prompt", file, file.name);
  form.append("jobId", jobId);

  const res = await fetch(webhookUrl, {
    method: "POST",
    headers: {
      "x-make-apikey": apiKey,
      Authorization: `Basic ${auth}`,
    },
    body: form,
  });

  if (!res.ok) {
    throw new Error(`Make.com webhook request failed: ${res.status} ${res.statusText}`);
  }

  return { ok: true, status: res.status, jobId };
}

/**
 * Checks that a Make.com webhook URL + API key are valid, the same way {@link postWorkflowInstruction}
 * authenticates (`x-make-apikey` header + HTTP Basic), but without a `title`/`prompt`/`jobId`
 * payload — just enough for Make's "Custom webhook" trigger to accept the request.
 *
 * @param webhookUrl - Make.com scenario webhook URL to check.
 * @param apiKey - Make.com webhook API key to check.
 * @returns `valid: true` only when the webhook responds with exactly `200 OK`.
 */
export async function verifyWorkflowInstructionWebhook(
  webhookUrl: string,
  apiKey: string,
): Promise<{ valid: boolean; status: number }> {
  const auth = Buffer.from(`apikey:${apiKey}`).toString("base64");

  const res = await fetch(webhookUrl, {
    method: "POST",
    headers: {
      "x-make-apikey": apiKey,
      Authorization: `Basic ${auth}`,
    },
  });

  return { valid: res.status === 200, status: res.status };
}
