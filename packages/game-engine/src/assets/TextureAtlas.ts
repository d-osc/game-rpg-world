/**
 * TextureAtlas
 * Manages sprite sheets and texture atlases
 */

import { Rectangle } from '../math/Rectangle.ts';

export interface SpriteFrame {
  x: number;
  y: number;
  width: number;
  height: number;
  offsetX?: number;
  offsetY?: number;
  sourceWidth?: number;
  sourceHeight?: number;
}

export interface AtlasData {
  frames: Record<string, SpriteFrame>;
  meta?: {
    image?: string;
    size?: { w: number; h: number };
    scale?: string;
  };
}

/**
 * TextureAtlas
 * Manages sprite frames from a texture atlas
 */
export class TextureAtlas {
  private image: HTMLImageElement;
  private frames: Map<string, SpriteFrame> = new Map();

  constructor(image: HTMLImageElement, atlasData: AtlasData) {
    this.image = image;

    // Load frames
    for (const [key, frame] of Object.entries(atlasData.frames)) {
      this.frames.set(key, frame);
    }
  }

  /**
   * Get a sprite frame by name
   */
  getFrame(name: string): SpriteFrame | null {
    return this.frames.get(name) || null;
  }

  /**
   * Get the atlas image
   */
  getImage(): HTMLImageElement {
    return this.image;
  }

  /**
   * Check if frame exists
   */
  hasFrame(name: string): boolean {
    return this.frames.has(name);
  }

  /**
   * Get all frame names
   */
  getFrameNames(): string[] {
    return Array.from(this.frames.keys());
  }

  /**
   * Get frames matching a pattern (regex)
   */
  getFramesByPattern(pattern: RegExp): string[] {
    return this.getFrameNames().filter((name) => pattern.test(name));
  }

  /**
   * Draw a frame to canvas context
   */
  drawFrame(
    ctx: CanvasRenderingContext2D,
    frameName: string,
    x: number,
    y: number,
    width?: number,
    height?: number
  ): void {
    const frame = this.getFrame(frameName);
    if (!frame) {
      console.warn(`Frame "${frameName}" not found in atlas`);
      return;
    }

    const dw = width ?? frame.width;
    const dh = height ?? frame.height;

    ctx.drawImage(this.image, frame.x, frame.y, frame.width, frame.height, x, y, dw, dh);
  }
}

/**
 * SpriteSheet
 * Simple grid-based sprite sheet (no atlas data needed)
 */
export class SpriteSheet {
  private image: HTMLImageElement;
  private frameWidth: number;
  private frameHeight: number;
  private columns: number;
  private rows: number;
  private totalFrames: number;
  private margin: number;
  private spacing: number;

  constructor(
    image: HTMLImageElement,
    frameWidth: number,
    frameHeight: number,
    options: {
      margin?: number;
      spacing?: number;
      columns?: number;
      rows?: number;
    } = {}
  ) {
    this.image = image;
    this.frameWidth = frameWidth;
    this.frameHeight = frameHeight;
    this.margin = options.margin ?? 0;
    this.spacing = options.spacing ?? 0;

    // Calculate columns and rows
    this.columns =
      options.columns ??
      Math.floor((image.width - this.margin * 2 + this.spacing) / (frameWidth + this.spacing));

    this.rows =
      options.rows ??
      Math.floor((image.height - this.margin * 2 + this.spacing) / (frameHeight + this.spacing));

    this.totalFrames = this.columns * this.rows;
  }

  /**
   * Get frame coordinates by index
   */
  getFrame(index: number): SpriteFrame | null {
    if (index < 0 || index >= this.totalFrames) {
      return null;
    }

    const col = index % this.columns;
    const row = Math.floor(index / this.columns);

    return {
      x: this.margin + col * (this.frameWidth + this.spacing),
      y: this.margin + row * (this.frameHeight + this.spacing),
      width: this.frameWidth,
      height: this.frameHeight,
    };
  }

