"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { toast } from "sonner";
import {
  AlertTriangle,
  CalendarClock,
  ClipboardList,
  FileText,
  Lightbulb,
  Loader2,
  Send,
  Sparkles,
  UploadCloud,
  User,
  X,
} from "lucide-react";
import { cn } from "@/core/utils";
import type { WorkflowInstructionJobState } from "@/core/domain/types";
import { useMakeSettings } from "@/core/workflow-instructions/use-make-settings";
import { useWorkflowInstructionTickets } from "@/core/workflow-instructions/use-workflow-instruction-tickets";

const POLL_INTERVAL_MS = 2000;  // 2 seconds
const MAX_WAIT_MS = 10 * 60 * 1000; // 10 minutes

const DOCX_MIME_TYPE = "application/vnd.openxmlformats-officedocument.wordprocessingml.document";

function isDocxFile(file: File): boolean {
  return file.name.toLowerCase().endsWith(".docx") || file.type === DOCX_MIME_TYPE;
}

/**
 * Polls `GET /api/workflow-instructions/callback?jobId=...` until the Make.com scenario's
 * completion callback has flipped the job to `completed`/`error`, or `MAX_WAIT_MS` elapses.
 * On success the resolved job also carries the generated `html`/`tickets`/`receivers`, which
 * the caller hands off to `useWorkflowInstructionTickets().setFromJob`.
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
  const { tickets, receivers, setFromJob, updateTicket, submitTickets } = useWorkflowInstructionTickets();
  const [selectedTicketIndex, setSelectedTicketIndex] = useState<number | null>(null);
  const selectedTicket = selectedTicketIndex !== null ? tickets[selectedTicketIndex] : null;

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

      setFromJob(job);
      toast.success(job.message ?? "Tasks generated successfully");
      setTitle("");
      setFile(null);
      if (fileInputRef.current) fileInputRef.current.value = "";
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="flex h-[calc(100vh-8rem)] items-start gap-4">
      <div className="flex w-full max-w-xl shrink-0 flex-col gap-4">
        {!make.hasCredentials && (
          <Card className="w-full border-amber-500/50 bg-amber-500/5">
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

        <Card className="w-full overflow-visible ring-1 ring-foreground/10 shadow-lg shadow-primary/5">
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

      {tickets.length > 0 && (
        <Card className="flex h-full min-w-0 flex-1 flex-col ring-1 ring-foreground/10">
          <CardHeader>
            <CardTitle className="text-base font-semibold">Generated tickets</CardTitle>
            <CardDescription>Click a ticket to review or edit it, then submit the whole list.</CardDescription>
          </CardHeader>
          <CardContent className="flex min-h-0 flex-1 flex-col gap-2 overflow-y-auto">
            {tickets.map((ticket, index) => (
              <button
                key={`ticket-${index.toString()}`}
                type="button"
                onClick={() => setSelectedTicketIndex(index)}
                className="flex flex-col gap-1 rounded-lg border px-3 py-2 text-left transition-colors hover:border-primary/50 hover:bg-muted/50"
              >
                <span className="font-medium">{ticket.title}</span>
                <span className="line-clamp-2 text-sm text-muted-foreground">{ticket.description}</span>
                <Badge variant="outline" className="w-fit">
                  {ticket.assignedTo}
                </Badge>
              </button>
            ))}
          </CardContent>
          <CardFooter>
            <Button type="button" className="w-full" onClick={submitTickets}>
              <Send className="size-4" /> Submit {tickets.length} ticket{tickets.length === 1 ? "" : "s"}
            </Button>
          </CardFooter>
        </Card>
      )}

      <Dialog open={selectedTicket !== null} onOpenChange={(open) => !open && setSelectedTicketIndex(null)}>
        <DialogContent className="max-w-xl sm:max-w-xl pt-10">
          {selectedTicket && selectedTicketIndex !== null && (
            <>
              <DialogHeader className="gap-3">
                <div className="flex items-start gap-3">
                  <div className="mt-0.5 flex size-9 shrink-0 items-center justify-center rounded-xl bg-linear-to-br from-primary to-primary/60 text-primary-foreground shadow-sm shadow-primary/30">
                    <Sparkles className="size-4.5" />
                  </div>
                  <div className="flex min-w-0 flex-1 flex-col gap-1">
                    <DialogTitle className="sr-only">Edit ticket</DialogTitle>
                    <Input
                      value={selectedTicket.title}
                      onChange={(e) => updateTicket(selectedTicketIndex, { title: e.target.value })}
                      className="h-auto border-none bg-transparent font-heading text-base font-semibold shadow-none focus-visible:ring-0"
                      placeholder="Ticket title"
                    />
                    <DialogDescription>
                      Changes are local until you submit the full list from the tickets panel.
                    </DialogDescription>
                  </div>
                </div>
              </DialogHeader>

              <div className="flex max-h-[60vh] flex-col gap-4 overflow-y-auto py-1 pr-1">
                <div className="flex flex-col gap-2">
                  <Label htmlFor="ticketDescription" className="flex items-center gap-1.5 text-muted-foreground">
                    <ClipboardList className="size-3.5" /> Description
                  </Label>
                  <Textarea
                    id="ticketDescription"
                    value={selectedTicket.description}
                    onChange={(e) => updateTicket(selectedTicketIndex, { description: e.target.value })}
                    className="min-h-20"
                  />
                </div>

                <div className="flex flex-col gap-2">
                  <Label htmlFor="ticketSolution" className="flex items-center gap-1.5 text-muted-foreground">
                    <Lightbulb className="size-3.5" /> Proposed solution
                  </Label>
                  <Textarea
                    id="ticketSolution"
                    value={selectedTicket.solution}
                    onChange={(e) => updateTicket(selectedTicketIndex, { solution: e.target.value })}
                    className="min-h-20"
                  />
                </div>

                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                  <div className="flex flex-col gap-2">
                    <Label htmlFor="ticketAssignedTo" className="flex items-center gap-1.5 text-muted-foreground">
                      <User className="size-3.5" /> Assigned to
                    </Label>
                    <Select
                      value={selectedTicket.assignedTo}
                      onValueChange={(value) => updateTicket(selectedTicketIndex, { assignedTo: value })}
                    >
                      <SelectTrigger id="ticketAssignedTo" className="w-full">
                        <SelectValue placeholder="Select a receiver" />
                      </SelectTrigger>
                      <SelectContent>
                        {(receivers.includes(selectedTicket.assignedTo)
                          ? receivers
                          : [selectedTicket.assignedTo, ...receivers]
                        ).map((receiver) => (
                          <SelectItem key={receiver} value={receiver}>
                            {receiver}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="flex flex-col gap-2">
                    <Label htmlFor="ticketDeadline" className="flex items-center gap-1.5 text-muted-foreground">
                      <CalendarClock className="size-3.5" /> Deadline
                    </Label>
                    <Input
                      id="ticketDeadline"
                      value={selectedTicket.deadline}
                      onChange={(e) => updateTicket(selectedTicketIndex, { deadline: e.target.value })}
                    />
                  </div>
                </div>
              </div>

              <DialogFooter showCloseButton />
            </>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
