/**
 * Quadtree
 * Spatial partitioning data structure for efficient collision detection
 */

import { Rectangle } from '../math/Rectangle.ts';
import { Vector2 } from '../math/Vector2.ts';
import { AABB } from './AABB.ts';

export interface QuadtreeObject {
  bounds: AABB;
  data?: unknown; // Custom data attached to object
}

export class Quadtree {
  private static readonly MAX_OBJECTS = 10;
  private static readonly MAX_LEVELS = 5;

  private level: number;
  private bounds: Rectangle;
  private objects: QuadtreeObject[] = [];
  private nodes: Quadtree[] = [];

  constructor(bounds: Rectangle, level: number = 0) {
    this.level = level;
    this.bounds = bounds;
  }

  /**
   * Clear the quadtree
   */
  clear(): void {
    this.objects = [];

    for (const node of this.nodes) {
      node.clear();
    }

    this.nodes = [];
  }

  /**
   * Split the node into 4 subnodes
   */
  private split(): void {
    const subWidth = this.bounds.width / 2;
    const subHeight = this.bounds.height / 2;
    const x = this.bounds.x;
    const y = this.bounds.y;
    const nextLevel = this.level + 1;

    // Top-right
    this.nodes[0] = new Quadtree(
      new Rectangle(x + subWidth, y, subWidth, subHeight),
      nextLevel
    );

    // Top-left
    this.nodes[1] = new Quadtree(new Rectangle(x, y, subWidth, subHeight), nextLevel);

    // Bottom-left
    this.nodes[2] = new Quadtree(
      new Rectangle(x, y + subHeight, subWidth, subHeight),
      nextLevel
    );

    // Bottom-right
    this.nodes[3] = new Quadtree(
      new Rectangle(x + subWidth, y + subHeight, subWidth, subHeight),
      nextLevel
    );
  }

  /**
   * Determine which node the object belongs to
   * -1 means object cannot completely fit within a child node
   */
  private getIndex(aabb: AABB): number {
    const rect = aabb.toRectangle();
    let index = -1;

    const verticalMidpoint = this.bounds.x + this.bounds.width / 2;
    const horizontalMidpoint = this.bounds.y + this.bounds.height / 2;

    // Object can completely fit within the top quadrants
    const topQuadrant = rect.y < horizontalMidpoint && rect.bottom < horizontalMidpoint;

    // Object can completely fit within the bottom quadrants
    const bottomQuadrant = rect.y > horizontalMidpoint;

    // Object can completely fit within the left quadrants
    if (rect.x < verticalMidpoint && rect.right < verticalMidpoint) {
      if (topQuadrant) {
        index = 1; // Top-left
      } else if (bottomQuadrant) {
        index = 2; // Bottom-left
      }
    }
    // Object can completely fit within the right quadrants
    else if (rect.x > verticalMidpoint) {
      if (topQuadrant) {
        index = 0; // Top-right
      } else if (bottomQuadrant) {
        index = 3; // Bottom-right
      }
    }

    return index;
  }

  /**
   * Insert an object into the quadtree
   */
  insert(object: QuadtreeObject): void {
    // If we have subnodes, try to insert into them
    if (this.nodes.length > 0) {
      const index = this.getIndex(object.bounds);

      if (index !== -1) {
        this.nodes[index]!.insert(object);
        return;
      }
    }

    // Add object to this node
    this.objects.push(object);

    // Split if we have too many objects and haven't reached max level
    if (
      this.objects.length > Quadtree.MAX_OBJECTS &&
      this.level < Quadtree.MAX_LEVELS
    ) {
      // Split if we haven't already
      if (this.nodes.length === 0) {
        this.split();
      }

      // Move objects to subnodes if possible
      let i = 0;
      while (i < this.objects.length) {
        const index = this.getIndex(this.objects[i]!.bounds);

        if (index !== -1) {
          const obj = this.objects.splice(i, 1)[0]!;
          this.nodes[index]!.insert(obj);
        } else {
          i++;
        }
      }
    }
  }

  /**
   * Return all objects that could collide with the given object
   */
  retrieve(aabb: AABB): QuadtreeObject[] {
    const index = this.getIndex(aabb);
    let returnObjects: QuadtreeObject[] = [...this.objects];

    // If we have subnodes
    if (this.nodes.length > 0) {
      if (index !== -1) {
        // Object fits completely in a subnode
        returnObjects = returnObjects.concat(this.nodes[index]!.retrieve(aabb));
      } else {
        // Object spans multiple subnodes, check all of them
        for (const node of this.nodes) {
          returnObjects = returnObjects.concat(node.retrieve(aabb));
        }
      }
    }

    return returnObjects;
  }

  /**
   * Query all objects in a given area
   */
  query(area: Rectangle): QuadtreeObject[] {
    const result: QuadtreeObject[] = [];

    // Check if area intersects this node's bounds
    if (!this.bounds.intersects(area)) {
      return result;
    }

    // Add objects from this node that intersect the area
    for (const obj of this.objects) {
      const objRect = obj.bounds.toRectangle();
      if (area.intersects(objRect)) {
        result.push(obj);
      }
    }

    // Query subnodes
    if (this.nodes.length > 0) {
      for (const node of this.nodes) {
        result.push(...node.query(area));
      }
    }

    return result;
  }

  /**
   * Get total number of objects in tree
   */
  size(): number {
    let count = this.objects.length;

    for (const node of this.nodes) {
      count += node.size();
    }

    return count;
  }

  /**
   * Get all objects in the tree
   */
  getAllObjects(): QuadtreeObject[] {
    let allObjects = [...this.objects];

    for (const node of this.nodes) {
      allObjects = allObjects.concat(node.getAllObjects());
    }

    return allObjects;
  }

  /**
   * Debug: Draw quadtree bounds (for visualization)
   */
  debugDraw(ctx: CanvasRenderingContext2D, color: string = '#00ff00'): void {
    ctx.strokeStyle = color;
    ctx.strokeRect(this.bounds.x, this.bounds.y, this.bounds.width, this.bounds.height);

    for (const node of this.nodes) {
      node.debugDraw(ctx, color);
    }
  }
}
