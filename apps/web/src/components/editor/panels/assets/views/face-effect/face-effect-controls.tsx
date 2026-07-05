"use client";

import { Slider } from "@/components/ui/slider";
import { ColorPicker } from "@/components/ui/color-picker";
import { Toggle } from "@/components/ui/toggle";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import type { FaceEffectType, FaceEffectParams } from "@/types/face-effect";

interface FaceEffectControlsProps {
	params: FaceEffectParams;
	faceDetected: boolean;
	hasImage: boolean;
	onParamsChange: (params: FaceEffectParams) => void;
}

interface EffectDef {
	key: FaceEffectType;
	label: string;
	desc: string;
}

const WARP_EFFECTS: EffectDef[] = [
	{ key: "big-head", label: "大头", desc: "整个头部放大，五官等比例缩放" },
	{ key: "left-cheek", label: "左脸颊", desc: "左侧脸颊向外扩展" },
	{ key: "right-cheek", label: "右脸颊", desc: "右侧脸颊向外扩展" },
	{ key: "eyes", label: "眼睛", desc: "双眼放大，眉毛微微上提" },
	{ key: "nose", label: "鼻子", desc: "鼻子区域放大" },
	{ key: "mouth", label: "嘴巴", desc: "嘴唇区域放大" },
];

const EFFECT_GLOW: EffectDef = { key: "glow", label: "发光", desc: "面部边缘发光效果" };

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

	const isActive = (key: FaceEffectType) => params.enabledEffects.includes(key);

	return (
		<div className="flex flex-col gap-3 px-4 pb-4">
			<span className="text-muted-foreground text-xs font-medium">面部区域变形</span>

			<div className="grid grid-cols-2 gap-2">
				{WARP_EFFECTS.map((eff) => (
					<div key={eff.key} className="flex flex-col gap-1">
						<Toggle
							pressed={isActive(eff.key)}
							onPressedChange={() => toggleEffect(eff.key)}
							disabled={!faceDetected || !hasImage}
							variant="outline"
							size="sm"
							className="text-[11px]"
							title={eff.desc}
						>
							{eff.label}
						</Toggle>
						{isActive(eff.key) && (() => {
							const keyMap: Record<string, keyof FaceEffectParams> = {
								"big-head": "bigHeadIntensity",
								"left-cheek": "leftCheekIntensity",
								"right-cheek": "rightCheekIntensity",
								eyes: "eyesIntensity",
								nose: "noseIntensity",
								mouth: "mouthIntensity",
							};
							const pKey = keyMap[eff.key];
							const val = params[pKey] as number;
							return (
								<Slider
									value={[val]}
									min={0}
									max={1}
									step={0.01}
									onValueChange={([v]) => updateParam(pKey as keyof FaceEffectParams, v)}
									className="h-1"
								/>
							);
						})()}
					</div>
				))}
			</div>

			{/* Glow */}
			<div className="pt-2">
				<Separator className="mb-3" />
				<span className="text-muted-foreground text-xs font-medium">发光特效</span>
				<div className="mt-2">
					<Toggle
						pressed={isActive("glow")}
						onPressedChange={() => toggleEffect("glow")}
						disabled={!faceDetected || !hasImage}
						variant="outline"
						size="sm"
						className="text-[11px]"
					>
						{EFFECT_GLOW.label}
					</Toggle>
				</div>
				{isActive("glow") && (
					<div className="mt-2 flex flex-col gap-3">
						<div className="flex flex-col gap-1.5">
							<Label className="text-muted-foreground text-[11px]">发光颜色</Label>
							<ColorPicker
								value={params.glowColor}
								onChange={(color) => updateParam("glowColor", color)}
							/>
						</div>
						<div className="flex items-center justify-between">
							<Label className="text-muted-foreground text-[11px]">强度</Label>
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
						<div className="flex items-center justify-between">
							<Label className="text-muted-foreground text-[11px]">发光半径</Label>
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
				)}
			</div>
		</div>
	);
}
