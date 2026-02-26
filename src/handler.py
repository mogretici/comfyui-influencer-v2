"""
RunPod Serverless Handler — ComfyUI + Flux 2 Dev AI Influencer Pipeline v4

Endpoints:
  - generate: Text-to-image with Face LoRA + IP-Adapter + FaceDetailer + Optical Realism
  - edit: Image-to-image scene/outfit change + Optical Realism
  - detailer: FaceDetailer + 4K upscale + Optical Realism

Flux 2 Architecture:
  - UNet: UnetLoaderGGUF (flux2-dev-Q5_K_M.gguf)
  - Text Encoder: CLIPLoader (Mistral 3 Small FP8, type: flux2)
  - VAE: VAELoader (flux2-vae.safetensors)
  - Sampling: SamplerCustomAdvanced + BasicGuider
  - LoRA: UnetGGUFLora (GGUF-aware LoRA loader)
  - Post-processing: DepthAnythingV2 → OpticalRealism → ColorCorrect
"""

import json
import time
import uuid
import base64
import urllib.request
import urllib.error
import urllib.parse
from io import BytesIO

import os
import runpod
from PIL import Image

COMFYUI_URL = "http://127.0.0.1:8188"
TIMEOUT_SECONDS = 600


def debug_log(msg):
    """Print debug log with timestamp."""
    print(f"[DEBUG {time.strftime('%H:%M:%S')}] {msg}", flush=True)


# ──────────────────────────────────────────────
# ComfyUI API helpers
# ──────────────────────────────────────────────

def queue_prompt(workflow: dict) -> str:
    """Queue a workflow and return the prompt_id."""
    client_id = str(uuid.uuid4())
    payload = json.dumps({"prompt": workflow, "client_id": client_id}).encode()
    req = urllib.request.Request(
        f"{COMFYUI_URL}/prompt",
        data=payload,
        headers={"Content-Type": "application/json"},
    )
    try:
        resp = urllib.request.urlopen(req, timeout=30)
    except urllib.error.HTTPError as e:
        body = e.read().decode("utf-8", errors="replace")
        debug_log(f"ComfyUI REJECTED workflow ({e.code}): {body[:500]}")
        raise RuntimeError(f"ComfyUI rejected workflow ({e.code}): {body}") from e
    result = json.loads(resp.read())
    debug_log(f"queue_prompt OK: prompt_id={result.get('prompt_id', '?')}")
    return result["prompt_id"]


def poll_completion(prompt_id: str) -> dict:
    """Poll until prompt completes or times out. Returns output info."""
    start = time.time()
    poll_count = 0
    while time.time() - start < TIMEOUT_SECONDS:
        poll_count += 1
        try:
            resp = urllib.request.urlopen(
                f"{COMFYUI_URL}/history/{prompt_id}", timeout=10
            )
            history = json.loads(resp.read())
            if prompt_id in history:
                elapsed = time.time() - start
                debug_log(f"Workflow completed in {elapsed:.1f}s ({poll_count} polls)")
                return history[prompt_id]
        except urllib.error.URLError:
            pass
        if poll_count % 10 == 0:
            elapsed = time.time() - start
            debug_log(f"Still waiting... {elapsed:.0f}s elapsed ({poll_count} polls)")
        time.sleep(1.5)
    debug_log(f"TIMEOUT after {TIMEOUT_SECONDS}s ({poll_count} polls)")
    raise TimeoutError(f"Workflow did not complete within {TIMEOUT_SECONDS}s")


def get_output_images(history: dict) -> list[str]:
    """Extract base64 images from workflow history output."""
    images = []
    outputs = history.get("outputs", {})
    debug_log(f"get_output_images: {len(outputs)} output nodes: {list(outputs.keys())}")
    for node_id, node_output in outputs.items():
        if "images" not in node_output:
            continue
        debug_log(f"  Node {node_id}: {len(node_output['images'])} images")
        for img_info in node_output["images"]:
            filename = img_info.get("filename", "")
            subfolder = img_info.get("subfolder", "")
            img_type = img_info.get("type", "output")

            params = urllib.parse.urlencode(
                {"filename": filename, "subfolder": subfolder, "type": img_type}
            )
            resp = urllib.request.urlopen(
                f"{COMFYUI_URL}/view?{params}", timeout=30
            )
            img_bytes = resp.read()
            # Convert PNG → JPEG for realistic compression artifacts
            img = Image.open(BytesIO(img_bytes))
            if img.mode == "RGBA":
                img = img.convert("RGB")
            jpeg_buf = BytesIO()
            img.save(jpeg_buf, format="JPEG", quality=93)
            images.append(base64.b64encode(jpeg_buf.getvalue()).decode("utf-8"))
    return images


