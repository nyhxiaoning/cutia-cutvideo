import {
	Input,
	ALL_FORMATS,
	BlobSource,
	CanvasSink,
	type WrappedCanvas,
} from "mediabunny";

interface VideoSinkData {
	sink: CanvasSink;
	iterator: AsyncGenerator<WrappedCanvas, void, unknown> | null;
	currentFrame: WrappedCanvas | null;
	nextFrame: WrappedCanvas | null;
	lastTime: number;
	prefetching: boolean;
	prefetchPromise: Promise<void> | null;
}

interface VideoElementSink {
	video: HTMLVideoElement;
	currentTime: number;
}

export class VideoCache {
	private sinks = new Map<string, VideoSinkData>();
	private initPromises = new Map<string, Promise<void>>();
	private videoElements = new Map<string, VideoElementSink>();

	async getFrameAt({
		mediaId,
		file,
		time,
	}: {
		mediaId: string;
		file: File;
		time: number;
	}): Promise<WrappedCanvas | null> {
		await this.ensureSink({ mediaId, file });

		const sinkData = this.sinks.get(mediaId);
		if (sinkData) {
			return this.getFrameFromSink({ sinkData, time });
		}

		// Fallback to HTMLVideoElement
		return this.getFrameFromVideo({ mediaId, file, time });
	}

	private async getFrameFromSink({
		sinkData,
		time,
	}: {
		sinkData: VideoSinkData;
		time: number;
	}): Promise<WrappedCanvas | null> {
		if (sinkData.nextFrame && sinkData.nextFrame.timestamp <= time) {
			sinkData.currentFrame = sinkData.nextFrame;
			sinkData.nextFrame = null;
			this.startPrefetch({ sinkData });
		}

		if (
			sinkData.currentFrame &&
			this.isFrameValid({ frame: sinkData.currentFrame, time })
		) {
			if (!sinkData.nextFrame && !sinkData.prefetching) {
				this.startPrefetch({ sinkData });
			}
			return sinkData.currentFrame;
		}

		if (
			sinkData.iterator &&
			sinkData.currentFrame &&
			time >= sinkData.lastTime &&
			time < sinkData.lastTime + 2.0
		) {
			const frame = await this.iterateToTime({ sinkData, targetTime: time });
			if (frame) {
				if (!sinkData.nextFrame && !sinkData.prefetching) {
					this.startPrefetch({ sinkData });
				}
				return frame;
			}
		}

		const frame = await this.seekToTime({ sinkData, time });
		if (frame && !sinkData.nextFrame && !sinkData.prefetching) {
			this.startPrefetch({ sinkData });
		}
		return frame;
	}

	private async getFrameFromVideo({
		mediaId,
		file,
		time,
	}: {
		mediaId: string;
		file: File;
		time: number;
	}): Promise<WrappedCanvas | null> {
		let ve = this.videoElements.get(mediaId);
		if (!ve) {
			ve = await this.initializeVideoElement({ mediaId, file });
			if (!ve) return null;
		}

		const { video } = ve;
		const seekTime = Math.max(0, Math.min(time, video.duration - 0.1));

		try {
			video.currentTime = seekTime;
			await new Promise<void>((resolve, reject) => {
				const onSeeked = () => {
					video.removeEventListener("seeked", onSeeked);
					video.removeEventListener("error", onError);
					resolve();
				};
				const onError = () => {
					video.removeEventListener("seeked", onSeeked);
					video.removeEventListener("error", onError);
					reject(new Error("Video seek failed"));
				};
				video.addEventListener("seeked", onSeeked);
				video.addEventListener("error", onError);
			});

			ve.currentTime = seekTime;
		} catch {
			return null;
		}

		const canvas = document.createElement("canvas");
		canvas.width = video.videoWidth;
		canvas.height = video.videoHeight;
		const ctx = canvas.getContext("2d");
		if (!ctx) return null;

		ctx.drawImage(video, 0, 0);

		return {
			canvas,
			timestamp: ve.currentTime,
			duration: 0,
		} satisfies WrappedCanvas;
	}

	private async initializeVideoElement({
		mediaId,
		file,
	}: {
		mediaId: string;
		file: File;
	}): Promise<VideoElementSink | null> {
		const existingVe = this.videoElements.get(mediaId);
		if (existingVe) {
			return existingVe;
		}

		return new Promise((resolve) => {
			const video = document.createElement("video");
			const objectUrl = URL.createObjectURL(file);

			video.muted = true;
			video.preload = "auto";

			video.addEventListener("loadedmetadata", () => {
				const ve: VideoElementSink = { video, currentTime: 0 };
				this.videoElements.set(mediaId, ve);
				resolve(ve);
			});

			video.addEventListener("error", () => {
				URL.revokeObjectURL(objectUrl);
				resolve(null);
			});

			video.src = objectUrl;
			video.load();
		});
	}

