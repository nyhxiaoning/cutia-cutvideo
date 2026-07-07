import type {
	AIImageProvider,
	ImageGenerationRequest,
	ImageGenerationResult,
	AIVideoProvider,
	VideoGenerationRequest,
	VideoTaskResult,
} from "./types";

const UPSTREAM_BASE = "https://apihub.agnes-ai.com/v1";
const IMAGE_MODEL = "agnes-image-2.1-flash";
const VIDEO_MODEL = "agnes-video-v2.0";

// ---------------------------------------------------------------------------
// Image Provider
// ---------------------------------------------------------------------------

export const agnesImageProvider: AIImageProvider = {
	id: "agnes-image",
	name: "Agnes AI 图像",
	description: "Agnes AI - agnes-image-2.1-flash 文生图/图生图",
	useProxy: true,

	async generateImage({
		request,
		apiKey,
	}: {
		request: ImageGenerationRequest;
		apiKey: string;
	}): Promise<ImageGenerationResult[]> {
		if (!apiKey) throw new Error("Agnes API key is not configured");

		const payload: Record<string, unknown> = {
			model: IMAGE_MODEL,
			prompt: request.prompt,
			size: "1024x1024",
			n: 1,
		};
		if (request.referenceImageUrl) {
			payload.extra_body = { image: [request.referenceImageUrl] };
		}

		const response = await fetch("/api/ai/image/generate", {
			method: "POST",
			headers: { "Content-Type": "application/json" },
			body: JSON.stringify({
				url: `${UPSTREAM_BASE}/images/generations`,
				headers: { Authorization: `Bearer ${apiKey}` },
				body: payload,
			}),
		});

		if (!response.ok) {
			const errorText = await response.text();
			throw new Error(
				`Agnes Image API error: ${response.status} - ${errorText}`,
			);
		}

		const result = await response.json();
		const dataList: Array<{ url?: string; b64_json?: string }> =
			result.data ?? [];
		if (dataList.length === 0)
			throw new Error("Agnes Image API returned no images");

		return dataList.map((item): ImageGenerationResult => {
			const url = item.b64_json
				? `data:image/png;base64,${item.b64_json}`
				: (item.url ?? "");
			return { url };
		});
	},
};

// ---------------------------------------------------------------------------
// Video Provider
//   Server-side submit + poll via /api/ai/video/agnes
//   Same request body format as Python FastAPI server.py,
//   returns { video: url, message: "生成成功！时长: X秒" }
//
//   Text-to-video: JSON body
//   Image-to-video: FormData (same as Python /agnes-api/image2video/with_image)
// ---------------------------------------------------------------------------

function buildFormData(
	request: VideoGenerationRequest,
	apiKey: string,
): FormData {
	const fd = new FormData();
	fd.set("api_key", apiKey);
	fd.set("base_url", UPSTREAM_BASE);
	fd.set("model", VIDEO_MODEL);
	fd.set("prompt", request.prompt);
	fd.set("negative_prompt", "");
	fd.set("image_url", "");
	fd.set("resolution_preset", request.resolution ?? "720p");
	fd.set("ratio", request.aspectRatio ?? "16:9");
	fd.set("duration", String(request.duration ?? 5));
	fd.set("frame_rate", "24");
	fd.set("steps", "50");
	fd.set("dim_values", JSON.stringify(new Array(12).fill("不指定")));
	// referenceImageUrl could be a remote URL, a data: URI, or empty
	if (request.referenceImageUrl) {
		fd.set("image_url", request.referenceImageUrl);
	}
	return fd;
}

export const agnesVideoProvider: AIVideoProvider = {
	id: "agnes-video",
	name: "Agnes AI 视频",
	description: "Agnes AI - agnes-video-v2.0 文生视频/图生视频",
	useProxy: false,

	async submitVideoTask({
		request,
		apiKey,
	}: {
		request: VideoGenerationRequest;
		apiKey: string;
	}): Promise<VideoTaskResult> {
		if (!apiKey) throw new Error("Agnes API key is not configured");

		const body = buildFormData(request, apiKey);

		const response = await fetch("/api/ai/video/agnes", {
			method: "POST",
			body,
		});

		if (!response.ok) {
			const data = await response.json().catch(() => null);
			throw new Error(
				data?.error ?? `Agnes video error: HTTP ${response.status}`,
			);
		}

		const data: Record<string, unknown> = await response.json();

		return {
			taskId: "agnes-sync",
			status: "succeeded",
			videoUrl: String(data.video ?? ""),
		};
	},

	async getVideoTask({
		taskId,
	}: {
		taskId: string;
		apiKey: string;
	}): Promise<VideoTaskResult> {
		return { taskId, status: "succeeded" };
	},
};
