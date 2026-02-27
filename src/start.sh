#!/bin/bash
set -euo pipefail

echo "============================================"
echo " ComfyUI + Flux 1 Dev — AI Influencer v5"
echo " Starting container..."
echo "============================================"

# Check Network Volume mount
if [ ! -d "/runpod-volume" ]; then
    echo "[ERROR] Network Volume not mounted at /runpod-volume"
    echo "[ERROR] Please attach a Network Volume to this endpoint"
    exit 1
fi

echo "[OK] Network Volume mounted at /runpod-volume"

# ── Clean up old models (disk savings ~35GB) ──
echo "[CLEANUP] Removing old/legacy models if present..."
rm -f /runpod-volume/models/unet/flux2-dev-Q5_K_M.gguf
rm -f /runpod-volume/models/text_encoders/mistral_3_small_flux2_fp8.safetensors
rm -f /runpod-volume/models/vae/flux2-vae.safetensors
# Also remove legacy Flux 1 files with wrong names
rm -f /runpod-volume/models/text_encoders/t5xxl_fp8.safetensors
rm -f /runpod-volume/models/vae/flux-ae.safetensors
rm -f /runpod-volume/models/loras/flux_realism_lora.safetensors
rm -f /runpod-volume/models/sams/mobile_sam.pt
# Remove old markers so new models get downloaded (FP8 migration)
rm -f /runpod-volume/models/.download_complete_v1
rm -f /runpod-volume/models/.download_complete_v2
rm -f /runpod-volume/models/.download_complete_v3
rm -f /runpod-volume/models/.download_complete_v4
rm -f /runpod-volume/models/.download_complete_v5
rm -f /runpod-volume/models/.download_complete_v6
rm -f /runpod-volume/models/.download_complete_v7
rm -f /runpod-volume/models/.download_complete_v8
echo "[OK] Old model cleanup done"

# ── Hot-update: use code from network volume if present ──
if [ -f "/runpod-volume/code/handler.py" ]; then
    cp /runpod-volume/code/handler.py /handler.py
    echo "[HOT] Using handler.py from network volume"
fi
if [ -d "/runpod-volume/code/workflows" ]; then
    cp -r /runpod-volume/code/workflows/* /workflows/
    echo "[HOT] Using workflows from network volume"
fi

# Download models if not already present
/download-models.sh || echo "[WARN] download-models.sh exited with code $?, continuing startup"

# Copy extra model paths config
if [ -f /extra_model_paths.yaml ]; then
    cp /extra_model_paths.yaml /comfyui/extra_model_paths.yaml
    echo "[OK] Extra model paths configured (Network Volume)"
fi

# Set controlnet_aux ckpts path to network volume (persistent across cold starts)
export AUX_ANNOTATOR_CKPTS_PATH=/runpod-volume/models/controlnet_aux_ckpts
echo "[OK] controlnet_aux ckpts path: $AUX_ANNOTATOR_CKPTS_PATH"

# Disable ComfyUI-Manager network calls (saves ~2min startup)
export COMFYUI_MANAGER_MODE=local
mkdir -p /comfyui/user/__manager
cat > /comfyui/user/__manager/config.ini << 'CONF'
[default]
network_mode = local
CONF
echo "[OK] ComfyUI-Manager set to local mode"

# Start ComfyUI in background
echo "[...] Starting ComfyUI server..."
cd /comfyui && python main.py \
    --listen 0.0.0.0 \
    --port 8188 \
    --highvram \
    --disable-auto-launch \
    --disable-metadata \
    &

COMFYUI_PID=$!

# Wait for ComfyUI to be ready
echo "[...] Waiting for ComfyUI to initialize..."
MAX_RETRIES=300
RETRY_COUNT=0

while [ $RETRY_COUNT -lt $MAX_RETRIES ]; do
    if curl -s --max-time 5 http://127.0.0.1:8188/system_stats > /dev/null 2>&1; then
        echo "[OK] ComfyUI is ready!"
        break
    fi
    RETRY_COUNT=$((RETRY_COUNT + 1))
    sleep 2
done

if [ $RETRY_COUNT -eq $MAX_RETRIES ]; then
    echo "[ERROR] ComfyUI failed to start within timeout"
    exit 1
fi

# Print system info
echo "============================================"
echo " System Info:"
python -c "import torch; print(f'  PyTorch: {torch.__version__}')"
python -c "import torch; print(f'  CUDA: {torch.version.cuda}')"
python -c "import torch; print(f'  GPU: {torch.cuda.get_device_name(0) if torch.cuda.is_available() else \"N/A\"}')"
python -c "import torch; print(f'  VRAM: {torch.cuda.get_device_properties(0).total_memory / 1024**3:.1f} GB' if torch.cuda.is_available() else '  VRAM: N/A')"
echo "============================================"

# Always start RunPod handler
echo "[...] Starting RunPod serverless handler..."
python /handler.py
