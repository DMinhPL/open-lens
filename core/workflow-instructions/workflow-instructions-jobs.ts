/**
 * In-memory job store correlating a workflow-instruction submission with the
 * Make.com completion callback (`POST /api/workflow-instructions/callback`).
 * Kept on `globalThis` so the map survives Next.js dev-server module reloads.
 */
import type { WorkflowInstructionJobState } from "@/core/domain/types";

interface JobRecord extends WorkflowInstructionJobState {
  updatedAt: number;
}

type JobStore = Map<string, JobRecord>;

const globalForJobs = globalThis as unknown as { __workflowInstructionJobs?: JobStore };
const store: JobStore = globalForJobs.__workflowInstructionJobs ?? new Map();
globalForJobs.__workflowInstructionJobs = store;

const JOB_TTL_MS = 30 * 60 * 1000;

function purgeExpired() {
  const cutoff = Date.now() - JOB_TTL_MS;
  for (const [id, job] of store) {
    if (job.updatedAt < cutoff) store.delete(id);
  }
}

/** Registers a new job as `pending` before the Make.com webhook is called. */
export function createJob(jobId: string) {
  purgeExpired();
  store.set(jobId, { status: "pending", updatedAt: Date.now() });
}

/**
 * Marks a job `completed`, called from the `/callback` route once Make.com signals success.
 * `extra` carries the generated HTML/tickets/receivers through from the callback payload, when present.
 */
export function completeJob(
  jobId: string,
  message?: string,
  extra?: Pick<WorkflowInstructionJobState, "html" | "tickets" | "receivers">,
) {
  store.set(jobId, { status: "completed", message, ...extra, updatedAt: Date.now() });
}

/** Marks a job `error`, called from the `/callback` route when Make.com signals failure. */
export function failJob(jobId: string, message?: string) {
  store.set(jobId, { status: "error", message, updatedAt: Date.now() });
}

/** Reads the current state of a job, or `undefined` if unknown/expired. */
export function getJob(jobId: string): WorkflowInstructionJobState | undefined {
  const job = store.get(jobId);
  if (!job) return undefined;
  return {
    status: job.status,
    message: job.message,
    html: job.html,
    tickets: job.tickets,
    receivers: job.receivers,
  };
}
