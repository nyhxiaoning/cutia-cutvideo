"use client";

import { useTranslation } from "@i18next-toolkit/nextjs-approuter";
import { useState } from "react";
import { toast } from "sonner";
import { PanelBaseView as BaseView } from "@/components/editor/panels/panel-base-view";
import { useEditor } from "@/hooks/use-editor";
import { useElementSelection } from "@/hooks/timeline/element/use-element-selection";
import { cn } from "@/utils/ui";
import { OpenInEditor } from "@/components/dev/open-in-editor";
import type { CSSProperties } from "react";

interface FilterPreset {
	name: string;
	filter: string;
	previewColor: string;
	descriptionZh: string;
	category: "portrait" | "film" | "food" | "city" | "retro";
}

const FILTER_PRESETS: FilterPreset[] = [
	// Portrait (人像)
	{ name: "Natural", filter: "brightness(105%) contrast(95%) saturate(105%)", previewColor: "#f0d5c0", descriptionZh: "自然肤色提亮", category: "portrait" },
	{ name: "Fair Skin", filter: "brightness(110%) saturate(90%) hue-rotate(5deg)", previewColor: "#f5e0d0", descriptionZh: "白皙肌肤柔化", category: "portrait" },
	{ name: "Warm Glow", filter: "sepia(15%) brightness(108%) saturate(115%)", previewColor: "#e8c4a0", descriptionZh: "暖光氛围感", category: "portrait" },
	{ name: "Fresh", filter: "brightness(108%) contrast(90%) saturate(110%) hue-rotate(-5deg)", previewColor: "#d8e8d0", descriptionZh: "清新通透质感", category: "portrait" },
	{ name: "Moody", filter: "brightness(85%) contrast(130%) saturate(90%)", previewColor: "#8a7a6a", descriptionZh: "情绪暗调风格", category: "portrait" },

	// Film (电影)
	{ name: "Cinematic", filter: "contrast(120%) brightness(95%) saturate(110%)", previewColor: "#2a3a4a", descriptionZh: "电影级色彩色调", category: "film" },
	{ name: "Teal & Orange", filter: "sepia(10%) hue-rotate(5deg) saturate(120%) contrast(115%)", previewColor: "#1a4a5a", descriptionZh: "青橙电影色调", category: "film" },
	{ name: "Hollywood", filter: "contrast(130%) brightness(90%) saturate(125%)", previewColor: "#3a2a1a", descriptionZh: "好莱坞大片风格", category: "film" },
	{ name: "Documentary", filter: "brightness(105%) contrast(110%) saturate(95%)", previewColor: "#8a7a5a", descriptionZh: "纪录片真实感", category: "film" },
	{ name: "Horror", filter: "contrast(140%) brightness(70%) saturate(80%) hue-rotate(15deg)", previewColor: "#1a1a2a", descriptionZh: "恐怖阴暗氛围", category: "film" },

	// Food (美食)
	{ name: "Appetizing", filter: "saturate(130%) brightness(105%) contrast(105%)", previewColor: "#d4582a", descriptionZh: "诱人食欲饱满色", category: "food" },
	{ name: "Fresh Greens", filter: "hue-rotate(-15deg) saturate(120%) brightness(108%)", previewColor: "#4a8a3a", descriptionZh: "清新蔬果翠绿色", category: "food" },
	{ name: "Warm Dessert", filter: "sepia(20%) saturate(125%) brightness(108%)", previewColor: "#d4a06a", descriptionZh: "甜品暖色诱人", category: "food" },
	{ name: "Cool Drink", filter: "hue-rotate(10deg) saturate(115%) brightness(110%)", previewColor: "#4a8aba", descriptionZh: "冷饮清凉蓝色调", category: "food" },
	{ name: "Gourmet", filter: "contrast(115%) saturate(120%) brightness(105%)", previewColor: "#8a5a2a", descriptionZh: "高级美食质感", category: "food" },

	// City (城市)
	{ name: "Cyberpunk", filter: "hue-rotate(30deg) saturate(150%) contrast(130%)", previewColor: "#2a1a4a", descriptionZh: "赛博朋克霓虹风", category: "city" },
	{ name: "Street", filter: "contrast(120%) brightness(90%) saturate(80%)", previewColor: "#5a4a3a", descriptionZh: "街头纪实风格", category: "city" },
	{ name: "Clean Modern", filter: "brightness(110%) contrast(95%) saturate(105%)", previewColor: "#c0c8d0", descriptionZh: "现代简约干净", category: "city" },
	{ name: "Night City", filter: "brightness(70%) contrast(130%) saturate(120%) hue-rotate(10deg)", previewColor: "#1a1a3a", descriptionZh: "城市夜景霓虹", category: "city" },
	{ name: "Vintage Shanghai", filter: "sepia(40%) contrast(110%) brightness(95%)", previewColor: "#8a6a3a", descriptionZh: "老上海怀旧色调", category: "city" },

	// Retro (复古)
	{ name: "80s VHS", filter: "saturate(150%) contrast(120%) hue-rotate(15deg) brightness(90%)", previewColor: "#4a2a5a", descriptionZh: "80年代录像带风", category: "retro" },
	{ name: "Film Negative", filter: "saturate(80%) contrast(130%) brightness(90%)", previewColor: "#3a4a2a", descriptionZh: "胶片负片质感", category: "retro" },
	{ name: "Polaroid", filter: "brightness(115%) contrast(85%) saturate(90%) sepia(10%)", previewColor: "#d0c8b0", descriptionZh: "宝丽来拍立得风", category: "retro" },
	{ name: "Dusty", filter: "sepia(30%) saturate(60%) brightness(110%)", previewColor: "#b8a88a", descriptionZh: "做旧复古尘埃感", category: "retro" },
	{ name: "Comic", filter: "contrast(150%) saturate(130%) brightness(105%)", previewColor: "#d4d42a", descriptionZh: "漫画高饱和风格", category: "retro" },
];

