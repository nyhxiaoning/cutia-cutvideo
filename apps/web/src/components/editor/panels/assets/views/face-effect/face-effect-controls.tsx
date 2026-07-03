"use client";

import { Slider } from "@/components/ui/slider";
import { ColorPicker } from "@/components/ui/color-picker";
import { Toggle } from "@/components/ui/toggle";
import { Label } from "@/components/ui/label";
import type { FaceEffectType, FaceEffectParams } from "@/types/face-effect";

interface FaceEffectControlsProps {
	params: FaceEffectParams;
	faceDetected: boolean;
	hasImage: boolean;
	onParamsChange: (params: FaceEffectParams) => void;
}

export function FaceEffectControls({
	params,
	faceDetected,
	hasImage,
	onParamsChange,
}: FaceEffectControlsProps) {
	const toggleEffect = (effect: FaceEffectType) => {
		const enabled = params.enabledEffects.includes(effect);
		const newEffects = enabled
			? params.enabledEffects.filter((e) => e !== effect)
			: [...params.enabledEffects, effect];
		onParamsChange({ ...params, enabledEffects: newEffects });
	};

	const updateParam = <K extends keyof FaceEffectParams>(
		key: K,
		value: FaceEffectParams[K],
	) => {
		onParamsChange({ ...params, [key]: value });
	};

	const isBigHeadOn = params.enabledEffects.includes("big-head");
	const isBigFaceOn = params.enabledEffects.includes("big-face");
	const isGlowOn = params.enabledEffects.includes("glow");

	return (
		<div className="flex flex-col gap-4 px-4 pb-4">
			{/* Effect toggle buttons */}
			<div className="flex flex-col gap-2">
				<span className="text-muted-foreground text-xs font-medium">Effects</span>
				<div className="flex gap-2">
					<Toggle
						pressed={isBigHeadOn}
						onPressedChange={() => toggleEffect("big-head")}
						disabled={!faceDetected || !hasImage}
						className="flex-1 text-xs"
					>
						Big Head
					</Toggle>
					<Toggle
						pressed={isBigFaceOn}
						onPressedChange={() => toggleEffect("big-face")}
						disabled={!faceDetected || !hasImage}
						className="flex-1 text-xs"
					>
						Big Face
					</Toggle>
					<Toggle
						pressed={isGlowOn}
						onPressedChange={() => toggleEffect("glow")}
						disabled={!faceDetected || !hasImage}
						className="flex-1 text-xs"
					>
						Glow
					</Toggle>
				</div>
			</div>

			{/* Big Head slider */}
			{isBigHeadOn && (
				<div className="flex flex-col gap-1.5">
					<div className="flex items-center justify-between">
						<Label className="text-muted-foreground text-[11px]">
							Head Size
						</Label>
						<span className="text-muted-foreground text-[11px] tabular-nums">
							{Math.round(params.bigHeadIntensity * 100)}%
						</span>
					</div>
					<Slider
						value={[params.bigHeadIntensity]}
						min={0}
						max={1}
						step={0.01}
						onValueChange={([v]) => updateParam("bigHeadIntensity", v)}
					/>
				</div>
			)}

			{/* Big Face slider */}
			{isBigFaceOn && (
				<div className="flex flex-col gap-1.5">
					<div className="flex items-center justify-between">
						<Label className="text-muted-foreground text-[11px]">
							Face Width
						</Label>
						<span className="text-muted-foreground text-[11px] tabular-nums">
							{Math.round(params.bigFaceIntensity * 100)}%
						</span>
					</div>
					<Slider
						value={[params.bigFaceIntensity]}
						min={0}
						max={1}
						step={0.01}
						onValueChange={([v]) => updateParam("bigFaceIntensity", v)}
					/>
				</div>
			)}

			{/* Glow controls */}
			{isGlowOn && (
				<>
					<div className="flex flex-col gap-1.5">
						<div className="flex items-center justify-between">
							<Label className="text-muted-foreground text-[11px]">
								Glow Color
							</Label>
						</div>
						<ColorPicker
							value={params.glowColor}
							onChange={(color) => updateParam("glowColor", color)}
						/>
					</div>
					<div className="flex flex-col gap-1.5">
						<div className="flex items-center justify-between">
							<Label className="text-muted-foreground text-[11px]">
								Glow Intensity
							</Label>
							<span className="text-muted-foreground text-[11px] tabular-nums">
								{Math.round(params.glowIntensity * 100)}%
							</span>
						</div>
						<Slider
							value={[params.glowIntensity]}
							min={0}
							max={1}
							step={0.01}
							onValueChange={([v]) => updateParam("glowIntensity", v)}
						/>
					</div>
					<div className="flex flex-col gap-1.5">
						<div className="flex items-center justify-between">
							<Label className="text-muted-foreground text-[11px]">
								Glow Radius
							</Label>
							<span className="text-muted-foreground text-[11px] tabular-nums">
								{params.glowRadius}px
							</span>
						</div>
						<Slider
							value={[params.glowRadius]}
							min={5}
							max={80}
							step={1}
							onValueChange={([v]) => updateParam("glowRadius", v)}
						/>
					</div>
				</>
			)}
		</div>
	);
}
