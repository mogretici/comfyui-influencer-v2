"""
RunPod Serverless Handler — ComfyUI + Flux 2 Dev AI Influencer Pipeline

Endpoints:
  - generate: Text-to-image with Face LoRA + IP-Adapter + FaceDetailer
  - edit: Image-to-image scene/outfit change
  - detailer: FaceDetailer + 4K upscale on existing image

Usage:
  POST to RunPod serverless with:
  {
    "input": {
      "action": "generate",
      "prompt": "A photo of ohwx woman in a cafe...",
      "face_lora": "my_face.safetensors",
      "face_lora_strength": 0.9,
      ...
    }
  }
"""

import json
import time
import uuid
import base64
import urllib.request
import urllib.error
from io import BytesIO

import runpod

COMFYUI_URL = "http://127.0.0.1:8188"
TIMEOUT_SECONDS = 240


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
    resp = urllib.request.urlopen(req, timeout=30)
    result = json.loads(resp.read())
    return result["prompt_id"]


def poll_completion(prompt_id: str) -> dict:
    """Poll until prompt completes or times out. Returns output info."""
    start = time.time()
    while time.time() - start < TIMEOUT_SECONDS:
        try:
            resp = urllib.request.urlopen(
                f"{COMFYUI_URL}/history/{prompt_id}", timeout=10
            )
            history = json.loads(resp.read())
            if prompt_id in history:
                return history[prompt_id]
        except urllib.error.URLError:
            pass
        time.sleep(1.5)
    raise TimeoutError(f"Workflow did not complete within {TIMEOUT_SECONDS}s")


def get_output_images(history: dict) -> list[str]:
    """Extract base64 images from workflow history output."""
    images = []
    outputs = history.get("outputs", {})
    for node_id, node_output in outputs.items():
        if "images" not in node_output:
            continue
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
                return json.load(f)
        except FileNotFoundError:
            continue
    raise FileNotFoundError(f"Workflow '{name}' not found in {paths}")


# ──────────────────────────────────────────────
# Workflow builders
# ──────────────────────────────────────────────

def build_generate_workflow(params: dict) -> dict:
    """Build txt2img workflow with Face LoRA + IP-Adapter + FaceDetailer."""
    wf = load_workflow("txt2img-face-lora")

    # Core prompt
    prompt = params.get("prompt", "A photo of ohwx woman, professional headshot")
    negative = params.get("negative_prompt", "blurry, deformed, cartoon, anime, painting, illustration, text, watermark")

    # Model parameters
    face_lora = params.get("face_lora", "my_face.safetensors")
    face_lora_strength = params.get("face_lora_strength", 0.9)
    realism_lora_strength = params.get("realism_lora_strength", 0.35)
    ip_adapter_strength = params.get("ip_adapter_strength", 0.5)

    # Generation parameters
    width = params.get("width", 1024)
    height = params.get("height", 1024)
    steps = params.get("steps", 28)
    cfg = params.get("cfg", 1.0)
    seed = params.get("seed", -1)
    if seed == -1:
        seed = int(time.time() * 1000) % (2**32)

    # FaceDetailer parameters
    fd_denoise = params.get("face_detailer_denoise", 0.42)
    fd_margin = params.get("face_margin", 1.6)
    fd_feather = params.get("face_feather", 20)

    # Apply parameters to workflow nodes
    # Node mappings depend on workflow structure
    for node_id, node in wf.items():
        class_type = node.get("class_type", "")

        # CLIP Text Encode — positive prompt
        if class_type == "CLIPTextEncode" and "positive" in node.get("_meta", {}).get("title", "").lower():
            node["inputs"]["text"] = prompt

        # CLIP Text Encode — negative prompt
        if class_type == "CLIPTextEncode" and "negative" in node.get("_meta", {}).get("title", "").lower():
            node["inputs"]["text"] = negative

        # KSampler
        if class_type in ("KSampler", "KSamplerAdvanced"):
            node["inputs"]["seed"] = seed
            node["inputs"]["steps"] = steps
            if "cfg" in node["inputs"]:
                node["inputs"]["cfg"] = cfg

        # Empty Latent Image
        if class_type == "EmptyLatentImage":
            node["inputs"]["width"] = width
            node["inputs"]["height"] = height

        # LoRA Loader — Face LoRA
        if class_type == "LoraLoader" and "face" in node.get("_meta", {}).get("title", "").lower():
            node["inputs"]["lora_name"] = face_lora
            node["inputs"]["strength_model"] = face_lora_strength
            node["inputs"]["strength_clip"] = face_lora_strength

        # LoRA Loader — Realism LoRA
        if class_type == "LoraLoader" and "realism" in node.get("_meta", {}).get("title", "").lower():
            node["inputs"]["strength_model"] = realism_lora_strength
            node["inputs"]["strength_clip"] = realism_lora_strength

        # IP-Adapter
        if "ipadapter" in class_type.lower() or "ip_adapter" in class_type.lower():
            if "strength" in node.get("inputs", {}):
                node["inputs"]["strength"] = ip_adapter_strength

        # FaceDetailer
        if class_type == "FaceDetailer":
            node["inputs"]["denoise"] = fd_denoise
            if "guide_size" in node["inputs"]:
                node["inputs"]["guide_size"] = 512
            if "feather" in node["inputs"]:
                node["inputs"]["feather"] = fd_feather

    return wf


