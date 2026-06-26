export interface TScene {
	id: string;
	name: string;
	isMain: boolean;
	tracks: TimelineTrack[];
	bookmarks: number[];
	createdAt: Date;
	updatedAt: Date;
}

export type TrackType = "video" | "text" | "audio" | "sticker" | "overlay";

interface BaseTrack {
	id: string;
	name: string;
}

export interface VideoTrack extends BaseTrack {
	type: "video";
	elements: (VideoElement | ImageElement)[];
	transitions?: TrackTransition[];
	isMain: boolean;
	muted: boolean;
	hidden: boolean;
}

export interface TextTrack extends BaseTrack {
	type: "text";
	elements: TextElement[];
	hidden: boolean;
}

export interface AudioTrack extends BaseTrack {
	type: "audio";
	elements: AudioElement[];
	muted: boolean;
}

export interface StickerTrack extends BaseTrack {
	type: "sticker";
	elements: StickerElement[];
	hidden: boolean;
}

export interface OverlayTrack extends BaseTrack {
	type: "overlay";
	elements: OverlayElement[];
	hidden: boolean;
}

export type TimelineTrack = VideoTrack | TextTrack | AudioTrack | StickerTrack | OverlayTrack;

export interface Transform {
	scale: number;
	position: {
		x: number;
		y: number;
	};
	rotate: number;
	flipX?: boolean;
	flipY?: boolean;
}

// ---- Transitions ----

export type TransitionType =
	| "fade"
	| "dissolve"
	| "wipe-left"
	| "wipe-right"
	| "wipe-up"
	| "wipe-down"
	| "slide-left"
	| "slide-right"
	| "slide-up"
	| "slide-down"
	| "zoom-in"
	| "zoom-out"
	| "push-left"
	| "push-right"
	| "flash-black"
	| "blur-dissolve";

export interface TrackTransition {
	id: string;
	type: TransitionType;
	duration: number;
	fromElementId: string;
	toElementId: string;
}

interface BaseAudioElement extends BaseTimelineElement {
	type: "audio";
	volume: number;
	muted?: boolean;
	buffer?: AudioBuffer;
	playbackRate?: number;
	pan?: number; // -1 to 1, 0=center, 负值=左声道
	fadeInDuration?: number; // 淡入时长（秒）
	fadeOutDuration?: number; // 淡出时长（秒）
}

export interface UploadAudioElement extends BaseAudioElement {
	sourceType: "upload";
	mediaId: string;
}

export interface LibraryAudioElement extends BaseAudioElement {
	sourceType: "library";
	sourceUrl: string;
}

export type AudioElement = UploadAudioElement | LibraryAudioElement;

export type EasingType = "linear" | "ease-in" | "ease-out" | "ease-in-out";

export interface KeyframeDef {
	time: number;
	value: number;
	easing?: EasingType;
}

export interface ElementKeyframes {
	scale?: KeyframeDef[];
	positionX?: KeyframeDef[];
	positionY?: KeyframeDef[];
	rotate?: KeyframeDef[];
	opacity?: KeyframeDef[];
}

export interface CropRect {
	x: number; // 归一化 0~1，裁剪源画面左上角 X
	y: number; // 归一化 0~1，裁剪源画面左上角 Y
	width: number; // 归一化 0~1，裁剪宽度（1=全宽）
	height: number; // 归一化 0~1，裁剪高度（1=全高）
}

export type MaskShape = "none" | "circle" | "rounded-rect";

interface BaseTimelineElement {
	id: string;
	name: string;
	duration: number;
	startTime: number;
	trimStart: number;
	trimEnd: number;
	keyframes?: ElementKeyframes;
	crop?: CropRect;
	maskShape?: MaskShape;
	maskRadius?: number;
}

