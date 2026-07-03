import type { FaceLandmarkPoint } from "@/types/face-effect";
import { type Point, delaunayTriangulation } from "./delaunay";

interface WarpOptions {
	source: TexImageSource;
	landmarks: FaceLandmarkPoint[];
	type: "big-head" | "big-face";
	intensity: number;
	canvas: HTMLCanvasElement;
}

const VERTEX_SHADER_SOURCE = `
attribute vec2 aPosition;
attribute vec2 aTexCoord;
varying vec2 vTexCoord;

void main() {
	gl_Position = vec4(aPosition, 0.0, 1.0);
	vTexCoord = aTexCoord;
}
`;

const FRAGMENT_SHADER_SOURCE = `
precision mediump float;
varying vec2 vTexCoord;
uniform sampler2D uTexture;

void main() {
	gl_FragColor = texture2D(uTexture, vTexCoord);
}
`;

function compileShader(
	gl: WebGLRenderingContext,
	source: string,
	type: number,
): WebGLShader {
	const shader = gl.createShader(type);
	if (!shader) throw new Error("Failed to create shader");

	gl.shaderSource(shader, source);
	gl.compileShader(shader);

	if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
		const info = gl.getShaderInfoLog(shader);
		gl.deleteShader(shader);
		throw new Error(`Shader compile error: ${info}`);
	}

	return shader;
}

function createProgram(
	gl: WebGLRenderingContext,
	vertSrc: string,
	fragSrc: string,
): WebGLProgram {
	const vertShader = compileShader(gl, vertSrc, gl.VERTEX_SHADER);
	const fragShader = compileShader(gl, fragSrc, gl.FRAGMENT_SHADER);

	const program = gl.createProgram();
	if (!program) throw new Error("Failed to create program");

	gl.attachShader(program, vertShader);
	gl.attachShader(program, fragShader);
	gl.linkProgram(program);

	if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
		const info = gl.getProgramInfoLog(program);
		gl.deleteProgram(program);
		throw new Error(`Program link error: ${info}`);
	}

	return program;
}

// Face landmark indices used to identify the head region
const HEAD_REGION_INDICES = new Set([
	10, 338, 297, 332, 284, 251, 389, 356, 454, 323, 361, 288,
	397, 365, 379, 378, 400, 377, 152, 148, 176, 149, 150, 136,
	172, 58, 132, 93, 234, 127, 162, 21, 54, 103, 67, 109,
]);

// Additional points for stabilizing the boundary (shoulders, background)
const BOUNDARY_INDICES = new Set([
	10, 109, 67, 103, 54, 21, 162, 127, 234,
]);

function computeHeadCenter(landmarks: FaceLandmarkPoint[]): { x: number; y: number } {
	let cx = 0;
	let cy = 0;
	let count = 0;

	for (const idx of HEAD_REGION_INDICES) {
		if (idx < landmarks.length) {
			cx += landmarks[idx].x;
			cy += landmarks[idx].y;
			count++;
		}
	}

	return { x: cx / count, y: cy / count };
}

function computeBodyCenter(
	landmarks: FaceLandmarkPoint[],
	neckY: number,
): { x: number; y: number } {
	// Use lower face contour points as a proxy for "body anchor"
	let cx = 0;
	let cy = 0;
	let count = 0;

	for (const idx of [152, 377, 378, 379, 400, 365, 397, 288]) {
		if (idx < landmarks.length) {
			cx += landmarks[idx].x;
			cy += landmarks[idx].y;
			count++;
		}
	}

	return count > 0 ? { x: cx / count, y: cy / count } : { x: 0.5, y: neckY };
}

function getCheekLandmarks(
	landmarks: FaceLandmarkPoint[],
): { indices: number[]; centerX: number } {
	// Left cheek: 234 to 152 area, Right cheek: 454 to 152 area
	const leftCheek = [234, 93, 132, 58, 172, 136, 150, 149, 176, 148];
	const rightCheek = [454, 323, 361, 288, 397, 365, 379, 378, 400, 377];

	const allIndices = [...leftCheek, ...rightCheek];
	const validIndices = allIndices.filter((i) => i < landmarks.length);

	// Center X is the midpoint between leftmost and rightmost cheek points
	let minX = 1;
	let maxX = 0;
	for (const idx of validIndices) {
		if (idx < landmarks.length) {
			if (landmarks[idx].x < minX) minX = landmarks[idx].x;
			if (landmarks[idx].x > maxX) maxX = landmarks[idx].x;
		}
	}

	return {
		indices: validIndices,
		centerX: (minX + maxX) / 2,
	};
}

