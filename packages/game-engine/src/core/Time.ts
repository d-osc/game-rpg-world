/**
 * Time management system
 * Handles delta time, FPS tracking, and time scaling
 */

export class Time {
  private static _instance: Time;

  // Time tracking
  private _startTime: number = 0;
  private _lastFrameTime: number = 0;
  private _deltaTime: number = 0;
  private _elapsedTime: number = 0;

  // FPS tracking
  private _fps: number = 0;
  private _frameCount: number = 0;
  private _fpsUpdateTime: number = 0;
  private _fpsUpdateInterval: number = 1000; // Update FPS every 1 second

  // Time scale (for slow-mo, fast-forward)
  private _timeScale: number = 1.0;

  // Frame limiting
  private _targetFPS: number = 60;
  private _maxDeltaTime: number = 0.1; // Cap at 100ms to prevent spiral of death

  private constructor() {}

  static getInstance(): Time {
    if (!Time._instance) {
      Time._instance = new Time();
    }
    return Time._instance;
  }

  /**
   * Initialize time system
   */
  init(): void {
    this._startTime = performance.now();
    this._lastFrameTime = this._startTime;
    this._fpsUpdateTime = this._startTime;
  }

  /**
   * Update time values - call this at the start of each frame
   */
  update(): void {
    const currentTime = performance.now();

    // Calculate delta time in seconds
    let rawDelta = (currentTime - this._lastFrameTime) / 1000;

    // Cap delta time to prevent large jumps
    rawDelta = Math.min(rawDelta, this._maxDeltaTime);

    // Apply time scale
    this._deltaTime = rawDelta * this._timeScale;

    // Update elapsed time
    this._elapsedTime += this._deltaTime;

    // Update last frame time
    this._lastFrameTime = currentTime;

    // Update FPS
    this.updateFPS(currentTime);
  }

  /**
   * Update FPS counter
   */
  private updateFPS(currentTime: number): void {
    this._frameCount++;

    const timeSinceLastUpdate = currentTime - this._fpsUpdateTime;

    if (timeSinceLastUpdate >= this._fpsUpdateInterval) {
      this._fps = Math.round((this._frameCount * 1000) / timeSinceLastUpdate);
      this._frameCount = 0;
      this._fpsUpdateTime = currentTime;
    }
  }

  /**
   * Get delta time (time since last frame in seconds)
   */
  get deltaTime(): number {
    return this._deltaTime;
  }

  /**
   * Get unscaled delta time
   */
  get unscaledDeltaTime(): number {
    return this._deltaTime / this._timeScale;
  }

  /**
   * Get total elapsed time since start (in seconds)
   */
  get elapsedTime(): number {
    return this._elapsedTime;
  }

  /**
   * Get current FPS
   */
  get fps(): number {
    return this._fps;
  }

  /**
   * Get/Set time scale
   */
  get timeScale(): number {
    return this._timeScale;
  }

  set timeScale(scale: number) {
    this._timeScale = Math.max(0, scale);
  }

  /**
   * Get target FPS
   */
  get targetFPS(): number {
    return this._targetFPS;
  }

  /**
   * Set target FPS
   */
  set targetFPS(fps: number) {
    this._targetFPS = Math.max(1, fps);
  }

  /**
   * Reset time
   */
  reset(): void {
    this.init();
    this._elapsedTime = 0;
    this._frameCount = 0;
    this._timeScale = 1.0;
  }
}

// Export singleton instance
export const time = Time.getInstance();
