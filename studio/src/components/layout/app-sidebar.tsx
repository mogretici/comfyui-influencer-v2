"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useTranslations } from "next-intl";
import {
  Sparkles,
  Image,
  PenTool,
  LayoutGrid,
  Settings,
  Zap,
  Layers,
  BookImage,
  Calendar,
  UserCircle,
  Share2,
  BarChart3,
  ListOrdered,
  Wand2,
  FolderOpen,
} from "lucide-react";
import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarGroupLabel,
  SidebarGroupContent,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarHeader,
  SidebarFooter,
} from "@/components/ui/sidebar";
import { useSettingsStore, useGalleryStore } from "@/lib/store";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";

export function AppSidebar() {
  const pathname = usePathname();
  const isConfigured = useSettingsStore((s) => s.isConfigured);
  const imageCount = useGalleryStore((s) => s.images.length);
  const t = useTranslations("nav");
  const tc = useTranslations("common");

  const NAV_GROUPS = [
    {
      label: t("create"),
      items: [
        { title: t("dashboard"), href: "/", icon: LayoutGrid },
        { title: t("generateItem"), href: "/generate", icon: Sparkles },
        { title: t("batch"), href: "/batch", icon: Layers },
        { title: t("editor"), href: "/editor", icon: PenTool },
        { title: t("promptBuilder"), href: "/prompt-builder", icon: Wand2 },
      ],
    },
    {
      label: t("library"),
      items: [
        { title: t("gallery"), href: "/gallery", icon: Image },
        { title: t("collections"), href: "/collections", icon: FolderOpen },
        { title: t("calendar"), href: "/calendar", icon: Calendar },
      ],
    },
    {
      label: t("character"),
      items: [
        { title: t("profile"), href: "/character", icon: UserCircle },
        { title: t("social"), href: "/social", icon: Share2 },
      ],
    },
    {
      label: t("insights"),
      items: [
        { title: t("analytics"), href: "/analytics", icon: BarChart3 },
        { title: t("queue"), href: "/queue", icon: ListOrdered },
      ],
    },
    {
      label: t("system"),
      items: [{ title: t("settings"), href: "/settings", icon: Settings }],
    },
  ];

  const usagePercent = Math.min((imageCount / 500) * 100, 100);

  return (
    <Sidebar className="glass-sidebar">
      <SidebarHeader className="border-b border-white/10 px-5 py-4">
        <Link href="/" className="flex items-center gap-3">
          <div className="relative flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-br from-primary to-[oklch(0.70_0.22_310)] shadow-lg glow-sm">
            <Zap className="h-4.5 w-4.5 text-white" />
          </div>
          <div>
            <h1 className="font-[family-name:var(--font-display)] text-sm font-bold tracking-tight">
              AI Studio
            </h1>
            <p className="text-[10px] text-muted-foreground/70">
              Influencer Pipeline
            </p>
          </div>
        </Link>
      </SidebarHeader>

      <SidebarContent className="px-2 py-2">
        {NAV_GROUPS.map((group) => (
          <SidebarGroup key={group.label} className="py-1">
            <SidebarGroupLabel className="px-3 text-[10px] font-semibold uppercase tracking-widest text-muted-foreground/50">
              {group.label}
            </SidebarGroupLabel>
            <SidebarGroupContent>
              <SidebarMenu>
                {group.items.map((item) => {
                  const isActive =
                    item.href === "/"
                      ? pathname === "/"
                      : pathname.startsWith(item.href);

                  return (
                    <SidebarMenuItem key={item.href}>
                      <SidebarMenuButton
                        asChild
                        isActive={isActive}
                        className={
                          isActive
                            ? "accent-bar bg-primary/10 text-primary font-medium"
                            : "text-muted-foreground hover:text-foreground hover:bg-primary/5 transition-colors"
                        }
                      >
                        <Link href={item.href}>
                          <item.icon className="h-4 w-4" />
                          <span>{item.title}</span>
                          {item.href === "/settings" &&
                            !isConfigured() && (
                              <Badge
                                variant="destructive"
                                className="ml-auto h-5 px-1.5 text-[9px]"
                              >
                                {t("setup")}
                              </Badge>
                            )}
                        </Link>
                      </SidebarMenuButton>
                    </SidebarMenuItem>
                  );
                })}
              </SidebarMenu>
            </SidebarGroupContent>
          </SidebarGroup>
        ))}
      </SidebarContent>

      <SidebarFooter className="border-t border-white/10 p-4">
        <div className="space-y-2">
          <div className="flex items-center justify-between text-[10px]">
            <span className="text-muted-foreground/70">{t("imagesGenerated")}</span>
            <span className="font-medium text-muted-foreground">
              {imageCount}
              <span className="text-muted-foreground/50"> / 500</span>
            </span>
          </div>
          <Progress value={usagePercent} className="h-1.5" />
          <div className="flex items-center gap-1.5 pt-1">
            <BookImage className="h-3 w-3 text-muted-foreground/50" />
            <span className="text-[10px] text-muted-foreground/50">
              {t("pipelineInfo")}
            </span>
          </div>
        </div>
      </SidebarFooter>
    </Sidebar>
  );
}
