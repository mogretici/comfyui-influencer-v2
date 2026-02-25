import type { ScenePreset } from "@/types";

export const SCENE_PRESETS: ScenePreset[] = [
  {
    id: "cafe",
    nameKey: "presets.cafe.name",
    descriptionKey: "presets.cafe.description",
    icon: "☕",
    prompt_template:
      "A photo of {trigger} sitting in a cozy cafe, holding a coffee cup, warm ambient lighting, bokeh background, canon eos r5, 85mm f/1.4",
  },
  {
    id: "beach",
    nameKey: "presets.beach.name",
    descriptionKey: "presets.beach.description",
    icon: "🏖️",
    prompt_template:
      "A photo of {trigger} at a tropical beach, sunset golden hour lighting, wearing a summer outfit, wind in hair, ocean background, canon eos r5, 85mm f/1.4",
  },
  {
    id: "gym",
    nameKey: "presets.gym.name",
    descriptionKey: "presets.gym.description",
    icon: "💪",
    prompt_template:
      "A photo of {trigger} in a modern gym, wearing athletic wear, confident pose, natural lighting from windows, professional fitness photography, canon eos r5, 70-200mm",
  },
  {
    id: "street-fashion",
    nameKey: "presets.streetFashion.name",
    descriptionKey: "presets.streetFashion.description",
    icon: "👗",
    prompt_template:
      "A photo of {trigger} walking on a city street, stylish urban outfit, street fashion photography, golden hour, shallow depth of field, canon eos r5, 50mm f/1.2",
  },
  {
    id: "studio-portrait",
    nameKey: "presets.studioPortrait.name",
    descriptionKey: "presets.studioPortrait.description",
    icon: "📸",
    prompt_template:
      "A professional studio portrait of {trigger}, clean white background, studio lighting with softbox, high fashion makeup, sharp focus, canon eos r5, 85mm f/1.4",
  },
  {
    id: "travel",
    nameKey: "presets.travel.name",
    descriptionKey: "presets.travel.description",
    icon: "✈️",
    prompt_template:
      "A photo of {trigger} exploring a beautiful European old town, travel photography, natural lighting, carrying a small bag, looking at camera with smile, canon eos r5, 35mm",
  },
  {
    id: "restaurant",
    nameKey: "presets.restaurant.name",
    descriptionKey: "presets.restaurant.description",
    icon: "🍽️",
    prompt_template:
      "A photo of {trigger} at an upscale restaurant, elegant dining scene, warm candlelight ambiance, dressed elegantly, shallow depth of field, canon eos r5, 50mm f/1.4",
  },
  {
    id: "nature",
    nameKey: "presets.nature.name",
    descriptionKey: "presets.nature.description",
    icon: "🌿",
    prompt_template:
      "A photo of {trigger} in a lush green forest, dappled sunlight through trees, casual boho outfit, peaceful expression, nature photography, canon eos r5, 85mm f/1.4",
  },
  {
    id: "home",
    nameKey: "presets.home.name",
    descriptionKey: "presets.home.description",
    icon: "🏠",
    prompt_template:
      "A photo of {trigger} relaxing at home on a cozy sofa, wearing comfortable casual clothes, warm interior lighting, lifestyle photography, canon eos r5, 35mm f/1.4",
  },
  {
    id: "night-city",
    nameKey: "presets.nightCity.name",
    descriptionKey: "presets.nightCity.description",
    icon: "🌃",
    prompt_template:
      "A photo of {trigger} on a city rooftop at night, city lights bokeh background, stylish outfit, moody cinematic lighting, neon reflections, canon eos r5, 50mm f/1.2",
  },
];

export function buildPrompt(
  template: string,
  triggerWord: string = "ohwx woman"
): string {
  return template.replace("{trigger}", triggerWord);
}
