"use client";

import {
  Area,
  AreaChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useChartInk } from "@/core/colors/use-chart-colors";
import { CHART_COLORS } from "@/core/colors/chart-theme";
import type { CfdPoint } from "@/core/domain/types";

interface CfdChartProps {
  title: string;
  data: CfdPoint[];
}

export function CfdChart({ title, data }: CfdChartProps) {
  const ink = useChartInk();
  const backlogColor = CHART_COLORS.brightBlue;
  const inProcessColor = CHART_COLORS.red;
  const doneColor = CHART_COLORS.yellow;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-sm font-medium">{title}</CardTitle>
      </CardHeader>
      <CardContent className="h-64">
        {data.length === 0 ? (
          <p className="text-sm text-muted-foreground">No data</p>
        ) : (
          <div className="flex h-full min-w-0 items-center gap-3">
            <div className="h-full min-w-0 flex-1">
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
                  <Area
                    type="monotone"
                    dataKey="done"
                    name="Done"
                    stackId="cfd"
                    stroke={doneColor}
                    fill={doneColor}
                    isAnimationActive={false}
                  />
                  <Area
                    type="monotone"
                    dataKey="inProgress"
                    name="In Process"
                    stackId="cfd"
                    stroke={inProcessColor}
                    fill={inProcessColor}
                    isAnimationActive={false}
                  />
                  <Area
                    type="monotone"
                    dataKey="backlog"
                    name="Backlog"
                    stackId="cfd"
                    stroke={backlogColor}
                    fill={backlogColor}
                    isAnimationActive={false}
                  />
                </AreaChart>
              </ResponsiveContainer>
            </div>
            <div className="flex shrink-0 flex-col gap-2 text-xs text-muted-foreground">
              <ChartLegendItem color={backlogColor} label="Backlog" />
              <ChartLegendItem color={inProcessColor} label="In Process" />
              <ChartLegendItem color={doneColor} label="Done" />
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function ChartLegendItem({ color, label }: { color: string; label: string }) {
  return (
    <div className="flex items-center gap-2">
      <span className="size-3" style={{ backgroundColor: color }} />
      <span>{label}</span>
    </div>
  );
}
