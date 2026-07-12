import EventEmitter from "eventemitter3";

import {
	Output,
	Mp4OutputFormat,
	WebMOutputFormat,
	BufferTarget,
	CanvasSource,
	AudioBufferSource,
	QUALITY_LOW,
	QUALITY_MEDIUM,
	QUALITY_HIGH,
	QUALITY_VERY_HIGH,
	getFirstEncodableVideoCodec,
} from "mediabunny";
import type { RootNode } from "./nodes/root-node";
import { CanvasRenderer } from "./canvas-renderer";

export type ExportFormat = "mp4" | "webm";
export type ExportQuality = "low" | "medium" | "high" | "very_high";

type ExportParams = {
	width: number;
	height: number;
	fps: number;
	format: ExportFormat;
	quality: ExportQuality;
	startTime?: number;
	duration?: number;
	shouldIncludeAudio?: boolean;
	audioBuffer?: AudioBuffer;
};

const qualityMap = {
	low: QUALITY_LOW,
	medium: QUALITY_MEDIUM,
	high: QUALITY_HIGH,
	very_high: QUALITY_VERY_HIGH,
};

const BITRATE_MAP: Record<ExportQuality, number> = {
	low: 500_000,
	medium: 1_000_000,
	high: 3_000_000,
	very_high: 8_000_000,
};

function getMediaRecorderMimeType(): string | null {
	const preferred = ['video/webm;codecs="vp8"', "video/webm", "video/mp4"];
	for (const mime of preferred) {
		if (MediaRecorder.isTypeSupported(mime)) return mime;
	}
	return null;
}

export type SceneExporterEvents = {
	progress: [progress: number];
	complete: [buffer: ArrayBuffer];
	error: [error: Error];
	cancelled: [];
};

function isVideoEncoderSupported(): boolean {
	return typeof VideoEncoder !== "undefined";
}

function isMediaRecorderSupported(): boolean {
	return typeof MediaRecorder !== "undefined"
		&& MediaRecorder.isTypeSupported('video/webm;codecs="vp8"');
}

export class SceneExporter extends EventEmitter<SceneExporterEvents> {
	private renderer: CanvasRenderer;
	private format: ExportFormat;
	private quality: ExportQuality;
	private startTime: number;
	private duration: number;
	private shouldIncludeAudio: boolean;
	private audioBuffer?: AudioBuffer;

	private isCancelled = false;

	constructor({
		width,
		height,
		fps,
		format,
		quality,
		startTime = 0,
		duration = 0,
		shouldIncludeAudio,
		audioBuffer,
	}: ExportParams) {
		super();
		this.renderer = new CanvasRenderer({
			width,
			height,
			fps,
			imageSmoothingQuality: "high",
		});

		this.format = format;
		this.quality = quality;
		this.startTime = startTime;
		this.duration = duration;
		this.shouldIncludeAudio = shouldIncludeAudio ?? false;
		this.audioBuffer = audioBuffer;
	}

	cancel(): void {
		this.isCancelled = true;
	}

	async export({
		rootNode,
		startTime,
	}: {
		rootNode: RootNode;
		startTime?: number;
	}): Promise<ArrayBuffer | null> {
		// allow overriding startTime per-call; fall back to constructor value
		const effectiveStartTime = startTime ?? this.startTime;
		const exportDuration = this.duration > 0
			? this.duration
			: Math.max(0, rootNode.duration - effectiveStartTime);
		if (isVideoEncoderSupported()) {
			try {
				return await this.exportWithMediabunny({
					rootNode,
					startTime: effectiveStartTime,
					duration: exportDuration,
				});
			} catch (error) {
				const msg = error instanceof Error ? error.message : "";
				// If VideoEncoder itself is missing at runtime, fall through
				if (msg.includes("VideoEncoder is not supported")) {
					// Fall through to MediaRecorder
				} else {
					throw error;
				}
			}
		}

		// Fallback: render frames to a real canvas, capture via MediaRecorder
		if (isMediaRecorderSupported()) {
			return this.exportWithMediaRecorder({
			rootNode,
			startTime: effectiveStartTime,
			duration: exportDuration,
		});
		}

		throw new Error(
			"VideoEncoder is not supported by this browser. " +
			"Please try a different browser (Chrome/Edge recommended).",
		);
	}

