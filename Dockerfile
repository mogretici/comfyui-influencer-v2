# ============================================================
# ComfyUI + Flux 2 Dev — AI Influencer Pipeline v4 (Optical Realism)
# Target: RunPod Serverless (L40S/A40 48GB)
# Image Size: ~5-8 GB (models on Network Volume)
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
    git wget curl ffmpeg unzip build-essential \
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
    Pillow \
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

# 5.5 ACE++ Character Consistency
RUN cd /comfyui/custom_nodes && \
    git clone --depth 1 https://github.com/linhoi/ComfyUI-ACE_Plus.git

# 5.6 GGUF-aware LoRA loader (fixes silent LoRA failure with GGUF quantized models)
RUN cd /comfyui/custom_nodes && \
    git clone --depth 1 https://github.com/Repeerc/ComfyUI-GGUF-LoRA-Load.git

# 5.7 Optical Realism — depth-aware grain, chromatic aberration, vignette, atmosphere
RUN cd /comfyui/custom_nodes && \
    git clone --depth 1 https://github.com/skatardude10/ComfyUI-Optical-Realism.git

# 5.8 Post-processing — FilmGrain, ColorCorrect, ChromaticAberration, Vignette
RUN cd /comfyui/custom_nodes && \
    git clone --depth 1 https://github.com/EllangoK/ComfyUI-post-processing-nodes.git

# Models are downloaded at runtime to Network Volume — not baked into image
# See src/download-models.sh for the model download logic

# Stage 6: Cleanup (before COPY to keep cache valid)
RUN apt-get purge -y build-essential python3.12-dev && \
    apt-get autoremove -y && apt-get clean && \
    rm -rf /var/lib/apt/lists/* /tmp/* /root/.cache/pip

# Stage 7: Handler + startup files + workflows
WORKDIR /
COPY src/start.sh src/handler.py src/extra_model_paths.yaml src/download-models.sh ./
COPY workflows/ /workflows/
RUN chmod +x /start.sh /download-models.sh

CMD ["/start.sh"]
