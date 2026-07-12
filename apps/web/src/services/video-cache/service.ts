import {
	Input,
	ALL_FORMATS,
	BlobSource,
	CanvasSink,
	type WrappedCanvas,
} from "mediabunny";

interface VideoSinkData {
	sink: CanvasSink;
	/** Sequential frame iterator (from canvases()), null when seeking */
	iterator: AsyncGenerator<WrappedCanvas, void, unknown> | null;
	currentFrame: WrappedCanvas | null;
	/** Tracks the last frame fetched to know if we're iterating or jumping */
	frameIndex: number;
}

export class VideoCache {
	private sinks = new Map<string, VideoSinkData>();
	private initPromises = new Map<string, Promise<void>>();

	/**
	 * Get a frame at an arbitrary time. Fast when called in monotonic order,
	 * falls back to seek (slower) on random access.
	 */
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
		if (!sinkData) {
			return null;
		}

		return this.getFrameFromSink({ sinkData, time });
	}

	private async getFrameFromSink({
		sinkData,
		time,
	}: {
		sinkData: VideoSinkData;
		time: number;
	}): Promise<WrappedCanvas | null> {
		// Fast path: current frame is still valid (within 0.5s of its timestamp)
		if (
			sinkData.currentFrame &&
			time >= sinkData.currentFrame.timestamp &&
			time - sinkData.currentFrame.timestamp < 0.5
		) {
			return sinkData.currentFrame;
		}

		// Try iterating — works when time is >= currentFrame + some progress
		if (sinkData.currentFrame && time > sinkData.currentFrame.timestamp) {
			const frame = await this.iterateToTime({ sinkData, targetTime: time });
			if (frame) return frame;
		}

		// Seek: create a fresh iterator starting at the requested time
		return this.seekToTime({ sinkData, time });
	}

	private async iterateToTime({
		sinkData,
		targetTime,
	}: {
		sinkData: VideoSinkData;
		targetTime: number;
	}): Promise<WrappedCanvas | null> {
		if (!sinkData.iterator) {
			// Clamp start to avoid creating an iterator at a time ahead of targetTime
			const start = Math.min(
				sinkData.currentFrame?.timestamp ?? Math.max(0, targetTime - 1),
				targetTime,
			);
			sinkData.iterator = sinkData.sink.canvases(start);
			sinkData.frameIndex = 0;
		}

		// Advance the iterator until we reach/pass targetTime
		for (let attempts = 0; attempts < 120; attempts++) {
			try {
				const result = await sinkData.iterator.next();
				if (result.done || !result.value) {
					sinkData.iterator = null;
					return null;
				}

				sinkData.currentFrame = result.value;
				sinkData.frameIndex++;

				if (result.value.timestamp >= targetTime - 0.001) {
					return result.value;
				}
				// Otherwise keep advancing — frame was before our target
			} catch {
				sinkData.iterator = null;
				return null;
			}
		}

		// Safety valve: too many iterations, fall back to seek
		sinkData.iterator = null;
		return this.seekToTime({ sinkData, time: targetTime });
	}

	private async seekToTime({
		sinkData,
		time,
	}: {
		sinkData: VideoSinkData;
		time: number;
	}): Promise<WrappedCanvas | null> {
		try {
			const frame = await sinkData.sink.getCanvas(time);
			if (frame) {
				sinkData.currentFrame = frame;
				sinkData.iterator = null;
				sinkData.frameIndex = 0;
			}
			return frame;
		} catch {
			return null;
		}
	}

	private async ensureSink({
		mediaId,
		file,
	}: {
		mediaId: string;
		file: File;
	}): Promise<void> {
		if (this.sinks.has(mediaId)) return;
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
			if (!videoTrack) throw new Error("No video track found");

			const canDecode = await videoTrack.canDecode();
			if (!canDecode) return;

			const sink = new CanvasSink(videoTrack, {
				poolSize: 6,
				fit: "contain",
			});

			this.sinks.set(mediaId, {
				sink,
				iterator: null,
				currentFrame: null,
				frameIndex: 0,
			});
		} catch (error) {
			console.error(`Failed to initialize video sink for ${mediaId}:`, error);
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
		this.initPromises.delete(mediaId);
	}

	clearAll(): void {
		for (const mediaId of Array.from(this.sinks.keys())) {
			this.clearVideo({ mediaId });
		}
	}

	getStats() {
		return {
			totalSinks: this.sinks.size,
		};
	}
}

export const videoCache = new VideoCache();
