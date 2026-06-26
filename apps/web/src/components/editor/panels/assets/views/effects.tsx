"use client";

import { useTranslation } from "@i18next-toolkit/nextjs-approuter";
import { useState, useCallback } from "react";
import { toast } from "sonner";
import { PanelBaseView as BaseView } from "@/components/editor/panels/panel-base-view";
import { useEditor } from "@/hooks/use-editor";
import { useElementSelection } from "@/hooks/timeline/element/use-element-selection";
import { cn } from "@/utils/ui";
import { OpenInEditor } from "@/components/dev/open-in-editor";
import type { CSSProperties } from "react";

interface EffectPreset {
	name: string;
	filter: string;
	previewColor: string;
	description: string;
	descriptionZh: string;
	category: "color" | "blur" | "artistic" | "lighting" | "animal" | "landscape" | "overlay" | "advanced";
}

const OVERLAY_PRESETS_DATA = [
	{ name: "Rain", filter: "__overlay__rain", previewColor: "#4a6fa5", description: "Rainfall effect", descriptionZh: "下雨效果", overlayType: "rain" as const, density: 200, speed: 8, opacity: 0.5, wind: 2 },
	{ name: "Heavy Rain", filter: "__overlay__heavy-rain", previewColor: "#2a4a7a", description: "Heavy downpour", descriptionZh: "暴雨效果", overlayType: "rain" as const, density: 400, speed: 10, opacity: 0.6, wind: 3 },
	{ name: "Light Rain", filter: "__overlay__light-rain", previewColor: "#8aafd5", description: "Light drizzle", descriptionZh: "细雨效果", overlayType: "rain" as const, density: 80, speed: 5, opacity: 0.3, wind: 1 },
	{ name: "Snow", filter: "__overlay__snow", previewColor: "#e8e8f0", description: "Gentle snowfall", descriptionZh: "下雪效果", overlayType: "snow" as const, density: 100, speed: 2, opacity: 0.7 },
	{ name: "Blizzard", filter: "__overlay__blizzard", previewColor: "#c0c0d0", description: "Heavy blizzard", descriptionZh: "暴风雪效果", overlayType: "snow" as const, density: 300, speed: 4, opacity: 0.8, wind: 3 },
	{ name: "Light Snow", filter: "__overlay__light-snow", previewColor: "#f5f5ff", description: "Light flurries", descriptionZh: "小雪效果", overlayType: "snow" as const, density: 40, speed: 1, opacity: 0.5 },
	{ name: "Sparkle", filter: "__overlay__sparkle", previewColor: "#ffd700", description: "Magical sparkle particles", descriptionZh: "闪光粒子效果", overlayType: "sparkle" as const, density: 50, speed: 1, opacity: 0.8 },
	{ name: "Fire", filter: "__overlay__fire", previewColor: "#ff4500", description: "Rising flame effect", descriptionZh: "火焰燃烧效果", overlayType: "fire" as const, density: 60, speed: 3, opacity: 0.7, wind: 1 },
	{ name: "Smoke", filter: "__overlay__smoke", previewColor: "#888888", description: "Rising smoke effect", descriptionZh: "烟雾缭绕效果", overlayType: "smoke" as const, density: 30, speed: 1.5, opacity: 0.4, wind: 0.5 },
	{ name: "Fireflies", filter: "__overlay__fireflies", previewColor: "#7cfc00", description: "Floating firefly glow", descriptionZh: "萤火虫飞舞效果", overlayType: "firefly" as const, density: 25, speed: 0.5, opacity: 0.9 },
	{ name: "Bubbles", filter: "__overlay__bubbles", previewColor: "#87ceeb", description: "Rising soap bubbles", descriptionZh: "气泡上升效果", overlayType: "bubble" as const, density: 20, speed: 1.5, opacity: 0.6, wind: 0.3 },
	{ name: "Confetti", filter: "__overlay__confetti", previewColor: "#ff69b4", description: "Falling confetti celebration", descriptionZh: "五彩纸屑庆祝效果", overlayType: "confetti" as const, density: 50, speed: 3, opacity: 0.9, wind: 2 },
	{ name: "Screen Shake", filter: "__overlay__shake", previewColor: "#333333", description: "Camera shake effect", descriptionZh: "屏幕抖动效果", overlayType: "shake" as const, density: 0, speed: 0, opacity: 1, intensity: 6 },
];

