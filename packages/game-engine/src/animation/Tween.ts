/**
 * Tween
 * Smooth interpolation system for property animation
 */

export type EasingFunction = (t: number) => number;

/**
 * Easing functions
 */
export class Easing {
  // Linear
  static linear(t: number): number {
    return t;
  }

  // Quadratic
  static easeInQuad(t: number): number {
    return t * t;
  }

  static easeOutQuad(t: number): number {
    return t * (2 - t);
  }

  static easeInOutQuad(t: number): number {
    return t < 0.5 ? 2 * t * t : -1 + (4 - 2 * t) * t;
  }

  // Cubic
  static easeInCubic(t: number): number {
    return t * t * t;
  }

  static easeOutCubic(t: number): number {
    return --t * t * t + 1;
  }

  static easeInOutCubic(t: number): number {
    return t < 0.5 ? 4 * t * t * t : (t - 1) * (2 * t - 2) * (2 * t - 2) + 1;
  }

  // Quartic
  static easeInQuart(t: number): number {
    return t * t * t * t;
  }

  static easeOutQuart(t: number): number {
    return 1 - --t * t * t * t;
  }

  static easeInOutQuart(t: number): number {
    return t < 0.5 ? 8 * t * t * t * t : 1 - 8 * --t * t * t * t;
  }

  // Quintic
  static easeInQuint(t: number): number {
    return t * t * t * t * t;
  }

  static easeOutQuint(t: number): number {
    return 1 + --t * t * t * t * t;
  }

  static easeInOutQuint(t: number): number {
    return t < 0.5 ? 16 * t * t * t * t * t : 1 + 16 * --t * t * t * t * t;
  }

  // Sine
  static easeInSine(t: number): number {
    return 1 - Math.cos((t * Math.PI) / 2);
  }

  static easeOutSine(t: number): number {
    return Math.sin((t * Math.PI) / 2);
  }

  static easeInOutSine(t: number): number {
    return -(Math.cos(Math.PI * t) - 1) / 2;
  }

  // Exponential
  static easeInExpo(t: number): number {
    return t === 0 ? 0 : Math.pow(2, 10 * t - 10);
  }

  static easeOutExpo(t: number): number {
    return t === 1 ? 1 : 1 - Math.pow(2, -10 * t);
  }

  static easeInOutExpo(t: number): number {
    return t === 0
      ? 0
      : t === 1
        ? 1
        : t < 0.5
          ? Math.pow(2, 20 * t - 10) / 2
          : (2 - Math.pow(2, -20 * t + 10)) / 2;
  }

  // Circular
  static easeInCirc(t: number): number {
    return 1 - Math.sqrt(1 - t * t);
  }

  static easeOutCirc(t: number): number {
    return Math.sqrt(1 - --t * t);
  }

  static easeInOutCirc(t: number): number {
    return t < 0.5 ? (1 - Math.sqrt(1 - 4 * t * t)) / 2 : (Math.sqrt(1 - (-2 * t + 2) ** 2) + 1) / 2;
  }

  // Elastic
  static easeInElastic(t: number): number {
    const c4 = (2 * Math.PI) / 3;
    return t === 0 ? 0 : t === 1 ? 1 : -Math.pow(2, 10 * t - 10) * Math.sin((t * 10 - 10.75) * c4);
  }

  static easeOutElastic(t: number): number {
    const c4 = (2 * Math.PI) / 3;
    return t === 0 ? 0 : t === 1 ? 1 : Math.pow(2, -10 * t) * Math.sin((t * 10 - 0.75) * c4) + 1;
  }

  static easeInOutElastic(t: number): number {
    const c5 = (2 * Math.PI) / 4.5;
    return t === 0
      ? 0
      : t === 1
        ? 1
        : t < 0.5
          ? -(Math.pow(2, 20 * t - 10) * Math.sin((20 * t - 11.125) * c5)) / 2
          : (Math.pow(2, -20 * t + 10) * Math.sin((20 * t - 11.125) * c5)) / 2 + 1;
  }

