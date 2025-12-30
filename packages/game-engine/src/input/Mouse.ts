/**
 * Mouse
 * Mouse input management
 */

import { Vector2 } from '../math/Vector2.ts';

export enum MouseButton {
  LEFT = 0,
  MIDDLE = 1,
  RIGHT = 2,
}

export class Mouse {
  private static _instance: Mouse;

  // Mouse position
  private position: Vector2 = Vector2.zero();
  private previousPosition: Vector2 = Vector2.zero();
  private delta: Vector2 = Vector2.zero();

  // Button states
  private buttons: Map<number, boolean> = new Map();
  private buttonsPressed: Map<number, boolean> = new Map();
  private buttonsReleased: Map<number, boolean> = new Map();

  // Wheel
  private wheelDelta: number = 0;

  // Event listeners
  private onClickListeners: ((event: MouseEvent) => void)[] = [];
  private onMoveListeners: ((position: Vector2) => void)[] = [];
  private onWheelListeners: ((delta: number) => void)[] = [];

  // Input blocking
  private isEnabled: boolean = true;

  // Target element (usually canvas)
  private targetElement: HTMLElement | null = null;

  private constructor() {}

  static getInstance(): Mouse {
    if (!Mouse._instance) {
      Mouse._instance = new Mouse();
    }
    return Mouse._instance;
  }

  /**
   * Initialize mouse with target element
   */
  init(element: HTMLElement): void {
    this.targetElement = element;
    this.setupEventListeners();
  }

  /**
   * Setup mouse event listeners
   */
  private setupEventListeners(): void {
    if (!this.targetElement) return;

    // Mouse move
    this.targetElement.addEventListener('mousemove', (event) => {
      if (!this.isEnabled) return;

      this.updatePosition(event);

      for (const listener of this.onMoveListeners) {
        listener(this.position);
      }
    });

    // Mouse down
    this.targetElement.addEventListener('mousedown', (event) => {
      if (!this.isEnabled) return;

      const button = event.button;

      if (!this.buttons.get(button)) {
        this.buttonsPressed.set(button, true);
      }
      this.buttons.set(button, true);
    });

    // Mouse up
    this.targetElement.addEventListener('mouseup', (event) => {
      if (!this.isEnabled) return;

      const button = event.button;

      this.buttons.set(button, false);
      this.buttonsReleased.set(button, true);
    });

    // Click
    this.targetElement.addEventListener('click', (event) => {
      if (!this.isEnabled) return;

      for (const listener of this.onClickListeners) {
        listener(event);
      }
    });

    // Mouse wheel
    this.targetElement.addEventListener('wheel', (event) => {
      if (!this.isEnabled) return;

      event.preventDefault();
      this.wheelDelta = event.deltaY;

      for (const listener of this.onWheelListeners) {
        listener(this.wheelDelta);
      }
    });

    // Context menu (right-click)
    this.targetElement.addEventListener('contextmenu', (event) => {
      event.preventDefault();
    });

    // Mouse leave (reset states)
    this.targetElement.addEventListener('mouseleave', () => {
      this.resetButtons();
    });
  }

  /**
   * Update mouse position from event
   */
  private updatePosition(event: MouseEvent): void {
    if (!this.targetElement) return;

    const rect = this.targetElement.getBoundingClientRect();
    this.previousPosition = this.position.clone();
    this.position = new Vector2(event.clientX - rect.left, event.clientY - rect.top);
    this.delta = this.position.subtract(this.previousPosition);
  }

  /**
   * Update mouse state (call once per frame)
   */
  update(): void {
    // Clear pressed/released flags
    this.buttonsPressed.clear();
    this.buttonsReleased.clear();

    // Reset wheel delta
    this.wheelDelta = 0;

    // Reset delta if no movement this frame
    if (this.previousPosition.equals(this.position)) {
      this.delta = Vector2.zero();
    }
  }

  /**
   * Get mouse position
   */
  getPosition(): Vector2 {
    return this.position.clone();
  }

  /**
   * Get mouse X position
   */
  getX(): number {
    return this.position.x;
  }

  /**
   * Get mouse Y position
   */
  getY(): number {
    return this.position.y;
  }

  /**
   * Get mouse movement delta
   */
  getDelta(): Vector2 {
    return this.delta.clone();
  }

  /**
   * Get wheel delta
   */
  getWheelDelta(): number {
    return this.wheelDelta;
  }

  /**
   * Check if button is currently held down
   */
  isButtonDown(button: MouseButton): boolean {
    return this.buttons.get(button) ?? false;
  }

  /**
   * Check if button was just pressed this frame
   */
  isButtonPressed(button: MouseButton): boolean {
    return this.buttonsPressed.get(button) ?? false;
  }

  /**
   * Check if button was just released this frame
   */
  isButtonReleased(button: MouseButton): boolean {
    return this.buttonsReleased.get(button) ?? false;
  }

  /**
   * Check if left button is down
   */
  isLeftButtonDown(): boolean {
    return this.isButtonDown(MouseButton.LEFT);
  }

  /**
   * Check if right button is down
   */
  isRightButtonDown(): boolean {
    return this.isButtonDown(MouseButton.RIGHT);
  }

  /**
   * Check if middle button is down
   */
  isMiddleButtonDown(): boolean {
    return this.isButtonDown(MouseButton.MIDDLE);
  }

  /**
   * Add click listener
   */
  onClick(callback: (event: MouseEvent) => void): void {
    this.onClickListeners.push(callback);
  }

  /**
   * Add move listener
   */
  onMove(callback: (position: Vector2) => void): void {
    this.onMoveListeners.push(callback);
  }

  /**
   * Add wheel listener
   */
  onWheel(callback: (delta: number) => void): void {
    this.onWheelListeners.push(callback);
  }

  /**
   * Remove click listener
   */
  removeClickListener(callback: (event: MouseEvent) => void): void {
    const index = this.onClickListeners.indexOf(callback);
    if (index > -1) {
      this.onClickListeners.splice(index, 1);
    }
  }

  /**
   * Remove move listener
   */
  removeMoveListener(callback: (position: Vector2) => void): void {
    const index = this.onMoveListeners.indexOf(callback);
    if (index > -1) {
      this.onMoveListeners.splice(index, 1);
    }
  }

  /**
   * Remove wheel listener
   */
  removeWheelListener(callback: (delta: number) => void): void {
    const index = this.onWheelListeners.indexOf(callback);
    if (index > -1) {
      this.onWheelListeners.splice(index, 1);
    }
  }

  /**
   * Enable mouse input
   */
  enable(): void {
    this.isEnabled = true;
  }

  /**
   * Disable mouse input
   */
  disable(): void {
    this.isEnabled = false;
    this.resetButtons();
  }

  /**
   * Reset button states
   */
  private resetButtons(): void {
    this.buttons.clear();
    this.buttonsPressed.clear();
    this.buttonsReleased.clear();
  }

  /**
   * Lock pointer (for FPS-style controls)
   */
  lockPointer(): void {
    if (this.targetElement && 'requestPointerLock' in this.targetElement) {
      this.targetElement.requestPointerLock();
    }
  }

  /**
   * Unlock pointer
   */
  unlockPointer(): void {
    if (document.exitPointerLock) {
      document.exitPointerLock();
    }
  }

  /**
   * Check if pointer is locked
   */
  isPointerLocked(): boolean {
    return document.pointerLockElement === this.targetElement;
  }
}

// Export singleton instance
export const mouse = Mouse.getInstance();
