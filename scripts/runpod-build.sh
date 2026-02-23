#!/bin/bash
# ============================================================
# RunPod Pod Build Script
# Pod'da bu scripti calistir — Docker image build + push yapar
#
# Kullanim:
#   curl -sSL https://raw.githubusercontent.com/mogretici/comfyui-influencer-v2/main/scripts/runpod-build.sh | bash
#
# Veya:
#   git clone https://github.com/mogretici/comfyui-influencer-v2.git
#   cd comfyui-influencer-v2
#   bash scripts/runpod-build.sh
# ============================================================
set -euo pipefail

DOCKER_USER="mogretici"
IMAGE_NAME="comfyui-influencer-v2"
TAG="latest"

echo "============================================"
echo " ComfyUI Influencer v2 — Docker Build"
echo " Target: ${DOCKER_USER}/${IMAGE_NAME}:${TAG}"
echo "============================================"

# Step 1: Clone repo (if not already in it)
if [ ! -f "Dockerfile" ]; then
    echo "[1/5] Cloning repository..."
    git clone https://github.com/mogretici/comfyui-influencer-v2.git
    cd comfyui-influencer-v2
else
    echo "[1/5] Already in repo directory"
fi

# Step 2: Docker login
echo "[2/5] Docker Hub login..."
echo "Docker Hub token'ini gir:"
docker login -u "$DOCKER_USER"

# Step 3: Build
echo "[3/5] Building Docker image (bu 20-40 dakika surebilir)..."
echo "  - Model downloads: ~31 GB"
echo "  - Custom nodes: 5 adet"
echo ""
DOCKER_BUILDKIT=1 docker build \
    --progress=plain \
    -t "${DOCKER_USER}/${IMAGE_NAME}:${TAG}" \
    .

# Step 4: Push
echo "[4/5] Pushing to Docker Hub..."
docker push "${DOCKER_USER}/${IMAGE_NAME}:${TAG}"

# Step 5: Verify
echo "[5/5] Verifying..."
docker images "${DOCKER_USER}/${IMAGE_NAME}"

echo ""
echo "============================================"
echo " BUILD TAMAMLANDI!"
echo ""
echo " Image: ${DOCKER_USER}/${IMAGE_NAME}:${TAG}"
echo " Docker Hub: https://hub.docker.com/r/${DOCKER_USER}/${IMAGE_NAME}"
echo ""
echo " Simdi RunPod Serverless endpoint olustur:"
echo "   Image: ${DOCKER_USER}/${IMAGE_NAME}:${TAG}"
echo "   GPU: L40S 48GB"
echo "   Container Disk: 50GB"
echo "   Min Workers: 0"
echo "   Max Workers: 3"
echo "   Idle Timeout: 60s"
echo "============================================"
