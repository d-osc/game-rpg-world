/**
 * Movement System
 * Handles player movement input and updates
 */

import { Vector2, keyboard, Keyboard } from '@rpg/game-engine';
import { Player } from '../entities/Player.ts';

export class MovementSystem {
  private player: Player;
  private moveSpeed: number;

  constructor(player: Player, moveSpeed: number = 200) {
    this.player = player;
    this.moveSpeed = moveSpeed;
  }

  /**
   * Update movement based on keyboard input
   */
  update(deltaTime: number): void {
    // Get input direction
    const direction = this.getInputDirection();

    // Update player movement
    if (direction.length() > 0) {
      this.player.move(direction);
    } else {
      this.player.stop();
    }

    // Update player
    this.player.update(deltaTime);
  }

  /**
   * Get movement direction from keyboard input
   */
  private getInputDirection(): Vector2 {
    let direction = Vector2.zero();

    // WASD movement
    if (keyboard.isKeyDown(Keyboard.Keys.W) || keyboard.isKeyDown(Keyboard.Keys.ARROW_UP)) {
      direction.y -= 1;
    }
    if (keyboard.isKeyDown(Keyboard.Keys.S) || keyboard.isKeyDown(Keyboard.Keys.ARROW_DOWN)) {
      direction.y += 1;
    }
    if (keyboard.isKeyDown(Keyboard.Keys.A) || keyboard.isKeyDown(Keyboard.Keys.ARROW_LEFT)) {
      direction.x -= 1;
    }
    if (keyboard.isKeyDown(Keyboard.Keys.D) || keyboard.isKeyDown(Keyboard.Keys.ARROW_RIGHT)) {
      direction.x += 1;
    }

    // Normalize diagonal movement
    if (direction.length() > 0) {
      direction = direction.normalize();
    }

    return direction;
  }

  /**
   * Set player reference
   */
  setPlayer(player: Player): void {
    this.player = player;
  }

  /**
   * Get player reference
   */
  getPlayer(): Player {
    return this.player;
  }

  /**
   * Set movement speed
   */
  setMoveSpeed(speed: number): void {
    this.moveSpeed = speed;
    this.player.speed = speed;
  }
}
