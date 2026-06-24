export type OverlayType =
	| "rain"
	| "snow"
	| "sparkle"
	| "fire"
	| "smoke"
	| "firefly"
	| "bubble"
	| "confetti"
	| "shake";

export interface OverlayParams {
	type: OverlayType;
	density: number;
	speed: number;
	opacity: number;
	wind?: number;
	/** Used by shake: intensity of the shake in pixels */
	intensity?: number;
}

export const DEFAULT_OVERLAY_PARAMS: Record<OverlayType, OverlayParams> = {
	rain: {
		type: "rain",
		density: 200,
		speed: 8,
		opacity: 0.5,
		wind: 2,
	},
	snow: {
		type: "snow",
		density: 100,
		speed: 2,
		opacity: 0.7,
	},
	sparkle: {
		type: "sparkle",
		density: 50,
		speed: 1,
		opacity: 0.8,
	},
	fire: {
		type: "fire",
		density: 60,
		speed: 3,
		opacity: 0.7,
		wind: 1,
	},
	smoke: {
		type: "smoke",
		density: 30,
		speed: 1.5,
		opacity: 0.4,
		wind: 0.5,
	},
	firefly: {
		type: "firefly",
		density: 25,
		speed: 0.5,
		opacity: 0.9,
	},
	bubble: {
		type: "bubble",
		density: 20,
		speed: 1.5,
		opacity: 0.6,
		wind: 0.3,
	},
	confetti: {
		type: "confetti",
		density: 50,
		speed: 3,
		opacity: 0.9,
		wind: 2,
	},
	shake: {
		type: "shake",
		density: 0,
		speed: 0,
		opacity: 1,
		intensity: 6,
	},
};

export interface OverlayPreset {
	type: OverlayType;
	label: string;
	params: OverlayParams;
	previewColor: string;
	description: string;
	descriptionZh: string;
}

