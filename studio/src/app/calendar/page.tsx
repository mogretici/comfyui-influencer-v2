"use client";

import { useState, useMemo, useCallback } from "react";
import { useTranslations } from "next-intl";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Calendar as CalendarIcon,
  ChevronLeft,
  ChevronRight,
  Plus,
  Instagram,
  Clock,
  CheckCircle2,
  FileEdit,
} from "lucide-react";
import { motion } from "framer-motion";
import {
  addDays,
  startOfWeek,
  format,
  isSameDay,
  addWeeks,
  subWeeks,
  isToday,
} from "date-fns";

type ContentStatus = "draft" | "scheduled" | "published";

interface CalendarItem {
  id: string;
  date: string;
  title: string;
  platform: "instagram" | "tiktok" | "both";
  status: ContentStatus;
  imagePreview?: string;
}

const STATUS_COLORS: Record<ContentStatus, string> = {
  draft: "bg-muted text-muted-foreground",
  scheduled: "bg-primary/10 text-primary border-primary/20",
  published: "bg-emerald-500/10 text-emerald-500 border-emerald-500/20",
};

const STATUS_ICONS: Record<ContentStatus, typeof Clock> = {
  draft: FileEdit,
  scheduled: Clock,
  published: CheckCircle2,
};

const MOCK_ITEMS: CalendarItem[] = [
  {
    id: "1",
    date: new Date().toISOString(),
    title: "Beach photoshoot reveal",
    platform: "instagram",
    status: "scheduled",
  },
  {
    id: "2",
    date: addDays(new Date(), 1).toISOString(),
    title: "Cafe lifestyle series",
    platform: "both",
    status: "draft",
  },
  {
    id: "3",
    date: addDays(new Date(), 3).toISOString(),
    title: "Street fashion lookbook",
    platform: "tiktok",
    status: "draft",
  },
];

export default function CalendarPage() {
  const t = useTranslations("calendar");
  const tc = useTranslations("common");
  const [currentWeek, setCurrentWeek] = useState(
    startOfWeek(new Date(), { weekStartsOn: 1 })
  );
  const [items] = useState<CalendarItem[]>(MOCK_ITEMS);

  const weekDays = useMemo(() => {
    return Array.from({ length: 7 }, (_, i) => addDays(currentWeek, i));
  }, [currentWeek]);

  const getItemsForDay = useCallback(
    (day: Date) => {
      return items.filter((item) => isSameDay(new Date(item.date), day));
    },
    [items]
  );

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3 }}
      className="space-y-6"
    >
      <div className="flex items-center justify-between">
        <div>
          <h1 className="font-[family-name:var(--font-display)] text-2xl font-bold tracking-tight">
            <span className="gradient-text">{t("heading")}</span>
          </h1>
          <p className="text-sm text-muted-foreground">
            {t("subtitle")}
          </p>
        </div>
        <Button size="sm">
          <Plus className="mr-1.5 h-3 w-3" />
          {t("addContent")}
        </Button>
      </div>

      {/* Week Navigation */}
      <div className="flex items-center justify-between">
        <Button
          variant="outline"
          size="icon"
          className="h-8 w-8"
          onClick={() => setCurrentWeek(subWeeks(currentWeek, 1))}
        >
          <ChevronLeft className="h-4 w-4" />
        </Button>
        <div className="flex items-center gap-2">
          <CalendarIcon className="h-4 w-4 text-primary" />
          <span className="text-sm font-semibold">
            {format(weekDays[0], "MMM d")} — {format(weekDays[6], "MMM d, yyyy")}
          </span>
        </div>
        <Button
          variant="outline"
          size="icon"
          className="h-8 w-8"
          onClick={() => setCurrentWeek(addWeeks(currentWeek, 1))}
        >
          <ChevronRight className="h-4 w-4" />
        </Button>
      </div>

      {/* Week Grid */}
      <div className="grid grid-cols-7 gap-2">
        {weekDays.map((day) => {
          const dayItems = getItemsForDay(day);
          const today = isToday(day);

          return (
            <Card
              key={day.toISOString()}
              className={`glass-card min-h-[180px] transition-all ${
                today ? "ring-1 ring-primary/50" : ""
              }`}
            >
              <CardContent className="p-3">
                <div className="mb-3 flex items-center justify-between">
                  <div>
                    <p className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground/50">
                      {format(day, "EEE")}
                    </p>
                    <p
                      className={`text-lg font-bold ${
                        today ? "text-primary" : ""
                      }`}
                    >
                      {format(day, "d")}
                    </p>
                  </div>
                  {today && (
                    <Badge
                      variant="outline"
                      className="h-5 border-primary/30 bg-primary/10 px-1.5 text-[8px] text-primary"
                    >
                      {tc("today")}
                    </Badge>
                  )}
                </div>

                <div className="space-y-1.5">
                  {dayItems.map((item) => {
                    const StatusIcon = STATUS_ICONS[item.status];
                    return (
                      <div
                        key={item.id}
                        className={`rounded-md border p-2 text-[10px] ${STATUS_COLORS[item.status]}`}
                      >
                        <div className="flex items-center gap-1">
                          <StatusIcon className="h-2.5 w-2.5" />
                          <span className="truncate font-medium">
                            {item.title}
                          </span>
                        </div>
                        <div className="mt-1 flex items-center gap-1">
                          {(item.platform === "instagram" ||
                            item.platform === "both") && (
                            <Instagram className="h-2.5 w-2.5" />
                          )}
                          {(item.platform === "tiktok" ||
                            item.platform === "both") && (
                            <span className="text-[8px]">TT</span>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>
    </motion.div>
  );
}
