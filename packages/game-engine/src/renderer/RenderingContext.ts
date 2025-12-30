/**
 * Rendering Context
 * Wrapper for rendering context that can be either Canvas2D or WebGL
 */

import { Canvas2DRenderer } from './Canvas2DRenderer.ts';

export type RendererType = 'canvas2d' | 'webgl';

export class RenderingContext {
  private renderer: Canvas2DRenderer | null = null;
  private rendererType: RendererType;

  constructor(canvas: HTMLCanvasElement, type: RendererType = 'canvas2d') {
    this.rendererType = type;

    switch (type) {
      case 'canvas2d':
        this.renderer = new Canvas2DRenderer(canvas);
        break;
      case 'webgl':
        throw new Error('WebGL renderer not implemented yet');
      default:
        throw new Error(`Unknown renderer type: ${type}`);
    }
  }

  /**
   * Get the active renderer
   */
  getRenderer(): Canvas2DRenderer {
    if (!this.renderer) {
      throw new Error('Renderer not initialized');
    }
    return this.renderer;
  }

  /**
   * Get renderer type
   */
  getType(): RendererType {
    return this.rendererType;
  }

  /**
   * Check if using Canvas2D
   */
  isCanvas2D(): boolean {
    return this.rendererType === 'canvas2d';
  }

  /**
   * Check if using WebGL
   */
  isWebGL(): boolean {
    return this.rendererType === 'webgl';
  }
}