export const OVERLAY_PRESETS: OverlayPreset[] = [
	// Rain
	{
		type: "rain",
		label: "Rain",
		params: { type: "rain", density: 200, speed: 8, opacity: 0.5, wind: 2 },
		previewColor: "#4a6fa5",
		description: "Rainfall effect",
		descriptionZh: "下雨效果",
	},
	{
		type: "rain",
		label: "Heavy Rain",
		params: { type: "rain", density: 400, speed: 10, opacity: 0.6, wind: 3 },
		previewColor: "#2a4a7a",
		description: "Heavy downpour",
		descriptionZh: "暴雨效果",
	},
	{
		type: "rain",
		label: "Light Rain",
		params: { type: "rain", density: 80, speed: 5, opacity: 0.3, wind: 1 },
		previewColor: "#8aafd5",
		description: "Light drizzle",
		descriptionZh: "细雨效果",
	},

	// Snow
	{
		type: "snow",
		label: "Snow",
		params: { type: "snow", density: 100, speed: 2, opacity: 0.7 },
		previewColor: "#e8e8f0",
		description: "Gentle snowfall",
		descriptionZh: "下雪效果",
	},
	{
		type: "snow",
		label: "Blizzard",
		params: { type: "snow", density: 300, speed: 4, opacity: 0.8, wind: 3 },
		previewColor: "#c0c0d0",
		description: "Heavy blizzard",
		descriptionZh: "暴风雪效果",
	},
	{
		type: "snow",
		label: "Light Snow",
		params: { type: "snow", density: 40, speed: 1, opacity: 0.5 },
		previewColor: "#f5f5ff",
		description: "Light flurries",
		descriptionZh: "小雪效果",
	},

	// Sparkle
	{
		type: "sparkle",
		label: "Sparkle",
		params: { type: "sparkle", density: 50, speed: 1, opacity: 0.8 },
		previewColor: "#ffd700",
		description: "Magical sparkle particles",
		descriptionZh: "闪光粒子效果",
	},
	{
		type: "sparkle",
		label: "Heavy Sparkle",
		params: { type: "sparkle", density: 120, speed: 1.5, opacity: 0.9 },
		previewColor: "#ffec80",
		description: "Dense sparkle shower",
		descriptionZh: "密集闪光效果",
	},

	// Fire
	{
		type: "fire",
		label: "Fire",
		params: { type: "fire", density: 60, speed: 3, opacity: 0.7, wind: 1 },
		previewColor: "#ff4500",
		description: "Rising flame effect",
		descriptionZh: "火焰燃烧效果",
	},
	{
		type: "fire",
		label: "Campfire",
		params: { type: "fire", density: 40, speed: 2, opacity: 0.8, wind: 0.5 },
		previewColor: "#ff6b35",
		description: "Warm campfire glow",
		descriptionZh: "篝火温暖效果",
	},

	// Smoke
	{
		type: "smoke",
		label: "Smoke",
		params: { type: "smoke", density: 30, speed: 1.5, opacity: 0.4, wind: 0.5 },
		previewColor: "#888888",
		description: "Rising smoke effect",
		descriptionZh: "烟雾缭绕效果",
	},
	{
		type: "smoke",
		label: "Heavy Smoke",
		params: { type: "smoke", density: 60, speed: 1, opacity: 0.6, wind: 0.3 },
		previewColor: "#666666",
		description: "Dense smoke cloud",
		descriptionZh: "浓烟滚滚效果",
	},

	// Firefly
	{
		type: "firefly",
		label: "Fireflies",
		params: { type: "firefly", density: 25, speed: 0.5, opacity: 0.9 },
		previewColor: "#7cfc00",
		description: "Floating firefly glow",
		descriptionZh: "萤火虫飞舞效果",
	},
	{
		type: "firefly",
		label: "Pollen",
		params: { type: "firefly", density: 50, speed: 0.3, opacity: 0.6 },
		previewColor: "#f0e68c",
		description: "Floating pollen particles",
		descriptionZh: "花粉漂浮效果",
	},

	// Bubble
	{
		type: "bubble",
		label: "Bubbles",
		params: { type: "bubble", density: 20, speed: 1.5, opacity: 0.6, wind: 0.3 },
		previewColor: "#87ceeb",
		description: "Rising soap bubbles",
		descriptionZh: "气泡上升效果",
	},
	{
		type: "bubble",
		label: "Underwater",
		params: { type: "bubble", density: 40, speed: 2, opacity: 0.5, wind: 0.5 },
		previewColor: "#4682b4",
		description: "Underwater bubble stream",
		descriptionZh: "水下气泡效果",
	},

	// Confetti
	{
		type: "confetti",
		label: "Confetti",
		params: { type: "confetti", density: 50, speed: 3, opacity: 0.9, wind: 2 },
		previewColor: "#ff69b4",
		description: "Falling confetti celebration",
		descriptionZh: "五彩纸屑庆祝效果",
	},
	{
		type: "confetti",
		label: "Party",
		params: { type: "confetti", density: 100, speed: 4, opacity: 0.9, wind: 3 },
		previewColor: "#ff1493",
		description: "Intense party confetti",
		descriptionZh: "派对狂欢效果",
	},

	// Screen Shake
	{
		type: "shake",
		label: "Screen Shake",
		params: { type: "shake", density: 0, speed: 0, opacity: 1, intensity: 6 },
		previewColor: "#333333",
		description: "Camera shake effect",
		descriptionZh: "屏幕抖动效果",
	},
	{
		type: "shake",
		label: "Heavy Shake",
		params: { type: "shake", density: 0, speed: 0, opacity: 1, intensity: 12 },
		previewColor: "#111111",
		description: "Intense earthquake shake",
		descriptionZh: "强烈地震抖动效果",
	},
	{
		type: "shake",
		label: "Gentle Shake",
		params: { type: "shake", density: 0, speed: 0, opacity: 1, intensity: 3 },
		previewColor: "#555555",
		description: "Subtle vibration",
		descriptionZh: "轻微振动效果",
	},
];
