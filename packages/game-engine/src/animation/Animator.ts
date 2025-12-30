/**
 * Animator
 * Manages multiple animations and transitions
 */

import { SpriteAnimation } from './SpriteAnimation.ts';

export interface AnimatorConfig {
  animations: SpriteAnimation[];
  defaultAnimation?: string;
}

export class Animator {
  private animations: Map<string, SpriteAnimation> = new Map();
  private currentAnimation: SpriteAnimation | null = null;
  private defaultAnimationName: string | null = null;

  // Transition
  private isTransitioning: boolean = false;
  private nextAnimation: string | null = null;

  constructor(config?: AnimatorConfig) {
    if (config) {
      for (const animation of config.animations) {
        this.addAnimation(animation);
      }

      if (config.defaultAnimation) {
        this.defaultAnimationName = config.defaultAnimation;
        this.play(config.defaultAnimation);
      }
    }
  }

  /**
   * Add an animation
   */
  addAnimation(animation: SpriteAnimation): void {
    this.animations.set(animation.name, animation);
  }

  /**
   * Remove an animation
   */
  removeAnimation(name: string): void {
    if (this.currentAnimation?.name === name) {
      this.currentAnimation = null;
    }
    this.animations.delete(name);
  }

  /**
   * Play an animation
   */
  play(name: string, force: boolean = false): boolean {
    const animation = this.animations.get(name);
    if (!animation) {
      console.warn(`Animation "${name}" not found`);
      return false;
    }

    // Don't restart if already playing (unless forced)
    if (this.currentAnimation === animation && !force) {
      return true;
    }

    // Stop current animation
    if (this.currentAnimation) {
      this.currentAnimation.stop();
    }

    // Start new animation
    this.currentAnimation = animation;
    this.currentAnimation.play();
    this.isTransitioning = false;

    return true;
  }

  /**
   * Play animation after current finishes
   */
  playAfter(name: string): void {
    if (!this.currentAnimation || this.currentAnimation.getHasCompleted()) {
      this.play(name);
    } else {
      this.nextAnimation = name;
      this.isTransitioning = true;
    }
  }

  /**
   * Stop current animation
   */
  stop(): void {
    if (this.currentAnimation) {
      this.currentAnimation.stop();
      this.currentAnimation = null;
    }
    this.isTransitioning = false;
    this.nextAnimation = null;
  }

  /**
   * Pause current animation
   */
  pause(): void {
    if (this.currentAnimation) {
      this.currentAnimation.pause();
    }
  }

  /**
   * Resume current animation
   */
  resume(): void {
    if (this.currentAnimation) {
      this.currentAnimation.resume();
    }
  }

  /**
   * Update animator (call every frame)
   */
  update(deltaTime: number): void {
    if (!this.currentAnimation) return;

    this.currentAnimation.update(deltaTime);

    // Check for transition to next animation
    if (this.isTransitioning && this.currentAnimation.getHasCompleted() && this.nextAnimation) {
      this.play(this.nextAnimation);
      this.nextAnimation = null;
      this.isTransitioning = false;
    }

    // Auto-return to default animation if completed and no transition
    if (
      !this.isTransitioning &&
      this.currentAnimation.getHasCompleted() &&
      this.defaultAnimationName &&
      this.currentAnimation.name !== this.defaultAnimationName
    ) {
      this.play(this.defaultAnimationName);
    }
  }

  /**
   * Get current animation
   */
  getCurrentAnimation(): SpriteAnimation | null {
    return this.currentAnimation;
  }

  /**
   * Get current animation name
   */
  getCurrentAnimationName(): string | null {
    return this.currentAnimation?.name ?? null;
  }

  /**
   * Get current frame index
   */
  getCurrentFrameIndex(): number {
    if (!this.currentAnimation) return 0;
    return this.currentAnimation.getCurrentFrameIndex();
  }

  /**
   * Check if animation exists
   */
  hasAnimation(name: string): boolean {
    return this.animations.has(name);
  }

  /**
   * Get animation
   */
  getAnimation(name: string): SpriteAnimation | null {
    return this.animations.get(name) || null;
  }

  /**
   * Get all animation names
   */
  getAnimationNames(): string[] {
    return Array.from(this.animations.keys());
  }

  /**
   * Check if animator is playing
   */
  isPlaying(): boolean {
    return this.currentAnimation?.getIsPlaying() ?? false;
  }

  /**
   * Check if animator is paused
   */
  isPaused(): boolean {
    return this.currentAnimation?.getIsPaused() ?? false;
  }

  /**
   * Set default animation
   */
  setDefaultAnimation(name: string): void {
    if (this.animations.has(name)) {
      this.defaultAnimationName = name;
    } else {
      console.warn(`Animation "${name}" not found`);
    }
  }

  /**
   * Get default animation name
   */
  getDefaultAnimation(): string | null {
    return this.defaultAnimationName;
  }

  /**
   * Clone animator
   */
  clone(): Animator {
    const animations: SpriteAnimation[] = [];

    for (const animation of this.animations.values()) {
      animations.push(animation.clone());
    }

    return new Animator({
      animations,
      defaultAnimation: this.defaultAnimationName ?? undefined,
    });
  }
}