def load_workflow(name: str) -> dict:
    """Load a workflow JSON file."""
    paths = [
        f"/workflows/{name}.json",
        f"/comfyui/workflows/{name}.json",
    ]
    for path in paths:
        try:
            with open(path) as f:
                wf = json.load(f)
                debug_log(f"Loaded workflow '{name}' from {path} ({len(wf)} nodes)")
                return wf
        except FileNotFoundError:
            debug_log(f"Workflow not found at {path}")
            continue
    raise FileNotFoundError(f"Workflow '{name}' not found in {paths}")


# ──────────────────────────────────────────────
# Post-processing: Optical Realism + Color Grading
# ──────────────────────────────────────────────

def inject_post_processing(wf: dict, image_source_node: str, save_node: str, params: dict):
    """Inject DepthAnythingV2 → OpticalRealism → ColorCorrect chain.

    Inserts between image_source_node and save_node.
    Returns the final output node ID (for further chaining if needed).
    """
    if not params.get("optical_realism", True):
        return image_source_node

    grain = params.get("grain_intensity", 0.015)
    temperature = params.get("color_temperature", 8.0)
    saturation = params.get("color_saturation", 0.92)

    # Depth estimation for physically-grounded effects
    wf["30"] = {
        "class_type": "DepthAnythingV2Preprocessor",
        "inputs": {
            "image": [image_source_node, 0],
            "ckpt_name": "depth_anything_v2_vitl.pth",
            "resolution": 1024,
        },
        "_meta": {"title": "Depth Map (OpticalRealism)"},
    }

    # OpticalRealism — physics-based camera simulation
    wf["31"] = {
        "class_type": "OpticalRealism",
        "inputs": {
            "image": [image_source_node, 0],
            "depth_map": ["30", 0],
            "atmosphere_enabled": True,
            "haze_strength": 0.15,
            "lift_blacks": 0.08,
            "depth_offset": 0.0,
            "light_wrap_strength": 0.20,
            "chromatic_aberration": 0.003,
            "vignette_intensity": 0.12,
            "grain_power": grain,
            "monochrome_grain": True,
            "highlight_rolloff": 0.05,
        },
        "_meta": {"title": "Optical Realism"},
    }

    # Color grading — warm shift + desaturation for natural look
    wf["32"] = {
        "class_type": "ColorCorrect",
        "inputs": {
            "image": ["31", 0],
            "temperature": temperature,
            "hue": 0.0,
            "brightness": 0.0,
            "contrast": 1.05,
            "saturation": saturation,
            "gamma": 1.0,
        },
        "_meta": {"title": "Color Grading"},
    }

    # Rewire SaveImage to use post-processed output
    if save_node in wf:
        for key, val in wf[save_node].get("inputs", {}).items():
            if isinstance(val, list) and len(val) == 2 and val[0] == image_source_node and val[1] == 0:
                wf[save_node]["inputs"][key] = ["32", 0]

    debug_log(f"Post-processing injected: grain={grain}, temp={temperature}, sat={saturation}")
    return "32"


# ──────────────────────────────────────────────
# Workflow builders — Flux 2 Architecture
# ──────────────────────────────────────────────

