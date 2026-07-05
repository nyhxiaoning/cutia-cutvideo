import type { FaceLandmarkPoint } from "@/types/face-effect";

interface WarpOptions {
	source: TexImageSource;
	landmarks: FaceLandmarkPoint[];
	type: "big-head" | "left-cheek" | "right-cheek" | "eyes" | "nose" | "mouth";
	intensity: number;
	canvas: HTMLCanvasElement;
}

interface DisplacementAnchor {
	px: number;
	py: number;
	dx: number;
	dy: number;
	sigma: number;
}

function sampleBilinear(
	data: ImageData,
	x: number,
	y: number,
): [number, number, number, number] {
	const w = data.width;
	const h = data.height;
	const sx = Math.max(0, Math.min(w - 1, x));
	const sy = Math.max(0, Math.min(h - 1, y));
	const ix = Math.floor(sx);
	const iy = Math.floor(sy);
	const fx = sx - ix;
	const fy = sy - iy;
	const nx = Math.min(ix + 1, w - 1);
	const ny = Math.min(iy + 1, h - 1);

	const idx00 = (iy * w + ix) * 4;
	const idx10 = (iy * w + nx) * 4;
	const idx01 = (ny * w + ix) * 4;
	const idx11 = (ny * w + nx) * 4;

	const out: [number, number, number, number] = [0, 0, 0, 0];
	for (let c = 0; c < 4; c++) {
		const v00 = data.data[idx00 + c];
		const v10 = data.data[idx10 + c];
		const v01 = data.data[idx01 + c];
		const v11 = data.data[idx11 + c];
		out[c] =
			v00 * (1 - fx) * (1 - fy) +
			v10 * fx * (1 - fy) +
			v01 * (1 - fx) * fy +
			v11 * fx * fy;
	}
	return out;
}

function setPixel(
	data: ImageData,
	x: number,
	y: number,
	pixel: [number, number, number, number],
): void {
	if (x < 0 || x >= data.width || y < 0 || y >= data.height) return;
	const idx = (y * data.width + x) * 4;
	data.data[idx] = pixel[0];
	data.data[idx + 1] = pixel[1];
	data.data[idx + 2] = pixel[2];
	data.data[idx + 3] = pixel[3];
}

const FOREHEAD = [10, 109, 67, 103, 54, 21, 162];
const FACE_CONTOUR = [
	10, 338, 297, 332, 284, 251, 389, 356, 454, 323, 361, 288,
	397, 365, 379, 378, 400, 377, 152, 148, 176, 149, 150, 136,
	172, 58, 132, 93, 234, 127, 162, 21, 54, 103, 67, 109,
];
const LEFT_CHEEK = [234, 93, 132, 58, 172, 136, 150, 149, 176, 148];
const RIGHT_CHEEK = [454, 323, 361, 288, 397, 365, 379, 378, 400, 377];
const LEFT_EYE = [33, 7, 163, 144, 145, 153, 154, 155, 133, 173, 157, 158, 159, 160, 161, 246];
const RIGHT_EYE = [362, 382, 381, 380, 374, 373, 390, 249, 263, 466, 388, 387, 386, 385, 384, 398];
const NOSE = [
	168, 6, 197, 195, 5, 4, 1, 19, 94, 2, 98, 97, 20,
	48, 49, 279, 278, 415, 310, 311, 237, 238, 239, 27,
	45, 44, 43, 420, 421, 430, 431, 432, 3, 248, 281, 440, 445, 342, 345,
];
const LIPS_OUTER = [61, 146, 91, 181, 84, 17, 314, 405, 321, 375, 291, 409, 270, 269, 267, 0];
const JAW = [152, 148, 176, 149, 150, 136, 172];

