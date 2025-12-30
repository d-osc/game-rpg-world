/**
 * World Module
 * World management, maps, and zones
 */

export { TiledMap, TiledMapLoader } from './TiledMapLoader.ts';
export type {
  TiledLayer,
  TiledObject,
  TiledProperty,
  TiledTileset,
  TiledMapData,
} from './TiledMapLoader.ts';

export { WorldManager } from './WorldManager.ts';
export type {
	Position,
	Size,
	Town,
	Zone,
	Continent,
	WorldData,
	WorldManagerEvents,
} from './WorldManager.ts';

export { NPCManager } from './NPCManager.ts';
export type { NPCData, NPCDialogue, NPCInstance, NPCManagerEvents } from './NPCManager.ts';

export { MonsterSpawner } from './MonsterSpawner.ts';
export type {
	SpawnPoint,
	SpawnedMonster,
	MonsterSpawnerEvents,
} from './MonsterSpawner.ts';

export { ZoneDiscovery } from './ZoneDiscovery.ts';
export type { ZonePlayerInfo, ZoneDiscoveryEvents } from './ZoneDiscovery.ts';
