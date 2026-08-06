"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { AlertTriangle, CheckCircle2 } from "lucide-react";
import { useFilters } from "@/core/filters-context";
import { useAppSelector } from "@/core/store/hooks";
import { useOpSettings } from "@/core/openproject/use-op-settings";
import { getWorkPackageUrl } from "@/core/openproject/openproject-links";
import { getDeadlineUrgency } from "@/core/domain/work-package-filters";
import { buildStatusColorMap, getStatusColor, isClosedStatus } from "@/core/colors/status-colors";
import { getTypeBadgeStyle } from "@/core/colors/type-colors";
import { formatDateDDMMYYYY, cn } from "@/core/utils";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import type { OpenProjectStatus, WorkPackage } from "@/core/domain/types";
import {
  DAY_WIDTH_PX,
  TASK_COLUMN_WIDTH_PX,
  dateOffsetPx,
  getDeadlineOffsetPx,
  getEffectiveDueDate,
  getGanttRange,
  getTaskBarGeometry,
  getTaskSpan,
  getTimelineTicks,
  type GanttRange,
  type TaskSpan,
} from "./gantt-utils";

/**
 * Gantt-style view of task duration: each row is a task's start→due span on a shared
 * timeline. Bar color follows the task's real OpenProject status; completed tasks
 * (any status with `isClosed: true` — Done, Cancelled, Developed, ...) render muted with
 * a checkmark, and tasks past their due date without being closed get a red ring and a
 * warning icon regardless of status, so a blown deadline is impossible to miss.
 */
