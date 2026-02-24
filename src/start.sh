#!/bin/bash
set -euo pipefail

echo "============================================"
echo " ComfyUI + Flux 2 Dev — AI Influencer"
echo " Starting container..."
echo "============================================"

# Check Network Volume mount
if [ ! -d "/runpod-volume" ]; then
    echo "[ERROR] Network Volume not mounted at /runpod-volume"
    echo "[ERROR] Please attach a Network Volume to this endpoint"
    exit 1
fi

echo "[OK] Network Volume mounted at /runpod-volume"

# Download models if not already present
/download-models.sh

# Copy extra model paths config
if [ -f /extra_model_paths.yaml ]; then
    cp /extra_model_paths.yaml /comfyui/extra_model_paths.yaml
    echo "[OK] Extra model paths configured (Network Volume)"
fi

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
python -c "import torch; print(f'  VRAM: {torch.cuda.get_device_properties(0).total_mem / 1024**3:.1f} GB' if torch.cuda.is_available() else '  VRAM: N/A')"
echo "============================================"

# Always start RunPod handler
echo "[...] Starting RunPod serverless handler..."
python /handler.py
