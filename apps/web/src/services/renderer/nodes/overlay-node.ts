import type { CanvasRenderer } from "../canvas-renderer";
import { BaseNode } from "./base-node";
import type { OverlayParams } from "@/types/overlay";

interface Particle {
	x: number;
	y: number;
	speed: number;
	length: number;
	opacity: number;
	wind: number;
	size: number;
	sway: number;
	swaySpeed: number;
	hue?: number;
	rotation?: number;
	rotationSpeed?: number;
	life?: number;
	maxLife?: number;
	expansion?: number;
}

export interface OverlayNodeParams {
	params: OverlayParams;
	duration: number;
	timeOffset: number;
}

export class OverlayNode extends BaseNode<OverlayNodeParams> {
	private particles: Particle[] = [];
	private initialized = false;
	private shakeTime = 0;

	private initParticles(width: number, height: number): void {
		const { type, density } = this.params.params;

		if (type === "shake") {
			// Shake has no particles
			this.initialized = true;
			return;
		}

		this.particles = [];
		for (let i = 0; i < density; i++) {
			this.particles.push(this.createParticle(width, height, true));
		}
		this.initialized = true;
	}

	private createParticle(
		width: number,
		height: number,
		randomY: boolean,
	): Particle {
		const { type, speed, opacity, wind } = this.params.params;

		switch (type) {
			case "rain":
				return {
					x: Math.random() * width,
					y: randomY ? Math.random() * height : -10,
					speed: speed * (0.5 + Math.random()),
					length: 8 + Math.random() * 12,
					opacity: opacity * (0.3 + Math.random() * 0.7),
					wind: (wind ?? 0) * (0.5 + Math.random()),
					size: 1,
					sway: 0,
					swaySpeed: 0,
				};

			case "snow":
				return {
					x: Math.random() * width,
					y: randomY ? Math.random() * height : -10,
					speed: speed * (0.3 + Math.random() * 0.7),
					length: 1,
					opacity: opacity * (0.3 + Math.random() * 0.7),
					wind: (wind ?? 0) * (0.3 + Math.random() * 0.7),
					size: 1.5 + Math.random() * 3,
					sway: Math.random() * Math.PI * 2,
					swaySpeed: 0.01 + Math.random() * 0.02,
				};

			case "sparkle":
				return {
					x: Math.random() * width,
					y: randomY ? Math.random() * height : -10,
					speed: speed * (0.3 + Math.random() * 0.7),
					length: 0,
					opacity: 0,
					wind: 0,
					size: 1.5 + Math.random() * 2.5,
					sway: Math.random() * Math.PI * 2,
					swaySpeed: 0.02 + Math.random() * 0.03,
					life: 0,
					maxLife: 60 + Math.random() * 120,
				};

			case "fire":
				return {
					x: Math.random() * width,
					y: randomY ? Math.random() * height : height + 10,
					speed: -(speed * (0.5 + Math.random() * 0.5)),
					length: 0,
					opacity: opacity * (0.4 + Math.random() * 0.6),
					wind: (wind ?? 0) * (Math.random() - 0.5) * 2,
					size: 3 + Math.random() * 5,
					sway: Math.random() * Math.PI * 2,
					swaySpeed: 0.02 + Math.random() * 0.03,
					hue: 15 + Math.random() * 30,
				};

			case "smoke":
				return {
					x: Math.random() * width,
					y: randomY ? Math.random() * height : height + 30,
					speed: -(speed * (0.3 + Math.random() * 0.7)),
					length: 0,
					opacity: opacity * (0.2 + Math.random() * 0.4),
					wind: (wind ?? 0) * (Math.random() - 0.5) * 2,
					size: 5 + Math.random() * 10,
					sway: Math.random() * Math.PI * 2,
					swaySpeed: 0.005 + Math.random() * 0.01,
					expansion: 0.05 + Math.random() * 0.1,
				};

			case "firefly":
				return {
					x: Math.random() * width,
					y: randomY ? Math.random() * height : Math.random() * height,
					speed: speed * (0.3 + Math.random() * 0.7),
					length: 0,
					opacity: opacity * (0.3 + Math.random() * 0.7),
					wind: (wind ?? 0) * (Math.random() - 0.5) * 0.5,
					size: 1 + Math.random() * 2,
					sway: Math.random() * Math.PI * 2,
					swaySpeed: 0.01 + Math.random() * 0.03,
					life: Math.random() * 200,
					maxLife: 200 + Math.random() * 300,
				};

			case "bubble":
				return {
					x: Math.random() * width,
					y: randomY ? Math.random() * height : height + 10,
					speed: -(speed * (0.5 + Math.random() * 0.5)),
					length: 0,
					opacity: opacity * (0.3 + Math.random() * 0.7),
					wind: (wind ?? 0) * (Math.random() - 0.5) * 1.5,
					size: 3 + Math.random() * 8,
					sway: Math.random() * Math.PI * 2,
					swaySpeed: 0.01 + Math.random() * 0.02,
				};

			case "confetti":
				return {
					x: Math.random() * width,
					y: randomY ? Math.random() * height : -10,
					speed: speed * (0.5 + Math.random() * 0.5),
					length: 0,
					opacity: opacity * (0.5 + Math.random() * 0.5),
					wind: (wind ?? 0) * (0.3 + Math.random() * 0.7),
					size: 4 + Math.random() * 4,
					sway: Math.random() * Math.PI * 2,
					swaySpeed: 0.05 + Math.random() * 0.1,
					rotation: Math.random() * Math.PI * 2,
					rotationSpeed: (Math.random() - 0.5) * 0.1,
					hue: Math.floor(Math.random() * 360),
				};

			default:
				return {
					x: Math.random() * width,
					y: randomY ? Math.random() * height : -10,
					speed: 0,
					length: 0,
					opacity: 0,
					wind: 0,
					size: 0,
					sway: 0,
					swaySpeed: 0,
				};
		}
	}

