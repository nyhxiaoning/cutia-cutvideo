export type FaceEffectType = "big-head" | "big-face" | "glow";

export interface FaceEffectParams {
	bigHeadIntensity: number;
	bigFaceIntensity: number;
	glowColor: string;
	glowIntensity: number;
	glowRadius: number;
	enabledEffects: FaceEffectType[];
}

export interface FaceLandmarkPoint {
	x: number;
	y: number;
	z?: number;
}

export interface FaceDetectResult {
	landmarks: FaceLandmarkPoint[];
	imageWidth: number;
	imageHeight: number;
}

export const DEFAULT_FACE_EFFECT_PARAMS: FaceEffectParams = {
	bigHeadIntensity: 0.5,
	bigFaceIntensity: 0.5,
	glowColor: "#ffffff",
	glowIntensity: 0.5,
	glowRadius: 30,
	enabledEffects: [],
};

export const FACE_LANDMARK_INDICES = {
	// Face contour (silhouette)
	FACE_CONTOUR: [10, 338, 297, 332, 284, 251, 389, 356, 454, 323, 361, 288, 397, 365, 379, 378, 400, 377, 152, 148, 176, 149, 150, 136, 172, 58, 132, 93, 234, 127, 162, 21, 54, 103, 67, 109, 10],
	// Left eyebrow
	LEFT_EYEBROW: [46, 53, 52, 65, 55],
	// Right eyebrow
	RIGHT_EYEBROW: [285, 295, 282, 283, 276],
	// Left eye
	LEFT_EYE: [33, 7, 163, 144, 145, 153, 154, 155, 133, 173, 157, 158, 159, 160, 161, 246],
	// Right eye
	RIGHT_EYE: [362, 382, 381, 380, 374, 373, 390, 249, 263, 466, 388, 387, 386, 385, 384, 398],
	// Nose
	NOSE: [168, 6, 197, 195, 5, 4, 1, 19, 94, 2, 98, 97, 20, 48, 49, 279, 278, 415, 310, 311, 237, 238, 239, 27, 45, 44, 43, 420, 421, 430, 431, 432, 3, 248, 281, 440, 445, 342, 345],
	// Lips
	LIPS: [61, 146, 91, 181, 84, 17, 314, 405, 321, 375, 291, 409, 270, 269, 267, 0, 37, 39, 40, 185, 61, 267, 269, 270, 409, 291, 375, 321, 405, 314, 17, 84, 181, 91, 146],
	// Head top (roughly the top of head area)
	HEAD_TOP: [10],
	// Chin
	CHIN: [152],
	// Left cheek
	LEFT_CHEEK: [234, 93, 132, 58, 172, 136, 150, 149, 176, 148],
	// Right cheek
	RIGHT_CHEEK: [454, 323, 361, 288, 397, 365, 379, 378, 400, 377],
};

export type GlowType = "head" | "face" | "body";
