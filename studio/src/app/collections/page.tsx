"use client";

import { useState, useCallback } from "react";
import { useTranslations } from "next-intl";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  FolderOpen,
  Plus,
  Trash2,
  Image as ImageIcon,
  Edit2,
} from "lucide-react";
import { motion } from "framer-motion";
import { create } from "zustand";
import { persist } from "zustand/middleware";

interface Collection {
  id: string;
  name: string;
  description: string;
  imageIds: string[];
  coverImage?: string;
  created_at: string;
}

interface CollectionState {
  collections: Collection[];
  addCollection: (c: Collection) => void;
  removeCollection: (id: string) => void;
  updateCollection: (id: string, partial: Partial<Collection>) => void;
}

const useCollectionStore = create<CollectionState>()(
  persist(
    (set) => ({
      collections: [],
      addCollection: (c) =>
        set((s) => ({ collections: [...s.collections, c] })),
      removeCollection: (id) =>
        set((s) => ({
          collections: s.collections.filter((c) => c.id !== id),
        })),
      updateCollection: (id, partial) =>
        set((s) => ({
          collections: s.collections.map((c) =>
            c.id === id ? { ...c, ...partial } : c
          ),
        })),
    }),
    { name: "studio-collections" }
  )
);

export default function CollectionsPage() {
  const t = useTranslations("collections");
  const tc = useTranslations("common");
  const { collections, addCollection, removeCollection } =
    useCollectionStore();
  const [newName, setNewName] = useState("");
  const [newDesc, setNewDesc] = useState("");
  const [dialogOpen, setDialogOpen] = useState(false);

  const handleCreate = useCallback(() => {
    if (!newName.trim()) return;
    addCollection({
      id: crypto.randomUUID(),
      name: newName.trim(),
      description: newDesc.trim(),
      imageIds: [],
      created_at: new Date().toISOString(),
    });
    setNewName("");
    setNewDesc("");
    setDialogOpen(false);
  }, [newName, newDesc, addCollection]);

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
        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <DialogTrigger asChild>
            <Button size="sm">
              <Plus className="mr-1.5 h-3 w-3" />
              {t("createNew")}
            </Button>
          </DialogTrigger>
          <DialogContent className="glass-card">
            <DialogHeader>
              <DialogTitle>{tc("create")} {t("heading")}</DialogTitle>
            </DialogHeader>
            <div className="space-y-4 pt-2">
              <div className="space-y-2">
                <Input
                  value={newName}
                  onChange={(e) => setNewName(e.target.value)}
                  placeholder={t("namePlaceholder")}
                  className="h-9"
                />
              </div>
              <div className="space-y-2">
                <Input
                  value={newDesc}
                  onChange={(e) => setNewDesc(e.target.value)}
                  placeholder={t("descriptionPlaceholder")}
                  className="h-9"
                />
              </div>
              <Button
                className="w-full bg-gradient-to-r from-primary to-[oklch(0.70_0.22_310)] text-white"
                onClick={handleCreate}
                disabled={!newName.trim()}
              >
                <Plus className="mr-1.5 h-3 w-3" />
                {tc("create")}
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      {collections.length === 0 ? (
        <Card className="glass-card">
          <CardContent className="flex flex-col items-center justify-center py-20">
            <FolderOpen className="mb-4 h-14 w-14 text-muted-foreground/30" />
            <p className="text-lg font-medium text-muted-foreground/50">
              {t("empty.title")}
            </p>
            <p className="mt-1 text-sm text-muted-foreground/40">
              {t("empty.description")}
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {collections.map((collection) => (
            <motion.div
              key={collection.id}
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
            >
              <Card className="glass-card group cursor-pointer overflow-hidden transition-all hover:shadow-xl hover:shadow-primary/5">
                <div className="relative aspect-video bg-gradient-to-br from-primary/5 to-[oklch(0.70_0.22_310)]/5">
                  {collection.coverImage ? (
                    <img
                      src={collection.coverImage}
                      alt={collection.name}
                      className="h-full w-full object-cover"
                    />
                  ) : (
                    <div className="flex h-full items-center justify-center">
                      <FolderOpen className="h-12 w-12 text-primary/20" />
                    </div>
                  )}
                  <div className="absolute inset-0 bg-gradient-to-t from-black/50 to-transparent opacity-0 transition-opacity group-hover:opacity-100" />
                  <div className="absolute bottom-2 right-2 flex gap-1 opacity-0 transition-opacity group-hover:opacity-100">
                    <Button
                      size="icon"
                      variant="secondary"
                      className="h-7 w-7 bg-black/50 text-white backdrop-blur-sm"
                      onClick={(e) => {
                        e.stopPropagation();
                      }}
                    >
                      <Edit2 className="h-3 w-3" />
                    </Button>
                    <Button
                      size="icon"
                      variant="secondary"
                      className="h-7 w-7 bg-black/50 text-white backdrop-blur-sm"
                      onClick={(e) => {
                        e.stopPropagation();
                        if (confirm(`Delete "${collection.name}"?`))
                          removeCollection(collection.id);
                      }}
                    >
                      <Trash2 className="h-3 w-3" />
                    </Button>
                  </div>
                </div>
                <CardContent className="p-4">
                  <h3 className="font-semibold">{collection.name}</h3>
                  {collection.description && (
                    <p className="mt-0.5 text-xs text-muted-foreground">
                      {collection.description}
                    </p>
                  )}
                  <div className="mt-2 flex items-center gap-1.5 text-[10px] text-muted-foreground/50">
                    <ImageIcon className="h-3 w-3" />
                    {t("imageCount", { count: collection.imageIds.length })}
                  </div>
                </CardContent>
              </Card>
            </motion.div>
          ))}
        </div>
      )}
    </motion.div>
  );
}
