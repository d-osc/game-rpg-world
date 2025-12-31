/**
 * Particle System
 * Creates and manages visual particle effects
 */

import { Vector2 } from '../math/Vector2';

export interface Particle {
	position: Vector2;
	velocity: Vector2;
	acceleration: Vector2;
	life: number;
	maxLife: number;
	size: number;
	color: string;
	alpha: number;
	rotation: number;
	rotationSpeed: number;
}

export interface ParticleEmitterConfig {
	position: Vector2;
	rate: number; // Particles per second
	lifetime: number; // Particle lifetime in seconds
	maxParticles?: number;
	velocity?: {
		min: Vector2;
		max: Vector2;
	};
	acceleration?: Vector2;
	size?: {
		min: number;
		max: number;
	};
	color?: string | string[];
	alpha?: {
		start: number;
		end: number;
	};
	rotation?: {
		min: number;
		max: number;
	};
	rotationSpeed?: {
		min: number;
		max: number;
	};
	spread?: number; // Angle spread in radians
	direction?: number; // Base direction in radians
	oneShot?: boolean; // Emit all particles at once
	burstCount?: number; // Number of particles in one-shot mode
}

export class ParticleSystem {
	private particles: Particle[] = [];
	private emitters: Map<string, ParticleEmitter> = new Map();
	private particlePool: Particle[] = [];

	/**
	 * Create particle emitter
	 */
	createEmitter(id: string, config: ParticleEmitterConfig): ParticleEmitter {
		const emitter = new ParticleEmitter(config, this);
		this.emitters.set(id, emitter);
		return emitter;
	}

	/**
	 * Get emitter by ID
	 */
	getEmitter(id: string): ParticleEmitter | undefined {
		return this.emitters.get(id);
	}

	/**
	 * Remove emitter
	 */
	removeEmitter(id: string): void {
		const emitter = this.emitters.get(id);
		if (emitter) {
			emitter.stop();
			this.emitters.delete(id);
		}
	}

	/**
	 * Add particle to system
	 */
	addParticle(particle: Particle): void {
		this.particles.push(particle);
	}

	/**
	 * Get particle from pool or create new
	 */
	getParticle(): Particle {
		if (this.particlePool.length > 0) {
			return this.particlePool.pop()!;
		}

		return {
			position: new Vector2(0, 0),
			velocity: new Vector2(0, 0),
			acceleration: new Vector2(0, 0),
			life: 0,
			maxLife: 1,
			size: 1,
			color: '#ffffff',
			alpha: 1,
			rotation: 0,
			rotationSpeed: 0,
		};
	}

	/**
	 * Return particle to pool
	 */
	recycleParticle(particle: Particle): void {
		this.particlePool.push(particle);
	}

	/**
	 * Update all particles
	 */
	update(deltaTime: number): void {
		// Update emitters
		for (const emitter of this.emitters.values()) {
			emitter.update(deltaTime);
		}

		// Update particles
		for (let i = this.particles.length - 1; i >= 0; i--) {
			const particle = this.particles[i];

			// Update physics
			particle.velocity.x += particle.acceleration.x * deltaTime;
			particle.velocity.y += particle.acceleration.y * deltaTime;
			particle.position.x += particle.velocity.x * deltaTime;
			particle.position.y += particle.velocity.y * deltaTime;

			// Update rotation
			particle.rotation += particle.rotationSpeed * deltaTime;

			// Update life
			particle.life += deltaTime;

			// Update alpha based on lifetime
			const lifeRatio = particle.life / particle.maxLife;
			particle.alpha = 1 - lifeRatio;

			// Remove dead particles
			if (particle.life >= particle.maxLife) {
				this.recycleParticle(particle);
				this.particles.splice(i, 1);
			}
		}
	}

	/**
	 * Render all particles
	 */
	render(ctx: CanvasRenderingContext2D): void {
		ctx.save();

		for (const particle of this.particles) {
			ctx.save();
			ctx.globalAlpha = particle.alpha;
			ctx.translate(particle.position.x, particle.position.y);
			ctx.rotate(particle.rotation);
			ctx.fillStyle = particle.color;

			// Draw particle (simple circle)
			ctx.beginPath();
			ctx.arc(0, 0, particle.size, 0, Math.PI * 2);
			ctx.fill();

			ctx.restore();
		}

		ctx.restore();
	}

	/**
	 * Clear all particles and emitters
	 */
	clear(): void {
		this.particles = [];
		this.emitters.clear();
		this.particlePool = [];
	}

	/**
	 * Get particle count
	 */
	getParticleCount(): number {
		return this.particles.length;
	}
}

export class ParticleEmitter {
	private config: ParticleEmitterConfig;
	private system: ParticleSystem;
	private active: boolean = false;
	private timeSinceLastEmit: number = 0;

	constructor(config: ParticleEmitterConfig, system: ParticleSystem) {
		this.config = config;
		this.system = system;
	}

	/**
	 * Start emitting particles
	 */
	start(): void {
		this.active = true;

		// One-shot mode
		if (this.config.oneShot) {
			const count = this.config.burstCount || 10;
			for (let i = 0; i < count; i++) {
				this.emitParticle();
			}
			this.active = false;
		}
	}

	/**
	 * Stop emitting particles
	 */
	stop(): void {
		this.active = false;
	}

	/**
	 * Update emitter
	 */
	update(deltaTime: number): void {
		if (!this.active || this.config.oneShot) return;

		this.timeSinceLastEmit += deltaTime;

		const emitInterval = 1 / this.config.rate;

		while (this.timeSinceLastEmit >= emitInterval) {
			this.emitParticle();
			this.timeSinceLastEmit -= emitInterval;
		}
	}

