/**
 * Public facade for submitting workflow instructions to Make.com. The webhook URL and API
 * key are end-user credentials managed client-side (see `core/workflow-instructions/use-make-settings.ts`)
 * rather than server env vars, so they arrive as parameters from the route handler instead of
 * being resolved from `process.env` here. Delegates the actual HTTP call to
 * `workflow-instructions-api.ts`, mirroring the dispatcher role `core/openproject/openproject-client.ts`
 * plays for OpenProject.
 */
import { randomUUID } from "node:crypto";
import type { WorkflowInstructionSubmission } from "@/core/domain/types";
import { postWorkflowInstruction, verifyWorkflowInstructionWebhook } from "./workflow-instructions-api";
import { createJob } from "./workflow-instructions-jobs";

/**
 * Submits a workflow instruction (title + file) to the given Make.com webhook.
 *
 * @param title - Human-readable title for the workflow instruction.
 * @param file - The instruction document to submit.
 * @param webhookUrl - End-user's Make.com scenario webhook URL.
 * @param apiKey - End-user's Make.com webhook API key.
 */
export async function submitWorkflowInstruction(
  title: string,
  file: File,
  webhookUrl: string,
  apiKey: string,
): Promise<WorkflowInstructionSubmission> {
  const jobId = randomUUID();
  createJob(jobId);

  return postWorkflowInstruction(webhookUrl, apiKey, title, file, jobId);
}

/**
 * Checks that a given Make.com webhook URL + API key are valid, for the "verify connection"
 * action on the Settings page right after the user saves their credentials.
 *
 * @param webhookUrl - End-user's Make.com scenario webhook URL to check.
 * @param apiKey - End-user's Make.com webhook API key to check.
 */
export async function verifyMakeWebhook(
  webhookUrl: string,
  apiKey: string,
): Promise<{ valid: boolean; status: number }> {
  return verifyWorkflowInstructionWebhook(webhookUrl, apiKey);
}
