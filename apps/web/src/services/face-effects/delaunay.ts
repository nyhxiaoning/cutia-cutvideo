export interface Point {
	x: number;
	y: number;
}

export interface Triangle {
	v0: number;
	v1: number;
	v2: number;
}

/**
 * Simple Delaunay triangulation using Bowyer-Watson algorithm.
 * Takes an array of points and returns triangle indices.
 *
 * For 478 face landmarks, this generates a mesh suitable for
 * WebGL image warping.
 *
 * The super-triangle approach: start with a triangle large enough
 * to contain all points, then incrementally add points.
 */
export function delaunayTriangulation(points: Point[]): Triangle[] {
	const n = points.length;
	if (n < 3) return [];

	// Build a super-triangle that contains all points
	let minX = Infinity;
	let minY = Infinity;
	let maxX = -Infinity;
	let maxY = -Infinity;

	for (const p of points) {
		if (p.x < minX) minX = p.x;
		if (p.y < minY) minY = p.y;
		if (p.x > maxX) maxX = p.x;
		if (p.y > maxY) maxY = p.y;
	}

	const dx = maxX - minX || 1;
	const dy = maxY - minY || 1;
	const cx = (minX + maxX) / 2;
	const cy = (minY + maxY) / 2;

	// Super-triangle vertices (large enough to contain all points)
	const s = Math.max(dx, dy) * 20;
	const superTri: Point[] = [
		{ x: cx - s, y: cy - s * 2 },
		{ x: cx, y: cy + s * 2 },
		{ x: cx + s * 2, y: cy - s },
	];

	const allPoints = [...points, ...superTri];
	const superN = n;

	// Initialize triangle list with super-triangle
	const triangles: Array<[number, number, number]> = [
		[superN, superN + 1, superN + 2],
	];

	// Incrementally add each point
	for (let i = 0; i < n; i++) {
		const p = points[i];

		// Find all triangles whose circumcircle contains this point
		const badTriangles: number[] = [];

		for (let t = 0; t < triangles.length; t++) {
			const tri = triangles[t];
			if (pointInCircumcircle(p, allPoints[tri[0]], allPoints[tri[1]], allPoints[tri[2]])) {
				badTriangles.push(t);
			}
		}

		// Find the boundary polygon edges (edges that belong to exactly one bad triangle)
		const edgeCount = new Map<string, number>();

		for (const tIdx of badTriangles) {
			const tri = triangles[tIdx];
			const edges = [
				[tri[0], tri[1]],
				[tri[1], tri[2]],
				[tri[2], tri[0]],
			];

			for (const [a, b] of edges) {
				const key = a < b ? `${a}_${b}` : `${b}_${a}`;
				edgeCount.set(key, (edgeCount.get(key) || 0) + 1);
			}
		}

		// Remove bad triangles
		const newTriangles: Array<[number, number, number]> = [];
		const removed = new Set<number>(badTriangles);

		for (let t = 0; t < triangles.length; t++) {
			if (!removed.has(t)) {
				newTriangles.push(triangles[t]);
			}
		}

		// Re-triangulate the polygon cavity
		for (const [key, count] of edgeCount) {
			if (count === 1) {
				const [a, b] = key.split("_").map(Number);
				newTriangles.push([a, b, i]);
			}
		}

		triangles.length = 0;
		triangles.push(...newTriangles);
	}

	// Remove triangles that reference super-triangle vertices
	const result: Triangle[] = [];

	for (const tri of triangles) {
		if (tri[0] >= superN || tri[1] >= superN || tri[2] >= superN) {
			continue;
		}
		result.push({ v0: tri[0], v1: tri[1], v2: tri[2] });
	}

	return result;
}

function pointInCircumcircle(
	p: Point,
	a: Point,
	b: Point,
	c: Point,
): boolean {
	const ax = a.x - p.x;
	const ay = a.y - p.y;
	const bx = b.x - p.x;
	const by = b.y - p.y;
	const cx = c.x - p.x;
	const cy = c.y - p.y;

	const ab = ax * ax + ay * ay;
	const bc = bx * bx + by * by;
	const cd = cx * cx + cy * cy;

	const det =
		ax * (by * cd - bc * cy) -
		ay * (bx * cd - bc * cx) +
		ab * (bx * cy - by * cx);

	return det > 0;
}
