import { NextRequest, NextResponse } from "next/server";
import { verifyMakeWebhook } from "@/core/workflow-instructions/workflow-instructions-client";

/**
 * `POST /api/workflow-instructions/verify`
 *
 * Checks that a Make.com webhook URL the end-user just saved is reachable, by sending a bare
 * `POST` to it server-side (browsers can't reliably do this themselves — Make.com's webhook
 * responses aren't guaranteed to carry CORS headers). Thin route handler — the actual check
 * lives in `core/workflow-instructions/`.
 */
export async function POST(request: NextRequest) {
  const body = await request.json();
  const webhookUrl = String(body.webhookUrl ?? "").trim();
  const apiKey = String(body.apiKey ?? "").trim();

  if (!webhookUrl || !apiKey) {
    return NextResponse.json({ error: "webhookUrl and apiKey are required" }, { status: 400 });
  }

  try {
    const result = await verifyMakeWebhook(webhookUrl, apiKey);
    return NextResponse.json(result);
  } catch (error) {
    return NextResponse.json(
      { valid: false, error: error instanceof Error ? error.message : "Failed to reach the webhook" },
      { status: 200 },
    );
  }
}
