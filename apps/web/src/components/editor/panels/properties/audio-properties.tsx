"use client";

import { Slider } from "@/components/ui/slider";
import { Input } from "@/components/ui/input";
import { useReducer, useRef } from "react";
import { useTranslation } from "@i18next-toolkit/nextjs-approuter";
import { PanelBaseView } from "@/components/editor/panels/panel-base-view";
import {
	PropertyGroup,
	PropertyItem,
	PropertyItemLabel,
	PropertyItemValue,
} from "./property-item";
import { clamp } from "@/utils/math";
import { useEditor } from "@/hooks/use-editor";
import type { AudioElement } from "@/types/timeline";
import { SPEED_PRESETS, formatSpeedLabel } from "@/lib/timeline/speed-utils";

export function AudioProperties({
	_element: element,
	trackId,
}: {
	_element: AudioElement;
	trackId: string;
}) {
	const { t } = useTranslation();
	const editor = useEditor();
	const [, forceRender] = useReducer((x: number) => x + 1, 0);

	// i18next-toolkit: forces extraction of labels (dead code, extract-only)
	if (false as boolean) {
		t("Pan");
		t("Fade In");
		t("Fade Out");
	}

	const isEditingVolume = useRef(false);
	const isEditingSpeed = useRef(false);
	const isEditingPan = useRef(false);
	const isEditingFadeIn = useRef(false);
	const isEditingFadeOut = useRef(false);

	const volumeDraft = useRef("");
	const speedDraft = useRef("");
	const panDraft = useRef("");
	const fadeInDraft = useRef("");
	const fadeOutDraft = useRef("");

	const initialVolumeRef = useRef<number | null>(null);
	const initialSpeedRef = useRef<number | null>(null);
	const initialPanRef = useRef<number | null>(null);
	const initialFadeInRef = useRef<number | null>(null);
	const initialFadeOutRef = useRef<number | null>(null);

	const volumePercent = Math.round(element.volume * 100);
	const volumeDisplay = isEditingVolume.current
		? volumeDraft.current
		: volumePercent.toString();

	const currentSpeed = element.playbackRate ?? 1;
	const speedDisplay = isEditingSpeed.current
		? speedDraft.current
		: formatSpeedLabel({ rate: currentSpeed });

	const currentPan = element.pan ?? 0;
	const panDisplay = isEditingPan.current
		? panDraft.current
		: currentPan.toFixed(2);

	const currentFadeIn = element.fadeInDuration ?? 0;
	const fadeInDisplay = isEditingFadeIn.current
		? fadeInDraft.current
		: currentFadeIn.toFixed(1);

	const currentFadeOut = element.fadeOutDuration ?? 0;
	const fadeOutDisplay = isEditingFadeOut.current
		? fadeOutDraft.current
		: currentFadeOut.toFixed(1);

	const updateElement = ({
		updates,
		pushHistory = true,
	}: {
		updates: Partial<Record<string, unknown>>;
		pushHistory?: boolean;
	}) => {
		editor.timeline.updateElements({
			updates: [{ trackId, elementId: element.id, updates }],
			pushHistory,
		});
	};

	const applySpeedChange = ({
		newRate,
		pushHistory,
	}: {
		newRate: number;
		pushHistory: boolean;
	}) => {
		const oldRate = currentSpeed;
		const newDuration = element.duration * (oldRate / newRate);

		updateElement({
			updates: { playbackRate: newRate, duration: newDuration },
			pushHistory,
		});
	};

	const commitNumberField = ({
		draft,
		initial,
		apply,
	}: {
		draft: string;
		initial: React.RefObject<number | null>;
		apply: (value: number) => void;
	}) => {
		if (initial.current === null) return;
		const parsed = Number.parseFloat(draft);
		if (!Number.isNaN(parsed)) {
			apply(parsed);
		}
		initial.current = null;
	};

	return (
		<div className="flex h-full flex-col">
			<PanelBaseView className="p-0">
				<PropertyGroup title={t("Volume")} hasBorderTop={false} collapsible={false}>
					<div className="space-y-6">
						<PropertyItem direction="column">
							<PropertyItemLabel>{t("Volume")}</PropertyItemLabel>
							<PropertyItemValue>
								<div className="flex items-center gap-2">
									<Slider
										value={[volumePercent]}
										min={0}
										max={200}
										step={1}
										onValueChange={([value]) => {
											if (initialVolumeRef.current === null) {
												initialVolumeRef.current = element.volume;
											}
											updateElement({
												updates: { volume: value / 100 },
												pushHistory: false,
											});
										}}
										onValueCommit={([value]) => {
											if (initialVolumeRef.current !== null) {
												updateElement({
													updates: { volume: initialVolumeRef.current },
													pushHistory: false,
												});
												updateElement({
													updates: { volume: value / 100 },
													pushHistory: true,
												});
												initialVolumeRef.current = null;
											}
										}}
										className="w-full"
									/>
									<Input
										type="number"
										value={volumeDisplay}
										min={0}
										max={200}
										onFocus={() => {
											isEditingVolume.current = true;
											volumeDraft.current = volumePercent.toString();
											forceRender();
										}}
										onChange={(event) => {
											volumeDraft.current = event.target.value;
											forceRender();
											if (initialVolumeRef.current === null) {
												initialVolumeRef.current = element.volume;
											}
											const parsed = Number.parseInt(event.target.value, 10);
											if (!Number.isNaN(parsed)) {
												const clamped = clamp({ value: parsed, min: 0, max: 200 });
												updateElement({
													updates: { volume: clamped / 100 },
													pushHistory: false,
												});
											}
										}}
										onBlur={() => {
											if (initialVolumeRef.current !== null) {
												const parsed = Number.parseInt(volumeDraft.current, 10);
												const clamped = Number.isNaN(parsed)
													? volumePercent
													: clamp({ value: parsed, min: 0, max: 200 });
												updateElement({
													updates: { volume: initialVolumeRef.current },
													pushHistory: false,
												});
												updateElement({
													updates: { volume: clamped / 100 },
													pushHistory: true,
												});
												initialVolumeRef.current = null;
											}
											isEditingVolume.current = false;
											volumeDraft.current = "";
											forceRender();
										}}
										className="bg-accent h-7 w-14 [appearance:textfield] rounded-sm px-2 text-center !text-xs [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none"
									/>
								</div>
							</PropertyItemValue>
						</PropertyItem>
					</div>
				</PropertyGroup>

				<PropertyGroup title={t("Pan")} collapsible={false}>
					<div className="space-y-6">
						<PropertyItem direction="column">
							<div className="flex items-center justify-between">
								<PropertyItemLabel>{t("Pan")}</PropertyItemLabel>
								<span className="text-muted-foreground text-xs">
									L{currentPan < -0.05 ? ` ${currentPan.toFixed(2)}` : ""}
									{Math.abs(currentPan) <= 0.05 ? " C" : ""}
									{currentPan > 0.05 ? ` ${currentPan.toFixed(2)} R` : ""}
								</span>
							</div>
							<PropertyItemValue>
								<div className="flex items-center gap-2">
									<Slider
										value={[currentPan]}
										min={-1}
										max={1}
										step={0.01}
										onValueChange={([value]) => {
											if (initialPanRef.current === null) {
												initialPanRef.current = currentPan;
											}
											updateElement({
												updates: { pan: value },
												pushHistory: false,
											});
										}}
										onValueCommit={([value]) => {
											if (initialPanRef.current !== null) {
												updateElement({
													updates: { pan: initialPanRef.current },
													pushHistory: false,
												});
												updateElement({
													updates: { pan: value },
													pushHistory: true,
												});
												initialPanRef.current = null;
											}
										}}
										className="w-full"
									/>
									<span className="text-muted-foreground min-w-[1ch] text-right text-xs">-1</span>
								</div>
							</PropertyItemValue>
						</PropertyItem>
					</div>
				</PropertyGroup>

				<PropertyGroup title={t("Fade")} collapsible={false}>
					<div className="space-y-4">
						<PropertyItem>
							<PropertyItemLabel>{t("Fade In")} (s)</PropertyItemLabel>
							<PropertyItemValue>
								<Input
									type="number"
									value={fadeInDisplay}
									min={0}
									max={element.duration}
									step={0.1}
									onFocus={() => {
										isEditingFadeIn.current = true;
										fadeInDraft.current = currentFadeIn.toFixed(1);
										forceRender();
									}}
									onChange={(e) => {
										fadeInDraft.current = e.target.value;
										forceRender();
										if (initialFadeInRef.current === null) {
											initialFadeInRef.current = currentFadeIn;
										}
										const parsed = Number.parseFloat(e.target.value);
										if (!Number.isNaN(parsed)) {
											const clamped = clamp({ value: parsed, min: 0, max: element.duration });
											updateElement({
												updates: { fadeInDuration: clamped },
												pushHistory: false,
											});
										}
									}}
									onBlur={() => {
										if (initialFadeInRef.current !== null) {
											const parsed = Number.parseFloat(fadeInDraft.current);
											const value = Number.isNaN(parsed)
												? currentFadeIn
												: clamp({ value: parsed, min: 0, max: element.duration });
											updateElement({
												updates: { fadeInDuration: initialFadeInRef.current },
												pushHistory: false,
											});
											updateElement({
												updates: { fadeInDuration: value },
												pushHistory: true,
											});
											initialFadeInRef.current = null;
										}
										isEditingFadeIn.current = false;
										fadeInDraft.current = "";
										forceRender();
									}}
									className="bg-accent h-7 w-full [appearance:textfield] rounded-sm px-2 text-center !text-xs [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none"
								/>
							</PropertyItemValue>
						</PropertyItem>

						<PropertyItem>
							<PropertyItemLabel>{t("Fade Out")} (s)</PropertyItemLabel>
							<PropertyItemValue>
								<Input
									type="number"
									value={fadeOutDisplay}
									min={0}
									max={element.duration}
									step={0.1}
									onFocus={() => {
										isEditingFadeOut.current = true;
										fadeOutDraft.current = currentFadeOut.toFixed(1);
										forceRender();
									}}
									onChange={(e) => {
										fadeOutDraft.current = e.target.value;
										forceRender();
										if (initialFadeOutRef.current === null) {
											initialFadeOutRef.current = currentFadeOut;
										}
										const parsed = Number.parseFloat(e.target.value);
										if (!Number.isNaN(parsed)) {
											const clamped = clamp({ value: parsed, min: 0, max: element.duration });
											updateElement({
												updates: { fadeOutDuration: clamped },
												pushHistory: false,
											});
										}
									}}
									onBlur={() => {
										if (initialFadeOutRef.current !== null) {
											const parsed = Number.parseFloat(fadeOutDraft.current);
											const value = Number.isNaN(parsed)
												? currentFadeOut
												: clamp({ value: parsed, min: 0, max: element.duration });
											updateElement({
												updates: { fadeOutDuration: initialFadeOutRef.current },
												pushHistory: false,
											});
											updateElement({
												updates: { fadeOutDuration: value },
												pushHistory: true,
											});
											initialFadeOutRef.current = null;
										}
										isEditingFadeOut.current = false;
										fadeOutDraft.current = "";
										forceRender();
									}}
									className="bg-accent h-7 w-full [appearance:textfield] rounded-sm px-2 text-center !text-xs [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none"
								/>
							</PropertyItemValue>
						</PropertyItem>
					</div>
				</PropertyGroup>

				<PropertyGroup title={t("Speed")} collapsible={false}>
					<div className="space-y-6">
						<PropertyItem direction="column">
							<PropertyItemLabel>{t("Playback Speed")}</PropertyItemLabel>
							<PropertyItemValue>
								<div className="flex flex-wrap gap-1.5">
									{SPEED_PRESETS.map((preset) => {
										const isActive = Math.abs(currentSpeed - preset.value) < 0.001;
										return (
											<button
												key={preset.value}
												type="button"
												className={`rounded-sm px-2 py-0.5 text-xs transition-colors ${
													isActive
														? "bg-primary text-primary-foreground"
														: "bg-accent hover:bg-accent/80"
												}`}
												onClick={() => {
													initialSpeedRef.current = currentSpeed;
													applySpeedChange({
														newRate: preset.value,
														pushHistory: true,
													});
													initialSpeedRef.current = null;
												}}
												onKeyDown={(event) => {
													if (event.key === "Enter" || event.key === " ") {
														initialSpeedRef.current = currentSpeed;
														applySpeedChange({
															newRate: preset.value,
															pushHistory: true,
														});
														initialSpeedRef.current = null;
													}
												}}
											>
												{preset.label}
											</button>
										);
									})}
								</div>
							</PropertyItemValue>
						</PropertyItem>

						<PropertyItem>
							<PropertyItemLabel>{t("Custom")}</PropertyItemLabel>
							<PropertyItemValue>
								<div className="flex items-center gap-1">
									<Input
										type="number"
										value={speedDisplay}
										min={0.25}
										max={4}
										step={0.05}
										onFocus={() => {
											isEditingSpeed.current = true;
											speedDraft.current = formatSpeedLabel({ rate: currentSpeed });
											forceRender();
										}}
										onChange={(event) => {
											speedDraft.current = event.target.value;
											forceRender();
											if (initialSpeedRef.current === null) {
												initialSpeedRef.current = currentSpeed;
											}
											const parsed = Number.parseFloat(event.target.value);
											if (!Number.isNaN(parsed)) {
												const clamped = clamp({ value: parsed, min: 0.25, max: 4 });
												applySpeedChange({
													newRate: clamped,
													pushHistory: false,
												});
											}
										}}
										onBlur={() => {
											if (initialSpeedRef.current !== null) {
												const parsed = Number.parseFloat(speedDraft.current);
												const clamped = Number.isNaN(parsed)
													? currentSpeed
													: clamp({ value: parsed, min: 0.25, max: 4 });
												applySpeedChange({
													newRate: initialSpeedRef.current,
													pushHistory: false,
												});
												applySpeedChange({
													newRate: clamped,
													pushHistory: true,
												});
												initialSpeedRef.current = null;
											}
											isEditingSpeed.current = false;
											speedDraft.current = "";
											forceRender();
										}}
										className="bg-accent h-7 w-full [appearance:textfield] rounded-sm px-2 text-center !text-xs [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none"
									/>
									<span className="text-muted-foreground text-xs">x</span>
								</div>
							</PropertyItemValue>
						</PropertyItem>
					</div>
				</PropertyGroup>
			</PanelBaseView>
		</div>
	);
}
