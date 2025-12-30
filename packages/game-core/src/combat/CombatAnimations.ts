/**
 * CombatAnimations
 * Animation system for combat effects
 */

export interface DamageNumberConfig {
	x: number;
	y: number;
	damage: number;
	isCritical: boolean;
	isWeak: boolean;
	isResisted: boolean;
	isHeal?: boolean;
}

export interface CombatAnimationConfig {
	type: 'attack' | 'skill' | 'damage' | 'heal' | 'status';
	x: number;
	y: number;
	data?: any;
}

export class DamageNumber {
	private x: number;
	private y: number;
	private startY: number;
	private damage: number;
	private isCritical: boolean;
	private isWeak: boolean;
	private isResisted: boolean;
	private isHeal: boolean;
	private opacity: number = 1;
	private lifetime: number = 0;
	private maxLifetime: number = 1500; // 1.5 seconds
	private isAlive: boolean = true;

	constructor(config: DamageNumberConfig) {
		this.x = config.x;
		this.y = config.y;
		this.startY = config.y;
		this.damage = config.damage;
		this.isCritical = config.isCritical;
		this.isWeak = config.isWeak;
		this.isResisted = config.isResisted;
		this.isHeal = config.isHeal || false;
	}

	update(deltaTime: number): void {
		this.lifetime += deltaTime * 1000;

		// Float upward
		this.y = this.startY - (this.lifetime / this.maxLifetime) * 60;

		// Fade out
		this.opacity = 1 - this.lifetime / this.maxLifetime;

		if (this.lifetime >= this.maxLifetime) {
			this.isAlive = false;
		}
	}

	render(ctx: CanvasRenderingContext2D): void {
		if (!this.isAlive) return;

		ctx.save();
		ctx.globalAlpha = this.opacity;

		// Color based on type
		let color = '#fff';
		if (this.isHeal) {
			color = '#2ecc71';
		} else if (this.isCritical) {
			color = '#e74c3c';
		} else if (this.isWeak) {
			color = '#f39c12';
		} else if (this.isResisted) {
			color = '#95a5a6';
		}

		// Font size based on type
		const fontSize = this.isCritical ? 32 : 24;
		ctx.font = `bold ${fontSize}px monospace`;
		ctx.fillStyle = color;
		ctx.strokeStyle = '#000';
		ctx.lineWidth = 3;
		ctx.textAlign = 'center';

		const text = this.isHeal ? `+${this.damage}` : `-${this.damage}`;

		// Outline
		ctx.strokeText(text, this.x, this.y);

		// Fill
		ctx.fillText(text, this.x, this.y);

		// Add modifier text
		if (this.isCritical) {
			ctx.font = 'bold 14px monospace';
			ctx.fillStyle = '#e74c3c';
			ctx.strokeText('CRITICAL!', this.x, this.y - 25);
			ctx.fillText('CRITICAL!', this.x, this.y - 25);
		} else if (this.isWeak) {
			ctx.font = 'bold 12px monospace';
			ctx.fillStyle = '#f39c12';
			ctx.strokeText('Super Effective!', this.x, this.y - 20);
			ctx.fillText('Super Effective!', this.x, this.y - 20);
		} else if (this.isResisted) {
			ctx.font = 'bold 12px monospace';
			ctx.fillStyle = '#95a5a6';
			ctx.strokeText('Resisted', this.x, this.y - 20);
			ctx.fillText('Resisted', this.x, this.y - 20);
		}

		ctx.restore();
	}

	isFinished(): boolean {
		return !this.isAlive;
	}
}

export class AttackAnimation {
	private x: number;
	private y: number;
	private targetX: number;
	private targetY: number;
	private startX: number;
	private startY: number;
	private progress: number = 0;
	private duration: number = 0.3; // 300ms
	private isAlive: boolean = true;
	private phase: 'forward' | 'backward' = 'forward';

	constructor(x: number, y: number, targetX: number, targetY: number) {
		this.x = x;
		this.y = y;
		this.startX = x;
		this.startY = y;
		this.targetX = targetX;
		this.targetY = targetY;
	}

	update(deltaTime: number): void {
		this.progress += deltaTime / this.duration;

		if (this.phase === 'forward') {
			if (this.progress >= 1) {
				this.progress = 0;
				this.phase = 'backward';
			} else {
				// Ease out quad
				const t = 1 - (1 - this.progress) * (1 - this.progress);
				this.x = this.startX + (this.targetX - this.startX) * t;
				this.y = this.startY + (this.targetY - this.startY) * t;
			}
		} else {
			if (this.progress >= 1) {
				this.isAlive = false;
			} else {
				// Ease in quad
				const t = this.progress * this.progress;
				this.x = this.targetX + (this.startX - this.targetX) * t;
				this.y = this.targetY + (this.startY - this.targetY) * t;
			}
		}
	}

	render(ctx: CanvasRenderingContext2D): void {
		if (!this.isAlive) return;

		ctx.save();

		// Draw motion blur effect
		ctx.strokeStyle = 'rgba(255, 255, 255, 0.6)';
		ctx.lineWidth = 8;
		ctx.lineCap = 'round';
		ctx.beginPath();
		ctx.moveTo(this.startX, this.startY);
		ctx.lineTo(this.x, this.y);
		ctx.stroke();

		// Draw impact flash at target during forward phase
		if (this.phase === 'forward' && this.progress > 0.8) {
			ctx.fillStyle = `rgba(255, 255, 255, ${(1 - this.progress) * 2})`;
			ctx.beginPath();
			ctx.arc(this.targetX, this.targetY, 30, 0, Math.PI * 2);
			ctx.fill();
		}

		ctx.restore();
	}

