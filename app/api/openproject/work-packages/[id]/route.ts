import { NextRequest, NextResponse } from "next/server";
import { getOpSettings } from "@/core/openproject/openproject-client";

interface OpenProjectError {
  message?: string;
  _embedded?: { details?: { attribute?: string; message?: string } };
}

/** Reads an OpenProject API error response. */
async function readError(response: Response) {
  const body = (await response.json().catch(() => null)) as OpenProjectError | null;
  const message = body?.message ?? `OpenProject API request failed: ${response.status} ${response.statusText}`;
  const detail = body?._embedded?.details?.message ?? body?._embedded?.details?.attribute;
  return detail ? `${message} (${detail})` : message;
}

/** Determines whether a route identifier is a positive integer. */
function isValidId(value: string) {
  return /^\d+$/.test(value) && Number.isSafeInteger(Number(value)) && Number(value) > 0;
}

/** Determines whether a value is a valid ISO date. */
function isValidDate(value: unknown): value is string {
  if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  return new Date(`${value}T00:00:00.000Z`).toISOString().slice(0, 10) === value;
}

/** Updates one OpenProject work package and optionally logs time. */
export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!isValidId(id)) return NextResponse.json({ error: "id must be a positive integer" }, { status: 400 });

  const body = (await request.json().catch(() => null)) as {
    percentageDone?: unknown;
    statusId?: unknown;
    loggedHours?: unknown;
    startDate?: unknown;
    dueDate?: unknown;
  } | null;
  if (!body || typeof body !== "object") {
    return NextResponse.json({ error: "A JSON request body is required" }, { status: 400 });
  }

  const percentageDone = body.percentageDone;
  const statusId = body.statusId;
  const loggedHours = body.loggedHours;
  const startDate = body.startDate === "" ? null : body.startDate;
  const dueDate = body.dueDate === "" ? null : body.dueDate;
  const hasProgress = percentageDone !== undefined;
  const hasStatus = statusId !== undefined;
  const hasLoggedHours = loggedHours !== undefined;
  const hasStartDate = startDate !== undefined;
  const hasDueDate = dueDate !== undefined;

  if (!hasProgress && !hasStatus && !hasLoggedHours && !hasStartDate && !hasDueDate) {
    return NextResponse.json({ error: "Provide progress, status, logged hours, start date, or due date" }, { status: 400 });
  }
  if (
    hasProgress &&
    (typeof percentageDone !== "number" || !Number.isInteger(percentageDone) || percentageDone < 0 || percentageDone > 100)
  ) {
    return NextResponse.json({ error: "percentageDone must be an integer from 0 to 100" }, { status: 400 });
  }
  if (hasStatus && (typeof statusId !== "number" || !Number.isSafeInteger(statusId) || statusId <= 0)) {
    return NextResponse.json({ error: "statusId must be a positive integer" }, { status: 400 });
  }
  if (hasLoggedHours && (typeof loggedHours !== "number" || !Number.isFinite(loggedHours) || loggedHours <= 0)) {
    return NextResponse.json({ error: "loggedHours must be a positive number" }, { status: 400 });
  }
  if (hasStartDate && startDate !== null && !isValidDate(startDate)) {
    return NextResponse.json({ error: "startDate must be a valid YYYY-MM-DD date" }, { status: 400 });
  }
  if (hasDueDate && dueDate !== null && !isValidDate(dueDate)) {
    return NextResponse.json({ error: "dueDate must be a valid YYYY-MM-DD date" }, { status: 400 });
  }

  const settings = await getOpSettings();
  if (settings.useDummyData || !settings.instanceUrl || !settings.apiToken) {
    return NextResponse.json({ error: "Editing tickets requires a live OpenProject connection" }, { status: 409 });
  }

  const baseUrl = settings.instanceUrl.replace(/\/$/, "");
  const authorization = `Basic ${Buffer.from(`apikey:${settings.apiToken}`).toString("base64")}`;
  const headers = { Authorization: authorization, "Content-Type": "application/json" };

  try {
    const errors: Record<string, string> = {};
    let lockVersion: number | undefined;

    if (hasProgress || hasStatus || hasStartDate || hasDueDate) {
      const current = await fetch(`${baseUrl}/api/v3/work_packages/${id}`, { headers, cache: "no-store" });
      if (!current.ok) {
        errors.workPackage = await readError(current);
      } else {
        const currentWorkPackage = (await current.json()) as {
          lockVersion?: unknown;
          startDate?: string | null;
          dueDate?: string | null;
        };
        if (typeof currentWorkPackage.lockVersion !== "number" || !Number.isInteger(currentWorkPackage.lockVersion)) {
          errors.workPackage = "OpenProject did not return a work-package lock version";
        } else {
          lockVersion = currentWorkPackage.lockVersion;
          const effectiveStartDate = hasStartDate ? startDate : currentWorkPackage.startDate;
          const effectiveDueDate = hasDueDate ? dueDate : currentWorkPackage.dueDate;
          if (effectiveStartDate && effectiveDueDate && effectiveStartDate > effectiveDueDate) {
            return NextResponse.json({ error: "Start date cannot be after due date" }, { status: 400 });
          }

          // Save universally writable work-package properties together. Progress is deliberately
          // separate: installations that calculate it automatically reject `percentageDone`.
          if (hasStatus || hasStartDate || hasDueDate) {
            const patch: Record<string, unknown> = { lockVersion };
            if (hasStatus) patch._links = { status: { href: `/api/v3/statuses/${statusId}` } };
            if (hasStartDate) patch.startDate = startDate;
            if (hasDueDate) patch.dueDate = dueDate;

            const update = await fetch(`${baseUrl}/api/v3/work_packages/${id}`, {
              method: "PATCH",
              headers,
              body: JSON.stringify(patch),
            });
            if (!update.ok) {
              errors.workPackage = await readError(update);
            } else {
              const updated = (await update.json()) as { lockVersion?: unknown };
              if (typeof updated.lockVersion === "number" && Number.isInteger(updated.lockVersion)) {
                lockVersion = updated.lockVersion;
              }
            }
          }

          if (hasProgress && lockVersion !== undefined) {
            const updateProgress = await fetch(`${baseUrl}/api/v3/work_packages/${id}`, {
              method: "PATCH",
              headers,
              body: JSON.stringify({ lockVersion, percentageDone }),
            });
            if (!updateProgress.ok) errors.percentageDone = await readError(updateProgress);
          }
        }
      }
    }

    if (hasLoggedHours) {
      // `spentTime` is read-only. Logging hours creates a new time entry, which updates that total.
      // Resolve the project-specific/default activity through the form endpoint before creation.
      const candidate = {
        hours: `PT${loggedHours}H`,
        spentOn: new Date().toISOString().slice(0, 10),
        _links: { workPackage: { href: `/api/v3/work_packages/${id}` } },
      };
      const form = await fetch(`${baseUrl}/api/v3/time_entries/form`, {
        method: "POST",
        headers,
        body: JSON.stringify(candidate),
      });
      if (!form.ok) {
        errors.loggedHours = await readError(form);
      } else {
        const formBody = (await form.json()) as {
          _embedded?: { payload?: Record<string, unknown>; validationErrors?: Record<string, unknown> };
        };
        const validationErrors = formBody._embedded?.validationErrors;
        if (validationErrors && Object.keys(validationErrors).length > 0) {
          errors.loggedHours = Object.entries(validationErrors)
            .map(([field, error]) => `${field}: ${typeof error === "string" ? error : JSON.stringify(error)}`)
            .join("; ");
        } else {
          const entry = await fetch(`${baseUrl}/api/v3/time_entries`, {
            method: "POST",
            headers,
            body: JSON.stringify(formBody._embedded?.payload ?? candidate),
          });
          if (!entry.ok) errors.loggedHours = await readError(entry);
        }
      }
    }

    return NextResponse.json({ ok: Object.keys(errors).length === 0, errors }, { status: Object.keys(errors).length ? 207 : 200 });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to update the ticket" },
      { status: 500 },
    );
  }
}
