/**
 * Game Loop
 * Main game loop using requestAnimationFrame
 */

import { time } from './Time';
import { sceneManager } from './Scene';

export type GameLoopCallback = (deltaTime: number) => void;

export class GameLoop {
  private static _instance: GameLoop;

  private _isRunning: boolean = false;
  private _isPaused: boolean = false;
  private _animationFrameId: number | null = null;

  // Callbacks
  private _updateCallbacks: GameLoopCallback[] = [];
  private _renderCallbacks: GameLoopCallback[] = [];

  // Stats
  private _frameCount: number = 0;

  private constructor() {}

  static getInstance(): GameLoop {
    if (!GameLoop._instance) {
      GameLoop._instance = new GameLoop();
    }
    return GameLoop._instance;
  }

  /**
   * Start the game loop
   */
  start(): void {
    if (this._isRunning) {
      console.warn('Game loop is already running');
      return;
    }

    console.log('[GameLoop] Starting...');

    this._isRunning = true;
    this._isPaused = false;

    // Initialize time
    time.init();

    // Start the loop
    this.loop();
  }

  /**
   * Stop the game loop
   */
  stop(): void {
    if (!this._isRunning) {
      return;
    }

    console.log('[GameLoop] Stopping...');

    this._isRunning = false;

    if (this._animationFrameId !== null) {
      cancelAnimationFrame(this._animationFrameId);
      this._animationFrameId = null;
    }
  }

  /**
   * Pause the game loop
   */
  pause(): void {
    if (!this._isRunning) {
      return;
    }

    console.log('[GameLoop] Paused');
    this._isPaused = true;
  }

  /**
   * Resume the game loop
   */
  resume(): void {
    if (!this._isRunning) {
      return;
    }

    console.log('[GameLoop] Resumed');
    this._isPaused = false;
  }

  /**
   * Main game loop
   */
  private loop = (): void => {
    if (!this._isRunning) {
      return;
    }

    // Request next frame
    this._animationFrameId = requestAnimationFrame(this.loop);

    // Update time
    time.update();

    // Skip update/render if paused
    if (this._isPaused) {
      return;
    }

    const deltaTime = time.deltaTime;

    // Update phase
    this.update(deltaTime);

    // Render phase
    this.render(deltaTime);

    // Increment frame count
    this._frameCount++;
  };

  /**
   * Update phase
   */
  private update(deltaTime: number): void {
    // Update scene manager
    sceneManager.update(deltaTime);

    // Call custom update callbacks
    for (const callback of this._updateCallbacks) {
      callback(deltaTime);
    }
  }

  /**
   * Render phase
   */
  private render(deltaTime: number): void {
    // Call custom render callbacks
    for (const callback of this._renderCallbacks) {
      callback(deltaTime);
    }
  }

  /**
   * Add update callback
   */
  onUpdate(callback: GameLoopCallback): void {
    this._updateCallbacks.push(callback);
  }

  /**
   * Add render callback
   */
  onRender(callback: GameLoopCallback): void {
    this._renderCallbacks.push(callback);
  }

  /**
   * Remove update callback
   */
  removeUpdateCallback(callback: GameLoopCallback): void {
    const index = this._updateCallbacks.indexOf(callback);
    if (index > -1) {
      this._updateCallbacks.splice(index, 1);
    }
  }

  /**
   * Remove render callback
   */
  removeRenderCallback(callback: GameLoopCallback): void {
    const index = this._renderCallbacks.indexOf(callback);
    if (index > -1) {
      this._renderCallbacks.splice(index, 1);
    }
  }

  /**
   * Get running state
   */
  get isRunning(): boolean {
    return this._isRunning;
  }

  /**
   * Get paused state
   */
  get isPaused(): boolean {
    return this._isPaused;
  }

  /**
   * Get frame count
   */
  get frameCount(): number {
    return this._frameCount;
  }

  /**
   * Get FPS
   */
  get fps(): number {
    return time.fps;
  }
}

// Export singleton instance
export const gameLoop = GameLoop.getInstance();
