/**
 * AssetLoader
 * Handles loading and caching of game assets (images, audio, JSON)
 */

export type AssetType = 'image' | 'audio' | 'json' | 'font';

export interface LoadProgress {
  loaded: number;
  total: number;
  percentage: number;
  currentAsset: string;
}

export interface AssetManifest {
  images?: Record<string, string>;
  audio?: Record<string, string>;
  json?: Record<string, string>;
  fonts?: Record<string, string>;
}

export class AssetLoader {
  private static _instance: AssetLoader;

  // Asset caches
  private images: Map<string, HTMLImageElement> = new Map();
  private audio: Map<string, HTMLAudioElement> = new Map();
  private json: Map<string, unknown> = new Map();
  private fonts: Map<string, FontFace> = new Map();

  // Loading state
  private loadingPromises: Map<string, Promise<unknown>> = new Map();
  private totalAssets: number = 0;
  private loadedAssets: number = 0;
  private currentAsset: string = '';

  // Progress callback
  private onProgressCallback: ((progress: LoadProgress) => void) | null = null;

  private constructor() {}

  static getInstance(): AssetLoader {
    if (!AssetLoader._instance) {
      AssetLoader._instance = new AssetLoader();
    }
    return AssetLoader._instance;
  }

  /**
   * Set progress callback
   */
  onProgress(callback: (progress: LoadProgress) => void): void {
    this.onProgressCallback = callback;
  }

  /**
   * Get current loading progress
   */
  getProgress(): LoadProgress {
    return {
      loaded: this.loadedAssets,
      total: this.totalAssets,
      percentage: this.totalAssets > 0 ? (this.loadedAssets / this.totalAssets) * 100 : 0,
      currentAsset: this.currentAsset,
    };
  }

  /**
   * Load assets from manifest
   */
  async loadManifest(manifest: AssetManifest): Promise<void> {
    const promises: Promise<unknown>[] = [];

    // Count total assets
    this.totalAssets =
      (manifest.images ? Object.keys(manifest.images).length : 0) +
      (manifest.audio ? Object.keys(manifest.audio).length : 0) +
      (manifest.json ? Object.keys(manifest.json).length : 0) +
      (manifest.fonts ? Object.keys(manifest.fonts).length : 0);

    this.loadedAssets = 0;

    // Load images
    if (manifest.images) {
      for (const [key, url] of Object.entries(manifest.images)) {
        promises.push(this.loadImage(key, url));
      }
    }

    // Load audio
    if (manifest.audio) {
      for (const [key, url] of Object.entries(manifest.audio)) {
        promises.push(this.loadAudio(key, url));
      }
    }

    // Load JSON
    if (manifest.json) {
      for (const [key, url] of Object.entries(manifest.json)) {
        promises.push(this.loadJSON(key, url));
      }
    }

    // Load fonts
    if (manifest.fonts) {
      for (const [key, url] of Object.entries(manifest.fonts)) {
        promises.push(this.loadFont(key, url));
      }
    }

    await Promise.all(promises);
  }

  /**
   * Load an image
   */
  async loadImage(key: string, url: string): Promise<HTMLImageElement> {
    // Return cached if already loaded
    if (this.images.has(key)) {
      return this.images.get(key)!;
    }

    // Return existing promise if currently loading
    if (this.loadingPromises.has(key)) {
      return this.loadingPromises.get(key) as Promise<HTMLImageElement>;
    }

    this.currentAsset = key;

    const promise = new Promise<HTMLImageElement>((resolve, reject) => {
      const img = new Image();

      img.onload = () => {
        this.images.set(key, img);
        this.loadingPromises.delete(key);
        this.loadedAssets++;
        this.notifyProgress();
        resolve(img);
      };

      img.onerror = () => {
        this.loadingPromises.delete(key);
        reject(new Error(`Failed to load image: ${url}`));
      };

      img.src = url;
    });

    this.loadingPromises.set(key, promise);
    return promise;
  }

  /**
   * Load audio
   */
  async loadAudio(key: string, url: string): Promise<HTMLAudioElement> {
    // Return cached if already loaded
    if (this.audio.has(key)) {
      return this.audio.get(key)!;
    }

    // Return existing promise if currently loading
    if (this.loadingPromises.has(key)) {
      return this.loadingPromises.get(key) as Promise<HTMLAudioElement>;
    }

    this.currentAsset = key;

    const promise = new Promise<HTMLAudioElement>((resolve, reject) => {
      const audio = new Audio();

      audio.addEventListener('canplaythrough', () => {
        this.audio.set(key, audio);
        this.loadingPromises.delete(key);
        this.loadedAssets++;
        this.notifyProgress();
        resolve(audio);
      });

      audio.addEventListener('error', () => {
        this.loadingPromises.delete(key);
        reject(new Error(`Failed to load audio: ${url}`));
      });

      audio.src = url;
      audio.load();
    });

    this.loadingPromises.set(key, promise);
    return promise;
  }

