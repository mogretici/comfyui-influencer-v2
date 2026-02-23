#!/bin/bash
# ============================================================
# Model Download Helper
# Downloads all models to local directory for development/testing
# Models are baked into Docker image during build,
# but this script is useful for local ComfyUI development.
# ============================================================
set -euo pipefail

MODEL_DIR="${1:-./models}"

echo "Downloading models to: $MODEL_DIR"
echo "============================================"

# Flux 2 Dev GGUF Q5
echo "[1/9] Flux 2 Dev GGUF Q5 (~23GB)..."
mkdir -p "$MODEL_DIR/unet"
wget -c -O "$MODEL_DIR/unet/flux2-dev-Q5_K_M.gguf" \
    "https://huggingface.co/city96/FLUX.2-dev-gguf/resolve/main/flux2-dev-Q5_K_M.gguf"

# T5-XXL FP8
echo "[2/9] T5-XXL FP8 (~5GB)..."
mkdir -p "$MODEL_DIR/text_encoders"
wget -c -O "$MODEL_DIR/text_encoders/t5xxl_fp8.safetensors" \
    "https://huggingface.co/comfyanonymous/flux_text_encoders/resolve/main/t5xxl_fp8_e4m3fn_scaled.safetensors"

# CLIP-L
echo "[3/9] CLIP-L (~0.5GB)..."
wget -c -O "$MODEL_DIR/text_encoders/clip_l.safetensors" \
    "https://huggingface.co/comfyanonymous/flux_text_encoders/resolve/main/clip_l.safetensors"

# VAE
echo "[4/9] Flux VAE..."
mkdir -p "$MODEL_DIR/vae"
wget -c -O "$MODEL_DIR/vae/flux-ae.safetensors" \
    "https://huggingface.co/black-forest-labs/FLUX.1-dev/resolve/main/ae.safetensors"

# IP-Adapter v2
echo "[5/9] XLabs IP-Adapter v2 (~1GB)..."
mkdir -p "$MODEL_DIR/xlabs/ipadapters"
wget -c -O "$MODEL_DIR/xlabs/ipadapters/flux-ip-adapter-v2.safetensors" \
    "https://huggingface.co/XLabs-AI/flux-ip-adapter-v2/resolve/main/ip_adapter.safetensors"

# InsightFace AntelopeV2
echo "[6/9] InsightFace AntelopeV2 (~300MB)..."
mkdir -p "$MODEL_DIR/insightface/models"
wget -c -O /tmp/antelopev2.zip \
    "https://huggingface.co/MonsterMMORPG/tools/resolve/main/antelopev2.zip"
unzip -o /tmp/antelopev2.zip -d "$MODEL_DIR/insightface/models/"
rm /tmp/antelopev2.zip

# Face Detection + SAM
echo "[7/9] Face YOLOv8m + MobileSAM (~75MB)..."
mkdir -p "$MODEL_DIR/ultralytics/bbox" "$MODEL_DIR/sams"
wget -c -O "$MODEL_DIR/ultralytics/bbox/face_yolov8m.pt" \
    "https://huggingface.co/Tenofas/ComfyUI/resolve/main/ultralytics/bbox/face_yolov8m.pt"
wget -c -O "$MODEL_DIR/sams/mobile_sam.pt" \
    "https://raw.githubusercontent.com/ChaoningZhang/MobileSAM/master/weights/mobile_sam.pt"

# Upscaler
echo "[8/9] 4x-UltraSharp (~65MB)..."
mkdir -p "$MODEL_DIR/upscale_models"
wget -c -O "$MODEL_DIR/upscale_models/4x-UltraSharp.pth" \
    "https://huggingface.co/lokCX/4x-Ultrasharp/resolve/main/4x-UltraSharp.pth"

# ControlNet OpenPose + Realism LoRA
echo "[9/9] ControlNet OpenPose + Realism LoRA (~1GB)..."
mkdir -p "$MODEL_DIR/xlabs/controlnets" "$MODEL_DIR/loras"
wget -c -O "$MODEL_DIR/xlabs/controlnets/flux-openpose-controlnet.safetensors" \
    "https://huggingface.co/XLabs-AI/flux-controlnet-collections/resolve/main/flux-openpose-controlnet.safetensors"
wget -c -O "$MODEL_DIR/loras/flux_realism_lora.safetensors" \
    "https://huggingface.co/comfyanonymous/flux_RealismLora_converted_comfyui/resolve/main/flux_realism_lora.safetensors"

echo "============================================"
echo "All models downloaded successfully!"
echo "Total disk usage:"
du -sh "$MODEL_DIR"
echo "============================================"
