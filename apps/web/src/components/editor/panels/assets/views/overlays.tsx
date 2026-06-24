"use client";

import { useTranslation } from "@i18next-toolkit/nextjs-approuter";
import { useCallback } from "react";
import { toast } from "sonner";
import { PanelBaseView as BaseView } from "@/components/editor/panels/panel-base-view";
import { useEditor } from "@/hooks/use-editor";
import { OVERLAY_PRESETS } from "@/types/overlay";
import type { OverlayPreset } from "@/types/overlay";
import { cn } from "@/utils/ui";
import { OpenInEditor } from "@/components/dev/open-in-editor";
import type { CSSProperties } from "react";

export function OverlaysView() {
	const { t } = useTranslation();
	const editor = useEditor();

	const handleAddOverlay = useCallback(
		(preset: OverlayPreset) => {
			const duration = 5;
			const tracks = editor.timeline.getTracks();

			const overlayTrack = tracks.find(
				(track) => track.type === "overlay" && !track.hidden,
			) as { id: string } | undefined;

			if (!overlayTrack) {
				const newTrackId = editor.timeline.addTrack({
					type: "overlay",
				});

				editor.timeline.insertElement({
					element: {
						type: "overlay",
						name: preset.label,
						duration,
						startTime: 0,
						trimStart: 0,
						trimEnd: duration,
						overlayType: preset.params.type,
						density: preset.params.density,
						speed: preset.params.speed,
						overlayOpacity: preset.params.opacity,
						wind: preset.params.wind,
						intensity: preset.params.intensity,
					},
					placement: { mode: "explicit", trackId: newTrackId },
				});

				toast.success(t("Added {{name}} overlay", { name: preset.label }));
				return;
			}

			editor.timeline.insertElement({
				element: {
					type: "overlay",
					name: preset.label,
					duration,
					startTime: 0,
					trimStart: 0,
					trimEnd: duration,
					overlayType: preset.params.type,
					density: preset.params.density,
					speed: preset.params.speed,
					overlayOpacity: preset.params.opacity,
					wind: preset.params.wind,
					intensity: preset.params.intensity,
				},
				placement: { mode: "explicit", trackId: overlayTrack.id },
			});

			toast.success(t("Added {{name}} overlay", { name: preset.label }));
		},
		[editor, t],
	);

	return (
		<div className="group relative h-full">
			<OpenInEditor source="src/components/editor/panels/assets/views/overlays.tsx" />
			<BaseView>
				<div className="flex flex-col gap-5 p-4">
					<p className="text-muted-foreground text-xs">
						{t("Add rain, snow and other overlay effects to your video.")}
					</p>
					<div className="grid grid-cols-2 gap-2">
						{OVERLAY_PRESETS.map((preset) => {
							const previewStyle: CSSProperties = {
								background: `linear-gradient(135deg, ${preset.previewColor}, ${preset.previewColor}88)`,
							};
							return (
								<button
									type="button"
									key={preset.label}
									title={`${preset.description}\n${preset.descriptionZh}`}
									onClick={() => handleAddOverlay(preset)}
									className={cn(
										"bg-muted hover:bg-accent flex flex-col items-center gap-1.5 rounded-lg border border-transparent p-2.5 transition-all",
									)}
								>
									<div
										className="flex size-14 w-full items-center justify-center rounded"
										style={previewStyle}
									>
										<span className="text-lg font-bold text-white/90 drop-shadow-md">
											{preset.params.type === "rain"
												? "///"
												: preset.params.type === "snow"
													? "..."
													: preset.params.type === "sparkle"
														? "*+"
														: preset.params.type === "fire"
															? "/\\"
															: preset.params.type === "smoke"
																? "~"
																: preset.params.type === "firefly"
																	? ".."
																	: preset.params.type === "bubble"
																		? "O"
																		: preset.params.type === "confetti"
																			? "#"
																			: preset.params.type === "shake"
																				? "↕"
																				: "?"}
										</span>
									</div>
									<span className="text-[11px] font-medium leading-tight text-center">
										{t(preset.label)}
									</span>
									<span className="text-[10px] text-muted-foreground/70 leading-tight text-center line-clamp-1">
										{preset.descriptionZh}
									</span>
								</button>
							);
						})}
					</div>
				</div>
			</BaseView>
		</div>
	);
}
