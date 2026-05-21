/**
 * DataLoader
 * Loads and caches all game data via fetch() at runtime
 */

// ============================================================================
// Type Definitions
// ============================================================================

export interface MonsterStats {
	hp: number;
	mp: number;
	atk: number;
	def: number;
	spd: number;
	luck: number;
}

export interface ItemDrop {
	itemId: string;
	chance: number;
	quantity: { min: number; max: number };
}

export interface MonsterSprite {
	idle: string;
	attack: string;
	hurt: string;
	dead: string;
}

export interface MonsterData {
	id: string;
	name: string;
	description: string;
	level: number;
	stats: MonsterStats;
	element: string;
	skills: string[];
	drops: ItemDrop[];
	exp: number;
	gold: number;
	sprite: MonsterSprite;
	aiPattern: string;
	zone: string;
}

export interface ItemStats {
	hp?: number;
	mp?: number;
	atk?: number;
	def?: number;
	spd?: number;
	luck?: number;
	[key: string]: number | undefined;
}

export interface ItemEffect {
	type: string;
	value: number;
}

export interface ItemData {
	id: string;
	name: string;
	description: string;
	type: string;
	rarity: string;
	weight: number;
	stackable: boolean;
	maxStack: number;
	value: number;
	equipSlot?: string;
	stats?: ItemStats;
	effects?: ItemEffect[];
	consumableEffect?: {
		type: string;
		value: number;
	};
}

export interface JobSkill {
	skillId: string;
	learnLevel: number;
	description: string;
}

export interface PassiveAbility {
	id: string;
	name: string;
	description: string;
	effect: {
		type: string;
		category?: string;
		value: number;
	};
}

export interface JobData {
	id: string;
	name: string;
	description: string;
	icon: string;
	baseStats: MonsterStats;
	statGrowth: MonsterStats;
	skills: JobSkill[];
	passiveAbilities: PassiveAbility[];
	equipmentRestrictions: {
		weapons?: string[];
		armor?: string[];
	};
	requirements: {
		baseJob: boolean;
		level: number;
		certificateId: string;
	};
}

export interface SkillEffect {
	type: string;
	value: number;
}

export interface SkillData {
	id: string;
	name: string;
	description: string;
	type: string;
	element: string;
	mpCost: number;
	power: number;
	accuracy: number;
	target: string;
	effects: SkillEffect[];
	animation: string;
	cooldown?: number; // seconds (default 3 if missing)
}

export interface RecipeMaterial {
	item_id: string;
	quantity: number;
}

export interface RecipeData {
	id: string;
	name: string;
	category: string;
	result_item_id: string;
	result_quantity: number;
	required_job: string | null;
	required_job_level: number;
	crafting_time: number;
	materials: RecipeMaterial[];
	currency_cost: number;
	experience_gained: number;
	success_rate: number;
	skill_required: string | null;
}

export interface DialogueOption {
	text: string;
	next?: string | null;
	action?: string;
}

export interface Dialogue {
	id: string;
	text: string;
	options: DialogueOption[];
}

export interface NPCShop {
	items: string[];
	buyPriceMultiplier: number;
	sellPriceMultiplier: number;
}

export interface NPCData {
	id: string;
	name: string;
	type: 'villager' | 'merchant' | 'trainer' | 'quest_giver';
	position: { x: number; y: number };
	sprite: string;
	dialogues: Dialogue[];
	shop?: NPCShop;
	jobTrainer?: {
		jobId: string;
		certificateItemId: string;
	};
}

export interface TownData {
	id: string;
	name: string;
	description: string;
	position: { x: number; y: number };
	services: string[];
	npcs: string[];
}

export interface ZoneData {
	id: string;
	name: string;
	description: string;
	type: string;
	level_range: number[];
	position: { x: number; y: number };
	size: { width: number; height: number };
	map_file: string;
	monsters: string[];
	spawn_points: number;
	respawn_time: number;
	max_capacity: number;
}

export interface ContinentData {
	id: string;
	name: string;
	description: string;
	level_range: number[];
	climate: string;
	towns: TownData[];
	zones: ZoneData[];
}

// ============================================================================
// GameData Interface
// ============================================================================

export interface GameData {
	monsters: Map<string, MonsterData>;
	items: Map<string, ItemData>;
	jobs: Map<string, JobData>;
	skills: Map<string, SkillData>;
	recipes: Map<string, RecipeData>;
	npcs: Map<string, NPCData>;
	continents: Map<string, ContinentData>;
}

// Base URL for data files served by the dev server
const DATA_BASE = '/node_modules/@rpg/data';

// ============================================================================
// DataLoader Class
// ============================================================================

export class DataLoader {
	private static instance: DataLoader;
	private data: GameData | null = null;
	private loading = false;
	private loadPromise: Promise<GameData> | null = null;

	private constructor() {}

	static getInstance(): DataLoader {
		if (!DataLoader.instance) {
			DataLoader.instance = new DataLoader();
		}
		return DataLoader.instance;
	}

	private async fetchJSON<T>(path: string): Promise<T> {
		const response = await fetch(`${DATA_BASE}/${path}`);
		if (!response.ok) throw new Error(`Failed to fetch ${path}: ${response.status}`);
		return response.json() as Promise<T>;
	}