	private async ensureSink({
		mediaId,
		file,
	}: {
		mediaId: string;
		file: File;
	}): Promise<void> {
		if (this.sinks.has(mediaId)) return;
		if (this.videoElements.has(mediaId)) return;

		if (this.initPromises.has(mediaId)) {
			await this.initPromises.get(mediaId);
			return;
		}

		const initPromise = this.initializeSink({ mediaId, file });
		this.initPromises.set(mediaId, initPromise);

		try {
			await initPromise;
		} finally {
			this.initPromises.delete(mediaId);
		}
	}

	private async initializeSink({
		mediaId,
		file,
	}: {
		mediaId: string;
		file: File;
	}): Promise<void> {
		try {
			const input = new Input({
				source: new BlobSource(file),
				formats: ALL_FORMATS,
			});

			const videoTrack = await input.getPrimaryVideoTrack();
			if (!videoTrack) {
				throw new Error("No video track found");
			}

			const canDecode = await videoTrack.canDecode();
			if (!canDecode) {
				// Fallback to HTMLVideoElement — don't throw, just skip CanvasSink
				return;
			}

			const sink = new CanvasSink(videoTrack, {
				poolSize: 3,
				fit: "contain",
			});

			this.sinks.set(mediaId, {
				sink,
				iterator: null,
				currentFrame: null,
				nextFrame: null,
				lastTime: -1,
				prefetching: false,
				prefetchPromise: null,
			});
		} catch (error) {
			console.error(`Failed to initialize video sink for ${mediaId}:`, error);
			// Don't throw — video element fallback will handle it
		}
	}

	// ... rest of methods unchanged

	private isFrameValid({
		frame,
		time,
	}: {
		frame: WrappedCanvas;
		time: number;
	}): boolean {
		return (
			frame.timestamp <= time &&
			time - frame.timestamp < 0.5
		);
	}

	private startPrefetch({
		sinkData,
	}: {
		sinkData: VideoSinkData;
	}): void {
		if (sinkData.prefetching) return;
		sinkData.prefetching = true;
		sinkData.prefetchPromise = this.doPrefetch({ sinkData });
	}

	private async doPrefetch({
		sinkData,
	}: {
		sinkData: VideoSinkData;
	}): Promise<void> {
		try {
			if (!sinkData.nextFrame && sinkData.iterator) {
				const result = await sinkData.iterator.next();
				if (!result.done && result.value) {
					sinkData.nextFrame = result.value;
				}
			}
		} catch {
			// Ignore prefetch errors
		} finally {
			sinkData.prefetching = false;
		}
	}

	private async iterateToTime({
		sinkData,
		targetTime,
	}: {
		sinkData: VideoSinkData;
		targetTime: number;
	}): Promise<WrappedCanvas | null> {
		if (!sinkData.iterator) return null;

		try {
			while (true) {
				const result = await sinkData.iterator.next();
				if (result.done || !result.value) break;

				sinkData.currentFrame = result.value;
				sinkData.lastTime = result.value.timestamp;

				if (result.value.timestamp >= targetTime) {
					return result.value;
				}
			}
		} catch {
			// Reset iterator on error
			sinkData.iterator = null;
		}

		return null;
	}

	private async seekToTime({
		sinkData,
		time,
	}: {
		sinkData: VideoSinkData;
		time: number;
	}): Promise<WrappedCanvas | null> {
		try {
			const frame = await sinkData.sink.seek(time);
			sinkData.currentFrame = frame;
			sinkData.lastTime = time;
			sinkData.iterator = null;
			return frame;
		} catch {
			return null;
		}
	}

	clearVideo({ mediaId }: { mediaId: string }): void {
		const sinkData = this.sinks.get(mediaId);
		if (sinkData) {
			if (sinkData.iterator) {
				void sinkData.iterator.return();
			}

			this.sinks.delete(mediaId);
		}

		const ve = this.videoElements.get(mediaId);
		if (ve) {
			URL.revokeObjectURL(ve.video.src);
			ve.video.remove();
			this.videoElements.delete(mediaId);
		}

		this.initPromises.delete(mediaId);
	}

	clearAll(): void {
		for (const [mediaId] of this.sinks) {
			this.clearVideo({ mediaId });
		}
		for (const [mediaId] of this.videoElements) {
			this.clearVideo({ mediaId });
		}
	}

	getStats() {
		return {
			totalSinks: this.sinks.size,
			totalVideoElements: this.videoElements.size,
			activeSinks: Array.from(this.sinks.values()).filter((s) => s.iterator)
				.length,
			cachedFrames: Array.from(this.sinks.values()).filter(
				(s) => s.currentFrame,
			).length,
		};
	}
}

export const videoCache = new VideoCache();
