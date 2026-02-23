"use client";

import { useMemo } from "react";
import { useTranslations } from "next-intl";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Sparkles,
  Image,
  PenTool,
  Settings,
  ArrowRight,
  Star,
  TrendingUp,
  Zap,
  Layers,
  Wand2,
  Calendar,
} from "lucide-react";
import Link from "next/link";
import { useGalleryStore, useSettingsStore } from "@/lib/store";
import { motion } from "framer-motion";

const container = {
  hidden: { opacity: 0 },
  show: {
    opacity: 1,
    transition: { staggerChildren: 0.06 },
  },
};

const item = {
  hidden: { opacity: 0, y: 12 },
  show: {
    opacity: 1,
    y: 0,
    transition: { duration: 0.4, ease: [0.25, 0.46, 0.45, 0.94] as const },
  },
};

const PIPELINE_BADGES = [
  "Flux 2 Dev 32B (Q5 GGUF)",
  "Custom Face LoRA",
  "IP-Adapter v2",
  "Realism LoRA",
  "FaceDetailer",
  "4x-UltraSharp",
  "RunPod Serverless",
];

export default function DashboardPage() {
  const t = useTranslations("dashboard");
  const tc = useTranslations("common");
  const tp = useTranslations();
  const images = useGalleryStore((s) => s.images);
  const isConfigured = useSettingsStore((s) => s.isConfigured);

  const QUICK_ACTIONS = [
    {
      title: t("actions.generate.title"),
      description: t("actions.generate.description"),
      href: "/generate",
      icon: Sparkles,
      gradient: "from-violet-600 to-purple-600",
      glow: "group-hover:shadow-violet-500/25",
    },
    {
      title: t("actions.editor.title"),
      description: t("actions.editor.description"),
      href: "/editor",
      icon: PenTool,
      gradient: "from-pink-600 to-rose-600",
      glow: "group-hover:shadow-pink-500/25",
    },
    {
      title: t("actions.gallery.title"),
      description: t("actions.gallery.description"),
      href: "/gallery",
      icon: Image,
      gradient: "from-blue-600 to-cyan-600",
      glow: "group-hover:shadow-blue-500/25",
    },
    {
      title: t("actions.batch.title"),
      description: t("actions.batch.description"),
      href: "/batch",
      icon: Layers,
      gradient: "from-amber-600 to-orange-600",
      glow: "group-hover:shadow-amber-500/25",
    },
    {
      title: t("actions.promptBuilder.title"),
      description: t("actions.promptBuilder.description"),
      href: "/prompt-builder",
      icon: Wand2,
      gradient: "from-emerald-600 to-teal-600",
      glow: "group-hover:shadow-emerald-500/25",
    },
    {
      title: t("actions.calendar.title"),
      description: t("actions.calendar.description"),
      href: "/calendar",
      icon: Calendar,
      gradient: "from-indigo-600 to-blue-600",
      glow: "group-hover:shadow-indigo-500/25",
    },
  ];

  const stats = useMemo(() => {
    const today = new Date().toDateString();
    return {
      total: images.length,
      today: images.filter(
        (img) => new Date(img.created_at).toDateString() === today
      ).length,
      favorites: images.filter((img) => img.favorite).length,
    };
  }, [images]);

  return (
    <motion.div
      variants={container}
      initial="hidden"
      animate="show"
      className="space-y-8"
    >
      {/* Hero */}
      <motion.div variants={item} className="space-y-2">
        <h1 className="font-[family-name:var(--font-display)] text-4xl font-bold tracking-tight">
          <span className="gradient-text">{t("heading")}</span>
        </h1>
        <p className="text-lg text-muted-foreground">
          {t("subtitle")}
        </p>
      </motion.div>

      {/* Setup Alert */}
      {!isConfigured() && (
        <motion.div variants={item}>
          <Card className="border-destructive/30 bg-destructive/5">
            <CardContent className="flex items-center justify-between p-4">
              <div>
                <p className="font-semibold">{t("setupRequired")}</p>
                <p className="text-sm text-muted-foreground">
                  {t("setupDescription")}
                </p>
              </div>
              <Button asChild>
                <Link href="/settings">
                  <Settings className="mr-2 h-4 w-4" />
                  {tc("configure")}
                </Link>
              </Button>
            </CardContent>
          </Card>
        </motion.div>
      )}

      {/* Stat Cards */}
      <motion.div variants={item} className="grid gap-4 sm:grid-cols-3">
        {[
          {
            label: t("totalImages"),
            value: stats.total,
            icon: Image,
            color: "text-primary",
          },
          {
            label: t("today"),
            value: stats.today,
            icon: TrendingUp,
            color: "text-emerald-500",
          },
          {
            label: t("favorites"),
            value: stats.favorites,
            icon: Star,
            color: "text-amber-500",
          },
        ].map((stat) => (
          <Card key={stat.label} className="glass-card group transition-all hover:glow-sm">
            <CardContent className="flex items-center gap-4 p-5">
              <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-primary/10">
                <stat.icon className={`h-5 w-5 ${stat.color}`} />
              </div>
              <div>
                <p className="text-2xl font-bold tracking-tight">{stat.value}</p>
                <p className="text-xs text-muted-foreground">{stat.label}</p>
              </div>
            </CardContent>
          </Card>
        ))}
      </motion.div>

      {/* Recent Images Carousel */}
      {images.length > 0 && (
        <motion.div variants={item} className="space-y-3">
          <div className="flex items-center justify-between">
            <h2 className="font-[family-name:var(--font-display)] text-lg font-semibold">
              {t("recentCreations")}
            </h2>
            <Button variant="ghost" size="sm" asChild>
              <Link href="/gallery" className="text-xs text-muted-foreground">
                {tc("viewAll")} <ArrowRight className="ml-1 h-3 w-3" />
              </Link>
            </Button>
          </div>
          <div className="flex gap-3 overflow-x-auto pb-2 scrollbar-hide">
            {images.slice(0, 8).map((img, i) => (
              <motion.div
                key={img.id}
                initial={{ opacity: 0, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ delay: i * 0.05 }}
                className="group relative aspect-square w-32 shrink-0 overflow-hidden rounded-xl border border-border/50"
              >
                <img
                  src={`data:image/png;base64,${img.base64}`}
                  alt={img.prompt}
                  className="h-full w-full object-cover transition-transform group-hover:scale-105"
                />
                <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent opacity-0 transition-opacity group-hover:opacity-100" />
              </motion.div>
            ))}
          </div>
        </motion.div>
      )}

      {/* Quick Actions */}
      <motion.div variants={item} className="space-y-3">
        <h2 className="font-[family-name:var(--font-display)] text-lg font-semibold">
          {t("quickActions")}
        </h2>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {QUICK_ACTIONS.map((action) => (
            <Link key={action.href} href={action.href}>
              <Card
                className={`group glass-card cursor-pointer transition-all hover:scale-[1.02] hover:shadow-xl ${action.glow}`}
              >
                <CardContent className="flex items-center gap-4 p-5">
                  <div
                    className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br ${action.gradient} shadow-lg`}
                  >
                    <action.icon className="h-5 w-5 text-white" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="font-semibold">{action.title}</p>
                    <p className="truncate text-xs text-muted-foreground">
                      {action.description}
                    </p>
                  </div>
                  <ArrowRight className="h-4 w-4 shrink-0 text-muted-foreground/50 transition-transform group-hover:translate-x-1 group-hover:text-foreground" />
                </CardContent>
              </Card>
            </Link>
          ))}
        </div>
      </motion.div>

      {/* Pipeline Stack */}
      <motion.div variants={item}>
        <Card className="glass-card">
          <CardContent className="p-5">
            <div className="mb-3 flex items-center gap-2">
              <Zap className="h-4 w-4 text-primary" />
              <h3 className="text-sm font-semibold">{t("pipelineStack")}</h3>
            </div>
            <div className="flex flex-wrap gap-2">
              {PIPELINE_BADGES.map((tech) => (
                <Badge
                  key={tech}
                  variant="secondary"
                  className="bg-primary/5 text-primary/80 border-primary/10"
                >
                  {tech}
                </Badge>
              ))}
            </div>
          </CardContent>
        </Card>
      </motion.div>
    </motion.div>
  );
}
