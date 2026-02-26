#!/bin/bash
set -euo pipefail

# ============================================================
# Flux LoRA Training — RunPod GPU Pod
# GPU: A40 (48GB) or L40S (48GB)
# Template: RunPod PyTorch 2.4+ (CUDA 12.x)
# Time: ~45-60 min for 2200 steps
#
# Usage:
#   1. Create RunPod GPU pod (A40/L40S, PyTorch template, 100GB+ disk)
#   2. Upload traindata.zip to /workspace/
#   3. Run: bash /workspace/traindata/train_runpod.sh
# ============================================================

WORK="/workspace"
TRAIN_DIR="$WORK/traindata"
SD_SCRIPTS="$WORK/sd-scripts"
OUTPUT_DIR="$WORK/output"
MODEL_NAME="black-forest-labs/FLUX.2-dev"
HF_REPO="mogretici/mgnperson-flux2"
OUTPUT_LORA="mgnperson_flux2_lora_v2"

# ── CRITICAL: Redirect HF cache to workspace volume (root disk is too small) ──
export HF_HOME="$WORK/.cache/huggingface"
mkdir -p "$HF_HOME"

echo "============================================"
echo " Flux 2 Dev Face LoRA Training"
echo " rank=64, alpha=32, steps=2200"
echo " HF cache: $HF_HOME"
echo "============================================"

# ── Step 1: Install sd-scripts (kohya) ──
if [ ! -d "$SD_SCRIPTS" ]; then
    echo "[1/5] Installing sd-scripts (kohya)..."
    cd "$WORK"
    git clone --depth 1 https://github.com/kohya-ss/sd-scripts.git
    cd "$SD_SCRIPTS"
    pip install --upgrade pip
    pip install -r requirements.txt
    pip install accelerate bitsandbytes safetensors
    pip install huggingface_hub[cli]
    echo "[OK] sd-scripts installed"
else
    echo "[SKIP] sd-scripts already installed"
fi

# ── Verify flux_train_network.py exists ──
if [ ! -f "$SD_SCRIPTS/flux_train_network.py" ]; then
    echo "[ERROR] flux_train_network.py not found in sd-scripts"
    echo "  Listing available training scripts:"
    ls "$SD_SCRIPTS"/*train*.py 2>/dev/null || echo "  No training scripts found"
    exit 1
fi

# ── Step 2: Verify training data ──
echo "[2/5] Checking training data..."
if [ ! -d "$TRAIN_DIR" ]; then
    if [ -f "$WORK/traindata.zip" ]; then
        echo "  Extracting traindata.zip..."
        cd "$WORK"
        unzip -o traindata.zip -d "$WORK/"
    else
        echo "[ERROR] No training data found!"
        echo "  Upload traindata.zip to /workspace/ first"
        exit 1
    fi
fi

IMG_COUNT=$(ls "$TRAIN_DIR"/*.png 2>/dev/null | wc -l)
TXT_COUNT=$(ls "$TRAIN_DIR"/*.txt 2>/dev/null | grep -v "sample_prompts\|fal_request" | wc -l)
echo "  Images: $IMG_COUNT"
echo "  Captions: $TXT_COUNT"

if [ "$IMG_COUNT" -lt 5 ]; then
    echo "[ERROR] Need at least 5 training images"
    exit 1
fi

# ── Step 3: Login to HuggingFace (for gated model + upload) ──
echo "[3/5] HuggingFace auth..."
if [ -z "${HF_TOKEN:-}" ]; then
    echo "[WARN] HF_TOKEN not set. Set it for gated model access:"
    echo "  export HF_TOKEN=hf_xxxxx"
    echo "  Then re-run this script"
    echo ""
    echo "  Get token from: https://huggingface.co/settings/tokens"
    exit 1
fi
huggingface-cli login --token "$HF_TOKEN" 2>/dev/null || true
echo "[OK] HuggingFace authenticated"

# ── Check disk space ──
echo ""
echo "  Disk space:"
df -h "$WORK" | tail -1
echo "  HF cache: $HF_HOME"
echo ""

# ── Step 4: Train ──
echo "[4/5] Starting Flux LoRA training..."
echo "  Model: $MODEL_NAME"
echo "  Script: flux_train_network.py"
echo "  Rank: 64, Alpha: 32"
echo "  Steps: 2200 (~45-60 min on A40)"
echo "  Output: $OUTPUT_DIR/$OUTPUT_LORA"

mkdir -p "$OUTPUT_DIR" "$WORK/logs"

cd "$SD_SCRIPTS"

accelerate launch \
  --mixed_precision bf16 \
  --num_cpu_threads_per_process 4 \
  flux_train_network.py \
  --pretrained_model_name_or_path="$MODEL_NAME" \
  --dataset_config="$TRAIN_DIR/dataset_config.toml" \
  --output_dir="$OUTPUT_DIR" \
  --output_name="$OUTPUT_LORA" \
  --network_module=networks.lora_flux \
  --network_dim=64 \
  --network_alpha=32 \
  --learning_rate=1e-4 \
  --optimizer_type=AdamW8bit \
  --lr_scheduler=cosine_with_restarts \
  --lr_scheduler_num_cycles=3 \
  --max_train_steps=2200 \
  --resolution=1024 \
  --train_batch_size=2 \
  --mixed_precision=bf16 \
  --gradient_checkpointing \
  --save_every_n_steps=500 \
  --sample_every_n_steps=500 \
  --sample_prompts="$TRAIN_DIR/sample_prompts.txt" \
  --caption_extension=".txt" \
  --cache_latents \
  --cache_latents_to_disk \
  --enable_bucket \
  --bucket_reso_steps=64 \
  --min_bucket_reso=512 \
  --max_bucket_reso=1024 \
  --fp8_base \
  --logging_dir="$WORK/logs" \
  --log_with=tensorboard \
  --guidance_scale=1.0

echo "[OK] Training complete!"

# ── Step 5: Upload to HuggingFace ──
echo "[5/5] Uploading to HuggingFace..."
LORA_FILE="$OUTPUT_DIR/${OUTPUT_LORA}.safetensors"

if [ -f "$LORA_FILE" ]; then
    SIZE_MB=$(du -m "$LORA_FILE" | cut -f1)
    echo "  LoRA size: ${SIZE_MB} MB"

    huggingface-cli upload "$HF_REPO" "$LORA_FILE" "${OUTPUT_LORA}.safetensors" \
        --repo-type=model || echo "[WARN] Upload failed, file saved locally"

    echo "============================================"
    echo " Training Complete!"
    echo " Local:  $LORA_FILE"
    echo " HF:     https://huggingface.co/$HF_REPO"
    echo ""
    echo " To use in pipeline, update lora_url to:"
    echo " https://huggingface.co/$HF_REPO/resolve/main/${OUTPUT_LORA}.safetensors"
    echo "============================================"
else
    echo "[ERROR] LoRA file not found at $LORA_FILE"
    echo "  Check $OUTPUT_DIR/ for checkpoint files"
    ls -la "$OUTPUT_DIR/" 2>/dev/null
fi
