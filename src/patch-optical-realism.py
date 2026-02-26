#!/usr/bin/env python3
"""Patch ComfyUI-Optical-Realism for batched depth maps.

The node assumes depth_map[..., 0] produces a 2D (H, W) tensor,
but ComfyUI IMAGEs are (B, H, W, C), so [..  , 0] gives 3D (B, H, W).
Two unsqueeze(0) then creates 5D which F.interpolate can't handle.

Fix: use unsqueeze(1) for 3D tensors (adds channel dim, not extra batch).
"""
import sys

target = "/comfyui/custom_nodes/ComfyUI-Optical-Realism/optical_realism.py"

with open(target, "r") as f:
    code = f.read()

patched = False

# Fix the unsqueeze pattern: (B,H,W) → unsqueeze(0).unsqueeze(0) → 5D WRONG
# Should be: (B,H,W) → unsqueeze(1) → (B,1,H,W) → 4D CORRECT
old_unsqueeze = "depth = depth.unsqueeze(0).unsqueeze(0)"
new_unsqueeze = (
    "depth = depth.unsqueeze(1) if depth.dim() == 3 "
    "else depth.unsqueeze(0).unsqueeze(0)"
)

if old_unsqueeze in code:
    code = code.replace(old_unsqueeze, new_unsqueeze)
    patched = True
    print(f"[OK] Patched unsqueeze: dim-aware for batched depth maps")

# Fix the squeeze pattern to match
old_squeeze = "depth = depth.squeeze(0).squeeze(0)"
new_squeeze = "depth = depth.squeeze(1) if depth.dim() == 4 else depth.squeeze(0).squeeze(0)"

if old_squeeze in code:
    code = code.replace(old_squeeze, new_squeeze)
    patched = True
    print(f"[OK] Patched squeeze: dim-aware for batched depth maps")

if patched:
    with open(target, "w") as f:
        f.write(code)
    print(f"[OK] OpticalRealism patched for ComfyUI batched tensors")
else:
    print(f"[SKIP] Patterns not found in {target}, may already be patched")
