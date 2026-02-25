"use client";

import { useState, useCallback, useMemo } from "react";
import { useTranslations } from "next-intl";
import { toast } from "sonner";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Slider } from "@/components/ui/slider";
import { Badge } from "@/components/ui/badge";
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
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Layers,
  Loader2,
  Wand2,
  Download,
  Shuffle,
  Grid3x3,
  Settings2,
  Info,
  ChevronDown,
} from "lucide-react";
import {
  useSettingsStore,
  useGenerationStore,
  useGalleryStore,
} from "@/lib/store";
import { getRunPodClient, base64ToUrl, downloadBase64Image } from "@/lib/api";

import {
  QUALITY_PRESETS,
  getPresetByLevel,
  type QualityLevel,
} from "@/lib/quality-presets";
import type { GenerateParams } from "@/types";
import { motion } from "framer-motion";

type SeedStrategy = "random" | "sequential" | "fixed";

export default function BatchPage() {
  const t = useTranslations("batch");
  const tq = useTranslations("quality");
  const te = useTranslations("errors");

  const { settings } = useSettingsStore();
  const isConfigured = useSettingsStore((s) => s.isConfigured);
  const { isGenerating, setGenerating, setProgress } = useGenerationStore();
  const addImage = useGalleryStore((s) => s.addImage);

  // Simple mode
  const [prompt, setPrompt] = useState("");
  const [variations, setVariations] = useState(4);
  const [qualityLevel, setQualityLevel] = useState<QualityLevel>("balanced");
  const qualityPreset = useMemo(
    () => getPresetByLevel(qualityLevel),
    [qualityLevel]
  );

  // Advanced mode
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [seedStrategy, setSeedStrategy] = useState<SeedStrategy>("random");
  const [baseSeed, setBaseSeed] = useState(42);

  const [results, setResults] = useState<
    Array<{ base64: string; seed: number }>
  >([]);
  const [completedCount, setCompletedCount] = useState(0);

  const handleGenerate = useCallback(async () => {
    if (!isConfigured()) {
      toast.error(te("notConfigured"));
      return;
    }
    if (!prompt.trim()) {
      toast.error(te("noPrompt"));
      return;
    }

    setGenerating(true);
    setResults([]);
    setCompletedCount(0);

    const client = getRunPodClient(
      settings.runpod_api_key,
      settings.runpod_endpoint_id
    );

    const params = qualityPreset.params;

    for (let i = 0; i < variations; i++) {
      setProgress(t("generating", { current: i + 1, total: variations }));

      let seed = -1;
      if (seedStrategy === "sequential") seed = baseSeed + i;
      else if (seedStrategy === "fixed") seed = baseSeed;

      const genParams: GenerateParams = {
        action: "generate",
        prompt,
        face_lora: settings.default_face_lora,
        face_lora_strength: params.face_lora_strength,
        ip_adapter_strength: params.ip_adapter_strength,
        steps: params.steps,
        width: params.width,
        height: params.height,
        seed,
        face_detailer_denoise: params.face_detailer_denoise,
      };

      try {
        const result = await client.runAndWait(genParams, (status) => {
          setProgress(`[${i + 1}/${variations}] ${status}`);
        });

        if (result.output?.images?.length) {
          const img = result.output.images[0];
          const resultSeed = result.output.seed ?? -1;

          setResults((prev) => [...prev, { base64: img, seed: resultSeed }]);
          setCompletedCount((c) => c + 1);

          addImage({
            id: crypto.randomUUID(),
            base64: img,
            prompt,
            action: "generate",
            params: genParams as unknown as Record<string, unknown>,
            seed: resultSeed,
            created_at: new Date().toISOString(),
            favorite: false,
          });
        }
      } catch (error: unknown) {
        const msg = error instanceof Error ? error.message : te("generationFailed");
        toast.error(`${t("variationFailed", { index: i + 1 })}: ${msg}`);
      }
    }

    setGenerating(false);
    setProgress("");
    toast.success(t("batchComplete", { count: variations }));
  }, [
    isConfigured,
    prompt,
    variations,
    seedStrategy,
    baseSeed,
    qualityPreset,
    settings,
    setGenerating,
    setProgress,
    addImage,
  ]);

  const handleDownloadAll = useCallback(() => {
    results.forEach((r, i) => {
      downloadBase64Image(r.base64, `batch_${i + 1}_seed${r.seed}.png`);
    });
  }, [results]);

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

      <div className="grid gap-6 lg:grid-cols-[1fr_1fr]">
        {/* Left: Config */}
        <div className="space-y-5">
          {/* Prompt */}
          <Card className="glass-card">
            <CardContent className="space-y-4 p-5">
              <div className="space-y-2">
                <Label className="text-xs">{t("promptLabel")}</Label>
                <Textarea
                  value={prompt}
                  onChange={(e) => setPrompt(e.target.value)}
                  placeholder={t("promptPlaceholder")}
                  rows={3}
                  className="resize-none border-0 bg-muted/50 text-sm focus-visible:ring-1 focus-visible:ring-primary/30"
                />
              </div>
            </CardContent>
          </Card>

          {/* Variations + Quality */}
          <Card className="glass-card">
            <CardContent className="space-y-4 p-5">
              {/* Variations Slider */}
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-1.5">
                    <Label className="text-xs">{t("variationsLabel")}</Label>
                    <TooltipProvider delayDuration={200}>
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <Info className="h-3 w-3 cursor-help text-muted-foreground/40" />
                        </TooltipTrigger>
                        <TooltipContent className="max-w-[250px] text-xs">
                          {t("variationsTooltip")}
                        </TooltipContent>
                      </Tooltip>
                    </TooltipProvider>
                  </div>
                  <Badge variant="outline" className="font-mono text-[10px]">
                    {variations}
                  </Badge>
                </div>
                <Slider
                  value={[variations]}
                  onValueChange={([v]) => setVariations(v)}
                  min={2}
                  max={10}
                  step={1}
                />
              </div>

              {/* Quality Selector */}
              <div className="space-y-2">
                <Label className="text-xs">{t("qualityLabel")}</Label>
                <div className="grid grid-cols-3 gap-2">
                  {QUALITY_PRESETS.map((preset) => (
                    <button
                      key={preset.id}
                      onClick={() => setQualityLevel(preset.id)}
                      className={`relative flex flex-col items-center gap-1 rounded-xl border p-2.5 transition-all ${
                        qualityLevel === preset.id
                          ? "border-primary/50 bg-primary/10 glow-sm"
                          : "border-border/50 bg-card/50 hover:border-primary/30 hover:bg-primary/5"
                      }`}
                    >
                      <span className="text-base">{preset.icon}</span>
                      <span className="text-[11px] font-semibold">
                        {tq(`${preset.id}.name`)}
                      </span>
                      <span className="text-[9px] text-muted-foreground/60">
                        {tq(`${preset.id}.description`)}
                      </span>
                      {preset.id === "balanced" && (
                        <Badge
                          variant="outline"
                          className="absolute -top-2 right-1 border-primary/30 bg-primary/10 text-[7px] text-primary"
                        >
                          {t("recommended")}
                        </Badge>
                      )}
                    </button>
                  ))}
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Generate Button */}
          <Button
            size="lg"
            className="w-full bg-gradient-to-r from-primary to-[oklch(0.70_0.22_310)] text-white shadow-lg hover:shadow-primary/25 hover:brightness-110 disabled:opacity-50"
            onClick={handleGenerate}
            disabled={isGenerating || !prompt.trim()}
          >
            {isGenerating ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                {t("generating", { current: completedCount, total: variations })}
              </>
            ) : (
              <>
                <Wand2 className="mr-2 h-4 w-4" />
                {t("startBatch", { count: variations })}
              </>
            )}
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
            <CollapsibleContent className="mt-3">
              <Card className="border-border/20 bg-card/30">
                <CardContent className="space-y-4 p-4">
                  <div className="flex items-center gap-2 text-xs text-muted-foreground/60">
                    <Info className="h-3.5 w-3.5 shrink-0" />
                    <span>
                      {t("seedStrategyInfo")}
                    </span>
                  </div>

                  {/* Seed Strategy */}
                  <div className="space-y-2">
                    <Label className="text-xs">{t("seedStrategyLabel")}</Label>
                    <Select
                      value={seedStrategy}
                      onValueChange={(v) =>
                        setSeedStrategy(v as SeedStrategy)
                      }
                    >
                      <SelectTrigger className="h-9 text-sm">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="random">
                          <span className="flex items-center gap-1.5">
                            <Shuffle className="h-3 w-3" /> {t("seedStrategies.random")}
                          </span>
                        </SelectItem>
                        <SelectItem value="sequential">
                          <span className="flex items-center gap-1.5">
                            <Grid3x3 className="h-3 w-3" /> {t("seedStrategies.sequential")}
                          </span>
                        </SelectItem>
                        <SelectItem value="fixed">
                          <span className="flex items-center gap-1.5">
                            <Layers className="h-3 w-3" /> {t("seedStrategies.fixed")}
                          </span>
                        </SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  {seedStrategy !== "random" && (
                    <div className="space-y-2">
                      <Label className="text-xs">{t("baseSeedLabel")}</Label>
                      <Input
                        type="number"
                        value={baseSeed}
                        onChange={(e) => setBaseSeed(Number(e.target.value))}
                        className="h-8 text-sm"
                      />
                    </div>
                  )}

                </CardContent>
              </Card>
            </CollapsibleContent>
          </Collapsible>
        </div>

        {/* Right: Results Grid */}
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <h3 className="text-xs font-semibold uppercase tracking-widest text-muted-foreground/60">
              {t("results")}
            </h3>
            {results.length > 0 && (
              <Button variant="outline" size="sm" onClick={handleDownloadAll}>
                <Download className="mr-1.5 h-3 w-3" />
                {t("downloadAll")}
              </Button>
            )}
          </div>

          {results.length === 0 ? (
            <Card className="glass-card">
              <CardContent className="flex h-80 items-center justify-center p-5">
                <div className="text-center text-muted-foreground/50">
                  <Grid3x3 className="mx-auto mb-3 h-10 w-10 text-primary/30" />
                  <p className="text-sm font-medium">{t("emptyTitle")}</p>
                  <p className="mt-1 text-xs">
                    {t("emptyDescription")}
                  </p>
                </div>
              </CardContent>
            </Card>
          ) : (
            <div className="grid grid-cols-2 gap-2">
              {results.map((r, i) => (
                <motion.div
                  key={i}
                  initial={{ opacity: 0, scale: 0.9 }}
                  animate={{ opacity: 1, scale: 1 }}
                  transition={{ delay: i * 0.05 }}
                >
                  <Card className="group overflow-hidden">
                    <div className="relative aspect-square">
                      <img
                        src={base64ToUrl(r.base64)}
                        alt={`${t("variation")} ${i + 1}`}
                        className="h-full w-full object-cover"
                      />
                      <div className="absolute bottom-1 left-1">
                        <Badge
                          variant="secondary"
                          className="bg-black/50 text-[9px] text-white backdrop-blur-sm"
                        >
                          #{i + 1} · {t("seed")}:{r.seed}
                        </Badge>
                      </div>
                    </div>
                  </Card>
                </motion.div>
              ))}
            </div>
          )}
        </div>
      </div>
    </motion.div>
  );
}
