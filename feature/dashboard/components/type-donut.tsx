"use client";

import "@/core/colors/chart-setup";
import { Doughnut } from "react-chartjs-2";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useChartInk } from "@/core/colors/use-chart-colors";
import { getTypeColor } from "@/core/colors/type-colors";
import type { TypeBreakdown } from "@/core/domain/types";

interface TypeDonutProps {
  data: TypeBreakdown[];
}

export function TypeDonut({ data }: TypeDonutProps) {
  const ink = useChartInk();
  const filtered = data.filter((d) => d.count > 0);

  const chartData = {
    labels: filtered.map((d) => d.type),
    datasets: [
      {
        data: filtered.map((d) => d.count),
        backgroundColor: filtered.map((d) => getTypeColor(d.type)),
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
        <CardTitle className="text-sm font-medium">Ticket type overview</CardTitle>
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
