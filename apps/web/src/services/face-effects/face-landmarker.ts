import type { FaceDetectResult, FaceLandmarkPoint } from "@/types/face-effect";

type FaceLandmarkerInstance = {
	detect: (image: HTMLVideoElement | HTMLImageElement | HTMLCanvasElement) => {
		faceLandmarks: Array<Array<{ x: number; y: number; z: number }>>;
	};
};

let faceLandmarkerInstance: FaceLandmarkerInstance | null = null;
let loadPromise: Promise<void> | null = null;
const readyCallbacks: Array<() => void> = [];

function notifyReady(): void {
	for (const cb of readyCallbacks) {
		cb();
	}
	readyCallbacks.length = 0;
}

export async function loadFaceLandmarker(): Promise<void> {
	if (faceLandmarkerInstance) return;
	if (loadPromise) return loadPromise;

	loadPromise = (async () => {
		try {
			const { FilesetResolver, FaceLandmarker } = await import(
				"@mediapipe/tasks-vision"
			);

			const vision = await FilesetResolver.forVisionTasks(
				"https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.35/wasm",
			);

			faceLandmarkerInstance = await FaceLandmarker.createFromOptions(vision, {
				baseOptions: {
					modelAssetPath:
						"https://storage.googleapis.com/mediapipe-models/face_landmarker/face_landmarker/float16/1/face_landmarker.task",
					delegate: "GPU",
				},
				runningMode: "IMAGE",
				numFaces: 1,
				outputFaceBlendshapes: false,
				outputFacialTransformationMatrixes: false,
			});

			notifyReady();
		} catch (error) {
			loadPromise = null;
			throw error;
		}
	})();

	return loadPromise;
}

export function isFaceLandmarkerReady(): boolean {
	return faceLandmarkerInstance !== null;
}

export function onFaceLandmarkerReady(callback: () => void): void {
	if (faceLandmarkerInstance) {
		callback();
	} else {
		readyCallbacks.push(callback);
	}
}

export async function detectFace(
	source: HTMLImageElement | HTMLCanvasElement | HTMLVideoElement,
): Promise<FaceDetectResult | null> {
	if (!faceLandmarkerInstance) {
		try {
			await loadFaceLandmarker();
		} catch {
			return null;
		}
		if (!faceLandmarkerInstance) return null;
	}

	try {
		// Ensure image is fully loaded
		if (source instanceof HTMLImageElement) {
			if (!source.complete || source.naturalWidth === 0) {
				await new Promise<void>((resolve) => {
					source.onload = () => resolve();
					source.onerror = () => resolve();
				});
			}
		}

		const result = faceLandmarkerInstance.detect(source);

		if (!result || !result.faceLandmarks || result.faceLandmarks.length === 0) {
			return null;
		}

		const landmarks: FaceLandmarkPoint[] = result.faceLandmarks[0].map(
			(landmark) => ({
				x: landmark.x,
				y: landmark.y,
				z: landmark.z,
			}),
		);

		return {
			landmarks,
			imageWidth: "width" in source ? (source.width || 0) : ((source as HTMLImageElement).naturalWidth || 0),
			imageHeight: "height" in source ? (source.height || 0) : ((source as HTMLImageElement).naturalHeight || 0),
		};
	} catch {
		return null;
	}
}

export interface FaceDetectionCallbacks {
	onLoadStart?: () => void;
	onLoadComplete?: () => void;
	onLoadError?: (error: Error) => void;
	onDetectStart?: () => void;
	onDetectComplete?: (result: FaceDetectResult | null) => void;
	onDetectError?: (error: Error) => void;
}

export async function detectFaceWithCallbacks(
	source: HTMLImageElement | HTMLCanvasElement | HTMLVideoElement,
	callbacks?: FaceDetectionCallbacks,
): Promise<FaceDetectResult | null> {
	try {
		callbacks?.onDetectStart?.();
		const result = await detectFace(source);
		callbacks?.onDetectComplete?.(result);
		return result;
	} catch (error) {
		callbacks?.onDetectError?.(error instanceof Error ? error : new Error(String(error)));
		return null;
	}
}
