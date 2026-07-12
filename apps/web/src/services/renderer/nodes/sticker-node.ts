import type { CanvasRenderer } from "../canvas-renderer";
import { VisualNode, type VisualNodeParams } from "./visual-node";

export interface StickerNodeParams extends VisualNodeParams {
	iconName: string;
	color?: string;
	url?: string;
}

export class StickerNode extends VisualNode<StickerNodeParams> {
	private image?: HTMLImageElement;
	private readyPromise: Promise<void>;

	constructor(params: StickerNodeParams) {
		super(params);
		this.readyPromise = this.load();
	}

	private async load() {
		const image = new Image();
		image.crossOrigin = "anonymous";
		this.image = image;

		if (this.params.url) {
			// Uploaded image sticker
			image.src = this.params.url;
		} else {
			// Iconify sticker
			const color = this.params.color
				? `&color=${encodeURIComponent(this.params.color)}`
				: "";
			image.src = `https://api.iconify.design/${this.params.iconName}.svg?width=200&height=200${color}`;
		}

		await new Promise<void>((resolve, reject) => {
			image.onload = () => resolve();
			image.onerror = () =>
				reject(new Error(`Failed to load sticker: ${this.params.iconName}`));
		});
	}

	async render({ renderer, time }: { renderer: CanvasRenderer; time: number }) {
		await super.render({ renderer, time });

		if (!this.isInRange(time)) {
			return;
		}

		await this.readyPromise;

		if (!this.image) {
			return;
		}

		this.renderVisual({
			renderer,
			source: this.image,
			sourceWidth: this.image.naturalWidth || 200,
			sourceHeight: this.image.naturalHeight || 200,
			elementLocalTime: time - this.params.timeOffset,
		});
	}
}
