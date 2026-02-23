"use client";

import { useState, useMemo, useCallback } from "react";
import { useTranslations } from "next-intl";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Download,
  Trash2,
  Star,
  StarOff,
  Search,
  Image as ImageIcon,
  CheckSquare,
  X,
} from "lucide-react";
import { useGalleryStore } from "@/lib/store";
import { base64ToUrl, downloadBase64Image } from "@/lib/api";
import type { GeneratedImage } from "@/types";
import { motion, AnimatePresence } from "framer-motion";

type FilterType = "all" | "favorites" | "generate" | "edit" | "detailer";

const FILTER_KEYS: FilterType[] = ["all", "favorites", "generate", "edit", "detailer"];

export default function GalleryPage() {
  const t = useTranslations("gallery");
  const tc = useTranslations("common");

  const { images, removeImage, toggleFavorite, clearAll } = useGalleryStore();
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState<FilterType>("all");
  const [selectedImage, setSelectedImage] = useState<GeneratedImage | null>(
    null
  );
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const isBulkMode = selectedIds.size > 0;

  const filtered = useMemo(() => {
    let result = images;
    if (filter === "favorites") {
      result = result.filter((img) => img.favorite);
    } else if (filter !== "all") {
      result = result.filter((img) => img.action === filter);
    }
    if (search.trim()) {
      const q = search.toLowerCase();
      result = result.filter((img) => img.prompt.toLowerCase().includes(q));
    }
    return result;
  }, [images, filter, search]);

  const toggleSelect = useCallback((id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }, []);

  const handleBulkDownload = useCallback(() => {
    selectedIds.forEach((id) => {
      const img = images.find((i) => i.id === id);
      if (img) downloadBase64Image(img.base64, `influencer_${id.slice(0, 8)}.png`);
    });
    setSelectedIds(new Set());
  }, [selectedIds, images]);

  const handleBulkDelete = useCallback(() => {
    if (!confirm(`Delete ${selectedIds.size} images?`)) return;
    selectedIds.forEach((id) => removeImage(id));
    setSelectedIds(new Set());
  }, [selectedIds, removeImage]);

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3 }}
      className="space-y-5"
    >
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="font-[family-name:var(--font-display)] text-2xl font-bold tracking-tight">
            <span className="gradient-text">{t("heading")}</span>
          </h1>
          <p className="text-sm text-muted-foreground">
            {t("imageCount", { count: images.length })}
          </p>
        </div>
        {images.length > 0 && (
          <Button
            variant="outline"
            size="sm"
            className="text-xs"
            onClick={() => {
              if (confirm("Delete all images from gallery?")) clearAll();
            }}
          >
            <Trash2 className="mr-1.5 h-3 w-3" />
            {t("clearAll")}
          </Button>
        )}
      </div>

      {/* Filters */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground/50" />
          <Input
            placeholder={t("searchPlaceholder")}
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="h-9 border-border/50 bg-muted/30 pl-9 text-sm"
          />
        </div>
        <div className="flex flex-wrap gap-1.5">
          {FILTER_KEYS.map((key) => (
            <button
              key={key}
              onClick={() => setFilter(key)}
              className={`rounded-full px-3 py-1 text-xs font-medium transition-all ${
                filter === key
                  ? "bg-primary text-primary-foreground shadow-sm"
                  : "bg-muted/50 text-muted-foreground hover:bg-muted hover:text-foreground"
              }`}
            >
              {t(`filters.${key}`)}
            </button>
          ))}
        </div>
      </div>

      {/* Bulk Actions Bar */}
      <AnimatePresence>
        {isBulkMode && (
          <motion.div
            initial={{ opacity: 0, y: -8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            className="glass-card flex items-center justify-between rounded-xl p-3"
          >
            <span className="text-sm font-medium">
              {tc("selected", { count: selectedIds.size })}
            </span>
            <div className="flex gap-2">
              <Button size="sm" variant="outline" onClick={handleBulkDownload}>
                <Download className="mr-1.5 h-3 w-3" />
                {t("bulkDownload")}
              </Button>
              <Button
                size="sm"
                variant="outline"
                className="text-destructive hover:bg-destructive/10"
                onClick={handleBulkDelete}
              >
                <Trash2 className="mr-1.5 h-3 w-3" />
                {t("bulkDelete")}
              </Button>
              <Button
                size="sm"
                variant="ghost"
                onClick={() => setSelectedIds(new Set())}
              >
                <X className="h-3 w-3" />
              </Button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Grid */}
      {filtered.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-20 text-muted-foreground/50">
          <ImageIcon className="mb-4 h-14 w-14" />
          <p className="text-lg font-medium">{t("empty.title")}</p>
          <p className="text-sm">
            {images.length === 0
              ? t("empty.description")
              : tc("noResults")}
          </p>
        </div>
      ) : (
        <div className="columns-2 gap-3 space-y-3 sm:columns-3 lg:columns-4">
          {filtered.map((img, i) => (
            <motion.div
              key={img.id}
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: Math.min(i * 0.03, 0.3) }}
              className="break-inside-avoid"
            >
              <Card
                className={`group cursor-pointer overflow-hidden transition-all hover:shadow-xl hover:shadow-primary/5 ${
                  selectedIds.has(img.id) ? "ring-2 ring-primary" : ""
                }`}
                onClick={() =>
                  isBulkMode
                    ? toggleSelect(img.id)
                    : setSelectedImage(img)
                }
              >
                <div className="relative">
                  <img
                    src={base64ToUrl(img.base64)}
                    alt={img.prompt}
                    className="w-full object-cover transition-transform group-hover:scale-[1.03]"
                  />
                  <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/10 to-transparent opacity-0 transition-opacity group-hover:opacity-100" />

                  {/* Hover overlay actions */}
                  <div className="absolute bottom-2 left-2 right-2 flex items-end justify-between opacity-0 transition-opacity group-hover:opacity-100">
                    <Badge
                      variant="secondary"
                      className="bg-black/50 text-[9px] text-white backdrop-blur-sm"
                    >
                      {img.action}
                    </Badge>
                    <div className="flex gap-1">
                      <Button
                        size="icon"
                        variant="secondary"
                        className="h-7 w-7 bg-black/50 text-white backdrop-blur-sm hover:bg-black/70"
                        onClick={(e) => {
                          e.stopPropagation();
                          toggleSelect(img.id);
                        }}
                      >
                        <CheckSquare className="h-3 w-3" />
                      </Button>
                      <Button
                        size="icon"
                        variant="secondary"
                        className="h-7 w-7 bg-black/50 text-white backdrop-blur-sm hover:bg-black/70"
                        onClick={(e) => {
                          e.stopPropagation();
                          toggleFavorite(img.id);
                        }}
                      >
                        {img.favorite ? (
                          <Star className="h-3 w-3 fill-yellow-400 text-yellow-400" />
                        ) : (
                          <StarOff className="h-3 w-3" />
                        )}
                      </Button>
                      <Button
                        size="icon"
                        variant="secondary"
                        className="h-7 w-7 bg-black/50 text-white backdrop-blur-sm hover:bg-black/70"
                        onClick={(e) => {
                          e.stopPropagation();
                          downloadBase64Image(
                            img.base64,
                            `influencer_${img.id.slice(0, 8)}.png`
                          );
                        }}
                      >
                        <Download className="h-3 w-3" />
                      </Button>
                    </div>
                  </div>

                  {/* Fav indicator */}
                  {img.favorite && (
                    <Star className="absolute right-2 top-2 h-4 w-4 fill-yellow-400 text-yellow-400 drop-shadow" />
                  )}

                  {/* Selection check */}
                  {selectedIds.has(img.id) && (
                    <div className="absolute left-2 top-2 flex h-5 w-5 items-center justify-center rounded-full bg-primary text-white">
                      <CheckSquare className="h-3 w-3" />
                    </div>
                  )}
                </div>
              </Card>
            </motion.div>
          ))}
        </div>
      )}

      {/* Detail Dialog */}
      <Dialog
        open={!!selectedImage}
        onOpenChange={() => setSelectedImage(null)}
      >
        {selectedImage && (
          <DialogContent className="glass-card max-w-3xl border-border/50">
            <DialogHeader>
              <DialogTitle className="text-sm font-medium">
                {t("detail.prompt")}
              </DialogTitle>
            </DialogHeader>
            <div className="grid gap-4 md:grid-cols-[1fr_250px]">
              <div className="overflow-hidden rounded-xl glow-sm">
                <img
                  src={base64ToUrl(selectedImage.base64)}
                  alt={selectedImage.prompt}
                  className="w-full"
                />
              </div>
              <div className="space-y-4">
                <div>
                  <p className="mb-1 text-[10px] font-semibold uppercase tracking-widest text-muted-foreground/50">
                    {t("detail.prompt")}
                  </p>
                  <p className="text-sm leading-relaxed">
                    {selectedImage.prompt}
                  </p>
                </div>
                <div className="flex gap-2">
                  <div>
                    <p className="mb-1 text-[10px] font-semibold uppercase tracking-widest text-muted-foreground/50">
                      {t("detail.action")}
                    </p>
                    <Badge variant="outline" className="text-[10px]">
                      {selectedImage.action}
                    </Badge>
                  </div>
                  <div>
                    <p className="mb-1 text-[10px] font-semibold uppercase tracking-widest text-muted-foreground/50">
                      {t("detail.seed")}
                    </p>
                    <p className="font-mono text-xs">{selectedImage.seed}</p>
                  </div>
                </div>
                <div>
                  <p className="mb-1 text-[10px] font-semibold uppercase tracking-widest text-muted-foreground/50">
                    {t("detail.created")}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {new Date(selectedImage.created_at).toLocaleString()}
                  </p>
                </div>
                <div className="flex flex-wrap gap-2 pt-2">
                  <Button
                    size="sm"
                    variant="outline"
                    className="flex-1"
                    onClick={() =>
                      downloadBase64Image(
                        selectedImage.base64,
                        `influencer_${selectedImage.id.slice(0, 8)}.png`
                      )
                    }
                  >
                    <Download className="mr-1.5 h-3 w-3" />
                    {t("detail.download")}
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => toggleFavorite(selectedImage.id)}
                  >
                    {selectedImage.favorite ? (
                      <Star className="mr-1 h-3 w-3 fill-yellow-400" />
                    ) : (
                      <StarOff className="mr-1 h-3 w-3" />
                    )}
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    className="text-destructive hover:bg-destructive/10"
                    onClick={() => {
                      removeImage(selectedImage.id);
                      setSelectedImage(null);
                    }}
                  >
                    <Trash2 className="h-3 w-3" />
                  </Button>
                </div>
              </div>
            </div>
          </DialogContent>
        )}
      </Dialog>
    </motion.div>
  );
}
