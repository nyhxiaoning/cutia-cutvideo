import { type NextRequest, NextResponse } from "next/server";

const UPSTREAM_BASE = "https://apihub.agnes-ai.com/v1";
const POLL_BASE = "https://apihub.agnes-ai.com";
const POLL_INTERVAL = 5000;
const MAX_WAIT = 1_800_000; // 30 minutes (API spec)

const RATIO_TO_SIZE: Record<string, { width: number; height: number }> = {
	"16:9": { width: 1152, height: 768 },
	"9:16": { width: 768, height: 1152 },
	"1:1": { width: 768, height: 768 },
	"4:3": { width: 1024, height: 768 },
	"3:4": { width: 768, height: 1024 },
};

const MAX_FRAMES_BY_RESOLUTION: Record<string, number> = {
	"480p": 961,
	"720p": 409,
	"1080p": 169,
};

function calcVideoSize(ratio?: string): { width: number; height: number } {
	if (ratio && RATIO_TO_SIZE[ratio]) return RATIO_TO_SIZE[ratio];
	return { width: 1152, height: 768 };
}

function calcNumFrames(
	duration: number,
	frameRate = 24,
	resolution?: string,
): number {
	const target = duration * frameRate;
	const n = Math.round((target - 1) / 8);
	const frames = 8 * n + 1;
	const max = resolution ? (MAX_FRAMES_BY_RESOLUTION[resolution] ?? 409) : 409;
	return Math.min(Math.max(frames, 9), max);
}

function sleep(ms: number): Promise<void> {
	return new Promise((resolve) => setTimeout(resolve, ms));
}

async function fileToDataUri(file: File): Promise<string> {
	const buffer = await file.arrayBuffer();
	const base64 = Buffer.from(buffer).toString("base64");
	return `data:${file.type || "image/png"};base64,${base64}`;
}

function formatDuration(seconds?: number): string {
	return seconds !== undefined ? `时长: ${seconds}秒` : "";
}

// ---------------------------------------------------------------------------
// Parse request — supports both JSON (text2video) and FormData (image2video)
// ---------------------------------------------------------------------------

interface ParsedRequest {
	apiKey: string;
	prompt: string;
	negative_prompt: string;
	model: string;
	ratio: string;
	resolution_preset: string;
	duration: number;
	frame_rate: number;
	steps: number;
	dim_values: string[];
	/** data: URI or remote URL */
	imageDataUri?: string;
}

async function parseRequest(request: NextRequest): Promise<ParsedRequest> {
	const contentType = request.headers.get("content-type") ?? "";
	const isFormData = contentType.includes("multipart/form-data");

	if (isFormData) {
		const form = await request.formData();

		let imageDataUri: string | undefined;
		const file = form.get("file");
		if (file instanceof File && file.size > 0) {
			imageDataUri = await fileToDataUri(file);
		}
		const imageUrl = String(form.get("image_url") ?? "");
		if (!imageDataUri && imageUrl) {
			imageDataUri = imageUrl;
		}

		let dims: string[];
		try {
			dims = JSON.parse(String(form.get("dim_values") ?? "[]"));
		} catch {
			dims = new Array(12).fill("不指定");
		}

		return {
			apiKey: String(form.get("api_key") ?? ""),
			prompt: String(form.get("prompt") ?? ""),
			negative_prompt: String(form.get("negative_prompt") ?? ""),
			model: String(form.get("model") ?? "agnes-video-v2.0"),
			ratio: String(form.get("ratio") ?? "16:9"),
			resolution_preset: String(form.get("resolution_preset") ?? "720p"),
			duration: Number(form.get("duration") ?? 5),
			frame_rate: Number(form.get("frame_rate") ?? 24),
			steps: Number(form.get("steps") ?? 50),
			dim_values: dims,
			imageDataUri,
		};
	}

	// JSON body
	const body: Record<string, unknown> = await request.json();

	let dims: string[];
	try {
		dims = body.dim_values as string[];
	} catch {
		dims = new Array(12).fill("不指定");
	}

	const imageDataUri = body.image ? String(body.image) : undefined;

	return {
		apiKey: String(body.api_key ?? ""),
		prompt: String(body.prompt ?? ""),
		negative_prompt: String(body.negative_prompt ?? ""),
		model: String(body.model ?? "agnes-video-v2.0"),
		ratio: String(body.ratio ?? "16:9"),
		resolution_preset: String(body.resolution_preset ?? "720p"),
		duration: Number(body.duration ?? 5),
		frame_rate: Number(body.frame_rate ?? 24),
		steps: Number(body.steps ?? 50),
		dim_values: dims,
		imageDataUri,
	};
}

// ---------------------------------------------------------------------------
// Build upstream payload (same as Python api_client.py)
// ---------------------------------------------------------------------------

function buildUpstreamPayload(parsed: ParsedRequest): Record<string, unknown> {
	const size = calcVideoSize(parsed.ratio);
	const numFrames = calcNumFrames(
		parsed.duration,
		parsed.frame_rate,
		parsed.resolution_preset,
	);

	const payload: Record<string, unknown> = {
		model: parsed.model,
		prompt: parsed.prompt,
		width: size.width,
		height: size.height,
		num_frames: numFrames,
		frame_rate: parsed.frame_rate,
	};

	if (parsed.negative_prompt) {
		payload.negative_prompt = parsed.negative_prompt;
	}

	if (parsed.steps !== 50) {
		payload.num_inference_steps = parsed.steps;
	}

	if (parsed.imageDataUri) {
		payload.image = parsed.imageDataUri;
	}

	return payload;
}

