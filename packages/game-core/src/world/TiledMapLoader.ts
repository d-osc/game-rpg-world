/**
 * Tiled Map Loader
 * Loads and renders maps from Tiled JSON format
 */

import { Rectangle, Vector2 } from '@rpg/game-engine';
import { AABB } from '@rpg/game-engine';

export interface TiledLayer {
  name: string;
  type: string;
  data?: number[];
  objects?: TiledObject[];
  width: number;
  height: number;
  visible: boolean;
  opacity: number;
  properties?: TiledProperty[];
}

export interface TiledObject {
  id: number;
  name: string;
  type: string;
  x: number;
  y: number;
  width: number;
  height: number;
  properties?: TiledProperty[];
}

export interface TiledProperty {
  name: string;
  type: string;
  value: any;
}

export interface TiledTileset {
  firstgid: number;
  name: string;
  tilewidth: number;
  tileheight: number;
  tilecount: number;
  columns: number;
  image: string;
  imagewidth: number;
  imageheight: number;
}

export interface TiledMapData {
  width: number;
  height: number;
  tilewidth: number;
  tileheight: number;
  layers: TiledLayer[];
  tilesets: TiledTileset[];
  orientation: string;
  renderorder: string;
}

export class TiledMap {
  public data: TiledMapData;
  public tilesets: Map<number, { image: HTMLImageElement; tileset: TiledTileset }> = new Map();
  public collisionLayer: number[] | null = null;
  public spawnPoint: Vector2 = new Vector2(100, 100);

  constructor(data: TiledMapData) {
    this.data = data;
    this.parseCollisionLayer();
    this.parseSpawnPoint();
  }

  /**
   * Get map width in pixels
   */
  getWidth(): number {
    return this.data.width * this.data.tilewidth;
  }

  /**
   * Get map height in pixels
   */
  getHeight(): number {
    return this.data.height * this.data.tileheight;
  }

  /**
   * Get map bounds
   */
  getBounds(): Rectangle {
    return new Rectangle(0, 0, this.getWidth(), this.getHeight());
  }

  /**
   * Parse collision layer
   */
  private parseCollisionLayer(): void {
    const collisionLayer = this.data.layers.find(
      (layer) => layer.name.toLowerCase() === 'collision' || layer.type === 'collision'
    );

    if (collisionLayer && collisionLayer.data) {
      this.collisionLayer = collisionLayer.data;
    }
  }

  /**
   * Parse spawn point from object layer
   */
  private parseSpawnPoint(): void {
    const objectLayer = this.data.layers.find((layer) => layer.type === 'objectgroup');

    if (objectLayer && objectLayer.objects) {
      const spawnObject = objectLayer.objects.find(
        (obj) => obj.name.toLowerCase() === 'spawn' || obj.type.toLowerCase() === 'spawn'
      );

      if (spawnObject) {
        this.spawnPoint = new Vector2(spawnObject.x, spawnObject.y);
      }
    }
  }

  /**
   * Check if tile has collision
   */
  hasTileCollision(tileX: number, tileY: number): boolean {
    if (!this.collisionLayer) return false;

    const index = tileY * this.data.width + tileX;
    if (index < 0 || index >= this.collisionLayer.length) return false;

    return this.collisionLayer[index]! > 0;
  }

  /**
   * Check if position has collision
   */
  hasCollision(x: number, y: number): boolean {
    const tileX = Math.floor(x / this.data.tilewidth);
    const tileY = Math.floor(y / this.data.tileheight);

    return this.hasTileCollision(tileX, tileY);
  }

  /**
   * Get collision tiles as AABBs
   */
  getCollisionTiles(): AABB[] {
    const tiles: AABB[] = [];

    if (!this.collisionLayer) return tiles;

    for (let y = 0; y < this.data.height; y++) {
      for (let x = 0; x < this.data.width; x++) {
        if (this.hasTileCollision(x, y)) {
          const centerX = x * this.data.tilewidth + this.data.tilewidth / 2;
          const centerY = y * this.data.tileheight + this.data.tileheight / 2;
          const halfWidth = this.data.tilewidth / 2;
          const halfHeight = this.data.tileheight / 2;

          tiles.push(new AABB(new Vector2(centerX, centerY), new Vector2(halfWidth, halfHeight)));
        }
      }
    }

    return tiles;
  }

