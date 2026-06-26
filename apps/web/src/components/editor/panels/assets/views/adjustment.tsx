"use client";

import { useCallback } from "react";
import { useTranslation } from "@i18next-toolkit/nextjs-approuter";
import { Slider } from "@/components/ui/slider";
import { PanelBaseView as BaseView } from "@/components/editor/panels/panel-base-view";
import {
	PropertyGroup,
	PropertyItem,
	PropertyItemLabel,
	PropertyItemValue,
} from "@/components/editor/panels/properties/property-item";
import { useEditor } from "@/hooks/use-editor";
import { clamp } from "@/utils/math";
import { DEFAULT_GLOBAL_ADJUSTMENTS } from "@/types/project";
import type { GlobalAdjustments } from "@/types/project";
import { OpenInEditor } from "@/components/dev/open-in-editor";

const ADJUSTMENT_ITEMS: {
	key: keyof GlobalAdjustments;
	label: string;
	min: number;
	max: number;
	step: number;
}[] = [
	{ key: "brightness", label: "Brightness", min: -100, max: 100, step: 1 },
	{ key: "contrast", label: "Contrast", min: -100, max: 100, step: 1 },
	{ key: "saturation", label: "Saturation", min: -100, max: 100, step: 1 },
	{ key: "temperature", label: "Temperature", min: -100, max: 100, step: 1 },
	{ key: "vignette", label: "Vignette", min: 0, max: 100, step: 1 },
];

export function AdjustmentView() {
	const { t } = useTranslation();
	const editor = useEditor();

	// i18next-toolkit: forces extraction of adjustment labels (dead code, extract-only)
	if (false as boolean) {
		t("Light & Color");
		t("Reset All");
		t("Brightness");
		t("Contrast");
		t("Saturation");
		t("Temperature");
		t("Vignette");
	}

	const activeProject = editor.project.getActive();
	const adjustments = activeProject?.settings.adjustments ?? {
		...DEFAULT_GLOBAL_ADJUSTMENTS,
	};

	const handleChange = useCallback(
		({
			key,
			value,
			commit,
		}: {
			key: keyof GlobalAdjustments;
			value: number;
			commit: boolean;
		}) => {
			const current = activeProject?.settings.adjustments ?? {
				...DEFAULT_GLOBAL_ADJUSTMENTS,
			};
			editor.project.updateSettings({
				settings: {
					adjustments: { ...current, [key]: value },
				},
				pushHistory: commit,
			});
		},
		[editor, activeProject],
	);

	const handleReset = useCallback(() => {
		editor.project.updateSettings({
			settings: { adjustments: { ...DEFAULT_GLOBAL_ADJUSTMENTS } },
			pushHistory: true,
		});
	}, [editor]);

	const hasChanges = ADJUSTMENT_ITEMS.some(
		(item) =>
			adjustments[item.key] !== DEFAULT_GLOBAL_ADJUSTMENTS[item.key],
	);

	return (
		<div className="group relative h-full">
			<OpenInEditor source="src/components/editor/panels/assets/views/adjustment.tsx" line={1} />
			<BaseView>
				<div className="flex flex-col p-4">
					{hasChanges && (
						<button
							type="button"
							onClick={handleReset}
							className="bg-secondary hover:bg-secondary/80 mb-4 self-start rounded-md px-3 py-1 text-xs font-medium transition-colors"
						>
							{t("Reset All")}
						</button>
					)}

					<PropertyGroup
						title={t("Light & Color")}
						hasBorderTop={false}
						collapsible={false}
					>
						<div className="space-y-5">
							{ADJUSTMENT_ITEMS.map((item) => {
								const currentValue = adjustments[item.key];
								return (
									<PropertyItem key={item.key} direction="column">
										<div className="flex items-center justify-between">
											<PropertyItemLabel>{t(item.label)}</PropertyItemLabel>
											<span
												className={
													currentValue !== 0
														? "text-foreground min-w-[2ch] text-right text-xs font-medium tabular-nums"
														: "text-muted-foreground min-w-[2ch] text-right text-xs tabular-nums"
												}
											>
												{currentValue > 0 ? "+" : ""}
												{currentValue}
											</span>
										</div>
										<PropertyItemValue>
											<Slider
												value={[currentValue]}
												min={item.min}
												max={item.max}
												step={item.step}
												onValueChange={([value]) => {
													handleChange({
														key: item.key,
														value: clamp({
															value,
															min: item.min,
															max: item.max,
														}),
														commit: false,
													});
												}}
												onValueCommit={([value]) => {
													handleChange({
														key: item.key,
														value: clamp({
															value,
															min: item.min,
															max: item.max,
														}),
														commit: true,
													});
												}}
												className="w-full"
											/>
										</PropertyItemValue>
									</PropertyItem>
								);
							})}
						</div>
					</PropertyGroup>
				</div>
			</BaseView>
		</div>
	);
}