def build_generate_workflow(params: dict) -> dict:
    """Build txt2img workflow with Face LoRA + IP-Adapter + FaceDetailer.

    Flux 2 node structure:
      1  UnetLoaderGGUF → 2 CLIPLoader → 3 VAELoader
      4  CLIPTextEncode(positive) → 6 BasicGuider
      5  RandomNoise → 10 SamplerCustomAdvanced
      7  KSamplerSelect → 10
      8  BasicScheduler → 10
      9  EmptySD3LatentImage → 10
      10 SamplerCustomAdvanced → 11 VAEDecode → 15 FaceDetailer → 16 SaveImage

    Face LoRA (optional, GGUF-aware):
      1b UnetGGUFLora → model replaces node 1 output in guider/scheduler/facedetailer

    IP-Adapter (optional, requires reference_image):
      20 LoadImage (ref) → 22 ApplyFluxIPAdapter
      21 LoadFluxIPAdapter → 22
      22 ApplyFluxIPAdapter → replaces model source for downstream nodes
    """
    wf = load_workflow("txt2img-flux2")

    # Core prompt
    prompt = params.get("prompt",
        "Close-up portrait photograph of a 25-year-old woman with natural olive skin, "
        "subtle smile, hazel eyes. Shot on Canon EOS R5, 85mm f/1.4 lens, natural window light, "
        "shallow depth of field. Visible skin pores and subtle freckles. "
        "No makeup or minimal makeup, hair slightly messy. "
        "Warm golden hour tones, bokeh background."
    )

    # Model parameters
    face_lora = params.get("face_lora", "")
    face_lora_strength = params.get("face_lora_strength", 0.0)
    ip_adapter_strength = params.get("ip_adapter_strength", 0.5)
    skip_face_lora = not face_lora or face_lora_strength == 0.0

    # Check if LoRA file actually exists on disk
    if not skip_face_lora:
        lora_paths = [
            f"/runpod-volume/models/loras/{face_lora}",
            f"/comfyui/models/loras/{face_lora}",
        ]
        lora_exists = any(os.path.isfile(p) for p in lora_paths)
        if not lora_exists:
            debug_log(f"WARNING: LoRA file '{face_lora}' not found, skipping LoRA injection")
            skip_face_lora = True

    debug_log(f"build_generate: face_lora={face_lora!r}, strength={face_lora_strength}, skip={skip_face_lora}")
    debug_log(f"build_generate: ip_adapter={ip_adapter_strength}")

    # Generation parameters
    width = params.get("width", 1024)
    height = params.get("height", 1024)
    steps = params.get("steps", 28)
    seed = params.get("seed", -1)
    if seed == -1:
        seed = int(time.time() * 1000) % (2**32)

    # FaceDetailer parameters
    fd_denoise = params.get("face_detailer_denoise", 0.35)
    fd_feather = params.get("face_feather", 15)

    # ── Inject Face LoRA node if provided (GGUF-aware) ──
    if not skip_face_lora:
        wf["1b"] = {
            "class_type": "UnetGGUFLora",
            "inputs": {
                "unet_model": ["1", 0],
                "lora_name": face_lora,
                "strength_model": face_lora_strength,
            },
            "_meta": {"title": "Face LoRA (GGUF)"},
        }
        # Rewire: all nodes that reference model from "1" should now use "1b"
        for node_id, node in wf.items():
            if node_id == "1b":
                continue
            inputs = node.get("inputs", {})
            for key, val in inputs.items():
                if isinstance(val, list) and len(val) == 2 and val[0] == "1" and val[1] == 0:
                    inputs[key] = ["1b", 0]

    # ── Inject IP-Adapter nodes if reference image provided ──
    ref_filename = params.get("_ref_filename")
    if ref_filename and ip_adapter_strength > 0:
        # Determine model source: "1b" if LoRA active, "1" if not
        model_source = "1b" if not skip_face_lora else "1"

        # LoadImage for reference photo
        wf["20"] = {
            "class_type": "LoadImage",
            "inputs": {"image": ref_filename},
            "_meta": {"title": "Reference Image (IP-Adapter)"},
        }
        # LoadFluxIPAdapter (loads IP-Adapter weights + CLIP vision)
        wf["21"] = {
            "class_type": "LoadFluxIPAdapter",
            "inputs": {
                "ipadatper": "flux-ip-adapter-v2.safetensors",
                "clip_vision": "clip_vision_l.safetensors",
                "provider": "GPU",
            },
            "_meta": {"title": "Load IP-Adapter Flux"},
        }
        # ApplyFluxIPAdapter — inject into model chain
        wf["22"] = {
            "class_type": "ApplyFluxIPAdapter",
            "inputs": {
                "model": [model_source, 0],
                "ip_adapter_flux": ["21", 0],
                "image": ["20", 0],
                "ip_scale": ip_adapter_strength,
            },
            "_meta": {"title": "Apply IP-Adapter"},
        }
        # Rewire downstream nodes from model_source to "22"
        for node_id, node in wf.items():
            if node_id in ("1b", "20", "21", "22"):
                continue
            inputs = node.get("inputs", {})
            for key, val in inputs.items():
                if isinstance(val, list) and len(val) == 2 and val[0] == model_source and val[1] == 0:
                    inputs[key] = ["22", 0]
        debug_log(f"IP-Adapter injected: ref={ref_filename}, scale={ip_adapter_strength}, model_source={model_source}")

    # ── Apply parameters to workflow nodes ──
    for node_id, node in wf.items():
        class_type = node.get("class_type", "")

        # CLIPTextEncode — positive prompt
        if class_type == "CLIPTextEncode" and "positive" in node.get("_meta", {}).get("title", "").lower():
            node["inputs"]["text"] = prompt

        # RandomNoise — seed
        if class_type == "RandomNoise":
            node["inputs"]["noise_seed"] = seed

        # BasicScheduler — steps
        if class_type == "BasicScheduler":
            node["inputs"]["steps"] = steps

        # EmptySD3LatentImage — dimensions
        if class_type == "EmptySD3LatentImage":
            node["inputs"]["width"] = width
            node["inputs"]["height"] = height

        # IP-Adapter strength
        if "ipadapter" in class_type.lower() or "ip_adapter" in class_type.lower():
            if "strength" in node.get("inputs", {}):
                node["inputs"]["strength"] = ip_adapter_strength

        # FaceDetailer
        if class_type == "FaceDetailer":
            node["inputs"]["denoise"] = fd_denoise
            node["inputs"]["seed"] = seed
            if "feather" in node["inputs"]:
                node["inputs"]["feather"] = fd_feather

    # ── Post-processing: OpticalRealism + ColorCorrect ──
    inject_post_processing(wf, image_source_node="15", save_node="16", params=params)

    return wf


