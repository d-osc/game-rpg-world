/**
 * Rectangle class
 * Represents a 2D rectangle with position and size
 */

import { Vector2 } from './Vector2';

export class Rectangle {
  x: number;
  y: number;
  width: number;
  height: number;

  constructor(x: number = 0, y: number = 0, width: number = 0, height: number = 0) {
    this.x = x;
    this.y = y;
    this.width = width;
    this.height = height;
  }

  /**
   * Get left edge
   */
  get left(): number {
    return this.x;
  }

  /**
   * Get right edge
   */
  get right(): number {
    return this.x + this.width;
  }

  /**
   * Get top edge
   */
  get top(): number {
    return this.y;
  }

  /**
   * Get bottom edge
   */
  get bottom(): number {
    return this.y + this.height;
  }

  /**
   * Get center point
   */
  get center(): Vector2 {
    return new Vector2(this.x + this.width / 2, this.y + this.height / 2);
  }

  /**
   * Check if point is inside rectangle
   */
  contains(x: number, y: number): boolean;
  contains(point: Vector2): boolean;
  contains(xOrPoint: number | Vector2, y?: number): boolean {
    const px = typeof xOrPoint === 'number' ? xOrPoint : xOrPoint.x;
    const py = typeof xOrPoint === 'number' ? y! : xOrPoint.y;

    return px >= this.left && px <= this.right && py >= this.top && py <= this.bottom;
  }

  /**
   * Check if this rectangle intersects another rectangle
   */
  intersects(rect: Rectangle): boolean {
    return (
      this.left < rect.right &&
      this.right > rect.left &&
      this.top < rect.bottom &&
      this.bottom > rect.top
    );
  }

  /**
   * Check if this rectangle completely contains another rectangle
   */
  containsRect(rect: Rectangle): boolean {
    return (
      rect.left >= this.left &&
      rect.right <= this.right &&
      rect.top >= this.top &&
      rect.bottom <= this.bottom
    );
  }

  /**
   * Get intersection with another rectangle
   */
  intersection(rect: Rectangle): Rectangle | null {
    if (!this.intersects(rect)) {
      return null;
    }

    const x = Math.max(this.left, rect.left);
    const y = Math.max(this.top, rect.top);
    const width = Math.min(this.right, rect.right) - x;
    const height = Math.min(this.bottom, rect.bottom) - y;

    return new Rectangle(x, y, width, height);
  }

  /**
   * Get union with another rectangle
   */
  union(rect: Rectangle): Rectangle {
    const x = Math.min(this.left, rect.left);
    const y = Math.min(this.top, rect.top);
    const width = Math.max(this.right, rect.right) - x;
    const height = Math.max(this.bottom, rect.bottom) - y;

    return new Rectangle(x, y, width, height);
  }

  /**
   * Clone this rectangle
   */
  clone(): Rectangle {
    return new Rectangle(this.x, this.y, this.width, this.height);
  }

  /**
   * Copy values from another rectangle
   */
  copy(rect: Rectangle): void {
    this.x = rect.x;
    this.y = rect.y;
    this.width = rect.width;
    this.height = rect.height;
  }

  /**
   * Set values
   */
  set(x: number, y: number, width: number, height: number): void {
    this.x = x;
    this.y = y;
    this.width = width;
    this.height = height;
  }

  /**
   * Check if equal to another rectangle
   */
  equals(rect: Rectangle): boolean {
    return (
      this.x === rect.x && this.y === rect.y && this.width === rect.width && this.height === rect.height
    );
  }

  /**
   * Convert to string
   */
  toString(): string {
    return `Rectangle(${this.x}, ${this.y}, ${this.width}, ${this.height})`;
  }

  /**
   * Create rectangle from bounds
   */
  static fromBounds(left: number, top: number, right: number, bottom: number): Rectangle {
    return new Rectangle(left, top, right - left, bottom - top);
  }
}
