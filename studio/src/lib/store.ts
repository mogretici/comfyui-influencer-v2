import { create } from "zustand";
import { persist } from "zustand/middleware";
import type {
  GeneratedImage,
  StudioSettings,
  CharacterProfile,
} from "@/types";
import type { Locale } from "@/lib/i18n/config";

// ─── Settings Store ──────────────────────────────────────

interface SettingsState {
  settings: StudioSettings;
  locale: Locale;
  updateSettings: (partial: Partial<StudioSettings>) => void;
  setLocale: (locale: Locale) => void;
  isConfigured: () => boolean;
}

const DEFAULT_SETTINGS: StudioSettings = {
  runpod_api_key: "",
  runpod_endpoint_id: "",
  default_face_lora: "my_face.safetensors",
  default_face_lora_strength: 0.9,
  default_realism_lora_strength: 0.35,
  default_ip_adapter_strength: 0.5,
  default_steps: 28,
  default_cfg: 1.0,
  default_width: 1024,
  default_height: 1024,
  default_face_detailer_denoise: 0.42,
};

export const useSettingsStore = create<SettingsState>()(
  persist(
    (set, get) => ({
      settings: DEFAULT_SETTINGS,
      locale: "tr" as Locale,
      updateSettings: (partial) =>
        set((state) => ({
          settings: { ...state.settings, ...partial },
        })),
      setLocale: (locale) => set({ locale }),
      isConfigured: () => {
        const { runpod_api_key, runpod_endpoint_id } = get().settings;
        return runpod_api_key.length > 0 && runpod_endpoint_id.length > 0;
      },
    }),
    { name: "studio-settings" }
  )
);

// ─── Gallery Store ───────────────────────────────────────

interface GalleryState {
  images: GeneratedImage[];
  addImage: (image: GeneratedImage) => void;
  removeImage: (id: string) => void;
  toggleFavorite: (id: string) => void;
  clearAll: () => void;
}

export const useGalleryStore = create<GalleryState>()(
  persist(
    (set) => ({
      images: [],
      addImage: (image) =>
        set((state) => ({ images: [image, ...state.images] })),
      removeImage: (id) =>
        set((state) => ({
          images: state.images.filter((img) => img.id !== id),
        })),
      toggleFavorite: (id) =>
        set((state) => ({
          images: state.images.map((img) =>
            img.id === id ? { ...img, favorite: !img.favorite } : img
          ),
        })),
      clearAll: () => set({ images: [] }),
    }),
    { name: "studio-gallery" }
  )
);

// ─── Character Store ─────────────────────────────────────

interface CharacterState {
  character: CharacterProfile | null;
  setCharacter: (character: CharacterProfile) => void;
  clearCharacter: () => void;
}

export const useCharacterStore = create<CharacterState>()(
  persist(
    (set) => ({
      character: null,
      setCharacter: (character) => set({ character }),
      clearCharacter: () => set({ character: null }),
    }),
    { name: "studio-character" }
  )
);

// ─── Generation Store (non-persistent) ──────────────────

interface GenerationState {
  isGenerating: boolean;
  progress: string;
  currentJobId: string | null;
  setGenerating: (val: boolean) => void;
  setProgress: (msg: string) => void;
  setCurrentJobId: (id: string | null) => void;
}

export const useGenerationStore = create<GenerationState>()((set) => ({
  isGenerating: false,
  progress: "",
  currentJobId: null,
  setGenerating: (val) => set({ isGenerating: val }),
  setProgress: (msg) => set({ progress: msg }),
  setCurrentJobId: (id) => set({ currentJobId: id }),
}));
