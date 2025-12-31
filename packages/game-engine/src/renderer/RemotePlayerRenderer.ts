/**
 * RemotePlayerRenderer
 * Renders remote players from network state
 */

import type { Canvas2DRenderer } from './Canvas2DRenderer';
import type { Camera } from './Camera';

export interface RemotePlayer {
	playerId: string;
	username: string;
	position: { x: number; y: number };
	velocity?: { x: number; y: number };
	animation?: string;
	color?: string; // Simple color representation for now
	lastUpdateTime: number;
}

export interface RemotePlayerRendererConfig {
	renderer: Canvas2DRenderer;
	camera: Camera;
	interpolation?: boolean;
	nameTagOffset?: number;
}

export class RemotePlayerRenderer {
	private renderer: Canvas2DRenderer;
	private camera: Camera;
	private remotePlayers: Map<string, RemotePlayer> = new Map();
	private interpolation: boolean;
	private nameTagOffset: number;
	private playerSize: number = 32; // Default player size

	constructor(config: RemotePlayerRendererConfig) {
		this.renderer = config.renderer;
		this.camera = config.camera;
		this.interpolation = config.interpolation ?? true;
		this.nameTagOffset = config.nameTagOffset ?? 40;
	}

	/**
	 * Update remote player state
	 */
	updatePlayer(player: RemotePlayer): void {
		player.lastUpdateTime = Date.now();
		this.remotePlayers.set(player.playerId, player);
	}

	/**
	 * Remove remote player
	 */
	removePlayer(playerId: string): void {
		this.remotePlayers.delete(playerId);
	}

	/**
	 * Get remote player
	 */
	getPlayer(playerId: string): RemotePlayer | undefined {
		return this.remotePlayers.get(playerId);
	}

	/**
	 * Get all remote players
	 */
	getAllPlayers(): RemotePlayer[] {
		return Array.from(this.remotePlayers.values());
	}

	/**
	 * Clear all remote players
	 */
	clearAll(): void {
		this.remotePlayers.clear();
	}

	/**
	 * Render all remote players
	 */
	render(deltaTime: number): void {
		const ctx = this.renderer.getContext();
		if (!ctx) return;

		this.remotePlayers.forEach((player) => {
			this.renderPlayer(ctx, player, deltaTime);
		});
	}

	/**
	 * Render single remote player
	 */
	private renderPlayer(
		ctx: CanvasRenderingContext2D,
		player: RemotePlayer,
		deltaTime: number,
	): void {
		// Calculate interpolated position
		let renderX = player.position.x;
		let renderY = player.position.y;

		if (this.interpolation && player.velocity) {
			// Simple linear interpolation based on velocity
			renderX += player.velocity.x * deltaTime;
			renderY += player.velocity.y * deltaTime;
		}

		// Transform to screen space
		const screenPos = this.camera.worldToScreen(renderX, renderY);

		// Check if in viewport
		if (!this.isInViewport(screenPos.x, screenPos.y)) {
			return;
		}

		// Draw player (simple colored circle for now)
		ctx.save();

		// Draw shadow
		ctx.fillStyle = 'rgba(0, 0, 0, 0.3)';
		ctx.beginPath();
		ctx.ellipse(
			screenPos.x,
			screenPos.y + this.playerSize / 2 + 4,
			this.playerSize / 2,
			this.playerSize / 4,
			0,
			0,
			Math.PI * 2,
		);
		ctx.fill();

		// Draw player body
		const playerColor = player.color || this.getPlayerColor(player.playerId);
		ctx.fillStyle = playerColor;
		ctx.beginPath();
		ctx.arc(screenPos.x, screenPos.y, this.playerSize / 2, 0, Math.PI * 2);
		ctx.fill();

		// Draw outline
		ctx.strokeStyle = '#fff';
		ctx.lineWidth = 2;
		ctx.stroke();

		// Draw name tag
		this.drawNameTag(ctx, player.username, screenPos.x, screenPos.y);

		// Draw animation indicator (optional)
		if (player.animation) {
			this.drawAnimationIndicator(ctx, player.animation, screenPos.x, screenPos.y);
		}

		ctx.restore();
	}

	/**
	 * Draw player name tag
	 */
	private drawNameTag(
		ctx: CanvasRenderingContext2D,
		username: string,
		x: number,
		y: number,
	): void {
		ctx.save();

		// Name tag background
		ctx.font = '14px monospace';
		const textWidth = ctx.measureText(username).width;
		const padding = 6;
		const tagY = y - this.nameTagOffset;

		ctx.fillStyle = 'rgba(0, 0, 0, 0.7)';
		ctx.fillRect(
			x - textWidth / 2 - padding,
			tagY - 16,
			textWidth + padding * 2,
			20,
		);

		// Name text
		ctx.fillStyle = '#fff';
		ctx.textAlign = 'center';
		ctx.textBaseline = 'middle';
		ctx.fillText(username, x, tagY - 6);

		ctx.restore();
	}

	/**
	 * Draw animation indicator
	 */
	private drawAnimationIndicator(
		ctx: CanvasRenderingContext2D,
		animation: string,
		x: number,
		y: number,
	): void {
		ctx.save();

		// Simple animation state indicator
		ctx.fillStyle = 'rgba(255, 255, 255, 0.5)';
		ctx.font = '10px monospace';
		ctx.textAlign = 'center';
		ctx.fillText(animation, x, y + this.playerSize / 2 + 12);

		ctx.restore();
	}

	/**
	 * Check if position is in viewport
	 */
	private isInViewport(x: number, y: number): boolean {
		const bounds = this.camera.getBounds();
		const margin = this.playerSize;

		return (
			x >= -margin &&
			x <= bounds.width + margin &&
			y >= -margin &&
			y <= bounds.height + margin
		);
	}

	/**
	 * Generate consistent color for player ID
	 */
	private getPlayerColor(playerId: string): string {
		// Simple hash to color
		let hash = 0;
		for (let i = 0; i < playerId.length; i++) {
			hash = playerId.charCodeAt(i) + ((hash << 5) - hash);
		}

		const hue = Math.abs(hash) % 360;
		return `hsl(${hue}, 70%, 60%)`;
	}

	/**
	 * Set player size
	 */
	setPlayerSize(size: number): void {
		this.playerSize = size;
	}

	/**
	 * Set interpolation
	 */
	setInterpolation(enabled: boolean): void {
		this.interpolation = enabled;
	}

	/**
	 * Get player count
	 */
	getPlayerCount(): number {
		return this.remotePlayers.size;
	}

	/**
	 * Get players in radius
	 */
	getPlayersInRadius(x: number, y: number, radius: number): RemotePlayer[] {
		return Array.from(this.remotePlayers.values()).filter((player) => {
			const dx = player.position.x - x;
			const dy = player.position.y - y;
			return Math.sqrt(dx * dx + dy * dy) <= radius;
		});
	}

	/**
	 * Debug render (show additional info)
	 */
	debugRender(): void {
		const ctx = this.renderer.getContext();
		if (!ctx) return;

		ctx.save();
		ctx.fillStyle = '#0f0';
		ctx.font = '12px monospace';
		ctx.textAlign = 'left';
		ctx.fillText(
			`Remote Players: ${this.remotePlayers.size}`,
			10,
			this.renderer.getCanvas().height - 40,
		);
		ctx.restore();
	}
}
