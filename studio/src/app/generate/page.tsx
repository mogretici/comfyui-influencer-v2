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
import { Switch } from "@/components/ui/switch";
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
  Sparkles,
  Loader2,
  Download,
  RefreshCw,
  Wand2,
  Settings2,
  Info,
  AlertTriangle,
  ChevronDown,
  Type,
  User,
  Image,
} from "lucide-react";
import {
  useSettingsStore,
  useGenerationStore,
  useGalleryStore,
} from "@/lib/store";
import { getRunPodClient, base64ToUrl, downloadBase64Image } from "@/lib/api";
import {
  SCENE_PRESETS,
  CHARACTER_PRESETS,
  buildPrompt,
} from "@/lib/presets";
import {
  QUALITY_PRESETS,
  PARAM_HINTS,
  getPresetByLevel,
  type QualityLevel,
} from "@/lib/quality-presets";
import type { GenerateParams } from "@/types";
import { motion } from "framer-motion";

const PRESET_GRADIENTS = [
  "from-amber-500 to-orange-600",
  "from-cyan-500 to-blue-600",
  "from-rose-500 to-pink-600",
  "from-violet-500 to-purple-600",
  "from-emerald-500 to-teal-600",
  "from-indigo-500 to-blue-600",
  "from-orange-500 to-red-600",
  "from-green-500 to-emerald-600",
  "from-pink-500 to-rose-600",
  "from-blue-500 to-indigo-600",
];

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

  const isOutOfRange = value < hint.recommendedMin || value > hint.recommendedMax;
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

/* ─── Page ─────────────────────────────────────────────── */

