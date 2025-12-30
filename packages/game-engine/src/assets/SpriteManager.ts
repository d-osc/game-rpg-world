/**
 * SpriteManager
 * Manages sprite rendering, caching, and batching
 */

import { Vector2 } from '../math/Vector2.ts';
import { TextureAtlas, SpriteSheet, SpriteFrame } from './TextureAtlas.ts';

export interface SpriteOptions {
  rotation?: number;
  scale?: Vector2;
  alpha?: number;
  flipX?: boolean;
  flipY?: boolean;
  tint?: string;
  anchorX?: number; // 0 = left, 0.5 = center, 1 = right
  anchorY?: number; // 0 = top, 0.5 = center, 1 = bottom
}

export interface Sprite {
  image: HTMLImageElement;
  frame?: SpriteFrame;
  position: Vector2;
  options?: SpriteOptions;
  layer?: number;
}

/**
 * SpriteManager
 * Handles sprite rendering with caching and batching
 */
export class SpriteManager {
  private static _instance: SpriteManager;

  // Sprite batches by layer
  private batches: Map<number, Sprite[]> = new Map();
  private sortedLayers: number[] = [];

  // Off-screen canvas for sprite caching
  private cacheCanvas: HTMLCanvasElement | null = null;
  private cacheContext: CanvasRenderingContext2D | null = null;

  private constructor() {
    // Create cache canvas
    if (typeof document !== 'undefined') {
      this.cacheCanvas = document.createElement('canvas');
      this.cacheContext = this.cacheCanvas.getContext('2d');
    }
  }

  static getInstance(): SpriteManager {
    if (!SpriteManager._instance) {
      SpriteManager._instance = new SpriteManager();
    }
    return SpriteManager._instance;
  }

  /**
   * Add sprite to batch
   */
  addSprite(sprite: Sprite): void {
    const layer = sprite.layer ?? 0;

    if (!this.batches.has(layer)) {
      this.batches.set(layer, []);
      this.updateSortedLayers();
    }

    this.batches.get(layer)!.push(sprite);
  }

  /**
   * Draw a single sprite immediately
   */
  drawSprite(ctx: CanvasRenderingContext2D, sprite: Sprite): void {
    const options = sprite.options || {};
    const rotation = options.rotation ?? 0;
    const scale = options.scale ?? new Vector2(1, 1);
    const alpha = options.alpha ?? 1;
    const flipX = options.flipX ?? false;
    const flipY = options.flipY ?? false;
    const anchorX = options.anchorX ?? 0.5;
    const anchorY = options.anchorY ?? 0.5;

    // Get frame dimensions
    const frame = sprite.frame;
    const width = frame ? frame.width : sprite.image.width;
    const height = frame ? frame.height : sprite.image.height;

    // Calculate anchor offset
    const offsetX = -width * anchorX;
    const offsetY = -height * anchorY;

    ctx.save();

    // Apply transformations
    ctx.translate(sprite.position.x, sprite.position.y);
    ctx.rotate(rotation);
    ctx.scale(scale.x * (flipX ? -1 : 1), scale.y * (flipY ? -1 : 1));
    ctx.globalAlpha = alpha;

    // Apply tint if specified
    if (options.tint) {
      ctx.globalCompositeOperation = 'multiply';
      ctx.fillStyle = options.tint;
    }

    // Draw sprite
    if (frame) {
      ctx.drawImage(
        sprite.image,
        frame.x,
        frame.y,
        frame.width,
        frame.height,
        offsetX,
        offsetY,
        frame.width,
        frame.height
      );
    } else {
      ctx.drawImage(sprite.image, offsetX, offsetY, width, height);
    }

    ctx.restore();
  }

  /**
   * Draw sprite from texture atlas
   */
  drawAtlasSprite(
    ctx: CanvasRenderingContext2D,
    atlas: TextureAtlas,
    frameName: string,
    position: Vector2,
    options?: SpriteOptions
  ): void {
    const frame = atlas.getFrame(frameName);
    if (!frame) {
      console.warn(`Frame "${frameName}" not found in atlas`);
      return;
    }

    const sprite: Sprite = {
      image: atlas.getImage(),
      frame,
      position,
      options,
    };

    this.drawSprite(ctx, sprite);
  }

  /**
   * Draw sprite from sprite sheet
   */
  drawSpriteSheetFrame(
    ctx: CanvasRenderingContext2D,
    spriteSheet: SpriteSheet,
    frameIndex: number,
    position: Vector2,
    options?: SpriteOptions
  ): void {
    const frame = spriteSheet.getFrame(frameIndex);
    if (!frame) {
      console.warn(`Frame index ${frameIndex} out of bounds`);
      return;
    }

    const sprite: Sprite = {
      image: spriteSheet.getImage(),
      frame,
      position,
      options,
    };

    this.drawSprite(ctx, sprite);
  }

