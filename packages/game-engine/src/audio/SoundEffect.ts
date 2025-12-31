/**
 * Sound Effect Manager
 * Manages sound effect playback with pooling and spatial audio
 */

export interface SoundOptions {
	volume?: number; // 0-1
	loop?: boolean;
	playbackRate?: number; // 0.5-2.0
	pan?: number; // -1 to 1 (left to right)
}

export class SoundEffect {
	private sounds: Map<string, AudioBuffer> = new Map();
	private audioContext: AudioContext;
	private masterGain: GainNode;
	private activeSounds: Set<AudioBufferSourceNode> = new Set();

	constructor() {
		this.audioContext = new AudioContext();
		this.masterGain = this.audioContext.createGain();
		this.masterGain.connect(this.audioContext.destination);
	}

	/**
	 * Load sound effect
	 */
	async loadSound(id: string, url: string): Promise<void> {
		try {
			const response = await fetch(url);
			const arrayBuffer = await response.arrayBuffer();
			const audioBuffer = await this.audioContext.decodeAudioData(arrayBuffer);
			this.sounds.set(id, audioBuffer);
			console.log(`[SoundEffect] Loaded: ${id}`);
		} catch (error) {
			console.error(`[SoundEffect] Failed to load ${id}:`, error);
		}
	}

	/**
	 * Play sound effect
	 */
	play(id: string, options: SoundOptions = {}): AudioBufferSourceNode | null {
		const buffer = this.sounds.get(id);
		if (!buffer) {
			console.warn(`[SoundEffect] Sound not found: ${id}`);
			return null;
		}

		// Create source
		const source = this.audioContext.createBufferSource();
		source.buffer = buffer;
		source.loop = options.loop || false;
		source.playbackRate.value = options.playbackRate || 1.0;

		// Create gain node for volume
		const gainNode = this.audioContext.createGain();
		gainNode.gain.value = (options.volume ?? 1.0) * this.masterGain.gain.value;

		// Create stereo panner for spatial audio
		const pannerNode = this.audioContext.createStereoPanner();
		pannerNode.pan.value = options.pan || 0;

		// Connect nodes
		source.connect(gainNode);
		gainNode.connect(pannerNode);
		pannerNode.connect(this.audioContext.destination);

		// Track active sound
		this.activeSounds.add(source);

		// Cleanup when finished
		source.onended = () => {
			this.activeSounds.delete(source);
			source.disconnect();
			gainNode.disconnect();
			pannerNode.disconnect();
		};

		// Play
		source.start();

		return source;
	}

	/**
	 * Stop specific sound
	 */
	stop(source: AudioBufferSourceNode): void {
		if (this.activeSounds.has(source)) {
			source.stop();
			this.activeSounds.delete(source);
		}
	}

	/**
	 * Stop all sounds
	 */
	stopAll(): void {
		for (const source of this.activeSounds) {
			source.stop();
		}
		this.activeSounds.clear();
	}

	/**
	 * Set master volume
	 */
	setVolume(volume: number): void {
		this.masterGain.gain.value = Math.max(0, Math.min(1, volume));
	}

	/**
	 * Get master volume
	 */
	getVolume(): number {
		return this.masterGain.gain.value;
	}

	/**
	 * Fade volume
	 */
	fadeVolume(targetVolume: number, duration: number): void {
		const currentTime = this.audioContext.currentTime;
		this.masterGain.gain.setValueAtTime(this.masterGain.gain.value, currentTime);
		this.masterGain.gain.linearRampToValueAtTime(targetVolume, currentTime + duration);
	}

	/**
	 * Resume audio context (needed for browser autoplay policies)
	 */
	async resume(): Promise<void> {
		if (this.audioContext.state === 'suspended') {
			await this.audioContext.resume();
			console.log('[SoundEffect] Audio context resumed');
		}
	}

	/**
	 * Check if sound is loaded
	 */
	hasSound(id: string): boolean {
		return this.sounds.has(id);
	}

	/**
	 * Get number of active sounds
	 */
	getActiveSoundCount(): number {
		return this.activeSounds.size;
	}

	/**
	 * Cleanup
	 */
	destroy(): void {
		this.stopAll();
		this.audioContext.close();
	}
}

// Preset sound effect library (placeholder paths)
export const SoundLibrary = {
	// UI Sounds
	UI_CLICK: 'assets/sounds/ui_click.mp3',
	UI_HOVER: 'assets/sounds/ui_hover.mp3',
	UI_ERROR: 'assets/sounds/ui_error.mp3',
	UI_SUCCESS: 'assets/sounds/ui_success.mp3',

	// Combat Sounds
	ATTACK_SLASH: 'assets/sounds/attack_slash.mp3',
	ATTACK_HIT: 'assets/sounds/attack_hit.mp3',
	ATTACK_MISS: 'assets/sounds/attack_miss.mp3',
	SKILL_CAST: 'assets/sounds/skill_cast.mp3',
	SKILL_FIRE: 'assets/sounds/skill_fire.mp3',
	SKILL_ICE: 'assets/sounds/skill_ice.mp3',
	SKILL_HEAL: 'assets/sounds/skill_heal.mp3',
	DAMAGE_TAKEN: 'assets/sounds/damage_taken.mp3',
	CRITICAL_HIT: 'assets/sounds/critical_hit.mp3',

	// Item Sounds
	ITEM_PICKUP: 'assets/sounds/item_pickup.mp3',
	ITEM_DROP: 'assets/sounds/item_drop.mp3',
	ITEM_EQUIP: 'assets/sounds/item_equip.mp3',
	ITEM_USE: 'assets/sounds/item_use.mp3',
	GOLD_PICKUP: 'assets/sounds/gold_pickup.mp3',

	// Character Sounds
	LEVEL_UP: 'assets/sounds/level_up.mp3',
	EXP_GAIN: 'assets/sounds/exp_gain.mp3',
	FOOTSTEP: 'assets/sounds/footstep.mp3',

	// World Sounds
	DOOR_OPEN: 'assets/sounds/door_open.mp3',
	DOOR_CLOSE: 'assets/sounds/door_close.mp3',
	CHEST_OPEN: 'assets/sounds/chest_open.mp3',

	// Notification Sounds
	QUEST_COMPLETE: 'assets/sounds/quest_complete.mp3',
	ACHIEVEMENT: 'assets/sounds/achievement.mp3',
	MESSAGE_RECEIVED: 'assets/sounds/message_received.mp3',
};