	private getLocalTime(time: number): number {
		return time - this.params.timeOffset;
	}

	private isInRange(time: number): boolean {
		const localTime = this.getLocalTime(time);
		return localTime >= 0 && localTime < this.params.duration;
	}

	async render({
		renderer,
		time,
	}: {
		renderer: CanvasRenderer;
		time: number;
	}): Promise<void> {
		if (!this.isInRange(time)) return;

		const { width, height } = renderer;
		if (!this.initialized) {
			this.initParticles(width, height);
		}

		const { type } = this.params.params;
		const ctx = renderer.context;

		ctx.save();

		// Handle screen shake
		if (type === "shake") {
			this.renderShake(ctx, width, height);
			ctx.restore();
			return;
		}

		// Update and draw all particles
		for (let i = 0; i < this.particles.length; i++) {
			const p = this.particles[i];

			this.updateParticle(p, width, height, type);

			// Reset if off screen
			if (p.y > height + 20 || p.y < -30 || p.x < -30 || p.x > width + 30) {
				this.particles[i] = this.createParticle(width, height, false);
				const reset = this.particles[i];
				reset.x = Math.random() * width;
				if (p.y < -30) {
					reset.y = height + 10;
				} else if (p.y > height + 20) {
					reset.y = -10;
				}
				continue;
			}

			// Particle has expired (for life-cycle particles)
			if (p.maxLife !== undefined && p.life !== undefined && p.life > p.maxLife) {
				this.particles[i] = this.createParticle(width, height, false);
				const reset = this.particles[i];
				reset.x = Math.random() * width;
				reset.y = -10;
				continue;
			}

			this.drawParticle(ctx, p, type);
		}

		ctx.restore();
	}

	private updateParticle(
		p: Particle,
		width: number,
		_height: number,
		type: string,
	): void {
		switch (type) {
			case "rain":
				p.x += p.wind;
				p.y += p.speed;
				break;
			case "snow":
				p.sway += p.swaySpeed;
				p.x += p.wind + Math.sin(p.sway) * 0.5;
				p.y += p.speed;
				break;
			case "sparkle":
				p.life! += 1;
				p.y += p.speed;
				// Flicker opacity
				p.opacity =
					this.params.params.opacity *
					(0.2 + Math.abs(Math.sin(p.life! * 0.1 + p.sway)) * 0.8);
				break;
			case "fire":
				p.y += p.speed;
				p.x += p.wind;
				p.sway += p.swaySpeed;
				p.x += Math.sin(p.sway) * 0.3;
				// Fade out as it rises
				p.opacity *= 0.995;
				break;
			case "smoke":
				p.y += p.speed;
				p.x += p.wind + Math.sin(p.sway) * 0.2;
				p.size += p.expansion ?? 0.05;
				p.opacity *= 0.997;
				break;
			case "firefly":
				p.life! += 1;
				p.sway += p.swaySpeed;
				p.x += p.wind + Math.sin(p.sway) * 0.5;
				p.y += Math.sin(p.sway * 0.7) * 0.3;
				// Glow pulsing
				p.opacity =
					this.params.params.opacity *
					(0.3 + Math.abs(Math.sin(p.life! * 0.03)) * 0.7);
				break;
			case "bubble":
				p.y += p.speed;
				p.sway += p.swaySpeed;
				p.x += p.wind + Math.sin(p.sway) * 0.8;
				break;
			case "confetti":
				p.y += p.speed;
				p.x += p.wind;
				p.rotation! += p.rotationSpeed ?? 0;
				p.sway += p.swaySpeed;
				p.x += Math.sin(p.sway) * 0.3;
				break;
		}
	}

