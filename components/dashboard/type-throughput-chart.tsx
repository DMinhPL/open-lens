"use client";

import "@/lib/chart-setup";
import { Bar } from "react-chartjs-2";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useChartInk } from "@/lib/use-chart-colors";
import { CATEGORICAL } from "@/lib/chart-theme";
import type { TypeThroughput } from "@/lib/types";

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
        backgroundColor: CATEGORICAL.blue,
        borderRadius: 4,
        maxBarThickness: 32,
      },
      {
        label: "Completed",
        data: data.map((d) => d.completed),
        backgroundColor: CATEGORICAL.aqua,
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
      tooltip: {
        backgroundColor: ink.isDark ? "#1a1a19" : "#fcfcfb",
        titleColor: ink.isDark ? "#ffffff" : "#0b0b0b",
        bodyColor: ink.isDark ? "#c3c2b7" : "#52514e",
        borderColor: ink.grid,
        borderWidth: 1,
        padding: 8,
      },
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