function computeWarpedPositions(
	landmarks: FaceLandmarkPoint[],
	type: "big-head" | "big-face",
	intensity: number,
): Point[] {
	// MediaPipe landmarks are already normalized [0, 1].
	// Convert to WebGL space [-1, 1] for the BASE (un-warped) positions.
	const points: Point[] = landmarks.map((lm) => ({
		x: lm.x * 2 - 1,
		y: -(lm.y * 2 - 1),
	}));

	const factor = intensity;
	if (factor < 0.01) return points;

	if (type === "big-head") {
		// Head center in [0, 1] space
		const headCenter = computeHeadCenter(landmarks);
		const headCenterN = {
			x: headCenter.x * 2 - 1,
			y: -(headCenter.y * 2 - 1),
		};

		// Chin and crown Y in [0, 1]
		let chinY = 0;
		for (const idx of [152, 377, 378, 400]) {
			if (idx < landmarks.length) {
				if (landmarks[idx].y > chinY) chinY = landmarks[idx].y;
			}
		}
		const topY = landmarks[10]?.y ?? 0;

		// Head radius in WebGL units (y range is [-1, 1], so multiply by 1 -> full range)
		const headRadiusPixels = Math.abs(chinY - topY);
		const headRadius = headRadiusPixels * 2;

		for (let i = 0; i < landmarks.length; i++) {
			const p = points[i];
			const dx = p.x - headCenterN.x;
			const dy = p.y - headCenterN.y;
			const dist = Math.sqrt(dx * dx + dy * dy);

			if (dist < headRadius && dist > 0.001) {
				const strength = (1 - dist / headRadius) * factor * 0.5;
				points[i] = {
					x: p.x + dx * strength,
					y: p.y + dy * strength,
				};
			} else if (dist < headRadius * 1.3) {
				const edgeDist = dist - headRadius;
				const blendRadius = headRadius * 0.3;
				const blendFactor = Math.max(0, 1 - edgeDist / blendRadius);
				const strength = blendFactor * factor * 0.15;
				points[i] = {
					x: p.x + dx * strength,
					y: p.y + dy * strength,
				};
			}
		}
	} else if (type === "big-face") {
		const { centerX, indices: cheekIndices } = getCheekLandmarks(landmarks);
		const centerXN = centerX * 2 - 1;

		// Face vertical range in WebGL Y
		let minFaceY = 1;
		let maxFaceY = -1;
		const faceIndices = [...HEAD_REGION_INDICES];

		for (const idx of faceIndices) {
			if (idx < landmarks.length) {
				const ny = -(landmarks[idx].y * 2 - 1);
				if (ny < minFaceY) minFaceY = ny;
				if (ny > maxFaceY) maxFaceY = ny;
			}
		}

		for (const idx of cheekIndices) {
			if (idx >= landmarks.length) continue;
			const p = points[idx];
			const dx = p.x - centerXN;
			const dy = p.y - (minFaceY + maxFaceY) / 2;

			const faceHeight = maxFaceY - minFaceY || 0.01;
			const normalizedDY = Math.abs(dy) / faceHeight;

			const vertFade = Math.max(0, 1 - normalizedDY * 2);
			const direction = dx > 0 ? 1 : -1;
			const expansion = direction * factor * 0.3 * (1 - vertFade * 0.5);

			points[idx] = {
				x: p.x + expansion,
				y: p.y,
			};
		}

		// Smooth adjacent landmarks near cheek regions
		const adjacentToCheeks = [
			127, 162, 21, 54, 103, 67, 109, 10,
			323, 361, 288, 397, 365, 379, 378, 400,
			377, 152, 148, 176, 149, 150, 136, 172, 58, 132, 93,
		];
		for (const idx of adjacentToCheeks) {
			if (idx >= landmarks.length) continue;
			if (cheekIndices.includes(idx)) continue;
			const p = points[idx];

			for (const cheekIdx of cheekIndices) {
				const cheekP = points[cheekIdx];
				const dx = cheekP.x - p.x;
				const dy = cheekP.y - p.y;
				const dist = Math.sqrt(dx * dx + dy * dy);

				if (dist < 0.15) {
					const smoothFactor = Math.max(0, 1 - dist / 0.15) * 0.3;
					// Reference the un-warped cheek X to compute delta
					const cheekOrigX = (landmarks[cheekIdx].x * 2 - 1);
					const delta = cheekP.x - cheekOrigX;
					points[idx] = {
						x: p.x + delta * smoothFactor,
						y: p.y,
					};
				}
			}
		}
	}

	return points;
}

/**
 * Anchor points along the image boundary so the triangulation
 * covers the full canvas, not just the face region.
 * 4 corners + 4 edge midpoints = 8 anchors.
 */
function buildAnchorPoints(): Point[] {
	return [
		{ x: -1, y: -1 },
		{ x: 1, y: -1 },
		{ x: -1, y: 1 },
		{ x: 1, y: 1 },
		{ x: 0, y: -1 },
		{ x: 1, y: 0 },
		{ x: 0, y: 1 },
		{ x: -1, y: 0 },
	];
}