const CATEGORY_LABELS: Record<string, string> = {
	portrait: "Portrait",
	film: "Film",
	food: "Food",
	city: "City",
	retro: "Retro",
};

export function FiltersView() {
	const { t } = useTranslation();
	const editor = useEditor();
	const { selectedElements } = useElementSelection();
	const [activeFilter, setActiveFilter] = useState<string | null>(null);

	const selectedVisualElements = selectedElements.filter((ref) => {
		const el = editor.timeline
			.getElementsWithTracks({ elements: [ref] })
			.find((item) => item.element.type === "video" || item.element.type === "image");
		return !!el;
	});

	const handleApplyFilter = (preset: FilterPreset) => {
		if (selectedVisualElements.length === 0) {
			toast.info(t("Select a clip on the timeline first"));
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
		toast.success(isRemoving ? t("Filter removed") : t("Applied {{name}}", { name: preset.name }));
	};

	const categories = [...new Set(FILTER_PRESETS.map((p) => p.category))];

	return (
		<div className="group relative h-full">
			<OpenInEditor source="src/components/editor/panels/assets/views/filters.tsx" line={1} />
			<BaseView>
				<div className="flex flex-col gap-5 p-4">
					<p className="text-muted-foreground text-xs">
						{t("Select a clip on the timeline, then click a filter. Click again to remove.")}
					</p>
					{categories.map((category) => {
						const presets = FILTER_PRESETS.filter((p) => p.category === category);
						if (presets.length === 0) return null;
						return (
							<div key={category} className="flex flex-col gap-2">
								<h4 className="text-muted-foreground text-xs font-medium uppercase tracking-wider">
									{t(CATEGORY_LABELS[category])}
								</h4>
								<div className="grid grid-cols-3 gap-2">
									{presets.map((preset) => {
										const previewStyle: CSSProperties = {
											background: `linear-gradient(135deg, ${preset.previewColor}, ${preset.previewColor}dd)`,
											filter: preset.filter,
										};
										return (
											<button
												type="button"
												key={preset.name}
												title={preset.descriptionZh}
												onClick={() => handleApplyFilter(preset)}
												className={cn(
													"bg-muted hover:bg-accent flex flex-col items-center gap-1.5 rounded-lg border p-2.5 transition-all",
													activeFilter === preset.filter
														? "border-primary ring-primary ring-1"
														: "border-transparent",
												)}
											>
												<div className="flex size-14 w-full items-center justify-center rounded" style={previewStyle}>
													<span className="text-[10px] font-bold text-white/80 drop-shadow-md">
														{preset.name}
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