	private async exportWithMediabunny({
		rootNode,
		startTime = 0,
		duration,
	}: {
		rootNode: RootNode;
		startTime?: number;
		duration: number;
	}): Promise<ArrayBuffer | null> {
		const { fps } = this.renderer;
		const frameCount = Math.ceil(duration * fps);

		// Probe for codec support — fall back to vp9/webm when avc is absent
		const desiredCodec = this.format === "webm" ? "vp9" : "avc";
		// Use even dimensions to avoid avc/hevc odd-dimension rejection
		const w = Math.ceil(this.renderer.width / 2) * 2;
		const h = Math.ceil(this.renderer.height / 2) * 2;
		const codec = await getFirstEncodableVideoCodec([desiredCodec, "vp9", "vp8"], {
			width: w,
			height: h,
			bitrate: qualityMap[this.quality],
		});

		if (!codec) {
			throw new Error(
				"VideoEncoder is not supported by this browser. " +
				"Please try a different browser (Chrome/Edge recommended).",
			);
		}

		const outputFormat =
			codec === "avc" ? new Mp4OutputFormat() : new WebMOutputFormat();

		const output = new Output({
			format: outputFormat,
			target: new BufferTarget(),
		});

		const videoSource = new CanvasSource(this.renderer.canvas, {
			codec,
			bitrate: qualityMap[this.quality],
		});

		output.addVideoTrack(videoSource, { frameRate: fps });

		let audioSource: AudioBufferSource | null = null;
		if (this.shouldIncludeAudio && this.audioBuffer) {
			audioSource = new AudioBufferSource({
				codec: this.format === "webm" ? "opus" : "aac",
				bitrate: qualityMap[this.quality],
			});
			output.addAudioTrack(audioSource);
		}

		await output.start();

		if (audioSource && this.audioBuffer) {
			await audioSource.add(this.audioBuffer);
			audioSource.close();
		}

		for (let i = 0; i < frameCount; i++) {
			if (this.isCancelled) {
				await output.cancel();
				this.emit("cancelled");
				return null;
			}

			const time = startTime + i / fps;
			await this.renderer.render({ node: rootNode, time });
			await videoSource.add(time, 1 / fps);

			this.emit("progress", i / frameCount);
		}

		if (this.isCancelled) {
			await output.cancel();
			this.emit("cancelled");
			return null;
		}

		videoSource.close();
		await output.finalize();
		this.emit("progress", 1);

		const buffer = output.target.buffer;
		if (!buffer) {
			this.emit("error", new Error("Failed to export video"));
			return null;
		}

		this.emit("complete", buffer);
		return buffer;
	}

	private async exportWithMediaRecorder({
		rootNode,
		startTime = 0,
		duration,
	}: {
		rootNode: RootNode;
		startTime?: number;
		duration: number;
	}): Promise<ArrayBuffer | null> {
		const { fps } = this.renderer;
		const frameCount = Math.ceil(duration * fps);

		// Ensure renderer uses a visible HTMLCanvasElement for MediaRecorder
		const exportCanvas = document.createElement("canvas");
		exportCanvas.width = this.renderer.width;
		exportCanvas.height = this.renderer.height;

		const mimeType = getMediaRecorderMimeType();
		if (!mimeType) {
			throw new Error(
				"Video export is not supported by this browser. " +
				"Please try a different browser (Chrome/Edge recommended).",
			);
		}

		const stream = exportCanvas.captureStream(fps);
		const recorder = new MediaRecorder(stream, {
			mimeType,
			videoBitsPerSecond: BITRATE_MAP[this.quality],
		});

		const chunks: Blob[] = [];
		recorder.ondataavailable = (event) => {
			if (event.data.size > 0) {
				chunks.push(event.data);
			}
		};

		const recordPromise = new Promise<Blob>((resolve, reject) => {
			recorder.onstop = () => {
				resolve(new Blob(chunks, { type: mimeType }));
			};
			recorder.onerror = () => {
				reject(new Error("MediaRecorder recording failed"));
			};
		});

		recorder.start();

		// Render each frame to the visible canvas for capture
		for (let i = 0; i < frameCount; i++) {
			if (this.isCancelled) {
				recorder.stop();
				this.emit("cancelled");
				return null;
			}

			const time = startTime + i / fps;
			await this.renderer.renderToCanvas({
				node: rootNode,
				time,
				targetCanvas: exportCanvas,
			});

			this.emit("progress", i / frameCount);

			// Yield to allow the MediaRecorder to capture the frame
			await new Promise((resolve) => setTimeout(resolve, 0));
		}

		if (this.isCancelled) {
			recorder.stop();
			this.emit("cancelled");
			return null;
		}

		recorder.stop();
		const blob = await recordPromise;
		const buffer = await blob.arrayBuffer();

		this.emit("progress", 1);
		this.emit("complete", buffer);
		return buffer;
	}
}