	isFinished(): boolean {
		return !this.isAlive;
	}

	getPosition(): { x: number; y: number } {
		return { x: this.x, y: this.y };
	}
}

export class SkillAnimation {
	private x: number;
	private y: number;
	private skillType: string;
	private lifetime: number = 0;
	private maxLifetime: number = 0.6; // 600ms
	private isAlive: boolean = true;
	private particles: Array<{
		x: number;
		y: number;
		vx: number;
		vy: number;
		life: number;
		color: string;
	}> = [];

	constructor(x: number, y: number, skillType: string) {
		this.x = x;
		this.y = y;
		this.skillType = skillType;

		// Create particles based on skill type
		const particleCount = 15;
		const color = this.getSkillColor(skillType);

		for (let i = 0; i < particleCount; i++) {
			const angle = (Math.PI * 2 * i) / particleCount;
			const speed = 100 + Math.random() * 100;
			this.particles.push({
				x: this.x,
				y: this.y,
				vx: Math.cos(angle) * speed,
				vy: Math.sin(angle) * speed,
				life: 1,
				color,
			});
		}
	}

	private getSkillColor(skillType: string): string {
		if (skillType.includes('fire') || skillType.includes('flame')) {
			return '#e74c3c';
		} else if (skillType.includes('water') || skillType.includes('acid')) {
			return '#3498db';
		} else if (skillType.includes('earth') || skillType.includes('rock') || skillType.includes('crystal')) {
			return '#8b4513';
		} else if (skillType.includes('heal')) {
			return '#2ecc71';
		} else {
			return '#9b59b6';
		}
	}

	update(deltaTime: number): void {
		this.lifetime += deltaTime;

		// Update particles
		this.particles.forEach((p) => {
			p.x += p.vx * deltaTime;
			p.y += p.vy * deltaTime;
			p.life -= deltaTime / this.maxLifetime;
		});

		if (this.lifetime >= this.maxLifetime) {
			this.isAlive = false;
		}
	}

	render(ctx: CanvasRenderingContext2D): void {
		if (!this.isAlive) return;

		ctx.save();

		// Draw center glow
		const glowSize = 40 * (1 - this.lifetime / this.maxLifetime);
		const gradient = ctx.createRadialGradient(this.x, this.y, 0, this.x, this.y, glowSize);
		gradient.addColorStop(0, this.particles[0].color + 'aa');
		gradient.addColorStop(1, this.particles[0].color + '00');
		ctx.fillStyle = gradient;
		ctx.fillRect(this.x - glowSize, this.y - glowSize, glowSize * 2, glowSize * 2);

		// Draw particles
		this.particles.forEach((p) => {
			if (p.life > 0) {
				ctx.fillStyle = p.color;
				ctx.globalAlpha = p.life;
				ctx.beginPath();
				ctx.arc(p.x, p.y, 4, 0, Math.PI * 2);
				ctx.fill();
			}
		});

		ctx.restore();
	}

	isFinished(): boolean {
		return !this.isAlive;
	}
}

export class CombatAnimationManager {
	private damageNumbers: DamageNumber[] = [];
	private attackAnimations: AttackAnimation[] = [];
	private skillAnimations: SkillAnimation[] = [];

	/**
	 * Add damage number
	 */
	addDamageNumber(config: DamageNumberConfig): void {
		this.damageNumbers.push(new DamageNumber(config));
	}

	/**
	 * Add attack animation
	 */
	addAttackAnimation(x: number, y: number, targetX: number, targetY: number): void {
		this.attackAnimations.push(new AttackAnimation(x, y, targetX, targetY));
	}

	/**
	 * Add skill animation
	 */
	addSkillAnimation(x: number, y: number, skillType: string): void {
		this.skillAnimations.push(new SkillAnimation(x, y, skillType));
	}

	/**
	 * Update all animations
	 */
	update(deltaTime: number): void {
		// Update damage numbers
		this.damageNumbers.forEach((dn) => dn.update(deltaTime));
		this.damageNumbers = this.damageNumbers.filter((dn) => !dn.isFinished());

		// Update attack animations
		this.attackAnimations.forEach((aa) => aa.update(deltaTime));
		this.attackAnimations = this.attackAnimations.filter((aa) => !aa.isFinished());

		// Update skill animations
		this.skillAnimations.forEach((sa) => sa.update(deltaTime));
		this.skillAnimations = this.skillAnimations.filter((sa) => !sa.isFinished());
	}

	/**
	 * Render all animations
	 */
	render(ctx: CanvasRenderingContext2D): void {
		// Render attack animations first (background)
		this.attackAnimations.forEach((aa) => aa.render(ctx));

		// Render skill animations
		this.skillAnimations.forEach((sa) => sa.render(ctx));

		// Render damage numbers last (foreground)
		this.damageNumbers.forEach((dn) => dn.render(ctx));
	}

	/**
	 * Clear all animations
	 */
	clear(): void {
		this.damageNumbers = [];
		this.attackAnimations = [];
		this.skillAnimations = [];
	}

	/**
	 * Get active animation count
	 */
	getActiveCount(): number {
		return (
			this.damageNumbers.length +
			this.attackAnimations.length +
			this.skillAnimations.length
		);
	}
}
