/**
 * Touch
 * Touch input management for mobile devices
 */

import { Vector2 } from '../math/Vector2.ts';

export interface TouchInfo {
  id: number;
  position: Vector2;
  previousPosition: Vector2;
  delta: Vector2;
  startPosition: Vector2;
  startTime: number;
  duration: number;
}

export class Touch {
  private static _instance: Touch;

  // Active touches
  private touches: Map<number, TouchInfo> = new Map();

  // Gestures
  private pinchDistance: number = 0;
  private previousPinchDistance: number = 0;
  private isPinching: boolean = false;

  // Event listeners
  private onTouchStartListeners: ((touch: TouchInfo) => void)[] = [];
  private onTouchMoveListeners: ((touch: TouchInfo) => void)[] = [];
  private onTouchEndListeners: ((touch: TouchInfo) => void)[] = [];
  private onTapListeners: ((position: Vector2) => void)[] = [];
  private onDoubleTapListeners: ((position: Vector2) => void)[] = [];
  private onPinchListeners: ((scale: number) => void)[] = [];
  private onSwipeListeners: ((direction: Vector2, velocity: number) => void)[] = [];

  // Input blocking
  private isEnabled: boolean = true;

  // Target element
  private targetElement: HTMLElement | null = null;

  // Double tap detection
  private lastTapTime: number = 0;
  private lastTapPosition: Vector2 = Vector2.zero();
  private doubleTapDelay: number = 300; // ms
  private doubleTapDistance: number = 50; // pixels

  // Swipe detection
  private swipeMinDistance: number = 50; // pixels
  private swipeMaxDuration: number = 500; // ms

  private constructor() {}

  static getInstance(): Touch {
    if (!Touch._instance) {
      Touch._instance = new Touch();
    }
    return Touch._instance;
  }

  /**
   * Initialize touch with target element
   */
  init(element: HTMLElement): void {
    this.targetElement = element;
    this.setupEventListeners();
  }

  /**
   * Setup touch event listeners
   */
  private setupEventListeners(): void {
    if (!this.targetElement) return;

    // Touch start
    this.targetElement.addEventListener('touchstart', (event) => {
      if (!this.isEnabled) return;

      event.preventDefault();

      for (let i = 0; i < event.changedTouches.length; i++) {
        const touch = event.changedTouches[i]!;
        const position = this.getTouchPosition(touch);

        const touchInfo: TouchInfo = {
          id: touch.identifier,
          position,
          previousPosition: position.clone(),
          delta: Vector2.zero(),
          startPosition: position.clone(),
          startTime: Date.now(),
          duration: 0,
        };

        this.touches.set(touch.identifier, touchInfo);

        for (const listener of this.onTouchStartListeners) {
          listener(touchInfo);
        }
      }

      // Update pinch
      this.updatePinch();
    });

    // Touch move
    this.targetElement.addEventListener('touchmove', (event) => {
      if (!this.isEnabled) return;

      event.preventDefault();

      for (let i = 0; i < event.changedTouches.length; i++) {
        const touch = event.changedTouches[i]!;
        const touchInfo = this.touches.get(touch.identifier);

        if (touchInfo) {
          touchInfo.previousPosition = touchInfo.position.clone();
          touchInfo.position = this.getTouchPosition(touch);
          touchInfo.delta = touchInfo.position.subtract(touchInfo.previousPosition);
          touchInfo.duration = Date.now() - touchInfo.startTime;

          for (const listener of this.onTouchMoveListeners) {
            listener(touchInfo);
          }
        }
      }

      // Update pinch
      this.updatePinch();
    });

    // Touch end
    this.targetElement.addEventListener('touchend', (event) => {
      if (!this.isEnabled) return;

      event.preventDefault();

      for (let i = 0; i < event.changedTouches.length; i++) {
        const touch = event.changedTouches[i]!;
        const touchInfo = this.touches.get(touch.identifier);

        if (touchInfo) {
          touchInfo.duration = Date.now() - touchInfo.startTime;

          // Check for tap
          const distance = touchInfo.position.distanceTo(touchInfo.startPosition);
          if (distance < 10 && touchInfo.duration < 200) {
            this.handleTap(touchInfo.position);
          }

          // Check for swipe
          if (distance > this.swipeMinDistance && touchInfo.duration < this.swipeMaxDuration) {
            this.handleSwipe(touchInfo);
          }

          for (const listener of this.onTouchEndListeners) {
            listener(touchInfo);
          }

          this.touches.delete(touch.identifier);
        }
      }

      // Reset pinch
      if (this.touches.size < 2) {
        this.isPinching = false;
      }
    });

    // Touch cancel
    this.targetElement.addEventListener('touchcancel', (event) => {
      if (!this.isEnabled) return;

      for (let i = 0; i < event.changedTouches.length; i++) {
        const touch = event.changedTouches[i]!;
        this.touches.delete(touch.identifier);
      }

      this.isPinching = false;
    });
  }

