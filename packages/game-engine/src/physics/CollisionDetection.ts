/**
 * Collision Detection
 * Various collision detection algorithms
 */

import { Vector2 } from '../math/Vector2';
import { Rectangle } from '../math/Rectangle';
import { AABB } from './AABB';

export interface CollisionResult {
  colliding: boolean;
  normal?: Vector2; // Collision normal (direction to push apart)
  penetration?: number; // How deep the collision is
  point?: Vector2; // Point of collision
}

export class CollisionDetection {
  /**
   * Check AABB vs AABB collision
   */
  static aabbVsAabb(a: AABB, b: AABB): CollisionResult {
    const overlap = a.getOverlap(b);

    if (!overlap) {
      return { colliding: false };
    }

    // Determine collision normal (smallest overlap axis)
    let normal: Vector2;
    let penetration: number;

    if (Math.abs(overlap.x) < Math.abs(overlap.y)) {
      // Collision on X axis
      normal = new Vector2(Math.sign(overlap.x), 0);
      penetration = Math.abs(overlap.x);
    } else {
      // Collision on Y axis
      normal = new Vector2(0, Math.sign(overlap.y));
      penetration = Math.abs(overlap.y);
    }

    return {
      colliding: true,
      normal,
      penetration,
      point: a.center.clone(), // Approximate collision point
    };
  }

  /**
   * Check Rectangle vs Rectangle collision
   */
  static rectVsRect(a: Rectangle, b: Rectangle): CollisionResult {
    const aabbA = AABB.fromRectangle(a);
    const aabbB = AABB.fromRectangle(b);

    return this.aabbVsAabb(aabbA, aabbB);
  }

  /**
   * Check Circle vs Circle collision
   */
  static circleVsCircle(
    centerA: Vector2,
    radiusA: number,
    centerB: Vector2,
    radiusB: number
  ): CollisionResult {
    const delta = centerB.subtract(centerA);
    const distance = delta.length();
    const radiusSum = radiusA + radiusB;

    if (distance >= radiusSum) {
      return { colliding: false };
    }

    const penetration = radiusSum - distance;
    const normal = distance > 0 ? delta.divide(distance) : new Vector2(1, 0);

    return {
      colliding: true,
      normal,
      penetration,
      point: centerA.add(normal.multiply(radiusA)),
    };
  }

  /**
   * Check Circle vs AABB collision
   */
  static circleVsAabb(center: Vector2, radius: number, aabb: AABB): CollisionResult {
    // Find closest point on AABB to circle center
    const min = aabb.min;
    const max = aabb.max;

    const closestX = Math.max(min.x, Math.min(center.x, max.x));
    const closestY = Math.max(min.y, Math.min(center.y, max.y));
    const closest = new Vector2(closestX, closestY);

    // Check distance from closest point to circle center
    const delta = center.subtract(closest);
    const distance = delta.length();

    if (distance >= radius) {
      return { colliding: false };
    }

    const penetration = radius - distance;
    const normal = distance > 0 ? delta.divide(distance) : new Vector2(0, -1);

    return {
      colliding: true,
      normal,
      penetration,
      point: closest,
    };
  }

  /**
   * Check Point vs AABB collision
   */
  static pointVsAabb(point: Vector2, aabb: AABB): boolean {
    return aabb.containsPoint(point);
  }

  /**
   * Check Point vs Circle collision
   */
  static pointVsCircle(point: Vector2, center: Vector2, radius: number): boolean {
    return point.distanceToSquared(center) <= radius * radius;
  }

  /**
   * Check Point vs Rectangle collision
   */
  static pointVsRect(point: Vector2, rect: Rectangle): boolean {
    return rect.contains(point);
  }

  /**
   * Raycast vs AABB
   * Returns distance to collision point (or null if no collision)
   */
  static rayVsAabb(
    rayOrigin: Vector2,
    rayDirection: Vector2,
    aabb: AABB,
    maxDistance: number = Infinity
  ): number | null {
    const min = aabb.min;
    const max = aabb.max;

    // Calculate intersection distances for each axis
    const tMin = min.subtract(rayOrigin);
    const tMax = max.subtract(rayOrigin);

    const t1 = new Vector2(
      tMin.x / rayDirection.x,
      tMin.y / rayDirection.y
    );

    const t2 = new Vector2(
      tMax.x / rayDirection.x,
      tMax.y / rayDirection.y
    );

    const tNear = Math.max(Math.min(t1.x, t2.x), Math.min(t1.y, t2.y));
    const tFar = Math.min(Math.max(t1.x, t2.x), Math.max(t1.y, t2.y));

    // No intersection
    if (tFar < 0 || tNear > tFar) {
      return null;
    }

    // Check if within max distance
    const distance = tNear >= 0 ? tNear : tFar;

    if (distance > maxDistance) {
      return null;
    }

    return distance;
  }

  /**
   * Sweep AABB vs AABB (moving AABB collision)
   * Returns time of impact (0-1) or null if no collision
   */
  static sweepAabbVsAabb(
    aabb: AABB,
    velocity: Vector2,
    staticAabb: AABB,
    deltaTime: number
  ): { time: number; normal: Vector2 } | null {
    // Expand static AABB by moving AABB's half extents
    const expandedAabb = new AABB(
      staticAabb.center,
      staticAabb.halfExtents.add(aabb.halfExtents)
    );

    // Raycast from center of moving AABB
    const distance = this.rayVsAabb(
      aabb.center,
      velocity.normalize(),
      expandedAabb,
      velocity.length() * deltaTime
    );

    if (distance === null) {
      return null;
    }

    const time = distance / (velocity.length() * deltaTime);

    // Calculate collision normal
    const hitPoint = aabb.center.add(velocity.multiply(time * deltaTime));
    const normal = this.calculateAabbNormal(hitPoint, staticAabb);

    return { time, normal };
  }

  /**
   * Calculate normal from hit point on AABB surface
   */
  private static calculateAabbNormal(hitPoint: Vector2, aabb: AABB): Vector2 {
    const min = aabb.min;
    const max = aabb.max;
    const center = aabb.center;

    const dx = hitPoint.x - center.x;
    const dy = hitPoint.y - center.y;

    const halfWidth = aabb.halfExtents.x;
    const halfHeight = aabb.halfExtents.y;

    // Check which face was hit
    const distToLeft = Math.abs(hitPoint.x - min.x);
    const distToRight = Math.abs(hitPoint.x - max.x);
    const distToTop = Math.abs(hitPoint.y - min.y);
    const distToBottom = Math.abs(hitPoint.y - max.y);

    const minDist = Math.min(distToLeft, distToRight, distToTop, distToBottom);

    if (minDist === distToLeft) return new Vector2(-1, 0);
    if (minDist === distToRight) return new Vector2(1, 0);
    if (minDist === distToTop) return new Vector2(0, -1);
    return new Vector2(0, 1);
  }
}
