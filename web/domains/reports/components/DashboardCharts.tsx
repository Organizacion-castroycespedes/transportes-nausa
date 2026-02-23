"use client";

import { Card } from "../../../components/design-system/Card";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  LabelList,
  Line,
  LineChart,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { ChartTooltip } from "./ChartTooltip";

type DashboardChartsProps = {
  byStatus: Array<{ status: string; count: number }>;
  byDay: Array<{ date: string; count: number }>;
  monthlyTrend?: Array<{ month: string; total: number; finalized: number }>;
};

const STATUS_COLORS: Record<string, string> = {
  FINALIZED: "#16a34a",
  REPORTED: "#f59e0b",
  DRAFT: "#64748b",
};

const SERIES_COLORS = {
  dailyBars: "#0ea5e9",
  totalLine: "#2563eb",
  finalizedLine: "#16a34a",
};

const formatDateShort = (value: string) => {
  const date = new Date(`${value}T00:00:00`);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleDateString("es-CO", { day: "2-digit", month: "2-digit" });
};

export const DashboardCharts = ({ byStatus, byDay, monthlyTrend }: DashboardChartsProps) => {
  const statusTotal = byStatus.reduce((acc, item) => acc + item.count, 0);
  const statusChartData = byStatus.map((item) => ({
    ...item,
    color: STATUS_COLORS[item.status] ?? "#8b5cf6",
    percent: statusTotal > 0 ? Math.round((item.count / statusTotal) * 100) : 0,
  }));

  const dailyTotal = byDay.reduce((acc, item) => acc + item.count, 0);
  const dailyPeak = byDay.reduce<{ date: string; count: number } | null>(
    (current, item) => (!current || item.count > current.count ? item : current),
    null
  );
  const dailyAvg = byDay.length > 0 ? (dailyTotal / byDay.length).toFixed(1) : "0";
  const lastMonthPoint = monthlyTrend?.[monthlyTrend.length - 1];

  return (
    <div className="grid gap-4 xl:grid-cols-3">
      <Card className="p-4 xl:col-span-1">
        <div className="flex items-start justify-between gap-3">
          <div>
            <h2 className="text-sm font-semibold text-card-foreground">Inspecciones por estado</h2>
            <p className="text-xs text-muted-foreground">
              Distribucion actual de estados (leyenda fija por color).
            </p>
          </div>
          <div className="rounded-xl border border-border bg-muted/40 px-3 py-2 text-right">
            <p className="text-[11px] uppercase tracking-wide text-muted-foreground">Total</p>
            <p className="text-lg font-semibold text-card-foreground">{statusTotal}</p>
          </div>
        </div>

        <div className="mt-4 grid gap-3 sm:grid-cols-[minmax(0,1fr)_160px]">
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={statusChartData}
                  dataKey="count"
                  nameKey="status"
                  outerRadius={86}
                  innerRadius={48}
                  paddingAngle={3}
                  stroke="var(--color-card)"
                  strokeWidth={2}
                >
                  {statusChartData.map((entry) => (
                    <Cell key={entry.status} fill={entry.color} />
                  ))}
                </Pie>
                <Tooltip content={<ChartTooltip />} />
              </PieChart>
            </ResponsiveContainer>
          </div>

          <div className="space-y-2">
            {statusChartData.map((item) => (
              <div key={item.status} className="rounded-xl border border-border bg-card px-3 py-2">
                <div className="flex items-center justify-between gap-2">
                  <span className="inline-flex items-center gap-2 text-xs text-card-foreground">
                    <span
                      className="inline-block h-2.5 w-2.5 rounded-full"
                      style={{ backgroundColor: item.color }}
                    />
                    {item.status}
                  </span>
                  <span className="text-xs font-semibold text-card-foreground">{item.percent}%</span>
                </div>
                <p className="mt-1 text-base font-semibold text-card-foreground">{item.count}</p>
              </div>
            ))}
            {statusChartData.length === 0 ? (
              <p className="text-xs text-muted-foreground">Sin datos para mostrar.</p>
            ) : null}
          </div>
        </div>
      </Card>

      <Card className="p-4 xl:col-span-2">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h2 className="text-sm font-semibold text-card-foreground">Inspecciones por dia (30 dias)</h2>
            <p className="text-xs text-muted-foreground">
              Cada barra muestra inspecciones registradas por fecha (valor visible arriba).
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <div className="rounded-xl border border-border bg-muted/40 px-3 py-2">
              <p className="text-[11px] uppercase tracking-wide text-muted-foreground">Total periodo</p>
              <p className="text-sm font-semibold text-card-foreground">{dailyTotal}</p>
            </div>
            <div className="rounded-xl border border-border bg-muted/40 px-3 py-2">
              <p className="text-[11px] uppercase tracking-wide text-muted-foreground">Promedio/dia</p>
              <p className="text-sm font-semibold text-card-foreground">{dailyAvg}</p>
            </div>
            <div className="rounded-xl border border-border bg-muted/40 px-3 py-2">
              <p className="text-[11px] uppercase tracking-wide text-muted-foreground">Pico</p>
              <p className="text-sm font-semibold text-card-foreground">
                {dailyPeak ? `${dailyPeak.count} (${formatDateShort(dailyPeak.date)})` : "N/A"}
              </p>
            </div>
          </div>
        </div>

        <div className="mt-4 h-72">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={byDay} margin={{ top: 16, right: 12, left: 0, bottom: 8 }}>
              <CartesianGrid stroke="var(--color-border)" vertical={false} />
              <XAxis
                dataKey="date"
                tickFormatter={formatDateShort}
                minTickGap={18}
                tick={{ fill: "var(--color-muted-foreground)", fontSize: 11 }}
              />
              <YAxis tick={{ fill: "var(--color-muted-foreground)", fontSize: 11 }} />
              <Tooltip content={<ChartTooltip />} />
              <Bar dataKey="count" name="Inspecciones" fill={SERIES_COLORS.dailyBars} radius={[6, 6, 0, 0]}>
                {byDay.map((item, index) => (
                  <Cell
                    key={`${item.date}-${index}`}
                    fill={
                      dailyPeak && item.date === dailyPeak.date && item.count === dailyPeak.count
                        ? "#0284c7"
                        : SERIES_COLORS.dailyBars
                    }
                  />
                ))}
                <LabelList dataKey="count" position="top" className="fill-muted-foreground text-[10px]" />
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>

        <div className="mt-3 flex flex-wrap gap-2 text-xs">
          <span className="inline-flex items-center gap-2 rounded-full border border-border px-3 py-1 text-card-foreground">
            <span className="h-2 w-2 rounded-full" style={{ backgroundColor: SERIES_COLORS.dailyBars }} />
            Volumen diario
          </span>
          <span className="inline-flex items-center gap-2 rounded-full border border-border px-3 py-1 text-card-foreground">
            <span className="h-2 w-2 rounded-full" style={{ backgroundColor: "#0284c7" }} />
            Dia con mayor registro
          </span>
        </div>
      </Card>

      {monthlyTrend && monthlyTrend.length > 0 ? (
        <Card className="p-4 xl:col-span-3">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <h2 className="text-sm font-semibold text-card-foreground">Tendencia mensual</h2>
              <p className="text-xs text-muted-foreground">
                Comparativo fijo: linea azul = total mensual, linea verde = finalizadas.
              </p>
            </div>
            <div className="flex flex-wrap gap-2">
              <div className="inline-flex items-center gap-2 rounded-xl border border-border bg-card px-3 py-2 text-xs">
                <span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: SERIES_COLORS.totalLine }} />
                <span className="text-card-foreground">Total mensual</span>
              </div>
              <div className="inline-flex items-center gap-2 rounded-xl border border-border bg-card px-3 py-2 text-xs">
                <span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: SERIES_COLORS.finalizedLine }} />
                <span className="text-card-foreground">Finalizadas</span>
              </div>
              <div className="rounded-xl border border-border bg-muted/40 px-3 py-2">
                <p className="text-[11px] uppercase tracking-wide text-muted-foreground">Ultimo mes</p>
                <p className="text-sm font-semibold text-card-foreground">
                  {lastMonthPoint ? `${lastMonthPoint.month}: ${lastMonthPoint.finalized}/${lastMonthPoint.total}` : "N/A"}
                </p>
              </div>
            </div>
          </div>

          <div className="mt-4 h-72">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={monthlyTrend} margin={{ top: 10, right: 12, left: 0, bottom: 8 }}>
                <CartesianGrid stroke="var(--color-border)" vertical={false} />
                <XAxis dataKey="month" tick={{ fill: "var(--color-muted-foreground)", fontSize: 11 }} />
                <YAxis tick={{ fill: "var(--color-muted-foreground)", fontSize: 11 }} />
                <Tooltip content={<ChartTooltip />} />
                <Line
                  type="monotone"
                  dataKey="total"
                  name="Total"
                  stroke={SERIES_COLORS.totalLine}
                  strokeWidth={2.5}
                  dot={{ r: 3, fill: SERIES_COLORS.totalLine }}
                  activeDot={{ r: 5 }}
                />
                <Line
                  type="monotone"
                  dataKey="finalized"
                  name="Finalizadas"
                  stroke={SERIES_COLORS.finalizedLine}
                  strokeWidth={2.5}
                  dot={{ r: 3, fill: SERIES_COLORS.finalizedLine }}
                  activeDot={{ r: 5 }}
                />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </Card>
      ) : null}
    </div>
  );
};
