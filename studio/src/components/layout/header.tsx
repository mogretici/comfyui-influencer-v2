"use client";

import { usePathname } from "next/navigation";
import { useTheme } from "next-themes";
import { useTranslations } from "next-intl";
import { SidebarTrigger } from "@/components/ui/sidebar";
import { Separator } from "@/components/ui/separator";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { useGenerationStore, useSettingsStore } from "@/lib/store";
import {
  Loader2,
  Sun,
  Moon,
  Bell,
  CheckCircle2,
  AlertCircle,
} from "lucide-react";
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from "@/components/ui/breadcrumb";

export function Header() {
  const pathname = usePathname();
  const { theme, setTheme } = useTheme();
  const isGenerating = useGenerationStore((s) => s.isGenerating);
  const progress = useGenerationStore((s) => s.progress);
  const isConfigured = useSettingsStore((s) => s.isConfigured);
  const t = useTranslations("header");

  const PAGE_TITLES: Record<string, string> = {
    "/": t("pageTitles./"),
    "/generate": t("pageTitles./generate"),
    "/batch": t("pageTitles./batch"),
    "/editor": t("pageTitles./editor"),
    "/prompt-builder": t("pageTitles./prompt-builder"),
    "/gallery": t("pageTitles./gallery"),
    "/collections": t("pageTitles./collections"),
    "/calendar": t("pageTitles./calendar"),
    "/character": t("pageTitles./character"),
    "/social": t("pageTitles./social"),
    "/analytics": t("pageTitles./analytics"),
    "/queue": t("pageTitles./queue"),
    "/settings": t("pageTitles./settings"),
  };

  const pageTitle = PAGE_TITLES[pathname] || "AI Studio";
  const isHome = pathname === "/";

  return (
    <header className="relative flex h-14 shrink-0 items-center gap-2 border-b border-border/50 px-4">
      <SidebarTrigger className="-ml-1" />
      <Separator orientation="vertical" className="mr-2 h-4" />

      <Breadcrumb>
        <BreadcrumbList>
          {!isHome && (
            <>
              <BreadcrumbItem>
                <BreadcrumbLink href="/">{t("studio")}</BreadcrumbLink>
              </BreadcrumbItem>
              <BreadcrumbSeparator />
            </>
          )}
          <BreadcrumbItem>
            <BreadcrumbPage className="font-medium">{pageTitle}</BreadcrumbPage>
          </BreadcrumbItem>
        </BreadcrumbList>
      </Breadcrumb>

      <div className="ml-auto flex items-center gap-2">
        {isGenerating && (
          <Badge
            variant="secondary"
            className="gap-1.5 bg-primary/10 text-primary border-primary/20"
          >
            <Loader2 className="h-3 w-3 animate-spin" />
            <span className="text-xs">{progress || t("generating")}</span>
          </Badge>
        )}

        <Button
          variant="ghost"
          size="icon"
          className="h-8 w-8 text-muted-foreground hover:text-foreground"
        >
          <Bell className="h-4 w-4" />
        </Button>

        <Button
          variant="ghost"
          size="icon"
          className="h-8 w-8 text-muted-foreground hover:text-foreground"
          onClick={() => setTheme(theme === "dark" ? "light" : "dark")}
        >
          <Sun className="h-4 w-4 rotate-0 scale-100 transition-transform dark:-rotate-90 dark:scale-0" />
          <Moon className="absolute h-4 w-4 rotate-90 scale-0 transition-transform dark:rotate-0 dark:scale-100" />
        </Button>

        <Separator orientation="vertical" className="h-4" />

        {isConfigured() ? (
          <Badge
            variant="outline"
            className="gap-1 border-emerald-500/30 bg-emerald-500/10 text-emerald-500"
          >
            <CheckCircle2 className="h-3 w-3" />
            <span className="text-[10px]">{t("connected")}</span>
          </Badge>
        ) : (
          <Badge
            variant="outline"
            className="gap-1 border-destructive/30 bg-destructive/10 text-destructive"
          >
            <AlertCircle className="h-3 w-3" />
            <span className="text-[10px]">{t("notConfigured")}</span>
          </Badge>
        )}
      </div>

      {isGenerating && (
        <div className="absolute bottom-0 left-0 right-0">
          <Progress
            value={30}
            className="h-0.5 rounded-none [&>div]:bg-gradient-to-r [&>div]:from-primary [&>div]:via-[oklch(0.70_0.22_310)] [&>div]:to-primary [&>div]:animate-pulse"
          />
        </div>
      )}
    </header>
  );
}
