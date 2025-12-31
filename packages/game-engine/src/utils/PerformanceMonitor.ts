/**
 * Performance Monitor
 * Monitors and reports game performance metrics
 */

export interface PerformanceMetrics {
	fps: number;
	frameTime: number;
	updateTime: number;
	renderTime: number;
	memoryUsage?: number;
	drawCalls?: number;
	entityCount?: number;
}

export class PerformanceMonitor {
	private fps: number = 60;
	private frameTime: number = 16.67;
	private updateTime: number = 0;
	private renderTime: number = 0;
	private frameCount: number = 0;
	private lastFpsUpdate: number = 0;
	private frameTimes: number[] = [];
	private maxFrameTimeSamples: number = 60;
	private performanceWarningThreshold: number = 30; // FPS below this triggers warning

	// Callbacks
	private onPerformanceWarning?: (metrics: PerformanceMetrics) => void;

	/**
	 * Begin frame measurement
	 */
	beginFrame(): number {
		return performance.now();
	}

	/**
	 * End frame measurement
	 */
	endFrame(startTime: number): void {
		const endTime = performance.now();
		const frameTime = endTime - startTime;

		this.frameTime = frameTime;
		this.frameTimes.push(frameTime);

		// Keep only recent samples
		if (this.frameTimes.length > this.maxFrameTimeSamples) {
			this.frameTimes.shift();
		}

		this.frameCount++;

		// Update FPS every second
		if (endTime - this.lastFpsUpdate >= 1000) {
			this.fps = Math.round((this.frameCount * 1000) / (endTime - this.lastFpsUpdate));
			this.frameCount = 0;
			this.lastFpsUpdate = endTime;

			// Check for performance warnings
			if (this.fps < this.performanceWarningThreshold && this.onPerformanceWarning) {
				this.onPerformanceWarning(this.getMetrics());
			}
		}
	}

	/**
	 * Record update time
	 */
	recordUpdateTime(time: number): void {
		this.updateTime = time;
	}

	/**
	 * Record render time
	 */
	recordRenderTime(time: number): void {
		this.renderTime = time;
	}

	/**
	 * Get current metrics
	 */
	getMetrics(): PerformanceMetrics {
		const memory = (performance as any).memory;

		return {
			fps: this.fps,
			frameTime: this.frameTime,
			updateTime: this.updateTime,
			renderTime: this.renderTime,
			memoryUsage: memory ? memory.usedJSHeapSize / 1048576 : undefined, // MB
		};
	}

	/**
	 * Get average frame time
	 */
	getAverageFrameTime(): number {
		if (this.frameTimes.length === 0) return 0;
		const sum = this.frameTimes.reduce((a, b) => a + b, 0);
		return sum / this.frameTimes.length;
	}

	/**
	 * Get min/max frame time
	 */
	getFrameTimeRange(): { min: number; max: number } {
		if (this.frameTimes.length === 0) return { min: 0, max: 0 };

		return {
			min: Math.min(...this.frameTimes),
			max: Math.max(...this.frameTimes),
		};
	}

	/**
	 * Check if performance is good
	 */
	isPerformanceGood(): boolean {
		return this.fps >= this.performanceWarningThreshold;
	}

	/**
	 * Set performance warning callback
	 */
	setWarningCallback(callback: (metrics: PerformanceMetrics) => void): void {
		this.onPerformanceWarning = callback;
	}

	/**
	 * Set warning threshold
	 */
	setWarningThreshold(fps: number): void {
		this.performanceWarningThreshold = fps;
	}

	/**
	 * Reset metrics
	 */
	reset(): void {
		this.fps = 60;
		this.frameTime = 16.67;
		this.updateTime = 0;
		this.renderTime = 0;
		this.frameCount = 0;
		this.lastFpsUpdate = performance.now();
		this.frameTimes = [];
	}

	/**
	 * Generate performance report
	 */
	generateReport(): string {
		const metrics = this.getMetrics();
		const avgFrameTime = this.getAverageFrameTime();
		const frameTimeRange = this.getFrameTimeRange();

		return `
Performance Report:
- FPS: ${metrics.fps}
- Frame Time: ${metrics.frameTime.toFixed(2)}ms (avg: ${avgFrameTime.toFixed(2)}ms)
- Frame Time Range: ${frameTimeRange.min.toFixed(2)}ms - ${frameTimeRange.max.toFixed(2)}ms
- Update Time: ${metrics.updateTime.toFixed(2)}ms
- Render Time: ${metrics.renderTime.toFixed(2)}ms
${metrics.memoryUsage ? `- Memory Usage: ${metrics.memoryUsage.toFixed(2)}MB` : ''}
		`.trim();
	}
}

