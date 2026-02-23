"use client";

import { useState, useCallback, useMemo } from "react";
import { useTranslations } from "next-intl";
import { toast } from "sonner";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Wand2,
  Save,
  Trash2,
  Plus,
  Copy,
  Sparkles,
  ArrowRight,
} from "lucide-react";
import Link from "next/link";
import { motion } from "framer-motion";
import { create } from "zustand";
import { persist } from "zustand/middleware";

interface PromptTemplate {
  id: string;
  name: string;
  template: string;
  variables: Record<string, string>;
  created_at: string;
}

interface PromptState {
  templates: PromptTemplate[];
  addTemplate: (t: PromptTemplate) => void;
  removeTemplate: (id: string) => void;
  updateTemplate: (id: string, partial: Partial<PromptTemplate>) => void;
}

const usePromptStore = create<PromptState>()(
  persist(
    (set) => ({
      templates: [],
      addTemplate: (t) =>
        set((s) => ({ templates: [...s.templates, t] })),
      removeTemplate: (id) =>
        set((s) => ({ templates: s.templates.filter((t) => t.id !== id) })),
      updateTemplate: (id, partial) =>
        set((s) => ({
          templates: s.templates.map((t) =>
            t.id === id ? { ...t, ...partial } : t
          ),
        })),
    }),
    { name: "studio-prompts" }
  )
);

const VARIABLE_PRESETS: Record<string, string[]> = {
  location: [
    "cozy cafe",
    "tropical beach",
    "city rooftop",
    "luxury hotel",
    "mountain trail",
    "art gallery",
    "bookstore",
    "park bench",
  ],
  outfit: [
    "casual chic",
    "summer dress",
    "business attire",
    "sportswear",
    "evening gown",
    "streetwear",
    "bikini",
    "winter coat",
  ],
  lighting: [
    "golden hour",
    "soft studio",
    "neon lights",
    "natural daylight",
    "dramatic shadows",
    "sunset backlight",
    "ring light",
    "candlelight",
  ],
  mood: [
    "confident",
    "playful",
    "mysterious",
    "serene",
    "energetic",
    "romantic",
    "professional",
    "adventurous",
  ],
  camera: [
    "portrait lens 85mm",
    "wide angle 24mm",
    "close-up macro",
    "medium shot",
    "full body shot",
    "overhead angle",
    "low angle",
    "cinematic 35mm",
  ],
};