  /**
   * Get touch position relative to target element
   */
  private getTouchPosition(touch: globalThis.Touch): Vector2 {
    if (!this.targetElement) return Vector2.zero();

    const rect = this.targetElement.getBoundingClientRect();
    return new Vector2(touch.clientX - rect.left, touch.clientY - rect.top);
  }

  /**
   * Update pinch gesture
   */
  private updatePinch(): void {
    if (this.touches.size === 2) {
      const touches = Array.from(this.touches.values());
      const distance = touches[0]!.position.distanceTo(touches[1]!.position);

      if (!this.isPinching) {
        this.isPinching = true;
        this.previousPinchDistance = distance;
      }

      this.pinchDistance = distance;

      // Calculate pinch scale
      if (this.previousPinchDistance > 0) {
        const scale = this.pinchDistance / this.previousPinchDistance;

        for (const listener of this.onPinchListeners) {
          listener(scale);
        }
      }

      this.previousPinchDistance = distance;
    }
  }

  /**
   * Handle tap gesture
   */
  private handleTap(position: Vector2): void {
    const now = Date.now();
    const timeSinceLastTap = now - this.lastTapTime;
    const distance = position.distanceTo(this.lastTapPosition);

    // Check for double tap
    if (timeSinceLastTap < this.doubleTapDelay && distance < this.doubleTapDistance) {
      for (const listener of this.onDoubleTapListeners) {
        listener(position);
      }
      this.lastTapTime = 0; // Reset to prevent triple tap
    } else {
      // Single tap
      for (const listener of this.onTapListeners) {
        listener(position);
      }
      this.lastTapTime = now;
      this.lastTapPosition = position.clone();
    }
  }

  /**
   * Handle swipe gesture
   */
  private handleSwipe(touchInfo: TouchInfo): void {
    const direction = touchInfo.position.subtract(touchInfo.startPosition).normalize();
    const distance = touchInfo.position.distanceTo(touchInfo.startPosition);
    const velocity = distance / touchInfo.duration; // pixels per ms

    for (const listener of this.onSwipeListeners) {
      listener(direction, velocity);
    }
  }

  /**
   * Update touch state (call once per frame)
   */
  update(): void {
    // Update duration for active touches
    const now = Date.now();
    for (const touch of this.touches.values()) {
      touch.duration = now - touch.startTime;
    }
  }

  /**
   * Get all active touches
   */
  getTouches(): TouchInfo[] {
    return Array.from(this.touches.values());
  }

  /**
   * Get touch by ID
   */
  getTouch(id: number): TouchInfo | null {
    return this.touches.get(id) || null;
  }

  /**
   * Get number of active touches
   */
  getTouchCount(): number {
    return this.touches.size;
  }

  /**
   * Get primary touch (first touch)
   */
  getPrimaryTouch(): TouchInfo | null {
    const touches = this.getTouches();
    return touches.length > 0 ? touches[0]! : null;
  }

  /**
   * Check if currently pinching
   */
  getIsPinching(): boolean {
    return this.isPinching;
  }

  /**
   * Get pinch scale
   */
  getPinchScale(): number {
    if (!this.isPinching || this.previousPinchDistance === 0) return 1;
    return this.pinchDistance / this.previousPinchDistance;
  }

  /**
   * Add touch start listener
   */
  onTouchStart(callback: (touch: TouchInfo) => void): void {
    this.onTouchStartListeners.push(callback);
  }

  /**
   * Add touch move listener
   */
  onTouchMove(callback: (touch: TouchInfo) => void): void {
    this.onTouchMoveListeners.push(callback);
  }

  /**
   * Add touch end listener
   */
  onTouchEnd(callback: (touch: TouchInfo) => void): void {
    this.onTouchEndListeners.push(callback);
  }

  /**
   * Add tap listener
   */
  onTap(callback: (position: Vector2) => void): void {
    this.onTapListeners.push(callback);
  }

  /**
   * Add double tap listener
   */
  onDoubleTap(callback: (position: Vector2) => void): void {
    this.onDoubleTapListeners.push(callback);
  }

  /**
   * Add pinch listener
   */
  onPinch(callback: (scale: number) => void): void {
    this.onPinchListeners.push(callback);
  }

  /**
   * Add swipe listener
   */
  onSwipe(callback: (direction: Vector2, velocity: number) => void): void {
    this.onSwipeListeners.push(callback);
  }

  /**
   * Enable touch input
   */
  enable(): void {
    this.isEnabled = true;
  }

  /**
   * Disable touch input
   */
  disable(): void {
    this.isEnabled = false;
    this.touches.clear();
    this.isPinching = false;
  }
}

// Export singleton instance
export const touch = Touch.getInstance();