export default function GanttPage() {
  const { workPackages, loading, error } = useFilters();
  const { settings } = useOpSettings();
  const statuses = useAppSelector((state) => state.common.statuses);
  const colorMap = useMemo(() => buildStatusColorMap(statuses), [statuses]);

  const [search, setSearch] = useState("");
  const [status, setStatus] = useState("all");
  const [type, setType] = useState("all");

  const statusOptions = useMemo(
    () => Array.from(new Set(workPackages.map((wp) => wp.statusLabel ?? wp.status))).sort((a, b) => a.localeCompare(b)),
    [workPackages],
  );
  const typeOptions = useMemo(
    () => Array.from(new Set(workPackages.map((wp) => wp.type))).sort((a, b) => a.localeCompare(b)),
    [workPackages],
  );

  const scheduled = useMemo(() => {
    return workPackages
      .map((wp) => ({ wp, span: getTaskSpan(wp) }))
      .filter((entry): entry is { wp: WorkPackage; span: TaskSpan } => entry.span !== null)
      .filter(({ wp }) => (status === "all" ? true : (wp.statusLabel ?? wp.status) === status))
      .filter(({ wp }) => (type === "all" ? true : wp.type === type))
      .filter(({ wp }) => wp.subject.toLowerCase().includes(search.toLowerCase()))
      .sort((a, b) => a.span.start.getTime() - b.span.start.getTime());
  }, [workPackages, status, type, search]);

  const range = useMemo(() => getGanttRange(scheduled.map(({ wp }) => wp)), [scheduled]);
  const ticks = useMemo(() => getTimelineTicks(range), [range]);
  const todayOffsetPx = useMemo(() => dateOffsetPx(new Date(), range), [range]);
  const timelineWidthPx = range.totalDays * DAY_WIDTH_PX;
  const unscheduledCount = workPackages.length - scheduled.length;

  const unscheduledSuffix = unscheduledCount > 0 ? ` · ${unscheduledCount} without dates` : "";
  const countLabel = loading
    ? "Loading…"
    : `${scheduled.length} task${scheduled.length === 1 ? "" : "s"}${unscheduledSuffix}`;

  function openTicket(id: number) {
    window.open(getWorkPackageUrl(settings?.instanceUrl, id), "_blank", "noopener,noreferrer");
  }

  if (error) {
    return <p className="text-sm text-destructive">Failed to load data: {error}</p>;
  }

  return (
    <div className="gantt-page flex h-[calc(100vh-3.5rem-2rem)] flex-col gap-4 md:h-[calc(100vh-3.5rem-3rem)]">
      <div className="gantt-toolbar flex shrink-0 flex-wrap items-center gap-3">
        <Input
          placeholder="Search tasks…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="gantt-search-input max-w-xs"
        />
        <Select value={status} onValueChange={setStatus}>
          <SelectTrigger size="sm" className="gantt-status-filter w-44">
            <SelectValue placeholder="Status" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All statuses</SelectItem>
            {statusOptions.map((s) => (
              <SelectItem key={s} value={s}>
                {s}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={type} onValueChange={setType}>
          <SelectTrigger size="sm" className="gantt-type-filter w-44">
            <SelectValue placeholder="Type" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All types</SelectItem>
            {typeOptions.map((t) => (
              <SelectItem key={t} value={t}>
                {t}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <GanttLegend />
        <span className="gantt-count-label ml-auto text-sm text-muted-foreground">{countLabel}</span>
      </div>

      <Card className="gantt-card flex min-h-0 flex-1 flex-col overflow-hidden">
        <CardHeader className="gantt-card-header shrink-0 pb-2">
          <CardTitle className="gantt-card-title text-sm font-medium">Task duration</CardTitle>
        </CardHeader>
        <CardContent className="gantt-card-content min-h-0 flex-1 overflow-hidden p-0">
          <GanttBody
            loading={loading}
            scheduled={scheduled}
            range={range}
            ticks={ticks}
            statuses={statuses}
            colorMap={colorMap}
            todayOffsetPx={todayOffsetPx}
            timelineWidthPx={timelineWidthPx}
            onOpen={openTicket}
          />
        </CardContent>
      </Card>
    </div>
  );
}

/** Loading skeleton, empty state, or the actual timeline grid — whichever applies. */
function GanttBody({
  loading,
  scheduled,
  range,
  ticks,
  statuses,
  colorMap,
  todayOffsetPx,
  timelineWidthPx,
  onOpen,
}: Readonly<{
  loading: boolean;
  scheduled: { wp: WorkPackage; span: TaskSpan }[];
  range: GanttRange;
  ticks: { label: string; offsetPx: number }[];
  statuses: OpenProjectStatus[] | null | undefined;
  colorMap: Record<string, string>;
  todayOffsetPx: number;
  timelineWidthPx: number;
  onOpen: (id: number) => void;
}>) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const hasScrolledToTodayRef = useRef(false);

  // Center "today" in the visible timeline once, the first time the chart has data to scroll —
  // without this, entering the page shows the left edge of the range and today may be far off-screen.
  useEffect(() => {
    if (loading || scheduled.length === 0 || hasScrolledToTodayRef.current) return;
    const container = scrollRef.current;
    if (!container) return;

    const visibleTimelineWidth = container.clientWidth - TASK_COLUMN_WIDTH_PX;
    container.scrollLeft = Math.max(0, todayOffsetPx - visibleTimelineWidth / 2);
    hasScrolledToTodayRef.current = true;
  }, [loading, scheduled.length, todayOffsetPx]);

  if (loading) {
    return (
      <div className="gantt-loading space-y-2 p-4">
        {Array.from({ length: 8 }).map((_, i) => (
          <Skeleton key={i} className="h-8 w-full" />
        ))}
      </div>
    );
  }

  if (scheduled.length === 0) {
    return (
      <p className="gantt-empty-state p-4 text-sm text-muted-foreground">
        No scheduled tasks match the current filters.
      </p>
    );
  }

  return (
    <div ref={scrollRef} className="gantt-scroll-container h-full overflow-auto">
      <div className="gantt-content" style={{ width: TASK_COLUMN_WIDTH_PX + timelineWidthPx }}>
        <TimelineHeader ticks={ticks} todayOffsetPx={todayOffsetPx} timelineWidthPx={timelineWidthPx} />
        {scheduled.map(({ wp, span }) => (
          <GanttRow
            key={wp.id}
            workPackage={wp}
            span={span}
            range={range}
            ticks={ticks}
            statuses={statuses}
            colorMap={colorMap}
            todayOffsetPx={todayOffsetPx}
            timelineWidthPx={timelineWidthPx}
            onOpen={onOpen}
          />
        ))}
      </div>
    </div>
  );
}

/**
 * Full-height vertical gridlines at each ruler tick, shared by the header and every row so
 * they stay pixel-aligned with each other and with the tick labels — a visual anchor for
 * reading where a bar or the deadline stick falls on the calendar.
 */
function TickGridLines({ ticks }: Readonly<{ ticks: { label: string; offsetPx: number }[] }>) {
  return (
    <>
      {ticks.map((tick) => (
        <div
          key={`${tick.label}-${tick.offsetPx}`}
          aria-hidden
          className="gantt-grid-line absolute inset-y-0 border-l border-border"
          style={{ left: tick.offsetPx }}
        />
      ))}
    </>
  );
}

function TimelineHeader({
  ticks,
  todayOffsetPx,
  timelineWidthPx,
}: Readonly<{
  ticks: { label: string; offsetPx: number }[];
  todayOffsetPx: number;
  timelineWidthPx: number;
}>) {
  return (
    <div className="gantt-timeline-header top-chart sticky top-0 z-30 flex border-b bg-muted/95 backdrop-blur-sm">
      <div
        className="gantt-task-column-header sticky left-0 z-20 shrink-0 border-r bg-muted/95 px-3 py-2 text-xs font-medium text-muted-foreground backdrop-blur-sm"
        style={{ width: TASK_COLUMN_WIDTH_PX }}
      >
        Task
      </div>
      <div className="gantt-timeline-ruler date-list relative h-8" style={{ width: timelineWidthPx }}>
        <TickGridLines ticks={ticks} />
        {ticks.map((tick) => (
          <span
            key={`${tick.label}-${tick.offsetPx}`}
            className="gantt-tick-label absolute top-1/2 -translate-y-1/2 pl-1.5 text-xs whitespace-nowrap text-muted-foreground"
            style={{ left: tick.offsetPx }}
          >
            {tick.label}
          </span>
        ))}
        <div
          aria-hidden
          className="gantt-today-line-header absolute inset-y-0 border-l-2 border-dashed border-destructive/60"
          style={{ left: todayOffsetPx }}
        />
      </div>
    </div>
  );
}

/**
 * Progress button color rule (evaluated in this priority order):
 *  1. Overdue (past due date + not closed) forces `bg-destructive` + red ring, regardless of status.
 *  2. Otherwise the button uses the task's real OpenProject status color, via `getStatusColor` —
 *     colorMap[status] -> hardcoded STATUS_COLORS fallback -> hashed fallback palette for unknown names.
 *  3. Closed/done statuses (isClosedStatus) dim the whole button to opacity-50 and swap in a
 *     checkmark icon, but only when NOT overdue — overdue's red ring/icon always wins visually.
 *
 * Right-hand date label rule: shares {@link getEffectiveDueDate}'s completion-date logic with
 * the bar's own geometry (`span.end`, resolved via the same function in `getTaskSpan`), so the
 * label always matches what the bar is actually drawn against instead of duplicating the rule.
 */
function GanttRow({
  workPackage,
  span,
  range,
  ticks,
  statuses,
  colorMap,
  todayOffsetPx,
  timelineWidthPx,
  onOpen,
}: Readonly<{
  workPackage: WorkPackage;
  span: TaskSpan;
  range: GanttRange;
  ticks: { label: string; offsetPx: number }[];
  statuses: OpenProjectStatus[] | null | undefined;
  colorMap: Record<string, string>;
  todayOffsetPx: number;
  timelineWidthPx: number;
  onOpen: (id: number) => void;
}>) {
  const statusName = workPackage.statusLabel ?? workPackage.status;
  const isDone = isClosedStatus(statusName, statuses);
  const overdue = getDeadlineUrgency(workPackage.dueDate, isDone, 0) === "overdue";
  const geometry = getTaskBarGeometry(span, range);
  const deadlineOffsetPx = getDeadlineOffsetPx(workPackage, range);
  const color = getStatusColor(statusName, colorMap);
  const barDueDate = getEffectiveDueDate(workPackage);
  const summary = `${workPackage.subject} — ${statusName} — ${formatDateDDMMYYYY(workPackage.startDate)} → ${formatDateDDMMYYYY(
    barDueDate,
  )} — ${workPackage.percentDone}% done${overdue ? " — overdue" : ""}`;

  return (
    <div className="gantt-row flex border-b last:border-b-0 hover:bg-muted/30">
      <button
        type="button"
        onClick={() => onOpen(workPackage.id)}
        className="gantt-task-cell sticky left-0 z-30 flex shrink-0 flex-col items-start gap-0.5 border-r bg-background px-3 py-2 text-left hover:bg-muted/50"
        style={{ width: TASK_COLUMN_WIDTH_PX }}
        title={workPackage.subject}
      >
        <span className="gantt-task-title-row flex w-full items-center gap-1.5">
          <Badge variant="outline" className={cn("gantt-type-badge shrink-0", getTypeBadgeStyle(workPackage.type))}>
            <span aria-hidden className="size-1.5 rounded-full bg-current opacity-70" />
            {workPackage.type}
          </Badge>
          <span className="gantt-task-subject line-clamp-1 text-sm font-medium">{workPackage.subject}</span>
        </span>
        <span className="gantt-task-meta text-xs text-muted-foreground">
          {statusName} · {formatDateDDMMYYYY(workPackage.startDate)} → {formatDateDDMMYYYY(barDueDate)}
        </span>
      </button>
      <div className="gantt-row-timeline relative" style={{ width: timelineWidthPx }}>
        <TickGridLines ticks={ticks} />
        <div
          aria-hidden
          className="gantt-today-line-row absolute inset-y-0 border-l border-dashed border-destructive/30"
          style={{ left: todayOffsetPx }}
        />
        <span
          aria-hidden
          className="gantt-start-label absolute top-1/2 -translate-x-full -translate-y-1/2 pr-1.5 text-[10px] whitespace-nowrap text-muted-foreground"
          style={{ left: geometry.left }}
        >
          {formatDateDDMMYYYY(workPackage.startDate)}
        </span>
        <button
          type="button"
          className={cn(
            "gantt-progress-button absolute progress-tracing top-1/2 flex h-5 -translate-y-1/2 items-center gap-1 rounded-full px-2 text-[10px] font-medium text-white shadow-sm",
            isDone && "opacity-50",
            overdue && "bg-destructive ring-2 ring-destructive ring-offset-1 ring-offset-background",
          )}
          style={{
            left: geometry.left,
            width: Math.max(geometry.width, 24),
            backgroundColor: overdue ? undefined : color,
          }}
          title={summary}
          aria-label={summary}
        >
          {overdue && <AlertTriangle className="size-3 shrink-0" />}
          {isDone && !overdue && <CheckCircle2 className="size-3 shrink-0" />}
          <span className="gantt-percent-label truncate">{workPackage.percentDone}%</span>
        </button>
        <span
          aria-hidden
          className="gantt-due-label absolute top-1/2 -translate-y-1/2 pl-1.5 text-[10px] whitespace-nowrap text-muted-foreground"
          style={{ left: geometry.left + Math.max(geometry.width, 24) }}
        >
          {formatDateDDMMYYYY(barDueDate)}
        </span>
        {deadlineOffsetPx !== null && (
          <DeadlineMarker offsetPx={deadlineOffsetPx} overdue={overdue} dueDate={workPackage.dueDate} />
        )}
      </div>
    </div>
  );
}

/**
 * Vertical "stick" marking a task's committed due date on its row, independent of the bar
 * itself — visible even when the bar is short, muted (done), or its right edge already sits
 * at the same spot. Turns red once the deadline has passed without the task being closed.
 *
 * The visible line is a thin 2px sliver, but it sits inside a wider (12px) transparent hit
 * area so the "Deadline: <date>" tooltip is easy to trigger on hover instead of requiring
 * pixel-precise aim.
 */
function DeadlineMarker({
  offsetPx,
  overdue,
  dueDate,
}: Readonly<{ offsetPx: number; overdue: boolean; dueDate?: string }>) {
  return (
    <div
      className="gantt-deadline-marker absolute top-1 bottom-1 z-10 flex w-3 -translate-x-1/2 justify-center"
      style={{ left: offsetPx }}
      title={`Deadline: ${formatDateDDMMYYYY(dueDate)}${overdue ? " (overdue)" : ""}`}
    >
      <span className={cn("h-full w-0.5", overdue ? "bg-destructive" : "bg-foreground/60")} />
      <span
        aria-hidden
        className={cn(
          "absolute -top-1 size-2 rounded-full border-2 border-background",
          overdue ? "bg-destructive" : "bg-foreground/60",
        )}
      />
    </div>
  );
}

function GanttLegend() {
  return (
    <div className="gantt-legend flex items-center gap-3 text-xs text-muted-foreground">
      <LegendSwatch className="bg-sky-500" label="In progress" />
      <LegendSwatch className="bg-sky-500 opacity-50" label="Completed" />
      <LegendSwatch className="bg-destructive" label="Overdue" />
      <span className="gantt-legend-deadline flex items-center gap-1.5">
        <span aria-hidden className="h-2.5 w-0.5 rounded-full bg-foreground/60" />
        Deadline
      </span>
    </div>
  );
}

function LegendSwatch({ className, label }: Readonly<{ className: string; label: string }>) {
  return (
    <span className="gantt-legend-swatch flex items-center gap-1.5">
      <span aria-hidden className={cn("size-2.5 rounded-full", className)} />
      {label}
    </span>
  );
}