	/**
	 * Emit a single particle
	 */
	private emitParticle(): void {
		const particle = this.system.getParticle();

		// Position
		particle.position.copy(this.config.position);

		// Velocity
		const spread = this.config.spread || 0;
		const direction = this.config.direction || 0;
		const angle = direction + (Math.random() - 0.5) * spread;

		if (this.config.velocity) {
			const speedMin = this.config.velocity.min.magnitude();
			const speedMax = this.config.velocity.max.magnitude();
			const speed = speedMin + Math.random() * (speedMax - speedMin);

			particle.velocity.x = Math.cos(angle) * speed;
			particle.velocity.y = Math.sin(angle) * speed;
		} else {
			particle.velocity.set(0, 0);
		}

		// Acceleration
		if (this.config.acceleration) {
			particle.acceleration.copy(this.config.acceleration);
		} else {
			particle.acceleration.set(0, 0);
		}

		// Life
		particle.life = 0;
		particle.maxLife = this.config.lifetime;

		// Size
		if (this.config.size) {
			particle.size =
				this.config.size.min + Math.random() * (this.config.size.max - this.config.size.min);
		} else {
			particle.size = 2;
		}

		// Color
		if (Array.isArray(this.config.color)) {
			particle.color = this.config.color[Math.floor(Math.random() * this.config.color.length)];
		} else {
			particle.color = this.config.color || '#ffffff';
		}

		// Alpha
		if (this.config.alpha) {
			particle.alpha = this.config.alpha.start;
		} else {
			particle.alpha = 1;
		}

		// Rotation
		if (this.config.rotation) {
			particle.rotation =
				this.config.rotation.min +
				Math.random() * (this.config.rotation.max - this.config.rotation.min);
		} else {
			particle.rotation = 0;
		}

		// Rotation speed
		if (this.config.rotationSpeed) {
			particle.rotationSpeed =
				this.config.rotationSpeed.min +
				Math.random() * (this.config.rotationSpeed.max - this.config.rotationSpeed.min);
		} else {
			particle.rotationSpeed = 0;
		}

		this.system.addParticle(particle);
	}

	/**
	 * Update emitter position
	 */
	setPosition(position: Vector2): void {
		this.config.position = position;
	}

	/**
	 * Check if active
	 */
	isActive(): boolean {
		return this.active;
	}
}

// Preset particle effects
export class ParticlePresets {
	/**
	 * Create explosion effect
	 */
	static explosion(system: ParticleSystem, position: Vector2, color: string = '#ff6600'): void {
		const emitter = system.createEmitter('explosion_' + Date.now(), {
			position: position.clone(),
			rate: 100,
			lifetime: 0.8,
			oneShot: true,
			burstCount: 30,
			velocity: {
				min: new Vector2(-100, -100),
				max: new Vector2(100, 100),
			},
			acceleration: new Vector2(0, 200),
			size: {
				min: 2,
				max: 6,
			},
			color: [color, '#ff9933', '#ffcc00'],
			spread: Math.PI * 2,
		});

		emitter.start();
	}

	/**
	 * Create hit spark effect
	 */
	static hitSpark(system: ParticleSystem, position: Vector2): void {
		const emitter = system.createEmitter('spark_' + Date.now(), {
			position: position.clone(),
			rate: 100,
			lifetime: 0.3,
			oneShot: true,
			burstCount: 10,
			velocity: {
				min: new Vector2(-80, -80),
				max: new Vector2(80, 80),
			},
			size: {
				min: 1,
				max: 3,
			},
			color: ['#ffffff', '#ffff00'],
			spread: Math.PI * 2,
		});

		emitter.start();
	}

	/**
	 * Create heal effect
	 */
	static heal(system: ParticleSystem, position: Vector2): void {
		const emitter = system.createEmitter('heal_' + Date.now(), {
			position: position.clone(),
			rate: 50,
			lifetime: 1.5,
			oneShot: true,
			burstCount: 20,
			velocity: {
				min: new Vector2(-20, -60),
				max: new Vector2(20, -40),
			},
			acceleration: new Vector2(0, -50),
			size: {
				min: 2,
				max: 4,
			},
			color: ['#00ff00', '#00ff88', '#88ffaa'],
			spread: Math.PI / 3,
			direction: -Math.PI / 2,
		});

		emitter.start();
	}

	/**
	 * Create magic cast effect
	 */
	static magicCast(system: ParticleSystem, position: Vector2, element: string = 'fire'): void {
		const colors: Record<string, string[]> = {
			fire: ['#ff6600', '#ff9933', '#ffcc00'],
			water: ['#0066ff', '#3399ff', '#66ccff'],
			earth: ['#996633', '#cc9966', '#ffcc99'],
			neutral: ['#9933ff', '#cc66ff', '#ff99ff'],
		};

		const emitter = system.createEmitter('magic_' + Date.now(), {
			position: position.clone(),
			rate: 100,
			lifetime: 1,
			oneShot: true,
			burstCount: 15,
			velocity: {
				min: new Vector2(-30, -30),
				max: new Vector2(30, 30),
			},
			size: {
				min: 2,
				max: 5,
			},
			color: colors[element] || colors.neutral,
			spread: Math.PI * 2,
			rotationSpeed: {
				min: -3,
				max: 3,
			},
		});

		emitter.start();
	}
}