const ADVANCED_PRESETS: EffectPreset[] = [
	{ name: "Tyndall", filter: "brightness(115%) contrast(85%) saturate(130%) blur(0.3px) sepia(5%)", previewColor: "#c8a050", description: "Tyndall light beam effect, adds warm volumetric light", descriptionZh: "丁达尔效应，增强光束感与暖色调体积光", category: "advanced" },
	{ name: "Rhythm", filter: "brightness(110%) contrast(160%) saturate(120%)", previewColor: "#2a1a4a", description: "Rhythmic beat effect with pulsing high contrast", descriptionZh: "节奏律动效果，高对比脉冲感", category: "advanced" },
	{ name: "Pop Out", filter: "brightness(120%) contrast(140%) saturate(130%) drop-shadow(0 0 6px rgba(255,255,255,0.4))", previewColor: "#4a7ab8", description: "Pop-out effect that makes subject jump off screen", descriptionZh: "冲出屏幕效果，增强立体感和景深", category: "advanced" },
	{ name: "Focus Blur", filter: "brightness(100%) contrast(110%) saturate(90%) blur(2px)", previewColor: "#8a9aae", description: "Out-of-focus blur with soft desaturated look", descriptionZh: "焦点虚化效果，柔焦失焦朦胧感", category: "advanced" },
];

function isOverlayPreset(preset: EffectPreset): boolean {
	return preset.filter.startsWith("__overlay__");
}

