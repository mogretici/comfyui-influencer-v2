#!/bin/bash
set -euo pipefail

echo "============================================"
echo " ComfyUI + Flux 2 Dev — AI Influencer"
echo " Starting container..."
echo "============================================"

# Copy extra model paths config if exists
if [ -f /extra_model_paths.yaml ]; then
    cp /extra_model_paths.yaml /comfyui/extra_model_paths.yaml
    echo "[OK] Extra model paths configured"
fi

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
MAX_RETRIES=120
RETRY_COUNT=0

while [ $RETRY_COUNT -lt $MAX_RETRIES ]; do
    if curl -s http://127.0.0.1:8188/system_stats > /dev/null 2>&1; then
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

# Start RunPod handler (or keep ComfyUI running in local mode)
if [ "${RUNPOD_SERVERLESS:-0}" = "1" ] || [ -n "${RUNPOD_POD_ID:-}" ]; then
    echo "[...] Starting RunPod serverless handler..."
    python /handler.py
else
    echo "[OK] Running in local mode — ComfyUI UI at http://0.0.0.0:8188"
    echo "[OK] Press Ctrl+C to stop"
    wait $COMFYUI_PID
fi
