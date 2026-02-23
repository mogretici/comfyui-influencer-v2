// ─── Generation Types ────────────────────────────────────

export type GenerationAction = "generate" | "edit" | "detailer";

export interface GenerateParams {
  action: "generate";
  prompt: string;
  negative_prompt?: string;
  face_lora?: string;
  face_lora_strength?: number;
  realism_lora_strength?: number;
  ip_adapter_strength?: number;
  reference_image?: string;
  width?: number;
  height?: number;
  steps?: number;
  cfg?: number;
  seed?: number;
  face_detailer_denoise?: number;
  face_margin?: number;
  face_feather?: number;
}

export interface EditParams {
  action: "edit";
  prompt: string;
  negative_prompt?: string;
  input_image: string;
  denoise?: number;
  face_lora?: string;
  face_lora_strength?: number;
  seed?: number;
}

export interface DetailerParams {
  action: "detailer";
  input_image: string;
  face_detailer_denoise?: number;
  upscale_factor?: number;
  seed?: number;
}

export type WorkflowParams = GenerateParams | EditParams | DetailerParams;

// ─── API Response Types ──────────────────────────────────

export interface RunPodResponse {
  id: string;
  status: "IN_QUEUE" | "IN_PROGRESS" | "COMPLETED" | "FAILED" | "CANCELLED";
  output?: {
    images?: string[];
    prompt_id?: string;
    seed?: number;
    error?: string;
  };
  error?: string;
}

export interface RunPodHealthResponse {
  jobs: {
    completed: number;
    failed: number;
    inProgress: number;
    inQueue: number;
    retried: number;
  };
  workers: {
    idle: number;
    initializing: number;
    ready: number;
    running: number;
    throttled: number;
  };
}

// ─── Gallery Types ───────────────────────────────────────

export interface GeneratedImage {
  id: string;
  base64: string;
  prompt: string;
  negative_prompt: string;
  action: GenerationAction;
  params: Record<string, unknown>;
  seed: number;
  created_at: string;
  favorite: boolean;
}

// ─── Settings Types ──────────────────────────────────────

export interface StudioSettings {
  runpod_api_key: string;
  runpod_endpoint_id: string;
  default_face_lora: string;
  default_face_lora_strength: number;
  default_realism_lora_strength: number;
  default_ip_adapter_strength: number;
  default_steps: number;
  default_cfg: number;
  default_width: number;
  default_height: number;
  default_face_detailer_denoise: number;
}

// ─── Preset Types ────────────────────────────────────────

export interface ScenePreset {
  id: string;
  nameKey: string;
  descriptionKey: string;
  icon: string;
  prompt_template: string;
  negative_prompt: string;
  recommended_params?: Partial<GenerateParams>;
}

// ─── Character Types ─────────────────────────────────────

export interface CharacterProfile {
  name: string;
  trigger_word: string;
  description: string;
  face_lora: string;
  reference_images: string[];
  created_at: string;
}