  /**
   * Render map layer
   */
  renderLayer(
    ctx: CanvasRenderingContext2D,
    layerName: string,
    cameraX: number = 0,
    cameraY: number = 0
  ): void {
    const layer = this.data.layers.find((l) => l.name === layerName && l.type === 'tilelayer');

    if (!layer || !layer.data || !layer.visible) return;

    // Calculate visible tile range
    const startX = Math.max(0, Math.floor(cameraX / this.data.tilewidth));
    const startY = Math.max(0, Math.floor(cameraY / this.data.tileheight));
    const endX = Math.min(this.data.width, startX + Math.ceil(ctx.canvas.width / this.data.tilewidth) + 1);
    const endY = Math.min(this.data.height, startY + Math.ceil(ctx.canvas.height / this.data.tileheight) + 1);

    // Render tiles
    for (let y = startY; y < endY; y++) {
      for (let x = startX; x < endX; x++) {
        const index = y * this.data.width + x;
        const gid = layer.data[index];

        if (!gid || gid === 0) continue;

        this.renderTile(ctx, gid, x, y);
      }
    }
  }

  /**
   * Render a single tile
   */
  private renderTile(ctx: CanvasRenderingContext2D, gid: number, tileX: number, tileY: number): void {
    // Find tileset for this tile
    let tilesetData = null;
    for (const tileset of this.data.tilesets) {
      if (gid >= tileset.firstgid && gid < tileset.firstgid + tileset.tilecount) {
        tilesetData = this.tilesets.get(tileset.firstgid);
        break;
      }
    }

    if (!tilesetData) return;

    const { image, tileset } = tilesetData;
    const localId = gid - tileset.firstgid;

    // Calculate source position in tileset
    const tilesPerRow = tileset.columns;
    const srcX = (localId % tilesPerRow) * tileset.tilewidth;
    const srcY = Math.floor(localId / tilesPerRow) * tileset.tileheight;

    // Calculate destination position
    const destX = tileX * this.data.tilewidth;
    const destY = tileY * this.data.tileheight;

    // Draw tile
    ctx.drawImage(
      image,
      srcX,
      srcY,
      tileset.tilewidth,
      tileset.tileheight,
      destX,
      destY,
      this.data.tilewidth,
      this.data.tileheight
    );
  }
}

/**
 * Tiled Map Loader
 */
export class TiledMapLoader {
  /**
   * Load map from JSON data
   */
  static async loadFromData(mapData: TiledMapData): Promise<TiledMap> {
    const map = new TiledMap(mapData);

    // Load tileset images
    for (const tileset of mapData.tilesets) {
      const image = await this.loadImage(tileset.image);
      map.tilesets.set(tileset.firstgid, { image, tileset });
    }

    return map;
  }

  /**
   * Load map from URL
   */
  static async loadFromURL(url: string): Promise<TiledMap> {
    const response = await fetch(url);
    const mapData: TiledMapData = await response.json();

    return this.loadFromData(mapData);
  }

  /**
   * Load image helper
   */
  private static loadImage(src: string): Promise<HTMLImageElement> {
    return new Promise((resolve, reject) => {
      const img = new Image();
      img.onload = () => resolve(img);
      img.onerror = () => reject(new Error(`Failed to load image: ${src}`));
      img.src = src;
    });
  }

  /**
   * Create a simple test map (for demo purposes)
   */
  static createTestMap(): TiledMap {
    const mapData: TiledMapData = {
      width: 20,
      height: 15,
      tilewidth: 32,
      tileheight: 32,
      orientation: 'orthogonal',
      renderorder: 'right-down',
      layers: [
        {
          name: 'ground',
          type: 'tilelayer',
          width: 20,
          height: 15,
          visible: true,
          opacity: 1,
          data: new Array(20 * 15).fill(1), // All grass tiles
        },
      ],
      tilesets: [],
    };

    return new TiledMap(mapData);
  }
}
