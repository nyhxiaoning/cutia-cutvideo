import { type NextRequest, NextResponse } from "next/server";

const UPSTREAM_BASE = "https://apihub.agnes-ai.com/v1";
const POLL_BASE = "https://apihub.agnes-ai.com";
const POLL_INTERVAL = 5000;
const MAX_WAIT = 1_800_000; // 30 minutes

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

const DIM_KEYS = [
	"subject_tracking",
	"scene_dynamics",
	"style_consistency",
	"cinematography",
	"dynamic_composition",
	"lighting_animation",
	"temporal",
	"weather_simulation",
	"color_grading",
	"material_physics",
	"video_quality",
	"motion_effects",
];

function sleep(ms: number): Promise<void> {
	return new Promise((resolve) => setTimeout(resolve, ms));
}

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

function buildPayload(
	form: Record<string, unknown>,
	imageDataUri: string,
): Record<string, unknown> {
	const size = calcVideoSize(String(form.ratio ?? "16:9"));
	const duration = Number(form.duration ?? 5);
	const frameRate = Number(form.frame_rate ?? 24);
	const numFrames = calcNumFrames(
		duration,
		frameRate,
		String(form.resolution_preset ?? "720p"),
	);
	const steps = Number(form.steps ?? 50);
	const dimValues = (form.dim_values as string[]) ?? [];

	// Compile prompt with dimension values (same as Python prompt_builder.py)
	let compiledPrompt = String(form.prompt ?? "");
	const activeDims = dimValues
		.map((v, i) => (v && v !== "不指定" ? v : null))
		.filter(Boolean) as string[];
	if (activeDims.length > 0) {
		compiledPrompt = `${compiledPrompt}, ${activeDims.join(", ")}`;
	}

	// eslint-disable-next-line @typescript-eslint/no-explicit-any
	const payload: Record<string, any> = {
		model: String(form.model ?? "agnes-video-v2.0"),
		prompt: compiledPrompt,
		width: size.width,
		height: size.height,
		num_frames: numFrames,
		frame_rate: frameRate,
		image: imageDataUri,
	};

	if (form.negative_prompt) {
		payload.negative_prompt = String(form.negative_prompt);
	}
	if (steps !== 50) {
		payload.num_inference_steps = steps;
	}

	return payload;
}

async function submitVideo(
	apiKey: string,
	payload: Record<string, unknown>,
): Promise<string> {
	console.log(
		`[agnes-i2v] submitting, prompt="${String(payload.prompt).slice(0, 60)}"`,
	);

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
		throw new Error(`Agnes submit error: ${response.status} - ${text}`);
	}

	const data: Record<string, unknown> = await response.json();

	// Sync: upstream returns video URL directly
	const videoUrl = String(data.video ?? data.video_url ?? "");
	if (videoUrl) {
		console.log(`[agnes-i2v] sync response, url=${videoUrl}`);
		return videoUrl; // Use videoUrl as sentinel — poll function handles this
	}

	// Async: returns { video_id, id } — need to poll
	const videoId = (data.video_id as string) ?? (data.id as string) ?? "";
	if (!videoId) {
		throw new Error(`Agnes returned no video_id: ${JSON.stringify(data)}`);
	}

	console.log(`[agnes-i2v] async response, polling video_id=${videoId}`);
	return videoId;
}

async function pollVideo(
	apiKey: string,
	taskId: string,
): Promise<{ videoUrl: string; seconds?: number }> {
	const deadline = Date.now() + MAX_WAIT;
	let retries = 0;

	while (Date.now() < deadline) {
		try {
			const response = await fetch(`${POLL_BASE}/agnesapi?video_id=${taskId}`, {
				headers: { Authorization: `Bearer ${apiKey}` },
			});

			if (!response.ok) {
				const text = await response.text();
				if (response.status === 404) {
					console.log(`[agnes-i2v] poll 404 task_id=${taskId}`);
					await sleep(POLL_INTERVAL);
					continue;
				}
				throw new Error(`Agnes poll error: ${response.status} - ${text}`);
			}

			retries = 0;
			const data: Record<string, unknown> = await response.json();
			const status = String(data.status ?? "").toLowerCase();

			console.log(
				`[agnes-i2v] poll task_id=${taskId} status=${status} progress=${String(data.progress ?? "")}`,
			);

			if (status === "completed") {
				const videoUrl = String(
					data.url ?? data.video_url ?? data.remixed_from_video_id ?? "",
				);
				if (!videoUrl) throw new Error("Video completed but no URL returned");
				return {
					videoUrl,
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
				await sleep(Math.min(2000 * 2 ** retries, 30_000));
			} else {
				throw err;
			}
		}
	}

	throw new Error("Video generation timed out after 30 minutes");
}

// ---------------------------------------------------------------------------
// POST handler — mirrors Python /agnes-api/image2video/with_image
// ---------------------------------------------------------------------------

export async function POST(request: NextRequest) {
	try {
		const form = await request.formData();

		const apiKey = String(form.get("api_key") ?? "");
		if (!apiKey) throw new Error("api_key is required");

		const prompt = String(form.get("prompt") ?? "");
		if (!prompt) throw new Error("prompt is required");

		// Build image data URI from file or image_url field
		let imageDataUri = "";
		const file = form.get("file");
		if (file instanceof File && file.size > 0) {
			const buffer = Buffer.from(await file.arrayBuffer());
			const b64 = buffer.toString("base64");
			imageDataUri = `data:${file.type || "image/png"};base64,${b64}`;
		}
		if (!imageDataUri) {
			const imageUrl = String(form.get("image_url") ?? "");
			if (imageUrl) imageDataUri = imageUrl;
		}
		if (!imageDataUri) throw new Error("No image provided (file or image_url)");

		const payload = buildPayload(
			{
				prompt,
				model: form.get("model"),
				ratio: form.get("ratio"),
				resolution_preset: form.get("resolution_preset"),
				duration: form.get("duration"),
				frame_rate: form.get("frame_rate"),
				steps: form.get("steps"),
				negative_prompt: form.get("negative_prompt"),
				dim_values: (() => {
					try {
						return JSON.parse(String(form.get("dim_values") ?? "[]"));
					} catch {
						return [];
					}
				})(),
			},
			imageDataUri,
		);

		console.log(`[agnes-i2v] start prompt="${prompt.slice(0, 60)}"`);

		const taskId = await submitVideo(apiKey, payload);

		// If submit returned a direct video URL (sync), return immediately
		if (taskId.startsWith("http")) {
			return NextResponse.json({
				video: taskId,
				message: "生成成功！",
			});
		}

		// Async: poll until completed
		const result = await pollVideo(apiKey, taskId);

		return NextResponse.json({
			video: result.videoUrl,
			message: `生成成功！${result.seconds ? `时长: ${result.seconds}秒` : ""}`,
		});
	} catch (error) {
		const message =
			error instanceof Error ? error.message : "Video generation failed";
		console.error("[agnes-i2v] error:", error);
		return NextResponse.json({ error: message }, { status: 500 });
	}
}