const EFFECT_PRESETS: EffectPreset[] = [
	// Color adjustments
	{ name: "Grayscale", filter: "grayscale(100%)", previewColor: "#6b7280", description: "Full black and white", descriptionZh: "完全黑白去色效果", category: "color" },
	{ name: "Sepia", filter: "sepia(80%)", previewColor: "#a0764a", description: "Warm vintage tone", descriptionZh: "复古暖黄老照片风格", category: "color" },
	{ name: "Vintage", filter: "sepia(50%) contrast(110%) saturate(80%)", previewColor: "#8b6914", description: "Aged film look", descriptionZh: "陈旧胶片电影质感", category: "color" },
	{ name: "Cold", filter: "hue-rotate(180deg) saturate(70%)", previewColor: "#4a90d9", description: "Cool blue tone", descriptionZh: "冷色调蓝青氛围", category: "color" },
	{ name: "Warm", filter: "sepia(30%) hue-rotate(-15deg) saturate(130%)", previewColor: "#d4874a", description: "Warm golden tone", descriptionZh: "暖金色阳光色调", category: "color" },
	{ name: "Invert", filter: "invert(100%)", previewColor: "#1a1a2e", description: "Invert all colors", descriptionZh: "完全反相负片效果", category: "color" },

	// Blur effects
	{ name: "Blur", filter: "blur(3px)", previewColor: "#9ca3af", description: "Soft blur", descriptionZh: "柔和模糊虚化", category: "blur" },
	{ name: "Heavy Blur", filter: "blur(8px)", previewColor: "#d1d5db", description: "Strong blur", descriptionZh: "重度模糊效果", category: "blur" },
	{ name: "Mosaic", filter: "blur(12px)", previewColor: "#e5e7eb", description: "Heavy pixelation mosaic", descriptionZh: "高强度马赛克效果", category: "blur" },
	{ name: "Motion Blur", filter: "blur(1px) brightness(120%) contrast(80%)", previewColor: "#a3b1c6", description: "Fast motion feel", descriptionZh: "快速运动拖影感", category: "blur" },

	// Artistic
	{ name: "Drama", filter: "contrast(150%) brightness(80%) saturate(110%)", previewColor: "#2d1b4e", description: "High contrast dramatic look", descriptionZh: "高对比戏剧化风格", category: "artistic" },
	{ name: "Faded", filter: "brightness(110%) contrast(70%) saturate(50%)", previewColor: "#b8b8b8", description: "Washed out dreamy look", descriptionZh: "褪色朦胧梦幻感", category: "artistic" },
	{ name: "Noir", filter: "grayscale(100%) contrast(180%) brightness(80%)", previewColor: "#111111", description: "Film noir high contrast B&W", descriptionZh: "黑色电影高对比黑白", category: "artistic" },
	{ name: "Soft Glow", filter: "brightness(120%) contrast(85%) saturate(110%) blur(0.5px)", previewColor: "#f0e6d3", description: "Dreamy soft glow", descriptionZh: "柔和发光梦幻效果", category: "artistic" },
	{ name: "Glow", filter: "brightness(130%) saturate(130%) blur(0.5px)", previewColor: "#ffe4b5", description: "Warm soft glow bloom", descriptionZh: "柔光发光泛白效果", category: "artistic" },
	{ name: "Scanline", filter: "brightness(105%) contrast(110%)", previewColor: "#8a9ba8", description: "Old CRT TV monitor feel", descriptionZh: "老式CRT电视扫描线感", category: "artistic" },
	{ name: "Shake", filter: "contrast(120%) brightness(90%)", previewColor: "#4a3a3a", description: "Tension camera shake feel", descriptionZh: "紧张镜头抖动模拟感", category: "artistic" },

	// Lighting
	{ name: "Bright", filter: "brightness(150%)", previewColor: "#fff5cc", description: "Overexposed bright", descriptionZh: "过曝明亮高调", category: "lighting" },
	{ name: "Dark", filter: "brightness(40%) contrast(120%)", previewColor: "#1a1a1a", description: "Underexposed dark", descriptionZh: "欠曝阴暗低调", category: "lighting" },
	{ name: "High Contrast", filter: "contrast(200%) saturate(120%)", previewColor: "#2d2d2d", description: "Extreme contrast", descriptionZh: "极高对比度风格", category: "lighting" },
	{ name: "Saturated", filter: "saturate(300%)", previewColor: "#ff6b9d", description: "Vibrant oversaturated", descriptionZh: "鲜艳过饱和色彩", category: "lighting" },

	// Animal photography
	{ name: "Wildlife", filter: "contrast(125%) saturate(110%) brightness(105%)", previewColor: "#4a6741", description: "Natural wildlife enhancement", descriptionZh: "野生动物自然增强", category: "animal" },
	{ name: "Fur Detail", filter: "contrast(130%) brightness(95%) saturate(105%)", previewColor: "#8b6914", description: "Enhanced fur texture and detail", descriptionZh: "增强皮毛纹理细节", category: "animal" },
	{ name: "Forest Green", filter: "hue-rotate(-10deg) saturate(130%) contrast(110%)", previewColor: "#2d5a27", description: "Rich green foliage enhancement", descriptionZh: "丰富绿色植被增强", category: "animal" },
	{ name: "Golden Hour", filter: "sepia(25%) hue-rotate(-5deg) saturate(140%) brightness(110%)", previewColor: "#d4943a", description: "Warm golden wildlife portrait", descriptionZh: "暖金动物肖像光", category: "animal" },
	{ name: "Snow White", filter: "brightness(120%) contrast(90%) saturate(80%)", previewColor: "#e8e8f0", description: "Bright arctic/snow scene", descriptionZh: "明亮雪地极地场景", category: "animal" },
	{ name: "Night Vision", filter: "brightness(150%) saturate(50%) hue-rotate(90deg)", previewColor: "#1a3a1a", description: "Green-tinted night vision look", descriptionZh: "绿色夜视仪效果", category: "animal" },

	// Landscape photography
	{ name: "Vivid Nature", filter: "saturate(140%) contrast(120%) brightness(105%)", previewColor: "#3a8c3a", description: "Vibrant landscape colors", descriptionZh: "鲜艳自然风光色彩", category: "landscape" },
	{ name: "Sunset", filter: "sepia(30%) hue-rotate(-10deg) saturate(150%) brightness(105%)", previewColor: "#c45a20", description: "Warm sunset golden tones", descriptionZh: "暖日落金色余晖", category: "landscape" },
	{ name: "Misty Morning", filter: "brightness(110%) contrast(75%) saturate(60%) blur(0.3px)", previewColor: "#b8b8c8", description: "Soft foggy morning atmosphere", descriptionZh: "晨雾朦胧氛围感", category: "landscape" },
	{ name: "Deep Blue", filter: "hue-rotate(10deg) saturate(150%) contrast(110%) brightness(95%)", previewColor: "#1a4a7a", description: "Rich blue sky and water", descriptionZh: "深邃蓝天碧水色调", category: "landscape" },
	{ name: "Autumn", filter: "hue-rotate(-20deg) saturate(140%) contrast(110%)", previewColor: "#b8451a", description: "Warm orange fall colors", descriptionZh: "温暖橙红秋季色彩", category: "landscape" },

	// Overlay effects
	...OVERLAY_PRESETS_DATA.map((p) => ({
		name: p.name,
		filter: p.filter,
		previewColor: p.previewColor,
		description: p.description,
		descriptionZh: p.descriptionZh,
		category: "overlay" as const,
	})),

	// Advanced effects
	...ADVANCED_PRESETS,
];

