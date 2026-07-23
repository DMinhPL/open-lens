"use client";

import "@/lib/chart-setup";
import { Line } from "react-chartjs-2";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useChartInk } from "@/lib/use-chart-colors";
import { CATEGORICAL } from "@/lib/chart-theme";
import type { TrendPoint } from "@/lib/types";

interface TrendChartProps {
  title: string;
  data: TrendPoint[];
}

export function TrendChart({ title, data }: TrendChartProps) {
  const ink = useChartInk();

  const chartData = {
    labels: data.map((d) => d.label),
    datasets: [
      {
        label: "Completed",
        data: data.map((d) => d.completed),
        borderColor: CATEGORICAL.blue,
        backgroundColor: `${CATEGORICAL.blue}26`,
        pointBackgroundColor: CATEGORICAL.blue,
        pointRadius: 3,
        borderWidth: 2,
        fill: true,
        tension: 0.3,
      },
    ],
  };

  const options = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: { display: false },
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
        <Line data={chartData} options={options} />
      </CardContent>
    </Card>
  );
}
