"use client";

import "@/lib/chart-setup";
import { Bar } from "react-chartjs-2";
import { useChartInk } from "@/lib/use-chart-colors";
import { CATEGORICAL } from "@/lib/chart-theme";
import type { WorkloadEntry } from "@/lib/types";

interface WorkloadChartProps {
  data: WorkloadEntry[];
}

export function WorkloadChart({ data }: WorkloadChartProps) {
  const ink = useChartInk();

  const chartData = {
    labels: data.map((d) => d.key),
    datasets: [
      {
        label: "Tasks",
        data: data.map((d) => d.count),
        backgroundColor: CATEGORICAL.blue,
        borderRadius: 4,
        maxBarThickness: 36,
      },
    ],
  };

  const options = {
    indexAxis: "y" as const,
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
        beginAtZero: true,
        ticks: { color: ink.text, font: { size: 11 }, precision: 0 },
        grid: { color: ink.grid },
        border: { display: false },
      },
      y: {
        grid: { display: false },
        ticks: { color: ink.text, font: { size: 12 } },
        border: { color: ink.baseline },
      },
    },
  };

  const height = Math.max(160, data.length * 40);

  return (
    <div style={{ height }}>
      {data.length === 0 ? (
        <p className="text-sm text-muted-foreground">No data</p>
      ) : (
        <Bar data={chartData} options={options} />
      )}
    </div>
  );
}
