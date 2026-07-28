"use client";

import "@/core/colors/chart-setup";
import { Bar } from "react-chartjs-2";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useChartInk } from "@/core/colors/use-chart-colors";
import { CHART_COLORS } from "@/core/colors/chart-theme";
import type { TypeThroughput } from "@/core/domain/types";

interface TypeThroughputChartProps {
  title: string;
  data: TypeThroughput[];
}

export function TypeThroughputChart({ title, data }: TypeThroughputChartProps) {
  const ink = useChartInk();

  const chartData = {
    labels: data.map((d) => d.type),
    datasets: [
      {
        label: "Created",
        data: data.map((d) => d.created),
        backgroundColor: CHART_COLORS.blue,
        borderRadius: 4,
        maxBarThickness: 32,
      },
      {
        label: "Completed",
        data: data.map((d) => d.completed),
        backgroundColor: CHART_COLORS.aqua,
        borderRadius: 4,
        maxBarThickness: 32,
      },
    ],
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
        grid: { display: false },
        ticks: { color: ink.text, font: { size: 11 } },
        border: { color: ink.baseline },
      },
      y: {
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
        <CardTitle className="text-sm font-medium">{title}</CardTitle>
      </CardHeader>
      <CardContent className="h-64">
        {data.length === 0 ? (
          <p className="text-sm text-muted-foreground">No data</p>
        ) : (
          <Bar data={chartData} options={options} />
        )}
      </CardContent>
    </Card>
  );
}