	async loadAll(): Promise<GameData> {
		if (this.data) return this.data;
		if (this.loading && this.loadPromise) return this.loadPromise;

		this.loading = true;
		this.loadPromise = this._performLoad();

		try {
			this.data = await this.loadPromise;
			return this.data;
		} finally {
			this.loading = false;
		}
	}

	private async _performLoad(): Promise<GameData> {
		console.log('[DataLoader] Loading game data...');

		const monsterFiles = [
			'slime', 'goblin', 'wolf', 'skeleton', 'orc',
			'crystal_golem', 'sand_serpent', 'fire_elemental',
			'ice_wraith', 'dark_mage', 'dragon_whelp', 'giant_spider',
		];

		const itemFiles = ['weapons', 'armor', 'consumables', 'crafting_materials', 'materials', 'job_certificates'];
		const jobFiles = ['warrior', 'mage', 'healer', 'thief', 'blacksmith', 'merchant'];
		const skillFiles = ['basic_skills', 'magic_skills', 'support_skills'];

		const [monsterResults, itemResults, jobResults, skillResults, recipesRaw, npcsRaw, continentsRaw] =
			await Promise.all([
				Promise.all(monsterFiles.map(f => this.fetchJSON<MonsterData>(`monsters/${f}.json`))),
				Promise.all(itemFiles.map(f => this.fetchJSON<{ items: ItemData[] }>(`items/${f}.json`))),
				Promise.all(jobFiles.map(f => this.fetchJSON<JobData>(`jobs/${f}.json`))),
				Promise.all(skillFiles.map(f => this.fetchJSON<{ skills: SkillData[] }>(`skills/${f}.json`))),
				this.fetchJSON<RecipeData[]>('crafting/recipes.json'),
				this.fetchJSON<{ npcs: NPCData[] }>('npcs/town_npcs.json'),
				this.fetchJSON<{ continents: ContinentData[] }>('world/continents.json'),
			]);

		const monsters = new Map<string, MonsterData>();
		for (const m of monsterResults) monsters.set(m.id, m);

		const items = new Map<string, ItemData>();
		for (const file of itemResults) {
			const arr = Array.isArray(file) ? file : (file as { items: ItemData[] }).items;
			for (const item of arr) items.set(item.id, item);
		}

		const jobs = new Map<string, JobData>();
		for (const j of jobResults) jobs.set(j.id, j);

		const skills = new Map<string, SkillData>();
		for (const file of skillResults) for (const s of file.skills) skills.set(s.id, s);

		const recipes = new Map<string, RecipeData>();
		for (const r of recipesRaw) recipes.set(r.id, r);

		const npcs = new Map<string, NPCData>();
		for (const n of npcsRaw.npcs) npcs.set(n.id, n);

		const continents = new Map<string, ContinentData>();
		for (const c of continentsRaw.continents) continents.set(c.id, c);

		console.log('[DataLoader] All data loaded!');
		console.log(`  Monsters: ${monsters.size}, Items: ${items.size}, Jobs: ${jobs.size}`);
		console.log(`  Skills: ${skills.size}, Recipes: ${recipes.size}, NPCs: ${npcs.size}, Continents: ${continents.size}`);

		return { monsters, items, jobs, skills, recipes, npcs, continents };
	}

	getData(): GameData | null { return this.data; }

	getDataOrThrow(): GameData {
		if (!this.data) throw new Error('Data not loaded yet. Call loadAll() first.');
		return this.data;
	}

	getMonster(id: string): MonsterData | undefined { return this.data?.monsters.get(id); }
	getItem(id: string): ItemData | undefined { return this.data?.items.get(id); }
	getJob(id: string): JobData | undefined { return this.data?.jobs.get(id); }
	getSkill(id: string): SkillData | undefined { return this.data?.skills.get(id); }
	getRecipe(id: string): RecipeData | undefined { return this.data?.recipes.get(id); }
	getNPC(id: string): NPCData | undefined { return this.data?.npcs.get(id); }
	getContinent(id: string): ContinentData | undefined { return this.data?.continents.get(id); }

	getAllMonsters(): MonsterData[] { return this.data ? Array.from(this.data.monsters.values()) : []; }
	getAllItems(): ItemData[] { return this.data ? Array.from(this.data.items.values()) : []; }
	getAllJobs(): JobData[] { return this.data ? Array.from(this.data.jobs.values()) : []; }
	getAllSkills(): SkillData[] { return this.data ? Array.from(this.data.skills.values()) : []; }
	getAllRecipes(): RecipeData[] { return this.data ? Array.from(this.data.recipes.values()) : []; }
	getAllNPCs(): NPCData[] { return this.data ? Array.from(this.data.npcs.values()) : []; }
	getAllContinents(): ContinentData[] { return this.data ? Array.from(this.data.continents.values()) : []; }

	getMonstersByZone(zone: string): MonsterData[] { return this.getAllMonsters().filter(m => m.zone === zone); }
	getItemsByType(type: string): ItemData[] { return this.getAllItems().filter(i => i.type === type); }
	getRecipesByCategory(cat: string): RecipeData[] { return this.getAllRecipes().filter(r => r.category === cat); }

	getSkillsForJob(jobId: string): SkillData[] {
		const job = this.getJob(jobId);
		if (!job) return [];
		return job.skills.map(s => this.getSkill(s.skillId)).filter((s): s is SkillData => s !== undefined);
	}
}

export const dataLoader = DataLoader.getInstance();
