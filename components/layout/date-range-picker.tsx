"use client";

import { useState, useSyncExternalStore } from "react";
import { format, isSameMonth, parse, startOfMonth, subMonths } from "date-fns";
import type { DateRange as DayPickerRange } from "react-day-picker";
import { CalendarRange, ChevronDownIcon } from "lucide-react";
import { useFilters } from "@/core/filters-context";
import {
  ALL_TIME_START,
  DEFAULT_RANGE_MONTHS,
  formatDateRangeLabel,
  getAllTimeRange,
  getLastMonthsRange,
  getQuarterRange,
} from "@/core/domain/date-range";
import type { DateRange } from "@/core/domain/types";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import { cn } from "@/core/utils";

const LAST_MONTHS_PRESETS = [1, DEFAULT_RANGE_MONTHS, 6];
const QUARTERS = [1, 2, 3, 4] as const;
const DESKTOP_QUERY = "(min-width: 768px)";

function toDate(value: string) {
  return parse(value, "yyyy-MM-dd", new Date());
}

function toIsoDate(date: Date) {
  return format(date, "yyyy-MM-dd");
}

function toDayPickerRange(range: DateRange): DayPickerRange {
  return { from: toDate(range.from), to: toDate(range.to) };
}

/**
 * Months shown by the From and To calendars: the range's start and end months. When both fall
 * in the same month, From steps back one so the two panels don't show the same month twice.
 */
function getDisplayMonths(range: DateRange) {
  const from = startOfMonth(toDate(range.from));
  const to = startOfMonth(toDate(range.to));
  return { from: isSameMonth(from, to) ? subMonths(to, 1) : from, to };
}

function isSameRange(a: DateRange | null, b: DateRange) {
  return a !== null && a.from === b.from && a.to === b.to;
}

function subscribeToDesktopQuery(onChange: () => void) {
  const media = window.matchMedia(DESKTOP_QUERY);
  media.addEventListener("change", onChange);
  return () => media.removeEventListener("change", onChange);
}

/** From and To calendars side by side on desktop, a single calendar on phones. */
function useIsDesktop() {
  return useSyncExternalStore(
    subscribeToDesktopQuery,
    () => window.matchMedia(DESKTOP_QUERY).matches,
    () => true,
  );
}

/**
 * Top bar date range filter built on the shadcn `Calendar` in range mode; defaults to the last
 * `DEFAULT_RANGE_MONTHS` months. Picks and presets stay in a local draft and only reach the
 * filters on Apply, so pages don't recompute on every intermediate click.
 */
