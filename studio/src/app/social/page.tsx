"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import {
  Share2,
  Instagram,
  Link2,
  Unlink,
  Send,
  Hash,
  Type,
  Image as ImageIcon,
} from "lucide-react";
import { motion } from "framer-motion";

interface PlatformConnection {
  id: string;
  platform: string;
  icon: typeof Instagram;
  connected: boolean;
  username?: string;
}

const PLATFORMS: PlatformConnection[] = [
  {
    id: "instagram",
    platform: "Instagram",
    icon: Instagram,
    connected: false,
  },
  {
    id: "tiktok",
    platform: "TikTok",
    icon: Share2,
    connected: false,
  },
  {
    id: "twitter",
    platform: "X (Twitter)",
    icon: Share2,
    connected: false,
  },
];

export default function SocialPage() {
  const t = useTranslations("social");
  const tc = useTranslations("common");
  const [platforms] = useState(PLATFORMS);
  const [caption, setCaption] = useState("");
  const [hashtags, setHashtags] = useState("");

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

      {/* Platform Connections */}
      <div className="space-y-3">
        <h2 className="text-xs font-semibold uppercase tracking-widest text-muted-foreground/60">
          {t("platforms")}
        </h2>
        <div className="grid gap-3 sm:grid-cols-3">
          {platforms.map((p) => (
            <Card key={p.id} className="glass-card">
              <CardContent className="flex items-center justify-between p-4">
                <div className="flex items-center gap-3">
                  <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary/10">
                    <p.icon className="h-5 w-5 text-primary" />
                  </div>
                  <div>
                    <p className="text-sm font-semibold">{t(`platformNames.${p.id}` as "platformNames.instagram" | "platformNames.tiktok" | "platformNames.twitter")}</p>
                    {p.connected ? (
                      <p className="text-[10px] text-emerald-500">
                        @{p.username}
                      </p>
                    ) : (
                      <p className="text-[10px] text-muted-foreground/50">
                        {t("notConnected")}
                      </p>
                    )}
                  </div>
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  className={
                    p.connected
                      ? "text-destructive hover:bg-destructive/10"
                      : ""
                  }
                >
                  {p.connected ? (
                    <>
                      <Unlink className="mr-1.5 h-3 w-3" />
                      {tc("disconnect")}
                    </>
                  ) : (
                    <>
                      <Link2 className="mr-1.5 h-3 w-3" />
                      {tc("connect")}
                    </>
                  )}
                </Button>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>

      {/* Post Creator */}
      <Card className="glass-card">
        <CardContent className="p-5 space-y-4">
          <div className="flex items-center gap-2">
            <Send className="h-4 w-4 text-primary" />
            <h2 className="text-sm font-semibold">{t("createPost")}</h2>
          </div>

          <div className="grid gap-4 lg:grid-cols-[1fr_300px]">
            <div className="space-y-4">
              <div className="space-y-2">
                <Label className="text-xs flex items-center gap-1.5">
                  <Type className="h-3 w-3" /> {t("caption")}
                </Label>
                <Textarea
                  value={caption}
                  onChange={(e) => setCaption(e.target.value)}
                  placeholder={t("captionPlaceholder")}
                  rows={4}
                  className="resize-none text-sm"
                />
                <p className="text-[10px] text-muted-foreground/50">
                  {t("captionLimit", { count: caption.length })}
                </p>
              </div>

              <div className="space-y-2">
                <Label className="text-xs flex items-center gap-1.5">
                  <Hash className="h-3 w-3" /> {t("hashtags")}
                </Label>
                <Input
                  value={hashtags}
                  onChange={(e) => setHashtags(e.target.value)}
                  placeholder={t("hashtagsPlaceholder")}
                  className="h-9 text-sm"
                />
              </div>

              <div className="flex gap-2">
                <Button
                  className="bg-gradient-to-r from-primary to-[oklch(0.70_0.22_310)] text-white"
                  disabled
                >
                  <Send className="mr-1.5 h-3.5 w-3.5" />
                  {t("postNow")}
                </Button>
                <Button variant="outline" disabled>
                  {t("schedule")}
                </Button>
              </div>

              <p className="text-[10px] text-muted-foreground/40">
                {t("connectRequired")}
              </p>
            </div>

            {/* Image Selection */}
            <div className="space-y-2">
              <Label className="text-xs flex items-center gap-1.5">
                <ImageIcon className="h-3 w-3" /> Select Image
              </Label>
              <div className="flex h-48 items-center justify-center rounded-xl border border-dashed border-primary/20 bg-primary/[0.02]">
                <div className="text-center text-muted-foreground/50">
                  <ImageIcon className="mx-auto mb-2 h-8 w-8 text-primary/30" />
                  <p className="text-xs">Select from Gallery</p>
                </div>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Post History */}
      <Card className="glass-card">
        <CardContent className="flex flex-col items-center justify-center py-16">
          <Share2 className="mb-4 h-12 w-12 text-muted-foreground/30" />
          <p className="text-lg font-medium text-muted-foreground/50">
            {t("noHistory")}
          </p>
          <p className="mt-1 text-sm text-muted-foreground/40">
            {t("postHistory")}
          </p>
        </CardContent>
      </Card>
    </motion.div>
  );
}