/**
 * Debug Overlay
 * Visual overlay for performance metrics
 */
export class DebugOverlay {
	private container: HTMLElement;
	private monitor: PerformanceMonitor;
	private overlay: HTMLElement | null = null;
	private visible: boolean = false;

	constructor(container: HTMLElement, monitor: PerformanceMonitor) {
		this.container = container;
		this.monitor = monitor;
	}

	/**
	 * Toggle overlay visibility
	 */
	toggle(): void {
		this.visible = !this.visible;

		if (this.visible) {
			this.show();
		} else {
			this.hide();
		}
	}

	/**
	 * Show overlay
	 */
	show(): void {
		if (this.overlay) return;

		this.overlay = document.createElement('div');
		this.overlay.style.cssText = `
			position: fixed;
			top: 10px;
			left: 10px;
			background: rgba(0, 0, 0, 0.8);
			color: #00ff00;
			padding: 15px;
			font-family: 'Courier New', monospace;
			font-size: 12px;
			line-height: 1.5;
			border-radius: 5px;
			z-index: 10000;
			min-width: 250px;
		`;

		this.container.appendChild(this.overlay);
		this.visible = true;

		// Start update loop
		this.updateOverlay();
	}

	/**
	 * Hide overlay
	 */
	hide(): void {
		if (this.overlay) {
			this.overlay.remove();
			this.overlay = null;
		}
		this.visible = false;
	}

	/**
	 * Update overlay content
	 */
	private updateOverlay(): void {
		if (!this.visible || !this.overlay) return;

		const metrics = this.monitor.getMetrics();
		const avgFrameTime = this.monitor.getAverageFrameTime();
		const frameTimeRange = this.monitor.getFrameTimeRange();

		// Color code FPS
		let fpsColor = '#00ff00'; // Green
		if (metrics.fps < 30) fpsColor = '#ff0000'; // Red
		else if (metrics.fps < 45) fpsColor = '#ffaa00'; // Orange

		this.overlay.innerHTML = `
			<div style="margin-bottom: 10px; font-weight: bold; color: white;">Performance Monitor</div>
			<div>FPS: <span style="color: ${fpsColor}; font-weight: bold;">${metrics.fps}</span></div>
			<div>Frame Time: ${metrics.frameTime.toFixed(2)}ms</div>
			<div>Avg Frame Time: ${avgFrameTime.toFixed(2)}ms</div>
			<div>Min/Max: ${frameTimeRange.min.toFixed(2)}ms / ${frameTimeRange.max.toFixed(2)}ms</div>
			<div>Update: ${metrics.updateTime.toFixed(2)}ms</div>
			<div>Render: ${metrics.renderTime.toFixed(2)}ms</div>
			${metrics.memoryUsage ? `<div>Memory: ${metrics.memoryUsage.toFixed(2)}MB</div>` : ''}
			<div style="margin-top: 10px; font-size: 10px; color: #888;">Press F3 to toggle</div>
		`;

		// Schedule next update
		requestAnimationFrame(() => this.updateOverlay());
	}

	/**
	 * Check if visible
	 */
	isVisible(): boolean {
		return this.visible;
	}
}

/**
 * Object Pool
 * Reuse objects to reduce garbage collection
 */
export class ObjectPool<T> {
	private pool: T[] = [];
	private factory: () => T;
	private reset?: (obj: T) => void;
	private maxSize: number;

	constructor(factory: () => T, maxSize: number = 100, reset?: (obj: T) => void) {
		this.factory = factory;
		this.maxSize = maxSize;
		this.reset = reset;
	}

	/**
	 * Get object from pool
	 */
	acquire(): T {
		if (this.pool.length > 0) {
			return this.pool.pop()!;
		}

		return this.factory();
	}

	/**
	 * Return object to pool
	 */
	release(obj: T): void {
		if (this.pool.length < this.maxSize) {
			if (this.reset) {
				this.reset(obj);
			}
			this.pool.push(obj);
		}
	}

	/**
	 * Get pool size
	 */
	getSize(): number {
		return this.pool.length;
	}

	/**
	 * Clear pool
	 */
	clear(): void {
		this.pool = [];
	}
}
