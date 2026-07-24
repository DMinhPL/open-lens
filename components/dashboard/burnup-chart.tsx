"use client";

import "@/lib/chart-setup";
import { Line } from "react-chartjs-2";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useChartInk } from "@/lib/use-chart-colors";
import { CATEGORICAL } from "@/lib/chart-theme";
import type { BurnupPoint } from "@/lib/types";

interface BurnupChartProps {
  title: string;
  data: BurnupPoint[];
}

export function BurnupChart({ title, data }: BurnupChartProps) {
  const ink = useChartInk();
  const scopeColor = ink.isDark ? "#9d8cf5" : '#e9d92c';

  const chartData = {
    labels: data.map((d) => d.label),
    datasets: [
      {
        label: "Total scope",
        data: data.map((d) => d.total),
        borderColor: scopeColor,
        backgroundColor: "transparent",
        borderDash: [6, 4],
        pointRadius: 0,
        borderWidth: 2,
        stepped: true,
      },
      {
        label: "Completed",
        data: data.map((d) => d.completed),
        borderColor: CATEGORICAL.aqua,
        backgroundColor: `${CATEGORICAL.aqua}26`,
        pointBackgroundColor: CATEGORICAL.aqua,
        pointRadius: 2,
        borderWidth: 2,
        fill: true,
        stepped: true,
      },
    ],
  };

  const options = {
    responsive: true,
    maintainAspectRatio: false,
    interaction: { mode: "index" as const, intersect: false },
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
        ticks: { color: ink.text, font: { size: 11 }, maxRotation: 0, autoSkip: true },
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
          <Line data={chartData} options={options} />
        )}
      </CardContent>
    </Card>
  );
}
