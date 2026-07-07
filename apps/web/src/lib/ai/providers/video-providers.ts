import { seedanceProvider } from "./seedance";
import { wanxiangVideoProvider } from "./wanxiang";
import { agnesVideoProvider } from "./agnes";
import type { AIVideoProvider } from "./types";

export const VIDEO_PROVIDERS: AIVideoProvider[] = [
	seedanceProvider,
	wanxiangVideoProvider,
	agnesVideoProvider,
];
