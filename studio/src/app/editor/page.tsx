"use client";

import { useState, useCallback, useRef } from "react";
import { useTranslations } from "next-intl";
import { toast } from "sonner";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Slider } from "@/components/ui/slider";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import {
  Upload,
  Loader2,
  Download,
  Wand2,
  ZoomIn,
  PenTool,
  ArrowLeftRight,
  X,
  Settings2,
  Info,
  AlertTriangle,
  ChevronDown,
} from "lucide-react";
import {
  useSettingsStore,
  useGenerationStore,
  useGalleryStore,
} from "@/lib/store";
import {
  getRunPodClient,
  fileToBase64,
  base64ToUrl,
  downloadBase64Image,
} from "@/lib/api";
import { DEFAULT_NEGATIVE_PROMPT } from "@/lib/presets";
import {
  CHANGE_AMOUNTS,
  PARAM_HINTS,
  type ChangeAmount,
} from "@/lib/quality-presets";
import type { EditParams, DetailerParams } from "@/types";
import { motion, AnimatePresence } from "framer-motion";
import {
  ReactCompareSlider,
  ReactCompareSliderImage,
} from "react-compare-slider";

/* ─── Smart Slider with Hints ─────────────────────────── */

function SmartSlider({
  paramKey,
  value,
  onChange,
}: {
  paramKey: string;
  value: number;
  onChange: (v: number) => void;
}) {
  const th = useTranslations("quality");
  const tg = useTranslations("generate");
  const hint = PARAM_HINTS[paramKey];
  if (!hint) return null;

  const isOutOfRange =
    value < hint.recommendedMin || value > hint.recommendedMax;
  const hintKey = hint.hintKey;

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-1.5">
          <Label className="text-xs">{th(`hints.${hintKey}.label`)}</Label>
          <TooltipProvider delayDuration={200}>
            <Tooltip>
              <TooltipTrigger asChild>
                <Info className="h-3 w-3 cursor-help text-muted-foreground/40" />
              </TooltipTrigger>
              <TooltipContent side="top" className="max-w-[280px] text-xs">
                <p>{th(`hints.${hintKey}.description`)}</p>
                <p className="mt-1 font-medium text-primary">
                  {tg("recommended")}: {th(`hints.${hintKey}.recommended`)}
                </p>
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>
        </div>
        <span
          className={`rounded px-1.5 py-0.5 font-mono text-[10px] ${
            isOutOfRange
              ? "bg-amber-500/10 text-amber-500"
              : "bg-muted/50 text-muted-foreground"
          }`}
        >
          {value}
        </span>
      </div>
      <Slider
        value={[value]}
        onValueChange={([v]) => onChange(v)}
        min={hint.min}
        max={hint.max}
        step={hint.step}
      />
      {isOutOfRange && (
        <p className="flex items-center gap-1 text-[10px] text-amber-500">
          <AlertTriangle className="h-2.5 w-2.5" />
          {th.has(`hints.${hintKey}.warning`)
            ? th(`hints.${hintKey}.warning`)
            : tg("outOfRange")}
        </p>
      )}
    </div>
  );
}

/* ─── Change Amount Icons ─────────────────────────── */

const CHANGE_ICONS = ["🎨", "👗", "🌍"] as const;

/* ─── Page ─────────────────────────────────────────────── */

