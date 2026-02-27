#!/bin/bash
set -uo pipefail
# NOTE: no set -e — download failures must NOT crash the container

# Download all models to Network Volume (one-time operation)
# Subsequent runs skip already-downloaded files

MODELS_DIR="/runpod-volume/models"
MARKER="$MODELS_DIR/.download_complete_v9"
DOWNLOAD_FAILURES=0

if [ -f "$MARKER" ]; then
    echo "[OK] Models already downloaded (marker v8 found)"
    exit 0
fi

echo "============================================"
echo " Downloading models to Network Volume..."
echo " Flux 1 Dev FP8 pipeline (~50GB total)"
echo "============================================"

download() {
    local dest="$1"
    local url="$2"
    local name="$3"

    if [ -f "$dest" ]; then
        echo "[SKIP] $name (already exists)"
        return 0
    fi

    mkdir -p "$(dirname "$dest")"
    echo "[DL] $name ..."

    # Support HF_TOKEN for gated repos
    local wget_exit=0
    if [ -n "${HF_TOKEN:-}" ]; then
        wget -q --show-progress --header="Authorization: Bearer $HF_TOKEN" -O "${dest}.tmp" "$url" || wget_exit=$?
    else
        wget -q --show-progress -O "${dest}.tmp" "$url" || wget_exit=$?
    fi

    if [ $wget_exit -ne 0 ]; then
        echo "[WARN] Failed to download $name (wget exit $wget_exit), skipping"
        rm -f "${dest}.tmp"
        DOWNLOAD_FAILURES=$((DOWNLOAD_FAILURES + 1))
        return 0
    fi

    mv "${dest}.tmp" "$dest"
    echo "[OK] $name"
}

# 1. Flux 1 Dev FP8 (~17.2GB) — full PuLID/ControlNet compatibility
download "$MODELS_DIR/diffusion_models/flux1-dev-fp8.safetensors" \
    "https://huggingface.co/Comfy-Org/flux1-dev/resolve/main/flux1-dev-fp8.safetensors" \
    "Flux 1 Dev FP8 e4m3fn"

# 2. CLIP-L Text Encoder (~250MB)
download "$MODELS_DIR/text_encoders/clip_l.safetensors" \
    "https://huggingface.co/comfyanonymous/flux_text_encoders/resolve/main/clip_l.safetensors" \
    "CLIP-L Text Encoder"

# 3. T5-XXL FP8 Text Encoder (~4.6GB)
download "$MODELS_DIR/text_encoders/t5xxl_fp8_e4m3fn.safetensors" \
    "https://huggingface.co/comfyanonymous/flux_text_encoders/resolve/main/t5xxl_fp8_e4m3fn.safetensors" \
    "T5-XXL FP8 Text Encoder"

# 4. Flux 1 VAE BF16 (~336MB) — public mirror (BFL repo is gated)
download "$MODELS_DIR/vae/ae.safetensors" \
    "https://huggingface.co/Kijai/flux-fp8/resolve/main/flux-vae-bf16.safetensors" \
    "Flux 1 VAE BF16"

# 5. XLabs IP-Adapter v2 (~1GB)
download "$MODELS_DIR/xlabs/ipadapters/flux-ip-adapter-v2.safetensors" \
    "https://huggingface.co/XLabs-AI/flux-ip-adapter-v2/resolve/main/ip_adapter.safetensors" \
    "XLabs IP-Adapter v2"

# 6. InsightFace AntelopeV2 (~300MB)
if [ ! -d "$MODELS_DIR/insightface/models/antelopev2" ]; then
    echo "[DL] InsightFace AntelopeV2 ..."
    mkdir -p "$MODELS_DIR/insightface/models"
    if wget -q -O /tmp/antelopev2.zip \
        "https://huggingface.co/MonsterMMORPG/tools/resolve/main/antelopev2.zip"; then
        unzip -o /tmp/antelopev2.zip -d "$MODELS_DIR/insightface/models/"
        rm -f /tmp/antelopev2.zip
        echo "[OK] InsightFace AntelopeV2"
    else
        echo "[WARN] Failed to download InsightFace AntelopeV2, skipping"
        rm -f /tmp/antelopev2.zip
        DOWNLOAD_FAILURES=$((DOWNLOAD_FAILURES + 1))
    fi
else
    echo "[SKIP] InsightFace AntelopeV2 (already exists)"
fi

# 7. Face Detection + SAM (~75MB)
download "$MODELS_DIR/ultralytics/bbox/face_yolov8m.pt" \
    "https://huggingface.co/Tenofas/ComfyUI/resolve/main/ultralytics/bbox/face_yolov8m.pt" \
    "YOLOv8m Face Detection"

download "$MODELS_DIR/sams/sam_vit_b_01ec64.pth" \
    "https://dl.fbaipublicfiles.com/segment_anything/sam_vit_b_01ec64.pth" \
    "SAM ViT-B"

# 8. CLIP Vision ViT-L for IP-Adapter (~890MB) — OpenAI source (XLabs repo removed file)
download "$MODELS_DIR/clip_vision/clip_vision_l.safetensors" \
    "https://huggingface.co/openai/clip-vit-large-patch14/resolve/main/model.safetensors" \
    "CLIP Vision ViT-L (IP-Adapter)"

# 9. 4x-UltraSharp Upscaler (~65MB)
download "$MODELS_DIR/upscale_models/4x-UltraSharp.pth" \
    "https://huggingface.co/lokCX/4x-Ultrasharp/resolve/main/4x-UltraSharp.pth" \
    "4x-UltraSharp Upscaler"

# 10. Shakker-Labs ControlNet Union Pro 2.0 (~3.98GB) — Pose + Depth + Canny in one model
download "$MODELS_DIR/controlnet/flux-controlnet-union-pro-2.0.safetensors" \
    "https://huggingface.co/Shakker-Labs/FLUX.1-dev-ControlNet-Union-Pro-2.0/resolve/main/diffusion_pytorch_model.safetensors" \
    "Shakker-Labs ControlNet Union Pro 2.0"

# 11. DepthAnythingV2 — auto-downloaded by comfyui_controlnet_aux on first use
# AUX_ANNOTATOR_CKPTS_PATH set in start.sh ensures persistent storage on network volume

# 12. PuLID-Flux v0.9.1 (~1.14GB) — face identity preservation
download "$MODELS_DIR/pulid/pulid_flux_v0.9.1.safetensors" \
    "https://huggingface.co/guozinan/PuLID/resolve/main/pulid_flux_v0.9.1.safetensors" \
    "PuLID-Flux v0.9.1"

# 13. EVA-CLIP for PuLID (~1.7GB) — in text_encoders (ComfyUI maps "clip" → text_encoders)
download "$MODELS_DIR/text_encoders/EVA02_CLIP_L_336_psz14_s6B.pt" \
    "https://huggingface.co/QuanSun/EVA-CLIP/resolve/main/EVA02_CLIP_L_336_psz14_s6B.pt" \
    "EVA-CLIP ViT-L (PuLID)"

# Mark download complete (only if all downloads succeeded)
if [ $DOWNLOAD_FAILURES -eq 0 ]; then
    touch "$MARKER"
    echo "============================================"
    echo " All models downloaded successfully!"
    echo "============================================"
else
    echo "============================================"
    echo " [WARN] $DOWNLOAD_FAILURES download(s) failed"
    echo " Container will start anyway. Missing models"
    echo " will cause errors for features that need them."
    echo " Marker NOT set — downloads will retry next start."
    echo "============================================"
fi
