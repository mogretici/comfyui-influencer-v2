import type { ScenePreset } from "@/types";

// ─── Character Training Presets ─────────────────────────
// Optimized for LoRA training: different angles, lighting, expressions
// Each generates ideal training data for face consistency

export interface CharacterPreset {
  id: string;
  nameKey: string;
  descriptionKey: string;
  icon: string;
  prompt_template: string;
  recommended_params?: {
    width?: number;
    height?: number;
    steps?: number;
  };
}

export const CHARACTER_PRESETS: CharacterPreset[] = [
  {
    id: "front-closeup",
    nameKey: "characterPresets.frontCloseup.name",
    descriptionKey: "characterPresets.frontCloseup.description",
    icon: "🎯",
    prompt_template:
      "Close-up portrait photograph of {trigger}, looking directly at camera, neutral expression, front-facing symmetrical pose. Shot on Canon EOS R5, 85mm f/1.4 lens, soft natural window light from the left, shallow depth of field. Visible skin texture, pores, subtle imperfections. Clean neutral background, no makeup, hair pulled back. Professional headshot, photorealistic, 8k",
    recommended_params: { width: 1024, height: 1024, steps: 35 },
  },
  {
    id: "three-quarter-left",
    nameKey: "characterPresets.threeQuarterLeft.name",
    descriptionKey: "characterPresets.threeQuarterLeft.description",
    icon: "↩️",
    prompt_template:
      "Portrait photograph of {trigger}, three-quarter view facing left, slight natural smile, relaxed shoulders. Shot on Canon EOS R5, 85mm f/1.4 lens, diffused studio light with fill light, shallow depth of field. Visible skin texture and natural complexion. Clean neutral background, minimal makeup, natural hair. Professional portrait, photorealistic, 8k",
    recommended_params: { width: 1024, height: 1024, steps: 35 },
  },
  {
    id: "three-quarter-right",
    nameKey: "characterPresets.threeQuarterRight.name",
    descriptionKey: "characterPresets.threeQuarterRight.description",
    icon: "↪️",
    prompt_template:
      "Portrait photograph of {trigger}, three-quarter view facing right, subtle smile, relaxed expression. Shot on Canon EOS R5, 85mm f/1.4 lens, soft Rembrandt lighting from right side, shallow depth of field. Natural skin texture and realistic complexion. Clean neutral background, minimal makeup, natural hair. Professional portrait, photorealistic, 8k",
    recommended_params: { width: 1024, height: 1024, steps: 35 },
  },
  {
    id: "profile-side",
    nameKey: "characterPresets.profileSide.name",
    descriptionKey: "characterPresets.profileSide.description",
    icon: "👤",
    prompt_template:
      "Side profile portrait of {trigger}, looking to the left, chin slightly lifted, serene expression. Shot on Canon EOS R5, 85mm f/1.4 lens, rim lighting from behind, clean studio setup. Sharp jawline detail, visible ear, natural skin texture. Clean white background, no makeup, hair tucked behind ear. Professional profile shot, photorealistic, 8k",
    recommended_params: { width: 1024, height: 1024, steps: 35 },
  },
  {
    id: "full-body",
    nameKey: "characterPresets.fullBody.name",
    descriptionKey: "characterPresets.fullBody.description",
    icon: "🧍‍♀️",
    prompt_template:
      "Full body photograph of {trigger}, standing naturally with weight on one leg, hands at sides, looking at camera with confident expression. Wearing simple white t-shirt and blue jeans. Shot on Canon EOS R5, 50mm f/1.8 lens, natural daylight in a studio, full body visible from head to feet. Clean neutral background, natural posture, photorealistic, 8k",
    recommended_params: { width: 768, height: 1152, steps: 35 },
  },
  {
    id: "golden-hour",
    nameKey: "characterPresets.goldenHour.name",
    descriptionKey: "characterPresets.goldenHour.description",
    icon: "🌅",
    prompt_template:
      "Portrait photograph of {trigger}, golden hour warm sunlight, looking at camera with gentle smile, wind slightly moving hair. Shot on Canon EOS R5, 85mm f/1.4 lens, backlit golden hour sun creating warm rim light, lens flare. Natural skin glow, warm tones, visible skin texture. Outdoor blurred background, casual outfit, photorealistic, 8k",
    recommended_params: { width: 1024, height: 1024, steps: 35 },
  },
  {
    id: "expressive-smile",
    nameKey: "characterPresets.expressiveSmile.name",
    descriptionKey: "characterPresets.expressiveSmile.description",
    icon: "😊",
    prompt_template:
      "Close-up portrait of {trigger}, genuine bright smile showing teeth, eyes slightly squinted from smiling, joyful expression. Shot on Canon EOS R5, 85mm f/1.4 lens, soft diffused natural light, shallow depth of field. Laugh lines visible, natural skin texture, bright eyes. Clean soft background, minimal makeup, photorealistic, 8k",
    recommended_params: { width: 1024, height: 1024, steps: 35 },
  },
  {
    id: "serious-look",
    nameKey: "characterPresets.seriousLook.name",
    descriptionKey: "characterPresets.seriousLook.description",
    icon: "😐",
    prompt_template:
      "Portrait photograph of {trigger}, serious contemplative expression, direct intense eye contact, slightly furrowed brow. Shot on Canon EOS R5, 85mm f/1.4 lens, dramatic side lighting with deep shadows, moody atmosphere. Sharp facial details, natural skin texture. Dark clean background, no smile, professional editorial look, photorealistic, 8k",
    recommended_params: { width: 1024, height: 1024, steps: 35 },
  },
];

// ─── Scene Presets ──────────────────────────────────────