// ---------------------------------------------------------------------------
// Submit + poll
// ---------------------------------------------------------------------------

async function submitVideo(
	apiKey: string,
	payload: Record<string, unknown>,
): Promise<{
	videoUrl?: string;
	videoId?: string;
}> {
	const logPayload = {
		...payload,
		image: payload.image ? "(present)" : undefined,
	};
	console.log(`[agnes] submitting video: ${JSON.stringify(logPayload)}`);

	const response = await fetch(`${UPSTREAM_BASE}/videos`, {
		method: "POST",
		headers: {
			"Content-Type": "application/json",
			Authorization: `Bearer ${apiKey}`,
		},
		body: JSON.stringify(payload),
	});

	const responseText = await response.text();

	if (!response.ok) {
		throw new Error(`Agnes submit error: ${response.status} - ${responseText}`);
	}

	let data: Record<string, unknown>;
	try {
		data = JSON.parse(responseText);
	} catch {
		throw new Error(
			`Agnes submit non-JSON response: ${responseText.slice(0, 500)}`,
		);
	}

	console.log(`[agnes] submit response: ${JSON.stringify(data)}`);

	// Sync response: upstream returns video URL directly
	const videoUrl = String(
		data.video ??
			data.video_url ??
			(data.data as Record<string, unknown> | undefined)?.video_url ??
			"",
	);
	if (videoUrl) {
		console.log(`[agnes] sync response, videoUrl=${videoUrl}`);
		return { videoUrl };
	}

	// Async response: upstream returns video_id/id for polling
	const videoId =
		data.video_id ??
		data.id ??
		(data.data as Record<string, unknown> | undefined)?.video_id ??
		(data.data as Record<string, unknown> | undefined)?.id;

	if (!videoId) {
		throw new Error(`Agnes returned no video_id: ${JSON.stringify(data)}`);
	}

	console.log(`[agnes] async response, polling video_id=${videoId}`);
	return { videoId: String(videoId) };
}

async function pollVideo(
	apiKey: string,
	videoId: string,
): Promise<{
	videoUrl: string;
	size?: string;
	seconds?: number;
}> {
	const deadline = Date.now() + MAX_WAIT;
	let retries = 0;

	while (Date.now() < deadline) {
		try {
			const response = await fetch(
				`${POLL_BASE}/agnesapi?video_id=${videoId}`,
				{
					headers: { Authorization: `Bearer ${apiKey}` },
				},
			);

			if (!response.ok) {
				const text = await response.text();
				if (response.status === 404) {
					console.log(
						`[agnes] poll 404 video_id=${videoId}, retrying... body=${text.slice(0, 200)}`,
					);
					await sleep(POLL_INTERVAL);
					continue;
				}
				throw new Error(`Agnes poll error: ${response.status} - ${text}`);
			}

			retries = 0;
			const data: Record<string, unknown> = await response.json();
			const status = String(data.status ?? "").toLowerCase();

			console.log(
				`[agnes] poll video_id=${videoId} status=${status} progress=${String(data.progress ?? "")}`,
			);

			if (status === "completed") {
				const videoUrl = String(
					data.url ?? data.video_url ?? data.remixed_from_video_id ?? "",
				);
				if (!videoUrl) {
					throw new Error("Video completed but no URL returned");
				}
				console.log(`[agnes] completed video_id=${videoId} url=${videoUrl}`);
				return {
					videoUrl,
					size: data.size ? String(data.size) : undefined,
					seconds: data.seconds ? Number(data.seconds) : undefined,
				};
			}

			if (["failed", "error"].includes(status)) {
				const err =
					typeof data.error === "object" && data.error
						? (data.error as Record<string, unknown>)
						: undefined;
				throw new Error(
					String(err?.message ?? data.message ?? "Video generation failed"),
				);
			}

			await sleep(POLL_INTERVAL);
		} catch (err) {
			if (err instanceof Error && err.message.startsWith("Agnes poll error")) {
				retries++;
				if (retries >= 10) throw err;
				const backoff = Math.min(2000 * 2 ** retries, 30_000);
				console.log(`[agnes] poll retry ${retries}/10, backoff ${backoff}ms`);
				await sleep(backoff);
			} else {
				throw err;
			}
		}
	}

	throw new Error("Video generation timed out after 30 minutes");
}

// ---------------------------------------------------------------------------
// Route
// ---------------------------------------------------------------------------

export async function POST(request: NextRequest) {
	try {
		const parsed = await parseRequest(request);

		if (!parsed.apiKey) throw new Error("api_key is required");
		if (!parsed.prompt) throw new Error("prompt is required");

		const payload = buildUpstreamPayload(parsed);

		console.log(
			`[agnes] start type=${parsed.imageDataUri ? "image2video" : "text2video"} prompt="${parsed.prompt.slice(0, 60)}"`,
		);

		const submitResult = await submitVideo(parsed.apiKey, payload);

		// Sync response: video URL returned directly, skip poll
		if (submitResult.videoUrl) {
			return NextResponse.json({
				video: submitResult.videoUrl,
				message: "生成成功！",
			});
		}

		const videoId = submitResult.videoId;
		// biome-ignore lint/style/noNonNullAssertion: guarded by the sync-url check above
		const result = await pollVideo(parsed.apiKey, videoId!);

		return NextResponse.json({
			video: result.videoUrl,
			message: `生成成功！${formatDuration(result.seconds)}`,
		});
	} catch (error) {
		const message =
			error instanceof Error ? error.message : "Video generation failed";
		console.error("[agnes] error:", error);
		return NextResponse.json({ error: message }, { status: 500 });
	}
}
