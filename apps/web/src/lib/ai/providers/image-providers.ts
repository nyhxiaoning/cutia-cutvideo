import { nanoBananaProvider } from "./nanobanana";
import { seedreamProvider } from "./seedream";
import { wanxiangImageProvider } from "./wanxiang";
import { agnesImageProvider } from "./agnes";
import type { AIImageProvider } from "./types";

export const IMAGE_PROVIDERS: AIImageProvider[] = [
	seedreamProvider,
	nanoBananaProvider,
	wanxiangImageProvider,
	agnesImageProvider,
];
