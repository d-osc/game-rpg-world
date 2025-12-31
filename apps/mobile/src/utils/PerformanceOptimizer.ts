/**
 * Performance Optimizer
 * Mobile-specific performance optimizations
 */

export interface DeviceCapabilities {
	isLowEnd: boolean;
	memoryLimit: number;
	connectionType: string;
	pixelRatio: number;
	maxTextureSize: number;
}

export class PerformanceOptimizer {
	private capabilities: DeviceCapabilities;
	private frameRate: number = 60;
	private lastFrameTime: number = 0;
	private frameCount: number = 0;
	private fps: number = 60;

	constructor() {
		this.capabilities = this.detectCapabilities();
		this.applyOptimizations();
		this.monitorPerformance();
	}

	/**
	 * Detect device capabilities
	 */
	private detectCapabilities(): DeviceCapabilities {
		const nav = navigator as any;

		// Detect memory
		const memory = nav.deviceMemory || 4; // Default 4GB if not available

		// Detect connection
		const connection = nav.connection || nav.mozConnection || nav.webkitConnection;
		const connectionType = connection?.effectiveType || '4g';

		// Get pixel ratio
		const pixelRatio = window.devicePixelRatio || 1;

		// Detect max texture size (WebGL)
		let maxTextureSize = 2048;
		try {
			const canvas = document.createElement('canvas');
			const gl = canvas.getContext('webgl') || canvas.getContext('experimental-webgl');
			if (gl) {
				maxTextureSize = (gl as WebGLRenderingContext).getParameter(
					(gl as WebGLRenderingContext).MAX_TEXTURE_SIZE
				);
			}
		} catch (e) {
			console.warn('[Performance] Could not detect max texture size');
		}

		// Determine if low-end device
		const isLowEnd = memory < 3 || connectionType === 'slow-2g' || connectionType === '2g';

		return {
			isLowEnd,
			memoryLimit: memory,
			connectionType,
			pixelRatio,
			maxTextureSize,
		};
	}

	/**
	 * Apply performance optimizations based on device capabilities
	 */
	private applyOptimizations(): void {
		console.log('[Performance] Device capabilities:', this.capabilities);

		// Low-end device optimizations
		if (this.capabilities.isLowEnd) {
			console.log('[Performance] Applying low-end optimizations');

			// Reduce target frame rate
			this.frameRate = 30;

			// Reduce pixel ratio
			this.setPixelRatio(1);

			// Disable expensive effects
			this.disableExpensiveEffects();
		} else {
			// High-end device
			console.log('[Performance] High-end device detected');

			// Use native pixel ratio (up to 2x)
			this.setPixelRatio(Math.min(this.capabilities.pixelRatio, 2));
		}

		// Connection-based optimizations
		if (this.capabilities.connectionType === 'slow-2g' || this.capabilities.connectionType === '2g') {
			console.log('[Performance] Slow connection detected');
			this.enableDataSaving();
		}
	}

	/**
	 * Set pixel ratio for rendering
	 */
	private setPixelRatio(ratio: number): void {
		document.documentElement.style.setProperty('--pixel-ratio', ratio.toString());
		console.log('[Performance] Pixel ratio set to:', ratio);
	}

	/**
	 * Disable expensive visual effects
	 */
	private disableExpensiveEffects(): void {
		// Dispatch event to game to disable effects
		document.dispatchEvent(
			new CustomEvent('performance-mode', {
				detail: { mode: 'low', disableEffects: true },
			})
		);
	}

	/**
	 * Enable data saving mode
	 */
	private enableDataSaving(): void {
		document.dispatchEvent(
			new CustomEvent('data-saving-mode', {
				detail: { enabled: true },
			})
		);
	}

	/**
	 * Monitor performance
	 */
	private monitorPerformance(): void {
		const checkPerformance = () => {
			const now = performance.now();
			const delta = now - this.lastFrameTime;

			if (delta >= 1000) {
				this.fps = Math.round((this.frameCount * 1000) / delta);
				this.frameCount = 0;
				this.lastFrameTime = now;

				// Adjust quality if FPS is low
				if (this.fps < 25 && !this.capabilities.isLowEnd) {
					console.warn('[Performance] Low FPS detected:', this.fps);
					this.degradeQuality();
				}
			}

			this.frameCount++;
			requestAnimationFrame(checkPerformance);
		};

		requestAnimationFrame(checkPerformance);
	}

	/**
	 * Degrade quality if performance is poor
	 */
	private degradeQuality(): void {
		console.log('[Performance] Degrading quality due to low FPS');

		// Reduce pixel ratio
		const currentRatio = parseFloat(
			document.documentElement.style.getPropertyValue('--pixel-ratio') || '1'
		);
		if (currentRatio > 1) {
			this.setPixelRatio(Math.max(1, currentRatio - 0.25));
		}

		// Disable effects
		this.disableExpensiveEffects();
	}

	/**
	 * Get device capabilities
	 */
	getCapabilities(): DeviceCapabilities {
		return { ...this.capabilities };
	}

	/**
	 * Get current FPS
	 */
	getFPS(): number {
		return this.fps;
	}

	/**
	 * Get target frame rate
	 */
	getTargetFrameRate(): number {
		return this.frameRate;
	}

	/**
	 * Check if device is low-end
	 */
	isLowEndDevice(): boolean {
		return this.capabilities.isLowEnd;
	}

	/**
	 * Get recommended texture size
	 */
	getRecommendedTextureSize(): number {
		if (this.capabilities.isLowEnd) {
			return Math.min(1024, this.capabilities.maxTextureSize);
		}
		return Math.min(2048, this.capabilities.maxTextureSize);
	}

	/**
	 * Get recommended asset quality
	 */
	getAssetQuality(): 'low' | 'medium' | 'high' {
		if (this.capabilities.isLowEnd) return 'low';
		if (this.capabilities.memoryLimit < 6) return 'medium';
		return 'high';
	}

	/**
	 * Should use asset compression
	 */
	shouldCompressAssets(): boolean {
		return (
			this.capabilities.connectionType === 'slow-2g' ||
			this.capabilities.connectionType === '2g' ||
			this.capabilities.connectionType === '3g'
		);
	}
}

// Create global instance
const performanceOptimizer = new PerformanceOptimizer();

export default performanceOptimizer;

// Attach to window for debugging
if (typeof window !== 'undefined') {
	(window as any).performanceOptimizer = performanceOptimizer;
}
