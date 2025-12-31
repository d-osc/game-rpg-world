/**
 * Demo Scene
 * First playable demo - player movement on a map
 */

import {
  Scene,
  Canvas2DRenderer,
  Camera,
  Vector2,
  keyboard,
  Rectangle,
} from '@rpg/game-engine';
import { Player } from '../entities/Player';
import { MovementSystem } from '../systems/MovementSystem';
import { TiledMap, TiledMapLoader } from '../world/TiledMapLoader';

export class DemoScene extends Scene {
  // Renderer
  private renderer: Canvas2DRenderer | null = null;
  private camera: Camera;

  // Entities
  private player: Player | null = null;

  // Systems
  private movementSystem: MovementSystem | null = null;

  // World
  private map: TiledMap | null = null;

  // Debug
  private showDebug: boolean = true;

  constructor() {
    super('DemoScene');

    // Create camera
    this.camera = new Camera(0, 0, 800, 600);
  }

  /**
   * Load scene resources
   */
  async load(): Promise<void> {
    console.log('[DemoScene] Loading...');

    // Create a simple test map
    this.map = TiledMapLoader.createTestMap();

    // Create player at spawn point
    const spawnPoint = this.map.spawnPoint;
    this.player = new Player({
      position: spawnPoint,
      speed: 200,
    });

    // Create movement system
    this.movementSystem = new MovementSystem(this.player, 200);

    // Set camera to follow player with smoothing
    this.camera.follow(this.player.position, 0.1);

    // Set camera bounds to map size
    this.camera.setBounds(this.map.getBounds());

    console.log('[DemoScene] Loaded successfully');
  }

  /**
   * Called when scene becomes active
   */
  onEnter(): void {
    super.onEnter();
    console.log('[DemoScene] Entered');

    // Toggle debug with F3
    keyboard.onKeyPressed('f3', () => {
      this.showDebug = !this.showDebug;
      console.log('[DemoScene] Debug:', this.showDebug);
    });
  }

  /**
   * Update scene logic
   */
  update(deltaTime: number): void {
    if (!this.player || !this.movementSystem) return;

    // Update input (keyboard state)
    keyboard.update();

    // Update movement system
    this.movementSystem.update(deltaTime);

    // Update camera
    this.camera.update(deltaTime);
  }

  /**
   * Render scene
   */
  render(ctx: CanvasRenderingContext2D | WebGLRenderingContext): void {
    if (!(ctx instanceof CanvasRenderingContext2D)) {
      console.warn('[DemoScene] WebGL not supported yet');
      return;
    }

    if (!this.player || !this.map) return;

    // Create renderer if needed
    if (!this.renderer) {
      this.renderer = new Canvas2DRenderer(ctx.canvas as HTMLCanvasElement);
      this.renderer.setCamera(this.camera);
    }

    // Begin frame
    this.renderer.beginFrame();

    // Clear background
    this.renderer.fillRect(0, 0, ctx.canvas.width, ctx.canvas.height, '#87CEEB'); // Sky blue

    // Render map (ground layer)
    this.renderMap(ctx);

    // Render player
    this.renderPlayer(ctx);

    // Render debug info
    if (this.showDebug) {
      this.renderDebug(ctx);
    }

    // End frame
    this.renderer.endFrame();
  }

