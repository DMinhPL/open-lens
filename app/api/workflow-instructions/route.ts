import { NextRequest, NextResponse } from "next/server";
import { submitWorkflowInstruction } from "@/core/workflow-instructions/workflow-instructions-client";

/**
 * `POST /api/workflow-instructions`
 *
 * Accepts a `multipart/form-data` body with `title`, `file`, `webhookUrl`, and `apiKey`
 * fields, then forwards them to the caller-supplied Make.com webhook via
 * {@link submitWorkflowInstruction}. `webhookUrl`/`apiKey` are end-user credentials the
 * client reads from `localStorage` (see `core/workflow-instructions/use-make-settings.ts`)
 * and sends on every request — this route never reads them from the environment. Thin
 * route handler — all webhook logic lives in `core/workflow-instructions/`.
 */
export async function POST(request: NextRequest) {
  const form = await request.formData();
  const title = String(form.get("title") ?? "").trim();
  const file = form.get("file");
  const webhookUrlField = form.get("webhookUrl");
  const apiKeyField = form.get("apiKey");
  const webhookUrl = (typeof webhookUrlField === "string" ? webhookUrlField : "").trim();
  const apiKey = (typeof apiKeyField === "string" ? apiKeyField : "").trim();

  if (!title || !(file instanceof File)) {
    return NextResponse.json({ error: "A title and a file are required" }, { status: 400 });
  }

  if (!webhookUrl || !apiKey) {
    return NextResponse.json(
      { error: "Make.com webhook URL and API key are required — configure them below first" },
      { status: 400 },
    );
  }

  try {
    const result = await submitWorkflowInstruction(title, file, webhookUrl, apiKey);
    return NextResponse.json(result);
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to submit workflow instruction" },
      { status: 500 },
    );
  }
}
