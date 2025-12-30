/**
 * 2D Vector class
 * Basic vector operations for 2D game math
 */

export class Vector2 {
  x: number;
  y: number;

  constructor(x: number = 0, y: number = 0) {
    this.x = x;
    this.y = y;
  }

  /**
   * Add another vector to this vector
   */
  add(v: Vector2): Vector2 {
    return new Vector2(this.x + v.x, this.y + v.y);
  }

  /**
   * Subtract another vector from this vector
   */
  subtract(v: Vector2): Vector2 {
    return new Vector2(this.x - v.x, this.y - v.y);
  }

  /**
   * Multiply by scalar
   */
  multiply(scalar: number): Vector2 {
    return new Vector2(this.x * scalar, this.y * scalar);
  }

  /**
   * Divide by scalar
   */
  divide(scalar: number): Vector2 {
    if (scalar === 0) {
      console.warn('Division by zero');
      return new Vector2(this.x, this.y);
    }
    return new Vector2(this.x / scalar, this.y / scalar);
  }

  /**
   * Get the length (magnitude) of the vector
   */
  length(): number {
    return Math.sqrt(this.x * this.x + this.y * this.y);
  }

  /**
   * Get the squared length (faster than length)
   */
  lengthSquared(): number {
    return this.x * this.x + this.y * this.y;
  }

  /**
   * Normalize the vector (make it length 1)
   */
  normalize(): Vector2 {
    const len = this.length();
    if (len === 0) {
      return new Vector2(0, 0);
    }
    return this.divide(len);
  }

  /**
   * Dot product with another vector
   */
  dot(v: Vector2): number {
    return this.x * v.x + this.y * v.y;
  }

  /**
   * Cross product (returns scalar for 2D)
   */
  cross(v: Vector2): number {
    return this.x * v.y - this.y * v.x;
  }

  /**
   * Distance to another vector
   */
  distanceTo(v: Vector2): number {
    const dx = this.x - v.x;
    const dy = this.y - v.y;
    return Math.sqrt(dx * dx + dy * dy);
  }

  /**
   * Squared distance (faster than distanceTo)
   */
  distanceToSquared(v: Vector2): number {
    const dx = this.x - v.x;
    const dy = this.y - v.y;
    return dx * dx + dy * dy;
  }

  /**
   * Angle of the vector in radians
   */
  angle(): number {
    return Math.atan2(this.y, this.x);
  }

  /**
   * Rotate by angle (in radians)
   */
  rotate(angle: number): Vector2 {
    const cos = Math.cos(angle);
    const sin = Math.sin(angle);
    return new Vector2(this.x * cos - this.y * sin, this.x * sin + this.y * cos);
  }

  /**
   * Linear interpolation to another vector
   */
  lerp(v: Vector2, t: number): Vector2 {
    return new Vector2(this.x + (v.x - this.x) * t, this.y + (v.y - this.y) * t);
  }

  /**
   * Clone this vector
   */
  clone(): Vector2 {
    return new Vector2(this.x, this.y);
  }

  /**
   * Copy values from another vector
   */
  copy(v: Vector2): void {
    this.x = v.x;
    this.y = v.y;
  }

  /**
   * Set x and y
   */
  set(x: number, y: number): void {
    this.x = x;
    this.y = y;
  }

  /**
   * Check if equal to another vector
   */
  equals(v: Vector2): boolean {
    return this.x === v.x && this.y === v.y;
  }

  /**
   * Convert to string
   */
  toString(): string {
    return `Vector2(${this.x}, ${this.y})`;
  }

  /**
   * Static zero vector
   */
  static zero(): Vector2 {
    return new Vector2(0, 0);
  }

  /**
   * Static one vector
   */
  static one(): Vector2 {
    return new Vector2(1, 1);
  }

  /**
   * Static up vector
   */
  static up(): Vector2 {
    return new Vector2(0, -1);
  }

  /**
   * Static down vector
   */
  static down(): Vector2 {
    return new Vector2(0, 1);
  }

  /**
   * Static left vector
   */
  static left(): Vector2 {
    return new Vector2(-1, 0);
  }

  /**
   * Static right vector
   */
  static right(): Vector2 {
    return new Vector2(1, 0);
  }
}
