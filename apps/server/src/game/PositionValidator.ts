/**
 * PositionValidator
 * Validates player position updates against max movement speed
 */

const MAX_SPEED = 150; // pixels/second (matches Player.speed in WorldScene)
const MAX_SPEED_SCALED = MAX_SPEED / 32; // in 3D units (1 tile = 32px)
const TICK_MS = 100; // 10Hz

export class PositionValidator {
	/**
	 * Validate a position update. Returns corrected position if invalid.
	 */
	validate(
		lastX: number, lastY: number,
		newX: number, newY: number,
		deltaMs: number,
	): { valid: boolean; x: number; y: number } {
		if (deltaMs <= 0) deltaMs = TICK_MS;

		const maxDist = MAX_SPEED_SCALED * (deltaMs / 1000) * 1.5; // 50% tolerance for jitter
		const dx = newX - lastX;
		const dy = newY - lastY;
		const dist = Math.sqrt(dx * dx + dy * dy);

		if (dist <= maxDist) {
			return { valid: true, x: newX, y: newY };
		}

		// Clamp to max distance
		const scale = maxDist / dist;
		return {
			valid: false,
			x: lastX + dx * scale,
			y: lastY + dy * scale,
		};
	}
}