  // Back
  static easeInBack(t: number): number {
    const c1 = 1.70158;
    const c3 = c1 + 1;
    return c3 * t * t * t - c1 * t * t;
  }

  static easeOutBack(t: number): number {
    const c1 = 1.70158;
    const c3 = c1 + 1;
    return 1 + c3 * Math.pow(t - 1, 3) + c1 * Math.pow(t - 1, 2);
  }

  static easeInOutBack(t: number): number {
    const c1 = 1.70158;
    const c2 = c1 * 1.525;
    return t < 0.5
      ? (Math.pow(2 * t, 2) * ((c2 + 1) * 2 * t - c2)) / 2
      : (Math.pow(2 * t - 2, 2) * ((c2 + 1) * (t * 2 - 2) + c2) + 2) / 2;
  }

  // Bounce
  static easeOutBounce(t: number): number {
    const n1 = 7.5625;
    const d1 = 2.75;

    if (t < 1 / d1) {
      return n1 * t * t;
    } else if (t < 2 / d1) {
      return n1 * (t -= 1.5 / d1) * t + 0.75;
    } else if (t < 2.5 / d1) {
      return n1 * (t -= 2.25 / d1) * t + 0.9375;
    } else {
      return n1 * (t -= 2.625 / d1) * t + 0.984375;
    }
  }

  static easeInBounce(t: number): number {
    return 1 - Easing.easeOutBounce(1 - t);
  }

  static easeInOutBounce(t: number): number {
    return t < 0.5
      ? (1 - Easing.easeOutBounce(1 - 2 * t)) / 2
      : (1 + Easing.easeOutBounce(2 * t - 1)) / 2;
  }
}

export interface TweenConfig<T> {
  target: T;
  property: keyof T;
  from?: number;
  to: number;
  duration: number;
  easing?: EasingFunction;
  onUpdate?: (value: number) => void;
  onComplete?: () => void;
  delay?: number;
  loop?: boolean;
  yoyo?: boolean;
}

export class Tween<T = Record<string, number>> {
  private target: T;
  private property: keyof T;
  private from: number;
  private to: number;
  private duration: number;
  private easing: EasingFunction;
  private onUpdate: ((value: number) => void) | null;
  private onComplete: (() => void) | null;
  private delay: number;
  private loop: boolean;
  private yoyo: boolean;

  private elapsedTime: number = 0;
  private delayTime: number = 0;
  private isPlaying: boolean = false;
  private isPaused: boolean = false;
  private isReverse: boolean = false;

  constructor(config: TweenConfig<T>) {
    this.target = config.target;
    this.property = config.property;
    this.from = config.from ?? (this.target[this.property] as number);
    this.to = config.to;
    this.duration = config.duration;
    this.easing = config.easing ?? Easing.linear;
    this.onUpdate = config.onUpdate ?? null;
    this.onComplete = config.onComplete ?? null;
    this.delay = config.delay ?? 0;
    this.loop = config.loop ?? false;
    this.yoyo = config.yoyo ?? false;
  }

  /**
   * Start tween
   */
  start(): this {
    this.isPlaying = true;
    this.isPaused = false;
    this.elapsedTime = 0;
    this.delayTime = 0;
    this.isReverse = false;
    return this;
  }

  /**
   * Stop tween
   */
  stop(): this {
    this.isPlaying = false;
    this.isPaused = false;
    return this;
  }

  /**
   * Pause tween
   */
  pause(): this {
    if (this.isPlaying) {
      this.isPaused = true;
    }
    return this;
  }

  /**
   * Resume tween
   */
  resume(): this {
    if (this.isPaused) {
      this.isPaused = false;
    }
    return this;
  }

