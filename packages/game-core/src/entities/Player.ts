/**
 * Player Entity
 * The main player character
 */

import { Vector2 } from '@rpg/game-engine';
import { AABB } from '@rpg/game-engine';

export interface PlayerConfig {
  position: Vector2;
  speed?: number;
}

export class Player {
  // Transform
  public position: Vector2;
  public velocity: Vector2 = Vector2.zero();

  // Movement
  public speed: number;
  public isMoving: boolean = false;
  public direction: Vector2 = new Vector2(0, 1); // Default: facing down

  // Collision
  public bounds: AABB;
  public width: number = 32;
  public height: number = 32;

  // Animation state
  public currentAnimation: string = 'idle_down';

  constructor(config: PlayerConfig) {
    this.position = config.position.clone();
    this.speed = config.speed ?? 200; // pixels per second

    // Initialize collision bounds
    this.bounds = new AABB(
      this.position.clone(),
      new Vector2(this.width / 2, this.height / 2)
    );
  }

  /**
   * Update player logic
   */
  update(deltaTime: number): void {
    // Update position based on velocity
    if (this.velocity.length() > 0) {
      this.position = this.position.add(this.velocity.multiply(deltaTime));
      this.isMoving = true;

      // Update direction based on velocity
      this.direction = this.velocity.normalize();

      // Update animation based on direction
      this.updateAnimation();
    } else {
      this.isMoving = false;
      this.updateAnimation();
    }

    // Update collision bounds
    this.bounds.center = this.position.clone();
  }

  /**
   * Set movement velocity
   */
  setVelocity(velocity: Vector2): void {
    this.velocity = velocity;
  }

  /**
   * Move in a direction
   */
  move(direction: Vector2): void {
    if (direction.length() > 0) {
      this.velocity = direction.normalize().multiply(this.speed);
    } else {
      this.velocity = Vector2.zero();
    }
  }

  /**
   * Stop moving
   */
  stop(): void {
    this.velocity = Vector2.zero();
  }

  /**
   * Update animation based on direction and movement
   */
  private updateAnimation(): void {
    if (this.isMoving) {
      // Determine direction (8-directional)
      const angle = Math.atan2(this.direction.y, this.direction.x);
      const degrees = (angle * 180) / Math.PI;

      // Convert angle to direction
      if (degrees >= -22.5 && degrees < 22.5) {
        this.currentAnimation = 'walk_right';
      } else if (degrees >= 22.5 && degrees < 67.5) {
        this.currentAnimation = 'walk_down_right';
      } else if (degrees >= 67.5 && degrees < 112.5) {
        this.currentAnimation = 'walk_down';
      } else if (degrees >= 112.5 && degrees < 157.5) {
        this.currentAnimation = 'walk_down_left';
      } else if (degrees >= 157.5 || degrees < -157.5) {
        this.currentAnimation = 'walk_left';
      } else if (degrees >= -157.5 && degrees < -112.5) {
        this.currentAnimation = 'walk_up_left';
      } else if (degrees >= -112.5 && degrees < -67.5) {
        this.currentAnimation = 'walk_up';
      } else if (degrees >= -67.5 && degrees < -22.5) {
        this.currentAnimation = 'walk_up_right';
      }
    } else {
      // Idle animation based on last direction
      const angle = Math.atan2(this.direction.y, this.direction.x);
      const degrees = (angle * 180) / Math.PI;

      if (degrees >= -45 && degrees < 45) {
        this.currentAnimation = 'idle_right';
      } else if (degrees >= 45 && degrees < 135) {
        this.currentAnimation = 'idle_down';
      } else if (degrees >= 135 || degrees < -135) {
        this.currentAnimation = 'idle_left';
      } else {
        this.currentAnimation = 'idle_up';
      }
    }
  }

  /**
   * Get player bounds for collision
   */
  getBounds(): AABB {
    return this.bounds;
  }

  /**
   * Get player position
   */
  getPosition(): Vector2 {
    return this.position.clone();
  }

  /**
   * Set player position
   */
  setPosition(position: Vector2): void {
    this.position = position.clone();
    this.bounds.center = this.position.clone();
  }

  /**
   * Check collision with AABB
   */
  checkCollision(aabb: AABB): boolean {
    return this.bounds.intersects(aabb);
  }
}
