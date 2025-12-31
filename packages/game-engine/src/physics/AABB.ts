/**
 * AABB (Axis-Aligned Bounding Box)
 * Simple collision detection using axis-aligned rectangles
 */

import { Vector2 } from '../math/Vector2';
import { Rectangle } from '../math/Rectangle';

export class AABB {
  // Center position
  center: Vector2;

  // Half extents (half width, half height)
  halfExtents: Vector2;

  constructor(center: Vector2, halfExtents: Vector2) {
    this.center = center;
    this.halfExtents = halfExtents;
  }

  /**
   * Get minimum point (top-left)
   */
  get min(): Vector2 {
    return new Vector2(this.center.x - this.halfExtents.x, this.center.y - this.halfExtents.y);
  }

  /**
   * Get maximum point (bottom-right)
   */
  get max(): Vector2 {
    return new Vector2(this.center.x + this.halfExtents.x, this.center.y + this.halfExtents.y);
  }

  /**
   * Get width
   */
  get width(): number {
    return this.halfExtents.x * 2;
  }

  /**
   * Get height
   */
  get height(): number {
    return this.halfExtents.y * 2;
  }

  /**
   * Convert to Rectangle
   */
  toRectangle(): Rectangle {
    const min = this.min;
    return new Rectangle(min.x, min.y, this.width, this.height);
  }

  /**
   * Create AABB from Rectangle
   */
  static fromRectangle(rect: Rectangle): AABB {
    const center = rect.center;
    const halfExtents = new Vector2(rect.width / 2, rect.height / 2);
    return new AABB(center, halfExtents);
  }

  /**
   * Check if point is inside AABB
   */
  containsPoint(point: Vector2): boolean {
    const min = this.min;
    const max = this.max;

    return (
      point.x >= min.x && point.x <= max.x && point.y >= min.y && point.y <= max.y
    );
  }

  /**
   * Check if this AABB intersects another AABB
   */
  intersects(other: AABB): boolean {
    const min1 = this.min;
    const max1 = this.max;
    const min2 = other.min;
    const max2 = other.max;

    return (
      min1.x < max2.x &&
      max1.x > min2.x &&
      min1.y < max2.y &&
      max1.y > min2.y
    );
  }

  /**
   * Check if this AABB completely contains another AABB
   */
  contains(other: AABB): boolean {
    const min1 = this.min;
    const max1 = this.max;
    const min2 = other.min;
    const max2 = other.max;

    return (
      min2.x >= min1.x &&
      max2.x <= max1.x &&
      min2.y >= min1.y &&
      max2.y <= max1.y
    );
  }

  /**
   * Get intersection with another AABB
   */
  intersection(other: AABB): AABB | null {
    if (!this.intersects(other)) {
      return null;
    }

    const min1 = this.min;
    const max1 = this.max;
    const min2 = other.min;
    const max2 = other.max;

    const minX = Math.max(min1.x, min2.x);
    const minY = Math.max(min1.y, min2.y);
    const maxX = Math.min(max1.x, max2.x);
    const maxY = Math.min(max1.y, max2.y);

    const width = maxX - minX;
    const height = maxY - minY;

    const center = new Vector2(minX + width / 2, minY + height / 2);
    const halfExtents = new Vector2(width / 2, height / 2);

    return new AABB(center, halfExtents);
  }

  /**
   * Get overlap amount with another AABB (for collision resolution)
   */
  getOverlap(other: AABB): Vector2 | null {
    if (!this.intersects(other)) {
      return null;
    }

    const dx = other.center.x - this.center.x;
    const dy = other.center.y - this.center.y;

    const px = other.halfExtents.x + this.halfExtents.x - Math.abs(dx);
    const py = other.halfExtents.y + this.halfExtents.y - Math.abs(dy);

    // Return overlap with sign (direction)
    return new Vector2(px * Math.sign(dx), py * Math.sign(dy));
  }

  /**
   * Clone this AABB
   */
  clone(): AABB {
    return new AABB(this.center.clone(), this.halfExtents.clone());
  }

  /**
   * Move AABB by offset
   */
  translate(offset: Vector2): AABB {
    return new AABB(this.center.add(offset), this.halfExtents.clone());
  }

  /**
   * Expand AABB by amount
   */
  expand(amount: number): AABB {
    return new AABB(
      this.center.clone(),
      new Vector2(this.halfExtents.x + amount, this.halfExtents.y + amount)
    );
  }
}
