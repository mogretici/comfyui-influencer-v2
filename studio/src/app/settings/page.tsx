"use client";

import { useState, useCallback, useMemo } from "react";
import { useTranslations } from "next-intl";
import { toast } from "sonner";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
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
  Save,
  TestTube,
  Loader2,
  CheckCircle2,
  XCircle,
  Eye,
  EyeOff,
  Server,
  SlidersHorizontal,
  Palette,
  Moon,
  Sun,
  Info,
  AlertTriangle,
  Settings2,
  ChevronDown,
} from "lucide-react";
import { useSettingsStore } from "@/lib/store";
import { getRunPodClient } from "@/lib/api";
import {
  QUALITY_PRESETS,
  PARAM_HINTS,
  getPresetByLevel,
  type QualityLevel,
} from "@/lib/quality-presets";
import { useTheme } from "next-themes";
import { motion } from "framer-motion";

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
  const hint = PARAM_HINTS[paramKey];
  if (!hint) return null;

  const isOutOfRange =
    value < hint.recommendedMin || value > hint.recommendedMax;

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-1.5">
          <Label className="text-xs">{th(`hints.${hint.hintKey}.label`)}</Label>
          <TooltipProvider delayDuration={200}>
            <Tooltip>
              <TooltipTrigger asChild>
                <Info className="h-3 w-3 cursor-help text-muted-foreground/40" />
              </TooltipTrigger>
              <TooltipContent side="top" className="max-w-[280px] text-xs">
                <p>{th(`hints.${hint.hintKey}.description`)}</p>
                <p className="mt-1 font-medium text-primary">
                  {th(`hints.${hint.hintKey}.recommended`)}
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
      {isOutOfRange && th.has(`hints.${hint.hintKey}.warning`) && (
        <p className="flex items-center gap-1 text-[10px] text-amber-500">
          <AlertTriangle className="h-2.5 w-2.5" />
          {th(`hints.${hint.hintKey}.warning`)}
        </p>
      )}
    </div>
  );
}

/* ─── Page ─────────────────────────────────────────────── */

