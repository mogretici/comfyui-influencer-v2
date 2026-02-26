#!/usr/bin/env python3
"""Patch ComfyUI-GGUF-LoRA-Load for ComfyUI v0.15+

ComfyUI v0.15 renamed folder_paths key from 'unet' to 'diffusion_models'.
This patch adds a safe fallback so the node works with both old and new versions.
"""
import sys

target = "/comfyui/custom_nodes/ComfyUI-GGUF-LoRA-Load/nodes.py"

with open(target, "r") as f:
    code = f.read()

old = 'folder_paths.folder_names_and_paths["unet"]'
new = 'folder_paths.folder_names_and_paths.get("diffusion_models", folder_paths.folder_names_and_paths.get("unet", [[], set()]))'

if old in code:
    code = code.replace(old, new)
    with open(target, "w") as f:
        f.write(code)
    print(f"[OK] Patched GGUF-LoRA-Load: unet -> diffusion_models fallback")
else:
    print(f"[SKIP] Pattern not found in {target}, may already be patched")
