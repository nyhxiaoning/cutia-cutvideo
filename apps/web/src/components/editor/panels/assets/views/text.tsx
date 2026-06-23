import { useTranslation } from "@i18next-toolkit/nextjs-approuter";
import { PanelBaseView as BaseView } from "@/components/editor/panels/panel-base-view";
import { OpenInEditor } from "@/components/dev/open-in-editor";
import { useEditor } from "@/hooks/use-editor";
import { useElementSelection } from "@/hooks/timeline/element/use-element-selection";
import { DEFAULT_TEXT_ELEMENT } from "@/constants/text-constants";
import { buildTextElement } from "@/lib/timeline/element-utils";
import { TEXT_TEMPLATES, type TextTemplate } from "./text-templates";
import type { CSSProperties } from "react";
import type { TextElement } from "@/types/timeline";

function calcPreviewStyle(template: TextTemplate): CSSProperties {
	const { style } = template;
	const base: CSSProperties = {
		color: style.color ?? "#ffffff",
		fontSize: 32,
		fontWeight: 800,
		lineHeight: 1,
		display: "inline-flex",
		alignItems: "center",
		justifyContent: "center",
		borderRadius: style.backgroundBorderRadius ?? 0,
		paddingLeft: style.backgroundPaddingX ?? 0,
		paddingRight: style.backgroundPaddingX ?? 0,
		paddingTop: style.backgroundPaddingY ?? 0,
		paddingBottom: style.backgroundPaddingY ?? 0,
	};

	if (style.backgroundColor && style.backgroundColor !== "transparent") {
		base.backgroundColor = style.backgroundColor;
		if (style.backgroundOpacity !== undefined) {
			base.opacity = style.backgroundOpacity;
		}
	}

	if (style.stroke) {
		const w = style.stroke.width;
		const c = style.stroke.color;
		base.textShadow = [
			`-${w}px -${w}px 0 ${c}`,
			`${w}px -${w}px 0 ${c}`,
			`-${w}px ${w}px 0 ${c}`,
			`${w}px ${w}px 0 ${c}`,
		].join(",");
	}

	if (style.shadow) {
		const s = style.shadow;
		const shadowCss = `${s.offsetX}px ${s.offsetY}px ${s.blur}px ${s.color}`;
		if (base.textShadow) {
			base.textShadow += `, ${shadowCss}`;
		} else {
			base.textShadow = shadowCss;
		}
	}

	return base;
}

export function TextView() {
	const { t } = useTranslation();
	const editor = useEditor();
	const { selectedElements } = useElementSelection();

	const selectedTextElements = editor.timeline
		.getElementsWithTracks({ elements: selectedElements })
		.filter((item) => item.element.type === "text")
		.map((item) => item.element as TextElement);

	const handleTemplateClick = (template: TextTemplate) => {
		const activeScene = editor.scenes.getActiveScene();
		if (!activeScene) return;

		if (selectedTextElements.length > 0) {
			// Apply style to selected text element(s)
			const updates: Record<string, unknown> = {};
			const s = template.style;
			if (s.color !== undefined) updates.color = s.color;
			if (s.fontSize !== undefined) updates.fontSize = s.fontSize;
			if (s.fontWeight !== undefined) updates.fontWeight = s.fontWeight;
			if (s.fontFamily !== undefined) updates.fontFamily = s.fontFamily;
			if (s.backgroundColor !== undefined) updates.backgroundColor = s.backgroundColor;
			if (s.backgroundBorderRadius !== undefined) updates.backgroundBorderRadius = s.backgroundBorderRadius;
			if (s.backgroundOpacity !== undefined) updates.backgroundOpacity = s.backgroundOpacity;
			if (s.backgroundPaddingX !== undefined) updates.backgroundPaddingX = s.backgroundPaddingX;
			if (s.backgroundPaddingY !== undefined) updates.backgroundPaddingY = s.backgroundPaddingY;
			if (s.stroke !== undefined) updates.stroke = s.stroke;
			if (s.shadow !== undefined) updates.shadow = s.shadow;

			editor.timeline.updateElements({
				updates: selectedElements.map((ref) => ({
					trackId: ref.trackId,
					elementId: ref.elementId,
					updates,
				})),
				pushHistory: true,
			});
		} else {
			// Create new text element with style
			const element = buildTextElement({
				raw: {
					...template.style,
					content: t("Fancy text"),
				},
				startTime: editor.playback.getCurrentTime(),
			});

			editor.timeline.insertElement({
				element,
				placement: { mode: "auto" },
			});
		}
	};

	return (
		<div className="group relative">
			<OpenInEditor source="src/components/editor/panels/assets/views/text.tsx" line={8} />
			<BaseView>
				<div className="grid grid-cols-2 gap-3 p-3">
					{TEXT_TEMPLATES.map((template, index) => (
						<button
							type="button"
							key={index}
							title={template.name}
							onClick={() => handleTemplateClick(template)}
							className="relative flex aspect-square w-full cursor-pointer items-center justify-center overflow-hidden rounded-[4px] bg-[#f4f4f7] text-center transition-all hover:ring-2 hover:ring-[#683cfd] hover:ring-[1.5px]"
						>
								<span style={calcPreviewStyle(template)}>{t("Fancy text")}</span>
							</button>
						))}
					</div>
			</BaseView>
		</div>
	);
}
