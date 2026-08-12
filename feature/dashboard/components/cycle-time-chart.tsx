"use client";

import { useState } from "react";
import "@/core/colors/chart-setup";
import type { ChartOptions } from "chart.js";
import { Scatter } from "react-chartjs-2";
import { ChartHelpDialog } from "@/components/dashboard/chart-help-dialog";
import { Card, CardAction, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { CHART_COLORS } from "@/core/colors/chart-theme";
import { useChartInk } from "@/core/colors/use-chart-colors";
import type { CycleTimePoint } from "@/core/domain/types";
import { getWorkPackageUrl } from "@/core/openproject/openproject-links";
import { useOpSettings } from "@/core/openproject/use-op-settings";

interface CycleTimeChartProps {
  title: string;
  data: CycleTimePoint[];
}

const DATE_FORMATTER = new Intl.DateTimeFormat("en-US", {
  month: "short",
  day: "numeric",
  timeZone: "UTC",
});

const FULL_DATE_FORMATTER = new Intl.DateTimeFormat("en-US", {
  year: "numeric",
  month: "short",
  day: "numeric",
  timeZone: "UTC",
});

export function CycleTimeChart({ title, data }: CycleTimeChartProps) {
  const ink = useChartInk();
  const { settings } = useOpSettings();
  const [selectedPoints, setSelectedPoints] = useState<CycleTimePoint[] | null>(null);
  const chartData = {
    datasets: [
      {
        label: "Cycle time",
        data: data.map((point) => ({
          x: new Date(point.completedDate).getTime(),
          y: point.cycleTimeDays,
        })),
        backgroundColor: CHART_COLORS.purple,
        borderColor: CHART_COLORS.purple,
        pointRadius: 4,
        pointHoverRadius: 6,
      },
    ],
  };
  const options: ChartOptions<"scatter"> = {
    responsive: true,
    maintainAspectRatio: false,
    onClick: (_event, elements) => {
      const points = elements.map((el) => data[el.index]).filter((point): point is CycleTimePoint => Boolean(point));
      if (points.length) setSelectedPoints(points);
    },
    onHover: (event, elements) => {
      if (event.native?.target instanceof HTMLElement) {
        event.native.target.style.cursor = elements.length ? "pointer" : "default";
      }
    },
    plugins: {
      legend: { display: false },
      tooltip: {
        ...ink.tooltip,
        callbacks: {
          title: () => [],
          label: (item) => {
            const point = data[item.dataIndex];
            const completedAt = item.parsed.x;
            const completedLabel = completedAt === null ? "Unknown date" : DATE_FORMATTER.format(completedAt);
            return `${point?.label ?? "Unknown ticket"} · ${item.parsed.y ?? 0} days · ${completedLabel}`;
          },
        },
      },
    },
    scales: {
      x: {
        type: "linear" as const,
        grid: { display: false },
        ticks: {
          color: ink.text,
          font: { size: 11 },
          callback: (value: string | number) => DATE_FORMATTER.format(Number(value)),
        },
        border: { color: ink.baseline },
        title: { display: true, text: "Completed", color: ink.text },
      },
      y: {
        beginAtZero: true,
        ticks: { color: ink.text, font: { size: 11 } },
        grid: { color: ink.grid },
        border: { display: false },
        title: { display: true, text: "Days", color: ink.text },
      },
    },
  };
  return (
    <Card className="cycle-time-chart">
      <CardHeader className="cycle-time-chart__header">
        <CardTitle className="cycle-time-chart__title text-sm font-medium">{title}</CardTitle>
        <CardDescription className="cycle-time-chart__description">
          Approximate: creation to close, not time-in-status.
        </CardDescription>
        <CardAction className="cycle-time-chart__help-action">
          <ChartHelpDialog
            title="Task and Bug cycle time"
            description="Plots each completed Task or Bug by completion date and approximate cycle time."
          >
            <div className="space-y-2 text-sm text-muted-foreground">
              <p>Each point is one ticket. Higher points took more calendar days from creation to close.</p>
              <p>Look for clusters and high outliers to understand typical delivery time and unusually slow work. Select a point to inspect its ticket details.</p>
              <p className="rounded-md bg-muted p-3 text-xs">Approximate: this uses creation-to-close duration because structured time-in-status history is not available in bulk from OpenProject.</p>
            </div>
          </ChartHelpDialog>
        </CardAction>
      </CardHeader>
      <CardContent className="cycle-time-chart__content h-64">
        {data.length === 0 ? (
          <p className="cycle-time-chart__empty-state text-sm text-muted-foreground">No data</p>
        ) : (
          <div className="cycle-time-chart__plot h-full">
            <Scatter data={chartData} options={options} />
          </div>
        )}
      </CardContent>

      <Dialog open={selectedPoints !== null} onOpenChange={(open) => !open && setSelectedPoints(null)}>
        <DialogContent className="cycle-time-chart__ticket-dialog sm:max-w-lg">
          {selectedPoints && (
            <>
              <DialogHeader className="cycle-time-chart__ticket-dialog-header">
                <DialogTitle className="cycle-time-chart__ticket-dialog-title">
                  {selectedPoints.length === 1 ? "Ticket detail" : `${selectedPoints.length} tickets at this point`}
                </DialogTitle>
                <DialogDescription className="cycle-time-chart__ticket-dialog-description">
                  Approximate: creation to close, not time-in-status.
                </DialogDescription>
              </DialogHeader>
              <div className="cycle-time-chart__ticket-list -mx-1 max-h-96 space-y-3 overflow-y-auto px-1">
                {selectedPoints.map((point) => (
                  <div key={point.id} className="cycle-time-chart__ticket rounded-md border p-3">
                    <div className="cycle-time-chart__ticket-header flex items-start justify-between gap-2">
                      <p className="cycle-time-chart__ticket-title text-sm font-medium">{point.label}</p>
                      <Button className="cycle-time-chart__ticket-link" asChild size="sm" variant="outline">
                        <a
                          href={getWorkPackageUrl(settings?.instanceUrl, point.id)}
                          target="_blank"
                          rel="noopener noreferrer"
                        >
                          Open
                        </a>
                      </Button>
                    </div>
                    <p className="cycle-time-chart__ticket-meta mb-2 text-xs text-muted-foreground">
                      {point.type}
                      {point.statusLabel ? ` · ${point.statusLabel}` : ""} · #{point.id}
                    </p>
                    <dl className="cycle-time-chart__ticket-details grid grid-cols-2 gap-1 text-sm">
                      <dt className="text-muted-foreground">Project</dt>
                      <dd>{point.project}</dd>
                      <dt className="text-muted-foreground">Assignee</dt>
                      <dd>{point.assignee || "Unassigned"}</dd>
                      <dt className="text-muted-foreground">Created</dt>
                      <dd>{FULL_DATE_FORMATTER.format(new Date(point.createdAt))}</dd>
                      <dt className="text-muted-foreground">Completed</dt>
                      <dd>{FULL_DATE_FORMATTER.format(new Date(point.completedDate))}</dd>
                      <dt className="text-muted-foreground">Cycle time</dt>
                      <dd>{point.cycleTimeDays} days</dd>
                    </dl>
                  </div>
                ))}
              </div>
            </>
          )}
        </DialogContent>
      </Dialog>
    </Card>
  );
}
