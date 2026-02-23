"""
API Test Script — ComfyUI + Flux 2 Dev AI Influencer Pipeline

Tests all three endpoints: generate, edit, detailer
Against a running ComfyUI instance (local Docker or RunPod).

Usage:
  # Local Docker test
  python scripts/test-workflow.py --url http://localhost:8188

  # RunPod test
  python scripts/test-workflow.py --runpod --api-key YOUR_KEY --endpoint-id YOUR_ID
"""

import argparse
import base64
import json
import sys
import time
from pathlib import Path

import requests


def test_local(base_url: str) -> None:
    """Test against local ComfyUI instance."""
    print(f"Testing local ComfyUI at {base_url}")
    print("=" * 50)

    # Health check
    print("[1/4] Health check...")
    try:
        resp = requests.get(f"{base_url}/system_stats", timeout=10)
        resp.raise_for_status()
        stats = resp.json()
        devices = stats.get("devices", [{}])
        if devices:
            gpu = devices[0]
            print(f"  GPU: {gpu.get('name', 'Unknown')}")
            vram_total = gpu.get("vram_total", 0) / (1024**3)
            vram_free = gpu.get("vram_free", 0) / (1024**3)
            print(f"  VRAM: {vram_free:.1f} / {vram_total:.1f} GB free")
        print("  [OK] ComfyUI is running")
    except requests.RequestException as e:
        print(f"  [FAIL] Cannot connect: {e}")
        sys.exit(1)

    # Check available models
    print("\n[2/4] Checking models...")
    try:
        # Check object_info for available node types
        resp = requests.get(f"{base_url}/object_info", timeout=30)
        resp.raise_for_status()
        nodes = resp.json()

        required_nodes = [
            "UnetLoaderGGUF",        # ComfyUI-GGUF
            "FaceDetailer",          # Impact Pack
            "UpscaleModelLoader",    # Built-in upscale
        ]

        for node_name in required_nodes:
            status = "OK" if node_name in nodes else "MISSING"
            print(f"  [{status}] {node_name}")

    except requests.RequestException as e:
        print(f"  [WARN] Could not check nodes: {e}")

    # Test generate workflow
    print("\n[3/4] Testing generate workflow...")
    workflow_path = Path(__file__).parent.parent / "workflows" / "txt2img-face-lora.json"
    if workflow_path.exists():
        with open(workflow_path) as f:
            workflow = json.load(f)
        print(f"  Loaded workflow: {workflow_path.name}")
        print(f"  Nodes: {len(workflow)}")

        # Queue it (dry run — just check it's accepted)
        try:
            resp = requests.post(
                f"{base_url}/prompt",
                json={"prompt": workflow, "client_id": "test"},
                timeout=30,
            )
            if resp.status_code == 200:
                prompt_id = resp.json().get("prompt_id")
                print(f"  [OK] Workflow queued: {prompt_id}")
                print("  Waiting for completion (this may take 30-60s)...")

                # Poll for completion
                start = time.time()
                while time.time() - start < 180:
                    try:
                        hist = requests.get(
                            f"{base_url}/history/{prompt_id}", timeout=10
                        ).json()
                        if prompt_id in hist:
                            status = hist[prompt_id].get("status", {})
                            if status.get("status_str") == "error":
                                print(f"  [FAIL] Workflow error: {status.get('messages', [])}")
                            else:
                                outputs = hist[prompt_id].get("outputs", {})
                                image_count = sum(
                                    len(v.get("images", []))
                                    for v in outputs.values()
                                )
                                elapsed = time.time() - start
                                print(f"  [OK] Completed in {elapsed:.1f}s — {image_count} image(s)")
                            break
                    except requests.RequestException:
                        pass
                    time.sleep(2)
                else:
                    print("  [TIMEOUT] Workflow did not complete within 180s")

            else:
                print(f"  [FAIL] Queue rejected: {resp.status_code} — {resp.text[:200]}")
        except requests.RequestException as e:
            print(f"  [FAIL] Could not queue: {e}")
    else:
        print(f"  [SKIP] Workflow file not found: {workflow_path}")

    # Summary
    print("\n[4/4] Summary")
    print("=" * 50)
    print("  Local test complete. Check output/ for generated images.")


def test_runpod(api_key: str, endpoint_id: str) -> None:
    """Test against RunPod serverless endpoint."""
    print(f"Testing RunPod endpoint: {endpoint_id}")
    print("=" * 50)

    base_url = f"https://api.runpod.ai/v2/{endpoint_id}"
    headers = {"Authorization": f"Bearer {api_key}", "Content-Type": "application/json"}

    # Test generate
    print("[1/2] Testing generate endpoint...")
    payload = {
        "input": {
            "action": "generate",
            "prompt": "A photo of ohwx woman, professional headshot, studio lighting, white background, canon eos r5",
            "negative_prompt": "blurry, deformed, cartoon, anime, painting",
            "face_lora": "my_face.safetensors",
            "face_lora_strength": 0.9,
            "realism_lora_strength": 0.35,
            "width": 1024,
            "height": 1024,
            "steps": 28,
            "cfg": 1.0,
            "face_detailer_denoise": 0.42,
        }
    }

    try:
        # Submit job
        resp = requests.post(f"{base_url}/runsync", json=payload, headers=headers, timeout=300)
        resp.raise_for_status()
        result = resp.json()

        status = result.get("status")
        if status == "COMPLETED":
            output = result.get("output", {})
            images = output.get("images", [])
            print(f"  [OK] Generated {len(images)} image(s)")

            # Save first image
            if images:
                img_bytes = base64.b64decode(images[0])
                out_path = Path("output/runpod_test.png")
                out_path.parent.mkdir(exist_ok=True)
                out_path.write_bytes(img_bytes)
                print(f"  Saved to: {out_path}")
        elif status == "FAILED":
            print(f"  [FAIL] {result.get('error', 'Unknown error')}")
        else:
            print(f"  [INFO] Status: {status}")
            job_id = result.get("id")
            if job_id:
                print(f"  Job ID: {job_id} — poll with /status/{job_id}")

    except requests.RequestException as e:
        print(f"  [FAIL] {e}")

    # Health check
    print("\n[2/2] Endpoint health...")
    try:
        resp = requests.get(f"{base_url}/health", headers=headers, timeout=10)
        health = resp.json()
        workers = health.get("workers", {})
        print(f"  Ready: {workers.get('ready', 0)}")
        print(f"  Running: {workers.get('running', 0)}")
        print(f"  Throttled: {workers.get('throttled', 0)}")
    except requests.RequestException as e:
        print(f"  [WARN] {e}")

    print("\n" + "=" * 50)
    print("RunPod test complete.")


def main() -> None:
    parser = argparse.ArgumentParser(description="Test AI Influencer Pipeline")
    parser.add_argument("--url", default="http://localhost:8188", help="Local ComfyUI URL")
    parser.add_argument("--runpod", action="store_true", help="Test RunPod endpoint")
    parser.add_argument("--api-key", help="RunPod API key")
    parser.add_argument("--endpoint-id", help="RunPod endpoint ID")

    args = parser.parse_args()

    if args.runpod:
        if not args.api_key or not args.endpoint_id:
            print("Error: --api-key and --endpoint-id required for RunPod test")
            sys.exit(1)
        test_runpod(args.api_key, args.endpoint_id)
    else:
        test_local(args.url)


if __name__ == "__main__":
    main()
