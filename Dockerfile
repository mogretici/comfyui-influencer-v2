# ============================================================
# ComfyUI + Flux 2 Dev — AI Influencer Pipeline
# Target: RunPod Serverless (L40S 48GB)
# Image Size: ~37 GB (compressed ~33-35 GB)
# ============================================================

# Stage 1: Base
FROM nvidia/cuda:12.6.3-cudnn-runtime-ubuntu24.04 AS base

ENV DEBIAN_FRONTEND=noninteractive \
    PIP_PREFER_BINARY=1 \
    PYTHONUNBUFFERED=1 \
    CMAKE_BUILD_PARALLEL_LEVEL=8

# Stage 2: System dependencies
RUN apt-get update && apt-get install -y --no-install-recommends \
    python3.12 python3.12-venv python3.12-dev \
    git wget ffmpeg unzip build-essential \
    libgl1 libglib2.0-0 libsm6 libxext6 libxrender1 \
    && ln -sf /usr/bin/python3.12 /usr/bin/python \
    && apt-get clean && rm -rf /var/lib/apt/lists/*

# Stage 3: Python + ComfyUI via uv
RUN wget -qO- https://astral.sh/uv/install.sh | sh \
    && ln -s /root/.local/bin/uv /usr/local/bin/uv \
    && uv venv /opt/venv

ENV PATH=/opt/venv/bin:$PATH

RUN uv pip install comfy-cli pip setuptools wheel \
    && /usr/bin/yes | comfy --workspace /comfyui install --cuda-version 12.6 --nvidia

ENV TORCH_FORCE_WEIGHTS_ONLY_LOAD=0

# Stage 4: Python libraries
RUN pip install --no-cache-dir \
    cython numpy \
    insightface==0.7.3 \
    onnxruntime-gpu \
    timm facexlib ftfy \
    opencv-python-headless \
    runpod requests websocket-client

# Stage 5: Custom Nodes
# 5.1 GGUF — Flux 2 Dev GGUF loading (required)
RUN cd /comfyui/custom_nodes && \
    git clone --depth 1 https://github.com/city96/ComfyUI-GGUF.git && \
    cd ComfyUI-GGUF && pip install --no-cache-dir -r requirements.txt

# 5.2 XLabs — IP-Adapter v2 + ControlNet
RUN cd /comfyui/custom_nodes && \
    git clone --depth 1 https://github.com/XLabs-AI/x-flux-comfyui.git && \
    cd x-flux-comfyui && python setup.py

# 5.3 Impact Pack + Subpack (FaceDetailer)
RUN cd /comfyui/custom_nodes && \
    git clone --depth 1 --recursive https://github.com/ltdrdata/ComfyUI-Impact-Pack.git && \
    cd ComfyUI-Impact-Pack && \
    sed -i '/sam2/d' requirements.txt && \
    pip install --no-cache-dir -r requirements.txt && \
    pip install --no-cache-dir ultralytics

RUN cd /comfyui/custom_nodes && \
    git clone --depth 1 https://github.com/ltdrdata/ComfyUI-Impact-Subpack.git

# 5.4 ControlNet Aux Preprocessors (OpenPose etc.)
RUN cd /comfyui/custom_nodes && \
    git clone --depth 1 https://github.com/Fannovel16/comfyui_controlnet_aux.git && \
    cd comfyui_controlnet_aux && pip install --no-cache-dir -r requirements.txt

# Stage 6: Model Downloads
# 6.1 Flux 2 Dev GGUF Q5 (~23GB) — MAIN MODEL
RUN mkdir -p /comfyui/models/unet && \
    wget -q --show-progress -O /comfyui/models/unet/flux2-dev-Q5_K_M.gguf \
    "https://huggingface.co/city96/FLUX.2-dev-gguf/resolve/main/flux2-dev-Q5_K_M.gguf"

# 6.2 Text Encoders (~5.5GB)
RUN mkdir -p /comfyui/models/text_encoders && \
    wget -q -O /comfyui/models/text_encoders/t5xxl_fp8.safetensors \
    "https://huggingface.co/comfyanonymous/flux_text_encoders/resolve/main/t5xxl_fp8_e4m3fn_scaled.safetensors" && \
    wget -q -O /comfyui/models/text_encoders/clip_l.safetensors \
    "https://huggingface.co/comfyanonymous/flux_text_encoders/resolve/main/clip_l.safetensors"

# 6.3 VAE (public mirror — same ae.safetensors, not gated)
RUN mkdir -p /comfyui/models/vae && \
    wget -q -O /comfyui/models/vae/flux-ae.safetensors \
    "https://huggingface.co/ffxvs/vae-flux/resolve/main/ae.safetensors"

# 6.4 XLabs IP-Adapter v2 (~1GB) — face reference guidance
RUN mkdir -p /comfyui/models/xlabs/ipadapters && \
    wget -q -O /comfyui/models/xlabs/ipadapters/flux-ip-adapter-v2.safetensors \
    "https://huggingface.co/XLabs-AI/flux-ip-adapter-v2/resolve/main/ip_adapter.safetensors"

# 6.5 InsightFace AntelopeV2 (~300MB)
RUN mkdir -p /comfyui/models/insightface/models && \
    wget -q -O /tmp/antelopev2.zip \
    "https://huggingface.co/MonsterMMORPG/tools/resolve/main/antelopev2.zip" && \
    unzip -o /tmp/antelopev2.zip -d /comfyui/models/insightface/models/ && \
    rm /tmp/antelopev2.zip

# 6.6 Face Detection + SAM (~75MB)
RUN mkdir -p /comfyui/models/ultralytics/bbox /comfyui/models/sams && \
    wget -q -O /comfyui/models/ultralytics/bbox/face_yolov8m.pt \
    "https://huggingface.co/Tenofas/ComfyUI/resolve/main/ultralytics/bbox/face_yolov8m.pt" && \
    wget -q -O /comfyui/models/sams/mobile_sam.pt \
    "https://raw.githubusercontent.com/ChaoningZhang/MobileSAM/master/weights/mobile_sam.pt"

# 6.7 4x-UltraSharp Upscaler (~65MB)
RUN mkdir -p /comfyui/models/upscale_models && \
    wget -q -O /comfyui/models/upscale_models/4x-UltraSharp.pth \
    "https://huggingface.co/lokCX/4x-Ultrasharp/resolve/main/4x-UltraSharp.pth"

# 6.8 XLabs ControlNet OpenPose (~2.8GB) — trained for XLabs pipeline (raulc0399)
RUN mkdir -p /comfyui/models/xlabs/controlnets && \
    wget -q -O /comfyui/models/xlabs/controlnets/flux-openpose-controlnet.safetensors \
    "https://huggingface.co/raulc0399/flux_dev_openpose_controlnet/resolve/main/model.safetensors"

# 6.9 Flux Realism LoRA (~300MB)
RUN mkdir -p /comfyui/models/loras && \
    wget -q -O /comfyui/models/loras/flux_realism_lora.safetensors \
    "https://huggingface.co/comfyanonymous/flux_RealismLora_converted_comfyui/resolve/main/flux_realism_lora.safetensors"

# Stage 7: Cleanup (before COPY to keep cache valid)
RUN apt-get purge -y build-essential python3.12-dev && \
    apt-get autoremove -y && apt-get clean && \
    rm -rf /var/lib/apt/lists/* /tmp/* /root/.cache/pip

# Stage 8: Handler + startup files
WORKDIR /
COPY src/start.sh src/handler.py src/extra_model_paths.yaml ./
RUN chmod +x /start.sh

CMD ["/start.sh"]
