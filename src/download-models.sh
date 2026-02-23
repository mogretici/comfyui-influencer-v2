#!/bin/bash
set -euo pipefail

# Download all models to Network Volume (one-time operation)
# Subsequent runs skip already-downloaded files

MODELS_DIR="/runpod-volume/models"
MARKER="$MODELS_DIR/.download_complete"

if [ -f "$MARKER" ]; then
    echo "[OK] Models already downloaded (marker found)"
    exit 0
fi

echo "============================================"
echo " Downloading models to Network Volume..."
echo " This is a one-time operation (~35GB)"
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
    wget -q --show-progress -O "${dest}.tmp" "$url"
    mv "${dest}.tmp" "$dest"
    echo "[OK] $name"
}

# 1. Flux 2 Dev GGUF Q5 (~23GB)
download "$MODELS_DIR/unet/flux2-dev-Q5_K_M.gguf" \
    "https://huggingface.co/city96/FLUX.2-dev-gguf/resolve/main/flux2-dev-Q5_K_M.gguf" \
    "Flux 2 Dev GGUF Q5"

# 2. Text Encoders (~5.5GB)
download "$MODELS_DIR/text_encoders/t5xxl_fp8.safetensors" \
    "https://huggingface.co/comfyanonymous/flux_text_encoders/resolve/main/t5xxl_fp8_e4m3fn_scaled.safetensors" \
    "T5-XXL FP8"

download "$MODELS_DIR/text_encoders/clip_l.safetensors" \
    "https://huggingface.co/comfyanonymous/flux_text_encoders/resolve/main/clip_l.safetensors" \
    "CLIP-L"

# 3. VAE (~500MB)
download "$MODELS_DIR/vae/flux-ae.safetensors" \
    "https://huggingface.co/ffxvs/vae-flux/resolve/main/ae.safetensors" \
    "Flux VAE"

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

download "$MODELS_DIR/sams/mobile_sam.pt" \
    "https://raw.githubusercontent.com/ChaoningZhang/MobileSAM/master/weights/mobile_sam.pt" \
    "MobileSAM"

# 7. 4x-UltraSharp Upscaler (~65MB)
download "$MODELS_DIR/upscale_models/4x-UltraSharp.pth" \
    "https://huggingface.co/lokCX/4x-Ultrasharp/resolve/main/4x-UltraSharp.pth" \
    "4x-UltraSharp Upscaler"

# 8. XLabs ControlNet OpenPose (~2.8GB)
download "$MODELS_DIR/xlabs/controlnets/flux-openpose-controlnet.safetensors" \
    "https://huggingface.co/raulc0399/flux_dev_openpose_controlnet/resolve/main/model.safetensors" \
    "XLabs ControlNet OpenPose"

# 9. Flux Realism LoRA (~300MB)
download "$MODELS_DIR/loras/flux_realism_lora.safetensors" \
    "https://huggingface.co/comfyanonymous/flux_RealismLora_converted_comfyui/resolve/main/flux_realism_lora.safetensors" \
    "Flux Realism LoRA"

# Mark download complete
touch "$MARKER"

echo "============================================"
echo " All models downloaded successfully!"
echo "============================================"
