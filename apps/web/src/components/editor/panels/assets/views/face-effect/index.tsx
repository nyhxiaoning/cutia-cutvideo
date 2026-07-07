"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
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
import type { FaceEffectParams } from "@/types/face-effect";
import { DEFAULT_FACE_EFFECT_PARAMS } from "@/types/face-effect";

export function FaceEffectView() {
	const editor = useEditor();
	const renderer = useMemo(() => new FaceEffectRenderer(), []);
	const [image, setImage] = useState<HTMLImageElement | null>(null);
	const [faceResultCache, setFaceResultCache] =
		useState<{ landmarks: Array<{ x: number; y: number; z?: number }>; imageWidth: number; imageHeight: number } | null>(null);
	const [isDetecting, setIsDetecting] = useState(false);
	const [isProcessing, setIsProcessing] = useState(false);
	const [isLandmarkerLoading, setIsLandmarkerLoading] = useState(false);
	const [processedCanvas, setProcessedCanvas] = useState<HTMLCanvasElement | null>(null);
	const [params, setParams] = useState<FaceEffectParams>(DEFAULT_FACE_EFFECT_PARAMS);

	const faceResultRef = useRef(faceResultCache);
	faceResultRef.current = faceResultCache;

	const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

	useEffect(() => {
		if (!isFaceLandmarkerReady()) {
			setIsLandmarkerLoading(true);
			loadFaceLandmarker()
				.then(() => setIsLandmarkerLoading(false))
				.catch(() => setIsLandmarkerLoading(false));
		}
	}, []);

	const handleImageLoaded = useCallback(async (img: HTMLImageElement) => {
		setImage(img);
		setProcessedCanvas(null);
		setFaceResultCache(null);
		setIsDetecting(true);

		const result = await detectFace(img);
		setFaceResultCache(result ? {
			landmarks: result.landmarks,
			imageWidth: result.imageWidth,
			imageHeight: result.imageHeight,
		} : null);
		setIsDetecting(false);
	}, []);

	const processEffect = useCallback((currentParams: FaceEffectParams) => {
		const cached = faceResultRef.current;
		if (!image || !cached) return;
		if (currentParams.enabledEffects.length === 0) {
			setProcessedCanvas(null);
			return;
		}

		setTimeout(() => {
			try {
				const canvas = document.createElement("canvas");
				renderer.process({
					source: image,
					landmarks: cached,
					params: currentParams,
					outputCanvas: canvas,
				});
				setProcessedCanvas(canvas);
			} catch {
				setProcessedCanvas(null);
			} finally {
				setIsProcessing(false);
			}
		}, 0);
	}, [image, renderer]);

	const handleParamsChange = useCallback((newParams: FaceEffectParams) => {
		setParams(newParams);

		if (debounceRef.current) {
			clearTimeout(debounceRef.current);
		}

		debounceRef.current = setTimeout(() => {
			setIsProcessing(true);
			processEffect(newParams);
		}, 200);
	}, [processEffect]);

	useEffect(() => {
		return () => {
			if (debounceRef.current) clearTimeout(debounceRef.current);
		};
	}, []);

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

			const url = URL.createObjectURL(blob);
			const mediaId = await editor.media.addMediaAsset({
				projectId: activeProject.metadata.id,
				asset: {
					file: new File([blob], "face-effect.png", { type: "image/png" }),
					name: "Face Effect",
					type: "image",
					url,
					thumbnailUrl: url,
					duration: 5,
				},
			});

			editor.timeline.insertElement({
				element: {
					type: "image",
					mediaId,
					name: "Face Effect",
					duration: 5,
					startTime: editor.playback.getCurrentTime(),
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
			<OpenInEditor source="src/components/editor/panels/assets/views/face-effect/index.tsx" line={1} />
			<BaseView>
				<FaceEffectUpload onImageLoaded={handleImageLoaded} isLoading={isLandmarkerLoading} />

				<FaceEffectPreview
					image={image}
					faceResult={faceResultCache}
					isDetecting={isDetecting}
					processedCanvas={processedCanvas}
					showOriginal={params.enabledEffects.length === 0}
				/>

				{isLandmarkerLoading && (
					<div className="flex items-center justify-center gap-2 px-4 pt-2">
						<div className="bg-primary/20 size-2 animate-pulse rounded-full" />
						<span className="text-muted-foreground text-[10px]">Loading face detection model...</span>
					</div>
				)}

				{isProcessing && (
					<div className="flex items-center justify-center gap-2 px-4 pt-2">
						<div className="bg-primary/20 size-2 animate-pulse rounded-full" />
						<span className="text-muted-foreground text-[10px]">Processing effect...</span>
					</div>
				)}

				{image && (
					<>
						<div className="px-4 pt-3 pb-1"><Separator /></div>
						<FaceEffectControls
							params={params}
							faceDetected={faceResultCache !== null}
							hasImage={image !== null}
							onParamsChange={handleParamsChange}
						/>
					</>
				)}

				{processedCanvas && (
					<div className="flex gap-2 px-4 pb-4">
						<Button type="button" variant="default" size="sm" className="flex-1 text-xs" onClick={handleApplyToTimeline}>
							Apply to Timeline
						</Button>
						<Button type="button" variant="outline" size="sm" className="flex-1 text-xs" onClick={handleExport}>
							Export Image
						</Button>
					</div>
				)}
			</BaseView>
		</div>
	);
}