// -- Warp dispatch (works at 25% resolution, then scales back up) --
export function warpImage(options: WarpOptions): HTMLCanvasElement {
	const { source, landmarks, type, intensity, canvas } = options;

	const img = source as CanvasImageSource;
	const naturalWidth =
		"naturalWidth" in img
			? (img.naturalWidth as number)
			: "width" in img
				? (img.width as number)
				: canvas.width;
	const naturalHeight =
		"naturalHeight" in img
			? (img.naturalHeight as number)
			: "height" in img
				? (img.height as number)
				: canvas.height;

	canvas.width = naturalWidth;
	canvas.height = naturalHeight;
	const ctx = canvas.getContext("2d");
	if (!ctx) return canvas;

	ctx.drawImage(img, 0, 0, naturalWidth, naturalHeight);
	if (intensity < 0.01) return canvas;

	const builders: Record<string, typeof buildHeadAnchors> = {
		"big-head": buildHeadAnchors,
		"left-cheek": buildLeftCheekAnchors,
		"right-cheek": buildRightCheekAnchors,
		eyes: buildEyesAnchors,
		nose: buildNoseAnchors,
		mouth: buildMouthAnchors,
	};

	const buildFn = builders[type];
	if (!buildFn) return canvas;

	const anchors = buildFn(landmarks, intensity, naturalWidth, naturalHeight);
	if (anchors.length === 0) return canvas;

	// Downsample, warp, then scale back up — ~16x faster, visually identical
	const scale = 0.25;
	const sw = Math.round(naturalWidth * scale);
	const sh = Math.round(naturalHeight * scale);

	const miniCanvas = document.createElement("canvas");
	miniCanvas.width = sw;
	miniCanvas.height = sh;
	const miniCtx = miniCanvas.getContext("2d");
	if (!miniCtx) return canvas;

	miniCtx.drawImage(canvas, 0, 0, sw, sh);

	const scaledAnchors = anchors.map((a) => ({
		...a,
		px: a.px * scale,
		py: a.py * scale,
		dx: a.dx * scale,
		dy: a.dy * scale,
		sigma: a.sigma * scale,
	}));

	applyWarp(miniCtx, scaledAnchors, sw, sh);

	ctx.clearRect(0, 0, naturalWidth, naturalHeight);
	ctx.imageSmoothingEnabled = true;
	ctx.drawImage(miniCanvas, 0, 0, naturalWidth, naturalHeight);

	return canvas;
}

// ---------------------------------------------------------------------------
// Displacement solver (works on ImageData, mutates ctx)
// ---------------------------------------------------------------------------
function applyWarp(
	ctx: CanvasRenderingContext2D,
	anchors: DisplacementAnchor[],
	w: number,
	h: number,
): void {
	let minX = Infinity;
	let maxX = -Infinity;
	let minY = Infinity;
	let maxY = -Infinity;
	for (const a of anchors) {
		const r = a.sigma * 3;
		if (a.px - r < minX) minX = a.px - r;
		if (a.px + r > maxX) maxX = a.px + r;
		if (a.py - r < minY) minY = a.py - r;
		if (a.py + r > maxY) maxY = a.py + r;
	}
	minX = Math.max(0, Math.floor(minX));
	maxX = Math.min(w, Math.ceil(maxX));
	minY = Math.max(0, Math.floor(minY));
	maxY = Math.min(h, Math.ceil(maxY));
	if (minX >= maxX || minY >= maxY) return;

	const data = ctx.getImageData(0, 0, w, h);
	const aData = anchors.map((a) => ({ ...a, sigmaSq: a.sigma * a.sigma }));

	for (let py = minY; py < maxY; py++) {
		for (let px = minX; px < maxX; px++) {
			let tdx = 0;
			let tdy = 0;
			let tw = 0;
			for (const a of aData) {
				const dx = px - a.px;
				const dy = py - a.py;
				const wgt = Math.exp(-(dx * dx + dy * dy) / (2 * a.sigmaSq));
				tdx += a.dx * wgt;
				tdy += a.dy * wgt;
				tw += wgt;
			}
			if (tw < 0.001) continue;
			const inv = 1 / tw;
			const sx = px - tdx * inv;
			const sy = py - tdy * inv;
			if (sx < 0 || sx >= w || sy < 0 || sy >= h) continue;
			setPixel(data, px, py, sampleBilinear(data, sx, sy));
		}
	}
	ctx.putImageData(data, 0, 0);
}

// ---------------------------------------------------------------------------
// Shared helpers
// ---------------------------------------------------------------------------
function faceBBox(landmarks: FaceLandmarkPoint[]) {
	const n = landmarks.length;
	let minX = 1, maxX = 0, minY = 1, maxY = 0;
	for (const idx of FACE_CONTOUR) {
		if (idx < n) {
			const p = landmarks[idx];
			if (p.x < minX) minX = p.x;
			if (p.x > maxX) maxX = p.x;
			if (p.y < minY) minY = p.y;
			if (p.y > maxY) maxY = p.y;
		}
	}
	return { minX, maxX, minY, maxY };
}

