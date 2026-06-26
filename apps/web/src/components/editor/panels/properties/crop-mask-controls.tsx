import { clamp } from "@/utils/math";
import { Slider } from "@/components/ui/slider";
import { Input } from "@/components/ui/input";
import { useTranslation } from "@i18next-toolkit/nextjs-approuter";
import {
	PropertyGroup,
	PropertyItem,
	PropertyItemLabel,
	PropertyItemValue,
} from "./property-item";
import type { CropRect, MaskShape } from "@/types/timeline";
import type { EditorCore } from "@/core";

export function CropMaskControls({
	editor,
	trackId,
	elementId,
	crop,
	maskShape,
	maskRadius,
}: {
	editor: EditorCore;
	trackId: string;
	elementId: string;
	crop?: CropRect | null;
	maskShape?: MaskShape | null;
	maskRadius?: number | null;
}) {
	const { t } = useTranslation();

	const update = ({
		updates,
		pushHistory,
	}: {
		updates: Record<string, unknown>;
		pushHistory?: boolean;
	}) => {
		editor.timeline.updateElements({
			updates: [{ trackId, elementId, updates }],
			pushHistory: pushHistory ?? true,
		});
	};

	return (
		<PropertyGroup title={t("Crop & Mask")} collapsible={false}>
			<div className="space-y-4">
				<PropertyItem>
					<PropertyItemLabel>{t("Crop X")}</PropertyItemLabel>
					<PropertyItemValue>
						<Input
							type="number"
							value={(crop?.x ?? 0).toFixed(2)}
							min={0}
							max={1}
							step={0.01}
							onChange={(e) => {
								const parsed = Number.parseFloat(e.target.value);
								if (!Number.isNaN(parsed)) {
									const v = clamp({ value: parsed, min: 0, max: 1 });
									update({
										updates: { crop: { x: v, y: crop?.y ?? 0, width: crop?.width ?? 1, height: crop?.height ?? 1 } },
										pushHistory: false,
									});
								}
							}}
							onBlur={() => {
								const parsed = Number.parseFloat(e.target.value);
								if (!Number.isNaN(parsed)) {
									const v = clamp({ value: parsed, min: 0, max: 1 });
									update({
										updates: { crop: { x: v, y: crop?.y ?? 0, width: crop?.width ?? 1, height: crop?.height ?? 1 } },
										pushHistory: true,
									});
								}
							}}
							className="bg-accent h-7 w-full [appearance:textfield] rounded-sm px-2 text-center !text-xs [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none"
						/>
					</PropertyItemValue>
				</PropertyItem>
				<PropertyItem>
					<PropertyItemLabel>{t("Crop Y")}</PropertyItemLabel>
					<PropertyItemValue>
						<Input
							type="number"
							value={(crop?.y ?? 0).toFixed(2)}
							min={0}
							max={1}
							step={0.01}
							onChange={(e) => {
								const parsed = Number.parseFloat(e.target.value);
								if (!Number.isNaN(parsed)) {
									const v = clamp({ value: parsed, min: 0, max: 1 });
									update({
										updates: { crop: { x: crop?.x ?? 0, y: v, width: crop?.width ?? 1, height: crop?.height ?? 1 } },
										pushHistory: false,
									});
								}
							}}
							onBlur={() => {
								const parsed = Number.parseFloat(e.target.value);
								if (!Number.isNaN(parsed)) {
									const v = clamp({ value: parsed, min: 0, max: 1 });
									update({
										updates: { crop: { x: crop?.x ?? 0, y: v, width: crop?.width ?? 1, height: crop?.height ?? 1 } },
										pushHistory: true,
									});
								}
							}}
							className="bg-accent h-7 w-full [appearance:textfield] rounded-sm px-2 text-center !text-xs [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none"
						/>
					</PropertyItemValue>
				</PropertyItem>
				<PropertyItem>
					<PropertyItemLabel>{t("Crop Width")}</PropertyItemLabel>
					<PropertyItemValue>
						<Input
							type="number"
							value={(crop?.width ?? 1).toFixed(2)}
							min={0}
							max={1}
							step={0.01}
							onChange={(e) => {
								const parsed = Number.parseFloat(e.target.value);
								if (!Number.isNaN(parsed)) {
									const v = clamp({ value: parsed, min: 0, max: 1 });
									update({
										updates: { crop: { x: crop?.x ?? 0, y: crop?.y ?? 0, width: v, height: crop?.height ?? 1 } },
										pushHistory: false,
									});
								}
							}}
							onBlur={() => {
								const parsed = Number.parseFloat(e.target.value);
								if (!Number.isNaN(parsed)) {
									const v = clamp({ value: parsed, min: 0, max: 1 });
									update({
										updates: { crop: { x: crop?.x ?? 0, y: crop?.y ?? 0, width: v, height: crop?.height ?? 1 } },
										pushHistory: true,
									});
								}
							}}
							className="bg-accent h-7 w-full [appearance:textfield] rounded-sm px-2 text-center !text-xs [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none"
						/>
					</PropertyItemValue>
				</PropertyItem>
				<PropertyItem>
					<PropertyItemLabel>{t("Crop Height")}</PropertyItemLabel>
					<PropertyItemValue>
						<Input
							type="number"
							value={(crop?.height ?? 1).toFixed(2)}
							min={0}
							max={1}
							step={0.01}
							onChange={(e) => {
								const parsed = Number.parseFloat(e.target.value);
								if (!Number.isNaN(parsed)) {
									const v = clamp({ value: parsed, min: 0, max: 1 });
									update({
										updates: { crop: { x: crop?.x ?? 0, y: crop?.y ?? 0, width: crop?.width ?? 1, height: v } },
										pushHistory: false,
									});
								}
							}}
							onBlur={() => {
								const parsed = Number.parseFloat(e.target.value);
								if (!Number.isNaN(parsed)) {
									const v = clamp({ value: parsed, min: 0, max: 1 });
									update({
										updates: { crop: { x: crop?.x ?? 0, y: crop?.y ?? 0, width: crop?.width ?? 1, height: v } },
										pushHistory: true,
									});
								}
							}}
							className="bg-accent h-7 w-full [appearance:textfield] rounded-sm px-2 text-center !text-xs [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none"
						/>
					</PropertyItemValue>
				</PropertyItem>
				<PropertyItem direction="column">
					<PropertyItemLabel>{t("Mask")}</PropertyItemLabel>
					<PropertyItemValue>
						<select
							value={maskShape ?? "none"}
							onChange={(e) => {
								update({ updates: { maskShape: e.target.value }, pushHistory: true });
							}}
							className="bg-accent h-7 w-full rounded-sm px-2 text-xs"
						>
							<option value="none">{t("None")}</option>
							<option value="circle">{t("Circle")}</option>
							<option value="rounded-rect">{t("Rounded Rectangle")}</option>
						</select>
					</PropertyItemValue>
				</PropertyItem>
				{maskShape === "rounded-rect" && (
					<PropertyItem direction="column">
						<PropertyItemLabel>{t("Mask Radius")}</PropertyItemLabel>
						<PropertyItemValue>
							<Slider
								value={[(maskRadius ?? 0.1) * 100]}
								min={0}
								max={100}
								step={1}
								onValueChange={([value]) => {
									update({ updates: { maskRadius: value / 100 }, pushHistory: false });
								}}
								onValueCommit={([value]) => {
									update({ updates: { maskRadius: value / 100 }, pushHistory: true });
								}}
								className="w-full"
							/>
						</PropertyItemValue>
					</PropertyItem>
				)}
			</div>
		</PropertyGroup>
	);
}
