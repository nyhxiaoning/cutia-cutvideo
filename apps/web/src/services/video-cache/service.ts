import {
	Input,
	ALL_FORMATS,
	BlobSource,
	CanvasSink,
	type WrappedCanvas,
} from "mediabunny";

const BUFFER_AHEAD_FRAMES = 8;

interface VideoSinkData {
	sink: CanvasSink;
	/** Sequential frame iterator, valid during forward playback */
	iterator: AsyncGenerator<WrappedCanvas, void, unknown> | null;
	/** Frame buffer for smooth playback — pre-decoded ahead frames */
	buffer: WrappedCanvas[];
	/** Timestamp of the last seek (used to detect forward vs backward access) */
	lastTimestamp: number;
}

export class VideoCache {
	private sinks = new Map<string, VideoSinkData>();
	private initPromises = new Map<string, Promise<void>>();
	/** Per-sink promise chain so fill requests never pile up uncoordinated */
	private fillChains = new Map<string, Promise<void>>();

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

		return this.getFrameFromSink({ sinkData, mediaId, time });
	}

	private async getFrameFromSink({
		sinkData,
		mediaId,
		time,
	}: {
		sinkData: VideoSinkData;
		mediaId: string;
		time: number;
	}): Promise<WrappedCanvas | null> {
		// Forward playback: consume from buffer
		if (sinkData.buffer.length > 0) {
			const first = sinkData.buffer[0];
			if (time >= first.timestamp - 0.01) {
				sinkData.lastTimestamp = first.timestamp;
				sinkData.buffer.shift();
				// Queue a background refill (guaranteed to run, never skipped)
				void this.queueFill({ sinkData, mediaId });
				return first;
			}

			// Backward jump: clear buffer, use fresh iterator
			return this.seekAndIterate({ sinkData, mediaId, time });
		}

		// Buffer empty: check if we're going forward
		if (time > sinkData.lastTimestamp) {
			return this.seekAndIterate({ sinkData, mediaId, time });
		}

		return this.seekToTime({ sinkData, mediaId, time });
	}

	/**
	 * Seek to time, then start filling the buffer for subsequent calls.
	 */
	private async seekAndIterate({
		sinkData,
		mediaId,
		time,
	}: {
		sinkData: VideoSinkData;
		mediaId: string;
		time: number;
	}): Promise<WrappedCanvas | null> {
		sinkData.buffer = [];
		if (sinkData.iterator) {
			try { await sinkData.iterator.return(); } catch { /* ignore */ }
			sinkData.iterator = null;
		}

		const frame = await this.seekToTime({ sinkData, mediaId, time });
		// fillBuffer already started in seekToTime; wait for enough buffer
		if (frame) {
			await this.waitForBuffer({ sinkData, mediaId });
		}
		return frame;
	}

	private async waitForBuffer({
		sinkData,
		mediaId,
	}: {
		sinkData: VideoSinkData;
		mediaId: string;
	}): Promise<void> {
		const chain = this.fillChains.get(mediaId);
		if (chain) {
			await chain;
		}
		// If still not enough buffer, fill more
		if (sinkData.buffer.length < BUFFER_AHEAD_FRAMES / 2) {
			await this.doFill({ sinkData });
		}
	}

	/**
	 * Queue a single fill — always runs, never skipped.
	 * Multiple rapid calls chain behind each other, each adding one frame.
	 */
	private queueFill({
		sinkData,
		mediaId,
	}: {
		sinkData: VideoSinkData;
		mediaId: string;
	}): void {
		const prev = this.fillChains.get(mediaId) ?? Promise.resolve();
		const next = prev
			.then(() => this.doFill({ sinkData }))
			.catch(() => { /* ignore fill errors */ });
		this.fillChains.set(mediaId, next);
	}

	private async doFill({
		sinkData,
	}: {
		sinkData: VideoSinkData;
	}): Promise<void> {
		if (!sinkData.iterator) {
			const start =
				sinkData.buffer.length > 0
					? sinkData.buffer[sinkData.buffer.length - 1].timestamp
					: sinkData.lastTimestamp;
			sinkData.iterator = sinkData.sink.canvases(start);
		}

		try {
			const result = await sinkData.iterator.next();
			if (result.done || !result.value) {
				sinkData.iterator = null;
				return;
			}
			sinkData.buffer.push(result.value);
		} catch {
			sinkData.iterator = null;
		}
	}

	private async seekToTime({
		sinkData,
		mediaId,
		time,
	}: {
		sinkData: VideoSinkData;
		mediaId: string;
		time: number;
	}): Promise<WrappedCanvas | null> {
		try {
			const frame = await sinkData.sink.getCanvas(time);
			if (frame) {
				sinkData.buffer = [];
				sinkData.iterator = null;
				sinkData.lastTimestamp = frame.timestamp;
				// Fill initial batch in background
				void this.queueFill({ sinkData, mediaId });
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
				buffer: [],
				lastTimestamp: -1,
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
		this.fillChains.delete(mediaId);
	}

	clearAll(): void {
		for (const mediaId of Array.from(this.sinks.keys())) {
			this.clearVideo({ mediaId });
		}
	}
}

export const videoCache = new VideoCache();
