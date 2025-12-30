/**
 * AudioManager
 * Manages sound effects and background music
 */

export interface AudioOptions {
  volume?: number;
  loop?: boolean;
  playbackRate?: number;
  pan?: number; // Stereo panning (-1 to 1)
}

export interface Sound {
  audio: HTMLAudioElement;
  key: string;
  volume: number;
  loop: boolean;
  isPlaying: boolean;
  isPaused: boolean;
}

/**
 * AudioManager
 * Singleton for managing game audio
 */
export class AudioManager {
  private static _instance: AudioManager;

  // Sound libraries
  private sounds: Map<string, HTMLAudioElement> = new Map();
  private music: Map<string, HTMLAudioElement> = new Map();

  // Currently playing sounds
  private playingSounds: Map<string, HTMLAudioElement[]> = new Map();
  private currentMusic: HTMLAudioElement | null = null;
  private currentMusicKey: string | null = null;

  // Volume settings
  private masterVolume: number = 1.0;
  private sfxVolume: number = 1.0;
  private musicVolume: number = 1.0;

  // Mute state
  private isMuted: boolean = false;
  private wasMusicPlaying: boolean = false;

  // Audio context for advanced features
  private audioContext: AudioContext | null = null;
  private gainNode: GainNode | null = null;

  private constructor() {
    // Initialize Web Audio API if available
    if (typeof AudioContext !== 'undefined' || typeof (window as any).webkitAudioContext !== 'undefined') {
      this.audioContext = new (AudioContext || (window as any).webkitAudioContext)();
      this.gainNode = this.audioContext.createGain();
      this.gainNode.connect(this.audioContext.destination);
    }
  }

  static getInstance(): AudioManager {
    if (!AudioManager._instance) {
      AudioManager._instance = new AudioManager();
    }
    return AudioManager._instance;
  }

  /**
   * Add a sound effect
   */
  addSound(key: string, audio: HTMLAudioElement): void {
    this.sounds.set(key, audio);
  }

  /**
   * Add background music
   */
  addMusic(key: string, audio: HTMLAudioElement): void {
    this.music.set(key, audio);
    audio.loop = true; // Music loops by default
  }

  /**
   * Play a sound effect
   */
  playSound(key: string, options: AudioOptions = {}): HTMLAudioElement | null {
    const sound = this.sounds.get(key);
    if (!sound) {
      console.warn(`Sound "${key}" not found`);
      return null;
    }

    // Clone the audio element to allow multiple instances
    const clone = sound.cloneNode(true) as HTMLAudioElement;
    clone.volume = (options.volume ?? 1.0) * this.sfxVolume * this.masterVolume;
    clone.loop = options.loop ?? false;
    clone.playbackRate = options.playbackRate ?? 1.0;

    // Track playing sound
    if (!this.playingSounds.has(key)) {
      this.playingSounds.set(key, []);
    }
    this.playingSounds.get(key)!.push(clone);

    // Remove from tracking when finished
    clone.addEventListener('ended', () => {
      const sounds = this.playingSounds.get(key);
      if (sounds) {
        const index = sounds.indexOf(clone);
        if (index > -1) {
          sounds.splice(index, 1);
        }
      }
    });

    // Play if not muted
    if (!this.isMuted) {
      clone.play().catch((error) => {
        console.error(`Failed to play sound "${key}":`, error);
      });
    }

    return clone;
  }

  /**
   * Stop a specific sound
   */
  stopSound(key: string): void {
    const sounds = this.playingSounds.get(key);
    if (!sounds) return;

    for (const sound of sounds) {
      sound.pause();
      sound.currentTime = 0;
    }

    this.playingSounds.delete(key);
  }

  /**
   * Stop all playing sounds
   */
  stopAllSounds(): void {
    for (const sounds of this.playingSounds.values()) {
      for (const sound of sounds) {
        sound.pause();
        sound.currentTime = 0;
      }
    }
    this.playingSounds.clear();
  }

  /**
   * Play background music
   */
  playMusic(key: string, options: AudioOptions = {}): void {
    const music = this.music.get(key);
    if (!music) {
      console.warn(`Music "${key}" not found`);
      return;
    }

    // Stop current music if different
    if (this.currentMusic && this.currentMusicKey !== key) {
      this.stopMusic();
    }

    this.currentMusic = music;
    this.currentMusicKey = key;
    this.currentMusic.volume = (options.volume ?? 1.0) * this.musicVolume * this.masterVolume;
    this.currentMusic.loop = options.loop ?? true;
    this.currentMusic.playbackRate = options.playbackRate ?? 1.0;

    if (!this.isMuted) {
      this.currentMusic.play().catch((error) => {
        console.error(`Failed to play music "${key}":`, error);
      });
    }
  }

  /**
   * Stop current music
   */
  stopMusic(): void {
    if (this.currentMusic) {
      this.currentMusic.pause();
      this.currentMusic.currentTime = 0;
      this.currentMusic = null;
      this.currentMusicKey = null;
    }
  }

  /**
   * Pause current music
   */
  pauseMusic(): void {
    if (this.currentMusic && !this.currentMusic.paused) {
      this.currentMusic.pause();
    }
  }