const CATEGORY_LABELS: Record<string, string> = {
	color: "Color",
	blur: "Blur",
	artistic: "Artistic",
	lighting: "Lighting",
	animal: "Animal",
	landscape: "Landscape",
	overlay: "Overlay",
	advanced: "Advanced",
};

export function EffectsView() {
	const { t } = useTranslation();
	const editor = useEditor();

	// i18next-toolkit: forces extraction of advanced effect labels (dead code, extract-only)
	if (false as boolean) {
		t("Advanced");
		t("Tyndall");
		t("Rhythm");
		t("Pop Out");
		t("Focus Blur");
	}

	const { selectedElements } = useElementSelection();
	const [activeFilter, setActiveFilter] = useState<string | null>(null);

	const selectedVisualElements = selectedElements.filter((ref) => {
		const el = editor.timeline
			.getElementsWithTracks({ elements: [ref] })
			.find((item) => item.element.type === "video" || item.element.type === "image");
		return !!el;
	});

	const handleAddOverlay = useCallback(
		(preset: EffectPreset) => {
			const presetData = OVERLAY_PRESETS_DATA.find((p) => p.filter === preset.filter);
			if (!presetData) return;

			const duration = 5;
			const tracks = editor.timeline.getTracks();
			const overlayTrack = tracks.find(
				(track) => track.type === "overlay" && !track.hidden,
			) as { id: string } | undefined;

			if (!overlayTrack) {
				const newTrackId = editor.timeline.addTrack({ type: "overlay" });
				editor.timeline.insertElement({
					element: {
						type: "overlay",
						name: preset.name,
						duration,
						startTime: 0,
						trimStart: 0,
						trimEnd: duration,
						overlayType: presetData.overlayType,
						density: presetData.density,
						speed: presetData.speed,
						overlayOpacity: presetData.opacity,
						wind: presetData.wind,
						intensity: presetData.intensity,
					},
					placement: { mode: "explicit", trackId: newTrackId },
				});
			} else {
				editor.timeline.insertElement({
					element: {
						type: "overlay",
						name: preset.name,
						duration,
						startTime: 0,
						trimStart: 0,
						trimEnd: duration,
						overlayType: presetData.overlayType,
						density: presetData.density,
						speed: presetData.speed,
						overlayOpacity: presetData.opacity,
						wind: presetData.wind,
						intensity: presetData.intensity,
					},
					placement: { mode: "explicit", trackId: overlayTrack.id },
				});
			}

			toast.success(t("Added {{name}} overlay", { name: preset.name }));
		},
		[editor, t],
	);

	const handleApplyEffect = (preset: EffectPreset) => {
		if (isOverlayPreset(preset)) {
			handleAddOverlay(preset);
			return;
		}

		if (selectedVisualElements.length === 0) {
			toast.info(t("Select a video or image clip on the timeline first"));
			return;
		}

		const isRemoving = activeFilter === preset.filter;
		const newFilter = isRemoving ? undefined : preset.filter;

		editor.timeline.updateElements({
			updates: selectedVisualElements.map((ref) => ({
				trackId: ref.trackId,
				elementId: ref.elementId,
				updates: { filter: newFilter },
			})),
			pushHistory: true,
		});

		setActiveFilter(isRemoving ? null : preset.filter);
		toast.success(isRemoving ? t("Effect removed") : t("Applied {{name}}", { name: preset.name }));
	};

	const categories = [...new Set(EFFECT_PRESETS.map((p) => p.category))];

	return (
		<div className="group relative h-full">
			<OpenInEditor source="src/components/editor/panels/assets/views/effects.tsx" line={1} />
			<BaseView>
				<div className="flex flex-col gap-5 p-4">
					<p className="text-muted-foreground text-xs">
						{t("Select a clip on the timeline, then click an effect. Click again to remove.")}
					</p>
					{categories.map((category) => {
						const presets = EFFECT_PRESETS.filter((p) => p.category === category);
						if (presets.length === 0) return null;
						return (
							<div key={category} className="flex flex-col gap-2">
								<h4 className="text-muted-foreground text-xs font-medium uppercase tracking-wider">
									{t(CATEGORY_LABELS[category])}
								</h4>
								<div className="grid grid-cols-3 gap-2">
									{presets.map((preset) => {
										const isOverlay = isOverlayPreset(preset);
										const previewStyle: CSSProperties = {
											background: `linear-gradient(135deg, ${preset.previewColor}, ${preset.previewColor}dd)`,
											...(isOverlay ? {} : { filter: preset.filter }),
										};
										const overlayType = isOverlay
											? OVERLAY_PRESETS_DATA.find((p) => p.filter === preset.filter)?.overlayType
											: undefined;
										const iconLabel = isOverlay
											? overlayType === "rain"
												? "///"
												: overlayType === "snow"
													? "..."
													: overlayType === "sparkle"
														? "*+"
														: overlayType === "fire"
															? "/\\"
															: overlayType === "smoke"
																? "~"
																: overlayType === "firefly"
																	? ".."
																	: overlayType === "bubble"
																		? "O"
																		: overlayType === "confetti"
																			? "#"
																			: overlayType === "shake"
																				? "↕"
																				: "..."
											: preset.name;
										return (
											<button
												type="button"
												key={preset.name}
												title={`${preset.description}\n${preset.descriptionZh}`}
												onClick={() => handleApplyEffect(preset)}
												className={cn(
													"bg-muted hover:bg-accent flex flex-col items-center gap-1.5 rounded-lg border p-2.5 transition-all",
													!isOverlay && activeFilter === preset.filter
														? "border-primary ring-primary ring-1"
														: "border-transparent",
												)}
											>
												<div
													className="flex size-14 w-full items-center justify-center rounded"
													style={previewStyle}
												>
													<span className="text-[10px] font-bold text-white/80 drop-shadow-md">
														{iconLabel}
													</span>
												</div>
												<span className="text-[11px] font-medium leading-tight text-center">
													{t(preset.name)}
												</span>
												<span className="text-[10px] text-muted-foreground/70 leading-tight text-center line-clamp-1">
													{preset.descriptionZh}
												</span>
											</button>
										);
									})}
								</div>
							</div>
						);
					})}
				</div>
			</BaseView>
		</div>
	);
}
