"use client";

import { useCallback, useRef, useState } from "react";
import { cn } from "@/utils/ui";
import { Upload04Icon } from "@hugeicons/core-free-icons";
import { HugeiconsIcon } from "@hugeicons/react";

interface FaceEffectUploadProps {
	onImageLoaded: (image: HTMLImageElement) => void;
	isLoading: boolean;
}

export function FaceEffectUpload({ onImageLoaded, isLoading }: FaceEffectUploadProps) {
	const [isDragOver, setIsDragOver] = useState(false);
	const fileInputRef = useRef<HTMLInputElement>(null);

	const handleFile = useCallback(
		(file: File) => {
			if (!file.type.startsWith("image/")) return;

			const img = new Image();
			img.crossOrigin = "anonymous";
			img.onload = () => {
				onImageLoaded(img);
			};
			img.src = URL.createObjectURL(file);
		},
		[onImageLoaded],
	);

	const handleDrop = useCallback(
		(e: React.DragEvent) => {
			e.preventDefault();
			setIsDragOver(false);
			const file = e.dataTransfer.files[0];
			if (file) handleFile(file);
		},
		[handleFile],
	);

	const handleDragOver = useCallback((e: React.DragEvent) => {
		e.preventDefault();
		setIsDragOver(true);
	}, []);

	const handleDragLeave = useCallback(() => {
		setIsDragOver(false);
	}, []);

	const handleClick = useCallback(() => {
		fileInputRef.current?.click();
	}, []);

	const handleFileChange = useCallback(
		(e: React.ChangeEvent<HTMLInputElement>) => {
			const file = e.target.files?.[0];
			if (file) handleFile(file);
		},
		[handleFile],
	);

	return (
		<div className="px-4 pt-4">
			<button
				type="button"
				disabled={isLoading}
				onClick={handleClick}
				onDrop={handleDrop}
				onDragOver={handleDragOver}
				onDragLeave={handleDragLeave}
				className={cn(
					"bg-muted hover:bg-accent flex w-full cursor-pointer flex-col items-center gap-2 rounded-lg border-2 border-dashed p-6 transition-colors",
					isDragOver && "border-primary bg-primary/5",
					isLoading && "cursor-not-allowed opacity-50",
				)}
			>
				<HugeiconsIcon icon={Upload04Icon} className="text-muted-foreground size-8" />
				<span className="text-muted-foreground text-xs font-medium">
					{isLoading ? "Loading..." : "Drop image here or click to upload"}
				</span>
				<span className="text-muted-foreground/60 text-[10px]">
					Supports JPG, PNG, WebP
				</span>
			</button>
			<input
				ref={fileInputRef}
				type="file"
				accept="image/*"
				className="hidden"
				onChange={handleFileChange}
			/>
		</div>
	);
}