def build_edit_workflow(params: dict) -> dict:
    """Build img2img workflow for scene/outfit changes.

    Same Flux 2 node structure as generate, but:
      - LoadImage → VAEEncode replaces EmptySD3LatentImage
      - BasicScheduler denoise < 1.0 (default 0.6)
      - FaceDetailer included
    """
    wf = load_workflow("img2img-flux2")

    prompt = params.get("prompt", "")
    denoise = params.get("denoise", 0.6)
    steps = params.get("steps", 28)
    seed = params.get("seed", -1)
    if seed == -1:
        seed = int(time.time() * 1000) % (2**32)

    face_lora = params.get("face_lora", "")
    face_lora_strength = params.get("face_lora_strength", 0.0)
    skip_face_lora = not face_lora or face_lora_strength == 0.0

    # Check if LoRA file actually exists on disk
    if not skip_face_lora:
        lora_paths = [
            f"/runpod-volume/models/loras/{face_lora}",
            f"/comfyui/models/loras/{face_lora}",
        ]
        if not any(os.path.isfile(p) for p in lora_paths):
            debug_log(f"WARNING: LoRA file '{face_lora}' not found, skipping LoRA injection")
            skip_face_lora = True

    # Upload input image to ComfyUI
    input_image_b64 = params.get("input_image", "")
    input_filename = None
    if input_image_b64:
        input_filename = upload_reference_image(input_image_b64)

    if not input_filename:
        raise ValueError("input_image is required for edit action")

    # ── Inject Face LoRA node if provided (GGUF-aware) ──
    if not skip_face_lora:
        wf["1b"] = {
            "class_type": "UnetGGUFLora",
            "inputs": {
                "unet_model": ["1", 0],
                "lora_name": face_lora,
                "strength_model": face_lora_strength,
            },
            "_meta": {"title": "Face LoRA (GGUF)"},
        }
        for node_id, node in wf.items():
            if node_id == "1b":
                continue
            inputs = node.get("inputs", {})
            for key, val in inputs.items():
                if isinstance(val, list) and len(val) == 2 and val[0] == "1" and val[1] == 0:
                    inputs[key] = ["1b", 0]

    # ── Apply parameters to workflow nodes ──
    for node_id, node in wf.items():
        class_type = node.get("class_type", "")

        # CLIPTextEncode — positive prompt
        if class_type == "CLIPTextEncode" and "positive" in node.get("_meta", {}).get("title", "").lower():
            node["inputs"]["text"] = prompt

        # RandomNoise — seed
        if class_type == "RandomNoise":
            node["inputs"]["noise_seed"] = seed

        # BasicScheduler — steps + denoise
        if class_type == "BasicScheduler":
            node["inputs"]["steps"] = steps
            node["inputs"]["denoise"] = denoise

        # LoadImage — input image
        if class_type == "LoadImage":
            node["inputs"]["image"] = input_filename

        # FaceDetailer
        if class_type == "FaceDetailer":
            node["inputs"]["seed"] = seed

    # ── Post-processing: OpticalRealism + ColorCorrect ──
    # img2img: FaceDetailer is node "16", SaveImage is node "17"
    inject_post_processing(wf, image_source_node="16", save_node="17", params=params)

    return wf


