"use client";

import { useState } from "react";
import {
  Area,
  AreaChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { ChartHelpDialog } from "@/components/dashboard/chart-help-dialog";
import { Card, CardAction, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { CFD_STAGES, type CfdStage } from "@/core/domain/cfd-stages";
import { useChartInk } from "@/core/colors/use-chart-colors";
import type { CfdPoint } from "@/core/domain/types";

interface CfdChartProps {
  title: string;
  data: CfdPoint[];
}

export function CfdChart({ title, data }: CfdChartProps) {
  const ink = useChartInk();
  const [visibleStages, setVisibleStages] = useState<Set<CfdStage>>(
    () => new Set(CFD_STAGES.map((stage) => stage.key)),
  );

  function toggleStage(stage: CfdStage) {
    setVisibleStages((current) => {
      const next = new Set(current);
      if (next.has(stage)) next.delete(stage);
      else next.add(stage);
      return next;
    });
  }

  return (
    <Card className="cfd-chart">
      <CardHeader className="cfd-chart__header">
        <CardTitle className="cfd-chart__title text-sm font-medium">{title}</CardTitle>
        <CardAction className="cfd-chart__help-action">
          <ChartHelpDialog
            title="Cumulative flow stages"
            description="Each band groups Task and Bug tickets by workflow stage. A widening band can indicate that work is accumulating at that stage."
          >
            <div className="cfd-chart__help-dialog-body space-y-4">
              <p className="text-sm text-muted-foreground">
                Select a legend label beside the chart to hide or show that band.
              </p>
              <dl className="cfd-chart__stage-list space-y-3">
                {CFD_STAGES.map((stage) => (
                  <div key={stage.key} className="cfd-chart__stage grid gap-1 sm:grid-cols-[10rem_1fr] sm:gap-3">
                    <dt className="cfd-chart__stage-label flex items-center gap-2 font-medium">
                      <span
                        className="cfd-chart__stage-swatch size-3 shrink-0"
                        style={{ backgroundColor: stage.color }}
                        aria-hidden="true"
                      />
                      {stage.label}
                    </dt>
                    <dd className="cfd-chart__stage-description text-muted-foreground">
                      <p>{stage.description}</p>
                      <p className="cfd-chart__stage-statuses mt-1 text-xs">
                        Statuses: {stage.statuses.join(", ")}
                      </p>
                    </dd>
                  </div>
                ))}
              </dl>
              <p className="cfd-chart__approximation-note rounded-md bg-muted p-3 text-xs text-muted-foreground">
                Approximate: historical points use each ticket&apos;s current status, not its
                status on that date, because OpenProject does not provide structured bulk
                status-transition history.
              </p>
            </div>
          </ChartHelpDialog>
        </CardAction>
      </CardHeader>
      <CardContent className="cfd-chart__content h-64">
        {data.length === 0 ? (
          <p className="cfd-chart__empty-state text-sm text-muted-foreground">No data</p>
        ) : (
          <div className="cfd-chart__body flex h-full min-w-0 items-center gap-3">
            <div className="cfd-chart__plot h-full min-w-0 flex-1">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={data} margin={{ top: 8, right: 4, bottom: 0, left: 4 }}>
                  <XAxis
                    dataKey="label"
                    axisLine={{ stroke: ink.baseline }}
                    tickLine={false}
                    tick={{ fill: ink.text, fontSize: 11 }}
                    minTickGap={24}
                  />
                  <YAxis
                    allowDecimals={false}
                    axisLine={false}
                    tickLine={false}
                    tick={{ fill: ink.text, fontSize: 11 }}
                    width={44}
                    label={{
                      value: "Tickets",
                      angle: -90,
                      position: "insideLeft",
                      fill: ink.text,
                      fontSize: 11,
                      fontWeight: 600,
                    }}
                  />
                  <Tooltip
                    cursor={{ stroke: ink.baseline }}
                    contentStyle={{
                      backgroundColor: ink.tooltip.backgroundColor,
                      borderColor: ink.tooltip.borderColor,
                      borderWidth: ink.tooltip.borderWidth,
                      borderRadius: 6,
                      color: ink.tooltip.bodyColor,
                      fontSize: 12,
                      padding: ink.tooltip.padding,
                    }}
                    labelStyle={{ color: ink.tooltip.titleColor }}
                    itemStyle={{ color: ink.tooltip.bodyColor }}
                  />
                  {[...CFD_STAGES]
                    .reverse()
                    .filter((stage) => visibleStages.has(stage.key))
                    .map((stage) => (
                      <Area
                        key={stage.key}
                        type="monotone"
                        dataKey={stage.key}
                        name={stage.label}
                        stackId="cfd"
                        stroke={stage.color}
                        fill={stage.color}
                        isAnimationActive={false}
                      />
                    ))}
                </AreaChart>
              </ResponsiveContainer>
            </div>
            <div className="cfd-chart__legend flex shrink-0 flex-col gap-2 text-xs text-muted-foreground">
              {CFD_STAGES.map((stage) => (
                <ChartLegendItem
                  key={stage.key}
                  color={stage.color}
                  label={stage.label}
                  visible={visibleStages.has(stage.key)}
                  onToggle={() => toggleStage(stage.key)}
                />
              ))}
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function ChartLegendItem({
  color,
  label,
  visible,
  onToggle,
}: {
  color: string;
  label: string;
  visible: boolean;
  onToggle: () => void;
}) {
  return (
    <button
      type="button"
      className="cfd-chart__legend-item flex items-center gap-2 rounded-sm text-left transition-opacity hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring data-[state=hidden]:opacity-50"
      data-state={visible ? "visible" : "hidden"}
      aria-pressed={visible}
      aria-label={`${visible ? "Hide" : "Show"} ${label} band`}
      title={`${visible ? "Hide" : "Show"} ${label} band`}
      onClick={onToggle}
    >
      <span
        className="cfd-chart__legend-swatch size-3 transition-opacity"
        style={{ backgroundColor: color, opacity: visible ? 1 : 0.25 }}
        aria-hidden="true"
      />
      <span className="cfd-chart__legend-label">{label}</span>
      <span className="sr-only">{visible ? "Visible" : "Hidden"}</span>
    </button>
  );
}