  /**
   * Load JSON data
   */
  async loadJSON<T = unknown>(key: string, url: string): Promise<T> {
    // Return cached if already loaded
    if (this.json.has(key)) {
      return this.json.get(key) as T;
    }

    // Return existing promise if currently loading
    if (this.loadingPromises.has(key)) {
      return this.loadingPromises.get(key) as Promise<T>;
    }

    this.currentAsset = key;

    const promise = fetch(url)
      .then((response) => {
        if (!response.ok) {
          throw new Error(`Failed to load JSON: ${url}`);
        }
        return response.json();
      })
      .then((data) => {
        this.json.set(key, data);
        this.loadingPromises.delete(key);
        this.loadedAssets++;
        this.notifyProgress();
        return data as T;
      })
      .catch((error) => {
        this.loadingPromises.delete(key);
        throw error;
      });

    this.loadingPromises.set(key, promise);
    return promise;
  }

  /**
   * Load font
   */
  async loadFont(key: string, url: string, family?: string): Promise<FontFace> {
    // Return cached if already loaded
    if (this.fonts.has(key)) {
      return this.fonts.get(key)!;
    }

    // Return existing promise if currently loading
    if (this.loadingPromises.has(key)) {
      return this.loadingPromises.get(key) as Promise<FontFace>;
    }

    this.currentAsset = key;

    const fontFamily = family || key;
    const promise = new FontFace(fontFamily, `url(${url})`)
      .load()
      .then((fontFace) => {
        document.fonts.add(fontFace);
        this.fonts.set(key, fontFace);
        this.loadingPromises.delete(key);
        this.loadedAssets++;
        this.notifyProgress();
        return fontFace;
      })
      .catch((error) => {
        this.loadingPromises.delete(key);
        throw new Error(`Failed to load font: ${url} - ${error.message}`);
      });

    this.loadingPromises.set(key, promise);
    return promise;
  }

  /**
   * Get loaded image
   */
  getImage(key: string): HTMLImageElement | null {
    return this.images.get(key) || null;
  }

  /**
   * Get loaded audio
   */
  getAudio(key: string): HTMLAudioElement | null {
    return this.audio.get(key) || null;
  }

  /**
   * Get loaded JSON
   */
  getJSON<T = unknown>(key: string): T | null {
    return (this.json.get(key) as T) || null;
  }

  /**
   * Get loaded font
   */
  getFont(key: string): FontFace | null {
    return this.fonts.get(key) || null;
  }

  /**
   * Check if asset is loaded
   */
  has(key: string): boolean {
    return (
      this.images.has(key) || this.audio.has(key) || this.json.has(key) || this.fonts.has(key)
    );
  }

  /**
   * Check if asset is currently loading
   */
  isLoading(key: string): boolean {
    return this.loadingPromises.has(key);
  }

  /**
   * Unload an asset
   */
  unload(key: string): void {
    this.images.delete(key);
    this.audio.delete(key);
    this.json.delete(key);
    this.fonts.delete(key);
  }

  /**
   * Unload all assets
   */
  unloadAll(): void {
    this.images.clear();
    this.audio.clear();
    this.json.clear();
    this.fonts.clear();
    this.loadingPromises.clear();
    this.totalAssets = 0;
    this.loadedAssets = 0;
  }

  /**
   * Get memory usage estimate (in bytes)
   */
  getMemoryUsage(): number {
    let total = 0;

    // Estimate image memory (width * height * 4 bytes per pixel)
    for (const img of this.images.values()) {
      total += img.width * img.height * 4;
    }

    return total;
  }

  /**
   * Notify progress callback
   */
  private notifyProgress(): void {
    if (this.onProgressCallback) {
      this.onProgressCallback(this.getProgress());
    }
  }

  /**
   * Preload multiple images
   */
  async preloadImages(images: Record<string, string>): Promise<void> {
    const promises = Object.entries(images).map(([key, url]) => this.loadImage(key, url));
    await Promise.all(promises);
  }

  /**
   * Preload multiple audio files
   */
  async preloadAudio(audio: Record<string, string>): Promise<void> {
    const promises = Object.entries(audio).map(([key, url]) => this.loadAudio(key, url));
    await Promise.all(promises);
  }

  /**
   * Preload multiple JSON files
   */
  async preloadJSON(json: Record<string, string>): Promise<void> {
    const promises = Object.entries(json).map(([key, url]) => this.loadJSON(key, url));
    await Promise.all(promises);
  }
}

// Export singleton instance
export const assetLoader = AssetLoader.getInstance();