export function warpImage(options: WarpOptions): HTMLCanvasElement {
	const { source, landmarks, type, intensity, canvas } = options;

	const imageWidth = "width" in source ? (source.width as number) : ("naturalWidth" in source ? (source.naturalWidth as number) : canvas.width);
	const imageHeight = "height" in source ? (source.height as number) : ("naturalHeight" in source ? (source.naturalHeight as number) : canvas.height);

	// Convert face landmarks to WebGL normalized space [-1, 1]
	// MediaPipe landmarks are already normalized [0, 1]
	const faceCount = landmarks.length;
	const facePoints: Point[] = landmarks.map((lm) => ({
		x: lm.x * 2 - 1,
		y: -(lm.y * 2 - 1),
	}));

	// Append 8 boundary anchor points so the mesh covers the full image
	const anchors = buildAnchorPoints();
	const allPoints = [...facePoints, ...anchors];

	// Compute triangles from ALL points (face landmarks + boundary anchors)
	const triangles = delaunayTriangulation(allPoints);

	// Compute warped vertex positions (only for face landmarks)
	const warpedFacePoints = computeWarpedPositions(
		landmarks,
		type,
		intensity,
	);

	// Combine warped face points + identity anchors = full set
	const allWarpedPoints: Point[] = [
		...warpedFacePoints,
		// anchors stay in original position (no warp)
		...anchors,
	];

	// Build interleaved vertex data: [posX, posY, texU, texV]
	// For UV coords, use the ORIGINAL (pre-warp) position of each point
	const vertexData: number[] = [];
	const indices: number[] = [];

	for (const tri of triangles) {
		const v0 = allWarpedPoints[tri.v0];
		const v1 = allWarpedPoints[tri.v1];
		const v2 = allWarpedPoints[tri.v2];
		const uv0 = allPoints[tri.v0]; // original = UV
		const uv1 = allPoints[tri.v1];
		const uv2 = allPoints[tri.v2];

		const baseIdx = vertexData.length / 4;

		vertexData.push(v0.x, v0.y, uv0.x * 0.5 + 0.5, uv0.y * 0.5 + 0.5);
		vertexData.push(v1.x, v1.y, uv1.x * 0.5 + 0.5, uv1.y * 0.5 + 0.5);
		vertexData.push(v2.x, v2.y, uv2.x * 0.5 + 0.5, uv2.y * 0.5 + 0.5);

		indices.push(baseIdx, baseIdx + 1, baseIdx + 2);
	}

	// Setup WebGL
	const gl = canvas.getContext("webgl", {
		premultipliedAlpha: false,
		alpha: false,
	});

	if (!gl) {
		// Fallback: just draw source image as-is
		const ctx = canvas.getContext("2d");
		if (ctx) {
			canvas.width = imageWidth;
			canvas.height = imageHeight;
			ctx.drawImage(source, 0, 0, imageWidth, imageHeight);
		}
		return canvas;
	}

	// Set canvas size
	canvas.width = imageWidth;
	canvas.height = imageHeight;
	gl.viewport(0, 0, imageWidth, imageHeight);

	// Create shader program
	const program = createProgram(gl, VERTEX_SHADER_SOURCE, FRAGMENT_SHADER_SOURCE);
	gl.useProgram(program);

	// Create and upload vertex buffer
	const vertexBuffer = gl.createBuffer();
	gl.bindBuffer(gl.ARRAY_BUFFER, vertexBuffer);
	gl.bufferData(
		gl.ARRAY_BUFFER,
		new Float32Array(vertexData),
		gl.STATIC_DRAW,
	);

	// Position attribute (2 floats)
	const positionLoc = gl.getAttribLocation(program, "aPosition");
	gl.enableVertexAttribArray(positionLoc);
	gl.vertexAttribPointer(positionLoc, 2, gl.FLOAT, false, 16, 0);

	// Texture coord attribute (2 floats)
	const texCoordLoc = gl.getAttribLocation(program, "aTexCoord");
	gl.enableVertexAttribArray(texCoordLoc);
	gl.vertexAttribPointer(texCoordLoc, 2, gl.FLOAT, false, 16, 8);

	// Create and upload index buffer
	const indexBuffer = gl.createBuffer();
	gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, indexBuffer);
	gl.bufferData(
		gl.ELEMENT_ARRAY_BUFFER,
		new Uint16Array(indices),
		gl.STATIC_DRAW,
	);

	// Upload source image as texture
	const texture = gl.createTexture();
	gl.bindTexture(gl.TEXTURE_2D, texture);
	gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, source);
	gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
	gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
	gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
	gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);

	// Clear and draw
	gl.clearColor(0, 0, 0, 0);
	gl.clear(gl.COLOR_BUFFER_BIT);

	gl.drawElements(gl.TRIANGLES, indices.length, gl.UNSIGNED_SHORT, 0);

	// Cleanup
	gl.deleteProgram(program);
	gl.deleteBuffer(vertexBuffer);
	gl.deleteBuffer(indexBuffer);
	gl.deleteTexture(texture);

	return canvas;
}
