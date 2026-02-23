"use client";

import { useState, useRef, useCallback } from "react";
import { useTranslations } from "next-intl";
import { toast } from "sonner";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import {
  UserCircle,
  Save,
  Upload,
  Trash2,
  Sparkles,
  Tag,
  FileText,
} from "lucide-react";
import { useCharacterStore } from "@/lib/store";
import { fileToBase64, base64ToUrl } from "@/lib/api";
import { motion } from "framer-motion";

export default function CharacterPage() {
  const t = useTranslations("character");
  const tc = useTranslations("common");
  const { character, setCharacter, clearCharacter } = useCharacterStore();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [name, setName] = useState(character?.name ?? "");
  const [triggerWord, setTriggerWord] = useState(
    character?.trigger_word ?? "ohwx woman"
  );
  const [description, setDescription] = useState(
    character?.description ?? ""
  );
  const [faceLora, setFaceLora] = useState(
    character?.face_lora ?? "my_face.safetensors"
  );
  const [referenceImages, setReferenceImages] = useState<string[]>(
    character?.reference_images ?? []
  );

  const handleSave = useCallback(() => {
    if (!name.trim()) {
      toast.error("Enter a character name");
      return;
    }
    setCharacter({
      name,
      trigger_word: triggerWord,
      description,
      face_lora: faceLora,
      reference_images: referenceImages,
      created_at: character?.created_at ?? new Date().toISOString(),
    });
    toast.success(t("profileSaved"));
  }, [
    name,
    triggerWord,
    description,
    faceLora,
    referenceImages,
    character,
    setCharacter,
  ]);

  const handleAddReferenceImage = useCallback(
    async (e: React.ChangeEvent<HTMLInputElement>) => {
      const files = e.target.files;
      if (!files) return;

      for (const file of Array.from(files)) {
        try {
          const base64 = await fileToBase64(file);
          setReferenceImages((prev) => [...prev, base64]);
        } catch {
          toast.error(`Failed to read ${file.name}`);
        }
      }
      if (fileInputRef.current) fileInputRef.current.value = "";
    },
    []
  );

  const removeRef = useCallback((index: number) => {
    setReferenceImages((prev) => prev.filter((_, i) => i !== index));
  }, []);

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3 }}
      className="mx-auto max-w-3xl space-y-6"
    >
      <div>
        <h1 className="font-[family-name:var(--font-display)] text-2xl font-bold tracking-tight">
          <span className="gradient-text">{t("heading")}</span>
        </h1>
        <p className="text-sm text-muted-foreground">
          {t("subtitle")}
        </p>
      </div>

      {/* Profile Card */}
      <Card className="glass-card overflow-hidden">
        <div className="h-24 bg-gradient-to-r from-primary/20 via-[oklch(0.70_0.22_310)]/20 to-primary/10" />
        <CardContent className="relative -mt-10 p-5">
          <div className="mb-6 flex h-20 w-20 items-center justify-center rounded-2xl border-4 border-background bg-gradient-to-br from-primary to-[oklch(0.70_0.22_310)] shadow-lg">
            <UserCircle className="h-10 w-10 text-white" />
          </div>

          <div className="space-y-4">
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label className="text-xs flex items-center gap-1.5">
                  <UserCircle className="h-3 w-3" /> {t("name")}
                </Label>
                <Input
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder={t("namePlaceholder")}
                  className="h-9 text-sm"
                />
              </div>
              <div className="space-y-2">
                <Label className="text-xs flex items-center gap-1.5">
                  <Tag className="h-3 w-3" /> {t("triggerWord")}
                </Label>
                <Input
                  value={triggerWord}
                  onChange={(e) => setTriggerWord(e.target.value)}
                  placeholder={t("triggerWordPlaceholder")}
                  className="h-9 font-mono text-sm"
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label className="text-xs flex items-center gap-1.5">
                <FileText className="h-3 w-3" /> {t("bio")}
              </Label>
              <Textarea
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder={t("bioPlaceholder")}
                rows={3}
                className="resize-none text-sm"
              />
            </div>

            <div className="space-y-2">
              <Label className="text-xs flex items-center gap-1.5">
                <Sparkles className="h-3 w-3" /> {t("faceLoraFile")}
              </Label>
              <Input
                value={faceLora}
                onChange={(e) => setFaceLora(e.target.value)}
                placeholder="my_face.safetensors"
                className="h-9 font-mono text-sm"
              />
            </div>

            {character && (
              <div className="flex items-center gap-2">
                <Badge
                  variant="outline"
                  className="border-emerald-500/30 bg-emerald-500/10 text-emerald-500"
                >
                  Active
                </Badge>
                <span className="text-[10px] text-muted-foreground">
                  Created{" "}
                  {new Date(character.created_at).toLocaleDateString()}
                </span>
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Reference Images */}
      <Card className="glass-card">
        <CardContent className="p-5">
          <div className="mb-4 flex items-center justify-between">
            <div>
              <h2 className="text-sm font-semibold">{t("referencePhotos")}</h2>
              <p className="text-[10px] text-muted-foreground">
                {t("referencePhotosHint")}
              </p>
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={() => fileInputRef.current?.click()}
            >
              <Upload className="mr-1.5 h-3 w-3" />
              Add Photos
            </Button>
          </div>

          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            multiple
            className="hidden"
            onChange={handleAddReferenceImage}
          />

          {referenceImages.length === 0 ? (
            <button
              onClick={() => fileInputRef.current?.click()}
              className="flex h-40 w-full items-center justify-center rounded-xl border-2 border-dashed border-primary/20 transition-colors hover:border-primary/40 hover:bg-primary/5"
            >
              <div className="text-center text-muted-foreground/50">
                <Upload className="mx-auto mb-2 h-8 w-8" />
                <p className="text-sm">Upload reference photos</p>
              </div>
            </button>
          ) : (
            <div className="grid grid-cols-3 gap-2 sm:grid-cols-4 md:grid-cols-6">
              {referenceImages.map((img, i) => (
                <div
                  key={i}
                  className="group relative aspect-square overflow-hidden rounded-lg border border-border/50"
                >
                  <img
                    src={base64ToUrl(img)}
                    alt={`Reference ${i + 1}`}
                    className="h-full w-full object-cover"
                  />
                  <button
                    onClick={() => removeRef(i)}
                    className="absolute right-1 top-1 flex h-5 w-5 items-center justify-center rounded-full bg-black/60 text-white opacity-0 transition-opacity group-hover:opacity-100"
                  >
                    <Trash2 className="h-2.5 w-2.5" />
                  </button>
                </div>
              ))}
            </div>
          )}

          <p className="mt-2 text-[10px] text-muted-foreground/50">
            {referenceImages.length} / 20 photos
          </p>
        </CardContent>
      </Card>

      {/* Actions */}
      <div className="flex gap-3">
        <Button
          className="flex-1 bg-gradient-to-r from-primary to-[oklch(0.70_0.22_310)] text-white shadow-lg hover:shadow-primary/25 hover:brightness-110"
          onClick={handleSave}
        >
          <Save className="mr-2 h-4 w-4" />
          {tc("save")}
        </Button>
        {character && (
          <Button
            variant="outline"
            className="text-destructive hover:bg-destructive/10"
            onClick={() => {
              if (confirm(t("profileReset"))) {
                clearCharacter();
                setName("");
                setTriggerWord("ohwx woman");
                setDescription("");
                setFaceLora("my_face.safetensors");
                setReferenceImages([]);
              }
            }}
          >
            <Trash2 className="h-4 w-4" />
          </Button>
        )}
      </div>
    </motion.div>
  );
}
