#!/bin/bash
set -euo pipefail

# Download all models to Network Volume (one-time operation)
# Subsequent runs skip already-downloaded files

MODELS_DIR="/runpod-volume/models"
MARKER="$MODELS_DIR/.download_complete_v3"

if [ -f "$MARKER" ]; then
    echo "[OK] Models already downloaded (marker v3 found)"
    exit 0
fi

echo "============================================"
echo " Downloading models to Network Volume..."
echo " This is a one-time operation (~40GB)"
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
    if [ -n "${HF_TOKEN:-}" ]; then
        wget -q --show-progress --header="Authorization: Bearer $HF_TOKEN" -O "${dest}.tmp" "$url"
    else
        wget -q --show-progress -O "${dest}.tmp" "$url"
    fi
    mv "${dest}.tmp" "$dest"
    echo "[OK] $name"
}

# 1. Flux 2 Dev GGUF Q5 (~23GB)
download "$MODELS_DIR/unet/flux2-dev-Q5_K_M.gguf" \
    "https://huggingface.co/city96/FLUX.2-dev-gguf/resolve/main/flux2-dev-Q5_K_M.gguf" \
    "Flux 2 Dev GGUF Q5"

# 2. Flux 2 Text Encoder — Mistral 3 Small FP8 (~12GB)
download "$MODELS_DIR/text_encoders/mistral_3_small_flux2_fp8.safetensors" \
    "https://huggingface.co/Comfy-Org/flux2-dev/resolve/main/split_files/text_encoders/mistral_3_small_flux2_fp8.safetensors" \
    "Mistral 3 Small FP8 (Flux 2 Text Encoder)"

# 3. Flux 2 VAE (~336MB)
download "$MODELS_DIR/vae/flux2-vae.safetensors" \
    "https://huggingface.co/Comfy-Org/flux2-dev/resolve/main/split_files/vae/flux2-vae.safetensors" \
    "Flux 2 VAE"

# 4. XLabs IP-Adapter v2 (~1GB)
download "$MODELS_DIR/xlabs/ipadapters/flux-ip-adapter-v2.safetensors" \
    "https://huggingface.co/XLabs-AI/flux-ip-adapter-v2/resolve/main/ip_adapter.safetensors" \
    "XLabs IP-Adapter v2"

# 5. InsightFace AntelopeV2 (~300MB)
if [ ! -d "$MODELS_DIR/insightface/models/antelopev2" ]; then
    echo "[DL] InsightFace AntelopeV2 ..."
    mkdir -p "$MODELS_DIR/insightface/models"
    wget -q -O /tmp/antelopev2.zip \
        "https://huggingface.co/MonsterMMORPG/tools/resolve/main/antelopev2.zip"
    unzip -o /tmp/antelopev2.zip -d "$MODELS_DIR/insightface/models/"
    rm /tmp/antelopev2.zip
    echo "[OK] InsightFace AntelopeV2"
else
    echo "[SKIP] InsightFace AntelopeV2 (already exists)"
fi

# 6. Face Detection + SAM (~75MB)
download "$MODELS_DIR/ultralytics/bbox/face_yolov8m.pt" \
    "https://huggingface.co/Tenofas/ComfyUI/resolve/main/ultralytics/bbox/face_yolov8m.pt" \
    "YOLOv8m Face Detection"

download "$MODELS_DIR/sams/sam_vit_b_01ec64.pth" \
    "https://dl.fbaipublicfiles.com/segment_anything/sam_vit_b_01ec64.pth" \
    "SAM ViT-B"

# 7. 4x-UltraSharp Upscaler (~65MB)
download "$MODELS_DIR/upscale_models/4x-UltraSharp.pth" \
    "https://huggingface.co/lokCX/4x-Ultrasharp/resolve/main/4x-UltraSharp.pth" \
    "4x-UltraSharp Upscaler"

# 8. XLabs ControlNet OpenPose (~2.8GB)
download "$MODELS_DIR/xlabs/controlnets/flux-openpose-controlnet.safetensors" \
    "https://huggingface.co/raulc0399/flux_dev_openpose_controlnet/resolve/main/model.safetensors" \
    "XLabs ControlNet OpenPose"

# Mark download complete
touch "$MARKER"

echo "============================================"
echo " All models downloaded successfully!"
echo "============================================"