export default function GeneratePage() {
  const t = useTranslations("generate");
  const tq = useTranslations("quality");
  const tp = useTranslations("presets");
  const te = useTranslations("errors");

  const { settings } = useSettingsStore();
  const isConfigured = useSettingsStore((s) => s.isConfigured);
  const { isGenerating, setGenerating, setProgress } = useGenerationStore();
  const addImage = useGalleryStore((s) => s.addImage);

  // Simple mode state
  const [prompt, setPrompt] = useState("");
  const [selectedPreset, setSelectedPreset] = useState<string | null>(null);
  const [presetMode, setPresetMode] = useState<"scene" | "character">("scene");
  const [qualityLevel, setQualityLevel] = useState<QualityLevel>("balanced");

  // Advanced mode toggle
  const [showAdvanced, setShowAdvanced] = useState(false);

  // Advanced overrides (initialized from quality preset)
  const qualityPreset = useMemo(() => getPresetByLevel(qualityLevel), [qualityLevel]);

  const [faceLora, setFaceLora] = useState(settings.default_face_lora);
  const [faceLoraStrength, setFaceLoraStrength] = useState(qualityPreset.params.face_lora_strength);
  const [ipAdapterStrength, setIpAdapterStrength] = useState(qualityPreset.params.ip_adapter_strength);
  const [steps, setSteps] = useState(qualityPreset.params.steps);
  const [width, setWidth] = useState(qualityPreset.params.width);
  const [height, setHeight] = useState(qualityPreset.params.height);
  const [faceDetailerDenoise, setFaceDetailerDenoise] = useState(qualityPreset.params.face_detailer_denoise);
  const [seed, setSeed] = useState(-1);
  const [resultImage, setResultImage] = useState<string | null>(null);
  const [resultSeed, setResultSeed] = useState<number | null>(null);

  // When quality level changes, update all params (unless in advanced mode)
  const handleQualityChange = useCallback(
    (level: QualityLevel) => {
      setQualityLevel(level);
      if (!showAdvanced) {
        const preset = getPresetByLevel(level);
        setFaceLoraStrength(preset.params.face_lora_strength);
        setIpAdapterStrength(preset.params.ip_adapter_strength);
        setSteps(preset.params.steps);
        setWidth(preset.params.width);
        setHeight(preset.params.height);
        setFaceDetailerDenoise(preset.params.face_detailer_denoise);
      }
    },
    [showAdvanced]
  );

  const handlePresetClick = useCallback((presetId: string) => {
    const preset =
      presetMode === "character"
        ? CHARACTER_PRESETS.find((p) => p.id === presetId)
        : SCENE_PRESETS.find((p) => p.id === presetId);
    if (!preset) return;
    setSelectedPreset(presetId);
    setPrompt(buildPrompt(preset.prompt_template, "ohwx woman"));
    // Apply recommended params from character presets
    if (presetMode === "character" && preset.recommended_params) {
      const rp = preset.recommended_params;
      if (rp.width) setWidth(rp.width);
      if (rp.height) setHeight(rp.height);
      if (rp.steps) setSteps(rp.steps);
    }
  }, [presetMode]);

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
    setProgress(t("generating"));
    setResultImage(null);

    try {
      const client = getRunPodClient(
        settings.runpod_api_key,
        settings.runpod_endpoint_id
      );

      const params: GenerateParams = {
        action: "generate",
        prompt,
        face_lora: faceLora,
        face_lora_strength: faceLoraStrength,
        ip_adapter_strength: ipAdapterStrength,
        steps,
        width,
        height,
        seed,
        face_detailer_denoise: faceDetailerDenoise,
      };

      const result = await client.runAndWait(params, (status) => {
        setProgress(status);
      });

      if (result.output?.images?.length) {
        const imageBase64 = result.output.images[0];
        setResultImage(imageBase64);
        setResultSeed(result.output.seed ?? null);

        addImage({
          id: crypto.randomUUID(),
          base64: imageBase64,
          prompt,
          action: "generate",
          params: params as unknown as Record<string, unknown>,
          seed: result.output.seed ?? -1,
          created_at: new Date().toISOString(),
          favorite: false,
        });

        toast.success(t("successGenerated"));
      } else if (result.output?.error) {
        toast.error(result.output.error);
      } else {
        toast.error(te("generationFailed"));
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : te("unknown");
      toast.error(message);
    } finally {
      setGenerating(false);
      setProgress("");
    }
  }, [
    isConfigured, prompt, faceLora, faceLoraStrength,
    ipAdapterStrength, steps, width, height,
    seed, faceDetailerDenoise, settings, setGenerating, setProgress, addImage,
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

      <div className="grid gap-6 lg:grid-cols-[3fr_2fr]">
        {/* Left: Controls */}
        <div className="space-y-5">
          {/* Preset Mode Tabs + Grid */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <h3 className="text-xs font-semibold uppercase tracking-widest text-muted-foreground/60">
                1. {presetMode === "scene" ? t("scenePresets") : t("characterPresets")}
              </h3>
              <div className="flex gap-1 rounded-lg border border-border/30 bg-card/30 p-0.5">
                <button
                  onClick={() => { setPresetMode("scene"); setSelectedPreset(null); }}
                  className={`flex items-center gap-1 rounded-md px-2.5 py-1 text-[10px] font-medium transition-all ${
                    presetMode === "scene"
                      ? "bg-primary/15 text-primary shadow-sm"
                      : "text-muted-foreground/50 hover:text-muted-foreground"
                  }`}
                >
                  <Image className="h-3 w-3" />
                  {t("scenesTab")}
                </button>
                <button
                  onClick={() => { setPresetMode("character"); setSelectedPreset(null); }}
                  className={`flex items-center gap-1 rounded-md px-2.5 py-1 text-[10px] font-medium transition-all ${
                    presetMode === "character"
                      ? "bg-primary/15 text-primary shadow-sm"
                      : "text-muted-foreground/50 hover:text-muted-foreground"
                  }`}
                >
                  <User className="h-3 w-3" />
                  {t("characterTab")}
                </button>
              </div>
            </div>

            {presetMode === "scene" ? (
              <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 md:grid-cols-5">
                {SCENE_PRESETS.map((preset, i) => (
                  <button
                    key={preset.id}
                    onClick={() => handlePresetClick(preset.id)}
                    className={`group relative flex flex-col items-center gap-1.5 rounded-xl border p-3 transition-all hover:scale-[1.03] ${
                      selectedPreset === preset.id
                        ? "border-primary/50 bg-primary/10 glow-sm"
                        : "border-border/50 bg-card/50 hover:border-primary/30 hover:bg-primary/5"
                    }`}
                  >
                    <div
                      className={`flex h-9 w-9 items-center justify-center rounded-lg bg-gradient-to-br ${PRESET_GRADIENTS[i % PRESET_GRADIENTS.length]} text-white shadow-sm`}
                    >
                      <span className="text-sm">{preset.icon}</span>
                    </div>
                    <span className="text-[11px] font-medium leading-tight text-center">
                      {tp(preset.nameKey.replace("presets.", ""))}
                    </span>
                  </button>
                ))}
              </div>
            ) : (
              <div className="space-y-2">
                <p className="text-[10px] text-muted-foreground/50">
                  {t("characterPresetsHint")}
                </p>
                <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
                  {CHARACTER_PRESETS.map((preset) => (
                    <button
                      key={preset.id}
                      onClick={() => handlePresetClick(preset.id)}
                      className={`group relative flex flex-col items-center gap-1.5 rounded-xl border p-3 transition-all hover:scale-[1.03] ${
                        selectedPreset === preset.id
                          ? "border-primary/50 bg-primary/10 glow-sm"
                          : "border-border/50 bg-card/50 hover:border-primary/30 hover:bg-primary/5"
                      }`}
                    >
                      <span className="text-lg">{preset.icon}</span>
                      <span className="text-[11px] font-medium leading-tight text-center">
                        {t(`charPreset.${preset.id}`)}
                      </span>
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* Prompt */}
          <div className="space-y-2">
            <h3 className="text-xs font-semibold uppercase tracking-widest text-muted-foreground/60">
              2. {t("prompt")}
            </h3>
            <Card className="glass-card overflow-hidden">
              <CardContent className="p-0">
                <div className="p-4 pb-3">
                  <div className="flex items-center justify-between mb-2">
                    <Label className="text-xs flex items-center gap-1.5 text-muted-foreground/60">
                      <Type className="h-3 w-3" /> {t("prompt")}
                    </Label>
                    <span className="text-[10px] text-muted-foreground/50 font-mono">
                      {prompt.length}
                    </span>
                  </div>
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
          </div>

          {/* Quality Selector */}
          <div className="space-y-2">
            <h3 className="text-xs font-semibold uppercase tracking-widest text-muted-foreground/60">
              3. {t("qualityLabel")}
            </h3>
            <div className="grid grid-cols-3 gap-2">
              {QUALITY_PRESETS.map((preset) => (
                <button
                  key={preset.id}
                  onClick={() => handleQualityChange(preset.id)}
                  className={`relative flex flex-col items-center gap-1 rounded-xl border p-3 transition-all ${
                    qualityLevel === preset.id
                      ? "border-primary/50 bg-primary/10 glow-sm"
                      : "border-border/50 bg-card/50 hover:border-primary/30 hover:bg-primary/5"
                  }`}
                >
                  <span className="text-lg">{preset.icon}</span>
                  <span className="text-xs font-semibold">{tq(`${preset.id}.name`)}</span>
                  <span className="text-[10px] text-muted-foreground/60">
                    {tq(`${preset.id}.description`)}
                  </span>
                  {preset.id === "balanced" && (
                    <Badge
                      variant="outline"
                      className="absolute -top-2 right-2 border-primary/30 bg-primary/10 text-[8px] text-primary"
                    >
                      {t("recommended")}
                    </Badge>
                  )}
                </button>
              ))}
            </div>
          </div>

          {/* Generate Button */}
          <Button
            size="lg"
            className="w-full bg-gradient-to-r from-primary to-[oklch(0.70_0.22_310)] text-white shadow-lg transition-all hover:shadow-primary/25 hover:brightness-110 disabled:opacity-50"
            onClick={handleGenerate}
            disabled={isGenerating || !prompt.trim()}
          >
            {isGenerating ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                {t("generating")}
              </>
            ) : (
              <>
                <Wand2 className="mr-2 h-4 w-4" />
                {t("generateButton")}
              </>
            )}
          </Button>

          {/* Advanced Settings (Collapsible) */}
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
              <Card className="glass-card">
                <CardContent className="space-y-5 p-5">
                  <div className="flex items-center gap-2 text-xs text-muted-foreground/60">
                    <Info className="h-3.5 w-3.5" />
                    <span>
                      {t("advancedWarning")}
                    </span>
                  </div>

                  {/* Model */}
                  <div className="space-y-4">
                    <h4 className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground/40">
                      {t("identitySection")}
                    </h4>
                    <div className="space-y-2">
                      <Label className="text-xs">{t("faceLoraFile")}</Label>
                      <Input
                        value={faceLora}
                        onChange={(e) => setFaceLora(e.target.value)}
                        placeholder="my_face.safetensors"
                        className="h-8 text-sm"
                      />
                      <p className="text-[10px] text-muted-foreground/50">
                        {t("faceLoraHint")}
                      </p>
                    </div>
                    <SmartSlider
                      paramKey="face_lora_strength"
                      value={faceLoraStrength}
                      onChange={setFaceLoraStrength}
                    />
                    <SmartSlider
                      paramKey="ip_adapter_strength"
                      value={ipAdapterStrength}
                      onChange={setIpAdapterStrength}
                    />
                  </div>

                  <div className="border-t border-border/20" />

                  {/* Generation */}
                  <div className="space-y-4">
                    <h4 className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground/40">
                      {t("generationSection")}
                    </h4>
                    <div className="grid grid-cols-2 gap-3">
                      <div className="space-y-1">
                        <Label className="text-xs">{t("widthLabel")}</Label>
                        <Input
                          type="number"
                          value={width}
                          onChange={(e) => setWidth(Number(e.target.value))}
                          className="h-8 text-sm"
                        />
                      </div>
                      <div className="space-y-1">
                        <Label className="text-xs">{t("heightLabel")}</Label>
                        <Input
                          type="number"
                          value={height}
                          onChange={(e) => setHeight(Number(e.target.value))}
                          className="h-8 text-sm"
                        />
                      </div>
                    </div>
                    <SmartSlider paramKey="steps" value={steps} onChange={setSteps} />
                    <div className="space-y-1">
                      <div className="flex items-center gap-1.5">
                        <Label className="text-xs">{t("seed")}</Label>
                        <TooltipProvider delayDuration={200}>
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <Info className="h-3 w-3 cursor-help text-muted-foreground/40" />
                            </TooltipTrigger>
                            <TooltipContent className="max-w-[250px] text-xs">
                              {t("seedTooltip")}
                            </TooltipContent>
                          </Tooltip>
                        </TooltipProvider>
                      </div>
                      <div className="flex gap-2">
                        <Input
                          type="number"
                          value={seed}
                          onChange={(e) => setSeed(Number(e.target.value))}
                          className="h-8 text-sm"
                        />
                        <Button
                          variant="outline"
                          size="icon"
                          className="h-8 w-8 shrink-0"
                          onClick={() => setSeed(-1)}
                          aria-label={t("seedRandom")}
                        >
                          <RefreshCw className="h-3 w-3" />
                        </Button>
                        {resultSeed !== null && (
                          <Button
                            variant="outline"
                            size="sm"
                            className="h-8 shrink-0 text-xs"
                            onClick={() => setSeed(resultSeed)}
                          >
                            {t("lastSeed", { seed: resultSeed })}
                          </Button>
                        )}
                      </div>
                    </div>
                  </div>

                  <div className="border-t border-border/20" />

                  {/* Face Detail */}
                  <div className="space-y-4">
                    <h4 className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground/40">
                      {t("faceEnhanceSection")}
                    </h4>
                    <SmartSlider
                      paramKey="face_detailer_denoise"
                      value={faceDetailerDenoise}
                      onChange={setFaceDetailerDenoise}
                    />
                  </div>

                </CardContent>
              </Card>
            </CollapsibleContent>
          </Collapsible>
        </div>

        {/* Right: Preview */}
        <div className="lg:sticky lg:top-6 lg:self-start">
          <Card className="glass-card overflow-hidden">
            <CardContent className="p-4">
              {resultImage ? (
                <motion.div
                  initial={{ opacity: 0, scale: 0.95 }}
                  animate={{ opacity: 1, scale: 1 }}
                  className="space-y-3"
                >
                  <div className="overflow-hidden rounded-xl glow-md">
                    <img src={base64ToUrl(resultImage)} alt={t("result")} className="w-full" />
                  </div>
                  <div className="flex gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      className="flex-1"
                      onClick={() =>
                        downloadBase64Image(resultImage, `influencer_${Date.now()}.png`)
                      }
                    >
                      <Download className="mr-1.5 h-3 w-3" />
                      {t("downloadResult")}
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => {
                        if (resultSeed !== null) setSeed(resultSeed);
                        handleGenerate();
                      }}
                    >
                      <RefreshCw className="mr-1.5 h-3 w-3" />
                      {t("reGenerate")}
                    </Button>
                  </div>
                  {resultSeed !== null && (
                    <p className="text-center text-[10px] font-mono text-muted-foreground/50">
                      {t("usedSeed")}: {resultSeed}
                    </p>
                  )}
                </motion.div>
              ) : (
                <div className="flex aspect-square items-center justify-center rounded-xl border border-dashed border-primary/20 bg-primary/[0.02]">
                  <div className="text-center text-muted-foreground/50">
                    <Sparkles className="mx-auto mb-3 h-10 w-10 text-primary/30" />
                    <p className="text-sm font-medium">{t("previewPanel")}</p>
                    <p className="mt-1 text-xs">
                      {t("previewHint")}
                    </p>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </motion.div>
  );
}
