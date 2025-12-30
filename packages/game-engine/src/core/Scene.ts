/**
 * Scene base class
 * Represents a game scene (e.g., MainMenu, GameWorld, Combat)
 */

export abstract class Scene {
  protected _isInitialized: boolean = false;
  protected _isActive: boolean = false;
  public name: string;

  constructor(name: string) {
    this.name = name;
  }

  /**
   * Load resources and initialize scene
   * Called once when scene is first created
   */
  abstract load(): Promise<void>;

  /**
   * Called when scene becomes active
   */
  onEnter(): void {
    this._isActive = true;
  }

  /**
   * Called when scene becomes inactive
   */
  onExit(): void {
    this._isActive = false;
  }

  /**
   * Update scene logic
   * @param deltaTime - Time since last frame in seconds
   */
  abstract update(deltaTime: number): void;

  /**
   * Render scene
   * @param ctx - Rendering context
   */
  abstract render(ctx: CanvasRenderingContext2D | WebGLRenderingContext): void;

  /**
   * Clean up scene resources
   */
  abstract destroy(): void;

  get isInitialized(): boolean {
    return this._isInitialized;
  }

  get isActive(): boolean {
    return this._isActive;
  }
}

/**
 * Scene Manager
 * Manages scene transitions and lifecycle
 */
export class SceneManager {
  private static _instance: SceneManager;
  private _scenes: Map<string, Scene> = new Map();
  private _currentScene: Scene | null = null;
  private _isTransitioning: boolean = false;

  private constructor() {}

  static getInstance(): SceneManager {
    if (!SceneManager._instance) {
      SceneManager._instance = new SceneManager();
    }
    return SceneManager._instance;
  }

  /**
   * Register a scene
   */
  addScene(scene: Scene): void {
    if (this._scenes.has(scene.name)) {
      console.warn(`Scene "${scene.name}" already exists`);
      return;
    }
    this._scenes.set(scene.name, scene);
  }

  /**
   * Remove a scene
   */
  removeScene(name: string): void {
    const scene = this._scenes.get(name);
    if (scene) {
      if (scene === this._currentScene) {
        console.warn(`Cannot remove active scene "${name}"`);
        return;
      }
      scene.destroy();
      this._scenes.delete(name);
    }
  }

  /**
   * Switch to a different scene
   */
  async switchTo(name: string): Promise<void> {
    if (this._isTransitioning) {
      console.warn('Scene transition already in progress');
      return;
    }

    const nextScene = this._scenes.get(name);
    if (!nextScene) {
      console.error(`Scene "${name}" not found`);
      return;
    }

    this._isTransitioning = true;

    // Exit current scene
    if (this._currentScene) {
      this._currentScene.onExit();
    }

    // Load next scene if not initialized
    if (!nextScene.isInitialized) {
      await nextScene.load();
      nextScene['_isInitialized'] = true;
    }

    // Enter next scene
    this._currentScene = nextScene;
    this._currentScene.onEnter();

    this._isTransitioning = false;

    console.log(`Switched to scene: ${name}`);
  }

  /**
   * Update current scene
   */
  update(deltaTime: number): void {
    if (this._currentScene && this._currentScene.isActive) {
      this._currentScene.update(deltaTime);
    }
  }

  /**
   * Render current scene
   */
  render(ctx: CanvasRenderingContext2D | WebGLRenderingContext): void {
    if (this._currentScene && this._currentScene.isActive) {
      this._currentScene.render(ctx);
    }
  }

  /**
   * Get current scene
   */
  get currentScene(): Scene | null {
    return this._currentScene;
  }

  /**
   * Get scene by name
   */
  getScene(name: string): Scene | undefined {
    return this._scenes.get(name);
  }

  /**
   * Check if transitioning
   */
  get isTransitioning(): boolean {
    return this._isTransitioning;
  }
}

// Export singleton instance
export const sceneManager = SceneManager.getInstance();