  /**
   * Update tween (call every frame)
   */
  update(deltaTime: number): void {
    if (!this.isPlaying || this.isPaused) return;

    // Handle delay
    if (this.delayTime < this.delay) {
      this.delayTime += deltaTime;
      return;
    }

    this.elapsedTime += deltaTime;

    // Calculate progress (0-1)
    let progress = Math.min(this.elapsedTime / this.duration, 1);

    // Apply easing
    const easedProgress = this.easing(progress);

    // Calculate current value
    let currentValue: number;
    if (this.isReverse) {
      currentValue = this.to + (this.from - this.to) * easedProgress;
    } else {
      currentValue = this.from + (this.to - this.from) * easedProgress;
    }

    // Update target property
    (this.target[this.property] as number) = currentValue;

    // Call update callback
    if (this.onUpdate) {
      this.onUpdate(currentValue);
    }

    // Check if completed
    if (progress >= 1) {
      if (this.yoyo) {
        // Reverse direction
        this.isReverse = !this.isReverse;
        this.elapsedTime = 0;

        if (!this.loop && this.isReverse === false) {
          // Completed one full yoyo cycle
          this.isPlaying = false;
          if (this.onComplete) {
            this.onComplete();
          }
        }
      } else if (this.loop) {
        // Restart from beginning
        this.elapsedTime = 0;
      } else {
        // Complete
        this.isPlaying = false;
        if (this.onComplete) {
          this.onComplete();
        }
      }
    }
  }

  /**
   * Check if tween is playing
   */
  getIsPlaying(): boolean {
    return this.isPlaying && !this.isPaused;
  }

  /**
   * Get progress (0-1)
   */
  getProgress(): number {
    return Math.min(this.elapsedTime / this.duration, 1);
  }

  /**
   * Set easing function
   */
  setEasing(easing: EasingFunction): this {
    this.easing = easing;
    return this;
  }

  /**
   * Chain another tween
   */
  then(config: Partial<TweenConfig<T>>): Tween<T> {
    const nextTween = new Tween({
      target: this.target,
      property: this.property,
      from: this.to,
      to: config.to ?? this.from,
      duration: config.duration ?? this.duration,
      easing: config.easing,
      onUpdate: config.onUpdate,
      onComplete: config.onComplete,
      delay: config.delay,
    });

    const originalOnComplete = this.onComplete;
    this.onComplete = () => {
      if (originalOnComplete) {
        originalOnComplete();
      }
      nextTween.start();
    };

    return nextTween;
  }
}

/**
 * TweenManager
 * Manages multiple tweens
 */
export class TweenManager {
  private static _instance: TweenManager;

  private tweens: Tween[] = [];

  private constructor() {}

  static getInstance(): TweenManager {
    if (!TweenManager._instance) {
      TweenManager._instance = new TweenManager();
    }
    return TweenManager._instance;
  }

  /**
   * Add and start a tween
   */
  add<T>(config: TweenConfig<T>): Tween<T> {
    const tween = new Tween(config);
    this.tweens.push(tween as Tween);
    tween.start();
    return tween;
  }

  /**
   * Remove a tween
   */
  remove(tween: Tween): void {
    const index = this.tweens.indexOf(tween);
    if (index > -1) {
      this.tweens.splice(index, 1);
    }
  }

  /**
   * Update all tweens
   */
  update(deltaTime: number): void {
    for (let i = this.tweens.length - 1; i >= 0; i--) {
      const tween = this.tweens[i]!;
      tween.update(deltaTime);

      // Remove completed tweens
      if (!tween.getIsPlaying()) {
        this.tweens.splice(i, 1);
      }
    }
  }

  /**
   * Stop all tweens
   */
  stopAll(): void {
    for (const tween of this.tweens) {
      tween.stop();
    }
    this.tweens = [];
  }

  /**
   * Get active tween count
   */
  getCount(): number {
    return this.tweens.length;
  }
}

// Export singleton instance
export const tweenManager = TweenManager.getInstance();
