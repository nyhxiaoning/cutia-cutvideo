"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useEditor } from "@/hooks/use-editor";
import { toast } from "sonner";
import { PanelBaseView as BaseView } from "@/components/editor/panels/panel-base-view";
import { Separator } from "@/components/ui/separator";
import { Button } from "@/components/ui/button";
import { OpenInEditor } from "@/components/dev/open-in-editor";
import { FaceEffectUpload } from "./face-effect-upload";
import { FaceEffectPreview } from "./face-effect-preview";
import { FaceEffectControls } from "./face-effect-controls";
import {
	loadFaceLandmarker,
	isFaceLandmarkerReady,
	detectFace,
	FaceEffectRenderer,
} from "@/services/face-effects";
import type {
	FaceDetectResult,
	FaceEffectParams,
} from "@/types/face-effect";
import { DEFAULT_FACE_EFFECT_PARAMS } from "@/types/face-effect";

export function FaceEffectView() {
	const editor = useEditor();
	const [renderer] = useState(() => new FaceEffectRenderer());
	const [image, setImage] = useState<HTMLImageElement | null>(null);
	const [faceResult, setFaceResult] = useState<FaceDetectResult | null>(null);
	const [isDetecting, setIsDetecting] = useState(false);
	const [isProcessing, setIsProcessing] = useState(false);
	const [isLandmarkerLoading, setIsLandmarkerLoading] = useState(false);
	const [processedCanvas, setProcessedCanvas] = useState<HTMLCanvasElement | null>(null);
	const [params, setParams] = useState<FaceEffectParams>(DEFAULT_FACE_EFFECT_PARAMS);

	const processingRef = useRef(false);
	const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

	// Load FaceLandmarker on mount
	useEffect(() => {
		if (!isFaceLandmarkerReady()) {
			setIsLandmarkerLoading(true);
			loadFaceLandmarker()
				.then(() => {
					setIsLandmarkerLoading(false);
				})
				.catch((err: Error) => {
					setIsLandmarkerLoading(false);
					toast.error("Failed to load face detection model. Please refresh and try again.", {
						description: err.message,
					});
				});
		}
	}, []);

	// Handle image uploaded
	const handleImageLoaded = useCallback(
		async (img: HTMLImageElement) => {
			setImage(img);
			setProcessedCanvas(null);
			setFaceResult(null);
			setIsDetecting(true);

			try {
				const result = await detectFace(img);
				setFaceResult(result);
				setIsDetecting(false);
			} catch {
				setFaceResult(null);
				setIsDetecting(false);
			}
		},
		[],
	);

	// Process when params or face result changes
	const processEffect = useCallback(
		(currentParams: FaceEffectParams) => {
			if (!image || !faceResult || processingRef.current) return;
			if (currentParams.enabledEffects.length === 0) {
				setProcessedCanvas(null);
				return;
			}

			processingRef.current = true;
			setIsProcessing(true);

			// Use requestAnimationFrame to avoid blocking UI
			requestAnimationFrame(() => {
				try {
					const canvas = document.createElement("canvas");
					renderer.process({
						source: image,
						landmarks: faceResult,
						params: currentParams,
						outputCanvas: canvas,
					});
					setProcessedCanvas(canvas);
				} catch {
					setProcessedCanvas(null);
				} finally {
					processingRef.current = false;
					setIsProcessing(false);
				}
			});
		},
		[image, faceResult, renderer],
	);

	// Debounced effect processing
	const handleParamsChange = useCallback(
		(newParams: FaceEffectParams) => {
			setParams(newParams);

			if (debounceRef.current) {
				clearTimeout(debounceRef.current);
			}

			debounceRef.current = setTimeout(() => {
				processEffect(newParams);
			}, 150);
		},
		[processEffect],
	);

	// Cleanup debounce
	useEffect(() => {
		return () => {
			if (debounceRef.current) {
				clearTimeout(debounceRef.current);
			}
		};
	}, []);

	// Handle apply to timeline
	const handleApplyToTimeline = useCallback(async () => {
		const canvas = processedCanvas;
		if (!canvas) return;

		const activeProject = editor.project.getActive();
		if (!activeProject) {
			toast.error("No active project");
			return;
		}

		try {
			const blob = await new Promise<Blob | null>((resolve) =>
				canvas.toBlob(resolve, "image/png"),
			);
			if (!blob) throw new Error("Failed to create image blob");

			const file = new File([blob], "face-effect.png", { type: "image/png" });
			const url = URL.createObjectURL(blob);
			const mediaId = await editor.media.addMediaAsset({
				projectId: activeProject.metadata.id,
				asset: {
					file,
					name: "Face Effect",
					type: "image",
					url,
					thumbnailUrl: url,
					duration: 5,
				},
			});

			const playheadTime = editor.playback.getCurrentTime();

			editor.timeline.insertElement({
				element: {
					type: "image",
					mediaId,
					name: "Face Effect",
					duration: 5,
					startTime: playheadTime,
					trimStart: 0,
					trimEnd: 5,
					transform: { scale: 1, position: { x: 0, y: 0 }, rotate: 0 },
					opacity: 1,
				},
				placement: { mode: "auto", trackType: "video" },
			});

			toast.success("Applied to timeline");
		} catch (error) {
			toast.error("Failed to apply to timeline", {
				description: error instanceof Error ? error.message : undefined,
			});
		}
	}, [processedCanvas, editor]);

	// Handle export
	const handleExport = useCallback(() => {
		const canvas = processedCanvas;
		if (!canvas) return;

		canvas.toBlob((blob) => {
			if (!blob) return;
			const url = URL.createObjectURL(blob);
			const a = document.createElement("a");
			a.href = url;
			a.download = "cutia-face-effect.png";
			a.click();
			URL.revokeObjectURL(url);
		});
	}, [processedCanvas]);

	return (
		<div className="group relative flex h-full flex-col overflow-y-auto">
			<OpenInEditor source="src/components/editor/panels/assets/views/face-effect/index.tsx" line={90} />
			<BaseView>
				{/* Upload */}
				<FaceEffectUpload onImageLoaded={handleImageLoaded} isLoading={isLandmarkerLoading} />

				{/* Preview */}
				<FaceEffectPreview
					image={image}
					faceResult={faceResult}
					isDetecting={isDetecting}
					processedCanvas={processedCanvas}
					showOriginal={params.enabledEffects.length === 0}
				/>

				{/* Model loading indicator */}
				{isLandmarkerLoading && (
					<div className="flex items-center justify-center gap-2 px-4 pt-2">
						<div className="bg-primary/20 size-2 animate-pulse rounded-full" />
						<span className="text-muted-foreground text-[10px]">
							Loading face detection model...
						</span>
					</div>
				)}

				{/* Processing indicator */}
				{isProcessing && (
					<div className="flex items-center justify-center gap-2 px-4 pt-2">
						<div className="bg-primary/20 size-2 animate-pulse rounded-full" />
						<span className="text-muted-foreground text-[10px]">
							Processing effect...
						</span>
					</div>
				)}

				{/* Controls */}
				{image && (
					<>
						<div className="px-4 pt-3 pb-1">
							<Separator />
						</div>
						<FaceEffectControls
							params={params}
							faceDetected={faceResult !== null}
							hasImage={image !== null}
							onParamsChange={handleParamsChange}
						/>
					</>
				)}

				{/* Action buttons */}
				{processedCanvas && (
					<div className="flex gap-2 px-4 pb-4">
						<Button
							type="button"
							variant="default"
							size="sm"
							className="flex-1 text-xs"
							onClick={handleApplyToTimeline}
						>
							Apply to Timeline
						</Button>
						<Button
							type="button"
							variant="outline"
							size="sm"
							className="flex-1 text-xs"
							onClick={handleExport}
						>
							Export Image
						</Button>
					</div>
				)}
			</BaseView>
		</div>
	);
}
