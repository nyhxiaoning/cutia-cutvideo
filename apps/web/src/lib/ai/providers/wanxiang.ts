import type {
	AIImageProvider,
	ImageGenerationRequest,
	ImageGenerationResult,
	AIVideoProvider,
	VideoGenerationRequest,
	VideoTaskResult,
	VideoTaskStatus,
} from "./types";

const API_BASE = "https://dashscope.aliyuncs.com/compatible-mode/v1";
const POLL_INTERVAL_MS = 5000;
const MAX_POLL_ATTEMPTS = 360;

// ---------------------------------------------------------------------------
// Image Provider (通义万相 文生图/图生图)
// ---------------------------------------------------------------------------

const IMAGE_ENDPOINT = `${API_BASE}/images/generations`;
const IMAGE_MODEL = "wanx2.1-t2i-turbo";

function buildPrompt({
	prompt,
	aspectRatio,
}: {
	prompt: string;
	aspectRatio?: string;
}): string {
	if (!aspectRatio) {
		return prompt;
	}
	return `${prompt}\n\naspect_ratio="${aspectRatio}"`;
}

async function fetchDirect({
	payload,
	apiKey,
}: {
	payload: Record<string, unknown>;
	apiKey: string;
}): Promise<Response> {
	return fetch(IMAGE_ENDPOINT, {
		method: "POST",
		headers: {
			"Content-Type": "application/json",
			Authorization: `Bearer ${apiKey}`,
		},
		body: JSON.stringify(payload),
	});
}

async function fetchViaProxy({
	payload,
	apiKey,
}: {
	payload: Record<string, unknown>;
	apiKey: string;
}): Promise<Response> {
	return fetch("/api/ai/image/generate", {
		method: "POST",
		headers: { "Content-Type": "application/json" },
		body: JSON.stringify({
			url: IMAGE_ENDPOINT,
			headers: { Authorization: `Bearer ${apiKey}` },
			body: payload,
		}),
	});
}

export const wanxiangImageProvider: AIImageProvider = {
	id: "wanxiang",
	name: "通义万相 (阿里云 DashScope)",
	description: "阿里云 DashScope API - 通义万相文生图/图生图",
	useProxy: true,

	async generateImage({
		request,
		apiKey,
	}: {
		request: ImageGenerationRequest;
		apiKey: string;
	}): Promise<ImageGenerationResult[]> {
		if (!apiKey) {
			throw new Error("DASHSCOPE_API_KEY is not configured");
		}

		const finalPrompt = buildPrompt({
			prompt: request.prompt,
			aspectRatio: request.aspectRatio,
		});

		const payload: Record<string, unknown> = {
			model: IMAGE_MODEL,
			prompt: finalPrompt,
			n: 1,
			size: "1024x1024",
		};

		if (request.referenceImageUrl) {
			payload.reference_image = request.referenceImageUrl;
		}

		const doFetch = this.useProxy ? fetchViaProxy : fetchDirect;
		const response = await doFetch({ payload, apiKey });

		if (!response.ok) {
			const errorText = await response.text();
			throw new Error(`Wanxiang API error: ${response.status} - ${errorText}`);
		}

		const result = await response.json();
		const dataList: Array<{ url?: string; b64_json?: string }> =
			result.data ?? [];

		if (dataList.length === 0) {
			throw new Error("Wanxiang API returned no images");
		}

		const images: ImageGenerationResult[] = [];
		for (const item of dataList) {
			if (item.b64_json) {
				images.push({ url: `data:image/png;base64,${item.b64_json}` });
				continue;
			}
			if (item.url) {
				images.push({ url: item.url });
			}
		}

		if (images.length === 0) {
			throw new Error("No valid image URLs in Wanxiang API response");
		}

		return images;
	},
};

// ---------------------------------------------------------------------------
// Video Provider (通义万相 文生视频/图生视频)
// ---------------------------------------------------------------------------

const VIDEO_CREATE_ENDPOINT = `${API_BASE}/video/generations`;
const VIDEO_QUERY_ENDPOINT = `${API_BASE}/async-task`;
const VIDEO_MODEL = "wanx2.1-t2v-turbo";

function normalizeVideoStatus({ status }: { status: string }): VideoTaskStatus {
	const lower = status.toLowerCase();
	if (lower === "succeeded" || lower === "completed" || lower === "success") {
		return "succeeded";
	}
	if (lower === "failed" || lower === "error") {
		return "failed";
	}
	if (lower === "cancelled" || lower === "canceled") {
		return "cancelled";
	}
	if (lower === "running" || lower === "processing" || lower === "in_progress") {
		return "running";
	}
	return "pending";
}