	private drawParticle(
		ctx: CanvasRenderingContext2D,
		p: Particle,
		type: string,
	): void {
		switch (type) {
			case "rain":
				ctx.strokeStyle = `rgba(180, 200, 230, ${p.opacity})`;
				ctx.lineWidth = p.size;
				ctx.beginPath();
				ctx.moveTo(p.x, p.y);
				ctx.lineTo(p.x - p.wind * p.length * 0.3, p.y - p.length);
				ctx.stroke();
				break;

			case "snow":
				ctx.fillStyle = `rgba(255, 255, 255, ${p.opacity})`;
				ctx.beginPath();
				ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
				ctx.fill();
				break;

			case "sparkle": {
				const s = p.size;
				// Draw a 4-point star
				ctx.save();
				ctx.translate(p.x, p.y);
				ctx.rotate(p.life! * 0.02);
				ctx.fillStyle = `rgba(255, 255, 200, ${p.opacity})`;
				ctx.shadowColor = "rgba(255, 215, 0, 0.6)";
				ctx.shadowBlur = 6;
				ctx.beginPath();
				for (let j = 0; j < 4; j++) {
					const angle = (j * Math.PI) / 2;
					ctx.lineTo(Math.cos(angle) * s, Math.sin(angle) * s);
					const innerAngle = angle + Math.PI / 4;
					ctx.lineTo(Math.cos(innerAngle) * s * 0.3, Math.sin(innerAngle) * s * 0.3);
				}
				ctx.closePath();
				ctx.fill();
				ctx.restore();
				break;
			}

			case "fire": {
				const gradient = ctx.createRadialGradient(p.x, p.y, 0, p.x, p.y, p.size);
				gradient.addColorStop(0, `rgba(255, 255, 200, ${p.opacity})`);
				gradient.addColorStop(0.3, `rgba(255, ${150 + Math.floor(p.hue! * 0.5)}, 50, ${p.opacity * 0.8})`);
				gradient.addColorStop(0.7, `rgba(255, ${Math.floor(p.hue! * 0.3)}, 0, ${p.opacity * 0.4})`);
				gradient.addColorStop(1, `rgba(200, 50, 0, 0)`);
				ctx.fillStyle = gradient;
				ctx.beginPath();
				ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
				ctx.fill();
				break;
			}

			case "smoke":
				ctx.fillStyle = `rgba(180, 180, 180, ${p.opacity})`;
				ctx.beginPath();
				ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
				ctx.fill();
				break;

			case "firefly": {
				const glow = p.size * 4;
				const gradient = ctx.createRadialGradient(p.x, p.y, 0, p.x, p.y, glow);
				gradient.addColorStop(0, `rgba(200, 255, 100, ${p.opacity})`);
				gradient.addColorStop(0.2, `rgba(180, 230, 80, ${p.opacity * 0.6})`);
				gradient.addColorStop(1, `rgba(150, 200, 50, 0)`);
				ctx.fillStyle = gradient;
				ctx.beginPath();
				ctx.arc(p.x, p.y, glow, 0, Math.PI * 2);
				ctx.fill();
				break;
			}

			case "bubble":
				ctx.strokeStyle = `rgba(180, 220, 255, ${p.opacity})`;
				ctx.lineWidth = 0.5;
				ctx.beginPath();
				ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
				ctx.stroke();
				// Highlight
				ctx.fillStyle = `rgba(255, 255, 255, ${p.opacity * 0.15})`;
				ctx.beginPath();
				ctx.arc(p.x - p.size * 0.25, p.y - p.size * 0.25, p.size * 0.3, 0, Math.PI * 2);
				ctx.fill();
				break;

			case "confetti": {
				ctx.save();
				ctx.translate(p.x, p.y);
				ctx.rotate(p.rotation ?? 0);
				ctx.fillStyle = `hsla(${p.hue ?? 0}, 80%, 60%, ${p.opacity})`;
				ctx.fillRect(-p.size / 2, -p.size / 4, p.size, p.size / 2);
				ctx.restore();
				break;
			}
		}
	}

	private renderShake(
		ctx: CanvasRenderingContext2D,
		width: number,
		height: number,
	): void {
		const intensity = this.params.params.intensity ?? 6;

		// Generate smooth shake offset using sine waves at different frequencies
		const t = this.shakeTime;
		const offsetX =
			Math.sin(t * 37) * intensity * 0.5 +
			Math.sin(t * 73) * intensity * 0.3 +
			Math.sin(t * 131) * intensity * 0.2;
		const offsetY =
			Math.sin(t * 41 + 1.3) * intensity * 0.5 +
			Math.sin(t * 83 + 2.7) * intensity * 0.3 +
			Math.sin(t * 151 + 0.7) * intensity * 0.2;

		// Apply shake transform to the entire overlay layer
		ctx.translate(offsetX, offsetY);
		this.shakeTime += 0.016; // ~60fps

		// Draw subtle shake lines on edges for visual impact
		ctx.strokeStyle = "rgba(200, 200, 200, 0.08)";
		ctx.lineWidth = 1;
		const lineCount = 3;
		for (let i = 0; i < lineCount; i++) {
			const lx = Math.sin(t * 53 + i * 2.1) * width * 0.3;
			const ly = Math.sin(t * 67 + i * 1.7) * height * 0.3;
			ctx.beginPath();
			ctx.moveTo(width / 2 + lx - 10, height / 2 + ly);
			ctx.lineTo(width / 2 + lx + 10, height / 2 + ly);
			ctx.stroke();
		}
	}
}