  /**
   * Resume current music
   */
  resumeMusic(): void {
    if (this.currentMusic && this.currentMusic.paused && !this.isMuted) {
      this.currentMusic.play().catch((error) => {
        console.error('Failed to resume music:', error);
      });
    }
  }

  /**
   * Fade in music
   */
  fadeInMusic(key: string, duration: number = 1000): void {
    this.playMusic(key, { volume: 0 });

    if (!this.currentMusic) return;

    const targetVolume = this.musicVolume * this.masterVolume;
    const steps = 60; // 60 steps for smooth fade
    const volumeStep = targetVolume / steps;
    const timeStep = duration / steps;

    let currentStep = 0;

    const fadeInterval = setInterval(() => {
      if (!this.currentMusic || currentStep >= steps) {
        clearInterval(fadeInterval);
        if (this.currentMusic) {
          this.currentMusic.volume = targetVolume;
        }
        return;
      }

      currentStep++;
      this.currentMusic.volume = volumeStep * currentStep;
    }, timeStep);
  }

  /**
   * Fade out music
   */
  fadeOutMusic(duration: number = 1000, stopAfter: boolean = true): void {
    if (!this.currentMusic) return;

    const startVolume = this.currentMusic.volume;
    const steps = 60;
    const volumeStep = startVolume / steps;
    const timeStep = duration / steps;

    let currentStep = 0;

    const fadeInterval = setInterval(() => {
      if (!this.currentMusic || currentStep >= steps) {
        clearInterval(fadeInterval);
        if (stopAfter && this.currentMusic) {
          this.stopMusic();
        }
        return;
      }

      currentStep++;
      this.currentMusic.volume = startVolume - volumeStep * currentStep;
    }, timeStep);
  }

  /**
   * Crossfade between music tracks
   */
  crossfadeMusic(newKey: string, duration: number = 1000): void {
    const oldMusic = this.currentMusic;

    // Fade out old music
    if (oldMusic) {
      this.fadeOutMusic(duration, true);
    }

    // Fade in new music after a short delay
    setTimeout(() => {
      this.fadeInMusic(newKey, duration);
    }, 100);
  }

  /**
   * Set master volume (0.0 - 1.0)
   */
  setMasterVolume(volume: number): void {
    this.masterVolume = Math.max(0, Math.min(1, volume));
    this.updateVolumes();
  }

  /**
   * Set SFX volume (0.0 - 1.0)
   */
  setSfxVolume(volume: number): void {
    this.sfxVolume = Math.max(0, Math.min(1, volume));
    this.updateVolumes();
  }

  /**
   * Set music volume (0.0 - 1.0)
   */
  setMusicVolume(volume: number): void {
    this.musicVolume = Math.max(0, Math.min(1, volume));
    this.updateVolumes();
  }

  /**
   * Update all playing audio volumes
   */
  private updateVolumes(): void {
    // Update current music
    if (this.currentMusic) {
      this.currentMusic.volume = this.musicVolume * this.masterVolume;
    }

    // Update playing sounds
    for (const [key, sounds] of this.playingSounds.entries()) {
      for (const sound of sounds) {
        sound.volume = this.sfxVolume * this.masterVolume;
      }
    }
  }

  /**
   * Mute all audio
   */
  mute(): void {
    this.isMuted = true;

    // Pause music
    if (this.currentMusic && !this.currentMusic.paused) {
      this.wasMusicPlaying = true;
      this.currentMusic.pause();
    }

    // Mute all sounds
    for (const sounds of this.playingSounds.values()) {
      for (const sound of sounds) {
        sound.volume = 0;
      }
    }
  }

  /**
   * Unmute all audio
   */
  unmute(): void {
    this.isMuted = false;

    // Resume music if it was playing
    if (this.wasMusicPlaying && this.currentMusic) {
      this.currentMusic.play();
      this.wasMusicPlaying = false;
    }

    // Restore sound volumes
    this.updateVolumes();
  }

  /**
   * Toggle mute
   */
  toggleMute(): void {
    if (this.isMuted) {
      this.unmute();
    } else {
      this.mute();
    }
  }

  /**
   * Get current music key
   */
  getCurrentMusicKey(): string | null {
    return this.currentMusicKey;
  }

  /**
   * Check if music is playing
   */
  isMusicPlaying(): boolean {
    return this.currentMusic !== null && !this.currentMusic.paused;
  }

  /**
   * Check if muted
   */
  getMuted(): boolean {
    return this.isMuted;
  }

  /**
   * Get master volume
   */
  getMasterVolume(): number {
    return this.masterVolume;
  }

  /**
   * Get SFX volume
   */
  getSfxVolume(): number {
    return this.sfxVolume;
  }

  /**
   * Get music volume
   */
  getMusicVolume(): number {
    return this.musicVolume;
  }

  /**
   * Clean up resources
   */
  destroy(): void {
    this.stopAllSounds();
    this.stopMusic();
    this.sounds.clear();
    this.music.clear();

    if (this.audioContext) {
      this.audioContext.close();
    }
  }
}

// Export singleton instance
export const audioManager = AudioManager.getInstance();
