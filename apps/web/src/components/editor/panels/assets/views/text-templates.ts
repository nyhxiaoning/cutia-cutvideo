import type { TextElement } from "@/types/timeline";

export interface TextTemplate {
	name: string;
	style: Partial<Omit<TextElement, "type" | "id" | "startTime" | "trimStart" | "trimEnd" | "transform" | "opacity" | "duration" | "content">>;
}

export const TEXT_TEMPLATES: TextTemplate[] = [
	{
		name: "Default",
		style: {
			color: "#ffffff",
			fontSize: 24,
			fontWeight: "bold",
		},
	},
	{
		name: "Shadow",
		style: {
			color: "#ffffff",
			fontSize: 24,
			fontWeight: "bold",
			shadow: { color: "rgba(0,0,0,0.5)", offsetX: 2, offsetY: 2, blur: 4 },
		},
	},
	{
		name: "Stroke red",
		style: {
			color: "#ffdd00",
			fontSize: 24,
			fontWeight: "bold",
			stroke: { color: "#e53935", width: 3 },
		},
	},
	{
		name: "Blue bg",
		style: {
			color: "#ffffff",
			fontSize: 24,
			fontWeight: "bold",
			backgroundColor: "#1976d2",
			backgroundBorderRadius: 8,
			backgroundPaddingX: 12,
			backgroundPaddingY: 6,
		},
	},
	{
		name: "Dark bg",
		style: {
			color: "#ffffff",
			fontSize: 24,
			fontWeight: "bold",
			backgroundColor: "rgba(0,0,0,0.6)",
			backgroundBorderRadius: 8,
			backgroundPaddingX: 12,
			backgroundPaddingY: 6,
		},
	},
	{
		name: "Pink bold",
		style: {
			color: "#ff4081",
			fontSize: 24,
			fontWeight: "bold",
			stroke: { color: "#ffffff", width: 2 },
		},
	},
	{
		name: "Orange stroke",
		style: {
			color: "#ffffff",
			fontSize: 24,
			fontWeight: "bold",
			stroke: { color: "#ff6f00", width: 4 },
		},
	},
	{
		name: "Green bg",
		style: {
			color: "#ffffff",
			fontSize: 24,
			fontWeight: "bold",
			backgroundColor: "#2e7d32",
			backgroundBorderRadius: 4,
			backgroundPaddingX: 10,
			backgroundPaddingY: 4,
		},
	},
	{
		name: "Purple",
		style: {
			color: "#ce93d8",
			fontSize: 24,
			fontWeight: "bold",
			shadow: { color: "#7b1fa2", offsetX: 0, offsetY: 0, blur: 8 },
		},
	},
	{
		name: "Cyan stroke",
		style: {
			color: "#ffffff",
			fontSize: 24,
			fontWeight: "bold",
			stroke: { color: "#00bcd4", width: 3 },
			backgroundColor: "rgba(0,0,0,0.4)",
			backgroundBorderRadius: 8,
			backgroundPaddingX: 12,
			backgroundPaddingY: 6,
		},
	},

];