function faceCenterSize(landmarks: FaceLandmarkPoint[], w: number, h: number) {
	const bb = faceBBox(landmarks);
	const cx = ((bb.minX + bb.maxX) / 2) * w;
	const cy = ((bb.minY + bb.maxY) / 2) * h;
	const fw = (bb.maxX - bb.minX) * w;
	const fh = (bb.maxY - bb.minY) * h;
	const radius = Math.max(fw, fh) * 0.5;
	return { cx, cy, fw, fh, radius };
}

function zeroAnchors(indices: number[], landmarks: FaceLandmarkPoint[], sigma: number, w: number, h: number) {
	const anchors: DisplacementAnchor[] = [];
	for (const idx of indices) {
		if (idx >= landmarks.length) continue;
		anchors.push({ px: landmarks[idx].x * w, py: landmarks[idx].y * h, dx: 0, dy: 0, sigma });
	}
	return anchors;
}

function edgeAnchors(cx: number, cy: number, rw: number, rh: number, sigma: number, w: number, h: number) {
	const pts = [
		{ x: cx - rw, y: cy }, { x: cx + rw, y: cy },
		{ x: cx, y: cy - rh }, { x: cx, y: cy + rh },
		{ x: cx - rw, y: cy - rh }, { x: cx + rw, y: cy - rh },
		{ x: cx - rw, y: cy + rh }, { x: cx + rw, y: cy + rh },
	];
	return pts.map((p) => ({
		px: Math.max(0, Math.min(w, p.x)),
		py: Math.max(0, Math.min(h, p.y)),
		dx: 0, dy: 0, sigma,
	}));
}

// ---------------------------------------------------------------------------
// 1. Big Head
// ---------------------------------------------------------------------------
function buildHeadAnchors(
	landmarks: FaceLandmarkPoint[],
	intensity: number,
	w: number,
	h: number,
): DisplacementAnchor[] {
	const { cx, cy, fw, fh, radius } = faceCenterSize(landmarks, w, h);
	if (radius < 1) return [];
	const n = landmarks.length;
	const factor = intensity * 0.45;
	const anchors: DisplacementAnchor[] = [];

	const contourSigma = radius * 0.18;
	for (const idx of FACE_CONTOUR) {
		if (idx >= n) continue;
		const p = landmarks[idx];
		const px = p.x * w, py = p.y * h;
		const dx = px - cx, dy = py - cy;
		const dist = Math.sqrt(dx * dx + dy * dy) || 1;
		const norm = dist / radius;
		const str = (1 - norm * 0.25) * factor;
		const push = dist * str;
		anchors.push({ px, py, dx: (dx / dist) * push, dy: (dy / dist) * push, sigma: contourSigma });
	}

	const fhSigma = radius * 0.12;
	for (const idx of FOREHEAD) {
		if (idx >= n) continue;
		const p = landmarks[idx];
		const px = p.x * w, py = p.y * h;
		const dx = px - cx, dy = py - cy;
		const dist = Math.sqrt(dx * dx + dy * dy) || 1;
		const push = dist * factor * 1.2;
		anchors.push({ px, py, dx: (dx / dist) * push, dy: (dy / dist) * push * 1.4, sigma: fhSigma });
	}

	const cheekSigma = radius * 0.15;
	for (const idx of [...LEFT_CHEEK, ...RIGHT_CHEEK]) {
		if (idx >= n) continue;
		const p = landmarks[idx];
		const px = p.x * w, py = p.y * h;
		const dx = px - cx, dy = py - cy;
		const dist = Math.sqrt(dx * dx + dy * dy) || 1;
		const push = dist * factor * 0.8;
		anchors.push({ px, py, dx: (dx / dist) * push, dy: (dy / dist) * push * 0.3, sigma: cheekSigma });
	}

	const jawSigma = radius * 0.13;
	for (const idx of JAW) {
		if (idx >= n) continue;
		const p = landmarks[idx];
		const px = p.x * w, py = p.y * h;
		const dy = py - cy;
		const push = Math.max(0, dy / radius) * factor * radius * 0.25;
		anchors.push({ px, py, dx: 0, dy: push, sigma: jawSigma });
	}

	const stableSigma = radius * 0.07;
	anchors.push(...zeroAnchors(
		[...LEFT_EYE, ...RIGHT_EYE, 46, 53, 52, 65, 55, 285, 295, 282, 283, 276, ...NOSE, ...LIPS_OUTER],
		landmarks, stableSigma, w, h));

	anchors.push(...edgeAnchors(cx, cy, fw * 2, fh * 2, radius * 0.5, w, h));
	return anchors;
}

