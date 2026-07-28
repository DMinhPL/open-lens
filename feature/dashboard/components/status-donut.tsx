"use client";

import "@/core/colors/chart-setup";
import { useMemo } from "react";
import { Doughnut } from "react-chartjs-2";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useChartInk } from "@/core/colors/use-chart-colors";
import { useAppSelector } from "@/core/store/hooks";
import { buildStatusColorMap, getStatusColor } from "@/core/colors/status-colors";
import type { StatusBreakdown } from "@/core/domain/types";

interface StatusDonutProps {
  data: StatusBreakdown[];
}

export function StatusDonut({ data }: StatusDonutProps) {
  const ink = useChartInk();
  const statuses = useAppSelector((state) => state.common.statuses);
  const colorMap = useMemo(() => buildStatusColorMap(statuses), [statuses]);
  const filtered = data.filter((d) => d.count > 0);

  const chartData = {
    labels: filtered.map((d) => d.status),
    datasets: [
      {
        data: filtered.map((d) => d.count),
        backgroundColor: filtered.map((d) => getStatusColor(d.status, colorMap)),
        borderColor: ink.surface,
        borderWidth: 2,
      },
    ],
  };

  const options = {
    responsive: true,
    maintainAspectRatio: false,
    cutout: "65%",
    plugins: {
      legend: {
        position: "bottom" as const,
        labels: { color: ink.text, boxWidth: 12, font: { size: 12 } },
      },
      tooltip: ink.tooltip,
    },
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-sm font-medium">Status breakdown</CardTitle>
      </CardHeader>
      <CardContent className="h-64">
        {filtered.length === 0 ? (
          <p className="text-sm text-muted-foreground">No data</p>
        ) : (
          <Doughnut data={chartData} options={options} />
        )}
      </CardContent>
    </Card>
  );
}