export interface VideoElement extends BaseTimelineElement {
	type: "video";
	mediaId: string;
	muted?: boolean;
	hidden?: boolean;
	transform: Transform;
	opacity: number;
	playbackRate?: number;
	reversed?: boolean;
	filter?: string;
	filterRange?: { start: number; end: number };
	pan?: number;
	fadeInDuration?: number;
	fadeOutDuration?: number;
}

export interface ImageElement extends BaseTimelineElement {
	type: "image";
	mediaId: string;
	hidden?: boolean;
	transform: Transform;
	opacity: number;
	filter?: string;
	filterRange?: { start: number; end: number };
}

export interface TextStroke {
	color: string;
	width: number;
}

export interface TextShadow {
	color: string;
	offsetX: number;
	offsetY: number;
	blur: number;
}

export interface TextElement extends BaseTimelineElement {
	type: "text";
	content: string;
	fontSize: number;
	fontFamily: string;
	color: string;
	backgroundColor: string;
	textAlign: "left" | "center" | "right";
	fontWeight: "normal" | "bold";
	fontStyle: "normal" | "italic";
	textDecoration: "none" | "underline" | "line-through";
	hidden?: boolean;
	transform: Transform;
	opacity: number;
	stroke?: TextStroke;
	shadow?: TextShadow;
	boxWidth?: number;
	backgroundBorderRadius?: number;
	backgroundOpacity?: number;
	backgroundPaddingX?: number;
	backgroundPaddingY?: number;
}

export interface StickerElement extends BaseTimelineElement {
	type: "sticker";
	iconName: string;
	hidden?: boolean;
	transform: Transform;
	opacity: number;
	color?: string;
}

export interface OverlayElement extends BaseTimelineElement {
	type: "overlay";
	overlayType:
		| "rain"
		| "snow"
		| "sparkle"
		| "fire"
		| "smoke"
		| "firefly"
		| "bubble"
		| "confetti"
		| "shake";
	density: number;
	speed: number;
	overlayOpacity: number;
	wind?: number;
	/** Used by shake overlay: intensity of shake in pixels */
	intensity?: number;
	hidden?: boolean;
}

export type TimelineElement =
	| AudioElement
	| VideoElement
	| ImageElement
	| TextElement
	| StickerElement
	| OverlayElement;

export type ElementType = TimelineElement["type"];

export type CreateUploadAudioElement = Omit<UploadAudioElement, "id">;
export type CreateLibraryAudioElement = Omit<LibraryAudioElement, "id">;
export type CreateAudioElement =
	| CreateUploadAudioElement
	| CreateLibraryAudioElement;
export type CreateVideoElement = Omit<VideoElement, "id">;
export type CreateImageElement = Omit<ImageElement, "id">;
export type CreateTextElement = Omit<TextElement, "id">;
export type CreateStickerElement = Omit<StickerElement, "id">;
export type CreateOverlayElement = Omit<OverlayElement, "id">;
export type CreateTimelineElement =
	| CreateAudioElement
	| CreateVideoElement
	| CreateImageElement
	| CreateTextElement
	| CreateStickerElement
	| CreateOverlayElement;

// ---- Drag State ----

export interface ElementDragState {
	isDragging: boolean;
	elementId: string | null;
	trackId: string | null;
	startMouseX: number;
	startMouseY: number;
	startElementTime: number;
	clickOffsetTime: number;
	currentTime: number;
	currentMouseY: number;
}

export interface DropTarget {
	trackIndex: number;
	isNewTrack: boolean;
	insertPosition: "above" | "below" | null;
	xPosition: number;
}

export interface ComputeDropTargetParams {
	elementType: ElementType;
	mouseX: number;
	mouseY: number;
	tracks: TimelineTrack[];
	playheadTime: number;
	isExternalDrop: boolean;
	elementDuration: number;
	pixelsPerSecond: number;
	zoomLevel: number;
	verticalDragDirection?: "up" | "down" | null;
	startTimeOverride?: number;
	excludeElementId?: string;
}

export interface ClipboardItem {
	trackId: string;
	trackType: TrackType;
	element: CreateTimelineElement;
}
