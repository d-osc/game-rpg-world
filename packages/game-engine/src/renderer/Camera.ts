/**
 * Camera class
 * Handles viewport transformation, following targets, and zoom
 */

import { Vector2 } from '../math/Vector2';
import { Rectangle } from '../math/Rectangle';

export class Camera {
  // Camera position (center of viewport)
  position: Vector2;

  // Viewport size
  width: number;
  height: number;

  // Zoom level (1.0 = normal, >1.0 = zoomed in, <1.0 = zoomed out)
  private _zoom: number = 1.0;

  // Camera bounds (optional - restricts camera movement)
  bounds: Rectangle | null = null;

  // Follow target
  private _followTarget: Vector2 | null = null;
  private _followSmoothing: number = 0.1; // 0 = instant, 1 = no follow

  // Shake effect
  private _shakeIntensity: number = 0;
  private _shakeDuration: number = 0;
  private _shakeOffset: Vector2 = Vector2.zero();

  constructor(x: number = 0, y: number = 0, width: number = 800, height: number = 600) {
    this.position = new Vector2(x, y);
    this.width = width;
    this.height = height;
  }

  /**
   * Update camera (call each frame)
   */
  update(deltaTime: number): void {
    // Follow target
    if (this._followTarget) {
      this.updateFollow();
    }

    // Update shake
    if (this._shakeDuration > 0) {
      this.updateShake(deltaTime);
    }

    // Apply bounds
    if (this.bounds) {
      this.applyBounds();
    }
  }

  /**
   * Update follow target
   */
  private updateFollow(): void {
    if (!this._followTarget) return;

    // Smooth follow
    const targetX = this._followTarget.x;
    const targetY = this._followTarget.y;

    this.position.x += (targetX - this.position.x) * (1 - this._followSmoothing);
    this.position.y += (targetY - this.position.y) * (1 - this._followSmoothing);
  }

  /**
   * Update camera shake
   */
  private updateShake(deltaTime: number): void {
    this._shakeDuration -= deltaTime;

    if (this._shakeDuration <= 0) {
      this._shakeDuration = 0;
      this._shakeIntensity = 0;
      this._shakeOffset.set(0, 0);
      return;
    }

    // Random shake offset
    const angle = Math.random() * Math.PI * 2;
    const distance = Math.random() * this._shakeIntensity;

    this._shakeOffset.x = Math.cos(angle) * distance;
    this._shakeOffset.y = Math.sin(angle) * distance;
  }

  /**
   * Apply camera bounds
   */
  private applyBounds(): void {
    if (!this.bounds) return;

    const halfWidth = (this.width / this._zoom) / 2;
    const halfHeight = (this.height / this._zoom) / 2;

    // Clamp position within bounds
    this.position.x = Math.max(
      this.bounds.left + halfWidth,
      Math.min(this.position.x, this.bounds.right - halfWidth)
    );

    this.position.y = Math.max(
      this.bounds.top + halfHeight,
      Math.min(this.position.y, this.bounds.bottom - halfHeight)
    );
  }

  /**
   * Set follow target
   */
  follow(target: Vector2 | null, smoothing: number = 0.1): void {
    this._followTarget = target;
    this._followSmoothing = Math.max(0, Math.min(1, smoothing));
  }

  /**
   * Shake camera
   */
  shake(intensity: number, duration: number): void {
    this._shakeIntensity = intensity;
    this._shakeDuration = duration;
  }

  /**
   * Get viewport rectangle in world space
   */
  getViewport(): Rectangle {
    const halfWidth = (this.width / this._zoom) / 2;
    const halfHeight = (this.height / this._zoom) / 2;

    return new Rectangle(
      this.position.x - halfWidth + this._shakeOffset.x,
      this.position.y - halfHeight + this._shakeOffset.y,
      this.width / this._zoom,
      this.height / this._zoom
    );
  }

  /**
   * Convert world coordinates to screen coordinates
   */
  worldToScreen(worldX: number, worldY: number): Vector2;
  worldToScreen(worldPos: Vector2): Vector2;
  worldToScreen(xOrPos: number | Vector2, y?: number): Vector2 {
    const worldX = typeof xOrPos === 'number' ? xOrPos : xOrPos.x;
    const worldY = typeof xOrPos === 'number' ? y! : xOrPos.y;

    const viewport = this.getViewport();

    const screenX = ((worldX - viewport.x) / viewport.width) * this.width;
    const screenY = ((worldY - viewport.y) / viewport.height) * this.height;

    return new Vector2(screenX, screenY);
  }

  /**
   * Convert screen coordinates to world coordinates
   */
  screenToWorld(screenX: number, screenY: number): Vector2;
  screenToWorld(screenPos: Vector2): Vector2;
  screenToWorld(xOrPos: number | Vector2, y?: number): Vector2 {
    const screenX = typeof xOrPos === 'number' ? xOrPos : xOrPos.x;
    const screenY = typeof xOrPos === 'number' ? y! : xOrPos.y;

    const viewport = this.getViewport();

    const worldX = viewport.x + (screenX / this.width) * viewport.width;
    const worldY = viewport.y + (screenY / this.height) * viewport.height;

    return new Vector2(worldX, worldY);
  }

  /**
   * Check if a rectangle is visible in the camera viewport
   */
  isVisible(rect: Rectangle): boolean {
    return this.getViewport().intersects(rect);
  }

  /**
   * Get/Set zoom level
   */
  get zoom(): number {
    return this._zoom;
  }

  set zoom(value: number) {
    this._zoom = Math.max(0.1, Math.min(10, value)); // Clamp between 0.1 and 10
  }

  /**
   * Set viewport size
   */
  setSize(width: number, height: number): void {
    this.width = width;
    this.height = height;
  }

  /**
   * Set camera bounds
   */
  setBounds(bounds: Rectangle | null): void {
    this.bounds = bounds;
  }

  /**
   * Reset camera
   */
  reset(): void {
    this.position.set(0, 0);
    this._zoom = 1.0;
    this._followTarget = null;
    this._shakeIntensity = 0;
    this._shakeDuration = 0;
    this._shakeOffset.set(0, 0);
  }
}