  /**
   * Get frame by row and column
   */
  getFrameAt(row: number, col: number): SpriteFrame | null {
    if (row < 0 || row >= this.rows || col < 0 || col >= this.columns) {
      return null;
    }

    return this.getFrame(row * this.columns + col);
  }

  /**
   * Get the sprite sheet image
   */
  getImage(): HTMLImageElement {
    return this.image;
  }

  /**
   * Get total number of frames
   */
  getTotalFrames(): number {
    return this.totalFrames;
  }

  /**
   * Draw a frame by index
   */
  drawFrame(
    ctx: CanvasRenderingContext2D,
    frameIndex: number,
    x: number,
    y: number,
    width?: number,
    height?: number
  ): void {
    const frame = this.getFrame(frameIndex);
    if (!frame) {
      console.warn(`Frame index ${frameIndex} out of bounds`);
      return;
    }

    const dw = width ?? frame.width;
    const dh = height ?? frame.height;

    ctx.drawImage(this.image, frame.x, frame.y, frame.width, frame.height, x, y, dw, dh);
  }

  /**
   * Draw a frame by row and column
   */
  drawFrameAt(
    ctx: CanvasRenderingContext2D,
    row: number,
    col: number,
    x: number,
    y: number,
    width?: number,
    height?: number
  ): void {
    const frameIndex = row * this.columns + col;
    this.drawFrame(ctx, frameIndex, x, y, width, height);
  }

  /**
   * Get animation frames (sequence of indices)
   */
  getAnimationFrames(startFrame: number, endFrame: number): number[] {
    const frames: number[] = [];
    for (let i = startFrame; i <= endFrame && i < this.totalFrames; i++) {
      frames.push(i);
    }
    return frames;
  }

  /**
   * Get animation frames from row
   */
  getRowFrames(row: number, startCol: number = 0, endCol?: number): number[] {
    const end = endCol ?? this.columns - 1;
    const frames: number[] = [];

    for (let col = startCol; col <= end && col < this.columns; col++) {
      frames.push(row * this.columns + col);
    }

    return frames;
  }

  /**
   * Get animation frames from column
   */
  getColumnFrames(col: number, startRow: number = 0, endRow?: number): number[] {
    const end = endRow ?? this.rows - 1;
    const frames: number[] = [];

    for (let row = startRow; row <= end && row < this.rows; row++) {
      frames.push(row * this.columns + col);
    }

    return frames;
  }
}

/**
 * Atlas Manager
 * Manages multiple texture atlases
 */
export class AtlasManager {
  private static _instance: AtlasManager;

  private atlases: Map<string, TextureAtlas> = new Map();
  private spriteSheets: Map<string, SpriteSheet> = new Map();

  private constructor() {}

  static getInstance(): AtlasManager {
    if (!AtlasManager._instance) {
      AtlasManager._instance = new AtlasManager();
    }
    return AtlasManager._instance;
  }

  /**
   * Add a texture atlas
   */
  addAtlas(key: string, atlas: TextureAtlas): void {
    this.atlases.set(key, atlas);
  }

  /**
   * Add a sprite sheet
   */
  addSpriteSheet(key: string, spriteSheet: SpriteSheet): void {
    this.spriteSheets.set(key, spriteSheet);
  }

  /**
   * Get texture atlas
   */
  getAtlas(key: string): TextureAtlas | null {
    return this.atlases.get(key) || null;
  }

  /**
   * Get sprite sheet
   */
  getSpriteSheet(key: string): SpriteSheet | null {
    return this.spriteSheets.get(key) || null;
  }

  /**
   * Remove atlas
   */
  removeAtlas(key: string): void {
    this.atlases.delete(key);
  }

  /**
   * Remove sprite sheet
   */
  removeSpriteSheet(key: string): void {
    this.spriteSheets.delete(key);
  }

  /**
   * Clear all atlases
   */
  clear(): void {
    this.atlases.clear();
    this.spriteSheets.clear();
  }
}

// Export singleton instance
export const atlasManager = AtlasManager.getInstance();