def build_edit_workflow(params: dict) -> dict:
    """Build img2img workflow for scene/outfit changes."""
    wf = load_workflow("img2img-edit")

    prompt = params.get("prompt", "")
    negative = params.get("negative_prompt", "blurry, deformed, cartoon, anime")
    denoise = params.get("denoise", 0.6)
    seed = params.get("seed", -1)
    if seed == -1:
        seed = int(time.time() * 1000) % (2**32)

    face_lora = params.get("face_lora", "my_face.safetensors")
    face_lora_strength = params.get("face_lora_strength", 0.9)

    # If input image is base64, save it temporarily
    input_image_b64 = params.get("input_image", "")
    if input_image_b64:
        img_bytes = base64.b64decode(input_image_b64)
        input_path = f"/tmp/input_{uuid.uuid4().hex[:8]}.png"
        with open(input_path, "wb") as f:
            f.write(img_bytes)

    for node_id, node in wf.items():
        class_type = node.get("class_type", "")

        if class_type == "CLIPTextEncode" and "positive" in node.get("_meta", {}).get("title", "").lower():
            node["inputs"]["text"] = prompt

        if class_type == "CLIPTextEncode" and "negative" in node.get("_meta", {}).get("title", "").lower():
            node["inputs"]["text"] = negative

        if class_type in ("KSampler", "KSamplerAdvanced"):
            node["inputs"]["seed"] = seed
            node["inputs"]["denoise"] = denoise

        if class_type == "LoadImage" and input_image_b64:
            node["inputs"]["image"] = input_path

        if class_type == "LoraLoader" and "face" in node.get("_meta", {}).get("title", "").lower():
            node["inputs"]["lora_name"] = face_lora
            node["inputs"]["strength_model"] = face_lora_strength
            node["inputs"]["strength_clip"] = face_lora_strength

    return wf


def build_detailer_workflow(params: dict) -> dict:
    """Build FaceDetailer + upscale workflow."""
    wf = load_workflow("face-detailer-upscale")

    fd_denoise = params.get("face_detailer_denoise", 0.42)
    upscale_factor = params.get("upscale_factor", 4)
    seed = params.get("seed", -1)
    if seed == -1:
        seed = int(time.time() * 1000) % (2**32)

    input_image_b64 = params.get("input_image", "")
    if input_image_b64:
        img_bytes = base64.b64decode(input_image_b64)
        input_path = f"/tmp/input_{uuid.uuid4().hex[:8]}.png"
        with open(input_path, "wb") as f:
            f.write(img_bytes)

    for node_id, node in wf.items():
        class_type = node.get("class_type", "")

        if class_type == "LoadImage" and input_image_b64:
            node["inputs"]["image"] = input_path

        if class_type == "FaceDetailer":
            node["inputs"]["denoise"] = fd_denoise
            if "seed" in node["inputs"]:
                node["inputs"]["seed"] = seed

        if class_type == "ImageUpscaleWithModel":
            pass  # Upscaler model is baked in

        if class_type == "ImageScaleBy":
            node["inputs"]["scale_by"] = upscale_factor

    return wf


# ──────────────────────────────────────────────
# IP-Adapter reference image upload
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

        # Upload reference image for IP-Adapter if provided
        ref_image_b64 = params.get("reference_image")
        ref_filename = None
        if ref_image_b64:
            ref_filename = upload_reference_image(ref_image_b64)

        # Build workflow based on action
        if action == "generate":
            workflow = build_generate_workflow(params)
        elif action == "edit":
            workflow = build_edit_workflow(params)
        elif action == "detailer":
            workflow = build_detailer_workflow(params)
        else:
            return {"error": f"Unknown action: {action}"}

        # Inject reference image filename into IP-Adapter nodes
        if ref_filename:
            for node_id, node in workflow.items():
                class_type = node.get("class_type", "")
                if class_type == "LoadImage" and "reference" in node.get("_meta", {}).get("title", "").lower():
                    node["inputs"]["image"] = ref_filename

        # Queue and wait
        prompt_id = queue_prompt(workflow)
        history = poll_completion(prompt_id)

        # Check for errors
        status = history.get("status", {})
        if status.get("status_str") == "error":
            messages = status.get("messages", [])
            return {"error": "Workflow execution failed", "details": messages}

        # Extract output images
        images = get_output_images(history)

        if not images:
            return {"error": "No output images produced"}

        return {
            "images": images,
            "prompt_id": prompt_id,
            "seed": params.get("seed", -1),
        }

    except TimeoutError as e:
        return {"error": str(e)}
    except FileNotFoundError as e:
        return {"error": str(e)}
    except Exception as e:
        return {"error": f"Unexpected error: {type(e).__name__}: {str(e)}"}


# RunPod serverless entry
runpod.serverless.start({"handler": handler})
