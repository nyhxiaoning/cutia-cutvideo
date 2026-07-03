"use client";

import { useEffect, useRef, useState } from "react";
import type { FaceDetectResult } from "@/types/face-effect";

interface FaceEffectPreviewProps {
	image: HTMLImageElement | null;
	faceResult: FaceDetectResult | null;
	isDetecting: boolean;
	processedCanvas: HTMLCanvasElement | null;
	showOriginal: boolean;
}

export function FaceEffectPreview({
	image,
	faceResult,
	isDetecting,
	processedCanvas,
	showOriginal,
}: FaceEffectPreviewProps) {
	const containerRef = useRef<HTMLDivElement>(null);
	const outputCanvasRef = useRef<HTMLCanvasElement>(null);
	const [containerSize, setContainerSize] = useState({ width: 0, height: 0 });

	// Observe container size
	useEffect(() => {
		const container = containerRef.current;
		if (!container) return;

		const observer = new ResizeObserver((entries) => {
			for (const entry of entries) {
				setContainerSize({
					width: entry.contentRect.width,
					height: entry.contentRect.height,
				});
			}
		});

		observer.observe(container);
		return () => observer.disconnect();
	}, []);

	// Render processed canvas
	useEffect(() => {
		const canvas = outputCanvasRef.current;
		if (!canvas) return;

		const ctx = canvas.getContext("2d");
		if (!ctx) return;

		if (processedCanvas && !showOriginal) {
			// Draw processed result, fitting it within the container
			const scale = Math.min(
				containerSize.width / processedCanvas.width,
				containerSize.height / processedCanvas.height,
				1,
			);
			const dw = processedCanvas.width * scale;
			const dh = processedCanvas.height * scale;
			const dx = (containerSize.width - dw) / 2;
			const dy = (containerSize.height - dh) / 2;

			canvas.width = containerSize.width;
			canvas.height = containerSize.height;
			ctx.clearRect(0, 0, canvas.width, canvas.height);
			ctx.drawImage(processedCanvas, dx, dy, dw, dh);
		} else if (image) {
			const scale = Math.min(
				containerSize.width / image.naturalWidth,
				containerSize.height / image.naturalHeight,
				1,
			);
			const dw = image.naturalWidth * scale;
			const dh = image.naturalHeight * scale;
			const dx = (containerSize.width - dw) / 2;
			const dy = (containerSize.height - dh) / 2;

			canvas.width = containerSize.width;
			canvas.height = containerSize.height;
			ctx.clearRect(0, 0, canvas.width, canvas.height);
			ctx.drawImage(image, dx, dy, dw, dh);

			// Draw face landmark points if detected
			if (faceResult && faceResult.landmarks.length > 0) {
				ctx.fillStyle = "rgba(0, 255, 0, 0.6)";
				for (const lm of faceResult.landmarks) {
					ctx.beginPath();
					ctx.arc(
						dx + (lm.x / faceResult.imageWidth) * dw,
						dy + (lm.y / faceResult.imageHeight) * dh,
						1.5,
						0,
						Math.PI * 2,
					);
					ctx.fill();
				}
			}
		} else {
			canvas.width = containerSize.width;
			canvas.height = containerSize.height;
			ctx.clearRect(0, 0, canvas.width, canvas.height);
		}
	}, [processedCanvas, image, showOriginal, containerSize, faceResult]);

	const hasContent = image !== null;
	const showLandmarks = !processedCanvas || showOriginal;

	return (
		<div className="px-4 pt-3">
			<div className="flex items-center justify-between px-1 pb-1.5">
				<span className="text-muted-foreground text-xs font-medium">Preview</span>
				{isDetecting && (
					<span className="text-primary text-[10px] animate-pulse">
						Detecting face...
					</span>
				)}
				{faceResult && !isDetecting && (
					<span className="text-emerald-500 text-[10px]">
						Face detected
					</span>
				)}
				{!faceResult && !isDetecting && hasContent && (
					<span className="text-amber-500 text-[10px]">
						No face detected
					</span>
				)}
			</div>
			<div
				ref={containerRef}
				className="bg-muted/50 relative aspect-[4/3] w-full overflow-hidden rounded-lg"
			>
				{!hasContent && (
					<div className="text-muted-foreground/40 absolute inset-0 flex items-center justify-center text-xs">
						Upload an image to preview
					</div>
				)}
				<canvas
					ref={outputCanvasRef}
					className="size-full"
				/>
				{showLandmarks && faceResult && (
					<div className="absolute bottom-2 left-2 rounded bg-black/60 px-2 py-0.5 text-[10px] text-white/80">
						{faceResult.landmarks.length} landmarks
					</div>
				)}
			</div>
		</div>
	);
}