/**
 * Music Manager
 * Manages background music with crossfading
 */
export class MusicManager {
	private audioContext: AudioContext;
	private currentMusic: HTMLAudioElement | null = null;
	private nextMusic: HTMLAudioElement | null = null;
	private volume: number = 0.5;
	private crossfadeDuration: number = 2; // seconds

	constructor() {
		this.audioContext = new AudioContext();
	}

	/**
	 * Play music track
	 */
	async play(url: string, loop: boolean = true): Promise<void> {
		// If same track is playing, do nothing
		if (this.currentMusic && this.currentMusic.src.endsWith(url)) {
			return;
		}

		const audio = new Audio(url);
		audio.loop = loop;
		audio.volume = 0;

		try {
			await audio.play();
		} catch (error) {
			console.error('[MusicManager] Failed to play:', error);
			return;
		}

		// Crossfade from current to new
		if (this.currentMusic) {
			this.crossfade(audio);
		} else {
			// Fade in new music
			this.fadeIn(audio);
			this.currentMusic = audio;
		}
	}

	/**
	 * Stop current music
	 */
	stop(): void {
		if (this.currentMusic) {
			this.fadeOut(this.currentMusic);
			this.currentMusic = null;
		}
	}

	/**
	 * Pause current music
	 */
	pause(): void {
		if (this.currentMusic) {
			this.currentMusic.pause();
		}
	}

	/**
	 * Resume current music
	 */
	resume(): void {
		if (this.currentMusic) {
			this.currentMusic.play();
		}
	}

	/**
	 * Set music volume
	 */
	setVolume(volume: number): void {
		this.volume = Math.max(0, Math.min(1, volume));
		if (this.currentMusic) {
			this.currentMusic.volume = this.volume;
		}
	}

	/**
	 * Get music volume
	 */
	getVolume(): number {
		return this.volume;
	}

	/**
	 * Crossfade between tracks
	 */
	private crossfade(newMusic: HTMLAudioElement): void {
		const oldMusic = this.currentMusic!;
		this.currentMusic = newMusic;

		const steps = 60;
		const stepDuration = (this.crossfadeDuration * 1000) / steps;
		let currentStep = 0;

		const interval = setInterval(() => {
			currentStep++;
			const progress = currentStep / steps;

			oldMusic.volume = this.volume * (1 - progress);
			newMusic.volume = this.volume * progress;

			if (currentStep >= steps) {
				clearInterval(interval);
				oldMusic.pause();
				oldMusic.currentTime = 0;
			}
		}, stepDuration);
	}

	/**
	 * Fade in music
	 */
	private fadeIn(music: HTMLAudioElement): void {
		const steps = 30;
		const stepDuration = (this.crossfadeDuration * 1000) / steps;
		let currentStep = 0;

		const interval = setInterval(() => {
			currentStep++;
			const progress = currentStep / steps;
			music.volume = this.volume * progress;

			if (currentStep >= steps) {
				clearInterval(interval);
			}
		}, stepDuration);
	}

	/**
	 * Fade out music
	 */
	private fadeOut(music: HTMLAudioElement): void {
		const steps = 30;
		const stepDuration = (this.crossfadeDuration * 1000) / steps;
		let currentStep = 0;

		const interval = setInterval(() => {
			currentStep++;
			const progress = 1 - currentStep / steps;
			music.volume = this.volume * progress;

			if (currentStep >= steps) {
				clearInterval(interval);
				music.pause();
				music.currentTime = 0;
			}
		}, stepDuration);
	}

	/**
	 * Cleanup
	 */
	destroy(): void {
		if (this.currentMusic) {
			this.currentMusic.pause();
			this.currentMusic = null;
		}
		if (this.nextMusic) {
			this.nextMusic.pause();
			this.nextMusic = null;
		}
	}
}

// Music library (placeholder paths)
export const MusicLibrary = {
	MAIN_MENU: 'assets/music/main_menu.mp3',
	TOWN: 'assets/music/town.mp3',
	FIELD: 'assets/music/field.mp3',
	DUNGEON: 'assets/music/dungeon.mp3',
	BATTLE: 'assets/music/battle.mp3',
	BOSS_BATTLE: 'assets/music/boss_battle.mp3',
	VICTORY: 'assets/music/victory.mp3',
	GAME_OVER: 'assets/music/game_over.mp3',
};
