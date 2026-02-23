# ComfyUI Influencer v2 — AI Influencer Pipeline

Docker image for generating photorealistic AI influencer content using
**Flux 2 Dev** (32B parameters, 40% AI detection rate in blind tests).

## Stack

| Component | Choice | Purpose |
|-----------|--------|---------|
| Base Model | Flux 2 Dev GGUF Q5 (~23GB) | Photorealistic image generation |
| Text Encoders | T5-XXL FP8 + CLIP-L | Prompt understanding |
| Face Identity | Custom Face LoRA + IP-Adapter v2 | 97% face consistency |
| Face Detail | YOLOv8m + MobileSAM + FaceDetailer | Face refinement |
| Upscaler | 4x-UltraSharp | 4K output |
| Pose Control | ControlNet OpenPose (XLabs) | Pose guidance |

## VRAM Requirements

**Minimum: 48GB GPU (L40S recommended)**

```
Flux 2 Dev Q5:    ~23 GB
T5-XXL FP8:       ~5 GB
CLIP-L + VAE:     ~1 GB
IP-Adapter v2:    ~1 GB
InsightFace:      ~0.5 GB
Buffer:           ~17.5 GB
─────────────────────────
Total:            ~48 GB
```

## Quick Start

### Local Development

```bash
# Build (takes ~30min due to model downloads)
docker build -t comfyui-influencer-v2 .

# Run with GPU
docker compose up

# Access ComfyUI UI
open http://localhost:8188
```

### RunPod Serverless

1. Push image to Docker Hub (or use GitHub Actions)
2. Create RunPod Serverless endpoint:
   - GPU: L40S 48GB
   - Container Disk: 50GB
   - Min Workers: 0, Max Workers: 3
   - Idle Timeout: 60s

3. Test:
```bash
python scripts/test-workflow.py --runpod \
  --api-key YOUR_KEY \
  --endpoint-id YOUR_ID
```

## API Endpoints

### Generate (txt2img)

```json
{
  "input": {
    "action": "generate",
    "prompt": "A photo of ohwx woman in a cafe, golden hour, canon eos r5",
    "face_lora": "my_face.safetensors",
    "face_lora_strength": 0.9,
    "realism_lora_strength": 0.35,
    "ip_adapter_strength": 0.5,
    "reference_image": "<base64>",
    "width": 1024,
    "height": 1024,
    "steps": 28,
    "cfg": 1.0,
    "face_detailer_denoise": 0.42
  }
}
```

### Edit (img2img)

```json
{
  "input": {
    "action": "edit",
    "prompt": "Same woman at a beach, summer dress",
    "input_image": "<base64>",
    "denoise": 0.6,
    "face_lora": "my_face.safetensors"
  }
}
```

### Detailer (face enhance + upscale)

```json
{
  "input": {
    "action": "detailer",
    "input_image": "<base64>",
    "face_detailer_denoise": 0.42,
    "upscale_factor": 4
  }
}
```

## Face LoRA Training

Train your custom face LoRA separately using SimpleTuner:

1. Collect 10-20 reference photos (varied angles, lighting)
2. Train on Flux 2 Dev using SimpleTuner (separate GPU instance)
3. Place the `.safetensors` file in `/comfyui/models/loras/`

## Pipeline Flow

```
Reference Photos → SimpleTuner → Face LoRA (.safetensors)
                                       ↓
Prompt → Flux 2 Dev + Face LoRA + Realism LoRA
         + IP-Adapter v2 (reference photo)
                    ↓
           Base Image (1024x1024)
                    ↓
         FaceDetailer (YOLOv8 → SAM → re-generate face)
                    ↓
         4x-UltraSharp → 4K Output
```

## Cost Estimate (RunPod L40S)

| Metric | Value |
|--------|-------|
| Cost/hour | $0.44 |
| Time/image | 30-60s |
| Cost/image | $0.004-0.008 |
| 100 images/day | $0.40-0.80 |
| Monthly (3K images) | $12-24 |

## Project Structure

```
├── Dockerfile                    # Multi-stage build (~37GB image)
├── docker-compose.yml            # Local testing
├── .dockerignore
├── .github/workflows/
│   └── build-push.yml            # CI/CD → Docker Hub
├── src/
│   ├── handler.py                # RunPod serverless handler
│   ├── start.sh                  # Container startup
│   └── extra_model_paths.yaml    # Model path config
├── scripts/
│   ├── download-models.sh        # Model download helper
│   └── test-workflow.py          # API test script
└── workflows/
    ├── txt2img-face-lora.json    # Text-to-image + Face LoRA
    ├── img2img-edit.json         # Scene/outfit editing
    └── face-detailer-upscale.json # Face detail + 4K upscale
```