def build_detailer_workflow(params: dict) -> dict:
    """Build FaceDetailer + upscale workflow.

    Node structure:
      1 UnetLoaderGGUF → 9 FaceDetailer
      4 LoadImage → 9 FaceDetailer → 11 ImageUpscaleWithModel → 12 ImageScaleBy → 13 SaveImage
    """
    wf = load_workflow("detailer-upscale-flux2")

    fd_denoise = params.get("face_detailer_denoise", 0.42)
    scale_by = params.get("scale_by", 0.5)
    seed = params.get("seed", -1)
    if seed == -1:
        seed = int(time.time() * 1000) % (2**32)

    # Upload input image to ComfyUI input dir
    input_image_b64 = params.get("input_image", "")
    input_filename = None
    if input_image_b64:
        input_filename = upload_reference_image(input_image_b64)

    if not input_filename:
        raise ValueError("input_image is required for detailer action")

    for node_id, node in wf.items():
        class_type = node.get("class_type", "")

        if class_type == "LoadImage":
            node["inputs"]["image"] = input_filename

        if class_type == "FaceDetailer":
            node["inputs"]["denoise"] = fd_denoise
            if "seed" in node["inputs"]:
                node["inputs"]["seed"] = seed

        if class_type == "ImageScaleBy":
            node["inputs"]["scale_by"] = scale_by

    # ── Post-processing: OpticalRealism + ColorCorrect ──
    # detailer-upscale: ImageScaleBy is node "12", SaveImage is node "13"
    inject_post_processing(wf, image_source_node="12", save_node="13", params=params)

    return wf


# ──────────────────────────────────────────────
# Image upload helper
# ──────────────────────────────────────────────

def upload_reference_image(image_b64: str) -> str:
    """Upload a base64 image to ComfyUI and return filename."""
    img_bytes = base64.b64decode(image_b64)
    filename = f"ref_{uuid.uuid4().hex[:8]}.png"

    boundary = uuid.uuid4().hex
    body = (
        f"--{boundary}\r\n"
        f'Content-Disposition: form-data; name="image"; filename="{filename}"\r\n'
        f"Content-Type: image/png\r\n\r\n"
    ).encode() + img_bytes + f"\r\n--{boundary}--\r\n".encode()

    req = urllib.request.Request(
        f"{COMFYUI_URL}/upload/image",
        data=body,
        headers={"Content-Type": f"multipart/form-data; boundary={boundary}"},
    )
    resp = urllib.request.urlopen(req, timeout=30)
    result = json.loads(resp.read())
    return result.get("name", filename)


# ──────────────────────────────────────────────
# Main handler
# ──────────────────────────────────────────────

