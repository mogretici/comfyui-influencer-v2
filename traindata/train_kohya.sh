#!/bin/bash
set -euo pipefail

# kohya_ss — Flux 2 Dev Face LoRA Training
# Run on RunPod L40S/A40 (48GB VRAM)
#
# Prerequisites:
#   pip install kohya-ss-sd-scripts
#   pip install accelerate bitsandbytes
#
# Usage:
#   cd traindata && bash train_kohya.sh

echo "============================================"
echo " Flux 2 Dev Face LoRA Training (kohya_ss)"
echo " rank=64, alpha=32, steps=2200"
echo "============================================"

accelerate launch \
  --mixed_precision bf16 \
  --num_cpu_threads_per_process 4 \
  train_network.py \
  --pretrained_model_name_or_path="black-forest-labs/FLUX.2-dev" \
  --dataset_config="dataset_config.toml" \
  --output_dir="output/mgnperson_v2" \
  --output_name="mgnperson_flux2_v2" \
  --network_module=networks.lora \
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
  --sample_prompts="sample_prompts.txt" \
  --caption_extension=".txt" \
  --cache_latents \
  --cache_latents_to_disk \
  --enable_bucket \
  --bucket_reso_steps=64 \
  --min_bucket_reso=512 \
  --max_bucket_reso=1024 \
  --fp8_base \
  --logging_dir="logs" \
  --log_with=tensorboard

echo "============================================"
echo " Training complete!"
echo " Output: output/mgnperson_v2/"
echo "============================================"
