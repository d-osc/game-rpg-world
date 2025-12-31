/**
 * World Module
 * World management, maps, and zones
 */

export { TiledMap, TiledMapLoader } from './TiledMapLoader';
export type {
  TiledLayer,
  TiledObject,
  TiledProperty,
  TiledTileset,
  TiledMapData,
} from './TiledMapLoader';

export { WorldManager } from './WorldManager';
export type {
	Position,
	Size,
	Town,
	Zone,
	Continent,
	WorldData,
	WorldManagerEvents,
} from './WorldManager';

export { NPCManager } from './NPCManager';
export type { NPCData, NPCDialogue, NPCInstance, NPCManagerEvents } from './NPCManager';

export { MonsterSpawner } from './MonsterSpawner';
export type {
	SpawnPoint,
	SpawnedMonster,
	MonsterSpawnerEvents,
} from './MonsterSpawner';

export { ZoneDiscovery } from './ZoneDiscovery';
export type { ZonePlayerInfo, ZoneDiscoveryEvents } from './ZoneDiscovery';