  /**
   * Render all batched sprites
   */
  renderBatches(ctx: CanvasRenderingContext2D): void {
    // Render sprites by layer (sorted)
    for (const layer of this.sortedLayers) {
      const sprites = this.batches.get(layer);
      if (!sprites) continue;

      for (const sprite of sprites) {
        this.drawSprite(ctx, sprite);
      }
    }
  }

  /**
   * Clear all batches
   */
  clearBatches(): void {
    this.batches.clear();
    this.sortedLayers = [];
  }

  /**
   * Update sorted layers
   */
  private updateSortedLayers(): void {
    this.sortedLayers = Array.from(this.batches.keys()).sort((a, b) => a - b);
  }

  /**
   * Create a cached sprite (pre-rendered to off-screen canvas)
   */
  createCachedSprite(
    image: HTMLImageElement,
    frame?: SpriteFrame,
    options?: SpriteOptions
  ): HTMLCanvasElement | null {
    if (!this.cacheCanvas || !this.cacheContext) {
      console.warn('Cache canvas not available');
      return null;
    }

    const width = frame ? frame.width : image.width;
    const height = frame ? frame.height : image.height;

    // Resize cache canvas
    this.cacheCanvas.width = width;
    this.cacheCanvas.height = height;

    // Clear canvas
    this.cacheContext.clearRect(0, 0, width, height);

    // Draw sprite to cache
    if (frame) {
      this.cacheContext.drawImage(image, frame.x, frame.y, frame.width, frame.height, 0, 0, width, height);
    } else {
      this.cacheContext.drawImage(image, 0, 0);
    }

    // Apply options (tint, etc.)
    if (options?.tint) {
      this.cacheContext.globalCompositeOperation = 'multiply';
      this.cacheContext.fillStyle = options.tint;
      this.cacheContext.fillRect(0, 0, width, height);
    }

    // Clone the cached canvas
    const cachedCanvas = document.createElement('canvas');
    cachedCanvas.width = width;
    cachedCanvas.height = height;
    const cachedCtx = cachedCanvas.getContext('2d');
    if (cachedCtx) {
      cachedCtx.drawImage(this.cacheCanvas, 0, 0);
    }

    return cachedCanvas;
  }

  /**
   * Draw simple sprite (without batching)
   */
  drawSimpleSprite(
    ctx: CanvasRenderingContext2D,
    image: HTMLImageElement,
    x: number,
    y: number,
    width?: number,
    height?: number
  ): void {
    const w = width ?? image.width;
    const h = height ?? image.height;
    ctx.drawImage(image, x, y, w, h);
  }

  /**
   * Draw sprite with rotation
   */
  drawRotatedSprite(
    ctx: CanvasRenderingContext2D,
    image: HTMLImageElement,
    x: number,
    y: number,
    rotation: number,
    anchorX: number = 0.5,
    anchorY: number = 0.5
  ): void {
    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(rotation);
    ctx.drawImage(image, -image.width * anchorX, -image.height * anchorY);
    ctx.restore();
  }

  /**
   * Draw sprite with scale
   */
  drawScaledSprite(
    ctx: CanvasRenderingContext2D,
    image: HTMLImageElement,
    x: number,
    y: number,
    scaleX: number,
    scaleY: number,
    anchorX: number = 0.5,
    anchorY: number = 0.5
  ): void {
    ctx.save();
    ctx.translate(x, y);
    ctx.scale(scaleX, scaleY);
    ctx.drawImage(image, -image.width * anchorX, -image.height * anchorY);
    ctx.restore();
  }

  /**
   * Draw tiled sprite (repeat pattern)
   */
  drawTiledSprite(
    ctx: CanvasRenderingContext2D,
    image: HTMLImageElement,
    x: number,
    y: number,
    width: number,
    height: number
  ): void {
    const pattern = ctx.createPattern(image, 'repeat');
    if (!pattern) return;

    ctx.save();
    ctx.translate(x, y);
    ctx.fillStyle = pattern;
    ctx.fillRect(0, 0, width, height);
    ctx.restore();
  }

  /**
   * Draw sprite with alpha
   */
  drawSpriteWithAlpha(
    ctx: CanvasRenderingContext2D,
    image: HTMLImageElement,
    x: number,
    y: number,
    alpha: number
  ): void {
    ctx.save();
    ctx.globalAlpha = alpha;
    ctx.drawImage(image, x, y);
    ctx.restore();
  }

  /**
   * Get sprite bounds
   */
  getSpriteBounds(sprite: Sprite): { x: number; y: number; width: number; height: number } {
    const frame = sprite.frame;
    const width = frame ? frame.width : sprite.image.width;
    const height = frame ? frame.height : sprite.image.height;

    const options = sprite.options || {};
    const anchorX = options.anchorX ?? 0.5;
    const anchorY = options.anchorY ?? 0.5;
    const scale = options.scale ?? new Vector2(1, 1);

    return {
      x: sprite.position.x - width * anchorX * scale.x,
      y: sprite.position.y - height * anchorY * scale.y,
      width: width * scale.x,
      height: height * scale.y,
    };
  }
}

// Export singleton instance
export const spriteManager = SpriteManager.getInstance();