export function DateRangePicker({ className }: Readonly<{ className?: string }>) {
  const { dateRange, setDateRange } = useFilters();
  const isDesktop = useIsDesktop();
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState<DayPickerRange | undefined>(() => toDayPickerRange(dateRange));
  // Separate month state per panel: a single DayPicker with numberOfMonths={2} always shows two
  // consecutive months, so changing the left panel's year would drag the right one along with it.
  const [fromMonth, setFromMonth] = useState(() => getDisplayMonths(dateRange).from);
  const [toMonth, setToMonth] = useState(() => getDisplayMonths(dateRange).to);

  const now = new Date();
  const currentYear = now.getFullYear();
  const allTimeRange = getAllTimeRange(now);
  const label = formatDateRangeLabel(dateRange);
  const draftRange: DateRange | null =
    draft?.from && draft.to ? { from: toIsoDate(draft.from), to: toIsoDate(draft.to) } : null;
  const isDraftChanged = draftRange !== null && !isSameRange(draftRange, dateRange);
  let draftSummary = "Pick a start date";
  if (draftRange) draftSummary = formatDateRangeLabel(draftRange);
  else if (draft?.from) draftSummary = "Pick an end date";

  function showRange(range: DateRange) {
    const months = getDisplayMonths(range);
    setDraft(toDayPickerRange(range));
    setFromMonth(months.from);
    setToMonth(months.to);
  }

  function handleOpenChange(nextOpen: boolean) {
    // Discard unapplied picks: reopening always starts from the applied range.
    if (nextOpen) showRange(dateRange);
    setOpen(nextOpen);
  }

  function handleSelect(range: DayPickerRange | undefined, triggerDate: Date) {
    // Once a range is complete, the next click starts a new one instead of moving the nearest end.
    if (draft?.from && draft.to) {
      setDraft({ from: triggerDate, to: undefined });
      return;
    }
    setDraft(range);
  }

  function apply() {
    if (!draftRange) return;
    setDateRange(draftRange);
    setOpen(false);
  }

  // Both panels share the same selection; only the month each one shows differs.
  const calendarProps = {
    mode: "range" as const,
    captionLayout: "dropdown" as const,
    selected: draft,
    onSelect: handleSelect,
    startMonth: toDate(ALL_TIME_START),
    endMonth: now,
    disabled: [{ before: toDate(ALL_TIME_START) }, { after: now }],
  };

  function renderPreset(key: string, text: string, range: DateRange | null, title?: string) {
    return (
      <Button
        key={key}
        type="button"
        variant={range && isSameRange(draftRange, range) ? "secondary" : "ghost"}
        size="sm"
        className="date-range-picker__preset justify-start"
        disabled={!range}
        title={title ?? (range ? formatDateRangeLabel(range) : undefined)}
        onClick={() => range && showRange(range)}
      >
        {text}
      </Button>
    );
  }

  return (
    <Popover open={open} onOpenChange={handleOpenChange}>
      <PopoverTrigger asChild>
        <button
          type="button"
          aria-label={`Date range: ${label}`}
          className={cn(
            "date-range-picker__trigger flex h-7 items-center gap-1.5 rounded-[min(var(--radius-md),10px)] border border-input bg-transparent py-2 pr-2 pl-2.5 text-sm whitespace-nowrap transition-colors outline-none select-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 dark:bg-input/30 dark:hover:bg-input/50",
            className,
          )}
        >
          <CalendarRange className="size-4 shrink-0 text-muted-foreground" />
          {/* Default range is computed from "now", which can differ by a day between server and browser time zones. */}
          <span className="min-w-0 flex-1 truncate text-left" suppressHydrationWarning>
            {label}
          </span>
          <ChevronDownIcon className="pointer-events-none size-4 shrink-0 text-muted-foreground" />
        </button>
      </PopoverTrigger>
      <PopoverContent align="end" className="date-range-picker__content w-auto max-w-[calc(100vw-2rem)] p-0">
        <div className="flex flex-col md:flex-row">
          <div className="date-range-picker__presets flex flex-wrap gap-1 border-b p-2 md:w-36 md:flex-col md:flex-nowrap md:border-r md:border-b-0">
            {LAST_MONTHS_PRESETS.map((months) =>
              renderPreset(
                `last-${months}`,
                `Last ${months} month${months === 1 ? "" : "s"}`,
                getLastMonthsRange(months, now),
              ),
            )}
            {renderPreset("all", "All", allTimeRange)}
            <span className="date-range-picker__quarters-label w-full px-2 pt-2 text-xs text-muted-foreground">
              {currentYear}
            </span>
            <div className="date-range-picker__quarters grid w-full grid-cols-4 gap-1 md:grid-cols-2">
              {QUARTERS.map((quarter) => {
                const range = getQuarterRange(quarter, currentYear, now);
                return renderPreset(`q${quarter}`, `Q${quarter}`, range, range ? undefined : "Not started yet");
              })}
            </div>
          </div>
          <div className="date-range-picker__calendar flex flex-col">
            <div className="date-range-picker__months flex">
              <div className="date-range-picker__month date-range-picker__month--from">
                {isDesktop ? (
                  <span className="block px-3 pt-2 text-xs text-muted-foreground">From</span>
                ) : null}
                <Calendar {...calendarProps} month={fromMonth} onMonthChange={setFromMonth} />
              </div>
              {isDesktop ? (
                <div className="date-range-picker__month date-range-picker__month--to border-l">
                  <span className="block px-3 pt-2 text-xs text-muted-foreground">To</span>
                  <Calendar {...calendarProps} month={toMonth} onMonthChange={setToMonth} />
                </div>
              ) : null}
            </div>
            <div className="date-range-picker__footer flex items-center justify-between gap-3 border-t p-2">
              <span className="date-range-picker__summary text-xs text-muted-foreground">
                {draftSummary}
              </span>
              <Button
                type="button"
                size="sm"
                className="date-range-picker__apply"
                disabled={!isDraftChanged}
                onClick={apply}
              >
                Apply
              </Button>
            </div>
          </div>
        </div>
      </PopoverContent>
    </Popover>
  );
}