// ---------------------------------------------------------------------------
// 2. Left Cheek
// ---------------------------------------------------------------------------
function buildLeftCheekAnchors(
	landmarks: FaceLandmarkPoint[],
	intensity: number,
	w: number,
	h: number,
): DisplacementAnchor[] {
	const { cx, fw, radius } = faceCenterSize(landmarks, w, h);
	if (radius < 1) return [];
	const n = landmarks.length;
	const factor = intensity * 0.4;
	const sigma = radius * 0.15;
	const anchors: DisplacementAnchor[] = [];

	for (const idx of LEFT_CHEEK) {
		if (idx >= n) continue;
		const p = landmarks[idx];
		const px = p.x * w, py = p.y * h;
		const distFromCenter = Math.max(0, (cx - px) / fw);
		const str = Math.min(1, distFromCenter * 5);
		const push = -fw * factor * 0.18 * str;
		anchors.push({ px, py, dx: push, dy: push * 0.12, sigma });
	}

	const stableS = radius * 0.06;
	anchors.push(...zeroAnchors(
		[...LEFT_EYE, ...RIGHT_EYE, ...NOSE, ...LIPS_OUTER], landmarks, stableS, w, h));
	return anchors;
}

// ---------------------------------------------------------------------------
// 3. Right Cheek
// ---------------------------------------------------------------------------
function buildRightCheekAnchors(
	landmarks: FaceLandmarkPoint[],
	intensity: number,
	w: number,
	h: number,
): DisplacementAnchor[] {
	const { cx, fw, radius } = faceCenterSize(landmarks, w, h);
	if (radius < 1) return [];
	const n = landmarks.length;
	const factor = intensity * 0.4;
	const sigma = radius * 0.15;
	const anchors: DisplacementAnchor[] = [];

	for (const idx of RIGHT_CHEEK) {
		if (idx >= n) continue;
		const p = landmarks[idx];
		const px = p.x * w, py = p.y * h;
		const distFromCenter = Math.max(0, (px - cx) / fw);
		const str = Math.min(1, distFromCenter * 5);
		const push = fw * factor * 0.18 * str;
		anchors.push({ px, py, dx: push, dy: push * 0.12, sigma });
	}

	const stableS = radius * 0.06;
	anchors.push(...zeroAnchors(
		[...LEFT_EYE, ...RIGHT_EYE, ...NOSE, ...LIPS_OUTER], landmarks, stableS, w, h));
	return anchors;
}

// ---------------------------------------------------------------------------
// 4. Eyes
// ---------------------------------------------------------------------------
function buildEyesAnchors(
	landmarks: FaceLandmarkPoint[],
	intensity: number,
	w: number,
	h: number,
): DisplacementAnchor[] {
	const { radius } = faceCenterSize(landmarks, w, h);
	if (radius < 1) return [];
	const n = landmarks.length;
	const factor = intensity * 0.3;
	const anchors: DisplacementAnchor[] = [];

	let lcx = 0, lcy = 0, lc = 0;
	for (const idx of LEFT_EYE) {
		if (idx >= n) continue;
		lcx += landmarks[idx].x * w; lcy += landmarks[idx].y * h; lc++;
	}
	lcx /= lc; lcy /= lc;
	const lEyeSize = radius * 0.12;

	let rcx = 0, rcy = 0, rc = 0;
	for (const idx of RIGHT_EYE) {
		if (idx >= n) continue;
		rcx += landmarks[idx].x * w; rcy += landmarks[idx].y * h; rc++;
	}
	rcx /= rc; rcy /= rc;
	const rEyeSize = radius * 0.12;

	const eyeSigma = radius * 0.06;
	for (const idx of LEFT_EYE) {
		if (idx >= n) continue;
		const p = landmarks[idx];
		const px = p.x * w, py = p.y * h;
		const dx = px - lcx, dy = py - lcy;
		const dist = Math.sqrt(dx * dx + dy * dy) || 1;
		const push = lEyeSize * factor * 1.2;
		anchors.push({ px, py, dx: (dx / dist) * push, dy: (dy / dist) * push, sigma: eyeSigma });
	}
	for (const idx of RIGHT_EYE) {
		if (idx >= n) continue;
		const p = landmarks[idx];
		const px = p.x * w, py = p.y * h;
		const dx = px - rcx, dy = py - rcy;
		const dist = Math.sqrt(dx * dx + dy * dy) || 1;
		const push = rEyeSize * factor * 1.2;
		anchors.push({ px, py, dx: (dx / dist) * push, dy: (dy / dist) * push, sigma: eyeSigma });
	}

	const browSigma = radius * 0.08;
	for (const idx of [...[46, 53, 52, 65, 55], ...[285, 295, 282, 283, 276]]) {
		if (idx >= n) continue;
		const p = landmarks[idx];
		const px = p.x * w, py = p.y * h;
		anchors.push({ px, py, dx: 0, dy: -lEyeSize * factor * 0.5, sigma: browSigma });
	}

	const stableS = radius * 0.05;
	anchors.push(...zeroAnchors(
		[...FACE_CONTOUR, ...NOSE, ...LIPS_OUTER], landmarks, stableS, w, h));
	anchors.push(...edgeAnchors(rcx, lcy, radius * 2, radius * 2, radius * 0.3, w, h));
	return anchors;
}

