"""
RunPod Serverless Handler — ComfyUI + Flux 2 Dev AI Influencer Pipeline v3

Endpoints:
  - generate: Text-to-image with Face LoRA + IP-Adapter + FaceDetailer
  - edit: Image-to-image scene/outfit change
  - detailer: FaceDetailer + 4K upscale on existing image

Flux 2 Architecture:
  - UNet: UnetLoaderGGUF (flux2-dev-Q5_K_M.gguf)
  - Text Encoder: CLIPLoader (Mistral 3 Small FP8, type: flux2)
  - VAE: VAELoader (flux2-vae.safetensors)
  - Sampling: SamplerCustomAdvanced + BasicGuider (no negative prompt for main sampler)
  - LoRA: LoraLoaderModelOnly (model only, no clip)
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

COMFYUI_URL = "http://127.0.0.1:8188"
TIMEOUT_SECONDS = 240


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
            images.append(base64.b64encode(img_bytes).decode("utf-8"))
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

    Face LoRA (optional):
      1b LoraLoaderModelOnly → model replaces node 1 output in guider/scheduler/facedetailer
    """
    wf = load_workflow("txt2img-flux2")

    # Core prompt
    prompt = params.get("prompt", "A photo of ohwx woman, professional headshot")

    # Model parameters
    face_lora = params.get("face_lora", "")
    face_lora_strength = params.get("face_lora_strength", 0.0)
    ip_adapter_strength = params.get("ip_adapter_strength", 0.5)
    skip_face_lora = not face_lora or face_lora_strength == 0.0

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
    fd_denoise = params.get("face_detailer_denoise", 0.42)
    fd_feather = params.get("face_feather", 20)

    # ── Inject Face LoRA node if provided ──
    if not skip_face_lora:
        # Add LoraLoaderModelOnly node as "1b"
        wf["1b"] = {
            "class_type": "LoraLoaderModelOnly",
            "inputs": {
                "model": ["1", 0],
                "lora_name": face_lora,
                "strength_model": face_lora_strength,
            },
            "_meta": {"title": "Face LoRA (Model Only)"},
        }
        # Rewire: all nodes that reference model from "1" should now use "1b"
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

    # Upload input image to ComfyUI
    input_image_b64 = params.get("input_image", "")
    input_filename = None
    if input_image_b64:
        input_filename = upload_reference_image(input_image_b64)

    if not input_filename:
        raise ValueError("input_image is required for edit action")

    # ── Inject Face LoRA node if provided ──
    if not skip_face_lora:
        wf["1b"] = {
            "class_type": "LoraLoaderModelOnly",
            "inputs": {
                "model": ["1", 0],
                "lora_name": face_lora,
                "strength_model": face_lora_strength,
            },
            "_meta": {"title": "Face LoRA (Model Only)"},
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
                  "/runpod-volume/models/ultralytics/bbox"]:
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

        # Upload reference image for IP-Adapter if provided
        ref_image_b64 = params.get("reference_image")
        ref_filename = None
        if ref_image_b64:
            ref_filename = upload_reference_image(ref_image_b64)
            debug_log(f"Uploaded reference image: {ref_filename}")

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
            if any(k in ct.lower() for k in ["unet", "clip", "vae", "lora", "sam", "ultralytics", "guider", "scheduler", "sampler"]):
                debug_log(f"Node {node_id} ({ct}): {json.dumps(node.get('inputs', {}))[:200]}")

        # Inject reference image filename into IP-Adapter nodes
        if ref_filename:
            for node_id, node in workflow.items():
                class_type = node.get("class_type", "")
                if class_type == "LoadImage" and "reference" in node.get("_meta", {}).get("title", "").lower():
                    node["inputs"]["image"] = ref_filename

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
