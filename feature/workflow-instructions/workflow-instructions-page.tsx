"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { AlertTriangle, FileText, Loader2, Sparkles, UploadCloud, X } from "lucide-react";
import { cn } from "@/core/utils";
import type { WorkflowInstructionJobState } from "@/core/domain/types";
import { useMakeSettings } from "@/core/workflow-instructions/use-make-settings";

const POLL_INTERVAL_MS = 2000;
const MAX_WAIT_MS = 10 * 60 * 1000;

const DOCX_MIME_TYPE = "application/vnd.openxmlformats-officedocument.wordprocessingml.document";

function isDocxFile(file: File): boolean {
  return file.name.toLowerCase().endsWith(".docx") || file.type === DOCX_MIME_TYPE;
}

/**
 * Polls `GET /api/workflow-instructions/callback?jobId=...` until the Make.com scenario's
 * completion callback has flipped the job to `completed`/`error`, or `MAX_WAIT_MS` elapses.
 */
async function waitForJobCompletion(jobId: string, signal: AbortSignal): Promise<WorkflowInstructionJobState> {
  const deadline = Date.now() + MAX_WAIT_MS;

  while (Date.now() < deadline) {
    if (signal.aborted) return { status: "error", message: "Cancelled" };

    try {
      const res = await fetch(`/api/workflow-instructions/callback?jobId=${jobId}`, { signal });
      if (res.ok) {
        const job = (await res.json()) as WorkflowInstructionJobState;
        if (job.status !== "pending") return job;
      }
    } catch {
      if (signal.aborted) return { status: "error", message: "Cancelled" };
    }

    await new Promise((resolve) => setTimeout(resolve, POLL_INTERVAL_MS));
  }

  return { status: "error", message: "Timed out waiting for tasks to be generated" };
}

/**
 * Lets a PM submit a meeting transcript (title + file) to the project's Make.com
 * scenario via `POST /api/workflow-instructions`, which parses the transcript and
 * automatically generates the resulting tasks/tickets — removing the manual step of
 * writing them up by hand after a meeting. Follows the same client-fetch + `sonner`
 * toast pattern as `feature/settings/settings-page.tsx`. The Make.com webhook URL/API key
 * are configured on the Settings page (`feature/settings/settings-page.tsx`) — this page
 * only reads them via `useMakeSettings()` and prompts the user to go configure them if missing.
 */