export default function EditorPage() {
  const t = useTranslations("editor");
  const tq = useTranslations("quality");
  const te = useTranslations("errors");

  const { settings } = useSettingsStore();
  const isConfigured = useSettingsStore((s) => s.isConfigured);
  const { isGenerating, setGenerating, setProgress } = useGenerationStore();
  const addImage = useGalleryStore((s) => s.addImage);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [inputImage, setInputImage] = useState<string | null>(null);
  const [inputPreview, setInputPreview] = useState<string | null>(null);
  const [editPrompt, setEditPrompt] = useState("");
  const [editNegative, setEditNegative] = useState(DEFAULT_NEGATIVE_PROMPT);

  // Simple mode: change amount selector
  const [changeAmount, setChangeAmount] = useState<ChangeAmount>("moderate");
  const [editDenoise, setEditDenoise] = useState(0.6);
  const [detailerDenoise, setDetailerDenoise] = useState(0.42);

  // Advanced mode toggle
  const [showAdvanced, setShowAdvanced] = useState(false);

  const [resultImage, setResultImage] = useState<string | null>(null);
  const [showCompare, setShowCompare] = useState(false);
  const [isDragOver, setIsDragOver] = useState(false);

  // When change amount changes, update denoise
  const handleChangeAmountSelect = useCallback(
    (amount: ChangeAmount) => {
      setChangeAmount(amount);
      if (!showAdvanced) {
        const preset = CHANGE_AMOUNTS.find((c) => c.id === amount);
        if (preset) setEditDenoise(preset.denoise);
      }
    },
    [showAdvanced]
  );

  const handleFileUpload = useCallback(
    async (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (!file) return;
      try {
        const base64 = await fileToBase64(file);
        setInputImage(base64);
        setInputPreview(URL.createObjectURL(file));
        setResultImage(null);
        setShowCompare(false);
      } catch {
        toast.error(t("fileReadError"));
      }
    },
    []
  );

  const handleDrop = useCallback(async (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(false);
    const file = e.dataTransfer.files?.[0];
    if (!file || !file.type.startsWith("image/")) return;
    try {
      const base64 = await fileToBase64(file);
      setInputImage(base64);
      setInputPreview(URL.createObjectURL(file));
      setResultImage(null);
      setShowCompare(false);
    } catch {
      toast.error(t("fileReadError"));
    }
  }, []);

  const handleEdit = useCallback(async () => {
    if (!isConfigured()) {
      toast.error(te("notConfigured"));
      return;
    }
    if (!inputImage) {
      toast.error(te("noImage"));
      return;
    }
    if (!editPrompt.trim()) {
      toast.error(t("noPromptEdit"));
      return;
    }

    setGenerating(true);
    setProgress(t("applying"));
    setResultImage(null);

    try {
      const client = getRunPodClient(
        settings.runpod_api_key,
        settings.runpod_endpoint_id
      );

      const params: EditParams = {
        action: "edit",
        prompt: editPrompt,
        negative_prompt: editNegative,
        input_image: inputImage,
        denoise: editDenoise,
        face_lora: settings.default_face_lora,
        face_lora_strength: settings.default_face_lora_strength,
      };

      const result = await client.runAndWait(params, setProgress);

      if (result.output?.images?.length) {
        const img = result.output.images[0];
        setResultImage(img);
        addImage({
          id: crypto.randomUUID(),
          base64: img,
          prompt: editPrompt,
          negative_prompt: editNegative,
          action: "edit",
          params: params as unknown as Record<string, unknown>,
          seed: result.output.seed ?? -1,
          created_at: new Date().toISOString(),
          favorite: false,
        });
        toast.success(t("editSuccess"));
      } else {
        toast.error(result.output?.error || te("generationFailed"));
      }
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : te("unknown")
      );
    } finally {
      setGenerating(false);
      setProgress("");
    }
  }, [
    isConfigured,
    inputImage,
    editPrompt,
    editNegative,
    editDenoise,
    settings,
    setGenerating,
    setProgress,
    addImage,
    t,
    te,
  ]);

  const handleDetailer = useCallback(async () => {
    if (!isConfigured()) {
      toast.error(te("notConfigured"));
      return;
    }
    if (!inputImage) {
      toast.error(te("noImage"));
      return;
    }

    setGenerating(true);
    setProgress(t("enhancing"));
    setResultImage(null);

    try {
      const client = getRunPodClient(
        settings.runpod_api_key,
        settings.runpod_endpoint_id
      );

      const params: DetailerParams = {
        action: "detailer",
        input_image: inputImage,
        face_detailer_denoise: detailerDenoise,
        upscale_factor: 4,
      };

      const result = await client.runAndWait(params, setProgress);

      if (result.output?.images?.length) {
        const img = result.output.images[0];
        setResultImage(img);
        addImage({
          id: crypto.randomUUID(),
          base64: img,
          prompt: t("detailerButton"),
          negative_prompt: "",
          action: "detailer",
          params: params as unknown as Record<string, unknown>,
          seed: result.output.seed ?? -1,
          created_at: new Date().toISOString(),
          favorite: false,
        });
        toast.success(t("detailerSuccess"));
      } else {
        toast.error(result.output?.error || te("generationFailed"));
      }
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : te("unknown")
      );
    } finally {
      setGenerating(false);
      setProgress("");
    }
  }, [
    isConfigured,
    inputImage,
    detailerDenoise,
    settings,
    setGenerating,
    setProgress,
    addImage,
  ]);

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

      {/* Image Split View */}
      <div className="grid gap-4 lg:grid-cols-2">
        {/* Input */}
        <Card className="glass-card overflow-hidden">
          <CardContent className="p-4">
            <div className="mb-3 flex items-center justify-between">
              <h3 className="text-xs font-semibold uppercase tracking-widest text-muted-foreground/60">
                {t("originalImage")}
              </h3>
              {inputPreview && (
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-6 w-6"
                  aria-label={t("removeImage")}
                  onClick={() => {
                    setInputImage(null);
                    setInputPreview(null);
                    setResultImage(null);
                    setShowCompare(false);
                  }}
                >
                  <X className="h-3 w-3" />
                </Button>
              )}
            </div>
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              className="hidden"
              onChange={handleFileUpload}
            />
            <AnimatePresence mode="wait">
              {inputPreview ? (
                <motion.div
                  key="preview"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  className="space-y-3"
                >
                  <div className="overflow-hidden rounded-xl border border-border/50">
                    <img
                      src={inputPreview}
                      alt={t("original")}
                      className="w-full"
                    />
                  </div>
                  <Button
                    variant="outline"
                    size="sm"
                    className="w-full"
                    onClick={() => fileInputRef.current?.click()}
                  >
                    <Upload className="mr-1.5 h-3 w-3" />
                    {t("selectDifferent")}
                  </Button>
                </motion.div>
              ) : (
                <motion.button
                  key="upload"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  onClick={() => fileInputRef.current?.click()}
                  onDragOver={(e) => {
                    e.preventDefault();
                    setIsDragOver(true);
                  }}
                  onDragLeave={() => setIsDragOver(false)}
                  onDrop={handleDrop}
                  className={`flex aspect-square w-full items-center justify-center rounded-xl border-2 border-dashed transition-all ${
                    isDragOver
                      ? "border-primary bg-primary/10 scale-[1.02]"
                      : "border-primary/20 hover:border-primary/40 hover:bg-primary/5"
                  }`}
                >
                  <div className="text-center text-muted-foreground/60">
                    <Upload className="mx-auto mb-3 h-10 w-10 text-primary/30" />
                    <p className="text-sm font-medium">{t("uploadImage")}</p>
                    <p className="mt-1 text-xs">
                      {t("uploadHint")}
                    </p>
                  </div>
                </motion.button>
              )}
            </AnimatePresence>
          </CardContent>
        </Card>

        {/* Output */}
        <Card className="glass-card overflow-hidden">
          <CardContent className="p-4">
            <div className="mb-3 flex items-center justify-between">
              <h3 className="text-xs font-semibold uppercase tracking-widest text-muted-foreground/60">
                {t("resultPanel")}
              </h3>
              {resultImage && inputPreview && (
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-7 gap-1.5 text-xs"
                  onClick={() => setShowCompare(!showCompare)}
                >
                  <ArrowLeftRight className="h-3 w-3" />
                  {showCompare ? t("sideBySide") : t("compare")}
                </Button>
              )}
            </div>
            <AnimatePresence mode="wait">
              {showCompare && resultImage && inputPreview ? (
                <motion.div
                  key="compare"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  className="overflow-hidden rounded-xl border border-border/50"
                >
                  <ReactCompareSlider
                    itemOne={
                      <ReactCompareSliderImage
                        src={inputPreview}
                        alt={t("before")}
                      />
                    }
                    itemTwo={
                      <ReactCompareSliderImage
                        src={base64ToUrl(resultImage)}
                        alt={t("after")}
                      />
                    }
                  />
                </motion.div>
              ) : resultImage ? (
                <motion.div
                  key="result"
                  initial={{ opacity: 0, scale: 0.95 }}
                  animate={{ opacity: 1, scale: 1 }}
                  className="space-y-3"
                >
                  <div className="overflow-hidden rounded-xl border border-border/50 glow-sm">
                    <img
                      src={base64ToUrl(resultImage)}
                      alt={t("result")}
                      className="w-full"
                    />
                  </div>
                  <Button
                    variant="outline"
                    size="sm"
                    className="w-full"
                    onClick={() =>
                      downloadBase64Image(
                        resultImage,
                        `edited_${Date.now()}.png`
                      )
                    }
                  >
                    <Download className="mr-1.5 h-3 w-3" />
                    {t("downloadResult")}
                  </Button>
                </motion.div>
              ) : (
                <motion.div
                  key="empty"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  className="flex aspect-square items-center justify-center rounded-xl border border-dashed border-primary/20 bg-primary/[0.02]"
                >
                  <p className="text-sm text-muted-foreground/50">
                    {t("noResult")}
                  </p>
                </motion.div>
              )}
            </AnimatePresence>
          </CardContent>
        </Card>
      </div>

      {/* Action Tabs */}
      <Tabs defaultValue="edit">
        <TabsList className="glass-card">
          <TabsTrigger value="edit" className="gap-1.5">
            <PenTool className="h-3.5 w-3.5" />
            {t("tabs.edit")}
          </TabsTrigger>
          <TabsTrigger value="detailer" className="gap-1.5">
            <ZoomIn className="h-3.5 w-3.5" />
            {t("tabs.detailer")}
          </TabsTrigger>
        </TabsList>

        <TabsContent value="edit">
          <Card className="glass-card">
            <CardContent className="space-y-4 p-5">
              {/* Prompt */}
              <div className="space-y-2">
                <Label className="text-xs">{t("editPrompt")}</Label>
                <Textarea
                  value={editPrompt}
                  onChange={(e) => setEditPrompt(e.target.value)}
                  placeholder={t("editPromptPlaceholder")}
                  rows={2}
                  className="resize-none border-0 bg-muted/50 text-sm focus-visible:ring-1 focus-visible:ring-primary/30"
                />
              </div>

              {/* Change Amount — Visual Cards */}
              <div className="space-y-2">
                <div className="flex items-center gap-1.5">
                  <Label className="text-xs">{t("changeAmount")}</Label>
                  <TooltipProvider delayDuration={200}>
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <Info className="h-3 w-3 cursor-help text-muted-foreground/40" />
                      </TooltipTrigger>
                      <TooltipContent
                        side="top"
                        className="max-w-[280px] text-xs"
                      >
                        <p>
                          {t("changeAmountTooltip")}
                        </p>
                      </TooltipContent>
                    </Tooltip>
                  </TooltipProvider>
                </div>
                <div className="grid grid-cols-3 gap-2">
                  {CHANGE_AMOUNTS.map((amount, i) => (
                    <button
                      key={amount.id}
                      onClick={() => handleChangeAmountSelect(amount.id)}
                      className={`flex flex-col items-center gap-1 rounded-xl border p-3 transition-all ${
                        changeAmount === amount.id
                          ? "border-primary/50 bg-primary/10 glow-sm"
                          : "border-border/50 bg-card/50 hover:border-primary/30 hover:bg-primary/5"
                      }`}
                    >
                      <span className="text-lg">{CHANGE_ICONS[i]}</span>
                      <span className="text-xs font-semibold">
                        {tq(amount.labelKey.replace("quality.", ""))}
                      </span>
                      <span className="text-[10px] text-muted-foreground/60">
                        {tq(amount.descriptionKey.replace("quality.", ""))}
                      </span>
                    </button>
                  ))}
                </div>
              </div>

              {/* Generate Button */}
              <Button
                className="w-full bg-gradient-to-r from-primary to-[oklch(0.70_0.22_310)] text-white shadow-lg hover:shadow-primary/25 hover:brightness-110 disabled:opacity-50"
                onClick={handleEdit}
                disabled={isGenerating || !inputImage}
              >
                {isGenerating ? (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                ) : (
                  <Wand2 className="mr-2 h-4 w-4" />
                )}
                {isGenerating ? t("applying") : t("applyEdit")}
              </Button>

              {/* Advanced Settings */}
              <Collapsible open={showAdvanced} onOpenChange={setShowAdvanced}>
                <CollapsibleTrigger asChild>
                  <button className="flex w-full items-center justify-between rounded-lg border border-border/30 bg-card/30 px-4 py-2.5 text-xs text-muted-foreground/60 transition-colors hover:bg-card/50">
                    <span className="flex items-center gap-2">
                      <Settings2 className="h-3.5 w-3.5" />
                      {t("advancedSettings")}
                    </span>
                    <ChevronDown
                      className={`h-3.5 w-3.5 transition-transform ${
                        showAdvanced ? "rotate-180" : ""
                      }`}
                    />
                  </button>
                </CollapsibleTrigger>
                <CollapsibleContent className="mt-3 space-y-4">
                  <Card className="border-border/20 bg-card/30">
                    <CardContent className="space-y-4 p-4">
                      <div className="flex items-center gap-2 text-xs text-muted-foreground/60">
                        <Info className="h-3.5 w-3.5 shrink-0" />
                        <span>
                          {t("advancedWarning")}
                        </span>
                      </div>
                      <SmartSlider
                        paramKey="edit_denoise"
                        value={editDenoise}
                        onChange={setEditDenoise}
                      />
                      <div className="space-y-2">
                        <div className="flex items-center gap-1.5">
                          <Label className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground/40">
                            {t("negativePrompt")}
                          </Label>
                          <TooltipProvider delayDuration={200}>
                            <Tooltip>
                              <TooltipTrigger asChild>
                                <Info className="h-3 w-3 cursor-help text-muted-foreground/40" />
                              </TooltipTrigger>
                              <TooltipContent className="max-w-[250px] text-xs">
                                {t("negativePromptTooltip")}
                              </TooltipContent>
                            </Tooltip>
                          </TooltipProvider>
                        </div>
                        <Textarea
                          value={editNegative}
                          onChange={(e) => setEditNegative(e.target.value)}
                          rows={2}
                          className="resize-none border-0 bg-muted/30 text-xs text-muted-foreground focus-visible:ring-1 focus-visible:ring-primary/30"
                        />
                      </div>
                    </CardContent>
                  </Card>
                </CollapsibleContent>
              </Collapsible>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="detailer">
          <Card className="glass-card">
            <CardContent className="space-y-4 p-5">
              <div className="rounded-lg border border-primary/10 bg-primary/5 p-3">
                <p className="text-xs text-muted-foreground">
                  {t("detailerInfo")}
                </p>
              </div>

              <SmartSlider
                paramKey="face_detailer_denoise"
                value={detailerDenoise}
                onChange={setDetailerDenoise}
              />

              <Button
                className="w-full bg-gradient-to-r from-primary to-[oklch(0.70_0.22_310)] text-white shadow-lg hover:shadow-primary/25 hover:brightness-110 disabled:opacity-50"
                onClick={handleDetailer}
                disabled={isGenerating || !inputImage}
              >
                {isGenerating ? (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                ) : (
                  <ZoomIn className="mr-2 h-4 w-4" />
                )}
                {isGenerating
                  ? t("processing")
                  : t("detailerButton")}
              </Button>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </motion.div>
  );
}
