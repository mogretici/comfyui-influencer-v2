"use client";

import { useState, useMemo } from "react";
import { useTranslations } from "next-intl";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  ListOrdered,
  Clock,
  CheckCircle2,
  XCircle,
  Loader2,
  Trash2,
  RefreshCw,
  Pause,
} from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { create } from "zustand";

type JobStatus = "pending" | "running" | "completed" | "failed";

interface QueueJob {
  id: string;
  prompt: string;
  status: JobStatus;
  created_at: string;
  completed_at?: string;
  error?: string;
  result_preview?: string;
  duration?: number;
}

interface QueueState {
  jobs: QueueJob[];
  addJob: (job: QueueJob) => void;
  updateJob: (id: string, partial: Partial<QueueJob>) => void;
  removeJob: (id: string) => void;
  clearCompleted: () => void;
}

const useQueueStore = create<QueueState>()((set) => ({
  jobs: [],
  addJob: (job) => set((s) => ({ jobs: [...s.jobs, job] })),
  updateJob: (id, partial) =>
    set((s) => ({
      jobs: s.jobs.map((j) => (j.id === id ? { ...j, ...partial } : j)),
    })),
  removeJob: (id) =>
    set((s) => ({ jobs: s.jobs.filter((j) => j.id !== id) })),
  clearCompleted: () =>
    set((s) => ({ jobs: s.jobs.filter((j) => j.status !== "completed") })),
}));

const STATUS_CONFIG: Record<
  JobStatus,
  { icon: typeof Clock; color: string }
> = {
  pending: {
    icon: Clock,
    color: "text-muted-foreground border-border",
  },
  running: {
    icon: Loader2,
    color: "text-primary border-primary/30 bg-primary/5",
  },
  completed: {
    icon: CheckCircle2,
    color: "text-emerald-500 border-emerald-500/30 bg-emerald-500/5",
  },
  failed: {
    icon: XCircle,
    color: "text-destructive border-destructive/30 bg-destructive/5",
  },
};

export default function QueuePage() {
  const t = useTranslations("queue");
  const tc = useTranslations("common");
  const { jobs, removeJob, clearCompleted } = useQueueStore();
  const [filter, setFilter] = useState<JobStatus | "all">("all");

  const filtered = useMemo(() => {
    if (filter === "all") return jobs;
    return jobs.filter((j) => j.status === filter);
  }, [jobs, filter]);

  const counts = useMemo(
    () => ({
      pending: jobs.filter((j) => j.status === "pending").length,
      running: jobs.filter((j) => j.status === "running").length,
      completed: jobs.filter((j) => j.status === "completed").length,
      failed: jobs.filter((j) => j.status === "failed").length,
    }),
    [jobs]
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
        {counts.completed > 0 && (
          <Button variant="outline" size="sm" onClick={clearCompleted}>
            <Trash2 className="mr-1.5 h-3 w-3" />
            {tc("clear")}
          </Button>
        )}
      </div>

      {/* Stats */}
      <div className="grid grid-cols-4 gap-3">
        {(
          [
            { key: "pending", icon: Clock },
            { key: "running", icon: Loader2 },
            { key: "completed", icon: CheckCircle2 },
            { key: "failed", icon: XCircle },
          ] as const
        ).map((stat) => (
          <Card
            key={stat.key}
            className={`glass-card cursor-pointer transition-all ${
              filter === stat.key ? "ring-1 ring-primary" : ""
            }`}
            onClick={() =>
              setFilter(filter === stat.key ? "all" : stat.key)
            }
          >
            <CardContent className="flex items-center gap-3 p-4">
              <stat.icon
                className={`h-5 w-5 ${
                  stat.key === "running" ? "animate-spin text-primary" : ""
                } ${stat.key === "completed" ? "text-emerald-500" : ""} ${
                  stat.key === "failed" ? "text-destructive" : ""
                } ${stat.key === "pending" ? "text-muted-foreground" : ""}`}
              />
              <div>
                <p className="text-xl font-bold">
                  {counts[stat.key]}
                </p>
                <p className="text-[10px] text-muted-foreground">
                  {t(`statuses.${stat.key}`)}
                </p>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Job List */}
      {jobs.length === 0 ? (
        <Card className="glass-card">
          <CardContent className="flex flex-col items-center justify-center py-20">
            <ListOrdered className="mb-4 h-14 w-14 text-muted-foreground/30" />
            <p className="text-lg font-medium text-muted-foreground/50">
              {t("empty")}
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-2">
          <AnimatePresence>
            {filtered.map((job) => {
              const config = STATUS_CONFIG[job.status];
              const StatusIcon = config.icon;

              return (
                <motion.div
                  key={job.id}
                  initial={{ opacity: 0, x: -8 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: 8 }}
                  layout
                >
                  <Card className="glass-card">
                    <CardContent className="flex items-center gap-4 p-4">
                      <StatusIcon
                        className={`h-5 w-5 shrink-0 ${
                          job.status === "running" ? "animate-spin" : ""
                        } ${config.color.split(" ")[0]}`}
                      />

                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-medium">
                          {job.prompt}
                        </p>
                        <div className="mt-1 flex items-center gap-2">
                          <Badge
                            variant="outline"
                            className={`text-[9px] ${config.color}`}
                          >
                            {t(`statuses.${job.status}`)}
                          </Badge>
                          <span className="text-[10px] text-muted-foreground/50">
                            {new Date(job.created_at).toLocaleTimeString()}
                          </span>
                          {job.duration && (
                            <span className="text-[10px] text-muted-foreground/50">
                              {Math.round(job.duration / 1000)}s
                            </span>
                          )}
                        </div>
                        {job.error && (
                          <p className="mt-1 text-[10px] text-destructive">
                            {job.error}
                          </p>
                        )}
                      </div>

                      <div className="flex gap-1">
                        {job.status === "failed" && (
                          <Button
                            size="icon"
                            variant="ghost"
                            className="h-7 w-7"
                          >
                            <RefreshCw className="h-3 w-3" />
                          </Button>
                        )}
                        {job.status === "running" && (
                          <Button
                            size="icon"
                            variant="ghost"
                            className="h-7 w-7"
                          >
                            <Pause className="h-3 w-3" />
                          </Button>
                        )}
                        <Button
                          size="icon"
                          variant="ghost"
                          className="h-7 w-7 text-muted-foreground"
                          onClick={() => removeJob(job.id)}
                        >
                          <Trash2 className="h-3 w-3" />
                        </Button>
                      </div>
                    </CardContent>
                  </Card>
                </motion.div>
              );
            })}
          </AnimatePresence>
        </div>
      )}
    </motion.div>
  );
}