export default function WorkflowInstructionsPage() {
  const [title, setTitle] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [dragging, setDragging] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const abortControllerRef = useRef<AbortController | null>(null);
  const make = useMakeSettings();

  useEffect(() => {
    return () => abortControllerRef.current?.abort();
  }, []);

  function handleFileDrop(e: React.DragEvent<HTMLButtonElement>) {
    e.preventDefault();
    setDragging(false);
    const dropped = e.dataTransfer.files?.[0];
    if (!dropped) return;
    if (!isDocxFile(dropped)) {
      toast.error("Only .docx files are supported");
      return;
    }
    setFile(dropped);
  }

  async function handleSubmit(e: React.SyntheticEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!title || !file) {
      toast.error("A title and a meeting transcript file are required");
      return;
    }
    if (!make.hasCredentials) {
      toast.error("Configure your Make.com webhook URL and API key in Settings first");
      return;
    }

    const controller = new AbortController();
    abortControllerRef.current = controller;

    setSubmitting(true);
    try {
      const form = new FormData();
      form.append("title", title);
      form.append("file", file);
      form.append("webhookUrl", make.webhookUrl);
      form.append("apiKey", make.apiKey);

      const res = await fetch("/api/workflow-instructions", { method: "POST", body: form });
      const data = await res.json();
      if (!res.ok) {
        toast.error(data.error ?? "Failed to submit meeting transcript");
        return;
      }

      toast.info("Transcript submitted — generating tasks…");

      const job = await waitForJobCompletion(data.jobId, controller.signal);
      if (job.status === "error") {
        toast.error(job.message ?? "Failed to generate tasks");
        return;
      }

      toast.success(job.message ?? "Tasks generated successfully");
      setTitle("");
      setFile(null);
      if (fileInputRef.current) fileInputRef.current.value = "";
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="flex min-h-[calc(100vh-8rem)] flex-col items-center justify-center gap-4 py-8">
      {!make.hasCredentials && (
        <Card className="w-full max-w-lg border-amber-500/50 bg-amber-500/5">
          <CardContent className="flex items-start gap-3 py-4">
            <AlertTriangle className="mt-0.5 size-5 shrink-0 text-amber-600" />
            <div className="flex flex-col gap-1">
              <p className="text-sm font-medium">Make.com isn&apos;t configured yet</p>
              <p className="text-sm text-muted-foreground">
                Save your webhook URL and API key on the{" "}
                <Link href="/settings" className="font-medium underline underline-offset-2">
                  Settings
                </Link>{" "}
                page before you can generate tasks.
              </p>
            </div>
          </CardContent>
        </Card>
      )}

      <Card className="w-full max-w-lg overflow-visible ring-1 ring-foreground/10 shadow-lg shadow-primary/5">
        <CardHeader className="items-center gap-3 text-center">
          <div className="flex size-12 items-center justify-center rounded-2xl bg-linear-to-br from-primary to-primary/60 text-primary-foreground shadow-md shadow-primary/30">
            <Sparkles className="size-6" />
          </div>
          <CardTitle className="text-lg font-semibold">Generate tasks from a meeting</CardTitle>
          <CardDescription className="text-balance">
            Upload a meeting transcript and Make.com will automatically create the resulting tasks/tickets — no
            manual write-up needed.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form className="flex flex-col gap-5" onSubmit={handleSubmit}>
            <div className="flex flex-col gap-2">
              <Label htmlFor="workflowTitle">Meeting title</Label>
              <Input
                id="workflowTitle"
                placeholder="e.g. Sprint Planning – Jul 29"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
              />
            </div>

            <div className="flex flex-col gap-2">
              <Label htmlFor="workflowFile">Meeting transcript</Label>
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                onDragOver={(e) => {
                  e.preventDefault();
                  setDragging(true);
                }}
                onDragLeave={() => setDragging(false)}
                onDrop={handleFileDrop}
                className={cn(
                  "flex flex-col items-center gap-2 rounded-xl border-2 border-dashed px-4 py-8 text-center transition-colors",
                  dragging
                    ? "border-primary bg-primary/5"
                    : "border-input hover:border-primary/50 hover:bg-muted/50",
                )}
              >
                <UploadCloud className="size-6 text-muted-foreground" />
                <p className="text-sm font-medium">Drag & drop, or click to browse</p>
                <p className="text-xs text-muted-foreground">Transcript file (.docx)</p>
              </button>
              <Input
                id="workflowFile"
                type="file"
                accept=".docx,application/vnd.openxmlformats-officedocument.wordprocessingml.document"
                ref={fileInputRef}
                className="hidden"
                onChange={(e) => {
                  const selected = e.target.files?.[0] ?? null;
                  if (selected && !isDocxFile(selected)) {
                    toast.error("Only .docx files are supported");
                    e.target.value = "";
                    setFile(null);
                    return;
                  }
                  setFile(selected);
                }}
              />

              {file && (
                <div className="flex items-center gap-2 rounded-lg border bg-muted/50 px-3 py-2">
                  <FileText className="size-4 shrink-0 text-muted-foreground" />
                  <span className="min-w-0 flex-1 truncate text-sm">{file.name}</span>
                  <button
                    type="button"
                    aria-label="Remove file"
                    onClick={() => {
                      setFile(null);
                      if (fileInputRef.current) fileInputRef.current.value = "";
                    }}
                    className="rounded-md p-1 text-muted-foreground hover:bg-muted hover:text-foreground"
                  >
                    <X className="size-3.5" />
                  </button>
                </div>
              )}
            </div>

            <Button type="submit" size="lg" disabled={submitting || !make.hasCredentials} className="w-full">
              {submitting ? (
                <>
                  <Loader2 className="size-4 animate-spin" /> Submitting…
                </>
              ) : (
                <>
                  <Sparkles className="size-4" /> Generate tasks
                </>
              )}
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
