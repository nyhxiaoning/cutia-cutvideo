import type { FaceDetectResult, FaceLandmarkPoint } from "@/types/face-effect";

type FaceLandmarkerInstance = {
	detect: (image: HTMLVideoElement | HTMLImageElement | HTMLCanvasElement) => {
		faceLandmarks: Array<Array<{ x: number; y: number; z: number }>>;
	};
};

let faceLandmarkerInstance: FaceLandmarkerInstance | null = null;
let isLoaded = false;
let isLoading = false;
let loadPromise: Promise<void> | null = null;
const readyCallbacks: Array<() => void> = [];

function notifyReady(): void {
	isLoaded = true;
	for (const cb of readyCallbacks) {
		cb();
	}
	readyCallbacks.length = 0;
}

export async function loadFaceLandmarker(): Promise<void> {
	if (isLoaded) return;
	if (isLoading && loadPromise) return loadPromise;

	isLoading = true;

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
			isLoaded = false;
			isLoading = false;
			loadPromise = null;
			throw error;
		} finally {
			isLoading = false;
		}
	})();

	return loadPromise;
}

export function isFaceLandmarkerReady(): boolean {
	return isLoaded;
}

export function onFaceLandmarkerReady(callback: () => void): void {
	if (isLoaded) {
		callback();
	} else {
		readyCallbacks.push(callback);
	}
}

export async function detectFace(
	source: HTMLImageElement | HTMLCanvasElement | HTMLVideoElement,
): Promise<FaceDetectResult | null> {
	if (!isLoaded) {
		await loadFaceLandmarker();
	}

	if (!faceLandmarkerInstance) {
		return null;
	}

	try {
		const result = faceLandmarkerInstance.detect(source);

		if (!result.faceLandmarks || result.faceLandmarks.length === 0) {
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
			imageWidth: source.width || source.naturalWidth || 0,
			imageHeight: source.height || source.naturalHeight || 0,
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
