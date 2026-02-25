/**
 * Quality presets for non-technical users.
 * Each preset maps to optimal parameter values.
 */

export type QualityLevel = "fast" | "balanced" | "maximum";

export interface QualityPreset {
  id: QualityLevel;
  nameKey: string;
  descriptionKey: string;
  icon: string;
  params: {
    steps: number;
    face_lora_strength: number;
    ip_adapter_strength: number;
    face_detailer_denoise: number;
    width: number;
    height: number;
  };
}

export const QUALITY_PRESETS: QualityPreset[] = [
  {
    id: "fast",
    nameKey: "quality.fast.name",
    descriptionKey: "quality.fast.description",
    icon: "⚡",
    params: {
      steps: 18,
      face_lora_strength: 0.85,
      ip_adapter_strength: 0.4,
      face_detailer_denoise: 0.38,
      width: 768,
      height: 768,
    },
  },
  {
    id: "balanced",
    nameKey: "quality.balanced.name",
    descriptionKey: "quality.balanced.description",
    icon: "✨",
    params: {
      steps: 28,
      face_lora_strength: 0.9,
      ip_adapter_strength: 0.5,
      face_detailer_denoise: 0.42,
      width: 1024,
      height: 1024,
    },
  },
  {
    id: "maximum",
    nameKey: "quality.maximum.name",
    descriptionKey: "quality.maximum.description",
    icon: "💎",
    params: {
      steps: 40,
      face_lora_strength: 0.95,
      ip_adapter_strength: 0.55,
      face_detailer_denoise: 0.45,
      width: 1024,
      height: 1024,
    },
  },
];

export function getPresetByLevel(level: QualityLevel): QualityPreset {
  return QUALITY_PRESETS.find((p) => p.id === level) ?? QUALITY_PRESETS[1];
}

/**
 * Parameter hints for advanced mode.
 * Explains what each slider does in plain language.
 */
export interface ParamHint {
  hintKey: string;
  min: number;
  max: number;
  step: number;
  recommendedMin: number;
  recommendedMax: number;
}

export const PARAM_HINTS: Record<string, ParamHint> = {
  face_lora_strength: {
    hintKey: "face_lora_strength",
    min: 0,
    max: 1.5,
    step: 0.05,
    recommendedMin: 0.8,
    recommendedMax: 1.0,
  },
  ip_adapter_strength: {
    hintKey: "ip_adapter_strength",
    min: 0,
    max: 1,
    step: 0.05,
    recommendedMin: 0.35,
    recommendedMax: 0.65,
  },
  steps: {
    hintKey: "steps",
    min: 10,
    max: 50,
    step: 1,
    recommendedMin: 20,
    recommendedMax: 40,
  },
  face_detailer_denoise: {
    hintKey: "face_detailer_denoise",
    min: 0.1,
    max: 0.8,
    step: 0.01,
    recommendedMin: 0.35,
    recommendedMax: 0.5,
  },
  edit_denoise: {
    hintKey: "edit_denoise",
    min: 0.3,
    max: 0.9,
    step: 0.05,
    recommendedMin: 0.45,
    recommendedMax: 0.75,
  },
};

/**
 * Simplified change amount presets for editor.
 */
export type ChangeAmount = "subtle" | "moderate" | "dramatic";

export const CHANGE_AMOUNTS: Array<{
  id: ChangeAmount;
  labelKey: string;
  descriptionKey: string;
  denoise: number;
}> = [
  {
    id: "subtle",
    labelKey: "quality.changeAmounts.subtle.label",
    descriptionKey: "quality.changeAmounts.subtle.description",
    denoise: 0.45,
  },
  {
    id: "moderate",
    labelKey: "quality.changeAmounts.moderate.label",
    descriptionKey: "quality.changeAmounts.moderate.description",
    denoise: 0.6,
  },
  {
    id: "dramatic",
    labelKey: "quality.changeAmounts.dramatic.label",
    descriptionKey: "quality.changeAmounts.dramatic.description",
    denoise: 0.75,
  },
];
