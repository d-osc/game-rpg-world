/**
 * SpriteAnimation
 * Sprite frame-based animation system
 */

export interface AnimationFrame {
  frameIndex: number;
  duration: number; // in seconds
}

export interface AnimationConfig {
  name: string;
  frames: AnimationFrame[];
  loop?: boolean;
  onComplete?: () => void;
}

export class SpriteAnimation {
  public name: string;
  private frames: AnimationFrame[];
  private loop: boolean;
  private onComplete: (() => void) | null;

  private currentFrameIndex: number = 0;
  private elapsedTime: number = 0;
  private isPlaying: boolean = false;
  private isPaused: boolean = false;
  private hasCompleted: boolean = false;

  constructor(config: AnimationConfig) {
    this.name = config.name;
    this.frames = config.frames;
    this.loop = config.loop ?? false;
    this.onComplete = config.onComplete ?? null;
  }

  /**
   * Start playing animation
   */
  play(): void {
    this.isPlaying = true;
    this.isPaused = false;
    this.hasCompleted = false;
  }

  /**
   * Stop animation and reset to first frame
   */
  stop(): void {
    this.isPlaying = false;
    this.isPaused = false;
    this.currentFrameIndex = 0;
    this.elapsedTime = 0;
    this.hasCompleted = false;
  }

  /**
   * Pause animation
   */
  pause(): void {
    if (this.isPlaying) {
      this.isPaused = true;
    }
  }

  /**
   * Resume animation
   */
  resume(): void {
    if (this.isPaused) {
      this.isPaused = false;
    }
  }

  /**
   * Update animation (call every frame)
   */
  update(deltaTime: number): void {
    if (!this.isPlaying || this.isPaused || this.hasCompleted) {
      return;
    }

    this.elapsedTime += deltaTime;

    const currentFrame = this.frames[this.currentFrameIndex];
    if (!currentFrame) return;

    // Check if we need to advance to next frame
    if (this.elapsedTime >= currentFrame.duration) {
      this.elapsedTime -= currentFrame.duration;
      this.currentFrameIndex++;

      // Check if animation has completed
      if (this.currentFrameIndex >= this.frames.length) {
        if (this.loop) {
          this.currentFrameIndex = 0;
        } else {
          this.currentFrameIndex = this.frames.length - 1;
          this.hasCompleted = true;
          this.isPlaying = false;

          if (this.onComplete) {
            this.onComplete();
          }
        }
      }
    }
  }

  /**
   * Get current frame index for sprite rendering
   */
  getCurrentFrameIndex(): number {
    const frame = this.frames[this.currentFrameIndex];
    return frame ? frame.frameIndex : 0;
  }

  /**
   * Get current animation frame
   */
  getCurrentFrame(): AnimationFrame | null {
    return this.frames[this.currentFrameIndex] || null;
  }

  /**
   * Check if animation is playing
   */
  getIsPlaying(): boolean {
    return this.isPlaying && !this.isPaused;
  }

  /**
   * Check if animation is paused
   */
  getIsPaused(): boolean {
    return this.isPaused;
  }

  /**
   * Check if animation has completed
   */
  getHasCompleted(): boolean {
    return this.hasCompleted;
  }

  /**
   * Get animation progress (0-1)
   */
  getProgress(): number {
    if (this.frames.length === 0) return 0;

    let totalDuration = 0;
    let currentProgress = 0;

    for (let i = 0; i < this.frames.length; i++) {
      const frame = this.frames[i]!;
      if (i < this.currentFrameIndex) {
        currentProgress += frame.duration;
      }
      totalDuration += frame.duration;
    }

    currentProgress += this.elapsedTime;

    return totalDuration > 0 ? currentProgress / totalDuration : 0;
  }

  /**
   * Set loop mode
   */
  setLoop(loop: boolean): void {
    this.loop = loop;
  }

  /**
   * Clone animation
   */
  clone(): SpriteAnimation {
    return new SpriteAnimation({
      name: this.name,
      frames: [...this.frames],
      loop: this.loop,
      onComplete: this.onComplete ?? undefined,
    });
  }

  /**
   * Create simple animation from frame range
   */
  static fromRange(
    name: string,
    startFrame: number,
    endFrame: number,
    frameDuration: number,
    loop: boolean = true
  ): SpriteAnimation {
    const frames: AnimationFrame[] = [];

    for (let i = startFrame; i <= endFrame; i++) {
      frames.push({ frameIndex: i, duration: frameDuration });
    }

    return new SpriteAnimation({ name, frames, loop });
  }

  /**
   * Create animation from frame indices
   */
  static fromFrames(
    name: string,
    frameIndices: number[],
    frameDuration: number,
    loop: boolean = true
  ): SpriteAnimation {
    const frames: AnimationFrame[] = frameIndices.map((frameIndex) => ({
      frameIndex,
      duration: frameDuration,
    }));

    return new SpriteAnimation({ name, frames, loop });
  }
}
