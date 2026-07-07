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
//
// Two modes:
//   1. Text-to-video (no image) — browser fetch to Agnes API (sync response)
//   2. Image-to-video (data: URI) — POST to /api/ai/video/agnes-image2video
//      (server route, handles FormData → submit → poll → return)
// ---------------------------------------------------------------------------

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

		// Image-to-video: send file through server route (handles submit + poll)
		if (request.referenceImageUrl?.startsWith("data:")) {
			const resp = await fetch(request.referenceImageUrl);
			const blob = await resp.blob();

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
			fd.set("file", blob, "reference.png");

			const response = await fetch("/api/ai/video/agnes-image2video", {
				method: "POST",
				body: fd,
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
		}

		// Text-to-video: direct browser fetch (sync from upstream)
		const payload: Record<string, unknown> = {
			model: VIDEO_MODEL,
			prompt: request.prompt,
			width: 1152,
			height: 768,
			num_frames: 121,
			frame_rate: 24,
		};

		const response = await fetch(`${UPSTREAM_BASE}/videos`, {
			method: "POST",
			headers: {
				"Content-Type": "application/json",
				Authorization: `Bearer ${apiKey}`,
			},
			body: JSON.stringify(payload),
		});

		if (!response.ok) {
			const text = await response.text();
			throw new Error(`Agnes video error: ${response.status} - ${text}`);
		}

		const data: Record<string, unknown> = await response.json();

		// Sync response
		const videoUrl = String(
			data.video ??
				data.video_url ??
				(data.data as Record<string, unknown> | undefined)?.video_url ??
				"",
		);
		if (videoUrl) {
			return { taskId: "agnes-sync", status: "succeeded", videoUrl };
		}

		// Async — needs polling (for older models)
		const videoId =
			data.id ??
			data.video_id ??
			(data.data as Record<string, unknown> | undefined)?.id ??
			(data.data as Record<string, unknown> | undefined)?.video_id;

		if (!videoId) {
			throw new Error(`Agnes returned no result: ${JSON.stringify(data)}`);
		}

		return { taskId: String(videoId), status: "pending" };
	},

	async getVideoTask({
		taskId,
		apiKey,
	}: {
		taskId: string;
		apiKey: string;
	}): Promise<VideoTaskResult> {
		// Server route handles all polling — this is only called for
		// fallback text-to-video poll via browser (uncommon)
		const response = await fetch(
			`https://apihub.agnes-ai.com/agnesapi?video_id=${taskId}`,
			{
				headers: { Authorization: `Bearer ${apiKey}` },
			},
		);

		if (!response.ok) {
			if (response.status === 404) {
				return { taskId, status: "pending" };
			}
			const text = await response.text();
			throw new Error(`Agnes poll error: ${response.status} - ${text}`);
		}

		const data: Record<string, unknown> = await response.json();
		const status = String(data.status ?? "pending").toLowerCase();

		const result: VideoTaskResult = { taskId, status: "pending" };

		if (["succeeded", "completed"].includes(status)) {
			const videoUrl =
				data.url ??
				data.video_url ??
				(data.data as Record<string, unknown> | undefined)?.video_url ??
				(data.data as Record<string, unknown> | undefined)?.url ??
				"";
			result.status = "succeeded";
			result.videoUrl = String(videoUrl);
		} else if (["failed", "error"].includes(status)) {
			result.status = "failed";
			const err =
				typeof data.error === "object" && data.error !== null
					? (data.error as Record<string, unknown>)
					: undefined;
			result.error =
				(typeof err?.message === "string" ? err.message : undefined) ??
				(typeof data.message === "string" ? data.message : undefined) ??
				"Video generation failed";
		}

		return result;
	},
};