export const SCENE_PRESETS: ScenePreset[] = [
  {
    id: "cafe",
    nameKey: "presets.cafe.name",
    descriptionKey: "presets.cafe.description",
    icon: "☕",
    prompt_template:
      "Candid photograph of {trigger} sitting in a cozy cafe, holding a ceramic coffee cup, warm ambient lighting from Edison bulbs overhead. Shot on Canon EOS R5, 85mm f/1.4 lens, shallow depth of field, creamy bokeh background. Visible skin texture, natural complexion, subtle smile. Wearing casual knit sweater, wooden table, steam rising from cup. Photorealistic, 8k",
  },
  {
    id: "beach",
    nameKey: "presets.beach.name",
    descriptionKey: "presets.beach.description",
    icon: "🏖️",
    prompt_template:
      "Photograph of {trigger} at a tropical beach during golden hour, warm sunset backlighting creating rim light on hair and skin. Shot on Canon EOS R5, 85mm f/1.4 lens, shallow depth of field. Wind gently moving hair, wearing a light summer dress, bare feet on sand. Natural sun-kissed skin glow, visible skin texture, relaxed genuine expression. Ocean waves blurred in background, photorealistic, 8k",
  },
  {
    id: "gym",
    nameKey: "presets.gym.name",
    descriptionKey: "presets.gym.description",
    icon: "💪",
    prompt_template:
      "Photograph of {trigger} in a modern gym, wearing fitted athletic wear, confident standing pose near weight rack. Shot on Canon EOS R5, 70-200mm f/2.8 lens, natural window light mixed with overhead gym lights. Light perspiration on skin, visible skin texture, determined expression. Clean modern gym background with equipment slightly blurred, photorealistic, 8k",
  },
  {
    id: "street-fashion",
    nameKey: "presets.streetFashion.name",
    descriptionKey: "presets.streetFashion.description",
    icon: "👗",
    prompt_template:
      "Street fashion photograph of {trigger} walking on a European city street, stylish urban outfit with layers, confident stride. Shot on Canon EOS R5, 50mm f/1.2 lens, golden hour side lighting casting long shadows. Shallow depth of field, blurred architecture background. Natural skin texture, wind-touched hair, candid mid-step pose. Editorial street style, photorealistic, 8k",
  },
  {
    id: "studio-portrait",
    nameKey: "presets.studioPortrait.name",
    descriptionKey: "presets.studioPortrait.description",
    icon: "📸",
    prompt_template:
      "Professional studio portrait of {trigger}, clean seamless white background, two-light setup with main softbox and fill. Shot on Canon EOS R5, 85mm f/1.4 lens, sharp focus on eyes. Subtle professional makeup, visible skin pores and texture, confident direct gaze. Hair professionally styled, wearing elegant blouse, high-end editorial look, photorealistic, 8k",
  },
  {
    id: "travel",
    nameKey: "presets.travel.name",
    descriptionKey: "presets.travel.description",
    icon: "✈️",
    prompt_template:
      "Travel photograph of {trigger} in a charming European cobblestone old town, leaning against ancient stone wall, small leather bag over shoulder. Shot on Canon EOS R5, 35mm f/1.4 lens, natural daylight. Looking at camera with warm genuine smile, casual travel outfit. Visible skin texture, natural complexion, slightly windswept hair. Blurred historic buildings in background, photorealistic, 8k",
  },
  {
    id: "restaurant",
    nameKey: "presets.restaurant.name",
    descriptionKey: "presets.restaurant.description",
    icon: "🍽️",
    prompt_template:
      "Photograph of {trigger} seated at an upscale restaurant, warm candlelight illuminating face from below, dressed in elegant evening wear. Shot on Canon EOS R5, 50mm f/1.4 lens, shallow depth of field. Soft warm skin tones, visible skin texture, refined subtle smile. Wine glass and plated food slightly blurred on table, dark moody ambient background, photorealistic, 8k",
  },
  {
    id: "nature",
    nameKey: "presets.nature.name",
    descriptionKey: "presets.nature.description",
    icon: "🌿",
    prompt_template:
      "Photograph of {trigger} in a lush green forest, dappled sunlight filtering through tree canopy creating light spots on face. Shot on Canon EOS R5, 85mm f/1.4 lens, shallow depth of field. Wearing casual boho outfit, peaceful serene expression, natural hair. Visible freckles and skin texture, sun-dappled warm tones, green foliage bokeh background, photorealistic, 8k",
  },
  {
    id: "home",
    nameKey: "presets.home.name",
    descriptionKey: "presets.home.description",
    icon: "🏠",
    prompt_template:
      "Lifestyle photograph of {trigger} relaxing on a cozy sofa at home, wearing comfortable oversized sweater, holding a book. Shot on Canon EOS R5, 35mm f/1.4 lens, soft warm interior window light. Bare face with visible natural skin texture, relaxed genuine expression, messy casual hair. Warm earth tones, soft pillows and blanket, hygge atmosphere, photorealistic, 8k",
  },
  {
    id: "night-city",
    nameKey: "presets.nightCity.name",
    descriptionKey: "presets.nightCity.description",
    icon: "🌃",
    prompt_template:
      "Photograph of {trigger} on a city rooftop at night, colorful city lights creating bokeh background, wearing stylish dark outfit. Shot on Canon EOS R5, 50mm f/1.2 lens, wide open aperture. Neon reflections on skin, moody cinematic color grading, natural skin texture visible under ambient light. Confident pose leaning on railing, wind in hair, photorealistic, 8k",
  },
];

export function buildPrompt(
  template: string,
  triggerWord: string = "ohwx woman"
): string {
  return template.replace("{trigger}", triggerWord);
}
