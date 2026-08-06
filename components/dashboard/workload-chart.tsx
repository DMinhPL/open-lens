"use client";

import "@/core/colors/chart-setup";
import { Bar } from "react-chartjs-2";
import { useChartInk } from "@/core/colors/use-chart-colors";
import { getTypeColor } from "@/core/colors/type-colors";
import type { TaskBugWorkloadEntry } from "@/core/domain/types";

interface WorkloadChartProps {
  data: TaskBugWorkloadEntry[];
}

export function WorkloadChart({ data }: WorkloadChartProps) {
  const ink = useChartInk();

  const chartData = {
    labels: data.map((d) => d.key),
    datasets: [
      {
        label: "Task",
        data: data.map((d) => d.taskCount),
        backgroundColor: getTypeColor("Task"),
        borderRadius: 4,
        maxBarThickness: 36,
      },
      {
        label: "Bug",
        data: data.map((d) => d.bugCount),
        backgroundColor: getTypeColor("Bug"),
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
      legend: {
        display: true,
        position: "bottom" as const,
        labels: { color: ink.text, boxWidth: 12, font: { size: 11 } },
      },
      tooltip: ink.tooltip,
    },
    scales: {
      x: {
        stacked: true,
        beginAtZero: true,
        ticks: { color: ink.text, font: { size: 11 }, precision: 0 },
        grid: { color: ink.grid },
        border: { display: false },
      },
      y: {
        stacked: true,
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