def handler(event: dict) -> dict:
    """RunPod serverless handler entry point."""
    try:
        params = event.get("input", {})
        action = params.get("action", "generate")
        debug_log(f"=== REQUEST START === action={action}")
        debug_log(f"Params: prompt={params.get('prompt', '')[:80]}...")

        # Debug: check model directories
        for d in ["/runpod-volume/models/text_encoders",
                  "/runpod-volume/models/unet",
                  "/runpod-volume/models/vae",
                  "/runpod-volume/models/loras",
                  "/runpod-volume/models/sams",
                  "/runpod-volume/models/ultralytics/bbox",
                  "/runpod-volume/models/clip_vision",
                  "/runpod-volume/models/xlabs/ipadapters"]:
            if os.path.isdir(d):
                files = os.listdir(d)
                debug_log(f"DIR {d}: {files}")
            else:
                debug_log(f"DIR {d}: MISSING")

        # Debug: check extra_model_paths
        yaml_path = "/comfyui/extra_model_paths.yaml"
        if os.path.exists(yaml_path):
            with open(yaml_path) as f:
                debug_log(f"extra_model_paths.yaml:\n{f.read()}")

        # Debug: ask ComfyUI what models it sees
        for node_type in ["UnetLoaderGGUF", "CLIPLoader", "VAELoader"]:
            try:
                resp = urllib.request.urlopen(f"{COMFYUI_URL}/object_info/{node_type}", timeout=10)
                info = json.loads(resp.read())
                first_input = list(info.get(node_type, {}).get("input", {}).get("required", {}).values())
                debug_log(f"ComfyUI {node_type} available: {first_input[0] if first_input else 'N/A'}")
            except Exception as e:
                debug_log(f"Could not query {node_type}: {e}")

        # ── Auto-download LoRA from URL if provided ──
        lora_url = params.get("lora_url", "")
        if lora_url:
            # Extract filename from URL
            lora_name = params.get("lora_name", lora_url.rstrip("/").split("/")[-1])
            if not lora_name.endswith(".safetensors"):
                lora_name += ".safetensors"
            lora_dir = "/runpod-volume/models/loras"
            os.makedirs(lora_dir, exist_ok=True)
            dest = os.path.join(lora_dir, lora_name)

            if os.path.isfile(dest):
                debug_log(f"LoRA already on disk: {dest}")
            else:
                debug_log(f"Auto-downloading LoRA: {lora_url} -> {dest}")
                try:
                    req = urllib.request.Request(lora_url, headers={"User-Agent": "Mozilla/5.0"})
                    with urllib.request.urlopen(req, timeout=600) as resp, open(dest + ".tmp", "wb") as f:
                        while True:
                            chunk = resp.read(131072)
                            if not chunk:
                                break
                            f.write(chunk)
                    os.rename(dest + ".tmp", dest)
                    size_mb = os.path.getsize(dest) / (1024 * 1024)
                    debug_log(f"LoRA downloaded: {dest} ({size_mb:.1f} MB)")
                except Exception as e:
                    debug_log(f"LoRA auto-download failed: {e}")
                    if os.path.exists(dest + ".tmp"):
                        os.remove(dest + ".tmp")

            # Map lora_url params to face_lora params for workflow builder
            if not params.get("face_lora"):
                params["face_lora"] = lora_name
            if not params.get("face_lora_strength") and params.get("lora_strength"):
                params["face_lora_strength"] = params["lora_strength"]

        # Set default face_lora_strength if face_lora is set but strength is missing
        if params.get("face_lora") and not params.get("face_lora_strength"):
            params["face_lora_strength"] = 0.85

        # Upload reference image for IP-Adapter if provided
        ref_image_b64 = params.get("reference_image")
        ref_filename = None
        if ref_image_b64:
            ref_filename = upload_reference_image(ref_image_b64)
            params["_ref_filename"] = ref_filename
            debug_log(f"Uploaded reference image: {ref_filename}")

        # Utility action: download a LoRA file to the volume
        if action == "download_lora":
            return {"status": "ok", "path": os.path.join("/runpod-volume/models/loras", params.get("face_lora", "")), "message": "LoRA ready"}

        # Build workflow based on action
        if action == "generate":
            workflow = build_generate_workflow(params)
        elif action == "edit":
            workflow = build_edit_workflow(params)
        elif action == "detailer":
            workflow = build_detailer_workflow(params)
        else:
            return {"error": f"Unknown action: {action}"}

        # Debug: log key workflow nodes
        for node_id, node in workflow.items():
            ct = node.get("class_type", "")
            if any(k in ct.lower() for k in ["unet", "clip", "vae", "lora", "sam", "ultralytics", "guider", "scheduler", "sampler", "ipadapter", "ip_adapter"]):
                debug_log(f"Node {node_id} ({ct}): {json.dumps(node.get('inputs', {}))[:200]}")

        # Note: IP-Adapter reference image injection is now handled inside build_generate_workflow()
        # via params["_ref_filename"] — no need for post-hoc LoadImage search

        # Queue and wait
        debug_log("Queueing workflow...")
        prompt_id = queue_prompt(workflow)
        debug_log(f"Queued: prompt_id={prompt_id}")
        history = poll_completion(prompt_id)

        # Check for errors
        status = history.get("status", {})
        if status.get("status_str") == "error":
            messages = status.get("messages", [])
            debug_log(f"Workflow FAILED: {messages}")
            return {"error": "Workflow execution failed", "details": messages}

        # Extract output images
        images = get_output_images(history)
        debug_log(f"Output: {len(images)} images")

        if not images:
            debug_log("No output images!")
            return {"error": "No output images produced"}

        debug_log(f"=== REQUEST SUCCESS === {len(images)} images, seed={params.get('seed', -1)}")
        return {
            "images": images,
            "prompt_id": prompt_id,
            "seed": params.get("seed", -1),
        }

    except TimeoutError as e:
        debug_log(f"TIMEOUT: {e}")
        return {"error": str(e)}
    except FileNotFoundError as e:
        debug_log(f"FILE NOT FOUND: {e}")
        return {"error": str(e)}
    except Exception as e:
        debug_log(f"EXCEPTION: {type(e).__name__}: {e}")
        return {"error": f"Unexpected error: {type(e).__name__}: {str(e)}"}


# RunPod serverless entry
runpod.serverless.start({"handler": handler})
