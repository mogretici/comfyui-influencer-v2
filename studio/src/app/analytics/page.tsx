"use client";

import { useMemo } from "react";
import { useTranslations } from "next-intl";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  BarChart3,
  TrendingUp,
  Image as ImageIcon,
  Clock,
  Sparkles,
  PenTool,
  ZoomIn,
} from "lucide-react";
import { useGalleryStore } from "@/lib/store";
import { motion } from "framer-motion";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  AreaChart,
  Area,
} from "recharts";

const PIE_COLORS = ["#8b5cf6", "#ec4899", "#06b6d4", "#f59e0b"];

export default function AnalyticsPage() {
  const t = useTranslations("analytics");
  const images = useGalleryStore((s) => s.images);

  const stats = useMemo(() => {
    const byAction = { generate: 0, edit: 0, detailer: 0 };
    const byDay: Record<string, number> = {};
    const byHour: Record<number, number> = {};

    images.forEach((img) => {
      const action = img.action as keyof typeof byAction;
      if (byAction[action] !== undefined) byAction[action]++;

      const day = new Date(img.created_at).toLocaleDateString("en-US", {
        month: "short",
        day: "numeric",
      });
      byDay[day] = (byDay[day] || 0) + 1;

      const hour = new Date(img.created_at).getHours();
      byHour[hour] = (byHour[hour] || 0) + 1;
    });

    const dailyData = Object.entries(byDay)
      .slice(-14)
      .map(([day, count]) => ({ day, count }));

    const actionData = [
      { name: "Generated", value: byAction.generate, icon: Sparkles },
      { name: "Edited", value: byAction.edit, icon: PenTool },
      { name: "Enhanced", value: byAction.detailer, icon: ZoomIn },
    ].filter((d) => d.value > 0);

    const hourlyData = Array.from({ length: 24 }, (_, h) => ({
      hour: `${h}:00`,
      count: byHour[h] || 0,
    }));

    const thisWeek = images.filter((img) => {
      const d = new Date(img.created_at);
      const now = new Date();
      const weekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
      return d >= weekAgo;
    }).length;

    return { dailyData, actionData, hourlyData, thisWeek, byAction };
  }, [images]);

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3 }}
      className="space-y-6"
    >
      <div>
        <h1 className="font-[family-name:var(--font-display)] text-2xl font-bold tracking-tight">
          <span className="gradient-text">{t("heading")}</span>
        </h1>
        <p className="text-sm text-muted-foreground">
          {t("subtitle")}
        </p>
      </div>

      {/* Overview Cards */}
      <div className="grid gap-4 sm:grid-cols-4">
        {[
          {
            label: t("totalImages"),
            value: images.length,
            icon: ImageIcon,
            color: "text-primary",
          },
          {
            label: t("thisWeek"),
            value: stats.thisWeek,
            icon: TrendingUp,
            color: "text-emerald-500",
          },
          {
            label: t("generated"),
            value: stats.byAction.generate,
            icon: Sparkles,
            color: "text-violet-500",
          },
          {
            label: t("avgPerDay"),
            value:
              stats.dailyData.length > 0
                ? Math.round(
                    stats.dailyData.reduce((s, d) => s + d.count, 0) /
                      stats.dailyData.length
                  )
                : 0,
            icon: Clock,
            color: "text-amber-500",
          },
        ].map((card) => (
          <Card key={card.label} className="glass-card">
            <CardContent className="flex items-center gap-4 p-5">
              <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-primary/10">
                <card.icon className={`h-5 w-5 ${card.color}`} />
              </div>
              <div>
                <p className="text-2xl font-bold tracking-tight">
                  {card.value}
                </p>
                <p className="text-xs text-muted-foreground">{card.label}</p>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      <div className="grid gap-6 lg:grid-cols-[2fr_1fr]">
        {/* Daily Output Chart */}
        <Card className="glass-card">
          <CardContent className="p-5">
            <div className="mb-4 flex items-center gap-2">
              <BarChart3 className="h-4 w-4 text-primary" />
              <h2 className="text-sm font-semibold">{t("dailyOutput")}</h2>
            </div>
            <div className="h-64">
              {stats.dailyData.length > 0 ? (
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={stats.dailyData}>
                    <CartesianGrid
                      strokeDasharray="3 3"
                      stroke="oklch(0.5 0 0 / 0.1)"
                    />
                    <XAxis
                      dataKey="day"
                      tick={{ fontSize: 10 }}
                      stroke="oklch(0.5 0 0 / 0.3)"
                    />
                    <YAxis
                      tick={{ fontSize: 10 }}
                      stroke="oklch(0.5 0 0 / 0.3)"
                    />
                    <Tooltip />
                    <Bar dataKey="count" fill="#8b5cf6" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              ) : (
                <div className="flex h-full items-center justify-center text-sm text-muted-foreground/50">
                  No data yet — generate some images first
                </div>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Action Distribution */}
        <Card className="glass-card">
          <CardContent className="p-5">
            <div className="mb-4 flex items-center gap-2">
              <TrendingUp className="h-4 w-4 text-primary" />
              <h2 className="text-sm font-semibold">{t("byAction")}</h2>
            </div>
            <div className="h-48">
              {stats.actionData.length > 0 ? (
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={stats.actionData}
                      cx="50%"
                      cy="50%"
                      innerRadius={50}
                      outerRadius={75}
                      dataKey="value"
                    >
                      {stats.actionData.map((_, index) => (
                        <Cell
                          key={index}
                          fill={PIE_COLORS[index % PIE_COLORS.length]}
                        />
                      ))}
                    </Pie>
                    <Tooltip />
                  </PieChart>
                </ResponsiveContainer>
              ) : (
                <div className="flex h-full items-center justify-center text-sm text-muted-foreground/50">
                  No data yet
                </div>
              )}
            </div>
            <div className="mt-2 flex flex-wrap gap-2">
              {stats.actionData.map((d, i) => (
                <Badge
                  key={d.name}
                  variant="outline"
                  className="gap-1.5 text-[10px]"
                >
                  <span
                    className="h-2 w-2 rounded-full"
                    style={{
                      backgroundColor:
                        PIE_COLORS[i % PIE_COLORS.length],
                    }}
                  />
                  {d.name}: {d.value}
                </Badge>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Hourly Activity */}
      <Card className="glass-card">
        <CardContent className="p-5">
          <div className="mb-4 flex items-center gap-2">
            <Clock className="h-4 w-4 text-primary" />
            <h2 className="text-sm font-semibold">{t("hourlyActivity")}</h2>
          </div>
          <div className="h-48">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={stats.hourlyData}>
                <CartesianGrid
                  strokeDasharray="3 3"
                  stroke="oklch(0.5 0 0 / 0.1)"
                />
                <XAxis
                  dataKey="hour"
                  tick={{ fontSize: 9 }}
                  stroke="oklch(0.5 0 0 / 0.3)"
                />
                <YAxis
                  tick={{ fontSize: 10 }}
                  stroke="oklch(0.5 0 0 / 0.3)"
                />
                <Tooltip />
                <Area
                  type="monotone"
                  dataKey="count"
                  stroke="#8b5cf6"
                  fill="#8b5cf6"
                  fillOpacity={0.15}
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </CardContent>
      </Card>
    </motion.div>
  );
}