export default function PromptBuilderPage() {
  const t = useTranslations("promptBuilder");
  const tc = useTranslations("common");
  const { templates, addTemplate, removeTemplate } = usePromptStore();

  const [template, setTemplate] = useState(
    "A photo of {trigger} at a {location}, wearing {outfit}, {lighting} lighting, {mood} expression, shot with {camera}"
  );
  const [variables, setVariables] = useState<Record<string, string>>({
    trigger: "ohwx woman",
    location: "cozy cafe",
    outfit: "casual chic",
    lighting: "golden hour",
    mood: "confident",
    camera: "portrait lens 85mm",
  });
  const [templateName, setTemplateName] = useState("");

  const detectedVars = useMemo(() => {
    const matches = template.match(/\{(\w+)\}/g);
    if (!matches) return [];
    return [...new Set(matches.map((m) => m.slice(1, -1)))];
  }, [template]);

  const resolvedPrompt = useMemo(() => {
    let result = template;
    for (const [key, value] of Object.entries(variables)) {
      result = result.replace(new RegExp(`\\{${key}\\}`, "g"), value);
    }
    return result;
  }, [template, variables]);

  const handleSaveTemplate = useCallback(() => {
    const name = templateName.trim() || `Template ${templates.length + 1}`;
    addTemplate({
      id: crypto.randomUUID(),
      name,
      template,
      variables,
      created_at: new Date().toISOString(),
    });
    setTemplateName("");
    toast.success(`Template "${name}" saved`);
  }, [template, variables, templateName, templates.length, addTemplate]);

  const handleLoadTemplate = useCallback((t: PromptTemplate) => {
    setTemplate(t.template);
    setVariables(t.variables);
    toast.success(`Loaded "${t.name}"`);
  }, []);

  const handleCopy = useCallback(() => {
    navigator.clipboard.writeText(resolvedPrompt);
    toast.success(tc("copied"));
  }, [resolvedPrompt, tc]);

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

      <div className="grid gap-6 lg:grid-cols-[1fr_380px]">
        {/* Left: Builder */}
        <div className="space-y-5">
          {/* Template */}
          <Card className="glass-card">
            <CardContent className="p-5 space-y-4">
              <div className="flex items-center justify-between">
                <h3 className="text-xs font-semibold uppercase tracking-widest text-muted-foreground/60">
                  {t("template")}
                </h3>
                <span className="text-[10px] font-mono text-muted-foreground/50">
                  {detectedVars.length} variables
                </span>
              </div>
              <Textarea
                value={template}
                onChange={(e) => setTemplate(e.target.value)}
                rows={4}
                placeholder={t("templatePlaceholder")}
                className="resize-none font-mono text-sm"
              />
              <p className="text-[10px] text-muted-foreground/50">
                Use {"{variable_name}"} syntax. Detected variables are shown
                below.
              </p>
            </CardContent>
          </Card>

          {/* Variables */}
          <Card className="glass-card">
            <CardContent className="p-5 space-y-4">
              <h3 className="text-xs font-semibold uppercase tracking-widest text-muted-foreground/60">
                {t("variables")}
              </h3>
              {detectedVars.length === 0 ? (
                <p className="text-sm text-muted-foreground/50">
                  No variables detected in template
                </p>
              ) : (
                <div className="space-y-3">
                  {detectedVars.map((varName) => (
                    <div key={varName} className="space-y-1.5">
                      <Label className="text-xs font-medium">
                        <Badge variant="outline" className="mr-1.5 text-[9px]">
                          {varName}
                        </Badge>
                      </Label>
                      <div className="flex gap-2">
                        <Input
                          value={variables[varName] ?? ""}
                          onChange={(e) =>
                            setVariables((prev) => ({
                              ...prev,
                              [varName]: e.target.value,
                            }))
                          }
                          placeholder={`Enter ${varName}...`}
                          className="h-8 text-sm"
                        />
                        {VARIABLE_PRESETS[varName] && (
                          <Select
                            value={variables[varName] ?? ""}
                            onValueChange={(v) =>
                              setVariables((prev) => ({
                                ...prev,
                                [varName]: v,
                              }))
                            }
                          >
                            <SelectTrigger className="h-8 w-40 text-xs">
                              <SelectValue placeholder="Presets" />
                            </SelectTrigger>
                            <SelectContent>
                              {VARIABLE_PRESETS[varName].map((preset) => (
                                <SelectItem
                                  key={preset}
                                  value={preset}
                                  className="text-xs"
                                >
                                  {preset}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>

          {/* Saved Templates */}
          {templates.length > 0 && (
            <Card className="glass-card">
              <CardContent className="p-5 space-y-3">
                <h3 className="text-xs font-semibold uppercase tracking-widest text-muted-foreground/60">
                  {t("savedTemplates")}
                </h3>
                <div className="space-y-2">
                  {templates.map((t) => (
                    <div
                      key={t.id}
                      className="flex items-center justify-between rounded-lg border border-border/50 p-3"
                    >
                      <div className="min-w-0 flex-1">
                        <p className="text-sm font-medium">{t.name}</p>
                        <p className="truncate text-[10px] text-muted-foreground font-mono">
                          {t.template}
                        </p>
                      </div>
                      <div className="ml-2 flex gap-1">
                        <Button
                          size="icon"
                          variant="ghost"
                          className="h-7 w-7"
                          onClick={() => handleLoadTemplate(t)}
                        >
                          <Wand2 className="h-3 w-3" />
                        </Button>
                        <Button
                          size="icon"
                          variant="ghost"
                          className="h-7 w-7 text-destructive"
                          onClick={() => removeTemplate(t.id)}
                        >
                          <Trash2 className="h-3 w-3" />
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}
        </div>

        {/* Right: Preview + Actions */}
        <div className="space-y-4 lg:sticky lg:top-6 lg:self-start">
          {/* Live Preview */}
          <Card className="glass-card">
            <CardContent className="p-5 space-y-3">
              <h3 className="text-xs font-semibold uppercase tracking-widest text-muted-foreground/60">
                {t("preview")}
              </h3>
              <div className="rounded-lg bg-muted/30 p-3">
                <p className="text-sm leading-relaxed">{resolvedPrompt}</p>
              </div>
              <div className="flex gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  className="flex-1"
                  onClick={handleCopy}
                >
                  <Copy className="mr-1.5 h-3 w-3" />
                  {t("copyPrompt")}
                </Button>
                <Button size="sm" className="flex-1" asChild>
                  <Link
                    href={`/generate?prompt=${encodeURIComponent(resolvedPrompt)}`}
                  >
                    <Sparkles className="mr-1.5 h-3 w-3" />
                    {t("generateWith")}
                    <ArrowRight className="ml-1 h-3 w-3" />
                  </Link>
                </Button>
              </div>
            </CardContent>
          </Card>

          {/* Save Template */}
          <Card className="glass-card">
            <CardContent className="p-5 space-y-3">
              <h3 className="text-xs font-semibold uppercase tracking-widest text-muted-foreground/60">
                {t("saveTemplate")}
              </h3>
              <Input
                value={templateName}
                onChange={(e) => setTemplateName(e.target.value)}
                placeholder={t("templateNamePlaceholder")}
                className="h-8 text-sm"
              />
              <Button
                className="w-full bg-gradient-to-r from-primary to-[oklch(0.70_0.22_310)] text-white"
                size="sm"
                onClick={handleSaveTemplate}
              >
                <Plus className="mr-1.5 h-3 w-3" />
                {t("saveTemplate")}
              </Button>
            </CardContent>
          </Card>
        </div>
      </div>
    </motion.div>
  );
}
