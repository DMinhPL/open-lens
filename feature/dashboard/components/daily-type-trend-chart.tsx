"use client";

import "@/core/colors/chart-setup";
import { useMemo } from "react";
import { Bar } from "react-chartjs-2";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useChartInk } from "@/core/colors/use-chart-colors";
import { getTypeColor } from "@/core/colors/type-colors";
import type { DailyTypeTrendPoint } from "@/core/domain/types";

interface DailyTypeTrendChartProps {
  data: DailyTypeTrendPoint[];
}

export function DailyTypeTrendChart({ data }: DailyTypeTrendChartProps) {
  const ink = useChartInk();

  const types = useMemo(() => {
    const seen = new Set<string>();
    for (const point of data) {
      for (const type of Object.keys(point.byType)) seen.add(type);
    }
    return Array.from(seen).sort();
  }, [data]);

  const chartData = {
    labels: data.map((d) => d.label),
    datasets: types.map((type) => ({
      label: type,
      data: data.map((d) => d.byType[type] ?? 0),
      backgroundColor: getTypeColor(type),
      borderRadius: 2,
      maxBarThickness: 28,
    })),
  };

  const options = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: {
        position: "bottom" as const,
        labels: { color: ink.text, boxWidth: 12, font: { size: 11 } },
      },
      tooltip: ink.tooltip,
    },
    scales: {
      x: {
        stacked: true,
        grid: { display: false },
        ticks: { color: ink.text, font: { size: 11 } },
        border: { color: ink.baseline },
      },
      y: {
        stacked: true,
        beginAtZero: true,
        ticks: { color: ink.text, font: { size: 11 }, precision: 0 },
        grid: { color: ink.grid },
        border: { display: false },
      },
    },
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-sm font-medium">Tickets created per day, by type</CardTitle>
      </CardHeader>
      <CardContent className="h-64">
        {types.length === 0 ? (
          <p className="text-sm text-muted-foreground">No data</p>
        ) : (
          <Bar data={chartData} options={options} />
        )}
      </CardContent>
    </Card>
  );
}