async function postDirect({
	url,
	apiKey,
	body,
}: {
	url: string;
	apiKey: string;
	body: Record<string, unknown>;
}): Promise<Response> {
	return fetch(url, {
		method: "POST",
		headers: {
			"Content-Type": "application/json",
			Authorization: `Bearer ${apiKey}`,
		},
		body: JSON.stringify(body),
	});
}

async function getDirect({
	url,
	apiKey,
}: {
	url: string;
	apiKey: string;
}): Promise<Response> {
	return fetch(url, {
		headers: {
			"Content-Type": "application/json",
			Authorization: `Bearer ${apiKey}`,
		},
	});
}

async function fetchVideoViaProxy({
	url,
	apiKey,
	body,
}: {
	url: string;
	apiKey: string;
	body: Record<string, unknown>;
}): Promise<Response> {
	return fetch("/api/ai/video/generate", {
		method: "POST",
		headers: { "Content-Type": "application/json" },
		body: JSON.stringify({
			url,
			headers: { Authorization: `Bearer ${apiKey}` },
			body,
		}),
	});
}

async function fetchVideoTaskViaProxy({
	taskId,
	apiKey,
}: {
	taskId: string;
	apiKey: string;
}): Promise<Response> {
	const params = new URLSearchParams({
		providerId: "wanxiang",
		taskId,
	});
	return fetch(`/api/ai/video/task?${params.toString()}`, {
		headers: { Authorization: `Bearer ${apiKey}` },
	});
}

function sleep({ ms }: { ms: number }): Promise<void> {
	return new Promise((resolve) => setTimeout(resolve, ms));
}

export const wanxiangVideoProvider: AIVideoProvider = {
	id: "wanxiang-video",
	name: "通义万相视频 (阿里云 DashScope)",
	description: "阿里云 DashScope API - 通义万相文生视频/图生视频",
	useProxy: true,

	async submitVideoTask({
		request,
		apiKey,
	}: {
		request: VideoGenerationRequest;
		apiKey: string;
	}): Promise<VideoTaskResult> {
		if (!apiKey) {
			throw new Error("DASHSCOPE_API_KEY is not configured");
		}

		const payload: Record<string, unknown> = {
			model: VIDEO_MODEL,
			prompt: request.prompt,
		};

		if (request.duration !== undefined) {
			payload.duration = request.duration;
		}
		if (request.aspectRatio) {
			payload.ratio = request.aspectRatio;
		}
		if (request.resolution) {
			payload.size = request.resolution;
		}
		if (request.referenceImageUrl) {
			payload.reference_image = request.referenceImageUrl;
		}

		const doPost = this.useProxy ? fetchVideoViaProxy : postDirect;
		const response = await doPost({
			url: VIDEO_CREATE_ENDPOINT,
			apiKey,
			body: payload,
		});

		if (!response.ok) {
			const errorText = await response.text();
			throw new Error(
				`Wanxiang Video API error: ${response.status} - ${errorText}`,
			);
		}

		const data = await response.json();
		const taskId = data.id ?? data.task_id ?? data.data?.task_id;

		if (!taskId) {
			throw new Error("Wanxiang Video API returned no task ID");
		}

		return {
			taskId,
			status: normalizeVideoStatus({ status: data.status ?? "pending" }),
		};
	},

	async getVideoTask({
		taskId,
		apiKey,
	}: {
		taskId: string;
		apiKey: string;
	}): Promise<VideoTaskResult> {
		if (!apiKey) {
			throw new Error("DASHSCOPE_API_KEY is not configured");
		}

		const response = this.useProxy
			? await fetchVideoTaskViaProxy({ taskId, apiKey })
			: await getDirect({
					url: `${VIDEO_QUERY_ENDPOINT}?task_id=${taskId}`,
					apiKey,
				});

		if (!response.ok) {
			const errorText = await response.text();
			throw new Error(
				`Wanxiang Video API error: ${response.status} - ${errorText}`,
			);
		}

		const data = await response.json();
		const status = data.status ?? "pending";
		const normalizedStatus = normalizeVideoStatus({ status });

		const result: VideoTaskResult = {
			taskId,
			status: normalizedStatus,
		};

		if (normalizedStatus === "succeeded") {
			result.videoUrl =
				data.video_url ??
				data.output?.video_url ??
				data.output?.file_url;
		}

		if (normalizedStatus === "failed") {
			result.error =
				data.error?.message ?? data.message ?? "Video generation failed";
		}

		return result;
	},
};
