import type {
  WorkflowParams,
  RunPodResponse,
  RunPodHealthResponse,
} from "@/types";

class RunPodClient {
  private apiKey: string;
  private endpointId: string;

  constructor(apiKey: string, endpointId: string) {
    this.apiKey = apiKey;
    this.endpointId = endpointId;
  }

  private get baseUrl(): string {
    return `https://api.runpod.ai/v2/${this.endpointId}`;
  }

  private get headers(): Record<string, string> {
    return {
      Authorization: `Bearer ${this.apiKey}`,
      "Content-Type": "application/json",
    };
  }

  /**
   * Submit a synchronous job (waits for completion).
   * Timeout: 300s — suitable for single image generation.
   */
  async runSync(params: WorkflowParams): Promise<RunPodResponse> {
    const res = await fetch(`${this.baseUrl}/runsync`, {
      method: "POST",
      headers: this.headers,
      body: JSON.stringify({ input: params }),
    });

    if (!res.ok) {
      const text = await res.text();
      throw new Error(`RunPod API error ${res.status}: ${text}`);
    }

    return res.json();
  }

  /**
   * Submit an async job (returns immediately with job ID).
   * Poll with getStatus() to check completion.
   */
  async run(params: WorkflowParams): Promise<RunPodResponse> {
    const res = await fetch(`${this.baseUrl}/run`, {
      method: "POST",
      headers: this.headers,
      body: JSON.stringify({ input: params }),
    });

    if (!res.ok) {
      const text = await res.text();
      throw new Error(`RunPod API error ${res.status}: ${text}`);
    }

    return res.json();
  }

  /**
   * Check the status of an async job.
   */
  async getStatus(jobId: string): Promise<RunPodResponse> {
    const res = await fetch(`${this.baseUrl}/status/${jobId}`, {
      method: "GET",
      headers: this.headers,
    });

    if (!res.ok) {
      const text = await res.text();
      throw new Error(`RunPod API error ${res.status}: ${text}`);
    }

    return res.json();
  }

  /**
   * Cancel a running job.
   */
  async cancel(jobId: string): Promise<RunPodResponse> {
    const res = await fetch(`${this.baseUrl}/cancel/${jobId}`, {
      method: "POST",
      headers: this.headers,
    });

    if (!res.ok) {
      const text = await res.text();
      throw new Error(`RunPod API error ${res.status}: ${text}`);
    }

    return res.json();
  }

  /**
   * Get endpoint health status (workers, queue).
   */
  async health(): Promise<RunPodHealthResponse> {
    const res = await fetch(`${this.baseUrl}/health`, {
      method: "GET",
      headers: this.headers,
    });

    if (!res.ok) {
      const text = await res.text();
      throw new Error(`RunPod API error ${res.status}: ${text}`);
    }

    return res.json();
  }

  /**
   * Submit async job and poll until completion.
   * Calls onProgress callback during polling.
   */
  async runAndWait(
    params: WorkflowParams,
    onProgress?: (status: string) => void,
    pollInterval = 3000,
    maxWait = 600000
  ): Promise<RunPodResponse> {
    const startRes = await this.run(params);
    const jobId = startRes.id;

    if (!jobId) {
      throw new Error("No job ID returned from RunPod");
    }

    onProgress?.("Job queued...");

    const start = Date.now();

    while (Date.now() - start < maxWait) {
      await new Promise((r) => setTimeout(r, pollInterval));

      const status = await this.getStatus(jobId);

      switch (status.status) {
        case "COMPLETED":
          onProgress?.("Completed!");
          return status;
        case "FAILED":
          throw new Error(status.error || "Job failed");
        case "CANCELLED":
          throw new Error("Job was cancelled");
        case "IN_PROGRESS":
          onProgress?.("Generating...");
          break;
        case "IN_QUEUE":
          onProgress?.("Waiting for GPU worker...");
          break;
      }
    }

    // Timeout — try to cancel
    try {
      await this.cancel(jobId);
    } catch {
      // Ignore cancel errors
    }
    throw new Error("Job timed out after 10 minutes");
  }
}

// ─── Singleton factory ──────────────────────────────────

let clientInstance: RunPodClient | null = null;

export function getRunPodClient(
  apiKey: string,
  endpointId: string
): RunPodClient {
  if (
    !clientInstance ||
    clientInstance["apiKey"] !== apiKey ||
    clientInstance["endpointId"] !== endpointId
  ) {
    clientInstance = new RunPodClient(apiKey, endpointId);
  }
  return clientInstance;
}

// ─── Helper: file to base64 ────────────────────────────

export function fileToBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const result = reader.result as string;
      // Remove data:image/...;base64, prefix
      const base64 = result.split(",")[1];
      resolve(base64);
    };
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

// ─── Helper: base64 to blob URL ────────────────────────

export function base64ToUrl(base64: string): string {
  const byteChars = atob(base64);
  const byteNums = new Array(byteChars.length);
  for (let i = 0; i < byteChars.length; i++) {
    byteNums[i] = byteChars.charCodeAt(i);
  }
  const byteArray = new Uint8Array(byteNums);
  const blob = new Blob([byteArray], { type: "image/png" });
  return URL.createObjectURL(blob);
}

// ─── Helper: download base64 as file ───────────────────

export function downloadBase64Image(
  base64: string,
  filename = "influencer.png"
): void {
  const link = document.createElement("a");
  link.href = `data:image/png;base64,${base64}`;
  link.download = filename;
  link.click();
}
