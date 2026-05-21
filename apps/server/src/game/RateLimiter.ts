/**
 * RateLimiter
 * Token-bucket rate limiter for per-action throttling
 */

export class RateLimiter {
	private buckets = new Map<string, { count: number; resetTime: number }>();

	/**
	 * Check if action is rate limited. Returns true if LIMITED (should reject).
	 */
	isLimited(key: string, maxPerSecond: number): boolean {
		const now = Date.now();
		const bucket = this.buckets.get(key);

		if (!bucket || now >= bucket.resetTime) {
			this.buckets.set(key, { count: 1, resetTime: now + 1000 });
			return false;
		}

		bucket.count++;
		return bucket.count > maxPerSecond;
	}

	/**
	 * Reset a bucket
	 */
	reset(key: string): void {
		this.buckets.delete(key);
	}

	/**
	 * Cleanup old buckets
	 */
	cleanup(): void {
		const now = Date.now();
		for (const [key, bucket] of this.buckets) {
			if (now >= bucket.resetTime) {
				this.buckets.delete(key);
			}
		}
	}
}
