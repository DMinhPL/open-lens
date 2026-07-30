import { NextRequest, NextResponse } from "next/server";
import { completeJob, failJob, getJob } from "@/core/workflow-instructions/workflow-instructions-jobs";
import type { WorkflowInstructionTicket } from "@/core/domain/types";

/**
 * `POST /api/workflow-instructions/callback`
 *
 * Called by the Make.com scenario once it has actually finished generating tasks from a
 * submitted transcript. The scenario must echo back the `jobId` it received as a form field
 * in the original webhook call (see `postWorkflowInstruction`) so this callback can be
 * correlated to the submission that's being polled by the client.
 */
export async function POST(request: NextRequest) {
  try {
    const data = await request.json();
    const { jobId, message, success, html, tickets, receivers } = data as {
      jobId?: string;
      message?: string;
      success?: boolean;
      html?: string;
      tickets?: WorkflowInstructionTicket[];
      receivers?: string[];
    };

    if (jobId) {
      if (success === false) {
        failJob(jobId, message);
      } else {
        completeJob(jobId, message, { html, tickets, receivers });
      }
    }

    return NextResponse.json({ success: true, message: message ?? "Callback processed successfully" });
  } catch (error) {
    console.error("Callback processing error:", error);
    return NextResponse.json({ error: "Failed to process callback" }, { status: 500 });
  }
}

/**
 * `GET /api/workflow-instructions/callback?jobId=...`
 *
 * Polled by the client while the loading state is active, to detect once the `POST` above has
 * marked the job `completed`/`error`.
 */
export async function GET(request: NextRequest) {
  const jobId = request.nextUrl.searchParams.get("jobId");
  if (!jobId) {
    return NextResponse.json({ error: "jobId is required" }, { status: 400 });
  }

  const job = getJob(jobId);
  if (!job) {
    return NextResponse.json({ error: "Unknown jobId" }, { status: 404 });
  }

  return NextResponse.json(job);
}