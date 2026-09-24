"use client";

import "@/core/colors/chart-setup";
import { Line } from "react-chartjs-2";
import { ChartHelpDialog } from "@/components/dashboard/chart-help-dialog";
import { Card, CardAction, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useChartInk } from "@/core/colors/use-chart-colors";
import { CHART_COLORS } from "@/core/colors/chart-theme";
import type { TrendPoint } from "@/core/domain/types";

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
        borderColor: CHART_COLORS.blue,
        backgroundColor: `${CHART_COLORS.blue}26`,
        pointBackgroundColor: CHART_COLORS.blue,
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
    <Card className="trend-chart">
      <CardHeader className="trend-chart__header">
        <CardTitle className="text-sm font-medium">{title}</CardTitle>
        <CardAction>
          <ChartHelpDialog
            title="Completion trend"
            description="Shows how many tickets were completed in each time bucket."
          >
            <p className="text-sm text-muted-foreground">
              The horizontal axis follows the selected weekly, monthly, quarterly, or yearly
              grouping. Rising values mean more tickets finished during that bucket; this
              chart measures output volume, not how long each ticket took.
            </p>
          </ChartHelpDialog>
        </CardAction>
      </CardHeader>
      <CardContent className="trend-chart__content h-64">
        <Line data={chartData} options={options} />
      </CardContent>
    </Card>
  );
}
