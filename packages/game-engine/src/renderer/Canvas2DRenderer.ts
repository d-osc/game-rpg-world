/**
 * Canvas2D Renderer
 * Main rendering engine using Canvas 2D API
 */

import { Camera } from './Camera.ts';
import { Vector2 } from '../math/Vector2.ts';
import { Rectangle } from '../math/Rectangle.ts';

export interface RenderLayer {
  name: string;
  zIndex: number;
  visible: boolean;
  alpha: number;
}

export class Canvas2DRenderer {
  private canvas: HTMLCanvasElement;
  private ctx: CanvasRenderingContext2D;
  private camera: Camera;

  // Layers
  private layers: Map<string, RenderLayer> = new Map();
  private currentLayer: string = 'default';

  // Stats
  private drawCalls: number = 0;

  constructor(canvas: HTMLCanvasElement) {
    this.canvas = canvas;

    const context = canvas.getContext('2d');
    if (!context) {
      throw new Error('Could not get 2D context from canvas');
    }
    this.ctx = context;

    // Create camera
    this.camera = new Camera(0, 0, canvas.width, canvas.height);

    // Create default layer
    this.addLayer('background', -100);
    this.addLayer('default', 0);
    this.addLayer('entities', 10);
    this.addLayer('ui', 100);

    console.log('[Canvas2DRenderer] Initialized');
  }

  /**
   * Begin frame
   */
  beginFrame(): void {
    this.drawCalls = 0;

    // Clear canvas
    this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);

    // Apply camera transform
    this.ctx.save();
    this.applyCameraTransform();
  }

  /**
   * End frame
   */
  endFrame(): void {
    this.ctx.restore();
  }

  /**
   * Apply camera transformation
   */
  private applyCameraTransform(): void {
    const viewport = this.camera.getViewport();

    // Center the canvas
    this.ctx.translate(this.canvas.width / 2, this.canvas.height / 2);

    // Apply zoom
    this.ctx.scale(this.camera.zoom, this.camera.zoom);

    // Apply camera position
    this.ctx.translate(-this.camera.position.x, -this.camera.position.y);
  }

  /**
   * Add rendering layer
   */
  addLayer(name: string, zIndex: number = 0): void {
    this.layers.set(name, {
      name,
      zIndex,
      visible: true,
      alpha: 1.0,
    });
  }

  /**
   * Set current layer
   */
  setLayer(name: string): void {
    if (!this.layers.has(name)) {
      console.warn(`Layer "${name}" does not exist`);
      return;
    }
    this.currentLayer = name;
  }

  /**
   * Draw rectangle (filled)
   */
  fillRect(x: number, y: number, width: number, height: number, color: string = '#fff'): void {
    this.ctx.fillStyle = color;
    this.ctx.fillRect(x, y, width, height);
    this.drawCalls++;
  }

  /**
   * Draw rectangle (outline)
   */
  strokeRect(
    x: number,
    y: number,
    width: number,
    height: number,
    color: string = '#fff',
    lineWidth: number = 1
  ): void {
    this.ctx.strokeStyle = color;
    this.ctx.lineWidth = lineWidth;
    this.ctx.strokeRect(x, y, width, height);
    this.drawCalls++;
  }

  /**
   * Draw circle (filled)
   */
  fillCircle(x: number, y: number, radius: number, color: string = '#fff'): void {
    this.ctx.fillStyle = color;
    this.ctx.beginPath();
    this.ctx.arc(x, y, radius, 0, Math.PI * 2);
    this.ctx.fill();
    this.drawCalls++;
  }

  /**
   * Draw circle (outline)
   */
  strokeCircle(
    x: number,
    y: number,
    radius: number,
    color: string = '#fff',
    lineWidth: number = 1
  ): void {
    this.ctx.strokeStyle = color;
    this.ctx.lineWidth = lineWidth;
    this.ctx.beginPath();
    this.ctx.arc(x, y, radius, 0, Math.PI * 2);
    this.ctx.stroke();
    this.drawCalls++;
  }

  /**
   * Draw line
   */
  drawLine(
    x1: number,
    y1: number,
    x2: number,
    y2: number,
    color: string = '#fff',
    lineWidth: number = 1
  ): void {
    this.ctx.strokeStyle = color;
    this.ctx.lineWidth = lineWidth;
    this.ctx.beginPath();
    this.ctx.moveTo(x1, y1);
    this.ctx.lineTo(x2, y2);
    this.ctx.stroke();
    this.drawCalls++;
  }

  /**
   * Draw text
   */
  drawText(
    text: string,
    x: number,
    y: number,
    options: {
      font?: string;
      color?: string;
      align?: CanvasTextAlign;
      baseline?: CanvasTextBaseline;
    } = {}
  ): void {
    const { font = '16px Arial', color = '#fff', align = 'left', baseline = 'top' } = options;

    this.ctx.font = font;
    this.ctx.fillStyle = color;
    this.ctx.textAlign = align;
    this.ctx.textBaseline = baseline;
    this.ctx.fillText(text, x, y);
    this.drawCalls++;
  }

  /**
   * Draw image/sprite
   */
  drawImage(
    image: HTMLImageElement | HTMLCanvasElement,
    x: number,
    y: number,
    width?: number,
    height?: number
  ): void {
    if (width !== undefined && height !== undefined) {
      this.ctx.drawImage(image, x, y, width, height);
    } else {
      this.ctx.drawImage(image, x, y);
    }
    this.drawCalls++;
  }

  /**
   * Draw sprite from sprite sheet
   */
  drawSprite(
    image: HTMLImageElement | HTMLCanvasElement,
    sourceX: number,
    sourceY: number,
    sourceWidth: number,
    sourceHeight: number,
    destX: number,
    destY: number,
    destWidth?: number,
    destHeight?: number
  ): void {
    const dw = destWidth ?? sourceWidth;
    const dh = destHeight ?? sourceHeight;

    this.ctx.drawImage(
      image,
      sourceX,
      sourceY,
      sourceWidth,
      sourceHeight,
      destX,
      destY,
      dw,
      dh
    );
    this.drawCalls++;
  }

  /**
   * Save context state
   */
  save(): void {
    this.ctx.save();
  }

  /**
   * Restore context state
   */
  restore(): void {
    this.ctx.restore();
  }

  /**
   * Set global alpha
   */
  setAlpha(alpha: number): void {
    this.ctx.globalAlpha = Math.max(0, Math.min(1, alpha));
  }

  /**
   * Translate context
   */
  translate(x: number, y: number): void {
    this.ctx.translate(x, y);
  }

  /**
   * Rotate context
   */
  rotate(angle: number): void {
    this.ctx.rotate(angle);
  }

  /**
   * Scale context
   */
  scale(x: number, y: number): void {
    this.ctx.scale(x, y);
  }

  /**
   * Get camera
   */
  getCamera(): Camera {
    return this.camera;
  }

  /**
   * Get canvas
   */
  getCanvas(): HTMLCanvasElement {
    return this.canvas;
  }

  /**
   * Get context
   */
  getContext(): CanvasRenderingContext2D {
    return this.ctx;
  }

  /**
   * Get draw calls count
   */
  getDrawCalls(): number {
    return this.drawCalls;
  }

  /**
   * Resize canvas
   */
  resize(width: number, height: number): void {
    this.canvas.width = width;
    this.canvas.height = height;
    this.camera.setSize(width, height);
  }

  /**
   * Get canvas size
   */
  getSize(): { width: number; height: number } {
    return {
      width: this.canvas.width,
      height: this.canvas.height,
    };
  }
}