export default function SettingsPage() {
  const t = useTranslations("settings");
  const tq = useTranslations("quality");
  const tc = useTranslations("common");
  const { settings, locale, updateSettings, setLocale } = useSettingsStore();
  const { theme, setTheme } = useTheme();
  const [testing, setTesting] = useState(false);
  const [testResult, setTestResult] = useState<"success" | "error" | null>(
    null
  );
  const [showApiKey, setShowApiKey] = useState(false);
  const [showAdvancedDefaults, setShowAdvancedDefaults] = useState(false);

  // API
  const [apiKey, setApiKey] = useState(settings.runpod_api_key);
  const [endpointId, setEndpointId] = useState(settings.runpod_endpoint_id);

  // Model
  const [faceLora, setFaceLora] = useState(settings.default_face_lora);

  // Quality Profile
  const [qualityLevel, setQualityLevel] = useState<QualityLevel>("balanced");
  const qualityPreset = useMemo(
    () => getPresetByLevel(qualityLevel),
    [qualityLevel]
  );

  // Advanced defaults (initialized from current settings)
  const [faceLoraStrength, setFaceLoraStrength] = useState(
    settings.default_face_lora_strength
  );
  const [ipAdapterStrength, setIpAdapterStrength] = useState(
    settings.default_ip_adapter_strength
  );
  const [steps, setSteps] = useState(settings.default_steps);
  const [width, setWidth] = useState(settings.default_width);
  const [height, setHeight] = useState(settings.default_height);
  const [fdDenoise, setFdDenoise] = useState(
    settings.default_face_detailer_denoise
  );

  // Apply quality preset to all advanced values
  const handleQualitySelect = useCallback(
    (level: QualityLevel) => {
      setQualityLevel(level);
      const preset = getPresetByLevel(level);
      setFaceLoraStrength(preset.params.face_lora_strength);
      setIpAdapterStrength(preset.params.ip_adapter_strength);
      setSteps(preset.params.steps);
      setWidth(preset.params.width);
      setHeight(preset.params.height);
      setFdDenoise(preset.params.face_detailer_denoise);
    },
    []
  );

  const handleSave = useCallback(() => {
    updateSettings({
      runpod_api_key: apiKey,
      runpod_endpoint_id: endpointId,
      default_face_lora: faceLora,
      default_face_lora_strength: faceLoraStrength,
      default_ip_adapter_strength: ipAdapterStrength,
      default_steps: steps,
      default_width: width,
      default_height: height,
      default_face_detailer_denoise: fdDenoise,
    });
    toast.success(t("saved"));
  }, [
    apiKey,
    endpointId,
    faceLora,
    faceLoraStrength,
    ipAdapterStrength,
    steps,
    width,
    height,
    fdDenoise,
    updateSettings,
    t,
  ]);

  const handleTestConnection = useCallback(async () => {
    if (!apiKey || !endpointId) {
      toast.error(t("connection.connectionFailed"));
      return;
    }

    setTesting(true);
    setTestResult(null);

    try {
      const client = getRunPodClient(apiKey, endpointId);
      await client.health();
      setTestResult("success");
      toast.success(t("connection.connectionOk"));
    } catch (error) {
      setTestResult("error");
      toast.error(
        error instanceof Error ? error.message : t("connection.connectionFailed")
      );
    } finally {
      setTesting(false);
    }
  }, [apiKey, endpointId, t]);

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3 }}
      className="mx-auto max-w-2xl space-y-6"
    >
      <div>
        <h1 className="font-[family-name:var(--font-display)] text-2xl font-bold tracking-tight">
          <span className="gradient-text">{t("heading")}</span>
        </h1>
        <p className="text-sm text-muted-foreground">
          {t("subtitle")}
        </p>
      </div>

      {/* Appearance */}
      <SettingsSection icon={Palette} title={t("appearance.title")}>
        <div className="space-y-3">
          <Label className="text-xs">{t("appearance.theme")}</Label>
          <div className="grid grid-cols-3 gap-2">
            {(
              [
                { id: "light", labelKey: "appearance.light" as const, Icon: Sun },
                { id: "dark", labelKey: "appearance.dark" as const, Icon: Moon },
                { id: "system", labelKey: "appearance.system" as const, Icon: Palette },
              ] as const
            ).map(({ id, labelKey, Icon }) => (
              <button
                key={id}
                onClick={() => setTheme(id)}
                className={`flex items-center justify-center gap-2 rounded-xl border p-3 text-xs font-medium transition-all ${
                  theme === id
                    ? "border-primary bg-primary/10 text-primary"
                    : "border-border/50 text-muted-foreground hover:border-primary/30 hover:bg-primary/5"
                }`}
              >
                <Icon className="h-3.5 w-3.5" />
                {t(labelKey)}
              </button>
            ))}
          </div>
        </div>

        {/* Language */}
        <div className="space-y-3">
          <Label className="text-xs">{t("appearance.language")}</Label>
          <div className="grid grid-cols-2 gap-2">
            {(
              [
                { id: "tr" as const, label: t("appearance.languageTr"), flag: "🇹🇷" },
                { id: "en" as const, label: t("appearance.languageEn"), flag: "🇬🇧" },
              ] as const
            ).map(({ id, label, flag }) => (
              <button
                key={id}
                onClick={() => setLocale(id)}
                className={`flex items-center justify-center gap-2 rounded-xl border p-3 text-xs font-medium transition-all ${
                  locale === id
                    ? "border-primary bg-primary/10 text-primary"
                    : "border-border/50 text-muted-foreground hover:border-primary/30 hover:bg-primary/5"
                }`}
              >
                <span className="text-base">{flag}</span>
                {label}
              </button>
            ))}
          </div>
        </div>
      </SettingsSection>

      {/* RunPod Connection */}
      <SettingsSection icon={Server} title={t("connection.title")}>
        <div className="space-y-4">
          <div className="rounded-lg border border-primary/10 bg-primary/5 p-3">
            <p className="text-xs text-muted-foreground">
              {t("connection.description")}
            </p>
          </div>
          <div className="space-y-2">
            <Label className="text-xs">{t("connection.apiKey")}</Label>
            <div className="flex gap-2">
              <Input
                type={showApiKey ? "text" : "password"}
                value={apiKey}
                onChange={(e) => setApiKey(e.target.value)}
                placeholder={t("connection.apiKeyPlaceholder")}
                className="h-9 text-sm"
              />
              <Button
                variant="outline"
                size="icon"
                className="h-9 w-9 shrink-0"
                onClick={() => setShowApiKey(!showApiKey)}
                aria-label={showApiKey ? "API anahtarını gizle" : "API anahtarını göster"}
              >
                {showApiKey ? (
                  <EyeOff className="h-3.5 w-3.5" />
                ) : (
                  <Eye className="h-3.5 w-3.5" />
                )}
              </Button>
            </div>
          </div>
          <div className="space-y-2">
            <Label className="text-xs">{t("connection.endpointId")}</Label>
            <Input
              value={endpointId}
              onChange={(e) => setEndpointId(e.target.value)}
              placeholder={t("connection.endpointIdPlaceholder")}
              className="h-9 text-sm"
            />
          </div>
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={handleTestConnection}
              disabled={testing}
            >
              {testing ? (
                <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />
              ) : (
                <TestTube className="mr-1.5 h-3.5 w-3.5" />
              )}
              {testing ? t("connection.testing") : t("connection.testConnection")}
            </Button>
            {testResult === "success" && (
              <Badge
                variant="outline"
                className="gap-1 border-emerald-500/30 bg-emerald-500/10 text-emerald-500"
              >
                <CheckCircle2 className="h-3 w-3" />
                {t("connection.connectionOk")}
              </Badge>
            )}
            {testResult === "error" && (
              <Badge
                variant="outline"
                className="gap-1 border-destructive/30 bg-destructive/10 text-destructive"
              >
                <XCircle className="h-3 w-3" />
                {t("connection.connectionFailed")}
              </Badge>
            )}
          </div>
        </div>
      </SettingsSection>

      {/* Model */}
      <SettingsSection icon={SlidersHorizontal} title={t("model.title")}>
        <div className="space-y-4">
          <div className="rounded-lg border border-primary/10 bg-primary/5 p-3">
            <p className="text-xs text-muted-foreground">
              {t("model.description")}
            </p>
          </div>
          <div className="space-y-2">
            <Label className="text-xs">{t("model.faceLoraFile")}</Label>
            <Input
              value={faceLora}
              onChange={(e) => setFaceLora(e.target.value)}
              placeholder={t("model.faceLoraPlaceholder")}
              className="h-9 text-sm"
            />
          </div>
        </div>
      </SettingsSection>

      {/* Quality Profile */}
      <SettingsSection icon={Settings2} title={t("qualityProfile.title")}>
        <div className="space-y-4">
          <p className="text-xs text-muted-foreground/70">
            {t("qualityProfile.description")}
          </p>
          <div className="grid grid-cols-3 gap-2">
            {QUALITY_PRESETS.map((preset) => (
              <button
                key={preset.id}
                onClick={() => handleQualitySelect(preset.id)}
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
                    {t("qualityProfile.preset")}
                  </Badge>
                )}
              </button>
            ))}
          </div>

          {/* Advanced Defaults */}
          <Collapsible
            open={showAdvancedDefaults}
            onOpenChange={setShowAdvancedDefaults}
          >
            <CollapsibleTrigger asChild>
              <button className="flex w-full items-center justify-between rounded-lg border border-border/30 bg-card/30 px-4 py-2.5 text-xs text-muted-foreground/60 transition-colors hover:bg-card/50">
                <span className="flex items-center gap-2">
                  <Settings2 className="h-3.5 w-3.5" />
                  {t("qualityProfile.advanced")}
                </span>
                <ChevronDown
                  className={`h-3.5 w-3.5 transition-transform ${
                    showAdvancedDefaults ? "rotate-180" : ""
                  }`}
                />
              </button>
            </CollapsibleTrigger>
            <CollapsibleContent className="mt-3">
              <Card className="border-border/20 bg-card/30">
                <CardContent className="space-y-5 p-4">
                  <div className="flex items-center gap-2 text-xs text-muted-foreground/60">
                    <Info className="h-3.5 w-3.5 shrink-0" />
                    <span>
                      {t("qualityProfile.description")}
                    </span>
                  </div>

                  {/* Identity & Realism */}
                  <div className="space-y-4">
                    <h4 className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground/40">
                      {t("qualityProfile.identity")}
                    </h4>
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

                  {/* Generation Parameters */}
                  <div className="space-y-4">
                    <h4 className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground/40">
                      {t("qualityProfile.generation")}
                    </h4>
                    <div className="grid grid-cols-2 gap-3">
                      <div className="space-y-1">
                        <Label className="text-xs">{t("qualityProfile.width")}</Label>
                        <Input
                          type="number"
                          value={width}
                          onChange={(e) => setWidth(Number(e.target.value))}
                          className="h-9 text-sm"
                        />
                      </div>
                      <div className="space-y-1">
                        <Label className="text-xs">{t("qualityProfile.height")}</Label>
                        <Input
                          type="number"
                          value={height}
                          onChange={(e) => setHeight(Number(e.target.value))}
                          className="h-9 text-sm"
                        />
                      </div>
                    </div>
                    <SmartSlider
                      paramKey="steps"
                      value={steps}
                      onChange={setSteps}
                    />
                  </div>

                  <div className="border-t border-border/20" />

                  {/* Face Enhancement */}
                  <div className="space-y-4">
                    <h4 className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground/40">
                      {t("qualityProfile.faceEnhance")}
                    </h4>
                    <SmartSlider
                      paramKey="face_detailer_denoise"
                      value={fdDenoise}
                      onChange={setFdDenoise}
                    />
                  </div>
                </CardContent>
              </Card>
            </CollapsibleContent>
          </Collapsible>
        </div>
      </SettingsSection>

      {/* Save */}
      <Button
        size="lg"
        className="w-full bg-gradient-to-r from-primary to-[oklch(0.70_0.22_310)] text-white shadow-lg hover:shadow-primary/25 hover:brightness-110"
        onClick={handleSave}
      >
        <Save className="mr-2 h-4 w-4" />
        {tc("save")}
      </Button>
    </motion.div>
  );
}

/* ─── Helpers ─────────────────────────────────────────── */

function SettingsSection({
  icon: Icon,
  title,
  children,
}: {
  icon: React.ComponentType<{ className?: string }>;
  title: string;
  children: React.ReactNode;
}) {
  return (
    <Card className="glass-card">
      <CardContent className="p-5">
        <div className="mb-4 flex items-center gap-2">
          <Icon className="h-4 w-4 text-primary" />
          <h2 className="text-sm font-semibold">{title}</h2>
        </div>
        {children}
      </CardContent>
    </Card>
  );
}