  /**
   * Render map
   */
  private renderMap(ctx: CanvasRenderingContext2D): void {
    if (!this.map || !this.renderer) return;

    // For now, render a simple grid since we don't have tileset images
    const tileSize = this.map.data.tilewidth;
    const mapWidth = this.map.getWidth();
    const mapHeight = this.map.getHeight();

    // Draw checkerboard pattern
    for (let y = 0; y < this.map.data.height; y++) {
      for (let x = 0; x < this.map.data.width; x++) {
        const color = (x + y) % 2 === 0 ? '#90EE90' : '#7CCD7C'; // Light/dark green
        this.renderer.fillRect(x * tileSize, y * tileSize, tileSize, tileSize, color);
      }
    }

    // Draw grid lines
    ctx.save();
    ctx.strokeStyle = '#000000';
    ctx.lineWidth = 0.5;
    ctx.globalAlpha = 0.2;

    // Vertical lines
    for (let x = 0; x <= this.map.data.width; x++) {
      const worldX = x * tileSize;
      const screenStart = this.camera.worldToScreen(new Vector2(worldX, 0));
      const screenEnd = this.camera.worldToScreen(new Vector2(worldX, mapHeight));
      ctx.beginPath();
      ctx.moveTo(screenStart.x, screenStart.y);
      ctx.lineTo(screenEnd.x, screenEnd.y);
      ctx.stroke();
    }

    // Horizontal lines
    for (let y = 0; y <= this.map.data.height; y++) {
      const worldY = y * tileSize;
      const screenStart = this.camera.worldToScreen(new Vector2(0, worldY));
      const screenEnd = this.camera.worldToScreen(new Vector2(mapWidth, worldY));
      ctx.beginPath();
      ctx.moveTo(screenStart.x, screenStart.y);
      ctx.lineTo(screenEnd.x, screenEnd.y);
      ctx.stroke();
    }

    ctx.restore();
  }

  /**
   * Render player
   */
  private renderPlayer(ctx: CanvasRenderingContext2D): void {
    if (!this.player || !this.renderer) return;

    // For now, render player as a colored circle
    const screenPos = this.camera.worldToScreen(this.player.position);

    // Draw player shadow
    ctx.save();
    ctx.fillStyle = 'rgba(0, 0, 0, 0.3)';
    ctx.beginPath();
    ctx.ellipse(screenPos.x, screenPos.y + 10, 12, 6, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();

    // Draw player
    this.renderer.fillCircle(this.player.position.x, this.player.position.y, 16, '#4169E1'); // Royal blue

    // Draw direction indicator
    const dirEnd = this.player.position.add(this.player.direction.multiply(24));
    const screenDirEnd = this.camera.worldToScreen(dirEnd);

    ctx.save();
    ctx.strokeStyle = '#FFFFFF';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(screenPos.x, screenPos.y);
    ctx.lineTo(screenDirEnd.x, screenDirEnd.y);
    ctx.stroke();
    ctx.restore();
  }

  /**
   * Render debug information
   */
  private renderDebug(ctx: CanvasRenderingContext2D): void {
    if (!this.player) return;

    // Reset camera transform for UI
    ctx.save();
    ctx.setTransform(1, 0, 0, 1, 0, 0);

    // Background for debug text
    ctx.fillStyle = 'rgba(0, 0, 0, 0.7)';
    ctx.fillRect(10, 10, 300, 120);

    // Debug text
    ctx.fillStyle = '#FFFFFF';
    ctx.font = '14px monospace';

    const lines = [
      `FPS: ${Math.round(1 / (performance.now() - this.lastFrameTime) * 1000) || 60}`,
      `Position: (${Math.round(this.player.position.x)}, ${Math.round(this.player.position.y)})`,
      `Velocity: (${this.player.velocity.x.toFixed(1)}, ${this.player.velocity.y.toFixed(1)})`,
      `Moving: ${this.player.isMoving}`,
      `Animation: ${this.player.currentAnimation}`,
      `Camera: (${Math.round(this.camera.position.x)}, ${Math.round(this.camera.position.y)})`,
      `Controls: WASD/Arrows to move, F3 to toggle debug`,
    ];

    lines.forEach((line, index) => {
      ctx.fillText(line, 20, 30 + index * 16);
    });

    ctx.restore();
  }

  private lastFrameTime: number = performance.now();

  /**
   * Clean up scene resources
   */
  destroy(): void {
    console.log('[DemoScene] Destroyed');
    this.player = null;
    this.movementSystem = null;
    this.map = null;
    this.renderer = null;
  }
}