// ---------------------------------------------------------------------------
// 5. Nose
// ---------------------------------------------------------------------------
function buildNoseAnchors(
	landmarks: FaceLandmarkPoint[],
	intensity: number,
	w: number,
	h: number,
): DisplacementAnchor[] {
	const { cx, cy, radius } = faceCenterSize(landmarks, w, h);
	if (radius < 1) return [];
	const n = landmarks.length;
	const factor = intensity * 0.3;
	const anchors: DisplacementAnchor[] = [];

	let ncx = 0, ncy = 0, nc = 0;
	for (const idx of NOSE) {
		if (idx >= n) continue;
		ncx += landmarks[idx].x * w; ncy += landmarks[idx].y * h; nc++;
	}
	ncx /= nc; ncy /= nc;
	const noseSigma = radius * 0.1;

	for (const idx of NOSE) {
		if (idx >= n) continue;
		const p = landmarks[idx];
		const px = p.x * w, py = p.y * h;
		const dx = px - ncx, dy = py - ncy;
		const dist = Math.sqrt(dx * dx + dy * dy) || 1;
		const push = dist * factor * 1.0;
		anchors.push({ px, py, dx: (dx / dist) * push, dy: (dy / dist) * push, sigma: noseSigma });
	}

	const stableS = radius * 0.06;
	anchors.push(...zeroAnchors(
		[...LEFT_EYE, ...RIGHT_EYE, ...LIPS_OUTER, ...FACE_CONTOUR], landmarks, stableS, w, h));
	anchors.push(...edgeAnchors(cx, cy, radius * 1.5, radius * 1.5, radius * 0.35, w, h));
	return anchors;
}

// ---------------------------------------------------------------------------
// 6. Mouth
// ---------------------------------------------------------------------------
function buildMouthAnchors(
	landmarks: FaceLandmarkPoint[],
	intensity: number,
	w: number,
	h: number,
): DisplacementAnchor[] {
	const { cx, cy, radius } = faceCenterSize(landmarks, w, h);
	if (radius < 1) return [];
	const n = landmarks.length;
	const factor = intensity * 0.35;
	const anchors: DisplacementAnchor[] = [];

	let mcx = 0, mcy = 0, mc = 0;
	for (const idx of LIPS_OUTER) {
		if (idx >= n) continue;
		mcx += landmarks[idx].x * w; mcy += landmarks[idx].y * h; mc++;
	}
	mcx /= mc; mcy /= mc;
	const mouthSigma = radius * 0.07;

	for (const idx of LIPS_OUTER) {
		if (idx >= n) continue;
		const p = landmarks[idx];
		const px = p.x * w, py = p.y * h;
		const dx = px - mcx, dy = py - mcy;
		const dist = Math.sqrt(dx * dx + dy * dy) || 1;
		const push = dist * factor * 1.5;
		anchors.push({ px, py, dx: (dx / dist) * push, dy: (dy / dist) * push, sigma: mouthSigma });
	}

	const stableS = radius * 0.05;
	anchors.push(...zeroAnchors(
		[...LEFT_EYE, ...RIGHT_EYE, ...NOSE, ...FACE_CONTOUR], landmarks, stableS, w, h));
	anchors.push(...edgeAnchors(cx, cy, radius, radius, radius * 0.3, w, h));
	return anchors;
}
