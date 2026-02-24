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
# Workflow builders
# ──────────────────────────────────────────────

def build_generate_workflow(params: dict) -> dict:
    """Build txt2img workflow with Face LoRA + IP-Adapter + FaceDetailer."""
    wf = load_workflow("txt2img-face-lora")

    # Core prompt
    prompt = params.get("prompt", "A photo of ohwx woman, professional headshot")
    negative = params.get("negative_prompt", "blurry, deformed, cartoon, anime, painting, illustration, text, watermark")

    # Model parameters
    face_lora = params.get("face_lora", "")
    face_lora_strength = params.get("face_lora_strength", 0.0)
    realism_lora_strength = params.get("realism_lora_strength", 0.35)
    ip_adapter_strength = params.get("ip_adapter_strength", 0.5)
    skip_face_lora = not face_lora or face_lora_strength == 0.0

    debug_log(f"build_generate: face_lora={face_lora!r}, strength={face_lora_strength}, skip={skip_face_lora}")
    debug_log(f"build_generate: realism_strength={realism_lora_strength}, ip_adapter={ip_adapter_strength}")

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

    # If skipping face LoRA, remove that node and rewire connections
    # Face LoRA node takes model from UnetLoader and clip from CLIPLoader,
    # downstream nodes (Realism LoRA etc.) reference Face LoRA outputs.
    # We rewire them to point directly to UnetLoader/CLIPLoader.
    if skip_face_lora:
        face_lora_node_id = None
        face_lora_model_src = None
        face_lora_clip_src = None

        for node_id, node in wf.items():
            if node.get("class_type") == "LoraLoader" and "face" in node.get("_meta", {}).get("title", "").lower():
                face_lora_node_id = node_id
                face_lora_model_src = node["inputs"].get("model")  # e.g. ["1", 0]
                face_lora_clip_src = node["inputs"].get("clip")    # e.g. ["2", 0]
                break

        if face_lora_node_id:
            del wf[face_lora_node_id]
            # Rewire all nodes that referenced face LoRA outputs
            for node_id, node in wf.items():
                inputs = node.get("inputs", {})
                for key, val in inputs.items():
                    if isinstance(val, list) and len(val) == 2 and val[0] == face_lora_node_id:
                        if val[1] == 0 and face_lora_model_src:
                            inputs[key] = face_lora_model_src
                        elif val[1] == 1 and face_lora_clip_src:
                            inputs[key] = face_lora_clip_src

    # Apply parameters to workflow nodes
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

        # LoRA Loader — Face LoRA (only if not skipped)
        if not skip_face_lora and class_type == "LoraLoader" and "face" in node.get("_meta", {}).get("title", "").lower():
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

    face_lora = params.get("face_lora", "")
    face_lora_strength = params.get("face_lora_strength", 0.0)
    skip_face_lora = not face_lora or face_lora_strength == 0.0

    # Upload input image to ComfyUI (LoadImage reads from ComfyUI input dir, not /tmp/)
    input_image_b64 = params.get("input_image", "")
    input_filename = None
    if input_image_b64:
        input_filename = upload_reference_image(input_image_b64)

    if not input_filename:
        raise ValueError("input_image is required for edit action")

    # Skip face LoRA node if not provided
    if skip_face_lora:
        face_lora_node_id = None
        face_lora_model_src = None
        face_lora_clip_src = None
        for node_id, node in wf.items():
            if node.get("class_type") == "LoraLoader" and "face" in node.get("_meta", {}).get("title", "").lower():
                face_lora_node_id = node_id
                face_lora_model_src = node["inputs"].get("model")
                face_lora_clip_src = node["inputs"].get("clip")
                break
        if face_lora_node_id:
            del wf[face_lora_node_id]
            for node_id, node in wf.items():
                inputs = node.get("inputs", {})
                for key, val in inputs.items():
                    if isinstance(val, list) and len(val) == 2 and val[0] == face_lora_node_id:
                        if val[1] == 0 and face_lora_model_src:
                            inputs[key] = face_lora_model_src
                        elif val[1] == 1 and face_lora_clip_src:
                            inputs[key] = face_lora_clip_src

    for node_id, node in wf.items():
        class_type = node.get("class_type", "")

        if class_type == "CLIPTextEncode" and "positive" in node.get("_meta", {}).get("title", "").lower():
            node["inputs"]["text"] = prompt

        if class_type == "CLIPTextEncode" and "negative" in node.get("_meta", {}).get("title", "").lower():
            node["inputs"]["text"] = negative

        if class_type in ("KSampler", "KSamplerAdvanced"):
            node["inputs"]["seed"] = seed
            node["inputs"]["denoise"] = denoise

        if class_type == "LoadImage":
            node["inputs"]["image"] = input_filename

        if not skip_face_lora and class_type == "LoraLoader" and "face" in node.get("_meta", {}).get("title", "").lower():
            node["inputs"]["lora_name"] = face_lora
            node["inputs"]["strength_model"] = face_lora_strength
            node["inputs"]["strength_clip"] = face_lora_strength

    return wf


def build_detailer_workflow(params: dict) -> dict:
    """Build FaceDetailer + upscale workflow."""
    wf = load_workflow("face-detailer-upscale")

    fd_denoise = params.get("face_detailer_denoise", 0.42)
    # scale_by is applied AFTER 4x-UltraSharp: 0.5 = net 2x, 1.0 = net 4x
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
        debug_log(f"=== REQUEST START === action={action}")
        debug_log(f"Params: prompt={params.get('prompt', '')[:80]}...")

        # Debug: check model directories
        for d in ["/runpod-volume/models/ultralytics",
                  "/runpod-volume/models/ultralytics/bbox",
                  "/runpod-volume/models/unet",
                  "/runpod-volume/models/loras",
                  "/runpod-volume/models/sams"]:
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

        # Debug: ask ComfyUI what models it sees (object_info for UltralyticsDetectorProvider)
        try:
            resp = urllib.request.urlopen(f"{COMFYUI_URL}/object_info/UltralyticsDetectorProvider", timeout=10)
            info = json.loads(resp.read())
            model_list = info.get("UltralyticsDetectorProvider", {}).get("input", {}).get("required", {}).get("model_name", [])
            debug_log(f"ComfyUI UltralyticsDetectorProvider models: {model_list}")
        except Exception as e:
            debug_log(f"Could not query UltralyticsDetectorProvider: {e}")

        # Debug: check what unet models ComfyUI sees
        try:
            resp = urllib.request.urlopen(f"{COMFYUI_URL}/object_info/UnetLoaderGGUF", timeout=10)
            info = json.loads(resp.read())
            unet_list = info.get("UnetLoaderGGUF", {}).get("input", {}).get("required", {}).get("unet_name", [])
            debug_log(f"ComfyUI UnetLoaderGGUF models: {unet_list}")
        except Exception as e:
            debug_log(f"Could not query UnetLoaderGGUF: {e}")

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
            if any(k in ct.lower() for k in ["ultralytics", "unet", "lora", "clip", "vae", "sam"]):
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
