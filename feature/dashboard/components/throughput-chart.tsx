"use client";

import "@/core/colors/chart-setup";
import { Bar } from "react-chartjs-2";
import { ChartHelpDialog } from "@/components/dashboard/chart-help-dialog";
import { Card, CardAction, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { CHART_COLORS } from "@/core/colors/chart-theme";
import { useChartInk } from "@/core/colors/use-chart-colors";
import type { ThroughputPoint } from "@/core/domain/types";

interface ThroughputChartProps {
  title: string;
  data: ThroughputPoint[];
}

export function ThroughputChart({ title, data }: ThroughputChartProps) {
  const ink = useChartInk();
  const chartData = {
    labels: data.map((point) => point.label),
    datasets: [
      {
        label: "Completed",
        data: data.map((point) => point.completedCount),
        backgroundColor: CHART_COLORS.aqua,
        borderRadius: 4,
        maxBarThickness: 40,
      },
    ],
  };
  const options = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: { display: false },
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
    <Card className="throughput-chart">
      <CardHeader className="throughput-chart__header">
        <CardTitle className="throughput-chart__title text-sm font-medium">{title}</CardTitle>
        <CardAction className="throughput-chart__help-action">
          <ChartHelpDialog
            title="Weekly throughput"
            description="Shows how many Tasks and Bugs were completed in each seven-day bucket."
          >
            <p className="text-sm text-muted-foreground">
              Taller bars mean more work finished during that interval. Use the pattern across
              buckets to judge delivery consistency; throughput measures quantity and does not
              show how long individual tickets took.
            </p>
          </ChartHelpDialog>
        </CardAction>
      </CardHeader>
      <CardContent className="throughput-chart__content h-64">
        {data.length === 0 ? (
          <p className="throughput-chart__empty-state text-sm text-muted-foreground">No data</p>
        ) : (
          <div className="throughput-chart__plot h-full">
            <Bar data={chartData} options={options} />
          </div>
        )}
      </CardContent>
    </Card>
  );
}
